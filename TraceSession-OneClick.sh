#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-start}"
case "$ACTION" in
  start|update|reinstall) ;;
  *)
    echo "Usage:"
    echo "  ./TraceSession-OneClick.sh"
    echo "  ./TraceSession-OneClick.sh update"
    echo "  ./TraceSession-OneClick.sh reinstall"
    exit 1
    ;;
esac

REPO_ZIP="https://github.com/Chatterjay/ServerOnlineTrace/archive/refs/heads/master.zip"
APP_VERSION="1.1.0"
ROOT="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="$ROOT/TraceSession-Web"
DATA_DIR="$ROOT/TraceSession-Data"
TOOLS="$ROOT/.tracesession-tools"
NODE_HOME="$TOOLS/node"
ZIP_FILE="$TOOLS/ServerOnlineTrace.zip"
EXTRACT_DIR="$TOOLS/extract"

echo "========================================"
echo "TraceSession one-click web setup/start"
echo "========================================"
echo "Mode: $ACTION"
echo
echo "Put the TraceSession mod JAR into your Minecraft server mods folder."
echo "Web panel: http://localhost:27890"
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

backup_data() {
  mkdir -p "$DATA_DIR"
  local db1="$INSTALL_DIR/Timing Server Record Backend/backend/prisma/data/tracesession.db"
  local db2="$INSTALL_DIR/Timing Server Record Backend/backend/data/tracesession.db"
  if [ -f "$db1" ]; then
    cp -f "$db1" "$DATA_DIR/tracesession.db"
    echo "Database saved to $DATA_DIR/tracesession.db"
  elif [ -f "$db2" ]; then
    cp -f "$db2" "$DATA_DIR/tracesession.db"
    echo "Database saved to $DATA_DIR/tracesession.db"
  fi
}

restore_data() {
  local backend="$INSTALL_DIR/Timing Server Record Backend/backend"
  if [ -f "$DATA_DIR/tracesession.db" ]; then
    mkdir -p "$backend/prisma/data"
    cp -f "$DATA_DIR/tracesession.db" "$backend/prisma/data/tracesession.db"
    echo "Database restored from $DATA_DIR/tracesession.db"
  fi
}

download_app() {
  if [ -f "$INSTALL_DIR/Timing Server Record Backend/backend/startup.mjs" ]; then
    local installed_version=""
    if [ -f "$INSTALL_DIR/.tracesession-version" ]; then
      installed_version="$(cat "$INSTALL_DIR/.tracesession-version" || true)"
    fi
    if [ "$installed_version" = "$APP_VERSION" ]; then
      echo "Existing web app found: $INSTALL_DIR"
      echo "Version: $APP_VERSION"
      echo
      return
    fi
    echo "Existing web app is old or unmarked. Updating to $APP_VERSION and keeping data."
    backup_data
    rm -rf "$INSTALL_DIR"
  fi

  echo "Downloading TraceSession web app..."
  mkdir -p "$TOOLS"
  rm -rf "$EXTRACT_DIR"
  mkdir -p "$EXTRACT_DIR"
  download "$REPO_ZIP" "$ZIP_FILE"

  if command -v unzip >/dev/null 2>&1; then
    unzip -q "$ZIP_FILE" -d "$EXTRACT_DIR"
  elif command -v python3 >/dev/null 2>&1; then
    python3 - "$ZIP_FILE" "$EXTRACT_DIR" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    z.extractall(sys.argv[2])
PY
  else
    echo "unzip or python3 is required for extracting the web app."
    exit 1
  fi

  local src
  src="$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [ -z "$src" ]; then
    echo "Extracted source directory not found."
    exit 1
  fi
  rm -rf "$INSTALL_DIR"
  mv "$src" "$INSTALL_DIR"
  printf '%s\n' "$APP_VERSION" > "$INSTALL_DIR/.tracesession-version"
}

refresh_app() {
  echo "Refreshing TraceSession web app. Data will be kept in TraceSession-Data."
  check_port
  backup_data
  rm -rf "$INSTALL_DIR"
}

ensure_node

if [ "$ACTION" = "update" ] || [ "$ACTION" = "reinstall" ]; then
  refresh_app
fi

download_app

BACKEND="$INSTALL_DIR/Timing Server Record Backend/backend"
FRONTEND="$INSTALL_DIR/Timing Server Record Backend/frontend"

if [ ! -f "$BACKEND/startup.mjs" ]; then
  echo "Backend was not found at: $BACKEND"
  exit 1
fi

if [ ! -f "$FRONTEND/package.json" ]; then
  echo "Frontend was not found at: $FRONTEND"
  exit 1
fi

restore_data

if [ "$ACTION" = "start" ] && [ -f "$FRONTEND/dist/index.html" ] && [ -d "$FRONTEND/node_modules" ] && [ -d "$BACKEND/node_modules" ]; then
  echo "Existing setup looks ready. Fast starting web panel..."
else
  echo "Preparing web panel..."
  echo
  if [ "$ACTION" != "start" ] || [ ! -d "$FRONTEND/node_modules" ]; then
    echo "[1/4] Installing frontend dependencies..."
    (cd "$FRONTEND" && npm install)
    echo
  else
    echo "[1/4] Frontend dependencies already installed."
    echo
  fi

  if [ "$ACTION" != "start" ] || [ ! -f "$FRONTEND/dist/index.html" ]; then
    echo "[2/4] Building frontend..."
    (cd "$FRONTEND" && npm run build)
    echo
  else
    echo "[2/4] Frontend build already exists."
    echo
  fi

  if [ "$ACTION" != "start" ] || [ ! -d "$BACKEND/node_modules" ]; then
    echo "[3/4] Installing backend dependencies..."
    (cd "$BACKEND" && npm install)
    echo
  else
    echo "[3/4] Backend dependencies already installed."
    echo
  fi
fi

echo "[4/4] Initializing database and starting web panel..."
echo "Mod config: backendUrl = \"http://localhost:27890\""
echo
check_port
cd "$BACKEND"
node startup.mjs
