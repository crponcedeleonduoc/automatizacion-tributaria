# aSIIstente — visión del producto final

*Resumen de qué es el producto, qué hace hoy y cómo queda su versión 1.0 para salir a vender. Actualizado el 6 de septiembre de 2026.*

## 1. Qué es

aSIIstente es un servicio web (SaaS) chileno que entra al SII y a la Tesorería General de la República con la clave tributaria del cliente y le trae, de forma automática y periódica, la información que un contador o un dueño de pyme hoy busca a mano en los portales: el Registro de Compras y Ventas (RCV), el certificado de deuda de la TGR y el estado de sus declaraciones F29. Sobre esa información detecta cambios que importan (una factura reclamada, una deuda que sube, un F29 vencido sin declarar) y avisa por correo. Todo queda descargable en CSV, ZIP y reportes PDF personalizables.

Nació como un proyecto de título en Duoc UC (una herramienta local en Python) y se convirtió en un producto multiusuario alojado en la nube, con planes de pago y panel de administración.

**A quién le sirve.** A contadores independientes y oficinas contables que llevan varios RUT y necesitan saber al instante cuándo algo cambia en la cartera, y a dueños de pymes que quieren tener su situación tributaria a la vista sin entrar al SII.

**Qué NO es.** No es un software contable ni reemplaza al contador; no declara ni paga nada por el cliente; no está afiliado al SII ni a la TGR. Es un servicio privado independiente que lee y ordena información que ya es del contribuyente.

## 2. Cómo se ve para el cliente

**Sitio público.** Página de inicio con la propuesta de valor, precios en pesos chilenos, páginas para contadores y para pymes, funcionalidades, seguridad, preguntas frecuentes, términos y privacidad, y contacto por WhatsApp. El gancho es una **demo real**: cualquier visitante ingresa su RUT y clave y en menos de un minuto ve el resumen de su RCV del mes y descarga el CSV, sin crear cuenta y sin que la clave se guarde.

**Registro en tres pasos.** Crear cuenta → conectar un RUT → ver su primera descarga en vivo. Desde ese momento el sistema sigue trabajando solo.

**Panel.** Un solo lugar con todo:

| Sección | Qué hace |
|---|---|
| Mis RUT | Lista de empresas con estado, deuda TGR, documentos del mes y alertas sin leer. Botones "Actualizar ahora" por documento. |
| Empresa → RCV | Resumen por período (ventas, IVA débito, compras, IVA crédito), listado de facturas con su estado (aceptada, pendiente, reclamada), descargas CSV y **descarga masiva**: todos los meses de un rango en un ZIP con un consolidado por operación. |
| Empresa → TGR | Último certificado de Tesorería: deuda morosa, no vencida, giros, PDF original. |
| Empresa → F29 | Matriz de 12 meses (declarado / no declarado / observado) y tabla de seguimiento de los períodos pendientes con monto, monto con multa, estado, prioridad, acción y fechas. |
| Empresa → Ajustes | Programación de consultas (cada 10 min a 1 vez al día, según el plan; solo horario hábil; TGR/F29 automáticos sí/no), cambio de clave tributaria, eliminación del RUT con todos sus datos. |
| Reportes | Plantillas personalizables (qué bloques, qué columnas, qué período, notas) y generación de PDF con la marca del servicio: resumen de deuda, detalle TGR, F29 pendientes, movimientos RCV. Historial de reportes. |
| Alertas | Todo lo que cambió en la cartera, con enlace a la empresa. |
| Registro de actividad | Cada consulta hecha con sus RUT, por pestaña (RCV, TGR, F29, descargas masivas), con origen, estado, resultado y duración. |
| Configuración | Perfil, contraseña, activar/desactivar correos, plan. |

**Correos.** Bienvenida al registrarse, recuperación de contraseña, y un correo diario o inmediato (según se acumulen) con las novedades agrupadas por RUT.

## 3. Planes y precios

| | Gratis | Pyme | Contador |
|---|---|---|---|
| Precio | $0 | $9.990 / mes | $29.990 / mes |
| RUT | 1 | 1 | hasta 20 |
| Documentos | RCV | RCV + TGR + F29 | RCV + TGR + F29 |
| Frecuencia RCV | 1 vez al día | desde cada hora | desde cada 10 minutos |
| Historial / descarga masiva | 1 mes | 12 meses | ilimitado |
| Alertas por correo | solo clave rechazada | sí | sí |
| Reportes PDF | sí | sí | sí |
| Soporte | correo | correo | WhatsApp prioritario |

