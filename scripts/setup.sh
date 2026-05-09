#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."
ROOT=$(pwd)
BACKEND="$ROOT/Timing Server Record Backend/backend"
FRONTEND="$ROOT/Timing Server Record Backend/frontend"

echo "===== TraceSession 一键部署脚本 (Mac/Linux) ====="
echo ""

# 检查依赖
command -v node >/dev/null 2>&1 || { echo "需要安装 Node.js (>=22)"; exit 1; }
command -v npx  >/dev/null 2>&1 || { echo "需要安装 npx"; exit 1; }

echo "[1/5] 安装后端依赖..."
cd "$BACKEND"
npm install

echo "[2/5] 生成 SSL 证书..."
mkdir -p ssl
if [ ! -f ssl/key.pem ]; then
  openssl req -x509 -newkey rsa:2048 -keyout ssl/key.pem -out ssl/cert.pem \
    -days 3650 -nodes -subj "/CN=localhost" 2>/dev/null
  echo "  SSL 证书已生成"
else
  echo "  SSL 证书已存在，跳过"
fi

echo "[3/5] 配置数据库..."
echo "  请确保 PostgreSQL 已启动，然后编辑:"
echo "    $BACKEND/.env"
echo "  将 DATABASE_URL 改为你的数据库连接字符串"
echo "  按回车继续..."
read -r

echo "[4/5] 同步数据库..."
npx prisma db push --accept-data-loss
npx prisma generate

echo "[5/5] 构建前端..."
cd "$FRONTEND"
npm install
npm run build

echo ""
echo "===== 部署完成 ====="
echo "启动后端: cd $BACKEND && npx tsx src/index.ts"
echo "后端地址: http://localhost:27890 | https://localhost:27891"
echo "前端构建产物: $FRONTEND/dist/"
echo ""
echo "如使用 Nginx, 将前端 dist 目录指向 Web 根目录,"
echo "并将 /api 反向代理到 http://localhost:27890"
