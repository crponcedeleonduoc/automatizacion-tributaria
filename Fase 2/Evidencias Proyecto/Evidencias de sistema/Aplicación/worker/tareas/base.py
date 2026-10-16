"""Utilidades comunes a las tareas: estado del trabajo, log, archivos, alertas."""

from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from comun.cifrado import descifrar
from comun.config import config
from comun.modelos import (Alerta, ConsultaLog, Empresa, Trabajo,
                           sesion_factory)


def ahora() -> datetime:
    return datetime.now(timezone.utc)


@contextmanager
def db():
    s = sesion_factory()()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()


def ruta_datos(*partes: str) -> Path:
    base = config().datos_dir
    p = base.joinpath(*partes)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def relativa(p: Path) -> str:
    return str(p.relative_to(config().datos_dir))


def credencial(empresa: Empresa) -> tuple[str, str]:
    return empresa.rut, descifrar(empresa.clave_cifrada)


class EjecucionTrabajo:
    """Marca inicio/fin del Trabajo y escribe el log de consultas."""

    def __init__(self, trabajo_id: str | uuid.UUID | None, tipo: str,
                 rut: str, empresa_id=None):
        self.trabajo_id = uuid.UUID(str(trabajo_id)) if trabajo_id else None
        self.tipo = tipo
        self.rut = rut
        self.empresa_id = empresa_id
        self.t0 = time.monotonic()

    def __enter__(self):
        if self.trabajo_id:
            with db() as s:
                t = s.get(Trabajo, self.trabajo_id)
                if t:
                    t.estado = "corriendo"
                    t.iniciado = ahora()
        return self

    def terminar(self, resultado: dict | None = None, archivo: str | None = None):
        dur = int((time.monotonic() - self.t0) * 1000)
        with db() as s:
            if self.trabajo_id:
                t = s.get(Trabajo, self.trabajo_id)
                if t:
                    t.estado = "ok"
                    t.terminado = ahora()
                    t.resultado = resultado or {}
                    t.archivo = archivo
            s.add(ConsultaLog(empresa_id=self.empresa_id, rut=self.rut,
                              tipo=self.tipo, ok=True, duracion_ms=dur,
                              mensaje=(resultado or {}).get("resumen", "")))

    def fallar(self, error: str, credencial_invalida: bool = False):
        dur = int((time.monotonic() - self.t0) * 1000)
        with db() as s:
            if self.trabajo_id:
                t = s.get(Trabajo, self.trabajo_id)
                if t:
                    t.estado = "error"
                    t.terminado = ahora()
                    t.error = error[:2000]
            if self.empresa_id:
                e = s.get(Empresa, self.empresa_id)
                if e:
                    e.ultimo_error = error[:2000]
                    e.ultimo_error_en = ahora()
                    if credencial_invalida:
                        e.credencial_invalida = True
            s.add(ConsultaLog(empresa_id=self.empresa_id, rut=self.rut,
                              tipo=self.tipo, ok=False, duracion_ms=dur,
                              mensaje=error[:2000]))

    def __exit__(self, exc_type, exc, tb):
        return False


def crear_alerta(s, empresa_id, tipo: str, titulo: str, detalle: dict | None = None):
    s.add(Alerta(empresa_id=empresa_id, tipo=tipo, titulo=titulo,
                 detalle=detalle or {}))
