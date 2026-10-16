"""Formulario 29: matriz de estados + folio/codInt + PDF compacto.

Migrado de sii_f29_auto.py. El listado de folios del F29 vive en GWT-RPC
que no se replica por HTTP, así que se usa Playwright con login híbrido:
curl_cffi autentica (pasa Shape) y las cookies se inyectan al navegador.

Estados se leen por la firma MD5 del ícono de la celda (aprendidas contra
empresas de estado conocido). Si el SII cambia los íconos aparece
"desconocido:<hash>" y hay que agregar la firma nueva a FIRMAS.
"""

from __future__ import annotations

import hashlib
import re

from .auth import ClaveAuthTLS, UA
from .utils import split_rut

CONSULTA = "https://www4.sii.cl/sifmConsultaInternet/index.html?dest=cifxx&form=29"
FORM_COMPACTO = "https://www4.sii.cl/rfiInternet/formCompacto"
MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
         "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
FIRMAS = {
    "02b3dc50": "declarado",
    "95f8293d": "no_declarado",
    "74ca8779": "observado",
}


def capturar_f29(rut: str, clave: str, anno: str, con_pdf: bool = True,
                 headless: bool = False) -> dict[str, dict]:
    """{periodo: {estado, folio, cod_int, pdf(bytes|None)}} para un año."""
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

    cuerpo, dv = split_rut(rut)
    auth = ClaveAuthTLS(rut, clave)
    auth.login()
    cookies = auth.cookies_para_playwright()
    resultado: dict[str, dict] = {}

    with sync_playwright() as pw:
        b = pw.chromium.launch(
            headless=headless,
            args=["--disable-blink-features=AutomationControlled",
                  "--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(accept_downloads=True, user_agent=UA,
                            viewport={"width": 1440, "height": 900},
                            locale="es-CL")
        ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});"
            "window.chrome={runtime:{}};")
        ctx.add_cookies(cookies)
        p = ctx.new_page()
        p.set_default_timeout(30000)
        try:
            p.goto(CONSULTA)
            p.wait_for_load_state("domcontentloaded")
            p.wait_for_timeout(2500)
            _desplegar_anno(p, anno)
            p.wait_for_timeout(2500)
            estados = _leer_matriz(p)
            for mes_idx, estado in estados.items():
                periodo = f"{anno}{mes_idx:02d}"
                entrada = {"estado": estado, "folio": None, "cod_int": None,
                           "pdf": None}
                if estado == "declarado":
                    fc = _abrir_periodo(p, anno, mes_idx, PWTimeout)
                    if fc:
                        entrada["folio"], entrada["cod_int"] = fc
                        if con_pdf:
                            entrada["pdf"] = _descargar_pdf(p, cuerpo, *fc)
                resultado[periodo] = entrada
            return resultado
        finally:
            try:
                p.goto("https://misiir.sii.cl/cgi_misii/siilogout.cgi", timeout=15000)
            except Exception:
                pass
            try:
                auth.cerrar_sesion()
            except Exception:
                pass
            b.close()


def _desplegar_anno(p, anno: str) -> bool:
    """Clic en el conteo (enlace) bajo la columna del año."""
    try:
        filas = p.query_selector_all("table tr")
        for fila in filas:
            celdas = fila.query_selector_all("th, td")
            textos = [(c.inner_text() or "").strip() for c in celdas]
            if anno in textos:
                col = textos.index(anno)
                idx = filas.index(fila)
                for f2 in filas[idx:idx + 3]:
                    cs = f2.query_selector_all("th, td")
                    if col < len(cs):
                        link = cs[col].query_selector("a")
                        t = (cs[col].inner_text() or "").strip()
                        if link and t.isdigit():
                            link.click()
                            return True
        for a in p.query_selector_all("table a"):
            t = (a.inner_text() or "").strip()
            if t.isdigit() and 1 <= int(t) <= 12:
                a.click()
                return True
    except Exception:
        pass
    return False


def _leer_matriz(p) -> dict[int, str]:
    estados = {}
    for fila in p.query_selector_all("table tr"):
        celdas = fila.query_selector_all("th, td")
        textos = [(c.inner_text() or "").strip() for c in celdas]
        if not textos or textos[0] not in MESES:
            continue
        estados[MESES.index(textos[0]) + 1] = _estado_fila(celdas)
    return estados


def _estado_fila(celdas) -> str:
    for c in celdas[1:]:
        txt = (c.inner_text() or "").strip().upper()
        if txt == "ND":
            return "no_declarado"
        img = c.query_selector("img")
        if img:
            style = img.get_attribute("style") or ""
            m = re.search(r'url\(["\']?(data:[^)"\']+)', style)
            if m:
                h = hashlib.md5(m.group(1).encode()).hexdigest()[:8]
                return FIRMAS.get(h, f"desconocido:{h}")
            return "sin_dato"
        if txt == "-":
            return "sin_periodo"
    return "sin_periodo"


def _abrir_periodo(p, anno: str, mes_idx: int, PWTimeout):
    cap = {"folio": None, "cod": None}

    def on_req(req):
        if "formCompacto" in req.url:
            m_f = re.search(r"folio=(\d+)", req.url)
            m_c = re.search(r"codInt=(\d+)", req.url)
            if m_f:
                cap["folio"] = m_f.group(1)
            if m_c:
                cap["cod"] = m_c.group(1)

    p.on("request", on_req)
    try:
        p.click(f"text={MESES[mes_idx - 1]}", timeout=6000)
        p.wait_for_timeout(3000)
        with p.expect_popup(timeout=8000) as popup_info:
            p.click("text=Formulario Compacto", timeout=6000)
        popup = popup_info.value
        popup.wait_for_load_state("domcontentloaded", timeout=8000)
        popup.close()
    except PWTimeout:
        pass
    except Exception:
        pass
    finally:
        p.remove_listener("request", on_req)
        try:
            p.goto(CONSULTA)
            p.wait_for_timeout(1500)
            _desplegar_anno(p, anno)
            p.wait_for_timeout(2000)
        except Exception:
            pass
    return (cap["folio"], cap["cod"]) if cap["folio"] and cap["cod"] else None


def _descargar_pdf(p, cuerpo: str, folio: str, cod_int: str) -> bytes | None:
    url = f"{FORM_COMPACTO}?folio={folio}&rut={cuerpo}&form=029&codInt={cod_int}"
    try:
        resp = p.request.get(url, timeout=30000)
        body = resp.body()
        if body[:5] == b"%PDF-":
            return body
    except Exception:
        pass
    return None
