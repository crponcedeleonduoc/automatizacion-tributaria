"""Planificador: encola las consultas periódicas según el plan de cada usuario.

Cada 60 s revisa todas las empresas activas. Para cada documento incluido en
el plan, si pasó más tiempo que la frecuencia del plan desde la última
consulta exitosa (o desde el último intento fallido), encola el trabajo.

Reglas:
- RCV: frecuencia elegida por el usuario en Ajustes, nunca menor al mínimo del
  plan (10 min / 1 h / 24 h), cola HTTP. Opcionalmente sólo en horario hábil.
- TGR y F29: máximo una vez al día (usan navegador), cola navegador, y sólo
  entre 06:00 y 23:00 hora de Chile para no cargar el portal de madrugada
  cuando suele estar en mantención.
- Empresas con credencial inválida: no se consultan hasta que el usuario la
  corrija (evita bloqueos por intentos repetidos).
- Un mismo trabajo no se encola dos veces si ya hay uno pendiente/corriendo.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select

from comun.cola import COLA_HTTP, COLA_NAVEGADOR, cola, job_vivo
from comun.correo import correo_alertas, enviar, smtp_configurado
from comun.modelos import Alerta, Empresa, Trabajo, Usuario, crear_tablas, sesion_factory
from comun.planes import (FRECUENCIA_MINIMA_NAVEGADOR_MIN, HORARIO_HABIL,
                          frecuencia_rcv, plan)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s scheduler: %(message)s")
log = logging.getLogger("scheduler")
CHILE = ZoneInfo("America/Santiago")

TAREAS = {
    "rcv": ("tareas.rcv.sincronizar_rcv", COLA_HTTP, 10 * 60),
    "tgr": ("tareas.tgr.sincronizar_tgr", COLA_NAVEGADOR, 15 * 60),
    "f29": ("tareas.f29.sincronizar_f29", COLA_NAVEGADOR, 20 * 60),
}


def _hay_pendiente(s, empresa_id, tipo) -> bool:
    filas = s.execute(select(Trabajo).where(
        Trabajo.empresa_id == empresa_id, Trabajo.tipo == tipo,
        Trabajo.estado.in_(("pendiente", "corriendo")),
    )).scalars().all()
    vivo = False
    for t in filas:
        if job_vivo(str(t.id)):
            vivo = True
        else:
            t.estado = "error"
            t.error = "El trabajo se perdió en la cola; el scheduler lo reprogramará."
            t.terminado = datetime.now(timezone.utc)
    return vivo


def _toca(ultima, frecuencia_min: int, ahora) -> bool:
    return ultima is None or (ahora - ultima) >= timedelta(minutes=frecuencia_min)


def ciclo() -> int:
    ahora = datetime.now(timezone.utc)
    hora_cl = datetime.now(CHILE).hour
    encolados = 0
    S = sesion_factory()
    with S() as s:
        filas = s.execute(select(Empresa, Usuario).join(Usuario)
                          .where(Empresa.activa.is_(True),
                                 Usuario.activo.is_(True),
                                 Empresa.credencial_invalida.is_(False))).all()
        for emp, usr in filas:
            p = plan(usr.plan)
            for doc in p.documentos:
                if doc not in TAREAS:
                    continue
                func, nombre_cola, timeout = TAREAS[doc]
                if doc == "rcv":
                    frecuencia = frecuencia_rcv(usr.plan, emp.frecuencia_rcv_min)
                    ultima = emp.ultima_rcv
                    if emp.solo_horario_habil and not (HORARIO_HABIL[0] <= hora_cl < HORARIO_HABIL[1]):
                        continue
                else:
                    if not emp.auto_tgr_f29:
                        continue
                    frecuencia = max(p.frecuencia_minutos, FRECUENCIA_MINIMA_NAVEGADOR_MIN)
                    ultima = emp.ultima_tgr if doc == "tgr" else emp.ultima_f29
                    if not (6 <= hora_cl <= 23):
                        continue
                # tras un error, esperar al menos 30 min antes de reintentar
                if emp.ultimo_error_en and (ahora - emp.ultimo_error_en) < timedelta(minutes=30):
                    continue
                if not _toca(ultima, frecuencia, ahora):
                    continue
                if _hay_pendiente(s, emp.id, doc):
                    continue
                if doc == "rcv" and _hay_pendiente(s, emp.id, "rcv_historico"):
                    continue          # la descarga masiva ya tiene la sesión del RUT
                t = Trabajo(tipo=doc, empresa_id=emp.id, usuario_id=usr.id,
                            rut=emp.rut, parametros={"origen": "scheduler"})
                s.add(t)
                s.flush()
                cola(nombre_cola).enqueue(func, str(emp.id), str(t.id),
                                          job_id=str(t.id), job_timeout=timeout)
                encolados += 1
        s.commit()
    return encolados


# Alertas que se avisan aunque el plan no incluya correo (el usuario debe saberlo).
SIEMPRE_POR_CORREO = {"credencial_invalida"}


def enviar_correos() -> int:
    """Agrupa las alertas sin enviar por usuario y manda un solo correo por usuario.

    Si SMTP no está configurado no marca nada: las alertas quedan pendientes y se
    envían cuando se configure. Las de planes sin correo se marcan como
    procesadas sin enviar (siguen visibles en el panel).
    """
    if not smtp_configurado():
        return 0
    enviados = 0
    S = sesion_factory()
    with S() as s:
        filas = s.execute(select(Alerta, Empresa, Usuario)
                          .join(Empresa, Alerta.empresa_id == Empresa.id)
                          .join(Usuario, Empresa.usuario_id == Usuario.id)
                          .where(Alerta.enviada_correo.is_(False))
                          .order_by(Alerta.creado)).all()
        por_usuario: dict = {}
        for a, e, u in filas:
            incluye = plan(u.plan).alertas_correo or a.tipo in SIEMPRE_POR_CORREO
            if not u.recibir_correos or not u.activo or not incluye:
                a.enviada_correo = True          # procesada, no se envía
                continue
            cab = f"{e.rut}" + (f" · {e.razon_social}" if e.razon_social else "")
            por_usuario.setdefault(u, {}).setdefault(cab, []).append(a)
        for u, por_empresa in por_usuario.items():
            asunto, html = correo_alertas(u.nombre, por_empresa)
            if enviar(u.email, asunto, html):
                enviados += 1
                for lst in por_empresa.values():
                    for a in lst:
                        a.enviada_correo = True
        s.commit()
    return enviados


def main() -> None:
    crear_tablas()
    log.info("scheduler iniciado (smtp %s)", "configurado" if smtp_configurado() else "NO configurado")
    while True:
        try:
            n = ciclo()
            if n:
                log.info("encolados %d trabajos", n)
        except Exception as e:
            log.exception("error en ciclo: %s", e)
        try:
            m = enviar_correos()
            if m:
                log.info("correos de alertas enviados: %d", m)
        except Exception as e:
            log.exception("error enviando correos: %s", e)
        time.sleep(60)


if __name__ == "__main__":
    main()
