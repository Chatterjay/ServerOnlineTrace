#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

PG_HOST=${1:-localhost}
export DATABASE_URL="postgresql://tracesession:tracesession@${PG_HOST}:5432/tracesession"

echo "===== TraceSession Backend ====="
echo "Database: $DATABASE_URL"
echo ""

echo "[1/2] Installing backend dependencies..."
cd backend
npm install --silent > /dev/null 2>&1
npx prisma generate > /dev/null 2>&1
npx prisma db push > /dev/null 2>&1
cd ..
echo "    Done"

echo "[2/2] Starting services..."
cd backend && DATABASE_URL="$DATABASE_URL" npm run dev &
BACKEND_PID=$!
cd ..

cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "===== Started ====="
echo "Backend:  http://localhost:4560"
echo "Frontend: http://localhost:5173"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
