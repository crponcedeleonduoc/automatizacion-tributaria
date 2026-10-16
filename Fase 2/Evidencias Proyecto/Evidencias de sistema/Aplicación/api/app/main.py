"""aSIIstente — API."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import select

from comun.config import config
from comun.modelos import Usuario, crear_tablas, sesion_factory

from .routers import admin, auth, demo, empresas, reportes, trabajos

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    crear_tablas()
    _marcar_admins()
    yield


def _marcar_admins() -> None:
    """Los correos de ADMIN_EMAILS quedan como administradores al arrancar."""
    emails = config().admin_emails
    if not emails:
        return
    S = sesion_factory()
    with S() as s:
        for u in s.execute(select(Usuario).where(Usuario.email.in_(emails))).scalars():
            u.es_admin = True
        s.commit()


app = FastAPI(
    title="aSIIstente API",
    version="0.1.0",
    description="Automatización de información tributaria del SII y la TGR. "
                "Servicio privado independiente, sin afiliación con el SII ni la TGR.",
    lifespan=lifespan,
)

origenes = [o.strip() for o in os.environ.get(
    "CORS_ORIGENES", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
dominio = os.environ.get("DOMINIO")
if dominio:
    origenes += [f"https://{dominio}", f"https://www.{dominio}"]

app.add_middleware(CORSMiddleware, allow_origins=origenes, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(empresas.router)
app.include_router(demo.router)
app.include_router(trabajos.router)
app.include_router(reportes.router)
app.include_router(admin.router)


@app.get("/api/salud", tags=["sistema"])
def salud():
    return {"ok": True, "servicio": "asiistente-api"}
