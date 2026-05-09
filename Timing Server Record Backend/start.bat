@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ===== TraceSession Backend =====
echo.
set /p PG_HOST=Enter Debian VM IP (default: 172.31.4.157):
if "%PG_HOST%"=="" set PG_HOST=172.31.4.157

set DATABASE_URL=postgresql://tracesession:tracesession@%PG_HOST%:5432/tracesession

echo [1/2] Installing backend dependencies...
cd backend
call npm install --silent >nul 2>&1
call npx prisma generate >nul 2>&1
call npx prisma db push >nul 2>&1
cd ..
echo     Done

echo [2/2] Starting services...
start "TraceSession-Backend" cmd /c "set DATABASE_URL=postgresql://tracesession:tracesession@%PG_HOST%:5432/tracesession && cd /d "%~dp0backend" && npm run dev"
start "TraceSession-Frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ===== Started =====
echo Backend:  http://localhost:4560
echo Frontend: http://localhost:5173
echo.
echo Press any key to stop all services...
pause >nul

taskkill /f /fi "WINDOWTITLE eq TraceSession-Backend" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq TraceSession-Frontend" >nul 2>&1
