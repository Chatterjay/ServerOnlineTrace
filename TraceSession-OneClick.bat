@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=start"

if /I not "%ACTION%"=="start" if /I not "%ACTION%"=="update" if /I not "%ACTION%"=="reinstall" (
    echo Usage:
    echo   TraceSession-OneClick.bat
    echo   TraceSession-OneClick.bat update
    echo   TraceSession-OneClick.bat reinstall
    exit /b 1
)

set "REPO_ZIP=https://github.com/Chatterjay/ServerOnlineTrace/archive/refs/heads/master.zip"
set "APP_VERSION=1.1.0"
set "ROOT=%~dp0"
set "INSTALL_DIR=%ROOT%TraceSession-Web"
set "DATA_DIR=%ROOT%TraceSession-Data"
set "TOOLS=%ROOT%.tracesession-tools"
set "NODE_HOME=%TOOLS%\node"
set "NODE_EXE=%NODE_HOME%\node.exe"
set "ZIP_FILE=%TOOLS%\ServerOnlineTrace.zip"
set "EXTRACT_DIR=%TOOLS%\extract"

echo ========================================
echo TraceSession one-click web setup/start
echo ========================================
echo Mode: %ACTION%
echo.
echo Put the TraceSession mod JAR into your Minecraft server mods folder.
echo Web panel: http://localhost:27890
echo.

call :ensure_node
if errorlevel 1 goto :fail

if /I "%ACTION%"=="update" call :refresh_app
if errorlevel 1 goto :fail
if /I "%ACTION%"=="reinstall" call :refresh_app
if errorlevel 1 goto :fail

call :download_app
if errorlevel 1 goto :fail

set "BACKEND=%INSTALL_DIR%\Timing Server Record Backend\backend"
set "FRONTEND=%INSTALL_DIR%\Timing Server Record Backend\frontend"

if not exist "%BACKEND%\startup.mjs" (
    echo Backend was not found at:
    echo %BACKEND%
    goto :fail
)

if not exist "%FRONTEND%\package.json" (
    echo Frontend was not found at:
    echo %FRONTEND%
    goto :fail
)

call :restore_data
if errorlevel 1 goto :fail

if /I "%ACTION%"=="start" if exist "%FRONTEND%\dist\index.html" if exist "%FRONTEND%\node_modules" if exist "%BACKEND%\node_modules" (
    echo Existing setup looks ready. Fast starting web panel...
    goto :start_app
)

echo Preparing web panel...
echo.

if /I "%ACTION%"=="start" if exist "%FRONTEND%\node_modules" (
    echo [1/4] Frontend dependencies already installed.
    echo.
    goto :build_frontend
)

echo [1/4] Installing frontend dependencies...
cd /d "%FRONTEND%" || goto :fail
call npm install
if errorlevel 1 goto :fail
echo.

:build_frontend
if /I "%ACTION%"=="start" if exist "%FRONTEND%\dist\index.html" (
    echo [2/4] Frontend build already exists.
    echo.
    goto :install_backend
)

echo [2/4] Building frontend...
cd /d "%FRONTEND%" || goto :fail
call npm run build
if errorlevel 1 goto :fail
echo.

:install_backend
if /I "%ACTION%"=="start" if exist "%BACKEND%\node_modules" (
    echo [3/4] Backend dependencies already installed.
    echo.
    goto :start_app
)

echo [3/4] Installing backend dependencies...
cd /d "%BACKEND%" || goto :fail
call npm install
if errorlevel 1 goto :fail
echo.

:start_app
echo [4/4] Initializing database and starting web panel...
echo Mod config: backendUrl = "http://localhost:27890"
echo.
call :check_port
if errorlevel 1 goto :fail
cd /d "%BACKEND%" || goto :fail
call node startup.mjs
goto :end

:ensure_node
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    for /f %%V in ('node -p "parseInt(process.versions.node.split(\".\")[0], 10)"') do set "NODE_MAJOR=%%V"
    if !NODE_MAJOR! GEQ 20 exit /b 0
    echo Existing Node.js is too old, major version: !NODE_MAJOR!. Downloading portable LTS.
)

if exist "%NODE_EXE%" (
    set "PATH=%NODE_HOME%;%PATH%"
    exit /b 0
)

echo Node.js was not found. Downloading portable Node.js...
if not exist "%TOOLS%" mkdir "%TOOLS%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$tools=$env:TOOLS; $nodeHome=$env:NODE_HOME;" ^
  "$arch='win-x64';" ^
  "$index=Invoke-RestMethod 'https://nodejs.org/dist/index.json';" ^
  "$lts=$index | Where-Object { $_.lts -ne $false } | Select-Object -First 1;" ^
  "if (-not $lts) { throw 'No Node.js LTS release found' }" ^
  "$version=$lts.version;" ^
  "$name='node-' + $version + '-' + $arch;" ^
  "$zip=Join-Path $tools ($name + '.zip');" ^
  "$url='https://nodejs.org/dist/' + $version + '/' + $name + '.zip';" ^
  "Write-Host ('Downloading ' + $url);" ^
  "Invoke-WebRequest -Uri $url -OutFile $zip;" ^
  "if (Test-Path $nodeHome) { Remove-Item -LiteralPath $nodeHome -Recurse -Force }" ^
  "Expand-Archive -LiteralPath $zip -DestinationPath $tools -Force;" ^
  "Move-Item -LiteralPath (Join-Path $tools $name) -Destination $nodeHome;"

