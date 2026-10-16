"""Planes comerciales de aSIIstente. Cambiar precios aquí y en la web."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Plan:
    codigo: str
    nombre: str
    precio_clp: int
    max_ruts: int
    documentos: tuple[str, ...]        # rcv, tgr, f29
    frecuencia_minutos: int            # frecuencia MÍNIMA de RCV que permite el plan
    frecuencia_defecto: int            # frecuencia con la que parte una empresa nueva
    historial_meses: int               # 0 = ilimitado
    alertas_correo: bool
    soporte: str


PLANES: dict[str, Plan] = {
    "gratis": Plan(
        codigo="gratis", nombre="Gratis", precio_clp=0, max_ruts=1,
        documentos=("rcv",), frecuencia_minutos=24 * 60, frecuencia_defecto=24 * 60,
        historial_meses=1,
        alertas_correo=False, soporte="correo",
    ),
    "pyme": Plan(
        codigo="pyme", nombre="Pyme", precio_clp=9990, max_ruts=1,
        documentos=("rcv", "tgr", "f29"), frecuencia_minutos=60, frecuencia_defecto=60,
        historial_meses=12, alertas_correo=True, soporte="correo",
    ),
    "contador": Plan(
        codigo="contador", nombre="Contador", precio_clp=29990, max_ruts=20,
        documentos=("rcv", "tgr", "f29"), frecuencia_minutos=10, frecuencia_defecto=30,
        historial_meses=0, alertas_correo=True, soporte="whatsapp",
    ),
}

# El TGR y el F29 usan navegador: aunque el plan diga "cada 10 min", esos dos
# documentos se consultan como máximo una vez al día por RUT.
FRECUENCIA_MINIMA_NAVEGADOR_MIN = 24 * 60


def plan(codigo: str) -> Plan:
    return PLANES.get(codigo, PLANES["gratis"])


# Frecuencias de RCV que el usuario puede elegir en el panel (minutos). El plan
# fija el mínimo: Contador puede bajar hasta 10, Pyme hasta 60, Gratis sólo 1 día.
FRECUENCIAS_RCV: tuple[int, ...] = (10, 30, 60, 180, 360, 720, 24 * 60)

# Horario "hábil" para RCV cuando la empresa marca solo_horario_habil (hora Chile).
HORARIO_HABIL = (7, 22)


def frecuencia_rcv(codigo_plan: str, elegida: int | None) -> int:
    """Frecuencia efectiva: la elegida por el usuario, nunca menor que el mínimo
    del plan (si bajó de plan, se ajusta sola)."""
    p = plan(codigo_plan)
    if elegida is None or elegida not in FRECUENCIAS_RCV:
        return max(p.frecuencia_defecto, p.frecuencia_minutos)
    return max(elegida, p.frecuencia_minutos)
