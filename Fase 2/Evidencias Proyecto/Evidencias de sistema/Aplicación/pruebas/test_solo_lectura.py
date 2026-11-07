"""Garantía de solo lectura del cliente del SII.

El sistema opera con credenciales tributarias de terceros. Una operación de
escritura contra el portal sería una falta grave, así que el cliente bloquea
por nombre cualquier método que parezca mutación y además exige que el método
esté declarado de antemano.
"""
from __future__ import annotations

import pytest

from worker.sii_core.errores import OperacionNoPermitida
from worker.sii_core.rcv import PREFIJOS_ESCRITURA, _assert_lectura

DECLARADOS = {"getResumen", "getDetalle", "getDetalleCompra"}


@pytest.mark.parametrize("metodo", sorted(DECLARADOS))
def test_deja_pasar_los_metodos_de_lectura_declarados(metodo):
    _assert_lectura(metodo, DECLARADOS)


@pytest.mark.parametrize("metodo", [
    "setEstado", "postDocumento", "deleteFolio", "reclamaDocumento",
    "aceptaDocumento", "declaraF29", "emiteBoleta", "pagarDeuda",
    "actualizaDatos", "anulaDocumento", "cedeFactura", "uploadArchivo",
])
def test_bloquea_cualquier_metodo_que_parezca_escritura(metodo):
    with pytest.raises(OperacionNoPermitida):
        _assert_lectura(metodo, DECLARADOS | {metodo})


def test_bloquea_escritura_aunque_este_declarado():
    """El nombre manda: aunque alguien lo agregue al registro, no pasa."""
    with pytest.raises(OperacionNoPermitida):
        _assert_lectura("setEstado", {"setEstado"})


def test_bloquea_un_metodo_de_lectura_no_declarado():
    with pytest.raises(OperacionNoPermitida) as e:
        _assert_lectura("getOtraCosa", DECLARADOS)
    assert "no está declarado" in str(e.value)


def test_la_deteccion_no_distingue_mayusculas():
    with pytest.raises(OperacionNoPermitida):
        _assert_lectura("SetEstado", DECLARADOS | {"SetEstado"})


def test_la_lista_de_prefijos_cubre_los_verbos_criticos():
    for verbo in ("set", "post", "delete", "declara", "paga", "reclama", "cede"):
        assert verbo in PREFIJOS_ESCRITURA
