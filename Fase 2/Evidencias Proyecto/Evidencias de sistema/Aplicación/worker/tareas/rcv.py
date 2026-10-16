"""Tareas RCV: sincronización de una empresa y demo pública."""

from __future__ import annotations

import uuid
import zipfile

from sqlalchemy import select

from comun.cifrado import ErrorCifrado
from comun.cola import candado_rut, RutOcupado
from comun.modelos import Empresa, RcvDescarga, RcvDocumento, Trabajo
from sii_core import (ClaveAuthTLS, ClienteRCV, CredencialesInvalidas,
                      SesionesExcedidas, SiiError, formatear_rut,
                      parsear_csv_rcv, periodo_actual)
from sii_core.utils import periodo_anterior

from .base import (EjecucionTrabajo, ahora, credencial, crear_alerta, db,
                   relativa, ruta_datos)


# ---------------------------------------------------------------------------
# Demo pública: RUT + clave → CSV del RCV del período. No guarda credenciales.
# ---------------------------------------------------------------------------

def demo_rcv(trabajo_id: str, rut: str, clave: str, periodo: str | None = None,
             operacion: str = "VENTA") -> dict:
    rut = formatear_rut(rut)
    periodo = periodo or periodo_actual()
    ej = EjecucionTrabajo(trabajo_id, "demo_rcv", rut)
    with ej:
        try:
            with candado_rut(rut, espera_max=60):
                with ClaveAuthTLS(rut, clave) as auth:
                    cli = ClienteRCV(auth)
                    try:
                        csv_txt = cli.csv(rut, periodo, operacion, "REGISTRO")
                    except SiiError as e:
                        if "no existen datos" in str(e).lower():
                            csv_txt = ""
                        else:
                            raise
            filas = parsear_csv_rcv(csv_txt) if csv_txt else []
            archivo = None
            if csv_txt:
                p = ruta_datos("demo", f"{trabajo_id}.csv")
                p.write_text(csv_txt, encoding="utf-8")
                archivo = relativa(p)
            resultado = {
                "rut": rut, "periodo": periodo, "operacion": operacion,
                "n_docs": len(filas),
                "total": sum(f["monto_total"] for f in filas),
                "iva": sum(f["monto_iva"] for f in filas),
                "muestra": [
                    {"tipo_doc": f["tipo_doc"], "folio": f["folio"],
                     "rut": f["rut_contraparte"], "razon_social": f["razon_social"],
                     "fecha": f["fecha_emision"], "total": f["monto_total"]}
                    for f in filas[:10]
                ],
                "resumen": f"{len(filas)} documentos en {periodo}",
            }
            ej.terminar(resultado, archivo)
            return resultado
        except CredencialesInvalidas as e:
            ej.fallar(str(e), credencial_invalida=True)
            raise
        except (SesionesExcedidas, RutOcupado, SiiError) as e:
            ej.fallar(str(e))
            raise
        except ErrorCifrado as e:
            ej.fallar(f"Configuración: {e}")
            return {"error": str(e)}
        except Exception as e:
            ej.fallar(f"Error inesperado: {e}")
            raise


# ---------------------------------------------------------------------------
# Sincronización de una empresa registrada
# ---------------------------------------------------------------------------

def sincronizar_rcv(empresa_id: str, trabajo_id: str | None = None,
                    periodos: list[str] | None = None) -> dict:
    eid = uuid.UUID(str(empresa_id))
    with db() as s:
        emp = s.get(Empresa, eid)
        if not emp or not emp.activa:
            return {"omitido": "empresa inexistente o inactiva"}
        rut = emp.rut

    per_actual = periodo_actual()
    periodos = periodos or [periodo_anterior(per_actual), per_actual]
    ej = EjecucionTrabajo(trabajo_id, "rcv", rut, eid)
    with ej:
        try:
            with db() as s:
                clave = credencial(s.get(Empresa, eid))[1]
            csvs: dict[tuple[str, str, str], str] = {}
            with candado_rut(rut):
                with ClaveAuthTLS(rut, clave) as auth:
                    cli = ClienteRCV(auth)
                    for per in periodos:
                        for op in ("COMPRA", "VENTA"):
                            for estado, txt in cli.todos_estados(rut, per, op).items():
                                csvs[(per, op, estado)] = txt

            nuevos, reclamados = _guardar_documentos(eid, csvs)
            with db() as s:
                emp = s.get(Empresa, eid)
                emp.ultima_rcv = ahora()
                emp.ultimo_error = None
                emp.credencial_invalida = False
            resultado = {"periodos": periodos, "archivos": len(csvs),
                         "documentos_nuevos": nuevos, "reclamados_nuevos": reclamados,
                         "resumen": f"{nuevos} documentos nuevos, "
                                    f"{reclamados} reclamados nuevos"}
            ej.terminar(resultado)
            return resultado
        except CredencialesInvalidas as e:
            ej.fallar(str(e), credencial_invalida=True)
            with db() as s:
                crear_alerta(s, eid, "credencial_invalida",
                             "El SII rechazó la clave tributaria. Actualízala.",
                             {"error": str(e)})
            return {"error": str(e)}
        except (SesionesExcedidas, RutOcupado) as e:
            ej.fallar(str(e))
            return {"error": str(e), "reintentar": True}
        except SiiError as e:
            ej.fallar(str(e))
            return {"error": str(e)}
        except ErrorCifrado as e:
            ej.fallar(f"Configuración: {e}")
            return {"error": str(e)}
        except Exception as e:
            ej.fallar(f"Error inesperado: {e}")
            raise


