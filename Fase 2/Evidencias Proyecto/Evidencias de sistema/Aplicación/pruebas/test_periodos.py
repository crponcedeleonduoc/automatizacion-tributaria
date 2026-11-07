"""Aritmética de períodos tributarios (AAAAMM) y normalización de montos."""
from __future__ import annotations

import pytest

from worker.sii_core.utils import a_entero, periodo_anterior, periodos


def test_periodos_dentro_del_mismo_ano():
    assert periodos("202601", "202604") == ["202601", "202602", "202603", "202604"]


def test_periodos_cruzando_el_cambio_de_ano():
    assert periodos("202511", "202602") == ["202511", "202512", "202601", "202602"]


def test_periodos_de_un_solo_mes():
    assert periodos("202610", "202610") == ["202610"]


def test_periodos_rango_invertido_devuelve_vacio():
    assert periodos("202610", "202601") == []


def test_periodos_rango_largo_tiene_el_largo_esperado():
    # el panel ofrece descargar hasta 22 meses en un solo ZIP
    assert len(periodos("202501", "202610")) == 22


def test_periodo_anterior_retrocede_un_mes():
    assert periodo_anterior("202610") == "202609"


def test_periodo_anterior_cruza_el_ano():
    assert periodo_anterior("202601") == "202512"


@pytest.mark.parametrize("entrada,esperado", [
    ("$1.234.567", 1234567),
    ("1.234.567", 1234567),
    ("6.290.975", 6290975),
    ("-5.000", -5000),
    ("0", 0),
    ("", 0),
    (None, 0),
    ("sin monto", 0),
    (47251802, 47251802),
])
def test_a_entero_normaliza_los_montos_del_csv(entrada, esperado):
    assert a_entero(entrada) == esperado
