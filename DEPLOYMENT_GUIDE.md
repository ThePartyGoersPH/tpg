# 🚀 Production Deployment Guide - March 30, 2026

This guide covers deploying all recent updates to your Kamatera production server.

---

## 📋 Updates to Deploy

### 1. **Payment Redirect URL Fix**
- Fixed subscription payments redirecting to customer website
- Now properly redirects to manager app

### 2. **Maintenance Mode Fix**
- Fixed maintenance mode not working (wrong database query)
- Now properly blocks non-admin users during maintenance

### 3. **User Banning Fix**
- Added global user ban check in authentication
- Banned users now properly blocked from all access

### 4. **Permit Expiry Notification System** (if not deployed yet)
- Database migration for permit tracking
- Daily scheduler for expiry checks
- Email notifications
- Super admin dashboard

---

## 🔧 Pre-Deployment Checklist

- [ ] Backup current database
- [ ] Backup current code
- [ ] Note current PM2 process status
- [ ] Have SSH access to Kamatera server
- [ ] Have database credentials ready

---

## 📦 Step-by-Step Deployment

### Step 1: Connect to Kamatera Server

```bash
# SSH into your Kamatera server
ssh root@your-server-ip
# or
ssh your-username@your-server-ip
```

---

### Step 2: Backup Current System

```bash
# Navigate to project directory
cd /path/to/thesis-backend

# Backup database
mysqldump -u your_db_user -p your_database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup current code
cd ..
tar -czf thesis-backend-backup-$(date +%Y%m%d_%H%M%S).tar.gz thesis-backend/
```

---

### Step 3: Update Backend Code

```bash
# Navigate to backend directory
cd /path/to/thesis-backend

# Stash any local changes (if any)
git stash

# Pull latest code
git pull origin main
# or if you're using a different branch
git pull origin your-branch-name

# If you stashed changes, review them
git stash list
```

---

### Step 4: Install/Update Dependencies

```bash
# Install any new dependencies
npm install

# Verify node-cron is installed (for permit expiry scheduler)
npm list node-cron
```

---

### Step 5: Update Environment Variables

```bash
# Edit .env file
nano .env
# or
vim .env
```

**Add/Update these variables:**

```bash
# ============================================
# FRONTEND URLS (IMPORTANT - Payment Redirects)
# ============================================

# Customer Website (for customer reservations/orders)
FRONTEND_URL=https://thepartygoers.fun

# Manager/Bar Owner App (for subscriptions, payroll, etc.)
BAR_OWNER_APP_URL=https://baroperations.thepartygoers.fun

# Super Admin App
SUPER_ADMIN_URL=https://superadmin.thepartygoers.fun

# API URL
API_URL=https://api.thepartygoers.fun

# ============================================
# EMAIL SETTINGS (for permit expiry notifications)
# ============================================

SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-email-password

# ============================================
# DATABASE
# ============================================

DB_HOST=localhost
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_database_name

# ============================================
# JWT & SECURITY
# ============================================

JWT_SECRET=your-jwt-secret

# ============================================
# PAYMONGO
# ============================================

PAYMONGO_SECRET_KEY=your-secret-key
PAYMONGO_PUBLIC_KEY=your-public-key
```

**Save and exit:**
- For nano: `Ctrl+X`, then `Y`, then `Enter`
- For vim: `Esc`, then `:wq`, then `Enter`

---

### Step 6: Run Database Migrations

#### Check if Permit Expiry Migration is Needed

```bash
# Login to MySQL
mysql -u your_db_user -p

# Use your database
USE your_database_name;

# Check if permit expiry columns exist
SHOW COLUMNS FROM bars LIKE 'permit_expiry_date';

# If no results, you need to run the migration
# Exit MySQL
EXIT;
```

#### Run Permit Expiry Migration (if needed)

```bash
# Run the migration
mysql -u your_db_user -p your_database_name < migrations/add_permit_expiry_tracking.sql

# Verify migration
mysql -u your_db_user -p -e "USE your_database_name; SHOW COLUMNS FROM bars LIKE 'permit%';"
mysql -u your_db_user -p -e "USE your_database_name; SHOW TABLES LIKE 'permit_expiry_notifications';"
```

#### Verify Platform Settings Table

