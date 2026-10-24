# Feature Implementation - PROMPT 6.2

**Date:** March 30, 2026  
**Feature Implemented:** Expired Permit Notification System

---

## 🎯 Overview

Successfully implemented a comprehensive permit expiry monitoring and notification system for the super admin dashboard. This feature automatically tracks business permit expiry dates, sends email warnings 30 days before expiration, flags expired permits, and provides super admin tools to manage bar deactivation/reactivation.

---

## 📋 Feature: Expired Permit Notification (PROMPT 6.2)

### Implementation Status: COMPLETE

**What Was Implemented:**

1. ✅ **Database Schema:**
   - Added `permit_expiry_date` to bars table
   - Added `permit_status` enum (valid, expiring_soon, expired)
   - Created `permit_expiry_notifications` log table
   - Added tracking timestamps for notifications

2. ✅ **Automated Scheduler:**
   - Daily cron job (2:00 AM PHT)
   - Checks for permits expiring in 30 days
   - Sends email warnings to bar owners
   - Automatically flags expired permits

3. ✅ **Email Notifications:**
   - 30-day warning email with action items
   - Professional HTML template
   - Direct link to update permit
   - Clear consequences explained

4. ✅ **Super Admin Dashboard:**
   - Permit monitoring page
   - Statistics overview
   - Filter by status (all, expiring_soon, expired)
   - Manual deactivation capability
   - Reactivation with new expiry date

5. ✅ **API Endpoints:**
   - GET /permit-monitoring/expiring
   - GET /permit-monitoring/stats
   - POST /permit-monitoring/deactivate/:barId
   - POST /permit-monitoring/reactivate/:barId
   - POST /permit-monitoring/run-check (manual trigger)

6. ✅ **Integration:**
   - OCR extracts permit expiry date during registration
   - Expiry date stored in database
   - Automatic monitoring begins after registration approval

---

## 🗄️ Database Changes

### Migration File
**File:** `thesis-backend/migrations/add_permit_expiry_tracking.sql`

### Tables Modified

#### `bars` Table - New Columns
```sql
ALTER TABLE `bars` 
ADD COLUMN `permit_expiry_date` DATE DEFAULT NULL,
ADD COLUMN `permit_status` ENUM('valid', 'expiring_soon', 'expired') DEFAULT 'valid',
ADD COLUMN `permit_expiry_notified_at` TIMESTAMP NULL DEFAULT NULL,
ADD COLUMN `permit_expired_flagged_at` TIMESTAMP NULL DEFAULT NULL;
```

**Indexes Added:**
- `idx_permit_expiry_date` on `permit_expiry_date`
- `idx_permit_status` on `permit_status`

### New Table: `permit_expiry_notifications`

```sql
CREATE TABLE `permit_expiry_notifications` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `notification_type` ENUM('30_day_warning', 'expired_flag') NOT NULL,
  `permit_expiry_date` DATE NOT NULL,
  `email_sent` TINYINT(1) DEFAULT 0,
  `email_sent_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_id` (`bar_id`),
  KEY `idx_notification_type` (`notification_type`),
  CONSTRAINT `fk_permit_notifications_bar` 
    FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE
);
```

**Purpose:** Logs all permit expiry notifications sent to bar owners for audit trail and preventing duplicate notifications.

---

## ⚙️ Backend Implementation

### 1. Permit Expiry Checker Job
**File:** `thesis-backend/jobs/permitExpiryChecker.js`

**Functionality:**
- Runs daily at 2:00 AM Philippine Time
- Queries database for permits expiring in exactly 30 days
- Sends email warning to bar owners
- Updates bar status to 'expiring_soon'
- Logs notification in database
- Queries for permits expired today or earlier
- Updates bar status to 'expired'
- Flags bars for super admin review

**Email Template Features:**
- Professional HTML design
- Clear expiry date display
- Action items checklist
- Consequences explanation
- Direct link to bar management dashboard