def _guardar_documentos(eid, csvs: dict[tuple[str, str, str], str],
                        alertar: bool = True) -> tuple[int, int]:
    """Guarda CSV crudo + filas; devuelve (nuevos, reclamados_nuevos).
    Con alertar=False (histórico) no genera alertas por facturas reclamadas antiguas."""
    nuevos = reclamados = 0
    t = ahora()
    with db() as s:
        for (per, op, estado), txt in csvs.items():
            p = ruta_datos("rcv", str(eid), f"{per}_{op.lower()}_{estado.lower()}.csv")
            p.write_text(txt, encoding="utf-8")
            filas = parsear_csv_rcv(txt)
            s.add(RcvDescarga(empresa_id=eid, periodo=per, operacion=op,
                              estado_contab=estado, archivo=relativa(p),
                              n_docs=len(filas)))
            for f in filas:
                existente = s.execute(select(RcvDocumento).where(
                    RcvDocumento.empresa_id == eid,
                    RcvDocumento.periodo == per,
                    RcvDocumento.operacion == op,
                    RcvDocumento.tipo_doc == f["tipo_doc"],
                    RcvDocumento.folio == f["folio"],
                    RcvDocumento.rut_contraparte == f["rut_contraparte"],
                )).scalar_one_or_none()
                if existente:
                    cambio_estado = existente.estado_contab != estado
                    existente.estado_contab = estado
                    existente.fecha_acuse = f.get("fecha_acuse") or existente.fecha_acuse
                    existente.fila = f["fila"]
                    existente.visto_ultima_vez = t
                    if cambio_estado and estado == "RECLAMADO":
                        reclamados += 1
                        if alertar:
                          crear_alerta(s, eid, "factura_reclamada",
                                     f"Factura {f['folio']} de {f['razon_social']} "
                                     f"pasó a RECLAMADO",
                                     {"periodo": per, "operacion": op,
                                      "folio": f["folio"], "total": f["monto_total"]})
                    continue
                s.add(RcvDocumento(
                    empresa_id=eid, periodo=per, operacion=op, estado_contab=estado,
                    tipo_doc=f["tipo_doc"], folio=f["folio"],
                    rut_contraparte=f["rut_contraparte"], razon_social=f["razon_social"],
                    fecha_emision=f["fecha_emision"], fecha_recepcion=f["fecha_recepcion"],
                    fecha_acuse=f.get("fecha_acuse"), monto_exento=f["monto_exento"],
                    monto_neto=f["monto_neto"], monto_iva=f["monto_iva"],
                    monto_total=f["monto_total"], fila=f["fila"],
                    visto_primera_vez=t, visto_ultima_vez=t))
                nuevos += 1
                if estado == "RECLAMADO":
                    reclamados += 1
                    if alertar:
                      crear_alerta(s, eid, "factura_reclamada",
                                 f"Factura {f['folio']} de {f['razon_social']} "
                                 f"está RECLAMADA",
                                 {"periodo": per, "operacion": op,
                                  "folio": f["folio"], "total": f["monto_total"]})
    return nuevos, reclamados


# ---------------------------------------------------------------------------
# Descarga masiva histórica: todos los RCV entre dos períodos → ZIP
# ---------------------------------------------------------------------------

PERIODOS_POR_SESION = 12     # se reabre sesión (y se libera el candado) cada N meses


def periodos_entre(desde: str, hasta: str) -> list[str]:
    """['202301', '202302', ...] inclusive, ascendente."""
    a, m = int(desde[:4]), int(desde[4:])
    fin = (int(hasta[:4]), int(hasta[4:]))
    salida = []
    while (a, m) <= fin:
        salida.append(f"{a}{m:02d}")
        m += 1
        if m == 13:
            m, a = 1, a + 1
    return salida


