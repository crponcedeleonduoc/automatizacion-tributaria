"""Dependencias de FastAPI: sesión de BD, usuario actual, JWT."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from comun.config import config
from comun.modelos import Usuario, sesion_factory

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)
ALGORITMO = "HS256"


def get_db():
    s = sesion_factory()()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()


DB = Annotated[Session, Depends(get_db)]


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verificar_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def crear_token(usuario: Usuario) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=config().sesion_minutos)
    return jwt.encode({"sub": str(usuario.id), "exp": exp},
                      config().secret_key, algorithm=ALGORITMO)


def usuario_actual(db: DB, token: Annotated[str | None, Depends(oauth2)]) -> Usuario:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No autenticado")
    try:
        datos = jwt.decode(token, config().secret_key, algorithms=[ALGORITMO])
        uid = uuid.UUID(datos["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sesión inválida o expirada")
    u = db.get(Usuario, uid)
    if not u or not u.activo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario inactivo")
    return u


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]
