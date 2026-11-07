# Pruebas automatizadas

Pruebas unitarias sobre las funciones puras del sistema: las que no dependen
de la red, de la base de datos ni de los portales del SII y la TGR, y que por
lo tanto se pueden verificar de forma determinista en cualquier equipo.

## Cómo ejecutarlas

```bash
pip install -r pruebas/requirements.txt
pytest
```

O dentro del contenedor, con el sistema levantado:

```bash
docker compose exec worker python -m pytest
```

## Qué cubren

| Archivo | Qué verifica | Por qué importa |
|---|---|---|
| `test_rut.py` | Validación del dígito verificador, normalización de puntos, guiones y `K` | Un RUT mal validado deja guardar una credencial que el SII va a rechazar después |
| `test_periodos.py` | Aritmética de períodos `AAAAMM` y normalización de montos del CSV | El rango de descarga masiva y los totales por período dependen de esto |
| `test_cifrado.py` | Ciclo cifrar/descifrar, aleatoriedad del cifrado, rotación de llave, fallo sin llave | Es el requisito no funcional más sensible: las claves tributarias nunca en texto plano |
| `test_rcv_parser.py` | Parseo del CSV del Registro de Compras y Ventas | Es el punto por donde los datos del portal entran al sistema |
| `test_solo_lectura.py` | Bloqueo de cualquier método que parezca escritura contra el SII | El sistema opera con credenciales de terceros y no debe poder modificar nada |
| `test_planes.py` | Frecuencia efectiva de consulta según el plan | Define cuánta carga recibe el portal del SII |

Al 7 de noviembre de 2026: **104 pruebas, todas pasando.**

## Qué no cubren, y por qué

No hay pruebas de integración contra el SII ni contra la TGR. Hacerlas
implicaría consultar los portales con credenciales reales en cada ejecución,
lo que es lento, depende de que el servicio esté disponible y consume cuota de
un contribuyente real. La verificación de esa parte se hizo comparando el CSV
que entrega el endpoint contra la descarga manual del portal, cotejo que está
registrado en el encabezado de `worker/sii_core/rcv.py`.
