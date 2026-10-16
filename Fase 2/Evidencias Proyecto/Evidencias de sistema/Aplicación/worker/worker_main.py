"""Proceso worker: consume las colas de Redis y ejecuta las tareas.

Un mismo contenedor atiende ambas colas, con prioridad a la HTTP (RCV) para
que la demo y las sincronizaciones rápidas no esperen detrás de un TGR de
dos minutos. Escalar = levantar más réplicas: docker compose up --scale worker=3
"""

from __future__ import annotations

import logging
import os
import sys

from rq import Worker

from comun.cola import COLA_HTTP, COLA_NAVEGADOR, redis
from comun.modelos import crear_tablas

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("worker")


def main() -> None:
    crear_tablas()
    colas = os.environ.get("COLAS", f"{COLA_HTTP},{COLA_NAVEGADOR}").split(",")
    log.info("worker escuchando colas %s", colas)
    w = Worker(colas, connection=redis())
    w.work(with_scheduler=False, logging_level="INFO")


if __name__ == "__main__":
    sys.exit(main())