El plan fija el mínimo de frecuencia; dentro de eso, cada cliente programa su ritmo por RUT. TGR y F29 se consultan como máximo una vez al día porque requieren navegador.

## 4. Cómo funciona por dentro

- **Motor SII** (`sii_core`): inicia sesión con huella de navegador Chrome (pasa la protección anti-bot del SII sin abrir un navegador), descarga el RCV como CSV por la misma API interna que usa el portal, y para TGR y F29 usa un Chromium real con pantalla virtual. Solo lectura por construcción: cualquier llamada que pudiera escribir en el SII está bloqueada en el código.
- **Colas y candados**: dos colas de trabajo (rápida para RCV y reportes, lenta para navegador). Un candado por RUT garantiza una sola sesión SII por contribuyente en todo el sistema, evitando el error de sesiones concurrentes y los bloqueos.
- **Scheduler**: cada minuto revisa qué RUT toca consultar según su programación y su plan, encola el trabajo y despacha los correos pendientes.
- **Alertas**: al comparar cada descarga con la anterior detecta facturas que pasan a reclamado, subidas de deuda TGR, F29 vencidos u observados, y claves rechazadas (en ese caso deja de consultar hasta que el cliente la actualice, para no provocar bloqueos).
- **Infraestructura**: todo corre en Docker (Postgres, Redis, API FastAPI, workers Python, scheduler, web Next.js, Caddy con HTTPS automático). El mismo `docker compose` corre en el PC de desarrollo y en el VPS; se estima un Cloud-3 de V2Networks (4 vCPU, 12 GB) para las primeras decenas de clientes.

## 5. Seguridad y privacidad

- La clave tributaria del cliente se guarda **cifrada con Fernet (AES-128-CBC + HMAC-SHA256)**; la llave de cifrado vive fuera de la base de datos, en el entorno del servidor. Un respaldo robado no sirve para obtener claves.
- La contraseña de acceso al panel se guarda con **bcrypt** (hash, no reversible).
- La demo pública nunca guarda la clave: viaja solo a la cola de trabajo y se descarta.
- Sesiones con JWT; recuperación de contraseña con enlace de una hora y un solo uso.
- Límites anti-abuso en la demo (por IP y por RUT), pausa mínima entre consultas al SII, candado por RUT.
- El cliente puede eliminar un RUT (clave, historial y alertas) en un clic; cierre de cuenta por correo.
- Solo lectura contra el SII; nada se declara, paga ni modifica.

## 6. Estado actual (qué está hecho y probado)

Con datos reales de un contribuyente de prueba:

- Demo pública, registro con primera descarga, RCV automático (validado durante horas con el scheduler), TGR (monto coincide con el certificado), F29 (matriz y alertas), programación por RUT, descarga masiva histórica (13 meses en 60 s), reportes PDF, correos (bienvenida, recuperación, alertas), panel de administración con cambio de plan, activar/desactivar y prueba de SMTP.

## 7. Lo que falta para la versión 1.0

En orden de prioridad:

1. **Cobro automático**: WebPay (Transbank) y cambio de plan desde el panel. Mientras tanto se cobra por transferencia y el plan se activa desde Administración.
2. **Dominio y correo propios** (`asiistente.cl` o el que se elija) y proveedor SMTP definitivo.
3. **Despliegue en el VPS** y verificación del flujo TGR con pantalla virtual en Linux.
4. **Monto con multa de F29 no declarados** extraído del SII (hoy se ingresa a mano en la tabla de seguimiento).
5. **Carpeta compartida** (OneDrive/Drive) para que el contador reciba los CSV sin entrar al panel.
6. **Parser del PDF del F29** para cuadratura de IVA por código.
7. Reemplazar los textos de relleno del sitio (testimonios, logos, métricas) y revisar términos y privacidad con un abogado.
8. Mantenimiento: limpieza automática del registro de actividad antiguo y respaldos diarios de la base de datos.

## 8. Ideas para después de la 1.0

Más documentos del SII (carpeta tributaria, situación tributaria, boletas de honorarios), integración con software contable, alertas por WhatsApp, multiusuario por oficina contable (varios contadores bajo una cuenta), y un plan "Estudio" para más de 20 RUT.
