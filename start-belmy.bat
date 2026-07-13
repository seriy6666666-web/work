@echo off
cd /d "%~dp0"
echo Starting BELMY ENERGY...
docker compose up -d
timeout /t 3 /nobreak >nul
start "" http://localhost:5173
