@echo off
setlocal
title Hallu - Vite Server
cd /d "%~dp0bin"

echo ========================================================
echo  Hallu: Building and Starting Vite Dev Server
echo ========================================================
echo.

echo [1/2] Building frontend assets...
call npm.cmd run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build failed! Check the errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Starting Vite dev server on 0.0.0.0:5173...
echo.
call npm.cmd run dev -- --host 0.0.0.0
