@echo off
chcp 65001 >nul
title GDP Surmedia

set REPO_URL=https://github.com/felramos78-netizen/Surmedia-GDP

echo.
echo  ===========================================
echo   GDP Surmedia  --  Setup y Arranque
echo  ===========================================
echo.

:: ── Verificar requisitos ────────────────────────────────────────────────────
where git >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Git no esta instalado.
    echo  Descargalo en: https://git-scm.com/download/win
    echo.
    pause & exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org
    echo.
    pause & exit /b 1
)

:: ── Determinar directorio del proyecto ─────────────────────────────────────
:: Caso A: el .bat vive dentro del repo (tiene package.json al lado)
if exist "%~dp0package.json" (
    set PROJECT_DIR=%~dp0
    :: Quitar barra final
    set PROJECT_DIR=%PROJECT_DIR:~0,-1%
    goto :git_pull
)

:: Caso B: el .bat vive fuera — clona o actualiza la subcarpeta surmedia-gdp
set PROJECT_DIR=%~dp0surmedia-gdp

if exist "%PROJECT_DIR%\.git" goto :git_pull

:: Primera vez: clonar
echo  [1/4] Descargando proyecto desde GitHub...
git clone %REPO_URL% "%PROJECT_DIR%"
if errorlevel 1 (
    echo  [ERROR] No se pudo clonar. Verifica tu conexion y acceso al repositorio.
    pause & exit /b 1
)
goto :npm_install

:git_pull
echo  [1/4] Actualizando codigo (git pull)...
cd /d "%PROJECT_DIR%"
git pull
if errorlevel 1 (
    echo  [AVISO] git pull fallo. Puede que no haya conexion. Continuando igual...
)

:npm_install
echo.
echo  [2/4] Instalando dependencias (puede tardar unos minutos la primera vez)...
cd /d "%PROJECT_DIR%"
call npm install
if errorlevel 1 (
    echo  [ERROR] Fallo npm install.
    pause & exit /b 1
)

:: ── Prisma generate ─────────────────────────────────────────────────────────
echo.
echo  [3/4] Generando cliente Prisma...
cd /d "%PROJECT_DIR%\backend"
call npx prisma generate
if errorlevel 1 (
    echo  [ERROR] Fallo prisma generate.
    pause & exit /b 1
)

:: ── Lanzar servidores ───────────────────────────────────────────────────────
echo.
echo  [4/4] Iniciando servidores...

start "GDP Backend  -- puerto 4000" cmd /k "cd /d "%PROJECT_DIR%\backend" && npm run dev"
timeout /t 2 /nobreak >nul
start "GDP Frontend -- puerto 3000" cmd /k "cd /d "%PROJECT_DIR%\frontend" && npm run dev"

echo.
echo  ==========================================
echo   Backend  ->  http://localhost:4000
echo   Frontend ->  http://localhost:3000
echo  ==========================================
echo.
echo  Los servidores se abrieron en ventanas separadas.
echo  Puedes cerrar esta ventana.
echo.
pause
