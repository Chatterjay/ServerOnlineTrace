@echo off
set ROOT=%~dp0
set BACKEND=%ROOT%Timing Server Record Backend\backend
set FRONTEND=%ROOT%Timing Server Record Backend\frontend

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [..] Node.js not found, opening download page...
    start https://nodejs.org
    pause
    where node >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [..] Still not found. Please install Node.js and try again.
        pause
        exit /b 1
    )
)

echo [..] Installing frontend dependencies...
cd /d "%FRONTEND%"
call npm install

echo [..] Building frontend...
call npm run build

echo [..] Starting TraceSession backend...
cd /d "%BACKEND%"
npm start
pause