### 2. Scheduler Setup
**File:** `thesis-backend/jobs/scheduler.js`

**Configuration:**
```javascript
cron.schedule('0 2 * * *', async () => {
  await checkPermitExpiry();
}, {
  timezone: 'Asia/Manila'
});
```

**Schedule:** Daily at 2:00 AM PHT (optimal time for minimal user impact)

### 3. API Routes
**File:** `thesis-backend/routes/permitMonitoring.js`

**Endpoints:**

#### GET /permit-monitoring/expiring
- **Access:** Super Admin only
- **Purpose:** Get list of bars with expired or expiring permits
- **Query Params:** 
  - `status`: filter by permit_status (optional)
  - `limit`: pagination limit (default: 100)
  - `page`: page number (default: 1)
- **Returns:** Array of bars with permit info, owner details, days until expiry

#### GET /permit-monitoring/stats
- **Access:** Super Admin only
- **Purpose:** Get permit expiry statistics
- **Returns:** 
  - Total bars
  - Valid permits count
  - Expiring soon count
  - Expired permits count
  - Bars without expiry date
  - Recent notifications (last 30 days)

#### POST /permit-monitoring/deactivate/:barId
- **Access:** Super Admin only
- **Purpose:** Manually deactivate a bar due to expired permit
- **Body:** `{ reason: string }`
- **Action:** Sets bar status to 'inactive', logs audit entry

#### POST /permit-monitoring/reactivate/:barId
- **Access:** Super Admin only
- **Purpose:** Reactivate bar after permit renewal
- **Body:** `{ newExpiryDate: date }`
- **Action:** Sets bar status to 'active', resets permit status to 'valid'

#### POST /permit-monitoring/run-check
- **Access:** Super Admin only
- **Purpose:** Manually trigger permit expiry check (for testing)
- **Returns:** Check results (expiring count, expired count)

### 4. Server Integration
**File:** `thesis-backend/index.js`

**Changes:**
- Added `permitMonitoringRoutes` import
- Mounted routes at `/permit-monitoring`
- Started scheduler on server startup
- Added `node-cron` dependency

---

## 🖥️ Frontend Implementation

### 1. Permit Monitoring Dashboard
**File:** `manager/src/pages/PermitMonitoring.jsx`

**Features:**

#### Statistics Cards
- Valid Permits (green)
- Expiring Soon (yellow)
- Expired (red)
- No Date Set (gray)

#### Filter Tabs
- All Issues
- Expiring Soon
- Expired

#### Bar List Display
Each bar card shows:
- Bar name and location
- Status badge (valid/expiring/expired)
- Owner information
- Expiry date
- Days until expiry (color-coded)
- Current bar status
- Last notification timestamp
- Action buttons (Deactivate/Reactivate)

#### Actions
- **Refresh:** Reload data
- **Run Check Now:** Manually trigger expiry check
- **Deactivate:** Disable bar with reason
- **Reactivate:** Re-enable bar with new expiry date

### 2. Navigation Integration

**Files Modified:**
- `manager/src/App.jsx` - Added route
- `manager/src/utils/navigationGroups.js` - Added nav item
- `manager/src/utils/permissions.js` - Added permissions

**Navigation Location:** Settings & Account → Permit Monitoring

**Access:** Super Admin only (`roles: ['super_admin']`)

### 3. Registration Integration

**File:** `manager/src/pages/Register.jsx`

**Changes:**
- OCR extracts permit expiry date from business permit
- User can verify/correct extracted date
- Expiry date sent to backend during registration
- Stored in `business_registrations` table
- Transferred to `bars` table on approval

---

## 📧 Email Notification System

### 30-Day Warning Email

**Subject:** ⚠️ Business Permit Expiring Soon - Action Required

**Content Includes:**
- Personalized greeting
- Warning notice with bar name
- Expiry date (formatted)
- Action items checklist:
  1. Renew permit with government agency
  2. Upload new permit document
  3. Update expiry date in dashboard
