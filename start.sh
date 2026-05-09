#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/Timing Server Record Backend/backend"
FRONTEND="$ROOT/Timing Server Record Backend/frontend"

# ── 检测 Node.js ──
if ! command -v node &>/dev/null; then
    echo "[...] Node.js not found, opening download page..." >&2
    if command -v xdg-open &>/dev/null; then
        xdg-open "https://nodejs.org" &>/dev/null
    elif command -v open &>/dev/null; then
        open "https://nodejs.org" &>/dev/null
    fi
    echo "Please install Node.js and re-run this script."
    exit 1
fi

echo "[..] Installing frontend dependencies..."
cd "$FRONTEND"
npm install

echo "[..] Building frontend..."
npm run build

echo "[..] Starting TraceSession backend..."
cd "$BACKEND"
npm start
