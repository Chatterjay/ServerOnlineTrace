#!/usr/bin/env bash
# Run this script on your Debian VM to start PostgreSQL Docker container
set -e

if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker not found. Install Docker first:"
    echo "  curl -fsSL https://get.docker.com | sh"
    exit 1
fi

echo "Starting PostgreSQL on Debian VM..."

if docker ps -a --format "{{.Names}}" | grep -q "^tracesession-db$"; then
    docker start tracesession-db > /dev/null 2>&1
    echo "    Container already exists, started."
else
    docker run -d \
        --name tracesession-db \
        -e POSTGRES_USER=tracesession \
        -e POSTGRES_PASSWORD=tracesession \
        -e POSTGRES_DB=tracesession \
        -p 5432:5432 \
        postgres:16 > /dev/null 2>&1
    echo "    New container created and started."
fi

echo "Waiting for PostgreSQL to be ready..."
until docker exec tracesession-db pg_isready -U tracesession > /dev/null 2>&1; do
    sleep 1
done

echo ""
echo "===== PostgreSQL ready ====="
echo "Host: $(hostname -I | awk '{print $1}')"
echo "Port: 5432"
echo "User: tracesession"
echo "Pass: tracesession"
echo "DB:   tracesession"
echo "Connection string: postgresql://tracesession:tracesession@<this-vm-ip>:5432/tracesession"
