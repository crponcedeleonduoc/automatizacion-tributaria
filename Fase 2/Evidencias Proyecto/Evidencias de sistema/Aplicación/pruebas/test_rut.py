"""Validación y normalización de RUT.

Un RUT mal validado deja entrar un contribuyente que el SII va a rechazar
después, ya con la clave guardada. Por eso se valida antes de persistir.
"""
from __future__ import annotations

import pytest

from worker.sii_core.errores import SiiError
from worker.sii_core.utils import dv_valido, formatear_rut, split_rut

VALIDOS = ["77218696-7", "11111111-1", "12345678-5", "20347623-K", "12345675-0"]


@pytest.mark.parametrize("rut", VALIDOS)
def test_dv_valido_acepta_ruts_correctos(rut):
    assert dv_valido(rut) is True


@pytest.mark.parametrize("rut", ["77218696-8", "11111111-9", "12345678-0", "20347623-1"])
def test_dv_valido_rechaza_digito_equivocado(rut):
    assert dv_valido(rut) is False


@pytest.mark.parametrize("entrada", ["77.218.696-7", "77218696-7", "77218696 7", "77218696k7"[:9]])
def test_split_rut_ignora_puntos_guiones_y_espacios(entrada):
    cuerpo, dv = split_rut(entrada)
    assert cuerpo.isdigit()
    assert dv in "0123456789K"


def test_split_rut_normaliza_k_minuscula():
    assert split_rut("20347623-k") == ("20347623", "K")


def test_dv_valido_acepta_k_minuscula():
    assert dv_valido("20347623-k") is True


@pytest.mark.parametrize("entrada", ["", "7", "-", "abc"])
def test_split_rut_rechaza_entradas_demasiado_cortas(entrada):
    with pytest.raises(SiiError):
        split_rut(entrada)


@pytest.mark.parametrize("entrada", ["", "7", "-", "abc", None])
def test_dv_valido_devuelve_falso_en_vez_de_reventar(entrada):
    assert dv_valido(entrada) is False


def test_formatear_rut_entrega_el_formato_canonico():
    assert formatear_rut("77.218.696-7") == "77218696-7"
    assert formatear_rut("77218696-7") == "77218696-7"


def test_formatear_rut_es_idempotente():
    una_vez = formatear_rut("77.218.696-7")
    assert formatear_rut(una_vez) == una_vez
