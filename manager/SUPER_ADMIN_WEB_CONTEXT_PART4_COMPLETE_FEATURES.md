# SUPER ADMIN WEB - COMPLETE FEATURE LIST & GLOBAL MONITORING

**Last Updated:** March 18, 2026  
**Database:** `tpg`

---

## 🎯 COMPLETE SUPER ADMIN FEATURE REQUIREMENTS

This section covers **ALL features** the Super Admin needs global visibility and control over, based on the existing Bar Manager system.

---

## 1. 📊 GLOBAL ANALYTICS DASHBOARD

### Overview
Centralized dashboard showing platform-wide statistics and health metrics.

### Key Metrics:

**Financial Metrics:**
- Total platform revenue (all-time, monthly, daily)
- Platform fee earnings
- Pending payouts total
- Completed payouts total
- Revenue by payment method
- Revenue by bar
- Average transaction value

**Bar Metrics:**
- Total bars on platform
- Active bars
- Pending approval bars
- Suspended bars
- Bars by subscription plan
- New bar registrations (daily/weekly/monthly)

**Subscription Metrics:**
- Total active subscriptions
- Revenue by subscription plan
- Subscription renewals this month
- Pending subscription approvals
- Cancelled subscriptions
- Subscription retention rate

**Customer Metrics:**
- Total customers registered
- Active customers (made transaction in last 30 days)
- Globally banned customers
- New customer registrations
- Customer lifetime value

**Transaction Metrics:**
- Total transactions (orders + reservations)
- Successful payment rate
- Failed payment rate
- Average order value
- Peak transaction times

### API Endpoint:

**`GET /super-admin/dashboard/overview`**

**Response:**
```json
{
  "success": true,
  "data": {
    "financial": {
      "total_revenue": 5500000.00,
      "platform_earnings": 275000.00,
      "pending_payouts": 125000.00,
      "completed_payouts": 5225000.00,
      "avg_transaction_value": 850.00
    },
    "bars": {
      "total": 150,
      "active": 140,
      "pending": 8,
      "suspended": 2,
      "new_this_month": 12
    },
    "subscriptions": {
      "total_active": 140,
      "pending_approval": 8,
      "monthly_recurring_revenue": 280000.00,
      "retention_rate": 94.5
    },
    "customers": {
      "total": 50000,
      "active": 35000,
      "banned": 25,
      "new_this_month": 5000
    },
    "transactions": {
      "total": 125000,
      "success_rate": 98.5,
      "this_month": 12500
    },
    "charts": {
      "revenue_trend": [...],
      "bar_growth": [...],
      "payment_methods": [...]
    }
  }
}
```

---

## 2. 🏪 BAR MANAGEMENT (Global View)

### Features:

**Bar Directory:**
- List all bars across the platform
- Search by name, location, owner
- Filter by status, subscription plan, city
- Sort by revenue, rating, registration date

**Bar Details:**
- Complete bar profile
- Owner information
- Subscription details
- Branch list (for multi-branch owners)
- Financial summary
- Staff count
- Customer reviews
- Recent activity

**Bar Actions:**
- Approve pending bars
- Suspend bars (with reason)
- Reactivate suspended bars
- Reject bar applications
- View bar documents
- Update bar status
- Override bar settings (emergency)

### API Endpoints:

**`GET /super-admin/bars`** — List all bars  
**`GET /super-admin/bars/:id`** — Bar details  
**`GET /super-admin/bars/:id/branches`** — Bar branches  
**`GET /super-admin/bars/:id/financials`** — Bar financial summary  
**`GET /super-admin/bars/:id/staff`** — Bar staff list  
**`POST /super-admin/bars/:id/approve`** — Approve bar  
**`POST /super-admin/bars/:id/suspend`** — Suspend bar  
**`POST /super-admin/bars/:id/reactivate`** — Reactivate bar  

---

## 3. 👥 USER MANAGEMENT (Global View)

### Features:

**All Users Directory:**
- List all users (bar owners, staff, customers)
- Filter by role, status, registration date
- Search by name, email, phone
- View user activity history
- View user permissions

**Bar Owner Management:**
- List all bar owners
- View owner's bars and branches
- View subscription status
- Ban/unban owners
- View owner activity logs
- Contact owner

**Staff Management:**
- List all staff across all bars
- View staff permissions
- View staff activity
- Filter by bar, role

