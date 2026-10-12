@echo off
setlocal
title Hallu - Vite Dev Server
cd /d "%~dp0bin"

:: Check if port 5173 is already in use
node -e "const net=require('net');const s=net.createConnection(5173,'127.0.0.1',()=>{s.end();process.exit(0);});s.on('error',()=>process.exit(1));s.setTimeout(1000,()=>{s.destroy();process.exit(1);});" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo  [WARNING] Port 5173 is already in use!
    echo.
    echo  Either the Hallu Vite server is already running, or another program
    echo  is using port 5173.
    echo ======================================================================
    echo.
    choice /C YN /N /M "Do you want to continue and run a duplicate server? [Y/N] "
    if errorlevel 2 (
        echo.
        echo Launch cancelled.
        exit /b 0
    )
    echo.
)

echo ========================================================
echo  Hallu: Starting Vite Dev Server (0.0.0.0:5173)...
echo ========================================================
echo.

call npm.cmd run dev -- --host 0.0.0.0
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Vite server exited with code %errorlevel%.
    pause
    exit /b %errorlevel%
)
