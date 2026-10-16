"""Esquemas Pydantic de entrada/salida de la API."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator


def _rut_ok(v: str) -> str:
    limpio = re.sub(r"[^0-9kK]", "", v or "").upper()
    if len(limpio) < 8 or len(limpio) > 9 or not limpio[:-1].isdigit():
        raise ValueError("RUT inválido")
    cuerpo, dv = limpio[:-1], limpio[-1]
    suma, mul = 0, 2
    for c in reversed(cuerpo):
        suma += int(c) * mul
        mul = 2 if mul == 7 else mul + 1
    resto = 11 - (suma % 11)
    esperado = {11: "0", 10: "K"}.get(resto, str(resto))
    if dv != esperado:
        raise ValueError("El dígito verificador del RUT no coincide")
    return f"{cuerpo}-{dv}"


# --- auth ---

class RegistroIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    nombre: str = Field(default="", max_length=200)
    acepto_terminos: bool

    @field_validator("acepto_terminos")
    @classmethod
    def _terminos(cls, v):
        if not v:
            raise ValueError("Debes aceptar los términos de servicio")
        return v


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UsuarioOut(BaseModel):
    id: str
    email: str
    nombre: str
    plan: str
    creado: datetime
    es_admin: bool = False
    recibir_correos: bool = True


class PerfilIn(BaseModel):
    nombre: str = Field(default="", max_length=200)
    recibir_correos: bool = True


class CambioPasswordIn(BaseModel):
    actual: str
    nueva: str = Field(min_length=8, max_length=128)


class RecuperarIn(BaseModel):
    email: EmailStr


class RestablecerIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class AdminUsuarioOut(BaseModel):
    id: str
    email: str
    nombre: str
    plan: str
    activo: bool
    es_admin: bool
    creado: datetime
    n_empresas: int
    ruts: list[str]
    ultima_consulta: datetime | None


class AdminUsuarioIn(BaseModel):
    plan: str | None = None
    activo: bool | None = None
    es_admin: bool | None = None


class CorreoPruebaIn(BaseModel):
    para: EmailStr


# --- empresas ---

class EmpresaIn(BaseModel):
    rut: str
    clave: str = Field(min_length=4, max_length=64)
    razon_social: str = Field(default="", max_length=300)

    _v = field_validator("rut")(_rut_ok)


class EmpresaClaveIn(BaseModel):
    clave: str = Field(min_length=4, max_length=64)


class EmpresaOut(BaseModel):
    id: str
    rut: str
    razon_social: str
    activa: bool
    creado: datetime
    ultima_rcv: datetime | None
    ultima_tgr: datetime | None
    ultima_f29: datetime | None
    ultimo_error: str | None
    credencial_invalida: bool
    deuda_tgr: int | None = None
    docs_mes: int = 0
    alertas_sin_leer: int = 0
    # programación
    frecuencia_rcv_min: int = 1440          # efectiva (ya ajustada al plan)
    frecuencia_minima_plan: int = 1440
    solo_horario_habil: bool = False
    auto_tgr_f29: bool = True


class HistoricoIn(BaseModel):
    desde: str = Field(pattern=r"^\d{6}$")          # AAAAMM
    hasta: str | None = Field(default=None, pattern=r"^\d{6}$")
    operaciones: list[str] = ["COMPRA", "VENTA"]


class ProgramacionIn(BaseModel):
    frecuencia_rcv_min: int
    solo_horario_habil: bool = False
    auto_tgr_f29: bool = True


# --- demo ---

class DemoIn(BaseModel):
    rut: str
    clave: str = Field(min_length=4, max_length=64)
    periodo: str | None = Field(default=None, pattern=r"^\d{6}$")
    operacion: str = Field(default="VENTA", pattern=r"^(COMPRA|VENTA)$")

    _v = field_validator("rut")(_rut_ok)


# --- trabajos ---

class TrabajoOut(BaseModel):
    id: str
    tipo: str
    estado: str
    rut: str
    resultado: dict[str, Any]
    error: str | None
    creado: datetime
    terminado: datetime | None
    tiene_archivo: bool
    origen: str = "manual"
    parametros: dict[str, Any] = {}


# --- planes ---

class PlanOut(BaseModel):
    codigo: str
    nombre: str
    precio_clp: int
    max_ruts: int
    documentos: list[str]
    frecuencia_minutos: int
    frecuencia_defecto: int
    historial_meses: int
    alertas_correo: bool
    soporte: str
