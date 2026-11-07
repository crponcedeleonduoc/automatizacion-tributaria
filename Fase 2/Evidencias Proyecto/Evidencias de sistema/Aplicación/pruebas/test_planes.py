"""Reglas de negocio de los planes comerciales.

La frecuencia efectiva de consulta es lo que define cuánta carga recibe el
SII. Si un usuario pudiera elegir una frecuencia menor que la de su plan, el
sistema consultaría el portal más seguido de lo comprometido.
"""
from __future__ import annotations

import pytest

from comun.planes import (FRECUENCIA_MINIMA_NAVEGADOR_MIN, FRECUENCIAS_RCV,
                          PLANES, frecuencia_rcv, plan)


@pytest.mark.parametrize("codigo", sorted(PLANES))
def test_cada_plan_declara_su_propio_codigo(codigo):
    assert PLANES[codigo].codigo == codigo


@pytest.mark.parametrize("codigo", sorted(PLANES))
def test_todos_los_planes_incluyen_el_rcv(codigo):
    assert "rcv" in PLANES[codigo].documentos


@pytest.mark.parametrize("codigo", sorted(PLANES))
def test_ningun_plan_arranca_mas_rapido_de_lo_que_permite(codigo):
    p = PLANES[codigo]
    assert p.frecuencia_defecto >= p.frecuencia_minutos


def test_plan_desconocido_cae_al_gratis():
    assert plan("inexistente").codigo == "gratis"
    assert plan("").codigo == "gratis"


def test_coherencia_comercial_mas_caro_no_es_peor():
    ordenados = sorted(PLANES.values(), key=lambda p: p.precio_clp)
    for antes, despues in zip(ordenados, ordenados[1:]):
        assert despues.max_ruts >= antes.max_ruts
        assert despues.frecuencia_minutos <= antes.frecuencia_minutos


def test_el_plan_gratis_no_envia_correos():
    assert PLANES["gratis"].alertas_correo is False


def test_el_plan_gratis_solo_permite_una_consulta_diaria():
    assert PLANES["gratis"].frecuencia_minutos == 24 * 60


def test_frecuencia_elegida_se_respeta_cuando_el_plan_la_permite():
    assert frecuencia_rcv("contador", 30) == 30


def test_frecuencia_elegida_se_eleva_al_minimo_del_plan():
    """Pyme no puede consultar cada 10 minutos aunque lo elija."""
    assert frecuencia_rcv("pyme", 10) == 60


def test_el_gratis_queda_en_una_vez_al_dia_elija_lo_que_elija():
    for elegida in FRECUENCIAS_RCV:
        assert frecuencia_rcv("gratis", elegida) == 24 * 60


def test_sin_eleccion_se_usa_la_frecuencia_por_defecto():
    assert frecuencia_rcv("contador", None) == PLANES["contador"].frecuencia_defecto


def test_una_frecuencia_fuera_del_catalogo_se_ignora():
    assert frecuencia_rcv("contador", 7) == PLANES["contador"].frecuencia_defecto


def test_bajar_de_plan_reajusta_la_frecuencia_sola():
    """Si el usuario tenía 10 min con Contador y pasa a Pyme, sube a 60."""
    assert frecuencia_rcv("pyme", 10) == 60
    assert frecuencia_rcv("gratis", 10) == 24 * 60


def test_el_tgr_y_el_f29_estan_acotados_a_una_vez_al_dia():
    assert FRECUENCIA_MINIMA_NAVEGADOR_MIN == 24 * 60
    for codigo in PLANES:
        assert FRECUENCIA_MINIMA_NAVEGADOR_MIN >= PLANES[codigo].frecuencia_minutos


def test_las_frecuencias_del_panel_estan_ordenadas():
    assert list(FRECUENCIAS_RCV) == sorted(FRECUENCIAS_RCV)
