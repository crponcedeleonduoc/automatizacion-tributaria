"""Registro de Compras y Ventas (RCV) vía facadeService del SII.

Migrado de sii_reader.py (facade genérico + rcv_csv + rcv_todos_estados).
Verificado el 16/08/2026 comparando el CSV del endpoint contra la descarga
manual del portal: coincidencia exacta.

Garantía de solo lectura: _assert_lectura() bloquea cualquier método cuyo
nombre sugiera mutación y exige que esté declarado en REGISTRY.
"""

from __future__ import annotations

import csv
import io
import json
import random
import time
import uuid
from typing import Any

from .auth import ClaveAuthTLS, UA
from .errores import OperacionNoPermitida, SiiError, SiiMantencion
from .utils import a_entero, split_rut

PREFIJOS_ESCRITURA = (
    "set", "save", "post", "put", "delete", "ingresa", "envia", "enviar",
    "anula", "modifica", "elimina", "borra", "cambia", "confirma", "acepta",
    "rechaza", "reclama", "cede", "declara", "solicita", "upload", "carga",
    "genera", "emite", "emitir", "paga", "pagar", "actualiza", "inserta",
)

REGISTRY: dict[str, dict[str, Any]] = {
    "rcv": {
        "base": "https://www4.sii.cl/consdcvinternetui/services/data/facadeService",
        "ns": "cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService",
        "referer": "https://www4.sii.cl/consdcvinternetui/",
        "metodos": {
            "getResumen": {},
            "getDetalleCompraExport": {},
            "getDetalleVentaExport": {},
            # getDetalleCompra / getDetalleVenta exigen reCAPTCHA: no se usan.
        },
    },
}

ESTADOS_RCV = ("REGISTRO", "PENDIENTE", "NO_INCLUIR", "RECLAMADO")

TIPOS_DOC = {
    "33": "Factura afecta", "34": "Factura exenta", "39": "Boleta",
    "41": "Boleta exenta", "43": "Liquidación factura", "46": "Factura de compra",
    "52": "Guía de despacho", "56": "Nota de débito", "61": "Nota de crédito",
    "110": "Factura exportación", "111": "Nota débito exportación",
    "112": "Nota crédito exportación",
}


def _assert_lectura(nombre: str, universo) -> None:
    bajo = nombre.lower()
    for p in PREFIJOS_ESCRITURA:
        if bajo.startswith(p):
            raise OperacionNoPermitida(
                f"'{nombre}' parece una operación de escritura. "
                "Este cliente es de solo lectura por diseño.")
    if nombre not in universo:
        raise OperacionNoPermitida(f"'{nombre}' no está declarado.")


def _chequear_html(texto: str) -> None:
    cabeza = texto.lstrip()[:300].lower()
    if cabeza.startswith(("<!doctype", "<html")):
        if "mantenc" in cabeza or "no disponible" in cabeza:
            raise SiiMantencion("El SII está en mantención.")
        raise SiiError("El SII devolvió HTML en vez de datos: sesión expirada "
                       "o el endpoint cambió.")


