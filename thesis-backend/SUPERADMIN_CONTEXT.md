# SUPER ADMIN WEB APP — FULL SYSTEM CONTEXT

> **Last Updated:** 2026-03-20  
> Use this file as the authoritative reference when building the Super Admin Web App.  
> Backend is **shared** with the Customer App and POS App — do NOT modify existing tables in breaking ways.

---

## 1. SYSTEM OVERVIEW

### Three Apps — One Backend

| App | Folder | Role |
|-----|--------|------|
| Customer Web | `customer_website/` | Customers browse bars, reserve tables, pay online |
| POS / Bar Owner App | Separate (Flutter/mobile) | Bar owners manage orders, staff, inventory |
| **Super Admin Web** | **New folder (this app)** | Platform control: payments, payouts, moderation, reviews |

- **Backend URL:** `http://localhost:3000` (Node.js + Express + MySQL)
- **Backend folder:** `customer_website/thesis-backend/`
- **Auth:** JWT bearer token in `Authorization: Bearer <token>` header
- **Super Admin Role Name (in DB):** `SUPER_ADMIN` (stored in `roles.name`)

---

## 2. AUTHENTICATION

### Login Endpoint
```
POST /auth/login
Body: { email, password }
Response: { success, data: { token, user: { id, first_name, last_name, email, role, role_id, profile_url, ... } } }
```

### Super Admin User Check
The backend verifies super admin via:
```sql
SELECT r.name AS role_name
FROM users u
LEFT JOIN roles r ON r.id = u.role_id
WHERE u.id = ?
-- Must equal 'SUPER_ADMIN'
```

### Token Refresh / Get Current User
```
GET /auth/me
Headers: Authorization: Bearer <token>
Response: { success, data: { user } }
```

---

## 3. PAYMENT SYSTEM — FULL FLOW

### 3.1 Flow Overview

```
Customer → Selects GCash/Maya/Card
         → Backend creates PayMongo Source/Payment Intent
         → Customer redirected to PayMongo checkout URL
         → Customer pays
         → PayMongo fires webhook → POST /webhook/paymongo
         → Backend marks payment_transactions.status = 'paid'
         → Backend auto-creates a payout record in payouts table
         → Super Admin sees pending payout
         → Super Admin manually sends GCash transfer to bar manager
         → Super Admin marks payout as 'sent' with reference number
         → Super Admin marks payout as 'completed'
```

### 3.2 Platform Fee
- Stored in `platform_settings` table, key: `platform_fee_percentage`  
- **Current value: 5.00%**  
- Formula: `platform_fee_amount = gross_amount * 0.05`  
- `net_amount = gross_amount - platform_fee_amount`

### 3.3 Payment Types
| Type | Description |
|------|-------------|
| `reservation` | Customer pays deposit for table reservation |
| `order` | POS order payment (in-bar, via digital) |
| `subscription` | Bar owner paying for subscription plan |

---

## 4. DATABASE SCHEMA — KEY TABLES

### 4.1 `payment_transactions`
```sql
id                        INT
reference_id              VARCHAR(100)   -- Internal ref e.g. SUB-20260317-XXXXX
payment_type              ENUM('order','reservation','subscription')
related_id                INT            -- ID in orders/reservations/subscriptions
bar_id                    INT            -- NULL for subscriptions
user_id                   INT            -- Paying customer/owner
amount                    DECIMAL(10,2)
currency                  VARCHAR(3)     -- 'PHP'
status                    ENUM('pending','processing','paid','failed','refunded','expired')
payment_method            VARCHAR(50)    -- 'gcash','paymaya','card'
paymongo_payment_intent_id VARCHAR(255)
paymongo_payment_id       VARCHAR(255)
paymongo_source_id        VARCHAR(255)
checkout_url              TEXT
paid_at                   TIMESTAMP
failed_reason             TEXT
metadata                  JSON           -- e.g. { plan_name, plan_display_name }
created_at, updated_at
```

