"""sii_core — motor de consulta al SII y la TGR. SOLO LECTURA.

Migrado del proyecto local aSIIstente (sii_auth_tls, sii_reader, sii_tgr,
sii_f29_auto, tgr_final). Sin archivos en disco, sin bóveda, sin nombres de
empresas: recibe RUT + clave y devuelve datos.
"""

from .errores import SiiError, CredencialesInvalidas, SesionesExcedidas, SiiMantencion
from .utils import split_rut, dv_valido, formatear_rut, periodos, periodo_actual
from .auth import ClaveAuthTLS
from .rcv import ClienteRCV, ESTADOS_RCV, parsear_csv_rcv
from .tgr import DeudaTGR, parsear_pdf_tgr, consultar_tgr
from .f29 import capturar_f29

__all__ = [
    "SiiError", "CredencialesInvalidas", "SesionesExcedidas", "SiiMantencion",
    "split_rut", "dv_valido", "formatear_rut", "periodos", "periodo_actual",
    "ClaveAuthTLS", "ClienteRCV", "ESTADOS_RCV", "parsear_csv_rcv",
    "DeudaTGR", "parsear_pdf_tgr", "consultar_tgr", "capturar_f29",
]
