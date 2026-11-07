"""Configuración común de las pruebas.

Las pruebas cubren las funciones puras del sistema: las que no tocan la red,
la base de datos ni los portales del SII y la TGR. Son las que se pueden
verificar de forma determinista.

Dos preparaciones son necesarias antes de importar los módulos del proyecto:

1. Variables de entorno. `comun.config` las lee al importarse, y en pruebas no
   existe el .env que docker compose inyecta.
2. `curl_cffi`. El módulo `worker.sii_core.rcv` importa `auth`, que depende de
   esa biblioteca solo para hablar con el SII. Como aquí no se hace ninguna
   petición, se sustituye por un doble cuando no está instalada, y así el
   parser se puede probar sin levantar el entorno completo.
"""
from __future__ import annotations

import os
import sys
import types
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
if str(RAIZ) not in sys.path:
    sys.path.insert(0, str(RAIZ))

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost/test")
os.environ.setdefault("DATOS_DIR", "./datos_prueba")

try:
    import curl_cffi  # noqa: F401
except ModuleNotFoundError:
    falso = types.ModuleType("curl_cffi")
    peticiones = types.ModuleType("curl_cffi.requests")

    class _Session:                      # doble: nunca se usa en las pruebas
        def __init__(self, *a, **k):
            raise RuntimeError("Las pruebas no deben abrir sesiones contra el SII.")

    peticiones.Session = _Session
    falso.requests = peticiones
    sys.modules["curl_cffi"] = falso
    sys.modules["curl_cffi.requests"] = peticiones
