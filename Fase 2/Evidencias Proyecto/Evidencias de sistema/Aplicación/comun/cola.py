"""Cola de trabajos (Redis + RQ) y candado "una sesión por RUT".

El SII limita las sesiones concurrentes por RUT (error 01.01.113.500.720.27)
y no las libera al cerrar el proceso. Si dos workers consultan el mismo RUT
a la vez, se bloquea la cuenta 20-30 minutos. El candado garantiza que en
todo el sistema haya como máximo una sesión abierta por RUT.
"""

from __future__ import annotations

import contextlib
import re
import time

from redis import Redis
from rq import Queue

from .config import config

COLA_HTTP = "sii-http"          # RCV: rápido, sin navegador
COLA_NAVEGADOR = "sii-navegador"  # TGR y F29: Playwright, lento y pesado

_redis: Redis | None = None


def redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(config().redis_url)
    return _redis


def cola(nombre: str = COLA_HTTP) -> Queue:
    return Queue(nombre, connection=redis(), default_timeout=15 * 60)


def job_vivo(job_id: str) -> bool:
    """¿El job sigue en cola o corriendo en RQ? Si falló, terminó o no existe,
    el Trabajo en Postgres puede quedar 'pendiente' huérfano y hay que
    volver a encolar en vez de reutilizarlo."""
    from rq.job import Job
    try:
        j = Job.fetch(job_id, connection=redis())
    except Exception:
        return False
    return j.get_status(refresh=False) in ("queued", "started", "deferred", "scheduled")


def rut_normalizado(rut: str) -> str:
    return re.sub(r"[^0-9kK]", "", rut or "").upper()


class RutOcupado(RuntimeError):
    pass


@contextlib.contextmanager
def candado_rut(rut: str, espera_max: int = 120):
    """Bloquea el RUT mientras dura la sesión con el SII.

    Espera hasta `espera_max` segundos a que se libere; si no, lanza
    RutOcupado y el trabajo se reprograma en vez de abrir una segunda sesión.
    """
    r = redis()
    clave = f"lock:rut:{rut_normalizado(rut)}"
    ttl = config().rut_lock_segundos
    inicio = time.monotonic()
    while True:
        if r.set(clave, "1", nx=True, ex=ttl):
            break
        if time.monotonic() - inicio > espera_max:
            raise RutOcupado(f"El RUT {rut} ya tiene una sesión activa en otro "
                             "trabajo; se reintentará más tarde.")
        time.sleep(2)
    try:
        yield
    finally:
        try:
            r.delete(clave)
        except Exception:
            pass
