# The Party Goers — Backend

## Run Locally

### Prerequisites
- Node.js 18+ (v24 tested)
- MySQL 8.0+ or MariaDB 10.4+ running locally
- (Optional) XAMPP for local MySQL

### Setup
```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.local.example .env.local
# Edit .env.local — fill in DB credentials, generate keys:
#   ID_ENCRYPTION_KEY: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#   ID_HASH_KEY:       node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Validate env
npm run check-env

# 4. Run migrations
npm run migrate

# 5. Create private-uploads folder (auto-created on start, but ensure 700 perms)
mkdir -p private-uploads/ids private-uploads/keys private-uploads/tmp
chmod 700 private-uploads

# 6. Start backend
npm run dev
# Backend runs on http://localhost:3000
```

### Start all frontends locally
```bash
# In separate terminals:
cd ../customer_website && npm run dev   # http://localhost:5173
cd ../manager && npm run dev            # http://localhost:5174
cd ../pos_website && npm run dev        # http://localhost:4173
cd ../super_admin_web && npm run dev    # http://localhost:5175
```

### Testing without real emails
Set `MAIL_ENABLED=false` in `.env.local`. Verification codes and links are printed to the console instead of being emailed.

### Testing without Vision quota
Set `OCR_PROVIDER=none` (no OCR calls) or `OCR_PROVIDER=mock` (returns canned synthetic results). Also set `OCR_MONTHLY_HARD_LIMIT=50` to cap local usage.

### Test the full flow locally
1. Register a customer → code printed to console → verify email
2. Upload ID → OCR checklist appears (mock/none)
3. Admin reviews (image viewer works) → reject with reason → email → resubmit → approve
4. Customer logs in
5. Private image URL returns 404 for everyone from the browser
6. Readiness card (admin Settings) all green

## Deploy to the VPS

### One-time setup (on the VPS)
```bash
# 1. Create folders
sudo mkdir -p /var/lib/thepartygoers/private-uploads/{ids,keys,tmp}
sudo chown -R ubuntu:ubuntu /var/lib/thepartygoers
chmod 700 /var/lib/thepartygoers/private-uploads
chmod 700 /var/lib/thepartygoers/private-uploads/{ids,keys,tmp}

# 2. Upload Vision key (from your Mac)
# scp vision-sa.json ubuntu@168.107.95.8:/etc/thepartygoers/vision-sa.json
sudo mkdir -p /etc/thepartygoers
sudo mv /tmp/vision-sa.json /etc/thepartygoers/vision-sa.json
sudo chmod 600 /etc/thepartygoers/vision-sa.json
sudo chown root:root /etc/thepartygoers/vision-sa.json

# 3. Set production .env
cp .env.production.example .env
# Edit .env — fill in DB, JWT, keys, mail credentials

# 4. Validate
npm run check-env

# 5. Nginx config
sudo cp nginx-thepartygoers.conf /etc/nginx/sites-available/thepartygoers.partygoers.online
sudo ln -s /etc/nginx/sites-available/thepartygoers.partygoers.online /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 6. PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # follow the printed command

# 7. Oracle Cloud: verify outbound HTTPS to Google APIs
curl -sI https://vision.googleapis.com | head -5
# If it fails, check VCN Security List: Egress rules must allow 0.0.0.0/0 on TCP 443
```

### Repeatable deploy
```bash
./deploy.sh
```

### Cron jobs (single instance only)
Set `CRON_ENABLED=true` on exactly ONE PM2 instance. If running in cluster mode, use a DB lock row to prevent double execution.

## npm scripts
| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend with nodemon |
| `npm run start` | Start backend (production) |
| `npm run check-env` | Validate .env, exit non-zero on failure |
| `npm run smoke:local` | Smoke test against localhost |
| `npm run smoke:prod` | Smoke test against production |
| `npm run migrate` | Run database migrations |
| `npm run purge-ids` | Purge expired ID images |