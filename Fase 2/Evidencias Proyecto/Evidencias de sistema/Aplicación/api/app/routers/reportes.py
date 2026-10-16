"""Reportes PDF personalizables y seguimiento de F29 no declarados."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from comun.cola import COLA_HTTP, cola
from comun.config import config
from comun.modelos import Empresa, F29Estado, F29Gestion, ReporteGenerado, ReportePlantilla
from comun.reportes import BLOQUES, PLANTILLA_DEFECTO, normalizar_config

from ..deps import DB, UsuarioActual

router = APIRouter(prefix="/api", tags=["reportes"])


# ---------------------------------------------------------------- esquemas

class PlantillaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    config: dict = Field(default_factory=dict)


class GenerarIn(BaseModel):
    empresa_id: str
    plantilla_id: str | None = None
    config: dict | None = None        # permite generar sin guardar plantilla
    nombre: str = Field(default="", max_length=200)


class F29GestionIn(BaseModel):
    monto: int | None = None
    monto_multa: int | None = None
    estado: str = Field(default="Abierta", max_length=20)
    prioridad: str = Field(default="Alta", max_length=10)
    accion: str = Field(default="Calcular y Declarar", max_length=120)
    fecha_compromiso: str | None = Field(default=None, max_length=10)
    fecha_cierre: str | None = Field(default=None, max_length=10)
    comentario: str = Field(default="", max_length=2000)


def _plantilla_out(p: ReportePlantilla) -> dict:
    return {"id": str(p.id), "nombre": p.nombre, "config": p.config,
            "creado": p.creado, "actualizado": p.actualizado}


def _reporte_out(r: ReporteGenerado) -> dict:
    return {"id": str(r.id), "empresa_id": str(r.empresa_id), "nombre": r.nombre,
            "desde": r.desde, "hasta": r.hasta, "estado": r.estado, "error": r.error,
            "resumen": r.resumen, "creado": r.creado, "terminado": r.terminado,
            "tiene_pdf": bool(r.pdf)}


def _empresa(db, u, empresa_id: str) -> Empresa:
    try:
        e = db.get(Empresa, uuid.UUID(empresa_id))
    except ValueError:
        e = None
    if not e or e.usuario_id != u.id:
        raise HTTPException(404, "Empresa no encontrada")
    return e


# ---------------------------------------------------------------- catálogo y plantillas

@router.get("/reportes/catalogo")
def catalogo():
    return {"bloques": BLOQUES, "defecto": PLANTILLA_DEFECTO}


@router.get("/reportes/plantillas")
def listar_plantillas(db: DB, u: UsuarioActual):
    filas = db.execute(select(ReportePlantilla).where(ReportePlantilla.usuario_id == u.id)
                       .order_by(ReportePlantilla.creado)).scalars().all()
    if not filas:
        # primera vez: crear la plantilla por defecto para que haya algo que editar
        p = ReportePlantilla(usuario_id=u.id, nombre="Reporte de deudas",
                             config=normalizar_config(PLANTILLA_DEFECTO))
        db.add(p)
        db.flush()
        filas = [p]
    return [_plantilla_out(p) for p in filas]


@router.post("/reportes/plantillas", status_code=201)
def crear_plantilla(datos: PlantillaIn, db: DB, u: UsuarioActual):
    p = ReportePlantilla(usuario_id=u.id, nombre=datos.nombre.strip(),
                         config=normalizar_config(datos.config))
    db.add(p)
    db.flush()
    return _plantilla_out(p)


@router.put("/reportes/plantillas/{plantilla_id}")
def editar_plantilla(plantilla_id: str, datos: PlantillaIn, db: DB, u: UsuarioActual):
    p = db.get(ReportePlantilla, uuid.UUID(plantilla_id))
    if not p or p.usuario_id != u.id:
        raise HTTPException(404, "Plantilla no encontrada")
    p.nombre = datos.nombre.strip()
    p.config = normalizar_config(datos.config)
    p.actualizado = datetime.now(timezone.utc)
    return _plantilla_out(p)


@router.delete("/reportes/plantillas/{plantilla_id}", status_code=204)
def borrar_plantilla(plantilla_id: str, db: DB, u: UsuarioActual):
    p = db.get(ReportePlantilla, uuid.UUID(plantilla_id))
    if not p or p.usuario_id != u.id:
        raise HTTPException(404, "Plantilla no encontrada")
    db.delete(p)


# ---------------------------------------------------------------- generación

@router.post("/reportes/generar", status_code=202)
def generar(datos: GenerarIn, db: DB, u: UsuarioActual):
    e = _empresa(db, u, datos.empresa_id)
    cfg = None
    pid = None
    if datos.plantilla_id:
        p = db.get(ReportePlantilla, uuid.UUID(datos.plantilla_id))
        if not p or p.usuario_id != u.id:
            raise HTTPException(404, "Plantilla no encontrada")
        cfg, pid = p.config, p.id
    cfg = normalizar_config(datos.config if datos.config is not None else cfg)
    r = ReporteGenerado(usuario_id=u.id, empresa_id=e.id, plantilla_id=pid,
                        nombre=(datos.nombre or cfg["titulo"]).strip(), config=cfg)
    db.add(r)
    db.flush()
    cola(COLA_HTTP).enqueue("tareas.reportes.generar_reporte", str(r.id),
                            job_id=f"reporte-{r.id}", job_timeout=5 * 60)
    return _reporte_out(r)


@router.get("/reportes")
def listar_reportes(db: DB, u: UsuarioActual, empresa_id: str | None = None):
    q = select(ReporteGenerado).where(ReporteGenerado.usuario_id == u.id)
    if empresa_id:
        q = q.where(ReporteGenerado.empresa_id == uuid.UUID(empresa_id))
    filas = db.execute(q.order_by(ReporteGenerado.creado.desc()).limit(100)).scalars().all()
    return [_reporte_out(r) for r in filas]


@router.get("/reportes/{reporte_id}")
def detalle_reporte(reporte_id: str, db: DB, u: UsuarioActual):
    r = db.get(ReporteGenerado, uuid.UUID(reporte_id))
    if not r or r.usuario_id != u.id:
        raise HTTPException(404, "Reporte no encontrado")
    return _reporte_out(r)


@router.get("/reportes/{reporte_id}/pdf")
def pdf_reporte(reporte_id: str, db: DB, u: UsuarioActual):
    r = db.get(ReporteGenerado, uuid.UUID(reporte_id))
    if not r or r.usuario_id != u.id or not r.pdf:
        raise HTTPException(404, "PDF no disponible")
    ruta = config().datos_dir / r.pdf
    if not ruta.exists():
        raise HTTPException(410, "El archivo ya no está disponible")
    e = db.get(Empresa, r.empresa_id)
    nombre = f"{r.nombre or 'Reporte'}_{e.rut if e else ''}_{r.creado:%Y%m%d}.pdf".replace(" ", "_")
    return FileResponse(ruta, media_type="application/pdf", filename=nombre)


@router.delete("/reportes/{reporte_id}", status_code=204)
def borrar_reporte(reporte_id: str, db: DB, u: UsuarioActual):
    r = db.get(ReporteGenerado, uuid.UUID(reporte_id))
    if not r or r.usuario_id != u.id:
        raise HTTPException(404, "Reporte no encontrado")
    if r.pdf:
        try:
            (config().datos_dir / r.pdf).unlink(missing_ok=True)
        except Exception:
            pass
    db.delete(r)


# ---------------------------------------------------------------- gestión F29 ND

@router.get("/empresas/{empresa_id}/f29/gestion")
def f29_gestion(empresa_id: str, db: DB, u: UsuarioActual):
    """Períodos ND/observados con su seguimiento (monto, multa, prioridad...)."""
    e = _empresa(db, u, empresa_id)
    estados = db.execute(select(F29Estado).where(
        F29Estado.empresa_id == e.id,
        F29Estado.estado.in_(("no_declarado", "observado")))
        .order_by(F29Estado.periodo)).scalars().all()
    gestiones = {g.periodo: g for g in db.execute(
        select(F29Gestion).where(F29Gestion.empresa_id == e.id)).scalars()}
    out = []
    for f in estados:
        g = gestiones.get(f.periodo)
        out.append({
            "periodo": f.periodo, "estado_sii": f.estado,
            "monto": g.monto if g else None,
            "monto_multa": g.monto_multa if g else None,
            "fuente_multa": g.fuente_multa if g else None,
            "estado": g.estado if g else "Abierta",
            "prioridad": g.prioridad if g else "Alta",
            "accion": g.accion if g else "Calcular y Declarar",
            "fecha_compromiso": g.fecha_compromiso if g else None,
            "fecha_cierre": g.fecha_cierre if g else None,
            "comentario": g.comentario if g else "",
        })
    return out


@router.put("/empresas/{empresa_id}/f29/gestion/{periodo}")
def f29_gestion_editar(empresa_id: str, periodo: str, datos: F29GestionIn,
                       db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    g = db.execute(select(F29Gestion).where(F29Gestion.empresa_id == e.id,
                                            F29Gestion.periodo == periodo)).scalar_one_or_none()
    if g is None:
        g = F29Gestion(empresa_id=e.id, periodo=periodo)
        db.add(g)
    if datos.monto_multa is not None and datos.monto_multa != g.monto_multa:
        g.fuente_multa = "manual"
    g.monto = datos.monto
    g.monto_multa = datos.monto_multa
    g.estado = datos.estado
    g.prioridad = datos.prioridad
    g.accion = datos.accion
    g.fecha_compromiso = datos.fecha_compromiso
    g.fecha_cierre = datos.fecha_cierre
    g.comentario = datos.comentario
    g.actualizado = datetime.now(timezone.utc)
    db.flush()
    return {"ok": True}
