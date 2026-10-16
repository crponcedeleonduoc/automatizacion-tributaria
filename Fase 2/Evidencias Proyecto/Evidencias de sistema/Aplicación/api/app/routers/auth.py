from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy import select

from comun.config import config
from comun.correo import correo_bienvenida, correo_restablecer, enviar
from comun.modelos import Usuario

from ..deps import (ALGORITMO, DB, UsuarioActual, crear_token, hash_password,
                    verificar_password)
from ..esquemas import (CambioPasswordIn, PerfilIn, RecuperarIn, RegistroIn,
                        RestablecerIn, TokenOut, UsuarioOut)

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("auth")


def _out(u: Usuario) -> UsuarioOut:
    return UsuarioOut(id=str(u.id), email=u.email, nombre=u.nombre,
                      plan=u.plan, creado=u.creado, es_admin=bool(u.es_admin),
                      recibir_correos=bool(u.recibir_correos))


@router.post("/registro", response_model=TokenOut, status_code=201)
def registro(datos: RegistroIn, db: DB, tareas: BackgroundTasks):
    email = datos.email.lower().strip()
    if db.execute(select(Usuario).where(Usuario.email == email)).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese correo ya tiene cuenta")
    u = Usuario(email=email, password_hash=hash_password(datos.password),
                nombre=datos.nombre.strip(), plan="gratis",
                acepto_terminos=True, es_admin=email in config().admin_emails)
    db.add(u)
    db.commit()
    asunto, html = correo_bienvenida(u.nombre)
    tareas.add_task(enviar, email, asunto, html)
    return TokenOut(access_token=crear_token(u))


@router.post("/login", response_model=TokenOut)
def login(db: DB, form: OAuth2PasswordRequestForm = Depends()):
    email = form.username.lower().strip()
    u = db.execute(select(Usuario).where(Usuario.email == email)).scalar_one_or_none()
    if not u or not verificar_password(form.password, u.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos")
    if not u.activo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cuenta desactivada")
    return TokenOut(access_token=crear_token(u))


@router.get("/yo", response_model=UsuarioOut)
def yo(u: UsuarioActual):
    return _out(u)


@router.put("/yo", response_model=UsuarioOut)
def editar_perfil(datos: PerfilIn, u: UsuarioActual):
    u.nombre = datos.nombre.strip()
    u.recibir_correos = datos.recibir_correos
    return _out(u)


@router.put("/yo/password", status_code=204)
def cambiar_password(datos: CambioPasswordIn, u: UsuarioActual):
    if not verificar_password(datos.actual, u.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña actual no coincide")
    u.password_hash = hash_password(datos.nueva)


# ---------------------------------------------------------------------------
# Recuperación de contraseña: token JWT de 1 hora, de un solo uso (lleva una
# huella del hash actual: al cambiar la contraseña el token deja de servir).
# ---------------------------------------------------------------------------

def _token_reset(u: Usuario) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=1)
    return jwt.encode({"sub": str(u.id), "fin": "reset", "exp": exp,
                       "huella": u.password_hash[-16:]},
                      config().secret_key, algorithm=ALGORITMO)


@router.post("/recuperar", status_code=202)
def recuperar(datos: RecuperarIn, db: DB, tareas: BackgroundTasks):
    """Siempre responde 202 (no revela si el correo existe)."""
    email = datos.email.lower().strip()
    u = db.execute(select(Usuario).where(Usuario.email == email)).scalar_one_or_none()
    if u and u.activo:
        url = f"{config().url_web}/restablecer?token={_token_reset(u)}"
        asunto, html = correo_restablecer(url)
        tareas.add_task(enviar, email, asunto, html)
    else:
        log.info("recuperación pedida para correo inexistente: %s", email)
    return {"ok": True, "mensaje": "Si el correo existe, te enviamos un enlace para restablecer la contraseña."}


@router.post("/restablecer", response_model=TokenOut)
def restablecer(datos: RestablecerIn, db: DB):
    d: dict = {}
    try:
        d = jwt.decode(datos.token, config().secret_key, algorithms=[ALGORITMO])
        if d.get("fin") != "reset":
            raise JWTError("fin")
        u = db.get(Usuario, uuid.UUID(d["sub"]))
    except (JWTError, KeyError, ValueError):
        u = None
    if not u or not u.activo or u.password_hash[-16:] != d.get("huella"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "El enlace no es válido o ya venció. Pide uno nuevo.")
    u.password_hash = hash_password(datos.password)
    return TokenOut(access_token=crear_token(u))
