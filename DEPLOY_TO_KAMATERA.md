# Kamatera Ubuntu Deployment Guide
# thepartygoers.fun

## Domains
| Domain | App | Folder on server |
|---|---|---|
| `thepartygoers.fun` | customer_website | `/var/www/customer` |
| `baroperations.thepartygoers.fun` | manager | `/var/www/manager` |
| `superadmin.thepartygoers.fun` | super_admin_web | `/var/www/admin` |
| `api.thepartygoers.fun` | thesis-backend | runs on port 3000 via PM2 |

---

## PART 1 — DNS Setup (do this first, before touching the server)

In your domain registrar (wherever you bought `thepartygoers.fun`), add these **A records** pointing to your Kamatera server IP:

| Type | Name | Value |
|---|---|---|
| A | `@` | `<YOUR_SERVER_IP>` |
| A | `www` | `<YOUR_SERVER_IP>` |
| A | `baroperations` | `<YOUR_SERVER_IP>` |
| A | `superadmin` | `<YOUR_SERVER_IP>` |
| A | `api` | `<YOUR_SERVER_IP>` |

> DNS can take up to 24 hours to propagate. You can continue with server setup in the meantime.

---

## PART 2 — Initial Server Setup

SSH into your Kamatera Ubuntu server:
```bash
ssh root@<YOUR_SERVER_IP>
```

### 2.1 Update system
```bash
apt update && apt upgrade -y
```

### 2.2 Install Node.js 20 (LTS)
```bash
# Remove old Node.js if present
apt remove -y nodejs libnode-dev libnode72
apt autoremove -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # should show v20.x.x
npm -v
```

### 2.3 Install PM2 (process manager for Node.js)
```bash
npm install -g pm2
```

### 2.4 Install Nginx
```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 2.5 Install MySQL
```bash
apt install -y mysql-server
mysql_secure_installation
# Follow prompts: set root password, remove anonymous users, etc.
```

### 2.6 Install Certbot (for HTTPS/SSL)
```bash
apt install -y certbot python3-certbot-nginx
```

---

## PART 3 — MySQL Database Setup

```bash
mysql -u root -p
```

Inside MySQL shell:
```sql
CREATE DATABASE bar_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tpguser'@'localhost' IDENTIFIED BY 'CHOOSE_A_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON bar_platform.* TO 'tpguser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**Verify the user was created:**
```bash
mysql -u root -p -e "SELECT User, Host FROM mysql.user WHERE User='tpguser';"
```
If it shows `tpguser | localhost`, the user exists. If not, re-run the CREATE USER command above.

Import your SQL dump (use root to avoid DEFINER privilege errors):
```bash
mysql -u root -p bar_platform < /var/tmp/tpg.sql
# Enter your MySQL root password
```

> Upload the `.sql` file from your Windows machine to the server with:
> ```bash
> # Run this on your Windows machine (PowerShell or Git Bash):
> scp "C:\Users\Admin\Desktop\reset\websites\tpg (29).sql" root@<YOUR_SERVER_IP>:/var/tmp/tpg.sql
> ```

---

## PART 4 — Upload & Setup Backend (thesis-backend)

### 4.1 Upload code to server
On your **Windows machine** (PowerShell):
```powershell
# Upload entire websites folder (exclude node_modules and .git)
scp -r "C:\Users\Admin\Desktop\reset\websites\thesis-backend" root@114.29.237.62:/var/www/thesis-backend
```

Or use SCP/SFTP with FileZilla if you prefer a GUI.

### 4.2 Create backend .env on the server
```bash
nano /var/www/thesis-backend/.env
```

