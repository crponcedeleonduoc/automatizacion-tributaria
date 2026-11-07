"""Parseo del CSV que entrega el SII para el Registro de Compras y Ventas.

El parser es el punto donde los datos del portal entran al sistema. Si pierde
una columna o normaliza mal un monto, el error se propaga a la base de datos,
a las alertas y a los reportes.
"""
from __future__ import annotations

from worker.sii_core.rcv import parsear_csv_rcv

CABECERA = ("Nro;Tipo Doc;Tipo Compra;RUT Proveedor;Razon Social;Folio;"
            "Fecha Docto;Fecha Recepcion;Acuse Recibo;Fecha Acuse;"
            "Monto Exento;Monto Neto;Monto IVA Recuperable;Monto Total")

CSV = CABECERA + "\n" + "\n".join([
    "1;33;Del Giro;77218696-7;PROVEEDOR UNO SPA;1810;14/10/2026;14/10/2026;;;"
    "0;2.029.640;385.632;2.415.272",
    "2;33;Del Giro;11111111-1;PROVEEDOR DOS LTDA;1809;13/10/2026;13/10/2026;;;"
    "0;1.278.727;242.958;1.521.685",
    "3;61;Del Giro;20347623-k;PROVEEDOR TRES S.A.;55;12/10/2026;12/10/2026;;;"
    "0;-100.000;-19.000;-119.000",
])


def test_devuelve_una_fila_por_documento():
    assert len(parsear_csv_rcv(CSV)) == 3


def test_extrae_los_campos_mapeados():
    d = parsear_csv_rcv(CSV)[0]
    assert d["tipo_doc"] == "33"
    assert d["folio"] == "1810"
    assert d["rut_contraparte"] == "77218696-7"
    assert d["razon_social"] == "PROVEEDOR UNO SPA"
    assert d["fecha_emision"] == "14/10/2026"


def test_los_montos_quedan_como_enteros():
    d = parsear_csv_rcv(CSV)[0]
    assert d["monto_neto"] == 2029640
    assert d["monto_iva"] == 385632
    assert d["monto_total"] == 2415272
    assert d["monto_exento"] == 0
    assert all(isinstance(d[k], int) for k in d if k.startswith("monto"))


def test_acepta_montos_negativos_de_las_notas_de_credito():
    d = parsear_csv_rcv(CSV)[2]
    assert d["tipo_doc"] == "61"
    assert d["monto_total"] == -119000


def test_normaliza_el_dv_a_mayuscula():
    assert parsear_csv_rcv(CSV)[2]["rut_contraparte"] == "20347623-K"


def test_conserva_la_fila_original_completa():
    """Si el SII agrega una columna, no se pierde: queda en `fila`."""
    d = parsear_csv_rcv(CSV)[0]
    assert d["fila"]["Tipo Compra"] == "Del Giro"
    assert d["fila"]["Nro"] == "1"


def test_tolera_una_columna_nueva_del_sii():
    csv_nuevo = CSV.replace(CABECERA, CABECERA + ";Columna Nueva")
    csv_nuevo = "\n".join(
        l if i == 0 else l + ";valor" for i, l in enumerate(csv_nuevo.split("\n")))
    filas = parsear_csv_rcv(csv_nuevo)
    assert len(filas) == 3
    assert filas[0]["fila"]["Columna Nueva"] == "valor"
    assert filas[0]["monto_total"] == 2415272


def test_csv_vacio_devuelve_lista_vacia():
    assert parsear_csv_rcv("") == []
    assert parsear_csv_rcv("   \n  ") == []


def test_solo_cabecera_devuelve_lista_vacia():
    assert parsear_csv_rcv(CABECERA) == []


def test_ignora_filas_en_blanco():
    assert len(parsear_csv_rcv(CSV + "\n;;;;;;;;;;;;;\n")) == 3


def test_tolera_el_bom_del_archivo_descargado():
    """El CSV del portal viene con marca de orden de bytes."""
    assert len(parsear_csv_rcv("﻿" + CSV)) == 3


def test_tolera_cabeceras_con_espacios_y_mayusculas():
    otra = CABECERA.replace("RUT Proveedor", "  rut proveedor  ")
    assert parsear_csv_rcv(otra + "\n" + CSV.split("\n", 1)[1])[0]["rut_contraparte"] \
        == "77218696-7"


def test_sirve_tambien_para_el_csv_de_ventas():
    """En ventas la contraparte es el cliente, no el proveedor."""
    ventas = CSV.replace("RUT Proveedor", "RUT Cliente")
    assert parsear_csv_rcv(ventas)[0]["rut_contraparte"] == "77218696-7"
