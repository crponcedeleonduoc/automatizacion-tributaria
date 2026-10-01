# aSIIstente

Servicio web para la obtención automática, el monitoreo y la consolidación de información tributaria ante el Servicio de Impuestos Internos (SII) y la Tesorería General de la República (TGR).

Proyecto de Título (APT) de Ingeniería en Informática, Duoc UC sede Alameda. Asignatura Capstone PTY4614, profesor Carlos Andrés Herrera Machuca.

## Descripción

Se trata de un servicio web en el que un usuario registra uno o más contribuyentes y el sistema obtiene por él, de forma automática y programada, la información tributaria oficial desde el SII y la TGR, la consolida en una base de datos y le notifica cuando se detectan cambios relevantes.

**Qué problema resuelve.** Actualmente esa información se descarga a mano, ingresando al portal con la clave tributaria de cada contribuyente, navegando hasta cada informe y repitiendo la operación por cada período, por lo que el costo del procedimiento crece de forma lineal con la cantidad de RUT administrados. El SII no publica una interfaz de consulta para el Registro de Compras y Ventas, cosa que obliga a quien quiera automatizarlo a contratar un intermediario comercial que revende ese acceso con un costo mensual recurrente. A esto se suma que la revisión manual no permite enterarse a tiempo de un cambio relevante, como una factura reclamada, una deuda que sube o un Formulario 29 vencido sin declarar.

**A quién va dirigido.** El destinatario directo es el personal del área contable que hoy destina horas a descargar información en lugar de analizarla, junto con los responsables de la empresa, que no disponen de una visión oportuna de su situación tributaria. Dado que el modelo de acceso del SII está diseñado alrededor de un contribuyente a la vez, el caso en que el problema se multiplica es el de contadores independientes, oficinas contables y grupos empresariales con varias sociedades relacionadas, por lo que el servicio se diseñó desde el inicio para operar sobre un conjunto de RUT y no sobre uno solo.

**Alcance.** Registro de Compras y Ventas (RCV), detalle del Formulario 29 y certificado de deuda fiscal de la TGR.

## Tecnologías utilizadas

**Frontend (sitio y panel).** Next.js 14.2 con App Router y salida standalone, sobre React 18 y TypeScript. Tailwind CSS con los tokens del diseño (azul `#0047BB`, naranja `#FF8C42`, tipografía Manrope). No se utiliza librería de estado ni de componentes, por lo que el consumo de la API se resuelve con un cliente fetch propio y token JWT en localStorage.

**API.** Python 3.12 con FastAPI 0.115 sobre Uvicorn. SQLAlchemy 2.0 como ORM con driver psycopg 3, y Pydantic 2 para validación. La autenticación utiliza JWT mediante python-jose y las contraseñas se almacenan con bcrypt. El correo se envía por SMTP con smtplib de la biblioteca estándar, sobre plantillas HTML propias.

**Worker y scheduler.** Comparten imagen, construida sobre la imagen oficial de Playwright 1.47 (`mcr.microsoft.com/playwright/python`, Ubuntu Jammy) con Chromium y Xvfb como pantalla virtual para la TGR. Las colas se manejan con RQ 2.0 sobre Redis. El motor del SII utiliza curl_cffi 0.7, que impersona la huella TLS de Chrome 124 y permite pasar la protección anti-bot del portal sin levantar un navegador, tanto para el login como para el RCV; Playwright se reserva para la TGR y el Formulario 29. La lectura del certificado TGR se hace con pdfplumber, y los reportes se arman con plantillas Jinja2 que se imprimen a PDF con el propio Chromium del worker.

**Datos.** PostgreSQL 16 con columnas UUID y JSONB, Redis 7 para las colas, los candados por RUT y los límites de la demo, y un volumen Docker `datos/` donde se conservan los CSV, PDF y ZIP originales.

**Seguridad.** Las claves tributarias se cifran con Fernet de la biblioteca cryptography (AES-128-CBC con HMAC-SHA256), las contraseñas de acceso se almacenan con bcrypt y las sesiones utilizan JWT HS256.

**Infraestructura.** Docker Compose con seis servicios: `db`, `redis`, `api`, `worker`, `scheduler` y `web`. En producción se suma Caddy 2 como proxy inverso con HTTPS automático mediante Let's Encrypt, a través de un `docker-compose.prod.yml` que cierra los puertos internos. El destino previsto es un VPS Ubuntu en V2Networks (Cloud-3, 4 vCPU y 12 GB). El desarrollo se realiza en Windows con Docker Desktop sobre WSL2.

**Código compartido.** El paquete `comun/` reúne los modelos, la configuración por variables de entorno, el cifrado, la definición de planes, la cola y el correo, y es importado tanto por la API como por los workers.

## Instrucciones para ejecutar el proyecto localmente

Se requiere Docker y Docker Compose. En Windows, Docker Desktop con el backend WSL2.

```bash
git clone https://github.com/crponcedeleonduoc/automatizacion-tributaria.git
cd automatizacion-tributaria

# Variables de entorno
cp .env.ejemplo .env

# Llave de cifrado de credenciales tributarias
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# El valor obtenido se escribe en CLAVE_FERNET dentro de .env

# Levantar los seis servicios
docker compose up -d --build

# Migraciones de la base de datos
docker compose exec api alembic upgrade head
```

Una vez levantado, el panel queda disponible en `http://localhost:3000` y la documentación de la API en `http://localhost:8000/docs`.

