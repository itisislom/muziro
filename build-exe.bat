@echo off
title Building Muziro Desktop
echo ===================================================
echo   Building Muziro Desktop Executable (.exe)
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/2] Compiling and Publishing Release Build...
dotnet publish desktop/Muziro.csproj -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -o dist/

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build failed! Please check the error above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Build Succeeded!
echo Output executable: %~dp0dist\Muziro.exe
echo.
echo Launching Muziro...
start "" "%~dp0dist\Muziro.exe"
