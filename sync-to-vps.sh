#!/bin/bash
# sync-to-vps.sh — re-sync local Mac data + uploads to the VPS.
# ASKS FOR CONFIRMATION before overwriting production. Never run blindly.
set -e
VPS=ubuntu@168.107.95.8
REMOTE_PROJ=/var/www/my-project
STAMP=$(date +%Y%m%d-%H%M)

echo "This will OVERWRITE the production database with your LOCAL data."
read -p "Type SYNC to continue: " CONFIRM
[ "$CONFIRM" = "SYNC" ] || { echo "Aborted."; exit 1; }

echo "==> 1. Backup VPS database first"
ssh $VPS "DBP=\$(grep '^DB_PASS=' $REMOTE_PROJ/thesis-backend/.env | cut -d= -f2); MYSQL_PWD=\"\$DBP\" mysqldump -h 127.0.0.1 -u tpg_user --single-transaction --no-tablespaces --routines --triggers --events tpg 2>/dev/null | gzip > /var/backups/tpg/pre-sync-$STAMP.sql.gz && echo backup-ok"

echo "==> 2. Dump local DB"
/Applications/XAMPP/xamppfiles/bin/mysqldump -u root --default-character-set=utf8mb4 \
  --single-transaction --routines --triggers --events tpg > /tmp/tpg_local_sync.sql

echo "==> 3. Upload dump + import on VPS"
scp /tmp/tpg_local_sync.sql $VPS:/tmp/tpg_local_sync.sql
ssh $VPS "DBP=\$(grep '^DB_PASS=' $REMOTE_PROJ/thesis-backend/.env | cut -d= -f2); MYSQL_PWD=\"\$DBP\" mysql -h 127.0.0.1 -u tpg_user tpg < /tmp/tpg_local_sync.sql && rm /tmp/tpg_local_sync.sql && echo import-ok"

echo "==> 4. Re-run migrations (re-adds VPS-only columns if dump lacks them)"
ssh $VPS "cd $REMOTE_PROJ/thesis-backend && node scripts/migrate.js 2>&1 | tail -2"

echo "==> 5. Rsync uploads (no --delete: stray VPS files survive)"
rsync -avz --no-perms thesis-backend/uploads/ $VPS:$REMOTE_PROJ/thesis-backend/uploads/
ssh $VPS "sudo chown -R ubuntu:www-data $REMOTE_PROJ/thesis-backend/uploads && sudo chmod -R 775 $REMOTE_PROJ/thesis-backend/uploads && echo perms-ok"

echo "==> 6. Restart backend + smoke test"
ssh $VPS "cd $REMOTE_PROJ/thesis-backend && pm2 restart thesis-backend >/dev/null 2>&1; sleep 5; curl -s --max-time 8 http://localhost/api/bars?limit=2 | head -c 200; echo"
echo "DONE. Verify Pegazus/Fooboo on the live site."
