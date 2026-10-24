#!/usr/bin/env bash
# ============================================================
# run-local.sh  — Start backend + all frontends with fixed ports
# Usage: ./run-local.sh
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/thesis-backend"
FRONTENDS="$ROOT"

echo "=== Starting The Party Goers (local) ==="

# Backend
cd "$BACKEND"
if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found. Copy from .env.local.example first."
  exit 1
fi
npm run free-port 2>/dev/null || true
NODE_ENV=development npm run dev > /tmp/tpg-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend (port 3000): PID $BACKEND_PID"

# Wait for backend to be ready
sleep 4

# Frontends
for dir in customer_website manager pos_website super_admin_web; do
  FE_DIR="$FRONTENDS/$dir"
  if [ -d "$FE_DIR" ]; then
    PORT=""
    case "$dir" in
      customer_website) PORT=5173 ;;
      manager) PORT=5174 ;;
      pos_website) PORT=4173 ;;
      super_admin_web) PORT=5175 ;;
    esac
    cd "$FE_DIR"
    npm run dev -- --port "$PORT" --strictPort > "/tmp/tpg-${dir}.log" 2>&1 &
    echo "$dir (port $PORT): PID $!"
  fi
done

echo ""
echo "=== All services starting ==="
echo "Backend:  http://localhost:3000"
echo "Customer: http://localhost:5173"
echo "Manager:  http://localhost:5174"
echo "POS:      http://localhost:4173"
echo "Admin:    http://localhost:5175"
echo ""
echo "Logs: /tmp/tpg-*.log"
echo "Stop all: pkill -f 'vite|nodemon|node index.js'"