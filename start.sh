#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/Timing Server Record Backend/backend"
FRONTEND="$ROOT/Timing Server Record Backend/frontend"
TOOLS="$ROOT/.tools"
NODE_HOME="$TOOLS/node"

echo "========================================"
echo "TraceSession source setup and start"
echo "========================================"
echo

download() {
  local url="$1"
  local out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -L "$url" -o "$out"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$out" "$url"
  else
    echo "curl or wget is required for downloading."
    exit 1
  fi
}

ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node -p 'parseInt(process.versions.node.split(".")[0], 10)')"
    if [ "$major" -ge 20 ]; then
      return
    fi
    echo "Existing Node.js is too old, major version: $major. Downloading portable LTS."
  fi

  if [ -x "$NODE_HOME/bin/node" ]; then
    export PATH="$NODE_HOME/bin:$PATH"
    return
  fi

  mkdir -p "$TOOLS"
  local os arch node_arch version name tarball
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *) echo "Unsupported OS: $os"; exit 1 ;;
  esac
  case "$arch" in
    x86_64|amd64) node_arch="x64" ;;
    aarch64|arm64) node_arch="arm64" ;;
    *) echo "Unsupported CPU architecture: $arch"; exit 1 ;;
  esac

  if command -v python3 >/dev/null 2>&1; then
    version="$(python3 - <<'PY'
import json, urllib.request
with urllib.request.urlopen("https://nodejs.org/dist/index.json") as r:
    releases = json.load(r)
for item in releases:
    if item.get("lts"):
        print(item["version"])
        break
PY
)"
  else
    version="v22.18.0"
  fi

  name="node-${version}-${os}-${node_arch}"
  tarball="$TOOLS/${name}.tar.xz"
  echo "Downloading Node.js $version..."
  download "https://nodejs.org/dist/${version}/${name}.tar.xz" "$tarball"
  rm -rf "$NODE_HOME" "$TOOLS/$name"
  tar -xJf "$tarball" -C "$TOOLS"
  mv "$TOOLS/$name" "$NODE_HOME"
  export PATH="$NODE_HOME/bin:$PATH"
}

check_port() {
  local pid=""
  if command -v lsof >/dev/null 2>&1; then
    pid="$(lsof -tiTCP:27890 -sTCP:LISTEN | head -n 1 || true)"
  elif command -v ss >/dev/null 2>&1; then
    pid="$(ss -ltnp 'sport = :27890' 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | head -n 1 || true)"
  fi

  if [ -z "$pid" ]; then
    return
  fi

  if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 2 "http://localhost:27890/api/health" >/dev/null 2>&1; then
    echo "Stopping existing TraceSession process PID $pid"
    kill "$pid" || true
    sleep 2
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" || true
      sleep 1
    fi
    return
  fi

  echo "Port 27890 is already used by PID $pid."
  echo "Close that program or change HTTP_PORT before starting TraceSession."
  exit 1
}

ensure_node

echo "[1/5] Node.js:"
node -v
echo "[1/5] npm:"
npm -v
echo

echo "[2/5] Installing frontend dependencies..."
(cd "$FRONTEND" && npm install)
echo

echo "[3/5] Building frontend..."
(cd "$FRONTEND" && npm run build)
echo

echo "[4/5] Installing backend dependencies..."
(cd "$BACKEND" && npm install)
echo

echo "[5/5] Initializing database and starting website..."
echo "URL: http://localhost:27890"
echo "Minecraft mod config: backendUrl = \"http://localhost:27890\""
echo
check_port
cd "$BACKEND"
node startup.mjs