**Customer Management:**
- List all customers
- View customer transaction history
- View customer reviews
- Ban/unban customers (global)
- View per-bar bans
- Customer lifetime value

### API Endpoints:

**`GET /super-admin/users`** — List all users  
**`GET /super-admin/users/:id`** — User details  
**`GET /super-admin/users/:id/activity`** — User activity logs  
**`GET /super-admin/users/:id/permissions`** — User permissions  
**`GET /super-admin/bar-owners`** — List bar owners  
**`GET /super-admin/customers`** — List customers  
**`POST /super-admin/users/:id/ban`** — Ban user globally  
**`DELETE /super-admin/users/:id/ban`** — Unban user  

---

## 4. 💰 FINANCIAL MONITORING

### Features:

**Revenue Dashboard:**
- Total platform revenue
- Revenue by bar
- Revenue by subscription plan
- Revenue trends (daily, weekly, monthly)
- Payment method breakdown
- Failed payment analysis

**Payout Management:**
- Pending payouts queue
- Payout history
- Payout by bar
- Bulk payout processing
- Payout disputes
- Failed payout tracking

**Transaction Monitoring:**
- All customer transactions
- Transaction status tracking
- Refund management
- Chargeback monitoring
- Suspicious transaction alerts

**Platform Fee Management:**
- Current platform fee percentage
- Platform fee earnings
- Fee history and changes
- Projected earnings

**Financial Reports:**
- Monthly revenue reports
- Payout reports
- Tax reports
- Commission reports
- Subscription revenue reports

### API Endpoints:

**`GET /super-admin-payments/dashboard`** — Financial dashboard  
**`GET /super-admin-payments/transactions`** — All transactions  
**`GET /super-admin-payments/payouts`** — All payouts  
**`GET /super-admin-payments/reports/monthly`** — Monthly report  
**`GET /super-admin-payments/reports/payouts`** — Payout report  
**`POST /super-admin-payments/refunds/:id`** — Process refund  

---

## 5. 📦 INVENTORY MONITORING (Per Bar)

### Features:

Super Admin can view (read-only) inventory status for any bar:
- Low stock alerts across all bars
- Critical stock alerts
- Inventory value by bar
- Stock movement reports
- Menu availability monitoring

**Use Case:** Identify bars with operational issues (frequent stockouts)

### API Endpoints:

**`GET /super-admin/bars/:id/inventory`** — View bar inventory  
**`GET /super-admin/inventory/alerts`** — Low stock alerts across platform  

---

## 6. 🍽️ MENU MONITORING (Per Bar)

### Features:

Super Admin can view menus for any bar:
- View bar menu items
- See pricing
- Check availability status
- Menu analytics (popular items)

**Use Case:** Quality control, pricing monitoring

### API Endpoints:

**`GET /super-admin/bars/:id/menu`** — View bar menu  
**`GET /super-admin/menus/analytics`** — Popular items across platform  

---

## 7. 📅 RESERVATION MONITORING (Global)

### Features:

**Reservation Overview:**
- Total reservations across platform
- Reservation by bar
- Reservation status breakdown
- Peak reservation times
- Cancellation rates
- No-show rates

**Reservation Search:**
- Search reservations by customer, bar, date
- Filter by status
- View reservation details

**Reservation Analytics:**
- Average party size
- Popular reservation times
- Busiest bars
- Revenue from reservations

### API Endpoints:

**`GET /super-admin/reservations`** — List all reservations  
**`GET /super-admin/reservations/analytics`** — Reservation analytics  
**`GET /super-admin/bars/:id/reservations`** — Bar reservations  

---

## 8. 🛒 ORDER MONITORING (Global)

### Features:

**Order Overview:**
- Total orders across platform
- Orders by bar
- Order status breakdown
- Average order value
- Peak order times

**POS Transaction Monitoring:**
- View all POS transactions
- Filter by bar, date, payment method
- Failed transactions
- Refund tracking

**Order Analytics:**
- Popular items across platform
- Sales trends
- Payment method preferences
- Staff performance (orders processed)

### API Endpoints:

**`GET /super-admin/orders`** — List all orders  
**`GET /super-admin/orders/analytics`** — Order analytics  
**`GET /super-admin/bars/:id/orders`** — Bar orders  

---

## 9. 👨‍💼 EMPLOYEE MONITORING (Per Bar)

### Features:

Super Admin can view employee data for any bar:
- Staff list per bar
- Employee profiles
- Employment status
- Attendance records
- Leave requests
- Payroll summaries (amount only, not process)

