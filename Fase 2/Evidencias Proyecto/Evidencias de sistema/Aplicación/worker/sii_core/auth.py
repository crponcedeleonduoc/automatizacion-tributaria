"""Autenticación al SII con huella TLS de Chrome (curl_cffi).

Migrado de sii_auth_tls.py. El login programático con `requests` falla
porque F5 Shape reconoce el fingerprint TLS de python-requests y no emite la
cookie TOKEN. curl_cffi replica el handshake de Chrome real; el SII ve un
cliente indistinguible de un navegador. No evade la protección: presenta las
credenciales legítimas del dueño con una huella de navegador honesta.

Diferencias con el original: sin caché de sesión en disco, errores tipados
(CredencialesInvalidas / SesionesExcedidas) para que el worker decida si
reintentar, y siempre cerrar sesión (context manager).
"""

from __future__ import annotations

import logging
import re

from curl_cffi import requests as cr

from .errores import CredencialesInvalidas, SesionesExcedidas, SiiError
from .utils import split_rut

LOGIN_CLAVE = "https://zeusr.sii.cl/cgi_AUT2000/CAutInicio.cgi"
PAGINA_LOGIN = ("https://zeusr.sii.cl/AUT2000/InicioAutenticacion/"
                "IngresoRutClave.html")
IMPERSONATE = "chrome124"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
log = logging.getLogger("sii.auth")


class ClaveAuthTLS:
    COOKIES_SESION = ("TOKEN", "CSESSIONID", "RUT_NS", "DV_NS")

    def __init__(self, rut: str, clave: str, timeout: int = 60):
        self.rut = rut
        self.clave = clave
        self.timeout = timeout
        self.s = cr.Session(impersonate=IMPERSONATE)
        self._logueado = False
        self._arrancadas: set[str] = set()

    # -- context manager: garantiza el logout --
    def __enter__(self):
        self.login()
        return self

    def __exit__(self, *exc):
        self.cerrar_sesion()
        return False

    # -- login --
    def login(self, forzar: bool = False) -> None:
        if self._logueado and not forzar:
            return
        cuerpo, dv = split_rut(self.rut)

        # 1) visitar la página de login como un navegador: cookies de Shape
        try:
            self.s.get(PAGINA_LOGIN, timeout=30)
        except Exception:
            pass

        # 2) POST del login
        data = {
            "rut": cuerpo, "dv": dv,
            "referencia": "https://misiir.sii.cl/cgi_misii/siihome.cgi",
            "411": "", "rutcntr": f"{cuerpo}-{dv}", "clave": self.clave,
        }
        try:
            r = self.s.post(
                LOGIN_CLAVE, data=data, timeout=self.timeout, allow_redirects=True,
                headers={"Referer": PAGINA_LOGIN,
                         "Content-Type": "application/x-www-form-urlencoded",
                         "Origin": "https://zeusr.sii.cl"},
            )
        except Exception as e:
            raise SiiError("No se pudo conectar con el SII (red o portal caído). "
                           f"Detalle: {str(e)[:120]}") from e
        if self.s.cookies.get("TOKEN"):
            self._logueado = True
            self._arrancadas = set()
            return

        # Diagnóstico: el SII no emitió TOKEN. Decidir por qué.
        cuerpo_resp = (r.text or "")
        texto_plano = re.sub(r"<[^>]+>", " ", cuerpo_resp)
        texto_plano = re.sub(r"\s+", " ", texto_plano)[:4000]
        cookies = sorted(self.s.cookies.keys())
        ts = self.s.cookies.get("TS0161cd2b") or ""
        # Tamaño de la cookie de Shape: ~778 sano, ~106 = cliente marcado.
        log.warning("login SII sin TOKEN | rut=%s | http=%s | url=%s | cookies=%s | "
                    "shape_len=%d | texto=%r", f"{cuerpo}-{dv}", r.status_code,
                    str(r.url)[:120], cookies, len(ts), texto_plano[:1200])

        if re.search(r"m[aá]ximo de sesiones|01\.01\.113\.500\.720", texto_plano, re.I):
            raise SesionesExcedidas(
                "Máximo de sesiones concurrentes para este RUT. El SII las "
                "libera solo en 20-30 minutos.")
        if re.search(r"(clave|contrase[ñn]a).{0,60}(incorrect|inv[aá]lid|err[oó]nea|no es v[aá]lid)|"
                     r"rut.{0,40}(incorrect|inv[aá]lid|no existe)|usuario o clave",
                     texto_plano, re.I):
            raise CredencialesInvalidas("RUT o clave tributaria incorrectos.")
        if re.search(r"clave.{0,80}bloquead|bloqueo de (la )?clave|excedi.{0,30}intentos",
                     texto_plano, re.I):
            raise CredencialesInvalidas(
                "El SII indica que la clave está bloqueada por intentos repetidos. "
                "Recupérala en sii.cl antes de reintentar.")
        if 0 < len(ts) < 300:
            raise SiiError(
                "El antibot del SII marcó esta conexión (cookie Shape corta). "
                "Suele pasar tras varios intentos seguidos; espera unos minutos.")
        raise SiiError(
            "El SII no emitió la cookie de sesión. Puede ser bloqueo temporal, "
            f"mantención o cambio del portal. Cookies recibidas: {cookies}")

    def arrancar_app(self, referer: str) -> None:
        """Visita la SPA para que el SII emita las cookies de esa aplicación."""
        self.login()
        if referer in self._arrancadas:
            return
        try:
            r = self.s.get(referer, timeout=self.timeout, allow_redirects=True,
                           headers={"Referer": "https://misiir.sii.cl/"})
        except Exception as e:
            raise SiiError(f"No se pudo abrir la aplicación del SII: {str(e)[:120]}") from e
        if "IngresoRutClave" in str(r.url) or "CAutInicio" in str(r.url):
            self._logueado = False
            raise SiiError("La sesión caducó al abrir la aplicación del SII.")
        self._arrancadas.add(referer)

    def conversation_id(self) -> str:
        self.login()
        tok = self.s.cookies.get("TOKEN")
        if not tok:
            raise SiiError("Sesión sin TOKEN.")
        return tok

    def renovar(self) -> None:
        self._arrancadas = set()
        self._logueado = False
        self.login(forzar=True)

    def cookies_para_playwright(self) -> list[dict]:
        out = []
        for c in self.s.cookies.jar:
            out.append({"name": c.name, "value": c.value,
                        "domain": c.domain or ".sii.cl", "path": c.path or "/",
                        "secure": bool(c.secure)})
        return out

    def cerrar_sesion(self) -> bool:
        """Imprescindible: el SII no libera sesiones al terminar el proceso."""
        ok = False
        if self.s.cookies.get("TOKEN"):
            for url in ("https://misiir.sii.cl/cgi_misii/siilogout.cgi",
                        "https://zeusr.sii.cl/cgi_AUT2000/CAutCerrarSesion.cgi"):
                try:
                    r = self.s.get(url, timeout=30)
                    if r.status_code < 400:
                        ok = True
                except Exception:
                    continue
        try:
            self.s.cookies.clear()
        except Exception:
            pass
        self._logueado = False
        self._arrancadas = set()
        return ok
