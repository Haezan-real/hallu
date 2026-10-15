@echo off
setlocal
title Hallu - Build
cd /d "%~dp0bin"

echo ========================================================
echo  Hallu: Building the app in bin...
echo ========================================================
echo.

call npm.cmd run build

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Build finished! hallu_editor.exe will use it next launch.
) else (
    echo.
    echo [ERROR] An error occurred while building.
)

echo.
pause