**Use Case:** Monitor labor compliance, identify staffing issues

### API Endpoints:

**`GET /super-admin/bars/:id/employees`** — Bar employees  
**`GET /super-admin/employees/analytics`** — Platform-wide employee stats  

---

## 10. 💸 PAYROLL MONITORING (Per Bar)

### Features:

Super Admin can view payroll data (read-only):
- Payroll summaries by bar
- Total payroll costs
- Payment status
- Identify bars with payroll issues

**Note:** Super Admin does NOT process bar payroll, only monitors.

### API Endpoints:

**`GET /super-admin/bars/:id/payroll`** — Bar payroll summary  

---

## 11. ⭐ REVIEW MONITORING (Global)

### Features:

**Review Management:**
- View all customer reviews
- Filter by bar, rating, date
- Flag inappropriate reviews
- Delete violating reviews
- View review trends

**Review Analytics:**
- Average rating across platform
- Top-rated bars
- Most-reviewed bars
- Review sentiment analysis
- Common complaints/praise

### API Endpoints:

**`GET /super-admin/reviews`** — List all reviews  
**`GET /super-admin/reviews/flagged`** — Flagged reviews  
**`POST /super-admin/reviews/:id/flag`** — Flag review  
**`DELETE /super-admin/reviews/:id`** — Delete inappropriate review  
**`GET /super-admin/reviews/analytics`** — Review analytics  

---

## 12. 🎉 EVENT MONITORING (Global)

### Features:

**Event Overview:**
- All events across platform
- Filter by bar, status, date
- Upcoming events
- Past events
- Event popularity

**Event Moderation:**
- Flag inappropriate events
- Delete violating events
- View event engagement (likes, comments)

### API Endpoints:

**`GET /super-admin/events`** — List all events  
**`GET /super-admin/events/upcoming`** — Upcoming events  
**`GET /super-admin/bars/:id/events`** — Bar events  
**`DELETE /super-admin/events/:id`** — Delete inappropriate event  

---

## 13. 🔔 NOTIFICATION SYSTEM

### Features:

**Super Admin can send notifications to:**
- All users
- All bar owners
- Specific bars
- Specific users
- Customers

**Notification Types:**
- System announcements
- Maintenance notifications
- Policy updates
- Promotional messages
- Payment reminders

### API Endpoints:

**`POST /super-admin/notifications/broadcast`** — Broadcast notification  
**`POST /super-admin/notifications/bar/:id`** — Send to bar  
**`POST /super-admin/notifications/user/:id`** — Send to user  

---

## 14. 📄 DOCUMENT VERIFICATION

### Features:

**Bar Document Review:**
- Business permits
- Mayor's permit
- BIR registration
- DTI registration
- Liquor license
- Owner ID verification

**Verification Status:**
- Pending verification
- Verified
- Rejected
- Expired documents

### API Endpoints:

**`GET /super-admin/documents/pending`** — Pending documents  
**`GET /super-admin/bars/:id/documents`** — Bar documents  
**`POST /super-admin/documents/:id/verify`** — Verify document  
**`POST /super-admin/documents/:id/reject`** — Reject document  

---

## 15. 🤖 AI VERIFICATION MONITORING

### Features:

**AI Verification Dashboard:**
- Pending AI verifications
- AI confidence scores
- Manual review queue
- Bulk approve/reject
- AI performance metrics

**AI Actions:**
- Review AI analysis
- Override AI decisions
- Mark for manual review

### API Endpoints:

**`GET /super-admin/ai-verifications`** — AI verification queue  
**`GET /super-admin/ai-verifications/:id`** — AI verification details  
**`POST /super-admin/ai-verifications/:id/approve`** — Approve  
**`POST /super-admin/ai-verifications/:id/reject`** — Reject  
**`POST /super-admin/ai-verifications/bulk-action`** — Bulk action  

---

## 16. ⚙️ SYSTEM SETTINGS

### Features:

**Platform Configuration:**
- Platform fee percentage
- Enable/disable payments globally
- PayMongo API keys
- System maintenance mode
- Feature flags
- Email templates
- SMS templates

**Subscription Plan Management:**
- Create new plans
- Edit existing plans
- Deactivate plans
- Set plan features
- Set branch limits

**Global Settings:**
- Default currency
- Timezone settings
- Date/time formats
- Platform branding
- Terms of service
- Privacy policy

