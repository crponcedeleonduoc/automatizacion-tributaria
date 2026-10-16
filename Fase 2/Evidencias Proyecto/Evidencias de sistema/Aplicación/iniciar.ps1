# aSIIstente — arranque en un clic (Windows, PowerShell)
# Uso: clic derecho > "Ejecutar con PowerShell", o en una terminal:  .\iniciar.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker no está instalado. Descárgalo de https://www.docker.com/products/docker-desktop/ (con WSL2) y vuelve a ejecutar." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".env")) {
    if (Test-Path "env.listo") {
        Copy-Item "env.listo" ".env"
        Write-Host "Creado .env desde env.listo (ya trae claves generadas). Revisa WHATSAPP_NUMERO." -ForegroundColor Yellow
    } else {
        Copy-Item ".env.example" ".env"
        Write-Host "Creado .env desde .env.example: DEBES generar SECRET_KEY y CREDENCIALES_KEY (ver README)." -ForegroundColor Yellow
    }
}

Write-Host "Levantando aSIIstente (la primera vez tarda varios minutos)..." -ForegroundColor Cyan
docker compose up --build
