"""Envío de correos (SMTP) y plantillas HTML de aSIIstente.

Todo correo pasa por `enviar()`. Si SMTP no está configurado (local sin .env
de correo) no falla: registra en el log y devuelve False, así el sistema sigue
funcionando y las alertas quedan visibles en el panel.
"""

from __future__ import annotations

import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from .config import config

log = logging.getLogger("correo")

AZUL = "#0047BB"
NARANJA = "#FF8C42"


def smtp_configurado() -> bool:
    c = config()
    return bool(c.smtp_host and c.smtp_from)


def enviar(para: str, asunto: str, html_cuerpo: str, texto: str | None = None) -> bool:
    """Envía un correo. Devuelve True si salió, False si no hay SMTP o falló."""
    c = config()
    if not smtp_configurado():
        log.warning("SMTP no configurado; no se envía «%s» a %s", asunto, para)
        return False
    msg = EmailMessage()
    msg["From"] = formataddr(("aSIIstente", c.smtp_from))
    msg["To"] = para
    msg["Subject"] = asunto
    msg.set_content(texto or _a_texto(html_cuerpo))
    msg.add_alternative(html_cuerpo, subtype="html")
    try:
        if c.smtp_port == 465:
            with smtplib.SMTP_SSL(c.smtp_host, c.smtp_port, timeout=20,
                                  context=ssl.create_default_context()) as s:
                if c.smtp_user:
                    s.login(c.smtp_user, c.smtp_password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(c.smtp_host, c.smtp_port, timeout=20) as s:
                s.ehlo()
                try:
                    s.starttls(context=ssl.create_default_context())
                    s.ehlo()
                except smtplib.SMTPNotSupportedError:
                    pass
                if c.smtp_user:
                    s.login(c.smtp_user, c.smtp_password)
                s.send_message(msg)
        log.info("correo enviado a %s: %s", para, asunto)
        return True
    except Exception as e:                       # noqa: BLE001
        log.error("fallo enviando correo a %s (%s): %s", para, asunto, e)
        return False


def _a_texto(h: str) -> str:
    import re
    t = re.sub(r"<style.*?</style>", "", h, flags=re.S)
    t = re.sub(r"<br\s*/?>", "\n", t)
    t = re.sub(r"<div[^>]*>", "\n", t)
    t = re.sub(r"</(p|div|tr|h\d|li)>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    return html.unescape(re.sub(r"\n{3,}", "\n\n", t)).strip()


# ---------------------------------------------------------------------------
# Plantillas
# ---------------------------------------------------------------------------

def plantilla(titulo: str, cuerpo: str, boton: tuple[str, str] | None = None,
              pie: str = "") -> str:
    """Marco común: cabecera azul con la marca, cuerpo, botón opcional y pie legal."""
    c = config()
    btn = ""
    if boton:
        btn = (f'<p style="margin:26px 0 8px"><a href="{html.escape(boton[1])}" '
               f'style="background:{AZUL};color:#fff;text-decoration:none;font-weight:700;'
               f'padding:13px 24px;border-radius:10px;display:inline-block;font-size:15px">'
               f'{html.escape(boton[0])}</a></p>')
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F4F6FA;font-family:Manrope,'Segoe UI',Arial,sans-serif;color:#0F1B33">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F6FA;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E6E9F0">
  <tr><td style="background:{AZUL};padding:18px 28px">
    <span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.03em">a<span style="color:{NARANJA}">SII</span>stente</span>
  </td></tr>
  <tr><td style="padding:28px 28px 8px">
    <h1 style="margin:0 0 14px;font-size:22px;letter-spacing:-0.02em;color:{AZUL}">{html.escape(titulo)}</h1>
    <div style="font-size:15px;line-height:1.55">{cuerpo}</div>
    {btn}
  </td></tr>
  <tr><td style="padding:16px 28px 24px;font-size:12px;color:#7A839A;line-height:1.5;border-top:1px solid #E6E9F0">
    {pie or ""}
    aSIIstente es un servicio privado independiente, sin afiliación con el SII ni la Tesorería General de la República.
    Puedes administrar tus avisos por correo en <a href="{html.escape(c.url_web)}/panel/cuenta" style="color:{AZUL}">Configuración</a>.
  </td></tr>
</table>
</td></tr></table></body></html>"""


def correo_bienvenida(nombre: str) -> tuple[str, str]:
    c = config()
    n = html.escape(nombre.split(" ")[0]) if nombre else "hola"
    cuerpo = (f"<p>{n.capitalize() if nombre else 'Hola'}, tu cuenta ya está creada.</p>"
              "<p>Desde el panel puedes conectar tus RUT, ver el RCV, la deuda TGR y el estado "
              "de los F29, programar cada cuánto se consulta el SII y descargar todo en CSV, "
              "ZIP o PDF.</p>"
              "<p>Cuando algo cambie en tu cartera —una factura reclamada, una deuda que sube, "
              "un F29 vencido sin declarar— te lo avisamos a este correo.</p>")
    return ("Bienvenido a aSIIstente",
            plantilla("Tu cuenta está lista", cuerpo, ("Ir a mi panel", f"{c.url_web}/panel")))


def correo_restablecer(url: str) -> tuple[str, str]:
    cuerpo = ("<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>"
              "<p>El enlace vale por <b>1 hora</b> y se puede usar una sola vez. Si no fuiste tú, "
              "ignora este correo: tu contraseña no cambia.</p>")
    return ("Restablecer tu contraseña de aSIIstente",
            plantilla("Restablecer contraseña", cuerpo, ("Crear nueva contraseña", url),
                      pie=f'Si el botón no funciona, copia este enlace: <span style="word-break:break-all">{html.escape(url)}</span><br><br>'))


ICONO = {"factura_reclamada": "⚠️", "deuda_tgr": "🔴", "deuda_tgr_subio": "🔴",
         "f29_no_declarado": "📄", "f29_observado": "📄", "credencial_invalida": "🔑"}


def correo_alertas(nombre: str, por_empresa: dict[str, list]) -> tuple[str, str]:
    """`por_empresa`: {"77223144-K · Global Steel": [Alerta, ...]}"""
    c = config()
    n = sum(len(v) for v in por_empresa.values())
    partes = []
    for cab, alertas in por_empresa.items():
        filas = "".join(
            f'<tr><td style="padding:7px 0;border-bottom:1px solid #EEF1F6;font-size:14px">'
            f'{ICONO.get(a.tipo, "•")}&nbsp; {html.escape(a.titulo)}'
            f'<div style="font-size:12px;color:#7A839A">{_detalle(a)}</div></td></tr>'
            for a in alertas)
        partes.append(f'<p style="margin:18px 0 4px;font-weight:800;color:{AZUL}">{html.escape(cab)}</p>'
                      f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0">{filas}</table>')
    cuerpo = (f"<p>{html.escape(nombre.split(' ')[0]) if nombre else 'Hola'}, aSIIstente detectó "
              f"<b>{n} novedad{'es' if n != 1 else ''}</b> en tu cartera:</p>" + "".join(partes))
    asunto = (f"{n} novedad{'es' if n != 1 else ''} en tu cartera"
              if n > 1 else next(iter(por_empresa.values()))[0].titulo)
    return (f"aSIIstente · {asunto}",
            plantilla("Novedades en tu cartera", cuerpo, ("Ver en el panel", f"{c.url_web}/panel/alertas")))


def _detalle(a) -> str:
    d = a.detalle or {}
    partes = []
    if d.get("periodo"):
        p = str(d["periodo"])
        partes.append(f"período {p[4:]}-{p[:4]}" if len(p) == 6 else p)
    if d.get("total") is not None:
        partes.append(f"${int(d['total']):,}".replace(",", "."))
    if d.get("total_morosa") is not None:
        partes.append(f"deuda morosa ${int(d['total_morosa']):,}".replace(",", "."))
    if d.get("error"):
        partes.append(str(d["error"])[:120])
    return html.escape(" · ".join(partes))


def correo_prueba() -> tuple[str, str]:
    cuerpo = ("<p>Este es un correo de prueba enviado desde el panel de administración.</p>"
              "<p>Si lo estás leyendo, el SMTP quedó bien configurado y las alertas "
              "llegarán a tus usuarios.</p>")
    return ("aSIIstente · correo de prueba", plantilla("SMTP funcionando", cuerpo))
