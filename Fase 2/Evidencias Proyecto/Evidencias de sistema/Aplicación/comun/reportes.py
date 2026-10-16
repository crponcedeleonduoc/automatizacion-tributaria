"""Catálogo de bloques y columnas de los reportes, compartido por API y worker.

La plantilla del usuario es un JSON con esta forma:

{
  "titulo": "Reporte de deudas",
  "periodo": {"modo": "ultimos_meses", "meses": 24}      # o {"modo":"rango","desde":"202101","hasta":"202609"} o {"modo":"todo"}
  "bloques": {
    "resumen": {"activo": true},
    "tgr":     {"activo": true, "columnas": ["formulario","folio","vencimiento","neta","multa","total"]},
    "f29":     {"activo": true, "columnas": [...], "incluir": ["no_declarado","observado"]},
    "rcv":     {"activo": false, "columnas": [...], "operacion": "AMBAS"}
  },
  "notas": "texto libre al final"
}
"""

from __future__ import annotations

BLOQUES: dict[str, dict] = {
    "resumen": {
        "nombre": "Resumen de deuda",
        "descripcion": "Tabla con el total por fuente (TGR, F29 no declarados) y el gran total.",
        "columnas": {},
    },
    "tgr": {
        "nombre": "Deuda TGR (certificado)",
        "descripcion": "Giros del último certificado de Tesorería.",
        "columnas": {
            "formulario": "Formulario",
            "tipo": "Tipo",
            "folio": "Folio",
            "vencimiento": "Fecha vcto.",
            "neta": "Deuda neta",
            "reajuste": "Reajuste",
            "interes": "Interés",
            "multa": "Multa",
            "total": "Total",
        },
    },
    "f29": {
        "nombre": "F29 no declarados / observados",
        "descripcion": "Períodos con F29 sin declarar u observado, con seguimiento.",
        "columnas": {
            "periodo": "Período",
            "folio": "Folio",
            "tipo": "Tipo",
            "codigo_obs": "Código obs.",
            "descripcion": "Descripción",
            "monto": "Monto",
            "monto_multa": "Monto con multa",
            "estado": "Estado",
            "prioridad": "Prioridad",
            "accion": "Acción",
            "fecha_compromiso": "Fecha compromiso",
            "fecha_cierre": "Fecha cierre",
            "comentario": "Comentario",
        },
    },
    "rcv": {
        "nombre": "Movimientos RCV",
        "descripcion": "Documentos de compra y venta del período (útil como respaldo).",
        "columnas": {
            "periodo": "Período",
            "operacion": "Operación",
            "tipo_doc": "Tipo doc.",
            "folio": "Folio",
            "rut_contraparte": "RUT",
            "razon_social": "Razón social",
            "fecha_emision": "Fecha",
            "neto": "Neto",
            "iva": "IVA",
            "total": "Total",
            "estado": "Estado",
        },
    },
}

PLANTILLA_DEFECTO: dict = {
    "titulo": "Reporte de deudas",
    "periodo": {"modo": "todo"},
    "bloques": {
        "resumen": {"activo": True},
        "tgr": {"activo": True,
                "columnas": ["formulario", "tipo", "folio", "vencimiento", "neta",
                             "reajuste", "interes", "multa", "total"]},
        "f29": {"activo": True,
                "columnas": ["periodo", "folio", "tipo", "codigo_obs", "descripcion",
                             "monto", "monto_multa", "estado", "prioridad", "accion",
                             "fecha_compromiso", "fecha_cierre", "comentario"],
                "incluir": ["no_declarado", "observado"]},
        "rcv": {"activo": False, "columnas": ["periodo", "operacion", "tipo_doc", "folio",
                                              "razon_social", "total", "estado"],
                "operacion": "AMBAS"},
    },
    "notas": "",
}


def normalizar_config(cfg: dict | None) -> dict:
    """Valida y completa una configuración de plantilla contra el catálogo."""
    base = {k: (dict(v) if isinstance(v, dict) else v) for k, v in PLANTILLA_DEFECTO.items()}
    base["bloques"] = {k: dict(v) for k, v in PLANTILLA_DEFECTO["bloques"].items()}
    cfg = cfg or {}
    base["titulo"] = str(cfg.get("titulo") or base["titulo"])[:120]
    base["notas"] = str(cfg.get("notas") or "")[:4000]

    per = cfg.get("periodo") or {}
    modo = per.get("modo") if per.get("modo") in ("todo", "rango", "ultimos_meses") else "todo"
    base["periodo"] = {"modo": modo}
    if modo == "rango":
        base["periodo"]["desde"] = str(per.get("desde") or "200001")[:6]
        base["periodo"]["hasta"] = str(per.get("hasta") or "299912")[:6]
    elif modo == "ultimos_meses":
        base["periodo"]["meses"] = max(1, min(120, int(per.get("meses") or 12)))

    for clave, bloque in (cfg.get("bloques") or {}).items():
        if clave not in BLOQUES or not isinstance(bloque, dict):
            continue
        dest = base["bloques"][clave]
        dest["activo"] = bool(bloque.get("activo", dest.get("activo", True)))
        catalogo = BLOQUES[clave]["columnas"]
        if catalogo and isinstance(bloque.get("columnas"), list):
            cols = [c for c in bloque["columnas"] if c in catalogo]
            if cols:
                dest["columnas"] = cols
        if clave == "f29" and isinstance(bloque.get("incluir"), list):
            inc = [e for e in bloque["incluir"] if e in ("no_declarado", "observado")]
            dest["incluir"] = inc or ["no_declarado", "observado"]
        if clave == "rcv" and bloque.get("operacion") in ("COMPRA", "VENTA", "AMBAS"):
            dest["operacion"] = bloque["operacion"]
    return base
