"""Panel de administración: usuarios, planes, estado del sistema, prueba de correo.

Solo para usuarios con `es_admin`. Los primeros administradores se definen con
ADMIN_EMAILS en el .env (se aplica al arrancar la API y al registrarse).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select

from comun.correo import correo_prueba, enviar, smtp_configurado
from comun.modelos import Alerta, Empresa, Trabajo, Usuario
from comun.planes import PLANES

from ..deps import DB, UsuarioActual
from ..esquemas import AdminUsuarioIn, AdminUsuarioOut, CorreoPruebaIn

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _admin(u: UsuarioActual) -> Usuario:
    if not u.es_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo administradores")
    return u


Admin = Annotated[Usuario, Depends(_admin)]


def _out(db, u: Usuario) -> AdminUsuarioOut:
    emps = db.execute(select(Empresa).where(Empresa.usuario_id == u.id)).scalars().all()
    ultima = db.execute(select(func.max(Trabajo.creado)).where(Trabajo.usuario_id == u.id)).scalar()
    return AdminUsuarioOut(id=str(u.id), email=u.email, nombre=u.nombre, plan=u.plan,
                           activo=u.activo, es_admin=bool(u.es_admin), creado=u.creado,
                           n_empresas=len(emps), ruts=[e.rut for e in emps],
                           ultima_consulta=ultima)


@router.get("/resumen")
def resumen(db: DB, _: Admin):
    usuarios = db.execute(select(Usuario.plan, func.count()).group_by(Usuario.plan)).all()
    n_emp = db.execute(select(func.count()).select_from(Empresa)).scalar() or 0
    invalidas = db.execute(select(func.count()).select_from(Empresa)
                           .where(Empresa.credencial_invalida.is_(True))).scalar() or 0
    trabajos = db.execute(select(Trabajo.estado, func.count())
                          .where(Trabajo.creado >= datetime.now(timezone.utc) - timedelta(days=1))
                          .group_by(Trabajo.estado)).all()
    pendientes = db.execute(select(func.count()).select_from(Alerta)
                            .where(Alerta.enviada_correo.is_(False))).scalar() or 0
    mrr = sum(PLANES[p].precio_clp * n for p, n in usuarios if p in PLANES)
    return {"usuarios_por_plan": {p: n for p, n in usuarios},
            "usuarios": sum(n for _, n in usuarios), "empresas": n_emp,
            "credenciales_invalidas": invalidas,
            "trabajos_24h": {e: n for e, n in trabajos},
            "alertas_sin_enviar": pendientes, "smtp": smtp_configurado(), "mrr_clp": mrr}


@router.get("/usuarios", response_model=list[AdminUsuarioOut])
def usuarios(db: DB, _: Admin):
    filas = db.execute(select(Usuario).order_by(Usuario.creado.desc())).scalars().all()
    return [_out(db, u) for u in filas]


@router.put("/usuarios/{usuario_id}", response_model=AdminUsuarioOut)
def editar_usuario(usuario_id: str, datos: AdminUsuarioIn, db: DB, admin: Admin):
    try:
        u = db.get(Usuario, uuid.UUID(usuario_id))
    except ValueError:
        u = None
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if datos.plan is not None:
        if datos.plan not in PLANES:
            raise HTTPException(400, f"Plan inválido; opciones: {list(PLANES)}")
        u.plan = datos.plan
    if datos.activo is not None:
        if u.id == admin.id and not datos.activo:
            raise HTTPException(400, "No puedes desactivar tu propia cuenta")
        u.activo = datos.activo
    if datos.es_admin is not None:
        if u.id == admin.id and not datos.es_admin:
            raise HTTPException(400, "No puedes quitarte el rol de administrador")
        u.es_admin = datos.es_admin
    return _out(db, u)


@router.post("/correo-prueba")
def correo_de_prueba(datos: CorreoPruebaIn, _: Admin):
    if not smtp_configurado():
        raise HTTPException(400, "SMTP no configurado: revisa SMTP_HOST / SMTP_FROM en el .env")
    asunto, html = correo_prueba()
    if not enviar(datos.para, asunto, html):
        raise HTTPException(502, "El servidor SMTP rechazó el envío; mira los logs de la API")
    return {"ok": True, "enviado_a": datos.para}