Debido a que el servicio custodia credenciales tributarias de terceros, el archivo `.env` no se versiona y la llave de cifrado se mantiene fuera de la base de datos, por lo que cada entorno genera la suya.

> El código fuente se publica a partir de la Fase 2. Durante la Fase 1 este repositorio contiene únicamente la documentación del diseño del proyecto.

## Integrantes del equipo y roles

**Cristóbal Ponce de León Lingai** — Líder técnico y responsable del backend. Tiene a su cargo el análisis de los portales del SII y la TGR, el motor de extracción y la autenticación con huella TLS, la API con sus colas de trabajo y el control de concurrencia por RUT, el planificador de consultas con la detección de cambios y los reportes, y la capa de seguridad correspondiente al cifrado de credenciales y al control de acceso.

**Valeria Gómez** — Responsable del panel web y de la validación con usuarios. Tiene a su cargo la interfaz que permite registrar RUT, lanzar consultas, revisar el estado de cada documento y descargar los resultados, junto con las instancias de validación con usuarios reales del área contable.

La arquitectura, la documentación, el informe final y la presentación a la comisión son responsabilidad compartida de ambos integrantes.

## Metodología de trabajo

El proyecto se aborda con un enfoque iterativo e incremental, organizado en ciclos de dos semanas. Al cierre de cada ciclo se obtiene un incremento ejecutable y verificable, lo que permite detectar desviaciones a tiempo y ajustar el alcance sin comprometer la entrega final. Esa capacidad de ajuste resultó clave al inicio de la Fase 2, dado que el análisis del problema mostró que no era exclusivo del grupo de empresas que lo originó, por lo que la solución se redefinió como un servicio multiusuario.

Las etapas son cuatro:

Levantamiento de requisitos: se realiza mediante entrevistas con los usuarios del área contable y análisis del comportamiento real de los portales, debido a que no existe documentación pública de sus servicios.

Diseño: define la arquitectura en capas, el modelo de datos y las interfaces entre módulos.

Construcción: cada módulo se desarrolla y prueba de forma aislada antes de integrarse.

Validación y despliegue: contempla pruebas sobre contribuyentes reales, documentación de instalación y puesta en operación en el servidor.

Los módulos se separan por responsable para evitar la edición simultánea de los mismos archivos, y la integración se realiza en una reunión semanal con revisión cruzada antes de incorporar los cambios.

## Arquitectura de la solución

El sistema se compone de cinco bloques:

Motor de extracción: se autentica ante cada organismo con las credenciales legítimas del contribuyente y descarga el Registro de Compras y Ventas, el detalle del Formulario 29 y el certificado de deuda fiscal, operando siempre en modo de solo lectura.

Capa de datos: almacena el histórico en un modelo relacional y conserva los archivos originales con trazabilidad de la fecha de obtención.

Planificador: determina qué contribuyente consultar y cuándo, garantizando una sola sesión activa por RUT, lo que resulta crucial para no provocar bloqueos del portal.

Módulo de detección de cambios: compara cada descarga con la anterior y notifica por correo las variaciones relevantes.

Panel web: permite al usuario registrar contribuyentes, programar las consultas, revisar el estado de cada corrida y descargar los resultados.

El despliegue traduce esos bloques en seis contenedores, según se muestra a continuación.

```
                    Internet
                       │
                 ┌─────▼─────┐
                 │  Caddy 2  │  proxy inverso, HTTPS automático
                 └──┬─────┬──┘
          ┌─────────┘     └─────────┐
   ┌──────▼──────┐           ┌──────▼──────┐
   │     web     │           │     api     │
   │  Next.js 14 │──fetch───►│ FastAPI 0.115│
   └─────────────┘   JWT     └──┬───────┬──┘
                                │       │
                 ┌──────────────┘       └──────────────┐
          ┌──────▼──────┐                       ┌──────▼──────┐
          │    redis    │◄──── encola ──────────│     db      │
          │  colas RQ   │   candado por RUT     │ PostgreSQL 16│
          │  candados   │                       │ UUID / JSONB│
          └──┬───────┬──┘                       └──────▲──────┘
             │       │                                 │
    ┌────────▼───┐ ┌─▼──────────┐                      │
    │  scheduler │ │   worker   │──── persiste ────────┘
    │  programa  │ │ curl_cffi  │
    │  corridas  │ │ Playwright │────► volumen datos/
    └────────────┘ │ pdfplumber │      CSV · PDF · ZIP
                   └─────┬──────┘
                         │
              ┌──────────▼──────────┐
              │   SII  ·  TGR       │  solo lectura
              └─────────────────────┘
```

El worker es el único componente que sale hacia los organismos. El SII se consulta con curl_cffi, que impersona la huella TLS de Chrome 124 y evita levantar un navegador, mientras que la TGR y el Formulario 29 requieren Playwright con Chromium sobre Xvfb. El candado por RUT vive en Redis y garantiza que nunca exista más de una sesión activa por contribuyente, condición necesaria para que el portal no bloquee el acceso.

## Estructura del repositorio

```
Fase 1/   Diseño del proyecto APT (semanas 1 a 4) — entregada
Fase 2/   Construcción del servicio (semanas 5 a 15) — en desarrollo
Fase 3/   Presentación a comisión (semanas 16 a 18)
```

Cada fase separa las evidencias individuales de las grupales, y la Fase 2 agrega las evidencias del proyecto.

## Estado

Fase 1, definición del proyecto: entregada.

Fase 2, construcción del servicio: en desarrollo.
