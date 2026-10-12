@echo off
setlocal
title Hallu Dev Launcher
cd /d "%~dp0bin"

echo ========================================================
echo  Launching Hallu (Developer Mode)
echo ========================================================
echo.

if not exist "node_modules\" (
    echo [INFO] node_modules not found in bin. Installing dependencies...
    call npm.cmd install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b %errorlevel%
    )
)

echo [1/3] Building frontend assets...
call npm.cmd run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed! Check the errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Starting Vite dev server in background...
start /min "Hallu_Vite_Server" cmd.exe /c "npm.cmd run dev -- --host 0.0.0.0"

:: Wait 2 seconds for Vite to initialize
timeout /t 2 /nobreak >nul

echo.
echo [3/3] Launching Hallu Electron...
set ELECTRON_DEV=true
call npx.cmd electron main.cjs

echo.
echo Closing Vite dev server...
taskkill /fi "WINDOWTITLE eq Hallu_Vite_Server*" /t /f >nul 2>&1
echo Done.
