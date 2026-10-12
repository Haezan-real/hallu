@echo off
setlocal
title Hallu Dev Launcher
cd /d "%~dp0"

:: Check if the Vite dev server is running on port 5173
node -e "const net=require('net');const s=net.createConnection(5173,'127.0.0.1',()=>{s.end();process.exit(0);});s.on('error',()=>process.exit(1));s.setTimeout(1000,()=>{s.destroy();process.exit(1);});" >nul 2>&1
if %errorlevel% neq 0 (
    echo run "launch_vite_server.bat" first
    echo.
    if "%HALLU_NO_PAUSE%"=="" pause
    exit /b 1
)

set ELECTRON_DEV=true
call npx.cmd electron main.cjs