```bash
# Check platform_settings table structure
mysql -u your_db_user -p -e "USE your_database_name; DESCRIBE platform_settings;"

# Check if maintenance mode settings exist
mysql -u your_db_user -p -e "USE your_database_name; SELECT * FROM platform_settings WHERE setting_key IN ('maintenance_mode', 'maintenance_message');"

# If no results, insert default settings
mysql -u your_db_user -p -e "USE your_database_name; INSERT INTO platform_settings (setting_key, setting_value, description) VALUES ('maintenance_mode', '0', 'Enable/disable maintenance mode'), ('maintenance_message', '', 'Message shown during maintenance mode') ON DUPLICATE KEY UPDATE setting_key=setting_key;"
```

#### Verify User Ban Columns

```bash
# Check if ban columns exist in users table
mysql -u your_db_user -p -e "USE your_database_name; SHOW COLUMNS FROM users LIKE '%ban%';"

# If columns don't exist, add them
mysql -u your_db_user -p -e "USE your_database_name; ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned TINYINT(1) DEFAULT 0, ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP NULL, ADD COLUMN IF NOT EXISTS banned_by INT NULL, ADD COLUMN IF NOT EXISTS ban_reason TEXT NULL;"

# Add index for performance
mysql -u your_db_user -p -e "USE your_database_name; CREATE INDEX IF NOT EXISTS idx_is_banned ON users(is_banned);"
```

---

### Step 7: Restart Backend Server

#### If using PM2:

```bash
# Check current PM2 processes
pm2 list

# Restart the backend process
pm2 restart thesis-backend

# Or restart all processes
pm2 restart all

# Check logs for any errors
pm2 logs thesis-backend --lines 50

# Verify scheduler started
pm2 logs thesis-backend | grep "Permit expiry checker scheduled"
```

#### If using systemd:

```bash
# Restart service
sudo systemctl restart thesis-backend

# Check status
sudo systemctl status thesis-backend

# Check logs
sudo journalctl -u thesis-backend -n 50 -f
```

#### If running directly with npm:

```bash
# Stop current process (Ctrl+C if running in foreground)
# Or kill the process
pkill -f "node.*index.js"

# Start server
npm start
# or for production
NODE_ENV=production npm start

# Or run in background with nohup
nohup npm start > server.log 2>&1 &
```

---

### Step 8: Update Frontend Apps (if needed)

#### Manager App (baroperations.thepartygoers.fun)

```bash
# Navigate to manager app directory
cd /path/to/manager

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build for production
npm run build

# If using PM2 to serve
pm2 restart manager-app

# Or if copying to web server
cp -r dist/* /var/www/baroperations.thepartygoers.fun/
```

#### Customer App (thepartygoers.fun)

```bash
# Navigate to customer app directory
cd /path/to/customer-app

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build for production
npm run build

# Deploy built files
cp -r dist/* /var/www/thepartygoers.fun/
```

---

### Step 9: Verify Deployment

#### Check Backend is Running

```bash
# Check if backend is responding
curl http://localhost:3000/health
# or
curl https://api.thepartygoers.fun/health

# Check PM2 status
pm2 status

# Check for errors in logs
pm2 logs thesis-backend --lines 100 --nostream
```

#### Check Database Connections

```bash
# Test database connection
mysql -u your_db_user -p -e "USE your_database_name; SELECT COUNT(*) FROM users;"
```

#### Check Environment Variables Loaded

```bash
# View PM2 environment
pm2 env 0

# Or check if variables are set
pm2 logs thesis-backend | grep "URL"
```

---

### Step 10: Test Critical Features

#### Test 1: Payment Redirects

```bash
# Test from your local machine or browser
# 1. Login to manager app: https://baroperations.thepartygoers.fun
# 2. Navigate to Subscription page
# 3. Try to subscribe to a plan
# 4. After PayMongo payment, verify redirect goes to:
#    https://baroperations.thepartygoers.fun/subscription/success
```

#### Test 2: Maintenance Mode

```bash
# 1. Login to super admin: https://superadmin.thepartygoers.fun
# 2. Navigate to Platform Settings
# 3. Enable maintenance mode with message: "Testing maintenance mode"
# 4. Save settings
# 5. Logout
# 6. Try logging in as bar owner
# 7. Should see: "Testing maintenance mode"
# 8. Login as super admin again
# 9. Should still be able to access
# 10. Disable maintenance mode
```

