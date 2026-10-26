#!/usr/bin/env bash
# deploy.sh — The Party Goers: deploy from a git commit (never hand-edit VPS)
# Run sections manually on the VPS as ubuntu. Do NOT run blindly.
set -euo pipefail

VPS="ubuntu@168.107.95.8"
PROJECT="/var/www/my-project"

# ===== 0. Which commit is live? (read-only) =====
# ssh $VPS "cd $PROJECT && git rev-parse HEAD && git log -1 --oneline && git status --short"

# ===== 1. Backend (ID upload / id-scan endpoints) =====
# ssh $VPS
# cd $PROJECT && git pull --ff-only
# cd thesis-backend && npm ci
# # DB backup then migration
# mysqldump -u tpg_user -p'<pw>' tpg > ~/backups/tpg-$(date +%F-%H%M).sql
# mysql -u tpg_user -p'<pw>' tpg < migrations/20261026_customer_approval_index.sql
# # add missing env names WITHOUT overwriting existing values
# grep -q '^ID_STORAGE_PATH=' .env || echo 'ID_STORAGE_PATH=./private-uploads' >> .env
# grep -q '^ID_ENCRYPTION_KEY=' .env || echo 'ID_ENCRYPTION_KEY=<generate>' >> .env
# grep -q '^ID_HASH_KEY=' .env || echo 'ID_HASH_KEY=<generate>' >> .env
# grep -q '^OCR_PROVIDER=' .env || echo 'OCR_PROVIDER=mock' >> .env
# grep -q '^APP_URL=' .env || echo 'APP_URL=https://thepartygoers.partygoers.online' >> .env
# grep -q '^TRUST_PROXY=' .env || echo 'TRUST_PROXY=true' >> .env
# mkdir -p private-uploads/ids && chmod 700 private-uploads
# # nginx client_max_body_size 15m (see block below)
# pm2 restart thesis-backend --update-env
# pm2 logs thesis-backend --lines 40 --nostream

# ===== 2. Customer frontend =====
# cd $PROJECT/customer_website && npm ci
# VITE_API_URL=https://thepartygoers.partygoers.online/api \
# VITE_BAR_OWNER_URL=https://thepartygoers.partygoers.online/manager/ \
#   npm run build
# # back up old build, then copy new build into the folder nginx serves for customer site
# cp -a dist ../customer_website_dist_backup_$(date +%F)
# sudo rsync -a --delete dist/ /var/www/my-project/customer_website/dist/

# ===== 3. nginx =====
# sudo nginx -t && sudo systemctl reload nginx

# ===== Expected nginx block (add to server config) =====
# location /manager/ {
#   alias /var/www/my-project/manager/dist/;
#   try_files $uri $uri/ /manager/index.html;
# }
# location / {
#   root /var/www/my-project/customer_website/dist;
#   try_files $uri $uri/ /index.html;
# }
# client_max_body_size 15m;

# ===== 4. Verify online =====
# curl -s https://thepartygoers.partygoers.online/ | grep -oE '/assets/index-[^"]+\.js'
# hard refresh https://thepartygoers.partygoers.online/register  -> 4-step wizard
# click "For Bar Owners" -> https://thepartygoers.partygoers.online/manager/ loads login
