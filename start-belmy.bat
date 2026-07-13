@echo off
chcp 65001 >nul
cd /d "%~dp0"
title BELMY ENERGY

echo Проверяю Docker...
docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo [!] Docker не запущен. Запустите Docker Desktop и дождитесь,
  echo     пока значок кита покажет "Docker Desktop is running", затем
  echo     запустите этот файл снова.
  echo.
  pause
  exit /b 1
)

echo Запускаю BELMY ENERGY (первый раз сборка занимает несколько минут)...
docker compose up --build -d
if errorlevel 1 (
  echo.
  echo [!] Не удалось запустить. Проверьте, что порты 5173/3000/5432 свободны.
  pause
  exit /b 1
)

echo Ожидаю готовности приложения...
set /a tries=0
:wait
curl -s -o nul http://localhost:5173/ >nul 2>&1
if not errorlevel 1 goto ready
set /a tries+=1
if %tries% gtr 60 (
  echo [!] Приложение долго не отвечает. Откройте http://localhost:5173 вручную.
  goto open
)
timeout /t 2 /nobreak >nul
goto wait

:ready
echo Готово!
:open
start "" http://localhost:5173
exit /b 0
