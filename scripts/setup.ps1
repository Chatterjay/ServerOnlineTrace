param(
    [switch]$SkipDB
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BACKEND = Join-Path $ROOT "Timing Server Record Backend\backend"
$FRONTEND = Join-Path $ROOT "Timing Server Record Backend\frontend"

Write-Host "===== TraceSession 一键部署脚本 (Windows) =====" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js
try { node --version | Out-Null } catch {
    Write-Host "需要安装 Node.js (>=22): https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "[1/5] 安装后端依赖..." -ForegroundColor Yellow
Set-Location $BACKEND
npm install

Write-Host "[2/5] 生成 SSL 证书..." -ForegroundColor Yellow
$sslDir = Join-Path $BACKEND "ssl"
if (-not (Test-Path "$sslDir\key.pem")) {
    New-Item -ItemType Directory -Force -Path $sslDir | Out-Null
    openssl req -x509 -newkey rsa:2048 -keyout "$sslDir\key.pem" -out "$sslDir\cert.pem" `
        -days 3650 -nodes -subj "//CN=localhost" 2>$null
    Write-Host "  SSL 证书已生成" -ForegroundColor Green
} else {
    Write-Host "  SSL 证书已存在，跳过" -ForegroundColor Gray
}

Write-Host "[3/5] 配置数据库..." -ForegroundColor Yellow
Write-Host "  请确保 PostgreSQL 已启动，然后编辑:" -ForegroundColor Gray
Write-Host "    $BACKEND\.env" -ForegroundColor Gray
Write-Host "  将 DATABASE_URL 改为你的数据库连接字符串" -ForegroundColor Gray
if (-not $SkipDB) {
    Read-Host "  按回车继续..."
}

Write-Host "[4/5] 同步数据库..." -ForegroundColor Yellow
npx prisma db push --accept-data-loss
npx prisma generate

Write-Host "[5/5] 构建前端..." -ForegroundColor Yellow
Set-Location $FRONTEND
npm install
npm run build

Write-Host ""
Write-Host "===== 部署完成 =====" -ForegroundColor Cyan
Write-Host "启动后端: cd $BACKEND && npx tsx src/index.ts" -ForegroundColor White
Write-Host "后端地址: http://localhost:27890 | https://localhost:27891" -ForegroundColor White
Write-Host "前端构建产物: $FRONTEND\dist\" -ForegroundColor White
