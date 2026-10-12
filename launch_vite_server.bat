@echo off
setlocal
title Hallu - Vite Dev Server
cd /d "%~dp0bin"

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
