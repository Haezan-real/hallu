@echo off
setlocal
title Hallu Dev Launcher
cd /d "%~dp0bin"

:: Check if the Vite dev server is running on port 5173
node -e "const net=require('net');const s=net.createConnection(5173,'127.0.0.1',()=>{s.end();process.exit(0);});s.on('error',()=>process.exit(1));s.setTimeout(1000,()=>{s.destroy();process.exit(1);});" >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ======================================================================
    echo  [ERROR] Vite development server is not running!
    echo.
    echo  hallu_editor_dev requires the Vite dev server to be running before
    echo  launching Electron in developer mode.
    echo.
    echo  ACTIONABLE NEXT STEP:
    echo    1. Run 'launch_vite_server.bat' to start the Vite dev server.
    echo    2. Wait until the Vite server displays "Local: http://localhost:5173/".
    echo    3. Run 'hallu_editor_dev.bat' again to open Hallu editor.
    echo ======================================================================
    echo.
    if "%HALLU_NO_PAUSE%"=="" pause
    exit /b 1
)

set ELECTRON_DEV=true
call npx.cmd electron main.cjs

