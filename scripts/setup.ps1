$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BACKEND = Join-Path $ROOT "Timing Server Record Backend\backend"
$FRONTEND = Join-Path $ROOT "Timing Server Record Backend\frontend"

Write-Host "===== TraceSession 一键部署脚本 (Windows) =====" -ForegroundColor Cyan
Write-Host ""

try { node --version | Out-Null } catch {
    Write-Host "需要安装 Node.js (>=22): https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] 安装后端依赖..." -ForegroundColor Yellow
Set-Location $BACKEND
npm install

Write-Host "[2/3] 生成 SSL 证书..." -ForegroundColor Yellow
$sslDir = Join-Path $BACKEND "ssl"
if (-not (Test-Path "$sslDir\key.pem")) {
    New-Item -ItemType Directory -Force -Path $sslDir | Out-Null
    openssl req -x509 -newkey rsa:2048 -keyout "$sslDir\key.pem" -out "$sslDir\cert.pem" `
        -days 3650 -nodes -subj "//CN=localhost" 2>$null
    Write-Host "  SSL 证书已生成" -ForegroundColor Green
} else {
    Write-Host "  SSL 证书已存在，跳过" -ForegroundColor Gray
}

Write-Host "[3/3] 构建前端..." -ForegroundColor Yellow
Set-Location $FRONTEND
npm install
npm run build

Write-Host ""
Write-Host "===== 部署完成 =====" -ForegroundColor Cyan
Write-Host "启动后端: cd $BACKEND && npm start" -ForegroundColor White
Write-Host "后端地址: http://localhost:27890 | https://localhost:27891" -ForegroundColor White
Write-Host "前端构建产物: $FRONTEND\dist\" -ForegroundColor White
Write-Host ""
Write-Host "SQLite 默认启用，无需配置数据库即可直接启动。" -ForegroundColor Green
Write-Host "如需切换 PostgreSQL，编辑 backend\.env 中的 DATABASE_URL。" -ForegroundColor Gray