- Consequences explanation:
  - Flagged as "Permit Expired" on expiry date
  - Super admin may deactivate listing
  - Customers cannot view or book
- Call-to-action button (Update Permit Now)
- Support contact information

**Design:**
- Professional HTML template
- Responsive layout
- Brand colors (red/white/black)
- Clear visual hierarchy
- Mobile-friendly

---

## 🔄 Workflow

### Automatic Monitoring Flow

1. **Daily Check (2:00 AM PHT):**
   - Scheduler runs `checkPermitExpiry()`
   - Queries database for relevant permits

2. **30-Day Warning:**
   - Finds permits expiring in exactly 30 days
   - Sends email to bar owner
   - Updates `permit_status` to 'expiring_soon'
   - Sets `permit_expiry_notified_at` timestamp
   - Logs notification in `permit_expiry_notifications`

3. **Expiry Day:**
   - Finds permits expired today or earlier
   - Updates `permit_status` to 'expired'
   - Sets `permit_expired_flagged_at` timestamp
   - Logs expiry flag in notifications table
   - Bar appears in super admin dashboard

4. **Super Admin Review:**
   - Views expired permits in dashboard
   - Contacts bar owner (if needed)
   - Manually deactivates bar if not renewed
   - Or reactivates bar with new expiry date

### Manual Deactivation Flow

1. Super admin views expired permit in dashboard
2. Clicks "Deactivate" button
3. Enters deactivation reason (optional)
4. Confirms action
5. Bar status set to 'inactive'
6. Audit log created
7. Bar hidden from customer app

### Reactivation Flow

1. Bar owner renews permit and uploads document
2. Super admin views bar in dashboard
3. Clicks "Reactivate" button
4. Enters new permit expiry date
5. Confirms action
6. Bar status set to 'active'
7. Permit status reset to 'valid'
8. Notification timestamps cleared
9. Audit log created
10. Bar visible in customer app again

---

## 📋 Testing Checklist

### Database Migration
- [ ] Run migration successfully
- [ ] Verify `permit_expiry_date` column exists in `bars`
- [ ] Verify `permit_status` column exists with correct enum values
- [ ] Verify `permit_expiry_notifications` table created
- [ ] Verify indexes created
- [ ] Verify foreign key constraint works

### Backend Scheduler
- [ ] Server starts without errors
- [ ] Scheduler initializes (check console log)
- [ ] Manually trigger check via API endpoint
- [ ] Verify check completes successfully
- [ ] Check database for updated statuses

### Email Notifications
- [ ] Create test bar with expiry date 30 days from now
- [ ] Run manual check
- [ ] Verify email sent to bar owner
- [ ] Check email content and formatting
- [ ] Verify link in email works
- [ ] Check notification logged in database

### API Endpoints
- [ ] GET /permit-monitoring/expiring (no filter)
- [ ] GET /permit-monitoring/expiring?status=expiring_soon
- [ ] GET /permit-monitoring/expiring?status=expired
- [ ] GET /permit-monitoring/stats
- [ ] POST /permit-monitoring/run-check
- [ ] POST /permit-monitoring/deactivate/:barId
- [ ] POST /permit-monitoring/reactivate/:barId
- [ ] Verify super admin access only
- [ ] Test with non-super-admin user (should fail)

### Super Admin Dashboard
- [ ] Login as super admin
- [ ] Navigate to Permit Monitoring page
- [ ] Verify statistics cards display correctly
- [ ] Test filter tabs (All, Expiring Soon, Expired)
- [ ] Verify bar list displays
- [ ] Check status badges are color-coded
- [ ] Verify days until expiry calculation
- [ ] Test "Run Check Now" button
- [ ] Test "Refresh" button

### Deactivation Feature
- [ ] Select bar with expired permit
- [ ] Click "Deactivate" button
- [ ] Enter deactivation reason
- [ ] Confirm action
- [ ] Verify bar status changes to 'inactive'
- [ ] Verify audit log created
- [ ] Check bar hidden from customer app