### 4.2 `payouts`
```sql
id                        INT
bar_id                    INT
payment_transaction_id    INT            -- FK to payment_transactions
order_id                  INT            -- FK to pos_orders (if applicable)
reservation_id            INT            -- FK to reservations (if applicable)
gross_amount              DECIMAL(10,2)  -- Total customer paid
platform_fee              DECIMAL(10,2)  -- Fee % (e.g. 5.00)
platform_fee_amount       DECIMAL(10,2)  -- Actual fee deducted
net_amount                DECIMAL(10,2)  -- Amount to pay out to bar
status                    ENUM('pending','processing','completed','failed','cancelled')
payout_method             VARCHAR(50)    -- 'gcash', 'bank_transfer'
payout_reference          VARCHAR(255)   -- Super admin fills after sending GCash
gcash_number              VARCHAR(20)    -- Bar manager's GCash number
gcash_account_name        VARCHAR(255)   -- Bar manager's GCash name
processed_at              TIMESTAMP      -- When super admin processed it
notes                     TEXT
created_at, updated_at
```

**Payout Status Flow:**
```
pending → processing → sent → completed
                     ↘ failed
                     ↘ cancelled
```

> **Note:** `bars.gcash_number` and `bars.gcash_account_name` are on the `bars` table.  
> The bar owner sets these on their profile. Super admin reads them when processing the payout.

### 4.3 `subscriptions`
```sql
id                INT
bar_owner_id      INT            -- FK to bar_owners
plan_id           INT            -- FK to subscription_plans
status            ENUM('pending','active','cancelled','expired','past_due','rejected')
starts_at         TIMESTAMP
expires_at        TIMESTAMP
cancelled_at      TIMESTAMP
payment_method    VARCHAR(50)
payment_reference VARCHAR(255)
paymongo_source_id VARCHAR(255)
checkout_url      TEXT
amount_paid       DECIMAL(10,2)
auto_renew        TINYINT(1)
created_at, updated_at
```

### 4.4 `subscription_plans`
| id | name | display_name | price | billing_period | max_bars | max_events |
|----|------|------|-------|------|------|------|
| 1 | free | Free | ₱0 | monthly | 1 | 2 |
| 2 | basic | Basic | ₱499 | monthly | 3 | 10 |
| 3 | premium | Premium | ₱1,499 | monthly | 10 | unlimited |
| 4 | enterprise | Enterprise | ₱4,999 | monthly | unlimited | unlimited |

### 4.5 `pos_orders`
```sql
id                    INT
bar_id                INT
table_id              INT
staff_user_id         INT
order_number          VARCHAR(30)    -- e.g. POS-20260305-001
status                ENUM('pending','completed','cancelled')
subtotal              DECIMAL(12,2)
discount_amount       DECIMAL(12,2)
total_amount          DECIMAL(12,2)
payment_transaction_id INT
payment_status        ENUM('pending','paid','refunded','failed')
payment_method        ENUM('cash','digital')
amount_received       DECIMAL(12,2)
change_amount         DECIMAL(12,2)
notes                 TEXT
completed_at, cancelled_at, created_at, updated_at
```

### 4.6 `reservations`
```sql
id                  INT
transaction_number  VARCHAR(30)   -- e.g. RES-20260320-A3F9K2
bar_id              INT
table_id            INT
customer_user_id    INT
reservation_date    DATE
reservation_time    TIME
party_size          INT
notes               TEXT          -- Contains "Order: item1 x2, item2 x1"
status              ENUM('pending','approved','rejected','cancelled')
payment_status      ENUM('pending','paid','refunded','failed')
deposit_amount      DECIMAL(10,2)
payment_reference   VARCHAR(255)
paid_at             TIMESTAMP
created_at
```

### 4.7 `reservation_items` *(added via migration 20260320_reservation_items.sql)*
```sql
id              INT
reservation_id  INT     -- FK reservations ON DELETE CASCADE
bar_id          INT
menu_item_id    INT     -- FK menu_items ON DELETE CASCADE
quantity        INT
unit_price      DECIMAL(10,2)
created_at
```

