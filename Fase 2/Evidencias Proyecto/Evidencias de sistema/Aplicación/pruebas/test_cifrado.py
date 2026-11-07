"""Cifrado de claves tributarias en reposo.

Es el requisito no funcional más sensible del sistema: las claves del SII de
un contribuyente nunca pueden quedar en texto plano, ni ser recuperables si
se filtra la base de datos sin la llave de la aplicación.
"""
from __future__ import annotations

import importlib

import pytest
from cryptography.fernet import Fernet

import comun.cifrado as cifrado_mod
import comun.config as config_mod


def _con_llave(monkeypatch, llave: str):
    """Recarga el módulo de configuración con la llave indicada."""
    monkeypatch.setenv("CREDENCIALES_KEY", llave)
    config_mod.config.cache_clear()
    return importlib.reload(cifrado_mod)


def test_el_ciclo_cifrar_descifrar_devuelve_la_clave_original(monkeypatch):
    c = _con_llave(monkeypatch, Fernet.generate_key().decode())
    secreto = "ClaveTributaria.2026"
    assert c.descifrar(c.cifrar(secreto)) == secreto


def test_el_texto_cifrado_no_contiene_la_clave(monkeypatch):
    c = _con_llave(monkeypatch, Fernet.generate_key().decode())
    secreto = "ClaveTributaria.2026"
    assert secreto not in c.cifrar(secreto)


def test_dos_cifrados_de_la_misma_clave_son_distintos(monkeypatch):
    """Fernet incluye un vector de inicialización aleatorio: dos cifrados del
    mismo texto no deben coincidir, o el cifrado filtraría qué usuarios
    comparten contraseña."""
    c = _con_llave(monkeypatch, Fernet.generate_key().decode())
    assert c.cifrar("misma") != c.cifrar("misma")


def test_con_acentos_y_simbolos(monkeypatch):
    c = _con_llave(monkeypatch, Fernet.generate_key().decode())
    secreto = "ñandú-Ácido#2026$"
    assert c.descifrar(c.cifrar(secreto)) == secreto


def test_otra_llave_no_puede_descifrar(monkeypatch):
    c = _con_llave(monkeypatch, Fernet.generate_key().decode())
    blob = c.cifrar("ClaveTributaria.2026")
    otro = _con_llave(monkeypatch, Fernet.generate_key().decode())
    with pytest.raises(otro.ErrorCifrado):
        otro.descifrar(blob)


def test_rotacion_de_llave_la_nueva_descifra_lo_viejo(monkeypatch):
    """MultiFernet: la primera llave cifra, todas descifran. Así se rota sin
    cortar el servicio."""
    vieja = Fernet.generate_key().decode()
    c = _con_llave(monkeypatch, vieja)
    blob = c.cifrar("ClaveTributaria.2026")

    nueva = Fernet.generate_key().decode()
    c2 = _con_llave(monkeypatch, f"{nueva},{vieja}")
    assert c2.descifrar(blob) == "ClaveTributaria.2026"


def test_sin_llave_configurada_falla_con_mensaje_claro(monkeypatch):
    c = _con_llave(monkeypatch, "")
    with pytest.raises(c.ErrorCifrado) as e:
        c.cifrar("algo")
    assert "CREDENCIALES_KEY" in str(e.value)


def test_la_llave_de_ejemplo_del_env_no_sirve(monkeypatch):
    """.env.example trae un marcador, no una llave. Si alguien levanta el
    sistema sin generarla, tiene que fallar en vez de cifrar con basura."""
    c = _con_llave(monkeypatch, "GENERAR_CON_EL_COMANDO_DEL_README")
    with pytest.raises(c.ErrorCifrado):
        c.cifrar("algo")


def test_dato_corrupto_no_se_descifra(monkeypatch):
    c = _con_llave(monkeypatch, Fernet.generate_key().decode())
    with pytest.raises(c.ErrorCifrado):
        c.descifrar("esto-no-es-un-token-fernet")
