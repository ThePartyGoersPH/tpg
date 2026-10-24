#!/usr/bin/env bash
# ============================================================
# deploy.sh  — idempotent VPS deploy script
# Run from the repo root on the VPS:  ./deploy.sh
# Stops on first error.
# ============================================================
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/thesis-backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$HOME/thesis-frontend}"
BACKEND_PORT="${BACKEND_PORT:-3000}"
BASE_URL="${BASE_URL:-https://thepartygoers.partygoers.online}"

cd "$REPO_DIR"

echo "=== 1. git pull ==="
git pull --ff-only

echo "=== 2. npm ci ==="
npm ci --omit=dev

echo "=== 3. check-env ==="
node scripts/check-env.js

echo "=== 4. DB backup ==="
TS=$(date +%Y%m%d_%H%M)
mkdir -p ~/backups
ENV_FILE="$REPO_DIR/.env"
DBNAME=$(grep "^DB_NAME=" "$ENV_FILE" | cut -d= -f2-)
mysqldump --single-transaction --routines --triggers --events --no-tablespaces \
  --default-character-set=utf8mb4 "$DBNAME" | gzip > ~/backups/predeploy_${TS}.sql.gz
echo "Backup: ~/backups/predeploy_${TS}.sql.gz"

echo "=== 5. run migrations ==="
npm run migrate

echo "=== 6. build frontend (production env) ==="
cd "$FRONTEND_DIR"
# Ensure .env.production exists
if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found in $FRONTEND_DIR"
  exit 1
fi
npm ci
npm run build
cd "$REPO_DIR"

echo "=== 7. restart backend ==="
pm2 restart thesis-backend --update-env
sleep 3

echo "=== 8. recent logs ==="
pm2 logs thesis-backend --lines 30 --nostream

echo "=== 9. smoke test ==="
node scripts/smoke-test.js "$BASE_URL"

echo ""
echo "==================================="
echo "  DEPLOY RESULT: PASS"
echo "==================================="