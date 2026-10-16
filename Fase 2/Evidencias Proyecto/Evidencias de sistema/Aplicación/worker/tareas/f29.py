"""Tarea F29: matriz de estados del año + PDFs compactos (cola sii-navegador)."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select

from comun.cifrado import ErrorCifrado
from comun.cola import candado_rut, RutOcupado
from comun.modelos import Empresa, F29Estado
from sii_core import CredencialesInvalidas, SesionesExcedidas, SiiError, capturar_f29

from .base import (EjecucionTrabajo, ahora, credencial, crear_alerta, db,
                   relativa, ruta_datos)


def sincronizar_f29(empresa_id: str, trabajo_id: str | None = None,
                    anno: str | None = None) -> dict:
    eid = uuid.UUID(str(empresa_id))
    anno = anno or str(date.today().year)
    with db() as s:
        emp = s.get(Empresa, eid)
        if not emp or not emp.activa:
            return {"omitido": "empresa inexistente o inactiva"}
        rut = emp.rut

    ej = EjecucionTrabajo(trabajo_id, "f29", rut, eid)
    with ej:
        try:
            with db() as s:
                clave = credencial(s.get(Empresa, eid))[1]
            with candado_rut(rut, espera_max=300):
                datos = capturar_f29(rut, clave, anno, con_pdf=True, headless=False)
            nuevos_nd = 0
            with db() as s:
                for per, d in sorted(datos.items()):
                    fila = s.execute(select(F29Estado).where(
                        F29Estado.empresa_id == eid, F29Estado.periodo == per
                    )).scalar_one_or_none()
                    pdf_rel = None
                    if d.get("pdf"):
                        p = ruta_datos("f29", str(eid), f"f29_{per}.pdf")
                        p.write_bytes(d["pdf"])
                        pdf_rel = relativa(p)
                    if fila is None:
                        fila = F29Estado(empresa_id=eid, periodo=per, estado=d["estado"])
                        s.add(fila)
                        estado_previo = None
                    else:
                        estado_previo = fila.estado
                    fila.estado = d["estado"]
                    fila.folio = d.get("folio") or fila.folio
                    fila.cod_int = d.get("cod_int") or fila.cod_int
                    fila.pdf = pdf_rel or fila.pdf
                    fila.actualizado = ahora()
                    # alerta: período vencido sin declarar (periodo < mes actual)
                    hoy = date.today()
                    vencido = per < f"{hoy.year}{hoy.month:02d}"
                    if (d["estado"] in ("no_declarado", "observado") and vencido
                            and estado_previo != d["estado"]):
                        nuevos_nd += 1
                        crear_alerta(s, eid, "f29_" + d["estado"],
                                     f"F29 {per[4:]}/{per[:4]} figura como "
                                     f"{d['estado'].replace('_', ' ')}",
                                     {"periodo": per, "estado": d["estado"]})
                emp = s.get(Empresa, eid)
                emp.ultima_f29 = ahora()
                emp.ultimo_error = None
            resumen = {per: d["estado"] for per, d in datos.items()}
            resultado = {"anno": anno, "estados": resumen,
                         "alertas_nuevas": nuevos_nd,
                         "resumen": f"{sum(1 for e in resumen.values() if e == 'declarado')} "
                                    f"declarados de {len(resumen)}"}
            ej.terminar(resultado)
            return resultado
        except CredencialesInvalidas as e:
            ej.fallar(str(e), credencial_invalida=True)
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
