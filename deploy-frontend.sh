#!/usr/bin/env bash
# deploy-frontend.sh — Deploy customer frontend to VPS
set -euo pipefail

REPO_DIR="/var/www/my-project"
FRONTEND_DIR="$REPO_DIR/customer_website"
# nginx serves the repo's build folder directly (verified in /etc/nginx/sites-enabled/default)
NGINX_ROOT="$FRONTEND_DIR/dist"
BRANCH="main"

echo "=== 1. Fetch and checkout branch ==="
cd "$REPO_DIR"
git fetch origin
git checkout "$BRANCH"
git pull --ff-only

echo "=== 2. Install dependencies ==="
cd "$FRONTEND_DIR"
npm ci

echo "=== 3. Build with production env ==="
VITE_API_URL=https://thepartygoers.partygoers.online/api npm run build

echo "=== 4. Backup old build ==="
if [ -d "$NGINX_ROOT" ]; then
  sudo cp -r "$NGINX_ROOT" "${NGINX_ROOT}.backup.$(date +%Y%m%d_%H%M)"
  echo "Old build backed up"
fi

echo "=== 5. Copy new build (overwrite in place — nothing deleted) ==="
sudo cp -r "$FRONTEND_DIR/dist/"* "$NGINX_ROOT/"

echo "=== 6. Reload nginx ==="
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "==================================="
echo "  FRONTEND DEPLOY: DONE"
echo "  Build version: $(cd $FRONTEND_DIR && git rev-parse --short HEAD)"
echo "==================================="