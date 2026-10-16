"""Configuración leída del entorno (.env vía docker compose)."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


class Config:
    def __init__(self) -> None:
        self.database_url = os.environ["DATABASE_URL"]
        self.redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        self.secret_key = os.environ.get("SECRET_KEY", "dev-inseguro-cambiar")
        self.credenciales_key = os.environ.get("CREDENCIALES_KEY", "")
        self.sesion_minutos = int(os.environ.get("SESION_MINUTOS", "720"))
        self.datos_dir = Path(os.environ.get("DATOS_DIR", "./datos"))
        self.sii_pausa = float(os.environ.get("SII_PAUSA", "0.5"))
        self.rut_lock_segundos = int(os.environ.get("RUT_LOCK_SEGUNDOS", "600"))
        self.smtp_host = os.environ.get("SMTP_HOST", "")
        self.smtp_port = int(os.environ.get("SMTP_PORT", "587") or 587)
        self.smtp_user = os.environ.get("SMTP_USER", "")
        self.smtp_password = os.environ.get("SMTP_PASSWORD", "")
        self.smtp_from = os.environ.get("SMTP_FROM", "alertas@asiistente.cl")
        self.entorno = os.environ.get("ENTORNO", "local")
        # URL pública del sitio (para enlaces en correos)
        dominio = os.environ.get("DOMINIO", "")
        self.url_web = os.environ.get("URL_WEB") or (
            f"https://{dominio}" if dominio and self.entorno == "produccion"
            else "http://localhost:3000")
        # correos que parten como administradores (separados por coma)
        self.admin_emails = [e.strip().lower() for e in
                             os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()]

    @property
    def es_produccion(self) -> bool:
        return self.entorno == "produccion"


@lru_cache
def config() -> Config:
    return Config()