if errorlevel 1 exit /b 1
set "PATH=%NODE_HOME%;%PATH%"
exit /b 0

:refresh_app
echo Refreshing TraceSession web app. Data will be kept in TraceSession-Data.
call :check_port
if errorlevel 1 exit /b 1
call :backup_data
if errorlevel 1 exit /b 1
if exist "%INSTALL_DIR%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference='Stop'; Remove-Item -LiteralPath $env:INSTALL_DIR -Recurse -Force;"
)
exit /b %ERRORLEVEL%

:backup_data
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
set "DB_BACKED_UP=0"
set "DB1=%INSTALL_DIR%\Timing Server Record Backend\backend\prisma\data\tracesession.db"
set "DB2=%INSTALL_DIR%\Timing Server Record Backend\backend\data\tracesession.db"
if exist "%DB1%" (
    copy /Y "%DB1%" "%DATA_DIR%\tracesession.db" >nul
    set "DB_BACKED_UP=1"
)
if "%DB_BACKED_UP%"=="0" if exist "%DB2%" (
    copy /Y "%DB2%" "%DATA_DIR%\tracesession.db" >nul
    set "DB_BACKED_UP=1"
)
if "%DB_BACKED_UP%"=="1" echo Database saved to %DATA_DIR%\tracesession.db
exit /b 0

:restore_data
if exist "%DATA_DIR%\tracesession.db" (
    if not exist "%BACKEND%\prisma\data" mkdir "%BACKEND%\prisma\data"
    copy /Y "%DATA_DIR%\tracesession.db" "%BACKEND%\prisma\data\tracesession.db" >nul
    echo Database restored from %DATA_DIR%\tracesession.db
)
exit /b 0

:download_app
if exist "%INSTALL_DIR%\Timing Server Record Backend\backend\startup.mjs" (
    set "INSTALLED_VERSION="
    if exist "%INSTALL_DIR%\.tracesession-version" set /p INSTALLED_VERSION=<"%INSTALL_DIR%\.tracesession-version"
    if /I "!INSTALLED_VERSION!"=="%APP_VERSION%" (
        echo Existing web app found:
        echo %INSTALL_DIR%
        echo Version: %APP_VERSION%
        echo.
        exit /b 0
    )
    echo Existing web app is old or unmarked. Updating to %APP_VERSION% and keeping data.
    call :backup_data
    if errorlevel 1 exit /b 1
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference='Stop'; Remove-Item -LiteralPath $env:INSTALL_DIR -Recurse -Force;"
    if errorlevel 1 exit /b 1
)

echo Downloading TraceSession web app...
if not exist "%TOOLS%" mkdir "%TOOLS%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$zip=$env:ZIP_FILE; $extract=$env:EXTRACT_DIR; $install=$env:INSTALL_DIR; $url=$env:REPO_ZIP;" ^
  "if (Test-Path $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }" ^
  "New-Item -ItemType Directory -Force -Path $extract | Out-Null;" ^
  "Write-Host ('Downloading ' + $url);" ^
  "Invoke-WebRequest -Uri $url -OutFile $zip;" ^
  "Expand-Archive -LiteralPath $zip -DestinationPath $extract -Force;" ^
  "$src=Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1;" ^
  "if (-not $src) { throw 'Extracted source directory not found' }" ^
  "if (Test-Path $install) { Remove-Item -LiteralPath $install -Recurse -Force }" ^
  "Move-Item -LiteralPath $src.FullName -Destination $install;"

if errorlevel 1 exit /b 1
> "%INSTALL_DIR%\.tracesession-version" echo %APP_VERSION%
exit /b %ERRORLEVEL%

:check_port
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$listener=Get-NetTCPConnection -LocalPort 27890 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1;" ^
  "if (-not $listener) { exit 0 }" ^
  "try {" ^
  "  $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:27890/api/health' -TimeoutSec 2;" ^
  "  if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {" ^
  "    Write-Host ('Stopping existing TraceSession process PID ' + $listener.OwningProcess);" ^
  "    Stop-Process -Id $listener.OwningProcess -Force;" ^
  "    Start-Sleep -Seconds 2;" ^
  "    exit 0;" ^
  "  }" ^
  "} catch {}" ^
  "Write-Host ('Port 27890 is already used by PID ' + $listener.OwningProcess);" ^
  "exit 11"

set "PORT_STATUS=%ERRORLEVEL%"
if "%PORT_STATUS%"=="11" (
    echo.
    echo Port 27890 is already in use by another process.
    echo Close that program or change HTTP_PORT before starting TraceSession.
    exit /b 1
)
exit /b 0

:fail
echo.
echo Setup failed. Send me the error text above.
pause
exit /b 1

:end
echo.
echo Service stopped.
pause