### Reactivation Feature
- [ ] Select inactive bar
- [ ] Click "Reactivate" button
- [ ] Enter new expiry date
- [ ] Confirm action
- [ ] Verify bar status changes to 'active'
- [ ] Verify permit status reset to 'valid'
- [ ] Verify audit log created
- [ ] Check bar visible in customer app

### Registration Integration
- [ ] Start bar owner registration
- [ ] Upload business permit with OCR
- [ ] Verify expiry date extracted
- [ ] Correct extracted date if needed
- [ ] Complete registration
- [ ] Verify expiry date saved in database
- [ ] Approve registration
- [ ] Verify expiry date transferred to bars table

---

## 🔧 Technical Details

### Cron Schedule
**Pattern:** `0 2 * * *`
**Meaning:** Every day at 2:00 AM
**Timezone:** Asia/Manila (Philippine Time)

**Why 2:00 AM?**
- Low traffic time
- Before business hours
- Allows time for email delivery
- Bar owners see notification in morning

### Date Calculations

**30-Day Warning:**
```javascript
const thirtyDaysFromNow = new Date(today);
thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
```

**Expiry Check:**
```javascript
WHERE permit_expiry_date <= CURDATE()
```

**Days Until Expiry:**
```sql
DATEDIFF(permit_expiry_date, CURDATE()) as days_until_expiry
```

### Notification Deduplication

**Strategy:** Check if notification already sent today
```sql
WHERE (permit_expiry_notified_at IS NULL 
       OR DATE(permit_expiry_notified_at) < CURDATE())
```

**Prevents:**
- Duplicate emails on same day
- Email spam to bar owners
- Unnecessary database writes

### Status Transitions

**Valid → Expiring Soon:**
- Triggered: 30 days before expiry
- Condition: `permit_expiry_date = DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
- Action: Send email, update status

**Expiring Soon → Expired:**
- Triggered: On expiry date
- Condition: `permit_expiry_date <= CURDATE()`
- Action: Flag expired, no email

**Expired → Valid:**
- Triggered: Manual reactivation by super admin
- Condition: Super admin provides new expiry date
- Action: Reset status, clear timestamps

---

## 📝 Notes

### Email Delivery
- Uses existing `sendEmail` utility
- Configured via environment variables
- Supports Nodemailer or Resend
- HTML template with inline CSS
- Fallback to plain text if HTML fails

### Performance Considerations
- Scheduler runs once daily (low overhead)
- Queries optimized with indexes
- Batch processing for multiple bars
- Transaction-based updates (atomic)
- Error handling prevents partial updates

### Audit Trail
- All notifications logged in database
- Deactivation/reactivation logged in audit_logs
- Timestamps tracked for compliance
- Super admin actions attributed to user

### Future Enhancements
1. **SMS Notifications:** Send SMS in addition to email
2. **Multiple Reminders:** 60-day, 14-day, 7-day warnings
3. **Auto-Deactivation:** Automatically deactivate after X days expired
4. **Permit Upload Reminder:** Prompt to upload new permit
5. **Dashboard Widget:** Show expiring permits on main dashboard
6. **Export Reports:** Generate permit expiry reports
7. **Bulk Actions:** Deactivate multiple bars at once
8. **Custom Email Templates:** Allow super admin to customize emails

---

## 🚀 Deployment Steps

### 1. Install Dependencies
```bash
cd thesis-backend
npm install
```

This will install `node-cron@^3.0.3`.

### 2. Run Database Migration
```bash
mysql -u your_username -p your_database_name < migrations/add_permit_expiry_tracking.sql
```

### 3. Verify Migration
```sql
-- Check bars table
DESCRIBE bars;
-- Should show: permit_expiry_date, permit_status, permit_expiry_notified_at, permit_expired_flagged_at

-- Check new table
DESCRIBE permit_expiry_notifications;