### API Endpoints:

**`GET /super-admin/settings`** — Get all settings  
**`PUT /super-admin/settings`** — Update settings  
**`GET /super-admin/settings/payment`** — Payment settings  
**`PUT /super-admin/settings/payment`** — Update payment settings  

---

## 17. 📊 REPORTS & ANALYTICS

### Available Reports:

**Financial Reports:**
- Monthly revenue report
- Payout report
- Transaction report
- Subscription revenue report
- Platform fee earnings report
- Tax report

**Operational Reports:**
- Bar performance report
- User activity report
- Subscription analytics
- Customer engagement report
- Order fulfillment report
- Reservation report

**Compliance Reports:**
- Audit log report
- User permission report
- Banned customer report
- Document verification report

### API Endpoints:

**`GET /super-admin/reports/financial`** — Financial reports  
**`GET /super-admin/reports/operational`** — Operational reports  
**`GET /super-admin/reports/compliance`** — Compliance reports  
**`POST /super-admin/reports/generate`** — Generate custom report  
**`GET /super-admin/reports/export/:id`** — Export report (CSV/PDF)  

---

## 18. 🔐 SECURITY & COMPLIANCE

### Features:

**Security Monitoring:**
- Failed login attempts
- Suspicious activity alerts
- Multiple device logins
- Unusual transaction patterns
- Potential fraud detection

**Compliance Tools:**
- GDPR compliance tools
- Data export requests
- Data deletion requests
- Privacy policy acceptance tracking
- Terms of service acceptance

### API Endpoints:

**`GET /super-admin/security/alerts`** — Security alerts  
**`GET /super-admin/security/failed-logins`** — Failed login attempts  
**`GET /super-admin/compliance/data-requests`** — Data requests  
**`POST /super-admin/compliance/export-data/:userId`** — Export user data  

---

## 19. 📱 SOCIAL FEATURES MONITORING

### Features:

**Bar Social Content:**
- View all bar posts
- Monitor comments
- Flag inappropriate content
- Delete violating posts
- View engagement metrics

**Customer Engagement:**
- Track bar followers
- Monitor event participation
- View customer interactions

### API Endpoints:

**`GET /super-admin/social/posts`** — All bar posts  
**`GET /super-admin/social/flagged`** — Flagged content  
**`DELETE /super-admin/social/posts/:id`** — Delete post  
**`DELETE /super-admin/social/comments/:id`** — Delete comment  

---

## 20. 🎫 PROMOTION MONITORING (Future Feature)

### Features:

**Promotion Overview:**
- Active promotions across platform
- Promotion effectiveness
- Discount usage
- Revenue impact

**Note:** Based on Bar Manager frontend, promotions feature exists but backend incomplete.

---

## COMPLETE API ENDPOINT SUMMARY

### Authentication
- `POST /auth/login` — Login
- `POST /auth/register` — Register
- `POST /auth/logout` — Logout
- `POST /auth/refresh` — Refresh token

### Super Admin Dashboard
- `GET /super-admin/dashboard/overview` — Main dashboard
- `GET /super-admin/dashboard/charts` — Chart data

### Bar Management
- `GET /super-admin/bars` — List bars
- `GET /super-admin/bars/:id` — Bar details
- `GET /super-admin/bars/:id/branches` — Bar branches
- `GET /super-admin/bars/:id/financials` — Bar financials
- `GET /super-admin/bars/:id/staff` — Bar staff
- `GET /super-admin/bars/:id/customers` — Bar customers
- `GET /super-admin/bars/:id/orders` — Bar orders
- `GET /super-admin/bars/:id/reservations` — Bar reservations
- `GET /super-admin/bars/:id/inventory` — Bar inventory
- `GET /super-admin/bars/:id/menu` — Bar menu
- `GET /super-admin/bars/:id/events` — Bar events
- `GET /super-admin/bars/:id/documents` — Bar documents
- `GET /super-admin/bars/:id/audit-logs` — Bar audit logs
- `POST /super-admin/bars/:id/approve` — Approve bar
- `POST /super-admin/bars/:id/reject` — Reject bar
- `POST /super-admin/bars/:id/suspend` — Suspend bar
- `POST /super-admin/bars/:id/reactivate` — Reactivate bar

