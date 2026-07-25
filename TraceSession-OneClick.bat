@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "APP_NAME=TraceSession"
set "REPO_ZIP=https://github.com/Chatterjay/ServerOnlineTrace/archive/refs/heads/master.zip"
set "ROOT=%~dp0"
set "INSTALL_DIR=%ROOT%TraceSession-Web"
set "TOOLS=%ROOT%.tracesession-tools"
set "NODE_HOME=%TOOLS%\node"
set "NODE_EXE=%NODE_HOME%\node.exe"
set "ZIP_FILE=%TOOLS%\ServerOnlineTrace.zip"
set "EXTRACT_DIR=%TOOLS%\extract"

echo ========================================
echo TraceSession one-click web installer
echo ========================================
echo.
echo Put this BAT beside the TraceSession mod JAR.
echo The BAT installs and starts the web panel.
echo Put the JAR into your Minecraft server mods folder.
echo.

call :ensure_node
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

echo [1/4] Installing frontend dependencies...
cd /d "%FRONTEND%" || goto :fail
call npm install
if errorlevel 1 goto :fail
echo.

echo [2/4] Building frontend...
call npm run build
if errorlevel 1 goto :fail
echo.

echo [3/4] Installing backend dependencies...
cd /d "%BACKEND%" || goto :fail
call npm install
if errorlevel 1 goto :fail
echo.

echo [4/4] Initializing database and starting web panel...
echo.
echo Web panel: http://localhost:27890
echo Mod config: backendUrl = "http://localhost:27890"
echo.
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

:download_app
if exist "%INSTALL_DIR%\Timing Server Record Backend\backend\startup.mjs" (
    echo Existing web app found:
    echo %INSTALL_DIR%
    echo.
    exit /b 0
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

exit /b %ERRORLEVEL%

:fail
echo.
echo Setup failed. Send me the error text above.
pause
exit /b 1

:end
echo.
echo Service stopped.
pause