### 4.8 `users`
```sql
id, first_name, last_name, email, password, phone_number,
profile_picture   VARCHAR(255)  -- path or URL
role              VARCHAR(50)   -- 'customer','bar_owner','admin','super_admin'
role_id           INT           -- FK to roles
is_verified       TINYINT(1)
is_active         TINYINT(1)
is_banned         TINYINT(1)
banned_at, banned_by
bar_id            INT           -- if employee
created_at, updated_at
```

### 4.9 `bar_owners`
```sql
id, user_id, business_name, business_address, business_phone,
business_email, permit_document, subscription_tier,
subscription_expires_at, created_at, logo_path
```

### 4.10 `bars`
```sql
id, name, description, address, city, state, zip_code,
phone, email, website, category, price_range,
image_path, logo_path, video_path,
latitude, longitude, rating, review_count,
gcash_number, gcash_account_name,   -- Used for payouts
monday_hours .. sunday_hours,
reservation_mode ENUM('manual_approval','auto_accept'),
status ENUM('pending','active','suspended','rejected'),
owner_id INT -- FK bar_owners
```

### 4.11 `platform_feedback`
```sql
id          INT
user_id     INT
rating      TINYINT     -- 1–5
comment     TEXT
category    VARCHAR(50) -- 'general', etc.
status      ENUM('pending','reviewed','resolved')
admin_reply TEXT        -- NEEDS MIGRATION if not yet added
created_at
```
> ⚠️ **`admin_reply` column does not exist yet.** You need to add it via migration.

### 4.12 `reviews` *(customer → bar reviews)*
```sql
id, bar_id, customer_id, rating TINYINT(1-5), comment, created_at, updated_at
```

### 4.13 `bar_reviews` *(older table, per-bar, not the main one)*
```sql
id, bar_id, user_id, rating DECIMAL(2,1), review TEXT, review_date
```

### 4.14 `bar_posts`
```sql
id, bar_id, user_id, content TEXT, image_path,
status ENUM('active','archived','deleted'),
like_count, comment_count, created_at, updated_at
```

### 4.15 `post_comments` *(comments on bar_posts)*
```sql
id, post_id, user_id, comment TEXT, created_at
```

### 4.16 `bar_events`
```sql
id, bar_id, title, description, event_date, start_time, end_time,
entry_price, max_capacity, current_bookings,
status ENUM('active','cancelled','completed'),
image_url, image_path, created_at, updated_at, archived_at
```

### 4.17 `event_comments`
```sql
id, event_id, user_id, comment TEXT,
parent_comment_id INT,  -- for threaded replies
status ENUM('active','deleted','flagged'),
created_at
```

### 4.18 `platform_settings`
| setting_key | current value |
|---|---|
| `platform_fee_percentage` | `5.00` |
| `paymongo_public_key` | `pk_test_REMOVED` |
| `paymongo_secret_key` | `sk_test_REMOVED` |
| `paymongo_webhook_secret` | `whsk_REMOVED` |
| `payments_enabled` | `1` |

### 4.19 `platform_audit_logs`
```sql
id, actor_user_id, action VARCHAR(100), entity VARCHAR(80),
entity_id, target_bar_id, details JSON,
ip_address, user_agent, created_at
```
Tracked actions include: `APPROVE_BAR`, `SUSPEND_BAR`, `REACTIVATE_BAR`, `DISABLE_OWNER`, `ENABLE_OWNER`, `BAN_CUSTOMER`, `BAN_CUSTOMER_PLATFORM`, `COMPLETE_PAYOUT`, `PROCESS_PAYOUT`, etc.

### 4.20 `platform_announcements`
```sql
id, title, message TEXT, is_active, starts_at, ends_at, created_by, created_at, updated_at
```

---

## 5. EXISTING BACKEND API ENDPOINTS

All routes are at `http://localhost:3000`. Auth header required unless noted.