-- Check indexes
SHOW INDEX FROM bars WHERE Key_name LIKE 'idx_permit%';
```

### 4. Configure Environment
Ensure email configuration is set in `.env`:
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
FRONTEND_URL=https://baroperations.thepartygoers.fun
```

### 5. Start Server
```bash
npm run dev
# or
npm start
```

Verify scheduler starts:
```
✅ Permit expiry checker scheduled (daily at 2:00 AM PHT)
```

### 6. Test Manually
```bash
# Trigger manual check
curl -X POST http://localhost:3000/permit-monitoring/run-check \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN"
```

### 7. Verify Frontend
- Login as super admin
- Navigate to Permit Monitoring
- Verify page loads
- Test all features

---

## 🐛 Troubleshooting

### Scheduler Not Running
**Issue:** Cron job not executing
**Solutions:**
- Check server logs for errors
- Verify `node-cron` installed
- Check timezone configuration
- Restart server

### Emails Not Sending
**Issue:** Bar owners not receiving emails
**Solutions:**
- Check SMTP configuration in `.env`
- Verify email credentials
- Check spam folder
- Review server logs for email errors
- Test with `sendEmail` utility directly

### Permits Not Flagging
**Issue:** Expired permits not updating status
**Solutions:**
- Run manual check via API
- Check database for permit_expiry_date values
- Verify date format (YYYY-MM-DD)
- Check scheduler is running
- Review error logs

### Dashboard Not Loading
**Issue:** Permit Monitoring page shows error
**Solutions:**
- Check super admin access
- Verify API endpoints responding
- Check browser console for errors
- Verify routes configured correctly

---

## 📊 Success Metrics

**Operational Metrics:**
- Number of permits monitored
- Warnings sent per month
- Expired permits flagged
- Average response time (bar owner renewal)
- Deactivations performed

**Compliance Metrics:**
- % of bars with valid permits
- % of bars with expiry dates set
- Average days to renewal after warning
- Audit trail completeness

**System Metrics:**
- Scheduler uptime
- Email delivery rate
- API response times
- Database query performance

---

## 🔒 Security Considerations

**Access Control:**
- Permit monitoring restricted to super admin
- API endpoints require authentication
- Role-based access checks
- Audit logging for all actions

**Data Privacy:**
- Permit dates stored securely
- Email notifications use secure SMTP
- No sensitive data in logs
- GDPR-compliant data handling

**System Security:**
- SQL injection prevention (parameterized queries)
- Input validation on all endpoints
- Rate limiting on API calls
- Error messages don't expose system details

---

## 📞 Support

### For Bar Owners
- Email notification explains renewal process
- Link to dashboard for permit upload
- Support contact in email footer

### For Super Admins
- Dashboard provides all necessary tools
- Manual check option for testing
- Audit logs for tracking actions
- Documentation for all features

### For Developers
- Code comments explain logic
- Error logging for debugging
- Test endpoints for verification
- Migration scripts for database changes

---

## 🎓 User Documentation

### For Bar Owners

**What to Expect:**
1. You'll receive an email 30 days before your permit expires
2. The email will include your expiry date and action items
3. You need to renew your permit with the government
4. Upload your new permit to the dashboard
5. Update the expiry date in your bar settings

**If You Don't Renew:**
- Your bar will be flagged as "Permit Expired"
- The super admin may deactivate your listing
- Customers won't be able to view or book your bar
- You'll need to contact support to reactivate

### For Super Admins

**Daily Monitoring:**
1. Check Permit Monitoring dashboard regularly
2. Review bars with expiring permits
3. Contact bar owners if needed
4. Deactivate bars that don't renew

**Manual Actions:**
- **Run Check Now:** Trigger permit check manually
- **Deactivate:** Disable bar due to expired permit
- **Reactivate:** Re-enable bar after renewal

**Best Practices:**
- Review expired permits weekly
- Give bar owners grace period (7-14 days)
- Document deactivation reasons
- Verify new permit documents before reactivation
