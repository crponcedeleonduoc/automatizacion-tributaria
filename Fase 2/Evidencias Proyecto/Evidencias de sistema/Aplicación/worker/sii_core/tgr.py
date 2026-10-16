"""Certificado de Deuda Fiscal de la Tesorería (TGR).

Migrado de tgr_final.py + sii_tgr.py. Flujo validado en producción:
  1. Login SII con curl_cffi (pasa Shape)
  2. Visitar la página del certificado ANTES de autenticar (siembra la sesión
     de tesoreria.cl). Ir directo al OAuth falla con "Ups! Algo salió mal".
  3. Clic en el botón "Clave Tributaria" (button ancho >150px que NO contiene
     'nica'; los otros son ClaveÚnica).
  4. Login OAuth del SII con IDs exactos #inputRut, #inputPass, #bt_ingresar
     (hay campos password decoy ocultos; NO usar Enter).
  5. Aparece token vr= en la URL → el certificado carga como PDF base64 en un
     iframe. Extraer, decodificar, parsear.
  6. Requiere pantalla: en headless puro el iframe del PDF no carga. En el
     servidor se usa Xvfb (DISPLAY=:99) con headless=False.
"""

from __future__ import annotations

import base64
import io
import re
from dataclasses import dataclass, field

from .auth import ClaveAuthTLS, UA
from .errores import SiiError
from .utils import a_entero, split_rut

CERT_PAGE = "https://web.tesoreria.cl/tramites-tgr/certificado-de-deuda-fiscal/"


@dataclass
class DeudaTGR:
    rut: str = ""
    nombre: str = ""
    total_morosa: int = 0
    total_no_vencida: int = 0
    total_art_196_197: int = 0
    lineas: list[dict] = field(default_factory=list)
    fecha_emision: str = ""

    @property
    def tiene_deuda(self) -> bool:
        return self.total_morosa > 0 or self.total_no_vencida > 0

    def a_dict(self) -> dict:
        return {
            "rut": self.rut, "nombre": self.nombre,
            "total_morosa": self.total_morosa,
            "total_no_vencida": self.total_no_vencida,
            "total_art_196_197": self.total_art_196_197,
            "n_giros": len(self.lineas), "lineas": self.lineas,
            "fecha_emision": self.fecha_emision,
        }


def parsear_pdf_tgr(data: bytes) -> DeudaTGR:
    import pdfplumber
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        txt = "\n".join(p.extract_text() or "" for p in pdf.pages)

    d = DeudaTGR()
    m = re.search(r"NOMBRE\s+(.+)", txt)
    if m:
        d.nombre = m.group(1).strip()
    m = re.search(r"RUT\s+([\d.]+-[\dkK])", txt)
    if m:
        d.rut = m.group(1)

    m = re.search(r"Total Deuda Liquidada Morosa.*?([\d.,]+)", txt, re.S)
    if m:
        d.total_morosa = a_entero(m.group(1))
    m = re.search(r"CLP\s+([\d.,]+)", txt)
    if m:
        d.total_morosa = a_entero(m.group(1))
    # La fila "Total Deuda Morosa (CLP)" tiene 5 columnas:
    #   NETA  REAJUSTE  INTERES  MULTA  TOTAL   → el total real es la ÚLTIMA.
    m = re.search(r"Total Deuda Morosa \(CLP\)\s+([\d.,\s]+)", txt)
    if m:
        numeros = re.findall(r"[\d.,]+", m.group(1))
        if numeros:
            d.total_morosa = a_entero(numeros[-1])

    m = re.search(r"Total Deuda No Vencida[^\d]*([\d.,]+)", txt)
    if m:
        d.total_no_vencida = a_entero(m.group(1))

    m = re.search(r"Fecha de Emisi[oó]n.*?(\d{2}-\d{2}-\d{4})", txt)
    if m:
        d.fecha_emision = m.group(1)

    # líneas: FORMULARIO TIPO FOLIO FECHA_VCTO NETA REAJ INT MULTA TOTAL
    for ln in txt.splitlines():
        campos = ln.split()
        if len(campos) >= 7 and re.match(r"^\d{1,3}$", campos[0]):
            nums = [c for c in campos if re.match(r"^[\d.,]+$", c)]
            fechas = [c for c in campos if re.match(r"^\d{2}-\d{2}-\d{4}$", c)]
            if len(nums) >= 5:
                d.lineas.append({
                    "formulario": campos[0],
                    "tipo": campos[1],
                    "folio": campos[2],
                    "vencimiento": fechas[0] if fechas else "",
                    "neta": a_entero(nums[-5]),
                    "reajuste": a_entero(nums[-4]),
                    "interes": a_entero(nums[-3]),
                    "multa": a_entero(nums[-2]),
                    "total": a_entero(nums[-1]),
                })
    return d


def consultar_tgr(rut: str, clave: str, headless: bool = False,
                  timeout_ms: int = 30000) -> tuple[DeudaTGR, bytes]:
    """Devuelve (deuda parseada, bytes del PDF). Abre y cierra su propia sesión."""
    from playwright.sync_api import sync_playwright

    cuerpo, dv = split_rut(rut)
    auth = ClaveAuthTLS(rut, clave)
    auth.login()
    cookies = auth.cookies_para_playwright()

    with sync_playwright() as pw:
        b = pw.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled",
                  "--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(accept_downloads=True, user_agent=UA,
                            viewport={"width": 1440, "height": 900},
                            locale="es-CL")
        ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
        ctx.add_cookies(cookies)
        p = ctx.new_page()
        p.set_default_timeout(timeout_ms)
        try:
            # 1. página del certificado primero (siembra sesión TGR)
            p.goto(CERT_PAGE, wait_until="domcontentloaded")
            p.wait_for_timeout(7000)
            # 2. clic Clave Tributaria
            btn = p.evaluate_handle(
                "() => [...document.querySelectorAll('button')].find(b => {"
                "const r=b.getBoundingClientRect();"
                "return r.width>150 && !(b.textContent||'').includes('nica');})")
            if btn.as_element():
                btn.as_element().click()
            p.wait_for_timeout(7000)
            # 3. login OAuth del SII
            p.fill("#inputRut", f"{cuerpo}-{dv}")
            p.fill("#inputPass", clave)
            p.click("#bt_ingresar")
            p.wait_for_timeout(12000)
            if "vr=" not in p.url:
                raise SiiError("El OAuth de la TGR no completó (sin token vr). "
                               "Posible exceso de sesiones o cambio del portal.")
            # 4. PDF base64 en iframe; reintentar hasta 10 veces
            pdf_b64 = None
            for _ in range(10):
                for fr in p.frames:
                    if fr.url.startswith("data:application/pdf;base64,"):
                        pdf_b64 = fr.url.split(",", 1)[1]
                        break
                if not pdf_b64:
                    srcs = p.evaluate("""() => {
                        const r=[]; document.querySelectorAll('iframe,embed,object')
                        .forEach(e=>{const s=e.src||e.data||''; if(s.startsWith('data:application/pdf'))r.push(s);});
                        return r;}""")
                    if srcs:
                        pdf_b64 = srcs[0].split(",", 1)[1]
                if pdf_b64:
                    break
                p.wait_for_timeout(3000)
            if not pdf_b64:
                raise SiiError("La TGR no mostró el certificado PDF.")
            pdf_bytes = base64.b64decode(pdf_b64)
            return parsear_pdf_tgr(pdf_bytes), pdf_bytes
        finally:
            try:
                auth.cerrar_sesion()
            except Exception:
                pass
            b.close()
