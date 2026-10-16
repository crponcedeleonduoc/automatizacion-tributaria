"""Cifrado de claves tributarias en reposo.

Sustituye a la Boveda local del proyecto original. Cada clave se cifra con
Fernet (AES-128-CBC + HMAC) usando CREDENCIALES_KEY del entorno. La clave de
la aplicación nunca se guarda en la base de datos; si se pierde, las
credenciales quedan irrecuperables (por diseño).

Para rotar la clave: descifrar con la vieja, cifrar con la nueva, en un solo
script de migración. MultiFernet permite hacerlo sin cortar el servicio.
"""

from __future__ import annotations

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from .config import config


class ErrorCifrado(RuntimeError):
    pass


def _fernet() -> MultiFernet:
    raw = config().credenciales_key.strip()
    if not raw or raw.startswith("GENERA"):
        raise ErrorCifrado(
            "CREDENCIALES_KEY no está configurada en .env. Genera una con: "
            "python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"")
    # Se aceptan varias claves separadas por coma: la primera cifra, todas
    # descifran. Así se rota sin downtime.
    claves = [Fernet(k.strip().encode()) for k in raw.split(",") if k.strip()]
    return MultiFernet(claves)


def cifrar(texto: str) -> str:
    return _fernet().encrypt(texto.encode("utf-8")).decode("ascii")


def descifrar(blob: str) -> str:
    try:
        return _fernet().decrypt(blob.encode("ascii")).decode("utf-8")
    except InvalidToken as e:
        raise ErrorCifrado("No se pudo descifrar la credencial: la clave de "
                           "la aplicación cambió o el dato está corrupto.") from e
