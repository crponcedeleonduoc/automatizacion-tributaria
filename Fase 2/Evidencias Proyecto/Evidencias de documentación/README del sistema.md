# aSIIstente — SaaS

Automatización de información tributaria del SII y la TGR para contadores y pymes.
Todo el sistema corre con Docker: idéntico en tu PC y en el VPS de V2Networks.

```
aSIIstente/
├── docker-compose.yml        # local: db + redis + api + worker + scheduler + web
├── docker-compose.prod.yml   # producción: agrega Caddy (HTTPS automático) y cierra puertos
├── .env                      # secretos y configuración (NO subir a git)
├── comun/                    # código compartido: modelos, cifrado, cola, planes
├── api/                      # FastAPI: auth, empresas, demo, trabajos, planes
├── worker/
│   ├── sii_core/             # motor SII/TGR migrado (auth TLS, RCV, TGR, F29)
│   ├── tareas/               # jobs: sincronizar rcv/tgr/f29, demo
│   ├── worker_main.py        # consume la cola de Redis
│   └── scheduler_main.py     # encola consultas periódicas según el plan
├── web/                      # Next.js 14 + Tailwind (diseño de Claude Design)
├── caddy/Caddyfile
└── db/init/                  # extensiones de Postgres
```

## 1. Requisitos en tu PC (Windows)

1. **Docker Desktop** con WSL2: https://www.docker.com/products/docker-desktop/
   Al instalar, deja marcado "Use WSL 2 instead of Hyper-V". Reinicia si te lo pide.
2. Nada más. Python, Node, Postgres y Chromium van dentro de los contenedores.

## 2. Levantar todo en local

Abre PowerShell en esta carpeta y ejecuta:

```powershell
.\iniciar.ps1          # o, a mano:  docker compose up --build
```

La primera vez tarda 5-10 minutos (descarga Postgres, Redis, la imagen de Playwright
con Chromium y compila el frontend). Las siguientes veces arranca en segundos.

Cuando veas `Uvicorn running` y `Ready in`, abre:

| Qué | URL |
|---|---|
| Sitio web + panel | http://localhost:3000 |
| API (documentación interactiva) | http://localhost:8000/docs |
| Postgres (DBeaver, pgAdmin) | localhost:5432 · usuario y clave del `.env` |

Para detener: `Ctrl+C` y luego `docker compose down`.
Para borrar también la base de datos: `docker compose down -v`.

### Probar la demo real

1. Entra a http://localhost:3000 y baja al bloque azul "Descarga tu RCV de este mes".
2. Ingresa un RUT y su clave tributaria. El worker entra al SII con `curl_cffi`
   (huella de Chrome), descarga el RCV del mes y te muestra el resumen y el CSV.
3. Mira el log del worker en la consola: `docker compose logs -f worker`.

### Probar el flujo completo

1. "Probar gratis" → crea cuenta → conecta un RUT → primera descarga automática.
2. En el panel, "Actualizar RCV" encola una consulta; en 20-60 s aparece.
3. TGR y F29 requieren plan Pyme o Contador. Para probarlos en local cambia el plan
   directo en la base de datos:
   ```powershell
   docker compose exec db psql -U asiistente -d asiistente -c "update usuarios set plan='contador'"
   ```
   Luego "Actualizar TGR" (tarda 1-2 min, usa Chromium con pantalla virtual Xvfb).

## 3. Configuración (`.env`)

Ejecuta `.\iniciar.ps1` (crea el `.env` a partir de `env.listo`, que ya trae claves generadas, y levanta Docker). Si prefieres a mano: renombra `env.listo` a `.env`. Lo que debes revisar:

