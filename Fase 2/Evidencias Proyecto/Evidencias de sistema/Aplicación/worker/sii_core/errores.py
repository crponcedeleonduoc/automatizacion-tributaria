class SiiError(RuntimeError):
    """Error genérico del SII (sesión, endpoint, datos)."""


class CredencialesInvalidas(SiiError):
    """RUT o clave tributaria rechazados. No reintentar: marca la cuenta."""


class SesionesExcedidas(SiiError):
    """Máximo de sesiones concurrentes por RUT. Esperar 20-30 minutos."""


class SiiMantencion(SiiError):
    """El SII está en mantención o devolvió HTML. Reintentar más tarde."""


class OperacionNoPermitida(RuntimeError):
    """Se intentó una operación que no es de consulta."""