#### Test 3: User Banning

```bash
# 1. Login to super admin
# 2. Navigate to Customer Management
# 3. Find a test user
# 4. Click "Ban User"
# 5. Enter reason: "Test ban - will be removed"
# 6. Confirm ban
# 7. Logout
# 8. Try logging in as banned user
# 9. Should see: "Test ban - will be removed"
# 10. Login as super admin
# 11. Unban the user
# 12. Verify user can login again
```

#### Test 4: Permit Expiry Scheduler

```bash
# Check if scheduler is running
pm2 logs thesis-backend | grep "Permit expiry checker scheduled"

# Manually trigger check (if API endpoint exists)
curl -X POST https://api.thepartygoers.fun/api/permit-monitoring/run-check \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"

# Check permit monitoring dashboard
# Login to super admin
# Navigate to Permit Monitoring
# Verify statistics display correctly
```

---

## 🔍 Troubleshooting

### Issue: Backend won't start

```bash
# Check for syntax errors
npm run lint

# Check for missing dependencies
npm install

# Check logs
pm2 logs thesis-backend --err

# Check if port is already in use
lsof -i :3000
# or
netstat -tulpn | grep 3000
```

### Issue: Database connection failed

```bash
# Test database credentials
mysql -u your_db_user -p -h localhost

# Check if MySQL is running
sudo systemctl status mysql

# Check database exists
mysql -u your_db_user -p -e "SHOW DATABASES;"
```

### Issue: Environment variables not loading

```bash
# Check .env file exists
ls -la .env

# Check .env file contents (be careful with sensitive data)
cat .env | grep -v PASSWORD | grep -v SECRET

# Reload PM2 with new environment
pm2 reload thesis-backend --update-env

# Or restart with explicit env file
pm2 restart thesis-backend --env production
```

### Issue: Maintenance mode not working

```bash
# Check platform_settings table
mysql -u your_db_user -p -e "USE your_database_name; SELECT * FROM platform_settings WHERE setting_key LIKE 'maintenance%';"

# Check if settings are being read
pm2 logs thesis-backend | grep -i maintenance

# Manually test query
mysql -u your_db_user -p -e "USE your_database_name; SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('maintenance_mode', 'maintenance_message');"
```

### Issue: User banning not working

```bash
# Check if ban columns exist
mysql -u your_db_user -p -e "USE your_database_name; SHOW COLUMNS FROM users LIKE '%ban%';"

# Check if user is actually banned
mysql -u your_db_user -p -e "USE your_database_name; SELECT id, email, is_banned, ban_reason FROM users WHERE is_banned = 1;"

# Check authentication logs
pm2 logs thesis-backend | grep -i "ban"
```

### Issue: Payment redirects still wrong

```bash
# Check environment variables
echo $BAR_OWNER_APP_URL
echo $FRONTEND_URL

# Check if PM2 has the variables
pm2 env 0 | grep URL

# Restart with environment reload
pm2 restart thesis-backend --update-env

# Check logs for redirect URLs
pm2 logs thesis-backend | grep -i "redirect\|success_url"
```

### Issue: Permit expiry scheduler not running

```bash
# Check if node-cron is installed
npm list node-cron

# Check scheduler initialization
pm2 logs thesis-backend | grep -i "scheduler\|cron"

# Check for errors
pm2 logs thesis-backend --err | grep -i "permit"

# Manually run the checker (if endpoint exists)
curl -X POST http://localhost:3000/api/permit-monitoring/run-check \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 Post-Deployment Monitoring

### Monitor Backend Logs

```bash
# Real-time logs
pm2 logs thesis-backend

# Last 100 lines
pm2 logs thesis-backend --lines 100 --nostream

# Only errors
pm2 logs thesis-backend --err

# Search for specific term
pm2 logs thesis-backend | grep -i "error\|warning"
```

### Monitor Server Resources

```bash
# Check CPU and memory usage
pm2 monit

# Check disk space
df -h

# Check memory
free -h

# Check running processes
top
# or
htop
```

### Monitor Database

```bash
# Check database size
mysql -u your_db_user -p -e "SELECT table_schema AS 'Database', ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' FROM information_schema.TABLES WHERE table_schema = 'your_database_name';"

