"""Demo pública: descarga tu RCV con un clic, sin crear cuenta.

La clave viaja sólo hasta Redis (cola en memoria, argumentos del job) y se
descarta al terminar. Nunca se escribe en Postgres ni en logs. Límite por IP
para evitar que alguien use la demo como API gratis o para probar claves.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse

from comun.cola import COLA_HTTP, cola, redis
from comun.config import config
from comun.modelos import Trabajo

from ..deps import DB
from ..esquemas import DemoIn, TrabajoOut

router = APIRouter(prefix="/api/demo", tags=["demo"])

LIMITE_POR_IP = 5          # demos por hora por IP
LIMITE_POR_RUT = 3         # demos por hora por RUT (protege contra prueba de claves)


def _limitar(clave: str, maximo: int) -> None:
    r = redis()
    n = r.incr(clave)
    if n == 1:
        r.expire(clave, 3600)
    if n > maximo:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            "Demasiados intentos. Crea una cuenta gratis para "
                            "seguir usando aSIIstente.")


def _ip(req: Request) -> str:
    return (req.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (req.client.host if req.client else "?"))


def _out(t: Trabajo) -> TrabajoOut:
    return TrabajoOut(id=str(t.id), tipo=t.tipo, estado=t.estado, rut=t.rut,
                      resultado=t.resultado, error=t.error, creado=t.creado,
                      terminado=t.terminado, tiene_archivo=bool(t.archivo))


@router.post("/rcv", response_model=TrabajoOut, status_code=202)
def demo_rcv(datos: DemoIn, req: Request, db: DB):
    ip = _ip(req)
    _limitar(f"demo:ip:{ip}", LIMITE_POR_IP)
    _limitar(f"demo:rut:{datos.rut}", LIMITE_POR_RUT)
    t = Trabajo(tipo="demo_rcv", rut=datos.rut, ip_origen=ip,
                parametros={"periodo": datos.periodo, "operacion": datos.operacion})
    db.add(t)
    db.flush()
    cola(COLA_HTTP).enqueue("tareas.rcv.demo_rcv", str(t.id), datos.rut, datos.clave,
                            datos.periodo, datos.operacion,
                            job_id=str(t.id), job_timeout=5 * 60, result_ttl=600)
    return _out(t)


@router.get("/rcv/{trabajo_id}", response_model=TrabajoOut)
def estado(trabajo_id: str, db: DB):
    try:
        t = db.get(Trabajo, uuid.UUID(trabajo_id))
    except ValueError:
        t = None
    if not t or t.tipo != "demo_rcv":
        raise HTTPException(404, "Demo no encontrada")
    return _out(t)


@router.get("/rcv/{trabajo_id}/csv")
def csv(trabajo_id: str, db: DB):
    try:
        t = db.get(Trabajo, uuid.UUID(trabajo_id))
    except ValueError:
        t = None
    if not t or t.tipo != "demo_rcv" or not t.archivo:
        raise HTTPException(404, "Archivo no disponible")
    ruta = config().datos_dir / t.archivo
    if not ruta.exists():
        raise HTTPException(410, "La demo expiró; vuelve a generarla")
    per = (t.resultado or {}).get("periodo", "")
    op = (t.resultado or {}).get("operacion", "RCV")
    return FileResponse(ruta, media_type="text/csv",
                        filename=f"RCV_{op}_{t.rut}_{per}.csv")
