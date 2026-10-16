"""Tarea TGR: certificado de deuda fiscal con navegador (cola sii-navegador)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select

from comun.cifrado import ErrorCifrado
from comun.cola import candado_rut, RutOcupado
from comun.modelos import Empresa, TgrCertificado
from sii_core import CredencialesInvalidas, SesionesExcedidas, SiiError, consultar_tgr

from .base import (EjecucionTrabajo, ahora, credencial, crear_alerta, db,
                   relativa, ruta_datos)


def sincronizar_tgr(empresa_id: str, trabajo_id: str | None = None) -> dict:
    eid = uuid.UUID(str(empresa_id))
    with db() as s:
        emp = s.get(Empresa, eid)
        if not emp or not emp.activa:
            return {"omitido": "empresa inexistente o inactiva"}
        rut = emp.rut
        anterior = s.execute(select(TgrCertificado)
                             .where(TgrCertificado.empresa_id == eid)
                             .order_by(TgrCertificado.creado.desc())
                             .limit(1)).scalar_one_or_none()
        morosa_anterior = anterior.total_morosa if anterior else None

    ej = EjecucionTrabajo(trabajo_id, "tgr", rut, eid)
    with ej:
        try:
            with db() as s:
                clave = credencial(s.get(Empresa, eid))[1]
            with candado_rut(rut, espera_max=300):
                # headless=False + Xvfb: el iframe del PDF no carga en headless.
                deuda, pdf = consultar_tgr(rut, clave, headless=False)
            nombre = datetime.now().strftime("%Y%m%d_%H%M") + ".pdf"
            p = ruta_datos("tgr", str(eid), nombre)
            p.write_bytes(pdf)
            with db() as s:
                s.add(TgrCertificado(
                    empresa_id=eid, fecha_emision=deuda.fecha_emision,
                    total_morosa=deuda.total_morosa,
                    total_no_vencida=deuda.total_no_vencida,
                    n_giros=len(deuda.lineas), lineas=deuda.lineas, pdf=relativa(p)))
                emp = s.get(Empresa, eid)
                emp.ultima_tgr = ahora()
                emp.ultimo_error = None
                if not emp.razon_social and deuda.nombre:
                    emp.razon_social = deuda.nombre
                if morosa_anterior is not None and deuda.total_morosa > morosa_anterior:
                    crear_alerta(s, eid, "deuda_tgr_subio",
                                 f"La deuda TGR subió de ${morosa_anterior:,} a "
                                 f"${deuda.total_morosa:,}".replace(",", "."),
                                 {"anterior": morosa_anterior,
                                  "actual": deuda.total_morosa})
                elif morosa_anterior is None and deuda.total_morosa > 0:
                    crear_alerta(s, eid, "deuda_tgr",
                                 f"Deuda fiscal morosa de ${deuda.total_morosa:,}"
                                 .replace(",", "."),
                                 {"actual": deuda.total_morosa})
            resultado = deuda.a_dict()
            resultado["resumen"] = (f"morosa ${deuda.total_morosa:,}".replace(",", "."))
            ej.terminar(resultado, relativa(p))
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
