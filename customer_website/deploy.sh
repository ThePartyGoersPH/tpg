#!/usr/bin/env bash
# Deploy script for The Party Goers customer website
# Usage: ./deploy.sh

set -euo pipefail

# === MANUAL STEPS (do once) ===
# 1. Add env vars to server .env:
#    ID_STORAGE_PATH=/var/lib/partygoers/private-uploads
#    ID_ENCRYPTION_KEY=$(openssl rand -base64 32)
#    ID_HASH_KEY=$(openssl rand -base64 32)
#    OCR_PROVIDER=google_vision
#    GOOGLE_APPLICATION_CREDENTIALS=/var/lib/partygoers/vision-sa.json
#    OCR_MONTHLY_HARD_LIMIT=1000
#    ID_MAX_ATTEMPTS=3
# 2. Create private ID folder:
#    sudo mkdir -p /var/lib/partygoers/private-uploads
#    sudo chown -R partygoers:partygoers /var/lib/partygoers/private-uploads
#    sudo chmod 700 /var/lib/partygoers/private-uploads
# 3. Set nginx client_max_body_size 15m; in server block
# 4. Reload nginx: sudo nginx -t && sudo systemctl reload nginx

# === REPEATABLE DEPLOY ===
echo "=== Pulling latest code ==="
git pull

echo "=== Installing backend dependencies ==="
cd thesis-backend 2>/dev/null || cd ../thesis-backend 2>/dev/null || true
npm ci

echo "=== Installing frontend dependencies ==="
cd ../customer_website 2>/dev/null || cd . 2>/dev/null || true
npm ci

echo "=== DB backup ==="
# mysqldump -u root -p partygoers > /backup/partygoers_$(date +%Y%m%d_%H%M%S).sql

echo "=== Running migrations ==="
cd ../thesis-backend 2>/dev/null || true
# node scripts/run-migrations.js

echo "=== Building frontend ==="
cd ../customer_website 2>/dev/null || cd . 2>/dev/null || true
VITE_API_URL=https://thepartygoers.partygoers.online/api npm run build

echo "=== Copying build to nginx folder ==="
# sudo cp -r dist/* /var/www/partygoers/customer/

echo "=== Restarting backend ==="
pm2 restart thesis-backend --update-env
pm2 logs thesis-backend --lines 40 --nostream

echo "=== Reloading nginx ==="
sudo nginx -t && sudo systemctl reload nginx

echo "=== Deploy complete ==="
echo "Check: https://thepartygoers.partygoers.online/register (hard refresh Cmd+Shift+R)"