def _progreso(trabajo_id, hecho: int, total: int, docs: int, errores: list[str]) -> None:
    with db() as s:
        t = s.get(Trabajo, uuid.UUID(str(trabajo_id)))
        if t:
            t.resultado = {**(t.resultado or {}), "progreso": hecho, "total": total,
                           "documentos": docs, "errores": errores[-5:],
                           "resumen": f"{hecho} de {total} períodos · {docs} documentos"}


def descargar_historico(empresa_id: str, trabajo_id: str, desde: str, hasta: str,
                        operaciones: list[str] | None = None) -> dict:
    """Recorre todos los períodos, guarda cada CSV (y sus filas) y arma un ZIP
    con un archivo por período/operación/estado más un consolidado por
    operación. El progreso queda en Trabajo.resultado para la barra del panel."""
    eid = uuid.UUID(str(empresa_id))
    operaciones = [o for o in (operaciones or ["COMPRA", "VENTA"]) if o in ("COMPRA", "VENTA")]
    periodos = periodos_entre(desde, hasta)
    with db() as s:
        emp = s.get(Empresa, eid)
        if not emp or not emp.activa:
            return {"omitido": "empresa inexistente o inactiva"}
        rut = emp.rut

    ej = EjecucionTrabajo(trabajo_id, "rcv_historico", rut, eid)
    with ej:
        try:
            with db() as s:
                clave = credencial(s.get(Empresa, eid))[1]
            zip_path = ruta_datos("rcv_zip", str(eid), f"{trabajo_id}.zip")
            consolidado: dict[str, list[str]] = {op: [] for op in operaciones}
            docs_total, archivos = 0, 0
            errores: list[str] = []
            hecho = 0
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
                for i in range(0, len(periodos), PERIODOS_POR_SESION):
                    lote = periodos[i:i + PERIODOS_POR_SESION]
                    with candado_rut(rut, espera_max=300):
                        with ClaveAuthTLS(rut, clave) as auth:
                            cli = ClienteRCV(auth)
                            for per in lote:
                                csvs: dict[tuple[str, str, str], str] = {}
                                for op in operaciones:
                                    try:
                                        for estado, txt in cli.todos_estados(rut, per, op).items():
                                            csvs[(per, op, estado)] = txt
                                    except SiiError as e:
                                        errores.append(f"{per} {op}: {e}")
                                nuevos, _ = _guardar_documentos(eid, csvs, alertar=False)
                                for (p_, op, estado), txt in csvs.items():
                                    z.writestr(f"{p_[:4]}/RCV_{op}_{estado}_{rut}_{p_}.csv", txt)
                                    archivos += 1
                                    filas = txt.splitlines()
                                    if estado == "REGISTRO" and len(filas) > 1:
                                        if not consolidado[op]:
                                            consolidado[op].append("Periodo;" + filas[0])
                                        consolidado[op].extend(f"{p_};{f}" for f in filas[1:] if f.strip())
                                    docs_total += max(0, len(filas) - 1)
                                hecho += 1
                                _progreso(trabajo_id, hecho, len(periodos), docs_total, errores)
                for op, lineas in consolidado.items():
                    if lineas:
                        z.writestr(f"CONSOLIDADO_RCV_{op}_{rut}_{desde}-{hasta}.csv",
                                   "\n".join(lineas) + "\n")
            with db() as s:
                emp = s.get(Empresa, eid)
                emp.ultimo_error = None
                emp.credencial_invalida = False
            resultado = {"desde": desde, "hasta": hasta, "operaciones": operaciones,
                         "periodos": len(periodos), "progreso": len(periodos),
                         "total": len(periodos), "archivos": archivos,
                         "documentos": docs_total, "errores": errores[-20:],
                         "tamano": zip_path.stat().st_size,
                         "resumen": f"{len(periodos)} períodos · {archivos} archivos · "
                                    f"{docs_total} documentos"
                                    + (f" · {len(errores)} con error" if errores else "")}
            ej.terminar(resultado, relativa(zip_path))
            return resultado
        except CredencialesInvalidas as e:
            ej.fallar(str(e), credencial_invalida=True)
            with db() as s:
                crear_alerta(s, eid, "credencial_invalida",
                             "El SII rechazó la clave tributaria. Actualízala.",
                             {"error": str(e)})
            return {"error": str(e)}
        except (SesionesExcedidas, RutOcupado, SiiError) as e:
            ej.fallar(str(e))
            return {"error": str(e)}
        except ErrorCifrado as e:
            ej.fallar(f"Configuración: {e}")
            return {"error": str(e)}
        except Exception as e:
            ej.fallar(f"Error inesperado: {e}")
            raise
