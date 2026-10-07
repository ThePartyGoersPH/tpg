# Timezone Fix - Comments & Notifications Showing Wrong Time

**Date:** March 30, 2026  
**Issue:** Comments and notifications showing "8 hrs ago" when they should be recent

---

## 🐛 Root Cause

**The Problem:**
- Backend was storing timestamps in Philippine Time (UTC+8)
- Frontend was interpreting timestamps as UTC
- This created an 8-hour offset

**Example:**
```
Comment created at: 2:00 AM Manila time (March 30, 2026)
Stored in database: 2026-03-30 02:00:00 (Manila time)
Frontend reads as:    2026-03-30 02:00:00Z (interprets as UTC)
User sees:            "8 hours ago" (because frontend thinks it's 8 hours behind)
```

---

## ✅ Solution

**Changed backend to use UTC for all timestamps:**

### 1. Database Connection Timezone
**File:** `thesis-backend/config/database.js`

**Before:**
```javascript
timezone: '+08:00', // Philippine Time (Asia/Manila)
```

**After:**
```javascript
timezone: 'Z', // Store timestamps in UTC for consistent frontend display
```

### 2. Node.js Process Timezone
**File:** `thesis-backend/index.js`

**Before:**
```javascript
// Set timezone to Philippine Time (Asia/Manila) for all Node.js operations
process.env.TZ = 'Asia/Manila';
```

**After:**
```javascript
// Use UTC for all timestamps to ensure consistency with frontend
// Frontend will handle timezone conversion for display
process.env.TZ = 'UTC';
```

---

## 🔄 How It Works Now

### Backend (UTC)
- All `NOW()` calls store timestamps in UTC
- All `created_at`, `updated_at` fields in UTC
- Consistent timestamp storage

### Frontend (User's Local Time)
- `parseUTC()` function correctly interprets UTC timestamps
- Browser automatically converts to user's local timezone
- "X hours ago" calculations are accurate

### Example Flow
```
1. User posts comment at 2:00 AM Manila time
2. Backend stores: 2026-03-29 18:00:00 (UTC, which is 2:00 AM Manila)
3. Frontend receives: 2026-03-29 18:00:00
4. parseUTC() adds 'Z': 2026-03-29T18:00:00Z
5. Browser converts to Manila: March 30, 2:00 AM
6. Shows: "just now" or "5 minutes ago"
```

---

## 🚀 Deployment Steps

### Step 1: Update Backend Code

```bash
# SSH into server
ssh root@your-kamatera-server

# Navigate to backend
cd /path/to/thesis-backend

# Pull latest changes
git pull origin main
```

### Step 2: Restart Backend

```bash
# Restart with PM2
pm2 restart thesis-backend

# Verify timezone is UTC
pm2 logs thesis-backend --lines 20 | grep TZ

# Check server is running
pm2 status
```

### Step 3: Verify Fix

**Test Comments:**
1. Login to manager app
2. Go to Social or Events page
3. Post a new comment
4. Should show "just now"
5. Wait 1 minute, refresh
6. Should show "1 minute ago"

**Test Notifications:**
1. Trigger a notification (e.g., like a post)
2. Check notifications
3. Should show correct time

---

## ⚠️ Important Notes

### Existing Data
**Old timestamps in database are in Manila time (UTC+8)**

If you have existing data, you have two options:

#### Option A: Leave Old Data As-Is (Recommended)
- Old timestamps will appear 8 hours off
- New timestamps will be correct
- Over time, old data becomes less relevant

#### Option B: Migrate Old Data to UTC
```sql
-- WARNING: Test this on a backup first!
-- This converts existing timestamps from Manila time to UTC

-- Update comments
UPDATE event_comments 
SET created_at = CONVERT_TZ(created_at, '+08:00', '+00:00'),
    updated_at = CONVERT_TZ(updated_at, '+08:00', '+00:00')
WHERE created_at < '2026-03-30 00:00:00';

-- Update bar_post_comments
UPDATE bar_post_comments 
SET created_at = CONVERT_TZ(created_at, '+08:00', '+00:00'),
    updated_at = CONVERT_TZ(updated_at, '+08:00', '+00:00')
WHERE created_at < '2026-03-30 00:00:00';

-- Update notifications
UPDATE notifications 
SET created_at = CONVERT_TZ(created_at, '+08:00', '+00:00')
WHERE created_at < '2026-03-30 00:00:00';

-- Update other tables as needed
-- (reservations, orders, payments, etc.)
```

