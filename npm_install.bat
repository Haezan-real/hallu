@echo off
setlocal
title Hallu - Install Dependencies
cd /d "%~dp0bin"

echo ========================================================
echo  Hallu: Installing dependencies in bin...
echo ========================================================
echo.

call npm.cmd install

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Dependencies installed successfully!
) else (
    echo.
    echo [ERROR] An error occurred while installing dependencies.
)

echo.
pause