Paste and fill in your values:
```env
DB_HOST=localhost
DB_USER=tpguser
DB_PASS=CHOOSE_A_STRONG_PASSWORD
DB_NAME=bar_platform
PORT=3000
NODE_ENV=production

APP_URL=https://api.thepartygoers.fun

JWT_SECRET=GENERATE_A_LONG_RANDOM_STRING_HERE

PAYMONGO_PUBLIC_KEY=pk_test_uHiDG8vsuVs2iFBsftJX1ArS
PAYMONGO_SECRET_KEY=sk_test_BqFrwKNSo5CHfPYM4yjMqYFb
PAYMONGO_WEBHOOK_SECRET=whsk_7ygDo1yH4kyRWL3YduR9je3g

PLATFORM_FEE_PERCENTAGE=5.00

MAX_FILE_SIZE=5242880
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/gif,image/webp

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=thepartygoers3@gmail.com
SMTP_PASSWORD=vgsrzftqisivgdib

GOOGLE_CLIENT_ID=1009351315796-o4ifpjodup8svb72g98gjl6bsi8o9hn1.apps.googleusercontent.com

TZ=Asia/Manila
```

> To generate a strong JWT_SECRET, run: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### 4.3 Install dependencies and start with PM2
```bash
cd /var/www/thesis-backend
npm install --production
pm2 start index.js --name "tpg-api" --env production
pm2 save
pm2 startup
# Run the command that pm2 startup prints out
```

### 4.4 Verify backend is running
```bash
pm2 status
curl http://localhost:3000/health
# Should return: {"ok":true,"message":"API is running"}
```

---

## PART 5 — Build Frontends (on your Windows machine)

Before building, you need to set the production API URL in each frontend.

### 5.1 customer_website
Create/edit `C:\Users\Admin\Desktop\reset\websites\customer_website\.env`:
```env
VITE_API_URL=https://api.thepartygoers.fun
```
Then build:
```powershell
cd C:\Users\Admin\Desktop\reset\websites\customer_website
npm install
npm run build
# Output: dist/ folder
```

### 5.2 manager
Create/edit `C:\Users\Admin\Desktop\reset\websites\manager\.env`:
```env
VITE_API_URL=https://api.thepartygoers.fun
```
Then build:
```powershell
cd C:\Users\Admin\Desktop\reset\websites\manager
npm install
npm run build
# Output: dist/ folder
```

### 5.3 super_admin_web
Create/edit `C:\Users\Admin\Desktop\reset\websites\super_admin_web\.env`:
```env
VITE_API_BASE_URL=https://api.thepartygoers.fun
```
> Note: super_admin_web uses `VITE_API_BASE_URL` (not `VITE_API_URL`) — this is intentional.
Then build:
```powershell
cd C:\Users\Admin\Desktop\reset\websites\super_admin_web
npm install
npm run build
# Output: dist/ folder
```

---

## PART 6 — Upload Frontend Builds to Server

Run these from your **Windows machine** (PowerShell):
```powershell
# Create web directories on server first
ssh root@114.29.237.62 "mkdir -p /var/www/customer /var/www/manager /var/www/admin"

# Upload each dist folder
scp -r "C:\Users\Admin\Desktop\reset\websites\customer_website\dist\*" root@114.29.237.62:/var/www/customer/
scp -r "C:\Users\Admin\Desktop\reset\websites\manager\dist\*" root@114.29.237.62:/var/www/manager/
scp -r "C:\Users\Admin\Desktop\reset\websites\super_admin_web\dist\*" root@114.29.237.62:/var/www/admin/
```

Set correct permissions on server:
```bash
chown -R www-data:www-data /var/www/customer /var/www/manager /var/www/admin
chmod -R 755 /var/www/customer /var/www/manager /var/www/admin
```

---

## PART 7 — Configure Nginx

### 7.1 Copy the config file
Upload or copy `thesis.conf.txt` to the server:
```bash
# From Windows PowerShell:
scp "C:\Users\Admin\Desktop\reset\websites\thesis.conf.txt" root@114.29.237.62:/etc/nginx/sites-available/thepartygoers.conf
```

Then enable it on the server:
```bash
ln -s /etc/nginx/sites-available/thepartygoers.conf /etc/nginx/sites-enabled/thepartygoers.conf

# Remove default nginx site if it exists
rm -f /etc/nginx/sites-enabled/default

# Test config syntax
nginx -t

# If it says "syntax is ok" and "test is successful":
systemctl reload nginx
```