**⚠️ Only run migration if:**
- You have a recent database backup
- You've tested on a development database first
- You understand the impact on all timestamp fields

---

## 📋 Testing Checklist

### Test Comments
- [ ] Post a new comment on an event
- [ ] Should show "just now"
- [ ] Wait 1 minute, refresh
- [ ] Should show "1 minute ago"
- [ ] Reply to a comment
- [ ] Should show correct time

### Test Notifications
- [ ] Like a post (triggers notification)
- [ ] Check notifications page
- [ ] Should show "just now"
- [ ] Create a reservation
- [ ] Check notification time
- [ ] Should be accurate

### Test Social Feed
- [ ] Create a new post
- [ ] Should show current time
- [ ] Check post timestamp
- [ ] Should match current time

### Test Reservations
- [ ] Create a new reservation
- [ ] Check created_at timestamp
- [ ] Should show current time

---

## 🐛 Troubleshooting

### Issue: Still showing 8 hours ago

**Check backend timezone:**
```bash
# SSH into server
pm2 logs thesis-backend --lines 50

# Look for TZ environment variable
# Should be UTC, not Asia/Manila
```

**Restart backend:**
```bash
pm2 restart thesis-backend --update-env
```

**Clear browser cache:**
- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Or clear cache in browser settings

### Issue: Old comments still wrong

**This is expected** - old data is in Manila time.

**Options:**
1. Leave it (recommended) - new data will be correct
2. Run migration script (risky) - converts all old data to UTC

### Issue: Scheduler times wrong

**Check scheduler timezone:**

The permit expiry scheduler uses:
```javascript
timezone: 'Asia/Manila'
```

This is **correct** - scheduler should run at 2:00 AM Manila time.

**Scheduler timezone is separate from data storage timezone:**
- Scheduler runs at Manila time (when to run)
- Data stored in UTC (what time it ran)

---

## 📊 Impact on Other Features

### ✅ No Impact (Handled Correctly)
- Reservations - frontend uses `parseUTC()`
- Orders - frontend uses `parseUTC()`
- Payments - frontend uses `parseUTC()`
- Events - frontend uses `parseUTC()`
- Attendance - uses date-fns with UTC parsing

### ⚠️ May Need Verification
- Email timestamps - check if emails show correct time
- Reports - verify date ranges work correctly
- Payroll - verify period dates are accurate

---

## 🔍 Technical Details

### Why UTC?

**Benefits:**
1. **Consistency** - Same timestamp regardless of server location
2. **No DST issues** - UTC doesn't observe daylight saving
3. **International** - Works for users in any timezone
4. **Standard practice** - Industry best practice

### How Frontend Handles Timezones

**Frontend uses `parseUTC()` function:**
```javascript
export const parseUTC = (ts) => {
  if (!ts) return null;
  const s = String(ts).trim();
  // Already has timezone info
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  // MySQL format: '2026-03-25 06:46:00' → '2026-03-25T06:46:00Z'
  return new Date(s.replace(' ', 'T') + 'Z');
};
```

**This ensures:**
- MySQL timestamps are interpreted as UTC
- Browser converts to user's local timezone
- "X ago" calculations are accurate

---

## ✅ Summary

**What Changed:**
- ✅ Backend now stores all timestamps in UTC
- ✅ Database connection uses UTC timezone
- ✅ Node.js process uses UTC timezone
- ✅ Frontend correctly interprets UTC timestamps

**What Didn't Change:**
- ✅ Scheduler still runs at Manila time (2:00 AM PHT)
- ✅ Frontend display logic unchanged
- ✅ User experience unchanged (sees local time)

**Result:**
- ✅ Comments show correct "X ago" time
- ✅ Notifications show correct time
- ✅ All timestamps accurate
- ✅ No more 8-hour offset

---

**Deployment Time:** 2-5 minutes  
**Downtime:** None (just restart backend)  
**Risk:** Low (only affects new timestamps)