### 5.1 Super Admin Core (`/super-admin/*`)
*Requires: role_name = SUPER_ADMIN*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/super-admin/dashboard/summary` | Total bars, users, owners, revenue stats |
| GET | `/super-admin/dashboard/recent-activity` | Recent platform audit log |
| GET | `/super-admin/accounts?q=&status=` | List/search all user accounts |
| POST | `/super-admin/accounts` | Create new admin account |
| PATCH | `/super-admin/accounts/:id` | Update user account |
| POST | `/super-admin/accounts/:id/reset-password` | Force password reset |
| GET | `/super-admin/bars?status=&q=` | List all bars with filters |
| GET | `/super-admin/bars/:id` | Single bar details |
| PATCH | `/super-admin/bars/:id` | Edit bar |
| POST | `/super-admin/bars` | Create bar |
| POST | `/super-admin/bars/:id/approve` | Approve bar registration |
| POST | `/super-admin/bars/:id/suspend` | Suspend bar |
| POST | `/super-admin/bars/:id/reactivate` | Reactivate bar |
| GET | `/super-admin/bars/:barId/tables` | Bar's tables |
| GET | `/super-admin/owners?q=` | List all bar owners |
| POST | `/super-admin/owners` | Create bar owner |
| POST | `/super-admin/owners/:userId/reset-password` | Reset owner password |
| POST | `/super-admin/owners/:userId/disable` | Disable owner account |
| POST | `/super-admin/owners/:userId/enable` | Enable owner account |
| POST | `/super-admin/owners/:userId/transfer` | Transfer bar ownership |
| GET | `/super-admin/audit-logs?user_id=&bar_id=&action=&from=&to=` | Platform audit trail |
| GET | `/super-admin/roles` | All roles with permission counts |
| GET | `/super-admin/roles/:roleId/users` | Users with specific role |
| POST | `/super-admin/roles/:roleId/force-reset` | Reset role permissions |
| GET | `/super-admin/platform/maintenance` | Get maintenance mode status |
| PATCH | `/super-admin/platform/maintenance` | Toggle maintenance mode |
| GET | `/super-admin/platform/announcements?active=1` | Platform announcements |
| POST | `/super-admin/platform/announcements` | Create announcement |
| PATCH | `/super-admin/platform/announcements/:id` | Edit announcement |
| DELETE | `/super-admin/platform/announcements/:id` | Delete announcement |
| GET | `/super-admin/login-activity` | All login activity |
| GET | `/super-admin/platform/suspicious-logins` | Suspicious login attempts |

### 5.2 Super Admin Payments (`/super-admin-payments/*`)
*Requires: role_name = SUPER_ADMIN*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/super-admin-payments/dashboard?from=&to=` | Revenue, payout totals, fee earnings, payment methods breakdown, recent 10 txns |
| GET | `/super-admin-payments/transactions?status=&payment_type=&bar_id=&from=&to=&search=&limit=` | All transactions with bar + customer info |
| POST | `/super-admin-payments/payouts/:id/complete` | Mark payout as completed |

### 5.3 Payouts (`/payouts/*`)
*Admin endpoints require: role_name = SUPER_ADMIN*

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payouts/my` | Bar owner's own payout history |
| GET | `/payouts/my/summary` | Bar owner payout summary stats |
| GET | `/payouts/admin/all?status=&bar_id=&limit=` | **ALL payouts** with bar GCash info + owner name |
| POST | `/payouts/admin/process/:id` | Mark payout as 'sent' + add reference number |
| POST | `/payouts/admin/complete/:id` | Mark payout as 'completed' |
| POST | `/payouts/admin/bulk-process` | Bulk mark as sent `{ payout_ids: [], payout_reference, notes }` |

### 5.4 Platform Feedback (`/platform-feedback/*`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/platform-feedback/` | Customer | Submit feedback (rating 1-5, comment, category) |
| GET | `/platform-feedback/my` | Customer | Own feedback history |
| GET | `/platform-feedback/admin/all?status=&limit=` | SUPER_ADMIN | All feedback with user info |
| PATCH | `/platform-feedback/admin/:id/status` | SUPER_ADMIN | Update status: pending/reviewed/resolved |
| GET | `/platform-feedback/stats` | Public | Average rating + distribution |

### 5.5 Reviews (`/public/reviews/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/public/bars/:barId/reviews` | All reviews for a bar |
| POST | `/public/bars/:barId/reviews` | Customer submits review (auth) |
| GET | `/public/reviews/summary` | Platform-wide review summary |

### 5.6 Social — Moderation (currently customer-facing; super admin hooks needed)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/social/comments/:postId` | All comments with replies for a post |
| GET | `/social/events/:eventId/comments` | All comments on an event |
| GET | `/social/search?q=` | Search bars/posts |

> ⚠️ **No super admin moderation endpoints exist yet.** You need to add them.

### 5.7 Subscriptions (`/subscriptions/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscriptions/plans` | All plans |
| GET | `/subscriptions/my` | Bar owner's current subscription |
| POST | `/subscriptions/subscribe` | Bar owner subscribes |
| POST | `/subscriptions/:id/cancel` | Cancel subscription |

### 5.8 Analytics (`/analytics/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/dashboard` | Bar-level analytics (auth: bar owner) |
| GET | `/analytics/revenue` | Revenue breakdown |

---

## 6. WHAT NEEDS TO BE BUILT

### 6.1 Payment & Financial Dashboard

**Pages to create:**
- **Dashboard** — Real-time numbers: total revenue, platform earnings (5% fee), pending payouts, paid out total
- **Transactions Table** — All `payment_transactions` filterable by status/type/bar/date. Shows: ref ID, bar name, customer name, amount, method, status, date
- **Payout Queue** — All `payouts` with status `pending`. Shows: bar name, gross, platform fee, net, GCash number, GCash name. Actions: Mark as Sent (input reference), Mark as Completed
- **Payout History** — All processed payouts

**Existing endpoints to use:**
- `GET /super-admin-payments/dashboard` → summary stats
- `GET /super-admin-payments/transactions` → transaction list
- `GET /payouts/admin/all?status=pending` → pending payouts
- `POST /payouts/admin/process/:id` body: `{ payout_reference: "GCash ref #", notes: "" }` → mark sent
- `POST /payouts/admin/complete/:id` → finalize

**GCash fields on payout:**
- `gcash_number` — bar manager's GCash number
- `gcash_account_name` — bar manager's GCash account name
- `payout_reference` — super admin fills in the GCash confirmation number after sending

### 6.2 Detailed Orders View

**Data to display:**
- All reservations cross-bar: `SELECT r.*, b.name, u.first_name, u.last_name, t.table_number FROM reservations r JOIN bars b ON b.id = r.bar_id JOIN bar_tables t ON t.id = r.table_id JOIN users u ON u.id = r.customer_user_id ORDER BY r.created_at DESC`
- All POS orders: `SELECT o.*, b.name FROM pos_orders o JOIN bars b ON b.id = o.bar_id ORDER BY o.created_at DESC`
- Reservation items (what menu items were ordered): `SELECT ri.*, m.menu_name FROM reservation_items ri JOIN menu_items m ON m.id = ri.menu_item_id WHERE ri.reservation_id = ?`

**Needs a new super admin endpoint** (add to `superAdmin.js` or `superAdminPayments.js`):
```javascript
// GET /super-admin/reservations?bar_id=&status=&from=&to=&q=
// GET /super-admin/orders?bar_id=&status=&from=&to=
// GET /super-admin/reservations/:id/items
```

### 6.3 Platform Ratings & Feedback

**Already exists:**  
- `GET /platform-feedback/admin/all` → shows all user feedback with name/email
- `PATCH /platform-feedback/admin/:id/status` → update status

**What's missing:**
1. **Admin reply to feedback** — `platform_feedback` table has no `admin_reply` column yet

**Migration needed:**
```sql
ALTER TABLE `platform_feedback`
  ADD COLUMN `admin_reply` TEXT DEFAULT NULL AFTER `comment`,
  ADD COLUMN `replied_at` TIMESTAMP NULL DEFAULT NULL AFTER `admin_reply`,
  ADD COLUMN `replied_by` INT DEFAULT NULL AFTER `replied_at`;
```

**New endpoint needed:**
```javascript
// PATCH /platform-feedback/admin/:id/reply
// Body: { reply: "Thank you for your feedback..." }
// Sets admin_reply, replied_at = NOW(), replied_by = req.user.id
// Sets status = 'reviewed'
```

### 6.4 Post & Comment Moderation

**Tables involved:**
- `bar_posts` — status can be set to `'deleted'` to remove
- `post_comments` — need to add `status` column (or hard delete)
- `event_comments` — already has `status ENUM('active','deleted','flagged')`

**New endpoints needed in `superAdmin.js`:**
```javascript
// GET /super-admin/social/posts?bar_id=&status=active&limit=
// GET /super-admin/social/posts/:postId/comments
// PATCH /super-admin/social/posts/:postId  { status: 'deleted' }  → take down post
// DELETE /super-admin/social/comments/:commentId               → remove comment
// GET /super-admin/social/events/comments?bar_id=&status=active
// PATCH /super-admin/social/events/comments/:commentId { status: 'deleted' }
```

**SQL for posts feed:**
```sql
SELECT bp.id, bp.content, bp.image_path, bp.status,
       bp.like_count, bp.comment_count, bp.created_at,
       b.name AS bar_name, b.logo_path,
       u.first_name, u.last_name
FROM bar_posts bp
JOIN bars b ON b.id = bp.bar_id
JOIN users u ON u.id = bp.user_id
ORDER BY bp.created_at DESC
LIMIT 100
```

**SQL for event comments:**
```sql
SELECT ec.id, ec.event_id, ec.comment, ec.status,
       ec.parent_comment_id, ec.created_at,
       be.title AS event_title, b.name AS bar_name,
       u.first_name, u.last_name
FROM event_comments ec
JOIN bar_events be ON be.id = ec.event_id
JOIN bars b ON b.id = be.bar_id
JOIN users u ON u.id = ec.user_id
ORDER BY ec.created_at DESC
LIMIT 200
```

---

## 7. MISSING MIGRATIONS TO RUN FIRST

Run these SQL files (in order) before developing:

```
thesis-backend/migrations/20260320_reservation_items.sql
thesis-backend/migrations/20260320_reservation_transaction_number.sql
```

And create + run this **new** migration for platform feedback reply:

```sql
-- 20260320_platform_feedback_reply.sql
ALTER TABLE `platform_feedback`
  ADD COLUMN `admin_reply` TEXT DEFAULT NULL AFTER `comment`,
  ADD COLUMN `replied_at` TIMESTAMP NULL DEFAULT NULL AFTER `admin_reply`,
  ADD COLUMN `replied_by` INT DEFAULT NULL AFTER `replied_at`;
```

---

## 8. SUPER ADMIN FEATURE CHECKLIST

### Payment & Financial
- [ ] Revenue dashboard (total in, platform fee earned, net paid out)
- [ ] All transactions table with filters
- [ ] Pending payout queue with GCash details
- [ ] Process payout → input GCash ref → mark sent
- [ ] Mark payout completed
- [ ] Bulk payout processing
- [ ] Subscription revenue tracking (bar owners paying plans)

### Orders & Reservations
- [ ] All reservations across all bars (filterable)
- [ ] Reservation detail with ordered menu items
- [ ] All POS orders across all bars
- [ ] Order detail with line items

### Platform Ratings
- [ ] View all platform feedback (rating + comment + user info)
- [ ] Reply to feedback *(needs migration + new endpoint)*
- [ ] Update feedback status (pending → reviewed → resolved)
- [ ] Rating stats dashboard (average, distribution)

### Post & Comment Moderation
- [ ] View all bar posts with content + author
- [ ] Take down a post (set status = 'deleted')
- [ ] View all comments on a post
- [ ] Remove individual comment
- [ ] View event comments across platform
- [ ] Remove / flag event comment

### Existing (already functional via existing endpoints)
- [x] Bar approval / suspension / reactivation
- [x] Bar owner enable / disable
- [x] User account management
- [x] Platform announcements
- [x] Maintenance mode
- [x] Audit logs viewer
- [x] Roles & permissions

---

## 9. REQUIRED NEW BACKEND ENDPOINTS SUMMARY

Add these to `thesis-backend/routes/superAdmin.js`:

```javascript
// ─── ORDERS & RESERVATIONS ───
GET  /super-admin/reservations?bar_id&status&from&to&q&limit
GET  /super-admin/reservations/:id          // detail + items
GET  /super-admin/pos-orders?bar_id&status&from&to&limit

// ─── SOCIAL MODERATION ───
GET  /super-admin/social/posts?bar_id&status&limit
GET  /super-admin/social/posts/:postId/comments
PATCH /super-admin/social/posts/:postId     body: { status: 'deleted' }
DELETE /super-admin/social/comments/:commentId
GET  /super-admin/social/event-comments?bar_id&status&limit
PATCH /super-admin/social/event-comments/:commentId  body: { status: 'deleted' }
```

Add to `thesis-backend/routes/platformFeedback.js`:
```javascript
PATCH /platform-feedback/admin/:id/reply  body: { reply: string }
```

---

## 10. TECH STACK RECOMMENDATION FOR SUPER ADMIN WEB

Since you're building a new web app:

| Layer | Recommendation |
|-------|---------------|
| Framework | React + Vite |
| Styling | TailwindCSS |
| Components | shadcn/ui |
| HTTP Client | Axios |
| State | React Context or Zustand |
| Charts | Recharts or Chart.js |
| Tables | TanStack Table (React Table) |
| Icons | Lucide React |
| Auth | JWT stored in localStorage |
| API Base | `http://localhost:3000` |

---

## 11. ENVIRONMENT VARIABLES

```env
VITE_API_URL=http://localhost:3000
```

For the backend `thesis-backend/.env`:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=tpg
JWT_SECRET=<secret>
PAYMONGO_SECRET_KEY=sk_test_REMOVED
PAYMONGO_PUBLIC_KEY=pk_test_REMOVED
PAYMONGO_WEBHOOK_SECRET=whsk_REMOVED
```

---

## 12. QUICK REFERENCE — PAYOUT PROCESSING FLOW IN UI

```
1. Super Admin logs in → role must be SUPER_ADMIN
2. Go to Payouts → Pending tab
3. Each row shows:
   - Bar name
   - GCash number (bars.gcash_number)
   - GCash account name (bars.gcash_account_name)
   - Net amount to send (payouts.net_amount)
4. Super Admin manually opens GCash app, sends money to bar's GCash
5. In the UI: click "Mark as Sent" → enter the GCash reference/transaction number
6. POST /payouts/admin/process/:id  { payout_reference: "GCash-XXXXXX", notes: "" }
7. Status changes to 'sent'
8. After confirmation: click "Mark Completed"
9. POST /payouts/admin/complete/:id
10. Status = 'completed', processed_at is set
```

---

## 13. PLATFORM FEEDBACK REPLY FLOW IN UI

```
1. Super Admin views platform feedback list
   GET /platform-feedback/admin/all
   
2. Click on a feedback item to expand
   Shows: user name, email, rating (1-5 stars), comment, category, date, current status

3. Type a reply and submit
   PATCH /platform-feedback/admin/:id/reply
   Body: { reply: "Thank you for your feedback, we will..." }

4. Feedback status auto-sets to 'reviewed'
   Customer sees the reply in their /platform-feedback/my history
```

---

## 14. POST MODERATION FLOW IN UI

```
1. Super Admin views all posts
   GET /super-admin/social/posts?status=active

2. Each card shows: bar name, bar logo, author, content, image, like/comment counts, date

3. Click "Take Down Post"
   PATCH /super-admin/social/posts/:postId  { status: 'deleted' }
   Post no longer appears in customer social feed (status != 'active' is filtered)

4. Click on post to view comments
   GET /super-admin/social/posts/:postId/comments

5. Click "Remove Comment" on any comment
   DELETE /super-admin/social/comments/:commentId

6. For event comments:
   GET /super-admin/social/event-comments
   PATCH /super-admin/social/event-comments/:id  { status: 'deleted' }
```