# Check table sizes
mysql -u your_db_user -p -e "SELECT table_name AS 'Table', ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)' FROM information_schema.TABLES WHERE table_schema = 'your_database_name' ORDER BY (data_length + index_length) DESC;"

# Check active connections
mysql -u your_db_user -p -e "SHOW PROCESSLIST;"
```

---

## 🔐 Security Checklist

- [ ] `.env` file has correct permissions (600)
  ```bash
  chmod 600 .env
  ```
- [ ] Database user has minimal required permissions
- [ ] JWT_SECRET is strong and unique
- [ ] SMTP credentials are secure
- [ ] PayMongo keys are production keys (not test keys)
- [ ] CORS origins are properly configured
- [ ] Rate limiting is enabled
- [ ] SSL certificates are valid
  ```bash
  # Check SSL certificate
  openssl s_client -connect api.thepartygoers.fun:443 -servername api.thepartygoers.fun
  ```

---

## 📝 Deployment Checklist

### Pre-Deployment
- [ ] Backed up database
- [ ] Backed up code
- [ ] Reviewed all changes
- [ ] Tested locally

### Deployment
- [ ] Connected to server
- [ ] Pulled latest code
- [ ] Updated environment variables
- [ ] Ran database migrations
- [ ] Installed dependencies
- [ ] Restarted backend
- [ ] Updated frontend (if needed)

### Post-Deployment
- [ ] Backend is running
- [ ] No errors in logs
- [ ] Database connections working
- [ ] Payment redirects working
- [ ] Maintenance mode working
- [ ] User banning working
- [ ] Permit expiry scheduler running
- [ ] All critical features tested

---

## 🆘 Rollback Plan

If something goes wrong:

### Rollback Code

```bash
# Stop current server
pm2 stop thesis-backend

# Restore from backup
cd /path/to/backups
tar -xzf thesis-backend-backup-YYYYMMDD_HHMMSS.tar.gz
cp -r thesis-backend/* /path/to/thesis-backend/

# Restart server
cd /path/to/thesis-backend
pm2 restart thesis-backend
```

### Rollback Database

```bash
# Stop backend first
pm2 stop thesis-backend

# Restore database
mysql -u your_db_user -p your_database_name < backup_YYYYMMDD_HHMMSS.sql

# Restart backend
pm2 restart thesis-backend
```

---

## 📞 Support

If you encounter issues:

1. **Check logs first:**
   ```bash
   pm2 logs thesis-backend --lines 200
   ```

2. **Check this deployment guide's troubleshooting section**

3. **Review recent changes:**
   ```bash
   git log --oneline -10
   ```

4. **Test in isolation:**
   - Test database connection separately
   - Test API endpoints with curl
   - Check frontend console for errors

---

## ✅ Summary of Changes

### Files Modified

**Backend:**
- `thesis-backend/routes/subscriptionPayments.js` - Fixed payment redirects
- `thesis-backend/services/paymongoService.js` - Fixed default redirect URLs
- `thesis-backend/middlewares/requireAuth.js` - Fixed maintenance mode & added ban check
- `thesis-backend/routes/permitMonitoring.js` - New permit monitoring endpoints
- `thesis-backend/jobs/permitExpiryChecker.js` - New permit expiry checker
- `thesis-backend/jobs/scheduler.js` - New scheduler
- `thesis-backend/index.js` - Added permit monitoring routes & scheduler

**Database:**
- `migrations/add_permit_expiry_tracking.sql` - New permit tracking tables

**Frontend:**
- `manager/src/pages/PermitMonitoring.jsx` - New permit monitoring page
- `manager/src/App.jsx` - Added permit monitoring route
- `manager/src/utils/navigationGroups.js` - Added permit monitoring nav
- `manager/src/utils/permissions.js` - Added permit monitoring permissions

### Environment Variables Added
- `BAR_OWNER_APP_URL` - Manager app URL for payment redirects
- `FRONTEND_URL` - Customer website URL
- `SUPER_ADMIN_URL` - Super admin app URL

---

**Deployment Date:** March 30, 2026  
**Version:** Production Update v1.0  
**Estimated Deployment Time:** 15-30 minutes
