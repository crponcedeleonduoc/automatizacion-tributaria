from __future__ import annotations

import re
from datetime import date

from .errores import SiiError


def split_rut(rut: str) -> tuple[str, str]:
    limpio = re.sub(r"[^0-9kK]", "", str(rut)).upper()
    if len(limpio) < 2:
        raise SiiError(f"RUT inválido: {rut}")
    return limpio[:-1], limpio[-1]


def dv_valido(rut: str) -> bool:
    try:
        cuerpo, dv = split_rut(rut)
    except SiiError:
        return False
    if not cuerpo.isdigit():
        return False
    suma, mul = 0, 2
    for c in reversed(cuerpo):
        suma += int(c) * mul
        mul = 2 if mul == 7 else mul + 1
    resto = 11 - (suma % 11)
    esperado = {11: "0", 10: "K"}.get(resto, str(resto))
    return dv == esperado


def formatear_rut(rut: str) -> str:
    """77218696-7 (sin puntos, con guion). Formato canónico interno."""
    cuerpo, dv = split_rut(rut)
    return f"{cuerpo}-{dv}"


def periodos(desde: str, hasta: str) -> list[str]:
    a, ma = int(desde[:4]), int(desde[4:])
    b, mb = int(hasta[:4]), int(hasta[4:])
    out = []
    while (a, ma) <= (b, mb):
        out.append(f"{a}{ma:02d}")
        ma += 1
        if ma > 12:
            ma, a = 1, a + 1
    return out


def periodo_actual() -> str:
    h = date.today()
    return f"{h.year}{h.month:02d}"


def periodo_anterior(periodo: str) -> str:
    a, m = int(periodo[:4]), int(periodo[4:])
    m -= 1
    if m == 0:
        m, a = 12, a - 1
    return f"{a}{m:02d}"


def a_entero(v) -> int:
    s = re.sub(r"[^\d-]", "", str(v or ""))
    try:
        return int(s) if s else 0
    except ValueError:
        return 0
