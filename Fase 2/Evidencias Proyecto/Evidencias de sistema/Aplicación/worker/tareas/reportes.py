"""Generación de reportes PDF: arma los datos según la plantilla, renderiza
HTML (Jinja2) y lo imprime a PDF con el Chromium de Playwright.

Bloques disponibles (comun/reportes.py): resumen, tgr, f29, rcv.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy import func, select

from comun.modelos import (Empresa, F29Estado, F29Gestion, RcvDocumento,
                           ReporteGenerado, TgrCertificado, Usuario)
from comun.reportes import BLOQUES, normalizar_config

from .base import db, relativa, ruta_datos

PLANTILLAS = Path(__file__).parent / "plantillas"
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def clp(n) -> str:
    if n is None:
        return "—"
    return "$" + f"{int(n):,}".replace(",", ".")


def periodo_legible(p: str) -> str:
    try:
        return f"{MESES[int(p[4:]) - 1]}-{p[2:4]}"
    except Exception:
        return p


def _rango(cfg: dict) -> tuple[str, str]:
    per = cfg.get("periodo") or {}
    hoy = date.today()
    hasta = f"{hoy.year}{hoy.month:02d}"
    if per.get("modo") == "rango":
        return per.get("desde", "200001"), per.get("hasta", hasta)
    if per.get("modo") == "ultimos_meses":
        n = int(per.get("meses", 12))
        a, m = hoy.year, hoy.month - (n - 1)
        while m <= 0:
            m += 12
            a -= 1
        return f"{a}{m:02d}", hasta
    return "200001", hasta


def _datos_tgr(s, eid) -> dict | None:
    c = s.execute(select(TgrCertificado).where(TgrCertificado.empresa_id == eid)
                  .order_by(TgrCertificado.creado.desc()).limit(1)).scalar_one_or_none()
    if not c:
        return None
    return {"fecha_emision": c.fecha_emision, "consultado": c.creado,
            "total_morosa": c.total_morosa, "total_no_vencida": c.total_no_vencida,
            "lineas": c.lineas or []}


def _datos_f29(s, eid, desde: str, hasta: str, incluir: list[str]) -> list[dict]:
    estados = s.execute(select(F29Estado).where(
        F29Estado.empresa_id == eid, F29Estado.estado.in_(incluir),
        F29Estado.periodo >= desde, F29Estado.periodo <= hasta)
        .order_by(F29Estado.periodo)).scalars().all()
    gest = {g.periodo: g for g in s.execute(
        select(F29Gestion).where(F29Gestion.empresa_id == eid)).scalars()}
    # base estimada = IVA de compras del período (criterio del panel original)
    iva_compras = dict(s.execute(
        select(RcvDocumento.periodo, func.sum(RcvDocumento.monto_iva))
        .where(RcvDocumento.empresa_id == eid, RcvDocumento.operacion == "COMPRA",
               RcvDocumento.estado_contab == "REGISTRO")
        .group_by(RcvDocumento.periodo)).all())
    filas = []
    for f in estados:
        g = gest.get(f.periodo)
        monto = g.monto if (g and g.monto is not None) else int(iva_compras.get(f.periodo) or 0)
        filas.append({
            "periodo": periodo_legible(f.periodo), "periodo_raw": f.periodo,
            "folio": f.folio or "", "tipo": "ND" if f.estado == "no_declarado" else "OBS",
            "codigo_obs": "ND" if f.estado == "no_declarado" else "",
            "descripcion": (g.estado if g else "Abierta"),
            "monto": monto, "monto_multa": g.monto_multa if g else None,
            "fuente_multa": g.fuente_multa if g else None,
            "estado": g.estado if g else "Abierta",
            "prioridad": g.prioridad if g else "Alta",
            "accion": g.accion if g else "Calcular y Declarar",
            "fecha_compromiso": (g.fecha_compromiso if g else "") or "",
            "fecha_cierre": (g.fecha_cierre if g else "") or "",
            "comentario": (g.comentario if g else "") or "",
        })
    return filas


def _datos_rcv(s, eid, desde: str, hasta: str, operacion: str) -> list[dict]:
    q = select(RcvDocumento).where(RcvDocumento.empresa_id == eid,
                                   RcvDocumento.periodo >= desde, RcvDocumento.periodo <= hasta)
    if operacion in ("COMPRA", "VENTA"):
        q = q.where(RcvDocumento.operacion == operacion)
    docs = s.execute(q.order_by(RcvDocumento.periodo, RcvDocumento.operacion,
                                RcvDocumento.fecha_emision).limit(3000)).scalars().all()
    est = {"REGISTRO": "Aceptada", "PENDIENTE": "Pendiente", "RECLAMADO": "Reclamada",
           "NO_INCLUIR": "No incluir"}
    return [{"periodo": periodo_legible(d.periodo), "operacion": d.operacion.title(),
             "tipo_doc": d.tipo_doc, "folio": d.folio, "rut_contraparte": d.rut_contraparte,
             "razon_social": d.razon_social, "fecha_emision": d.fecha_emision or "",
             "neto": d.monto_neto, "iva": d.monto_iva, "total": d.monto_total,
             "estado": est.get(d.estado_contab, d.estado_contab)} for d in docs]


def armar_contexto(s, r: ReporteGenerado) -> dict:
    cfg = normalizar_config(r.config)
    emp = s.get(Empresa, r.empresa_id)
    usr = s.get(Usuario, r.usuario_id)
    desde, hasta = _rango(cfg)
    b = cfg["bloques"]

    tgr = _datos_tgr(s, emp.id) if b["tgr"]["activo"] or b["resumen"]["activo"] else None
    f29 = (_datos_f29(s, emp.id, desde, hasta, b["f29"].get("incluir", ["no_declarado", "observado"]))
           if b["f29"]["activo"] or b["resumen"]["activo"] else [])
    rcv = _datos_rcv(s, emp.id, desde, hasta, b["rcv"].get("operacion", "AMBAS")) if b["rcv"]["activo"] else []

    total_tgr = tgr["total_morosa"] if tgr else 0
    f29_con_multa = [x["monto_multa"] for x in f29 if x["monto_multa"] is not None]
    f29_base = sum(x["monto"] or 0 for x in f29)
    total_f29 = sum(f29_con_multa) + sum(x["monto"] or 0 for x in f29 if x["monto_multa"] is None)
    resumen = {
        "tgr": total_tgr,
        "f29_nd": total_f29,
        "f29_base": f29_base,
        "f29_faltan_multa": sum(1 for x in f29 if x["monto_multa"] is None),
        "total": total_tgr + total_f29,
        "n_f29": len(f29),
    }
    return {
        "cfg": cfg, "bloques": BLOQUES, "empresa": emp, "usuario": usr,
        "desde": periodo_legible(desde) if desde != "200001" else "inicio",
        "hasta": periodo_legible(hasta), "desde_raw": desde, "hasta_raw": hasta,
        "generado": datetime.now().strftime("%d-%m-%Y %H:%M"),
        "tgr": tgr, "f29": f29, "rcv": rcv, "resumen": resumen, "clp": clp,
    }


def renderizar_html(ctx: dict) -> str:
    env = Environment(loader=FileSystemLoader(str(PLANTILLAS)),
                      autoescape=select_autoescape(["html"]))
    env.filters["clp"] = clp
    return env.get_template("reporte.html").render(**ctx)


def html_a_pdf(html: str, destino: Path) -> None:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        p = b.new_page()
        p.set_content(html, wait_until="load")
        p.emulate_media(media="print")
        p.pdf(path=str(destino), format="Letter", print_background=True,
              margin={"top": "14mm", "bottom": "16mm", "left": "12mm", "right": "12mm"},
              display_header_footer=True,
              header_template="<div></div>",
              footer_template=("<div style='width:100%;font-size:8px;color:#7A839A;"
                               "font-family:sans-serif;padding:0 12mm;display:flex;"
                               "justify-content:space-between'><span>aSIIstente · servicio "
                               "privado independiente, sin afiliación con el SII ni la TGR</span>"
                               "<span>Página <span class='pageNumber'></span> de "
                               "<span class='totalPages'></span></span></div>"))
        b.close()


def generar_reporte(reporte_id: str) -> dict:
    rid = uuid.UUID(str(reporte_id))
    with db() as s:
        r = s.get(ReporteGenerado, rid)
        if not r:
            return {"error": "reporte inexistente"}
        r.estado = "corriendo"
    try:
        with db() as s:
            r = s.get(ReporteGenerado, rid)
            ctx = armar_contexto(s, r)
            html = renderizar_html(ctx)
            resumen = ctx["resumen"]
            desde, hasta = ctx["desde_raw"], ctx["hasta_raw"]
            eid = str(r.empresa_id)
        destino = ruta_datos("reportes", eid, f"{rid}.pdf")
        html_a_pdf(html, destino)
        with db() as s:
            r = s.get(ReporteGenerado, rid)
            r.estado = "ok"
            r.pdf = relativa(destino)
            r.desde, r.hasta = desde, hasta
            r.resumen = resumen
            r.terminado = datetime.now(timezone.utc)
        return {"ok": True, "pdf": relativa(destino), "resumen": resumen}
    except Exception as e:
        with db() as s:
            r = s.get(ReporteGenerado, rid)
            r.estado = "error"
            r.error = str(e)[:2000]
            r.terminado = datetime.now(timezone.utc)
        raise
