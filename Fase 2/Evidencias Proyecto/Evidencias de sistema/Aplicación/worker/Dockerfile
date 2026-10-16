# Worker de aSIIstente: Python + curl_cffi + Playwright/Chromium + Xvfb.
# Contexto de build: la raíz del proyecto (para copiar ./comun).
FROM mcr.microsoft.com/playwright/python:v1.47.0-jammy

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=America/Santiago \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

# Xvfb: pantalla virtual para el flujo TGR (no funciona en headless puro)
RUN apt-get update && apt-get install -y --no-install-recommends xvfb tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY worker/requirements.txt .
RUN pip install -r requirements.txt

COPY comun ./comun
COPY worker/sii_core ./sii_core
COPY worker/tareas ./tareas
COPY worker/worker_main.py worker/scheduler_main.py ./

RUN mkdir -p /datos
CMD ["python", "-m", "worker_main"]
