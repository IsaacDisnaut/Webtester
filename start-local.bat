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
    echo [ERROR] Node.js not found. Install: winget install OpenJS.NodeJS.LTS
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

:: ── videocall\ is a git submodule - a plain "git clone" leaves it empty ──
:: ("%~dp0." not "%~dp0": a trailing backslash would escape the closing quote)
if not exist "%~dp0videocall\server.js" (
    echo [INFO] videocall\ is empty - fetching the submodule...
    where git >nul 2>&1 || (
        echo [ERROR] git not found. Install: winget install Git.Git
        pause & exit /b 1
    )
    git -C "%~dp0." submodule update --init
    if not exist "%~dp0videocall\server.js" (
        echo [ERROR] Could not fetch videocall\. Clone with git, not "Download ZIP":
        echo         git clone --recurse-submodules https://github.com/IsaacDisnaut/Webtester.git
        pause & exit /b 1
    )
)

:: ── npm packages - check they actually load, not just that node_modules exists,
::    so a half-finished install from an earlier failed run gets redone ──
pushd "%~dp0videocall"
node -e "require('better-sqlite3');require('express');require('socket.io')" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing npm packages...
    call npm install
    node -e "require('better-sqlite3');require('express');require('socket.io')" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] npm install failed. better-sqlite3 only ships prebuilt binaries for
        echo         Node.js LTS versions - install one, then run this again:
        echo         winget install OpenJS.NodeJS.LTS
        popd & pause & exit /b 1
    )
)
popd

:: ── apikey is not in git - every new clone has to create it ──
if not exist "%~dp0apikey" (
    echo [WARN] No apikey file - Whisper STT and translation won't work. See README.md
)

:: ── Start Mosquitto (local MQTT broker) ──
echo [1/5] Starting local Mosquitto MQTT broker...
set MOSQ_EXE=C:\Program Files\Mosquitto\mosquitto.exe
set MOSQ_DIR=%~dp0mosquitto
:: The winget install also registers a Mosquitto Windows service that grabs
:: port 1883 first, so deep.py would silently talk to the wrong broker
sc query mosquitto 2>nul | findstr RUNNING >nul && (
    echo [WARN] Mosquitto Windows service is running and holds port 1883.
    echo        Stop it once ^(as Admin^): net stop mosquitto ^&^& sc config mosquitto start=disabled
)
:: TLS cert for the WSS listener is not in git - create it on first run
if not exist "%MOSQ_DIR%\certs\cert.pem" (
    echo [INFO] Generating Mosquitto TLS certificate ^(first run only^)...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%MOSQ_DIR%\generate-certs.ps1" >nul
)
:: Mosquitto needs absolute cert paths, so build the runtime config from
:: wherever this clone lives instead of hard-coding one machine's path
copy /y "%MOSQ_DIR%\mosquitto-local.conf" "%MOSQ_DIR%\mosquitto-runtime.conf" >nul
set MOSQ_PORTS=TCP: 1883, WS: 9001
if exist "%MOSQ_DIR%\certs\cert.pem" (
    >>"%MOSQ_DIR%\mosquitto-runtime.conf" (
        echo.
        echo # WebSocket Secure ^(direct LAN access without proxy^) - added by start-local.bat
        echo listener 9443
        echo protocol websockets
        echo certfile %MOSQ_DIR%\certs\cert.pem
        echo keyfile  %MOSQ_DIR%\certs\key.pem
        echo allow_anonymous true
    )
    set MOSQ_PORTS=TCP: 1883, WS: 9001, WSS: 9443
) else (
    echo [WARN] No TLS cert - skipping WSS listener 9443 ^(the web app and deep.py don't use it^)
)
if exist "%MOSQ_EXE%" (
    start "Mosquitto MQTT" cmd /k ""%MOSQ_EXE%" -c "%MOSQ_DIR%\mosquitto-runtime.conf" -v"
    timeout /t 2 /nobreak >nul
    echo [INFO] Mosquitto started ^(%MOSQ_PORTS%^)
) else (
    echo [WARN] mosquitto.exe not found at "%MOSQ_EXE%" - video call works, robot control won't
    echo        Install: winget install EclipseFoundation.Mosquitto  ^(run as Admin^)
)

:: ── Start Node.js server in a new window ──
echo [2/5] Starting Node.js server on port 3000...
start "VideoCall Server" cmd /k "cd /d "%~dp0videocall" && set NODE_ENV=production&& set PORT=3000&& node server.js"
:: Wait until it answers - opening the tunnel before that just shows visitors a 502.
:: --noproxy: campus/office networks set HTTP(S)_PROXY, and curl would send even
:: localhost through it and never reach the server. Only a warning on timeout:
:: this probe can be wrong (old Windows without curl), the server window can't.
set WAIT=0
:wait_server
curl -s -o nul --noproxy "*" http://127.0.0.1:3000/ && goto server_up
set /a WAIT+=1
if %WAIT% geq 30 (
    echo [WARN] No answer from port 3000 after 30s - if the "VideoCall Server" window
    echo        shows an error, fix that first. Continuing anyway...
    goto server_done
)
timeout /t 1 /nobreak >nul
goto wait_server
:server_up
echo [INFO] Server is up.
:server_done

:: ── Start deep.py (MQTT -> Arduino serial bridge) ──
echo [3/5] Starting deep.py robot bridge...
where python >nul 2>&1
if %errorlevel% equ 0 (
    python -c "import paho.mqtt, serial" >nul 2>&1 || echo [WARN] Missing Python packages - run: pip install paho-mqtt pyserial
    start "Robot Bridge (deep.py)" cmd /k "cd /d "%~dp0" && python deep.py"
    echo [INFO] deep.py started ^(MQTT bridge to Arduino - retries broker every 5s if not ready^)
) else (
    echo [WARN] Python not found, skipping deep.py robot bridge.
)

:: ── Optionally start YOLO detection server ──
set /p START_YOLO="[4/5] Start YOLO detection server too? (y/n): "
if /i "%START_YOLO%"=="y" (
    where python >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Python not found, skipping YOLO server.
    ) else (
        start "YOLO Server" cmd /k "cd /d "%~dp0" && python yolo_server.py"
        timeout /t 2 /nobreak >nul
        echo [INFO] YOLO server started on port 5001
    )
)

:: ── Start Cloudflare Tunnel ──
:: http2 instead of the default QUIC: campus/office Wi-Fi often blocks the UDP
:: QUIC needs, and cloudflared then stalls on retries before falling back
echo.
echo [5/5] Starting Cloudflare Tunnel...
echo       Your public HTTPS URL will appear below ^(look for "trycloudflare.com"^).
echo       MQTT runs over the same URL at /ws/mqtt automatically.
echo  ----------------------------------------------------------
cloudflared tunnel --protocol http2 --url http://localhost:3000

echo.
echo [INFO] Tunnel closed. Press any key to exit.
pause >nul