### Payment & Payout Management
- `GET /super-admin-payments/dashboard` — Payment dashboard
- `GET /super-admin-payments/transactions` — All transactions
- `GET /super-admin-payments/transactions/:id` — Transaction details
- `GET /super-admin-payments/payouts` — All payouts
- `GET /super-admin-payments/payouts/:id` — Payout details
- `POST /super-admin-payments/payouts/:id/mark-sent` — Mark payout sent
- `POST /super-admin-payments/payouts/bulk-mark-sent` — Bulk mark sent
- `GET /super-admin-payments/bar-configs` — Bar payout configs
- `PUT /super-admin-payments/bar-configs/:barId` — Update config
- `POST /super-admin-payments/bar-configs/:barId/disable-payout` — Disable payout
- `GET /super-admin-payments/settings` — Payment settings
- `PUT /super-admin-payments/settings` — Update payment settings

### Subscription Management
- `GET /super-admin/subscription-plans` — List plans
- `POST /super-admin/subscription-plans` — Create plan
- `PUT /super-admin/subscription-plans/:id` — Update plan
- `DELETE /super-admin/subscription-plans/:id` — Deactivate plan
- `GET /super-admin/subscription-approvals` — Pending subscriptions
- `GET /super-admin/subscriptions` — All subscriptions
- `GET /super-admin/subscriptions/:id` — Subscription details
- `POST /super-admin/subscriptions/:id/approve` — Approve subscription
- `POST /super-admin/subscriptions/:id/reject` — Reject subscription
- `PUT /super-admin/subscriptions/:id/extend` — Extend subscription
- `POST /super-admin/subscriptions/:id/cancel` — Cancel subscription
- `POST /super-admin/subscriptions/:id/reactivate` — Reactivate subscription

### User Management
- `GET /super-admin/users` — List all users
- `GET /super-admin/users/:id` — User details
- `GET /super-admin/users/:id/activity` — User activity
- `GET /super-admin/users/:id/permissions` — User permissions
- `GET /super-admin/bar-owners` — List bar owners
- `GET /super-admin/customers` — List customers
- `POST /super-admin/users/:id/ban` — Ban user
- `DELETE /super-admin/users/:id/ban` — Unban user

### Customer Banning
- `GET /super-admin/customers/banned` — Globally banned customers
- `POST /super-admin/customers/:id/ban` — Ban customer globally
- `DELETE /super-admin/customers/:id/ban` — Unban customer
- `GET /super-admin/bar-bans` — Per-bar bans
- `POST /super-admin/bar-bans/:id/override` — Override bar ban

### RBAC Management
- `GET /super-admin/roles` — List roles
- `GET /super-admin/roles/:id/permissions` — Role permissions
- `GET /super-admin/permissions` — List permissions

### Audit Logs
- `GET /super-admin/audit-logs` — Platform audit logs
- `GET /super-admin/bars/:id/audit-logs` — Bar audit logs

### Reviews & Events
- `GET /super-admin/reviews` — All reviews
- `GET /super-admin/reviews/flagged` — Flagged reviews
- `POST /super-admin/reviews/:id/flag` — Flag review
- `DELETE /super-admin/reviews/:id` — Delete review
- `GET /super-admin/events` — All events
- `DELETE /super-admin/events/:id` — Delete event

### Documents & Verification
- `GET /super-admin/documents/pending` — Pending documents
- `GET /super-admin/bars/:id/documents` — Bar documents
- `POST /super-admin/documents/:id/verify` — Verify document
- `POST /super-admin/documents/:id/reject` — Reject document
- `GET /super-admin/ai-verifications` — AI verifications
- `POST /super-admin/ai-verifications/:id/approve` — Approve AI verification
- `POST /super-admin/ai-verifications/:id/reject` — Reject AI verification

### Notifications
- `POST /super-admin/notifications/broadcast` — Broadcast notification
- `POST /super-admin/notifications/bar/:id` — Send to bar
- `POST /super-admin/notifications/user/:id` — Send to user

### Reports
- `GET /super-admin/reports/financial` — Financial reports
- `GET /super-admin/reports/operational` — Operational reports
- `GET /super-admin/reports/compliance` — Compliance reports
- `POST /super-admin/reports/generate` — Generate report
- `GET /super-admin/reports/export/:id` — Export report

### System Settings
- `GET /super-admin/settings` — Get settings
- `PUT /super-admin/settings` — Update settings

---

**END OF PART 4: COMPLETE FEATURES**

See PART 5 for Implementation Guide and Tech Stack.
