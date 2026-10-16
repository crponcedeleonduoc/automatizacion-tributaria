from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from comun.modelos import Trabajo
from comun.planes import PLANES

from ..deps import DB, UsuarioActual
from ..esquemas import PlanOut, TrabajoOut

router = APIRouter(prefix="/api", tags=["trabajos"])


def _out(t: Trabajo) -> TrabajoOut:
    return TrabajoOut(id=str(t.id), tipo=t.tipo, estado=t.estado, rut=t.rut,
                      resultado=t.resultado or {}, error=t.error, creado=t.creado,
                      terminado=t.terminado, tiene_archivo=bool(t.archivo),
                      origen=(t.parametros or {}).get("origen", "manual"),
                      parametros={k: v for k, v in (t.parametros or {}).items()})


@router.get("/trabajos", response_model=list[TrabajoOut])
def listar(db: DB, u: UsuarioActual,
           tipo: str | None = Query(default=None, pattern="^(rcv|tgr|f29|rcv_historico)$"),
           estado: str | None = Query(default=None, pattern="^(ok|error|pendiente|corriendo)$"),
           limite: int = Query(default=50, ge=1, le=200),
           desde: int = Query(default=0, ge=0)):
    q = select(Trabajo).where(Trabajo.usuario_id == u.id)
    if tipo:
        q = q.where(Trabajo.tipo == tipo)
    if estado:
        q = q.where(Trabajo.estado == estado)
    filas = db.execute(q.order_by(Trabajo.creado.desc())
                       .offset(desde).limit(limite)).scalars().all()
    return [_out(t) for t in filas]


@router.get("/trabajos/resumen")
def resumen(db: DB, u: UsuarioActual):
    """Conteo por tipo y estado, para las pestañas del registro de actividad."""
    from sqlalchemy import func
    filas = db.execute(select(Trabajo.tipo, Trabajo.estado, func.count())
                       .where(Trabajo.usuario_id == u.id)
                       .group_by(Trabajo.tipo, Trabajo.estado)).all()
    out: dict[str, dict[str, int]] = {}
    for tipo, estado, n in filas:
        out.setdefault(tipo, {})[estado] = n
    return out


@router.get("/trabajos/{trabajo_id}", response_model=TrabajoOut)
def detalle(trabajo_id: str, db: DB, u: UsuarioActual):
    try:
        t = db.get(Trabajo, uuid.UUID(trabajo_id))
    except ValueError:
        t = None
    if not t or t.usuario_id != u.id:
        raise HTTPException(404, "Trabajo no encontrado")
    return _out(t)


@router.get("/planes", response_model=list[PlanOut])
def planes():
    return [PlanOut(codigo=p.codigo, nombre=p.nombre, precio_clp=p.precio_clp,
                    max_ruts=p.max_ruts, documentos=list(p.documentos),
                    frecuencia_minutos=p.frecuencia_minutos,
                    frecuencia_defecto=p.frecuencia_defecto,
                    historial_meses=p.historial_meses, alertas_correo=p.alertas_correo,
                    soporte=p.soporte) for p in PLANES.values()]