### 7.2 Test HTTP (before SSL)
Open in browser:
- `http://thepartygoers.fun` → should show customer website
- `http://baroperations.thepartygoers.fun` → should show manager
- `http://superadmin.thepartygoers.fun` → should show super admin
- `http://api.thepartygoers.fun/health` → should return `{"ok":true,...}`

---

## PART 8 — SSL with Let's Encrypt (HTTPS)

Once DNS is pointing to your server and HTTP is working:

```bash
certbot --nginx -d thepartygoers.fun -d www.thepartygoers.fun -d baroperations.thepartygoers.fun -d superadmin.thepartygoers.fun -d api.thepartygoers.fun
```

Follow the prompts:
- Enter your email
- Agree to terms
- Choose option **2** (Redirect HTTP to HTTPS) when asked

Certbot will automatically modify your nginx config to add SSL.

Verify auto-renewal works:
```bash
certbot renew --dry-run
```

---

## PART 9 — Troubleshooting

### 502 Bad Gateway on API
This means nginx can't reach the Node.js backend.
```bash
# Check if backend is running
pm2 status
pm2 logs tpg-api --lines 50

# Check if it's listening on port 3000
ss -tlnp | grep 3000

# Restart if needed
pm2 restart tpg-api
```

### 502 Bad Gateway on frontend sites
This won't happen for static sites — check if the `dist/` files were uploaded correctly:
```bash
ls -la /var/www/customer/
ls -la /var/www/manager/
ls -la /var/www/admin/
# Each should have index.html and assets/ folder
```

### Nginx won't reload (syntax error)
```bash
nginx -t
# Read the error message and check /etc/nginx/sites-available/thepartygoers.conf
```

### Backend crashes on startup
```bash
pm2 logs tpg-api --lines 100
# Most common causes:
# - Wrong DB credentials in .env
# - Missing .env values
# - Port 3000 already in use: lsof -i :3000
```

### Check nginx error logs
```bash
tail -f /var/log/nginx/error.log
```

---

## PART 10 — Useful PM2 Commands

```bash
pm2 status              # View all running processes
pm2 logs tpg-api        # View live logs
pm2 restart tpg-api     # Restart backend
pm2 stop tpg-api        # Stop backend
pm2 delete tpg-api      # Remove process
pm2 monit               # Live dashboard
```

---

## PART 11 — Re-deploying After Code Changes

### Update backend:
```bash
# From Windows, upload new backend files:
scp -r "C:\Users\Admin\Desktop\reset\websites\thesis-backend" root@<YOUR_SERVER_IP>:/var/www/thesis-backend-new
# Then on server, swap and restart

# Or just upload changed files and restart:
pm2 restart tpg-api
```

### Update a frontend:
```powershell
# On Windows: rebuild
npm run build

# Re-upload dist
scp -r "C:\Users\Admin\Desktop\reset\websites\customer_website\dist\*" root@<YOUR_SERVER_IP>:/var/www/customer/
```
No nginx restart needed for static file updates.

---

## Quick Summary Checklist

- [ ] DNS A records pointing to server IP
- [ ] Node.js 20, PM2, Nginx, MySQL, Certbot installed
- [ ] MySQL database `bar_platform` created and SQL imported
- [ ] Backend `.env` filled with real credentials
- [ ] Backend running via PM2 (`pm2 status` shows online)
- [ ] `curl http://localhost:3000/health` returns OK
- [ ] All 3 frontends built with `VITE_API_URL=https://api.thepartygoers.fun`
- [ ] `dist/` folders uploaded to `/var/www/customer`, `/var/www/manager`, `/var/www/admin`
- [ ] Nginx config in place and `nginx -t` passes
- [ ] Nginx reloaded
- [ ] HTTP sites working
- [ ] SSL obtained with certbot
- [ ] HTTPS sites working
