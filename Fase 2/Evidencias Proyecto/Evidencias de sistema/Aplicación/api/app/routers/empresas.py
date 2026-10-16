"""Empresas (RUT monitoreados), sus documentos, alertas y actividad."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from comun.cifrado import cifrar
from comun.cola import COLA_HTTP, COLA_NAVEGADOR, cola, job_vivo
from comun.config import config
from comun.modelos import (Alerta, ConsultaLog, Empresa, F29Estado,
                           RcvDescarga, RcvDocumento, TgrCertificado, Trabajo,
                           Usuario)
from comun.planes import FRECUENCIAS_RCV, frecuencia_rcv, plan

from ..deps import DB, UsuarioActual
from ..esquemas import (EmpresaClaveIn, EmpresaIn, EmpresaOut, HistoricoIn,
                        ProgramacionIn, TrabajoOut)

router = APIRouter(prefix="/api/empresas", tags=["empresas"])

TAREAS = {
    "rcv": ("tareas.rcv.sincronizar_rcv", COLA_HTTP, 10 * 60),
    "tgr": ("tareas.tgr.sincronizar_tgr", COLA_NAVEGADOR, 15 * 60),
    "f29": ("tareas.f29.sincronizar_f29", COLA_NAVEGADOR, 20 * 60),
}


def _empresa(db, u, empresa_id: str) -> Empresa:
    try:
        eid = uuid.UUID(empresa_id)
    except ValueError:
        raise HTTPException(404, "Empresa no encontrada")
    e = db.get(Empresa, eid)
    if not e or e.usuario_id != u.id:
        raise HTTPException(404, "Empresa no encontrada")
    return e


def _out(db, e: Empresa) -> EmpresaOut:
    hoy = date.today()
    per = f"{hoy.year}{hoy.month:02d}"
    docs = db.execute(select(func.count()).select_from(RcvDocumento).where(
        RcvDocumento.empresa_id == e.id, RcvDocumento.periodo == per)).scalar() or 0
    tgr = db.execute(select(TgrCertificado.total_morosa)
                     .where(TgrCertificado.empresa_id == e.id)
                     .order_by(TgrCertificado.creado.desc()).limit(1)).scalar()
    alertas = db.execute(select(func.count()).select_from(Alerta).where(
        Alerta.empresa_id == e.id, Alerta.leida.is_(False))).scalar() or 0
    usr = e.usuario or db.get(Usuario, e.usuario_id)
    codigo_plan = usr.plan if usr else "gratis"
    return EmpresaOut(
        id=str(e.id), rut=e.rut, razon_social=e.razon_social, activa=e.activa,
        creado=e.creado, ultima_rcv=e.ultima_rcv, ultima_tgr=e.ultima_tgr,
        ultima_f29=e.ultima_f29, ultimo_error=e.ultimo_error,
        credencial_invalida=e.credencial_invalida, deuda_tgr=tgr,
        frecuencia_rcv_min=frecuencia_rcv(codigo_plan, e.frecuencia_rcv_min),
        frecuencia_minima_plan=plan(codigo_plan).frecuencia_minutos,
        solo_horario_habil=bool(e.solo_horario_habil), auto_tgr_f29=bool(e.auto_tgr_f29),
        docs_mes=docs, alertas_sin_leer=alertas)


def _encolar(db, u, e: Empresa, tipo: str) -> Trabajo:
    func_, nombre_cola, timeout = TAREAS[tipo]
    pendiente = db.execute(select(Trabajo).where(
        Trabajo.empresa_id == e.id, Trabajo.tipo == tipo,
        Trabajo.estado.in_(("pendiente", "corriendo")))).scalar_one_or_none()
    if pendiente:
        if job_vivo(str(pendiente.id)):
            return pendiente
        # huérfano: el job de RQ murió sin marcar el Trabajo
        pendiente.estado = "error"
        pendiente.error = "El trabajo se perdió en la cola; se volvió a encolar."
        pendiente.terminado = datetime.now(timezone.utc)
    t = Trabajo(tipo=tipo, empresa_id=e.id, usuario_id=u.id, rut=e.rut,
                parametros={"origen": "manual"})
    db.add(t)
    db.flush()
    cola(nombre_cola).enqueue(func_, str(e.id), str(t.id),
                              job_id=str(t.id), job_timeout=timeout)
    return t


@router.get("", response_model=list[EmpresaOut])
def listar(db: DB, u: UsuarioActual):
    filas = db.execute(select(Empresa).where(Empresa.usuario_id == u.id)
                       .order_by(Empresa.creado)).scalars().all()
    return [_out(db, e) for e in filas]


@router.post("", response_model=EmpresaOut, status_code=201)
def crear(datos: EmpresaIn, db: DB, u: UsuarioActual):
    p = plan(u.plan)
    n = db.execute(select(func.count()).select_from(Empresa)
                   .where(Empresa.usuario_id == u.id)).scalar() or 0
    if n >= p.max_ruts:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED,
                            f"Tu plan {p.nombre} permite {p.max_ruts} RUT. "
                            "Cambia de plan para agregar más.")
    if db.execute(select(Empresa).where(Empresa.usuario_id == u.id,
                                        Empresa.rut == datos.rut)).scalar_one_or_none():
        raise HTTPException(409, "Ese RUT ya está registrado en tu cuenta")
    e = Empresa(usuario_id=u.id, rut=datos.rut, razon_social=datos.razon_social,
                clave_cifrada=cifrar(datos.clave))
    db.add(e)
    db.flush()
    # primera sincronización inmediata del RCV para que el panel no quede vacío
    _encolar(db, u, e, "rcv")
    return _out(db, e)


@router.get("/{empresa_id}", response_model=EmpresaOut)
def detalle(empresa_id: str, db: DB, u: UsuarioActual):
    return _out(db, _empresa(db, u, empresa_id))


@router.put("/{empresa_id}/clave", response_model=EmpresaOut)
def cambiar_clave(empresa_id: str, datos: EmpresaClaveIn, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    e.clave_cifrada = cifrar(datos.clave)
    e.credencial_invalida = False
    e.ultimo_error = None
    _encolar(db, u, e, "rcv")
    return _out(db, e)


@router.put("/{empresa_id}/programacion", response_model=EmpresaOut)
def programar(empresa_id: str, datos: ProgramacionIn, db: DB, u: UsuarioActual):
    """El usuario elige cada cuánto se consulta el RCV, dentro de lo que
    permite su plan, si sólo en horario hábil, y si TGR/F29 corren solos."""
    e = _empresa(db, u, empresa_id)
    p = plan(u.plan)
    if datos.frecuencia_rcv_min not in FRECUENCIAS_RCV:
        raise HTTPException(400, f"Frecuencia inválida; opciones: {list(FRECUENCIAS_RCV)}")
    if datos.frecuencia_rcv_min < p.frecuencia_minutos:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED,
                            f"Tu plan {p.nombre} permite como mínimo cada {p.frecuencia_minutos} minutos")
    e.frecuencia_rcv_min = datos.frecuencia_rcv_min
    e.solo_horario_habil = datos.solo_horario_habil
    e.auto_tgr_f29 = datos.auto_tgr_f29 and ("tgr" in p.documentos)
    return _out(db, e)


@router.delete("/{empresa_id}", status_code=204)
def eliminar(empresa_id: str, db: DB, u: UsuarioActual):
    """Borra la empresa, sus credenciales y todos sus datos (derecho de supresión)."""
    e = _empresa(db, u, empresa_id)
    db.delete(e)


@router.post("/{empresa_id}/sincronizar/{tipo}", response_model=TrabajoOut)
def sincronizar(empresa_id: str, tipo: str, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    if tipo not in TAREAS:
        raise HTTPException(400, "Tipo debe ser rcv, tgr o f29")
    if tipo not in plan(u.plan).documentos:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED,
                            f"El documento {tipo.upper()} no está en tu plan")
    if e.credencial_invalida:
        raise HTTPException(400, "La clave tributaria fue rechazada; actualízala primero")
    t = _encolar(db, u, e, tipo)
    return _trabajo_out(t)


def _trabajo_out(t: Trabajo) -> TrabajoOut:
    return TrabajoOut(id=str(t.id), tipo=t.tipo, estado=t.estado, rut=t.rut,
                      resultado=t.resultado or {}, error=t.error, creado=t.creado,
                      terminado=t.terminado, tiene_archivo=bool(t.archivo),
                      origen=(t.parametros or {}).get("origen", "manual"),
                      parametros=t.parametros or {})


@router.get("/{empresa_id}/rcv")
def rcv(empresa_id: str, db: DB, u: UsuarioActual,
        periodo: str | None = Query(default=None, pattern=r"^\d{6}$"),
        operacion: str | None = Query(default=None, pattern=r"^(COMPRA|VENTA)$"),
        limite: int = Query(default=200, le=2000)):
    e = _empresa(db, u, empresa_id)
    q = select(RcvDocumento).where(RcvDocumento.empresa_id == e.id)
    if periodo:
        q = q.where(RcvDocumento.periodo == periodo)
    if operacion:
        q = q.where(RcvDocumento.operacion == operacion)
    q = q.order_by(RcvDocumento.periodo.desc(), RcvDocumento.fecha_emision.desc()).limit(limite)
    filas = db.execute(q).scalars().all()
    return [{
        "id": d.id, "periodo": d.periodo, "operacion": d.operacion,
        "estado": d.estado_contab, "tipo_doc": d.tipo_doc, "folio": d.folio,
        "rut": d.rut_contraparte, "razon_social": d.razon_social,
        "fecha_emision": d.fecha_emision, "fecha_acuse": d.fecha_acuse,
        "neto": d.monto_neto, "iva": d.monto_iva, "total": d.monto_total,
        "visto_primera_vez": d.visto_primera_vez,
    } for d in filas]


@router.get("/{empresa_id}/rcv/resumen")
def rcv_resumen(empresa_id: str, db: DB, u: UsuarioActual):
    """Totales por período y operación (para gráficos del panel)."""
    e = _empresa(db, u, empresa_id)
    filas = db.execute(
        select(RcvDocumento.periodo, RcvDocumento.operacion, RcvDocumento.estado_contab,
               func.count(), func.sum(RcvDocumento.monto_neto),
               func.sum(RcvDocumento.monto_iva), func.sum(RcvDocumento.monto_total))
        .where(RcvDocumento.empresa_id == e.id)
        .group_by(RcvDocumento.periodo, RcvDocumento.operacion, RcvDocumento.estado_contab)
        .order_by(RcvDocumento.periodo.desc())).all()
    return [{"periodo": p, "operacion": o, "estado": est, "docs": n,
             "neto": int(neto or 0), "iva": int(iva or 0), "total": int(tot or 0)}
            for p, o, est, n, neto, iva, tot in filas]


@router.get("/{empresa_id}/rcv/descargas")
def rcv_descargas(empresa_id: str, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    filas = db.execute(select(RcvDescarga).where(RcvDescarga.empresa_id == e.id)
                       .order_by(RcvDescarga.creado.desc()).limit(200)).scalars().all()
    return [{"id": d.id, "periodo": d.periodo, "operacion": d.operacion,
             "estado": d.estado_contab, "n_docs": d.n_docs, "creado": d.creado}
            for d in filas]


@router.get("/{empresa_id}/rcv/descargas/{descarga_id}/csv")
def rcv_csv(empresa_id: str, descarga_id: int, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    d = db.get(RcvDescarga, descarga_id)
    if not d or d.empresa_id != e.id:
        raise HTTPException(404, "Descarga no encontrada")
    ruta = config().datos_dir / d.archivo
    if not ruta.exists():
        raise HTTPException(410, "El archivo ya no está disponible")
    nombre = f"RCV_{d.operacion}_{d.estado_contab}_{e.rut}_{d.periodo}.csv"
    return FileResponse(ruta, media_type="text/csv", filename=nombre)


MAX_PERIODOS_HISTORICO = 120     # 10 años por descarga


@router.post("/{empresa_id}/rcv/historico", response_model=TrabajoOut, status_code=202)
def rcv_historico(empresa_id: str, datos: HistoricoIn, db: DB, u: UsuarioActual):
    """Descarga masiva: todos los RCV entre dos períodos, en un ZIP."""
    e = _empresa(db, u, empresa_id)
    p = plan(u.plan)
    if e.credencial_invalida:
        raise HTTPException(409, "La clave tributaria fue rechazada por el SII. Actualízala primero.")
    hoy = date.today()
    hasta = datos.hasta or f"{hoy.year}{hoy.month:02d}"
    desde = datos.desde
    if not (1 <= int(desde[4:]) <= 12 and 1 <= int(hasta[4:]) <= 12):
        raise HTTPException(400, "Período inválido (AAAAMM)")
    if desde > hasta:
        raise HTTPException(400, "El período inicial debe ser anterior al final")
    if hasta > f"{hoy.year}{hoy.month:02d}":
        raise HTTPException(400, "El período final no puede ser futuro")
    n = (int(hasta[:4]) - int(desde[:4])) * 12 + int(hasta[4:]) - int(desde[4:]) + 1
    if p.historial_meses and n > p.historial_meses:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED,
                            f"Tu plan {p.nombre} permite hasta {p.historial_meses} meses de historial")
    if n > MAX_PERIODOS_HISTORICO:
        raise HTTPException(400, f"Máximo {MAX_PERIODOS_HISTORICO} meses por descarga")
    ops = [o for o in datos.operaciones if o in ("COMPRA", "VENTA")] or ["COMPRA", "VENTA"]
    activo = db.execute(select(Trabajo).where(
        Trabajo.empresa_id == e.id, Trabajo.tipo == "rcv_historico",
        Trabajo.estado.in_(("pendiente", "corriendo")))).scalar_one_or_none()
    if activo and job_vivo(str(activo.id)):
        raise HTTPException(409, "Ya hay una descarga masiva en curso para este RUT")
    if activo:
        activo.estado = "error"
        activo.error = "El trabajo se perdió en la cola."
        activo.terminado = datetime.now(timezone.utc)
    t = Trabajo(tipo="rcv_historico", empresa_id=e.id, usuario_id=u.id, rut=e.rut,
                parametros={"origen": "manual", "desde": desde, "hasta": hasta,
                            "operaciones": ops},
                resultado={"progreso": 0, "total": n, "documentos": 0})
    db.add(t)
    db.flush()
    cola(COLA_HTTP).enqueue("tareas.rcv.descargar_historico", str(e.id), str(t.id),
                            desde, hasta, ops, job_id=str(t.id),
                            job_timeout=max(30 * 60, n * 90))
    return _trabajo_out(t)


@router.get("/{empresa_id}/rcv/historico", response_model=list[TrabajoOut])
def rcv_historicos(empresa_id: str, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    filas = db.execute(select(Trabajo).where(Trabajo.empresa_id == e.id,
                                             Trabajo.tipo == "rcv_historico")
                       .order_by(Trabajo.creado.desc()).limit(20)).scalars().all()
    return [_trabajo_out(t) for t in filas]


@router.get("/{empresa_id}/rcv/historico/{trabajo_id}/zip")
def rcv_historico_zip(empresa_id: str, trabajo_id: str, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    try:
        t = db.get(Trabajo, uuid.UUID(trabajo_id))
    except ValueError:
        t = None
    if not t or t.empresa_id != e.id or t.tipo != "rcv_historico" or not t.archivo:
        raise HTTPException(404, "Descarga no encontrada")
    ruta = config().datos_dir / t.archivo
    if not ruta.exists():
        raise HTTPException(410, "El archivo ya no está disponible")
    pr = t.parametros or {}
    nombre = f"RCV_{e.rut}_{pr.get('desde', '')}-{pr.get('hasta', '')}.zip"
    return FileResponse(ruta, media_type="application/zip", filename=nombre)


@router.get("/{empresa_id}/tgr")
def tgr(empresa_id: str, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    filas = db.execute(select(TgrCertificado).where(TgrCertificado.empresa_id == e.id)
                       .order_by(TgrCertificado.creado.desc()).limit(60)).scalars().all()
    return [{"id": c.id, "fecha_emision": c.fecha_emision, "total_morosa": c.total_morosa,
             "total_no_vencida": c.total_no_vencida, "n_giros": c.n_giros,
             "lineas": c.lineas, "creado": c.creado, "tiene_pdf": bool(c.pdf)}
            for c in filas]


@router.get("/{empresa_id}/tgr/{cert_id}/pdf")
def tgr_pdf(empresa_id: str, cert_id: int, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    c = db.get(TgrCertificado, cert_id)
    if not c or c.empresa_id != e.id or not c.pdf:
        raise HTTPException(404, "Certificado no encontrado")
    return FileResponse(config().datos_dir / c.pdf, media_type="application/pdf",
                        filename=f"TGR_{e.rut}_{c.fecha_emision or c.id}.pdf")


@router.get("/{empresa_id}/f29")
def f29(empresa_id: str, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    filas = db.execute(select(F29Estado).where(F29Estado.empresa_id == e.id)
                       .order_by(F29Estado.periodo.desc())).scalars().all()
    return [{"periodo": f.periodo, "estado": f.estado, "folio": f.folio,
             "tiene_pdf": bool(f.pdf), "actualizado": f.actualizado} for f in filas]


@router.get("/{empresa_id}/f29/{periodo}/pdf")
def f29_pdf(empresa_id: str, periodo: str, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    f = db.execute(select(F29Estado).where(F29Estado.empresa_id == e.id,
                                           F29Estado.periodo == periodo)).scalar_one_or_none()
    if not f or not f.pdf:
        raise HTTPException(404, "PDF no disponible")
    return FileResponse(config().datos_dir / f.pdf, media_type="application/pdf",
                        filename=f"F29_{e.rut}_{periodo}.pdf")


@router.get("/{empresa_id}/alertas")
def alertas(empresa_id: str, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    filas = db.execute(select(Alerta).where(Alerta.empresa_id == e.id)
                       .order_by(Alerta.creado.desc()).limit(100)).scalars().all()
    return [{"id": a.id, "tipo": a.tipo, "titulo": a.titulo, "detalle": a.detalle,
             "creado": a.creado, "leida": a.leida} for a in filas]


@router.post("/{empresa_id}/alertas/leidas", status_code=204)
def marcar_leidas(empresa_id: str, db: DB, u: UsuarioActual):
    e = _empresa(db, u, empresa_id)
    for a in db.execute(select(Alerta).where(Alerta.empresa_id == e.id,
                                             Alerta.leida.is_(False))).scalars():
        a.leida = True


@router.get("/{empresa_id}/actividad")
def actividad(empresa_id: str, db: DB, u: UsuarioActual):
    """Registro de cada consulta hecha con este RUT (transparencia)."""
    e = _empresa(db, u, empresa_id)
    filas = db.execute(select(ConsultaLog).where(ConsultaLog.empresa_id == e.id)
                       .order_by(ConsultaLog.creado.desc()).limit(200)).scalars().all()
    return [{"tipo": c.tipo, "ok": c.ok, "mensaje": c.mensaje,
             "duracion_ms": c.duracion_ms, "creado": c.creado} for c in filas]