class ClienteRCV:
    def __init__(self, auth: ClaveAuthTLS, pausa: float = 0.5,
                 reintentos: int = 3, timeout: int = 60):
        self.auth = auth
        self.pausa = max(0.35, pausa)
        self.reintentos = reintentos
        self.timeout = timeout
        self._ultimo = 0.0

    def _throttle(self):
        d = time.monotonic() - self._ultimo
        if d < self.pausa:
            time.sleep(self.pausa - d + random.uniform(0, 0.15))
        self._ultimo = time.monotonic()

    # ---------------- facadeService ----------------

    def facade(self, app: str, metodo: str, data: dict, _intento: int = 0) -> dict:
        cfg = REGISTRY[app]
        _assert_lectura(metodo, set(cfg["metodos"]))
        self._throttle()

        self.auth.arrancar_app(cfg["referer"])
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "Referer": cfg["referer"],
            "Origin": "/".join(cfg["referer"].split("/")[:3]),
            "User-Agent": UA,
        }
        # conversationId ES la cookie TOKEN de la sesión (verificado).
        payload = {
            "metaData": {
                "namespace": f"{cfg['ns']}/{metodo}",
                "conversationId": self.auth.conversation_id(),
                "transactionId": str(uuid.uuid4()),
                "page": None,
            },
            "data": data,
        }
        try:
            r = self.auth.s.post(f"{cfg['base']}/{metodo}", json=payload,
                                 headers=headers, timeout=self.timeout)
        except Exception as e:
            if _intento < self.reintentos:
                time.sleep(2 ** _intento)
                return self.facade(app, metodo, data, _intento + 1)
            raise SiiError(f"Fallo de red hablando con el SII: {e}") from e

        if r.status_code in (401, 403):
            if _intento == 0:          # una sola reautenticación, nunca más
                self.auth.renovar()
                return self.facade(app, metodo, data, _intento + 1)
            raise SiiError(f"HTTP {r.status_code} tras reautenticar; no se "
                           "reintenta para no marcar la cuenta.")
        if r.status_code >= 500 and _intento < self.reintentos:
            time.sleep(2 ** _intento)
            return self.facade(app, metodo, data, _intento + 1)
        if r.status_code >= 400:
            raise SiiError(f"HTTP {r.status_code} del SII en {metodo}.")

        _chequear_html(r.text)
        try:
            sobre = json.loads(r.text)
        except json.JSONDecodeError as e:
            raise SiiError(f"Respuesta no-JSON del SII: {r.text[:200]}") from e

        est = sobre.get("respEstado") or {}
        cod = est.get("codRespuesta")
        if cod not in (0, "0", None):
            msg = (est.get("msgeRespuesta") or est.get("msjeRespuesta")
                   or est.get("coderror") or "sin mensaje")
            # NO reautenticar aquí: el SII antepone "El token no es valido" a
            # mensajes que no tienen que ver con la sesión ("NO Existen Datos").
            raise SiiError(f"El SII rechazó la consulta (codRespuesta={cod}): {msg}")
        return sobre

    # ---------------- RCV ----------------

    @staticmethod
    def _rcv_data(rut, periodo, operacion, estado="REGISTRO", tipo=None):
        c, dv = split_rut(rut)
        d = {"rutEmisor": c, "dvEmisor": dv, "ptributario": periodo,
             "operacion": operacion, "estadoContab": estado}
        if tipo is not None:
            d["codTipoDoc"] = tipo
        return d

    def resumen(self, rut: str, periodo: str, operacion: str = "COMPRA") -> dict:
        d = self._rcv_data(rut, periodo, operacion)
        d["busquedaInicial"] = True
        return self.facade("rcv", "getResumen", d)

    def csv(self, rut: str, periodo: str, operacion: str = "COMPRA",
            estado: str = "REGISTRO", tipo: str = "0") -> str:
        """CSV del detalle (separado por ';', tal como lo entrega el SII).

        El endpoint *Export devuelve JSON con `data` = lista de líneas.
        """
        m = ("getDetalleCompraExport" if operacion == "COMPRA"
             else "getDetalleVentaExport")
        sobre = self.facade("rcv", m, self._rcv_data(rut, periodo, operacion,
                                                     estado, tipo))
        lineas = sobre.get("data")
        if lineas is None:
            raise SiiError(f"El SII no devolvió detalle para {periodo} {operacion}.")
        if isinstance(lineas, str):
            return lineas
        return "\n".join(str(x) for x in lineas) + "\n"

    def todos_estados(self, rut: str, periodo: str,
                      operacion: str = "COMPRA") -> dict[str, str]:
        """{estado: csv} para REGISTRO, PENDIENTE, NO_INCLUIR, RECLAMADO.

        Los estados vacíos se omiten: que un estado esté vacío es lo normal.
        """
        salida = {}
        for estado in ESTADOS_RCV:
            try:
                txt = self.csv(rut, periodo, operacion, estado)
                if txt.strip().count("\n") >= 1:      # más que solo encabezado
                    salida[estado] = txt
            except SiiError as e:
                bajo = str(e).lower()
                if "no existen datos" in bajo or "no hay documentos" in bajo:
                    continue
                raise
        return salida


# ---------------------------------------------------------------------------
# Parser del CSV del SII → filas normalizadas
# ---------------------------------------------------------------------------

_MAPA = {
    "tipo_doc": ("tipo doc",),
    "rut_contraparte": ("rut proveedor", "rut cliente"),
    "razon_social": ("razon social",),
    "folio": ("folio",),
    "fecha_emision": ("fecha docto",),
    "fecha_recepcion": ("fecha recepcion",),
    "fecha_acuse": ("fecha acuse",),
    "fecha_reclamo": ("fecha reclamo",),
    "monto_exento": ("monto exento",),
    "monto_neto": ("monto neto",),
    "monto_iva": ("monto iva recuperable", "monto iva"),
    "monto_total": ("monto total",),
}


def _col(headers: list[str], candidatos: tuple[str, ...]) -> str | None:
    bajos = {h.strip().lower(): h for h in headers}
    for c in candidatos:
        for k, original in bajos.items():
            if k == c or k.startswith(c):
                return original
    return None


def parsear_csv_rcv(texto: str) -> list[dict]:
    """Convierte el CSV del SII en una lista de dicts normalizados.

    Cada dict trae las claves de _MAPA más `fila` con TODAS las columnas
    originales, para no perder información que el SII agregue.
    """
    texto = texto.lstrip("﻿")
    if not texto.strip():
        return []
    lector = csv.DictReader(io.StringIO(texto), delimiter=";")
    headers = lector.fieldnames or []
    mapa = {k: _col(headers, v) for k, v in _MAPA.items()}
    filas = []
    for raw in lector:
        if not raw or not any((v or "").strip() for v in raw.values()):
            continue
        d = {}
        for k, h in mapa.items():
            val = (raw.get(h) or "").strip() if h else ""
            d[k] = a_entero(val) if k.startswith("monto") else val
        d["rut_contraparte"] = d["rut_contraparte"].upper()
        d["fila"] = {k: (v or "").strip() for k, v in raw.items() if k}
        filas.append(d)
    return filas
