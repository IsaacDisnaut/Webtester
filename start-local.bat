@echo off
title DeepDarkFantasy - Local Server
color 0A
echo.
echo  ==========================================
echo   DeepDarkFantasy  ^|  Local + Tunnel Mode
echo  ==========================================
echo.

:: ── Check Node.js ──
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Download from https://nodejs.org
    pause & exit /b 1
)

:: ── Check cloudflared ──
where cloudflared >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] cloudflared not found.
    echo.
    echo Install it with:
    echo   winget install Cloudflare.cloudflared
    echo.
    pause & exit /b 1
)

:: ── npm install if node_modules missing ──
if not exist "%~dp0videocall\node_modules" (
    echo [INFO] Installing npm packages...
    pushd "%~dp0videocall"
    call npm install
    popd
)

:: ── Start Node.js server in a new window ──
echo [1/3] Starting Node.js server on port 3000...
start "VideoCall Server" cmd /k "cd /d "%~dp0videocall" && set NODE_ENV=production&& set PORT=3000&& node server.js"
timeout /t 3 /nobreak >nul

:: ── Optionally start YOLO detection server ──
set /p START_YOLO="[2/3] Start YOLO detection server too? (y/n): "
if /i "%START_YOLO%"=="y" (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        start "YOLO Server" cmd /k "cd /d "%~dp0" && python yolo_server.py"
        timeout /t 2 /nobreak >nul
        echo [INFO] YOLO server started on port 5001
    ) else (
        echo [WARN] Python not found, skipping YOLO server.
    )
)

:: ── Start Cloudflare Tunnel ──
echo.
echo [3/3] Starting Cloudflare Tunnel...
echo       Your public HTTPS URL will appear below ^(look for "trycloudflare.com"^):
echo  ----------------------------------------------------------
cloudflared tunnel --url http://localhost:3000

echo.
echo [INFO] Tunnel closed. Press any key to exit.
pause >nul