| Variable | Qué es |
|---|---|
| `WHATSAPP_NUMERO` | Tu número en formato internacional sin `+` (56 9 …). Lo usan todos los botones de WhatsApp. |
| `CREDENCIALES_KEY` | Clave Fernet con la que se cifran las claves tributarias. **Si la pierdes, las credenciales guardadas son irrecuperables.** Guárdala en un gestor de contraseñas. |
| `SECRET_KEY` | Firma los tokens de sesión de los usuarios. |
| `POSTGRES_PASSWORD` | Clave de la base de datos. |
| `SMTP_*` | Correo saliente (alertas, bienvenida, recuperar contraseña). Sin `SMTP_HOST` el sistema funciona igual y las alertas quedan solo en el panel. Para probar con Gmail: `smtp.gmail.com`, puerto 587, tu correo y una [contraseña de aplicación](https://myaccount.google.com/apppasswords). |
| `URL_WEB` | URL pública del sitio para los enlaces de los correos (local `http://localhost:3000`, producción `https://tudominio.cl`). |
| `ADMIN_EMAILS` | Correos administradores, separados por coma. Ven **Administración** en el panel: usuarios, cambio de plan, activar/desactivar, correo de prueba. |
| `DOMINIO`, `EMAIL_ADMIN` | Solo producción: dominio para el certificado HTTPS de Caddy. |

Para generar claves nuevas:

```powershell
docker run --rm python:3.12-slim python -c "import secrets; print(secrets.token_urlsafe(48))"
docker run --rm python:3.12-slim sh -c "pip install -q cryptography && python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
```

## 4. Subir a producción (VPS V2Networks)

Plan recomendado: **Cloud-3** (4 vCPU, 12 GB RAM). Los workers de Playwright para TGR y
F29 consumen ~1 GB cada uno; con 4 GB te quedas corto.

```bash
# en el VPS (Ubuntu 22.04/24.04)
curl -fsSL https://get.docker.com | sh
git clone <tu-repo> asiistente && cd asiistente     # o copia la carpeta con scp
cp .env.example .env && nano .env                     # claves NUEVAS, dominio, WhatsApp
#   NEXT_PUBLIC_API_URL=https://tudominio.cl   ENTORNO=produccion
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Apunta el DNS del dominio a la IP del VPS antes de levantar; Caddy pide el certificado
solo. Todo el tráfico entra por Caddy (80/443); Postgres, Redis y la API no quedan
expuestos.

Actualizar en producción: `git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.

Respaldo diario de la base de datos (cron en el VPS):
```bash
docker compose exec -T db pg_dump -U asiistente asiistente | gzip > /backups/asiistente_$(date +%F).sql.gz
```

Escalar workers: `docker compose up -d --scale worker=3`.

## 5. Cómo funciona por dentro

- **API** (`api/app`): FastAPI. JWT con bcrypt. Al crear una empresa cifra la clave con
  `CREDENCIALES_KEY`, la guarda en `empresas.clave_cifrada` y encola la primera
  sincronización. La demo pública no guarda credenciales: la clave viaja solo por Redis
  como argumento del job y se descarta. Límite de 5 demos/hora por IP y 3 por RUT.
- **Worker** (`worker/`): RQ sobre Redis. Dos colas: `sii-http` (RCV, rápido) y
  `sii-navegador` (TGR y F29 con Playwright). Un **candado por RUT** en Redis garantiza
  una sola sesión SII por RUT en todo el sistema (evita el error de sesiones concurrentes).
  Cada consulta queda en `consultas_log` (lo que el usuario ve como "Registro de actividad").
- **Scheduler**: cada 60 s revisa qué empresas tocan y encola. La frecuencia del RCV la
  programa el usuario por RUT (pestaña **Ajustes → Programación de consultas**) entre las
  opciones 10 min / 30 min / 1 h / 3 h / 6 h / 12 h / 24 h; el plan fija el mínimo
  (`frecuencia_minutos` en `comun/planes.py`: Contador 10, Pyme 60, Gratis 1440) y el valor
  con el que parte una empresa nueva (`frecuencia_defecto`: 30 / 60 / 1440). También puede
  limitar el RCV a horario hábil (07–22 Chile) y apagar TGR/F29 automáticos. TGR y F29
  máximo una vez al día y solo entre 06:00 y 23:00 Chile.
- **Descarga masiva** (pestaña RCV → "Descarga masiva"): el usuario elige un rango de meses
  y compras/ventas; `tareas.rcv.descargar_historico` recorre todos los períodos (reabre
  sesión SII cada 12 meses para no acaparar el RUT), guarda cada CSV y sus filas, y arma un
  ZIP (`datos/rcv_zip/<empresa>/<trabajo>.zip`) con un CSV por mes/operación/estado más un
  consolidado por operación con columna `Periodo`. El progreso se ve en vivo en el panel.
  Límites: historial del plan (Pyme 12 meses, Contador ilimitado, Gratis no disponible) y
  120 meses por descarga. No genera alertas por facturas reclamadas antiguas.
- **Registro de actividad**: pestañas Todas / RCV / TGR / F29 / Descargas masivas con
  conteo y punto rojo si hay errores, filtro por estado, origen (automática o manual),
  duración, y paginación de 50 en 50 (`GET /api/trabajos?tipo=&estado=&limite=&desde=`).
- **Alertas**: al comparar el RCV nuevo con el anterior detecta facturas que pasan a
  RECLAMADO; en TGR detecta subidas de deuda; en F29 períodos vencidos sin declarar.
  Quedan en la tabla `alertas` y se muestran en el panel.
- **Correo** (`comun/correo.py`): el scheduler, cada 60 s, agrupa las alertas con
  `enviada_correo = false` por usuario y manda **un solo correo** por usuario con todas
  sus novedades (plantilla HTML con la marca + versión texto). Solo planes con
  `alertas_correo` (Pyme, Contador); la alerta `credencial_invalida` se envía a todos.
  El usuario puede apagar los correos en Configuración. Si SMTP no está configurado, las
  alertas quedan pendientes y salen cuando se configure. La API manda además el correo
  de bienvenida al registrarse y el de **recuperar contraseña** (`/recuperar` →
  enlace de 1 hora y un solo uso → `/restablecer`).
- **Administración** (`/panel/admin`, solo `es_admin`): KPIs (usuarios, RUT, MRR,
  consultas 24 h), lista de usuarios con cambio de plan y activar/desactivar, estado del
  SMTP y correo de prueba. Sirve para activar planes a mano mientras no hay WebPay.
- **Datos**: CSV y PDF en el volumen `datos` (`/datos` dentro de los contenedores).
  Filas del RCV en `rcv_documentos` (una por factura), certificados en `tgr_certificados`,
  estados F29 en `f29_estados`.

### Reportes PDF

En el panel, **Reportes**: cada usuario tiene plantillas (bloques resumen / TGR / F29 /
RCV, columnas visibles por bloque, período: todo, últimos N meses o rango, notas al pie).
"Generar PDF" encola `tareas.reportes.generar_reporte`, que arma los datos, renderiza
`worker/tareas/plantillas/reporte.html` con Jinja2 y lo imprime con el Chromium del
worker. El PDF queda en el volumen `datos/reportes/<empresa>/` y en el historial.

La pestaña **F29** de cada empresa tiene la tabla de seguimiento de períodos no
declarados (monto, monto con multa, estado, prioridad, acción, fechas, comentario).
El monto base se calcula solo desde el RCV (IVA de compras del período); el monto con
multa se ingresa a mano hasta que se conecte la extracción desde el SII (`fuente_multa`).

## 6. Pendientes para salir a vender

1. **Pagos**: integrar WebPay (Transbank) y cambio de plan desde el panel. Hoy el plan se
   cambia desde /panel/admin (cobro por transferencia mientras tanto).
2. **Dominio y casilla de correo** reales para `SMTP_*` (hoy se prueba con Gmail).
3. **Carpeta compartida** del plan Contador (OneDrive/Drive). La descarga masiva en ZIP ya está.
4. **Monto con multa de F29 no declarados** desde el SII (hoy manual en la pestaña F29).
5. **Parser del PDF del F29** (montos por código) para la cuadratura IVA, reutilizando
   `sii_f29.py` del proyecto original.
6. Reemplazar los `[placeholders]` de la web: testimonios, logos, métricas, textos legales
   (revisar con abogado), proveedor de nube en Seguridad.
7. Probar en el VPS que el flujo TGR carga el iframe del PDF con Xvfb. Si no, alternativa:
   `headless=False` ya está configurado; revisar `docker compose logs worker`.
8. Limpieza: job que borre `trabajos` y `consultas_log` con estado ok de más de 90 días
   (con Contador a 10 min son 144 filas/día por RUT).

## 7. Seguridad: pendiente urgente en el proyecto viejo

El archivo `facturas_test.py` de la carpeta `AUTOMATIZACION SII TGR` tiene una clave
tributaria real escrita en texto plano en el comentario inicial, y esa carpeta está en
OneDrive. Bórrala de ahí y rota esa clave en el SII.

## 8. Comandos útiles

```powershell
docker compose logs -f api          # logs de la API
docker compose logs -f worker       # logs del worker (aquí ves las consultas al SII)
docker compose logs -f scheduler
docker compose exec db psql -U asiistente -d asiistente   # consola SQL
docker compose restart worker
docker compose build web && docker compose up -d web       # solo recompilar el frontend
```
