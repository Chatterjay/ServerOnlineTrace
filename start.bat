@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "BACKEND=%ROOT%Timing Server Record Backend\backend"
set "FRONTEND=%ROOT%Timing Server Record Backend\frontend"
set "TOOLS=%ROOT%.tools"
set "NODE_HOME=%TOOLS%\node"
set "NODE_EXE=%NODE_HOME%\node.exe"

echo ========================================
echo TraceSession one-click setup and start
echo ========================================
echo.

call :ensure_node
if errorlevel 1 goto :fail

echo [1/5] Node.js:
node -v
echo [1/5] npm:
npm -v
echo.

echo [2/5] Installing frontend dependencies...
cd /d "%FRONTEND%" || goto :fail
call npm install
if errorlevel 1 goto :fail
echo.

echo [3/5] Building frontend...
call npm run build
if errorlevel 1 goto :fail
echo.

echo [4/5] Installing backend dependencies...
cd /d "%BACKEND%" || goto :fail
call npm install
if errorlevel 1 goto :fail
echo.

echo [5/5] Initializing database and starting website...
echo URL: http://localhost:27890
echo Minecraft mod config: backendUrl = "http://localhost:27890"
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

echo Node.js was not found. Downloading portable Node.js into this project...
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

:fail
echo.
echo Setup failed. Send me the error text above.
pause
exit /b 1

:end
echo.
echo Service stopped.
pause
