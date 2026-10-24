# Multi-Branch & Subscription System — Full Context

> **Purpose**: This file documents everything implemented for multi-branch management and subscriptions in the Bar Owner Manager app. It also contains a ready-to-use **AI prompt for Flutter/Dart** so you can replicate the same features in your mobile app without confusion.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Backend API Endpoints](#3-backend-api-endpoints)
4. [Authentication & Branch Scoping](#4-authentication--branch-scoping)
5. [Subscription Plans & Payment](#5-subscription-plans--payment)
6. [Frontend Implementation (React Manager App)](#6-frontend-implementation-react-manager-app)
7. [Flutter/Dart AI Prompt](#7-flutterdart-ai-prompt)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    BAR OWNER (user)                      │
│              owns multiple bars (branches)               │
│         limited by subscription plan (max_bars)          │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
      ┌───────┐  ┌───────┐  ┌───────┐
      │ Bar 1 │  │ Bar 2 │  │ Bar 3 │   ← each bar = a "branch"
      │(active│  │(active│  │(locked│   ← locked if over plan limit
      └───┬───┘  └───┬───┘  └───┬───┘
          │          │          │
     All data is scoped by bar_id:
     staff, inventory, menu, events,
     POS orders, reservations, etc.
```

### Key Concepts

- **Bar = Branch**: Each row in the `bars` table is a branch. `bars.owner_id` links to `bar_owners.id`.
- **Subscription gates branch creation**: `subscription_plans.max_bars` controls how many branches an owner can have. Exceeding the limit locks extra branches (`bars.is_locked = 1`).
- **Data isolation**: All operational tables already have a `bar_id` column. When the owner switches branches, `req.user.bar_id` changes, and all queries automatically scope to that branch.
- **X-Bar-Id header**: The frontend sends `X-Bar-Id: <bar_id>` on every API request. The `requireAuth` middleware verifies ownership and overrides `req.user.bar_id` for bar owners only.
- **Admin approval for subscriptions**: When a bar owner submits payment, the subscription is created with `status = 'pending'`. A **Super Admin** must verify the payment reference and approve it before the subscription becomes active and branches are unlocked.

---

## 2. Database Schema

### `bars` table (each row = one branch)

```sql
CREATE TABLE `bars` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `address` varchar(255) NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) DEFAULT NULL,
  `zip_code` varchar(20) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `contact_number` varchar(30) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `price_range` varchar(50) DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `logo_path` varchar(500) DEFAULT NULL,
  `video_path` varchar(500) DEFAULT NULL,
  `monday_hours` – `sunday_hours` varchar(50),
  `owner_id` int(11) DEFAULT NULL,          -- FK to bar_owners.id
  `status` enum('active','inactive','pending') DEFAULT 'pending',
  `is_locked` tinyint(1) NOT NULL DEFAULT 0, -- 1 = locked (over plan limit)
  `lifecycle_status` enum('pending','active','suspended') DEFAULT NULL,
  `rating` decimal(3,2) DEFAULT 0.00,
  `review_count` int(11) DEFAULT 0,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `accept_cash_payment` tinyint(1) DEFAULT 1,
  `accept_online_payment` tinyint(1) DEFAULT 0,
  `accept_gcash` tinyint(1) DEFAULT 0,
  `minimum_reservation_deposit` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp DEFAULT current_timestamp(),
  `updated_at` timestamp DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
);
```

### `bar_owners` table

```sql
CREATE TABLE `bar_owners` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,               -- FK to users.id
  `subscription_tier` varchar(50) DEFAULT 'free',
  `subscription_expires_at` timestamp NULL DEFAULT NULL,
  -- ... other fields
  PRIMARY KEY (`id`)
);
```

### `subscription_plans` table

```sql
CREATE TABLE `subscription_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,              -- 'free', 'basic', 'premium'
  `display_name` varchar(100) NOT NULL,     -- 'Free', 'Basic', 'Premium'
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `billing_period` enum('monthly','yearly','lifetime') DEFAULT 'monthly',
  `max_bars` int(11) NOT NULL DEFAULT 1,    -- max branches allowed
  `max_events` int(11) DEFAULT NULL,        -- NULL = unlimited
  `max_promotions` int(11) DEFAULT NULL,    -- NULL = unlimited
  `features` longtext DEFAULT NULL,         -- JSON array of feature flags
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp DEFAULT current_timestamp(),
  `updated_at` timestamp DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
);
```

**Current plan data:**

| id | name    | display_name | price   | billing | max_bars | max_events | max_promotions |
|----|---------|-------------|---------|---------|----------|------------|----------------|
| 1  | free    | Free        | 0.00    | monthly | 1        | 2          | 1              |
| 2  | basic   | Basic       | 499.00  | monthly | 3        | 10         | 5              |
| 3  | premium | Premium     | 1499.00 | monthly | 10       | NULL       | NULL           |

### `subscriptions` table (payment records)

```sql
CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_owner_id` int(11) NOT NULL,          -- FK to bar_owners.id
  `plan_id` int(11) NOT NULL,               -- FK to subscription_plans.id
  `status` enum('pending','active','cancelled','expired','past_due','rejected') DEFAULT 'pending',
  `starts_at` timestamp DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL, -- 'gcash', 'maya', 'card', 'manual'
  `payment_reference` varchar(255) DEFAULT NULL,
  `amount_paid` decimal(10,2) DEFAULT 0.00,
  `auto_renew` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp DEFAULT current_timestamp(),
  `updated_at` timestamp DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
);
```

### `users` table (relevant fields)

```sql
-- users.bar_id = the currently active branch for this user
-- For bar_owners, this gets updated when they switch branches
-- For staff, this is fixed to their assigned branch
`bar_id` int(11) DEFAULT NULL   -- FK to bars.id
```

### Tables that have `bar_id` for data isolation

All these tables already have a `bar_id` column, so data is automatically scoped per branch:

- `attendance_logs`, `audit_logs`, `bar_events`, `bar_tables`
- `documents`, `employee_documents`, `employee_profiles`
- `inventory_items`, `leave_balances`, `leave_requests`, `leave_types`
- `menu_items`, `payroll_items`, `payroll_runs`
- `pos_orders`, `promotions`, `reservations`, `reviews`, `sales`
- `bar_posts`, `bar_followers`, `bar_reviews`, `customer_bar_bans`

---

## 3. Backend API Endpoints

**Base URL**: `http://localhost:3000` (or your deployed URL)

All authenticated endpoints require: `Authorization: Bearer <jwt_token>`

For multi-branch scoping, the frontend also sends: `X-Bar-Id: <selected_bar_id>`

### Branch Endpoints (`/branches`)

#### `GET /branches/my`
Returns all branches owned by the authenticated bar owner.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Club Neon Manila",
      "address": "123 Main St",
      "city": "Manila",
      "status": "active",
      "latitude": 14.5995000,
      "longitude": 120.9842000,
      "image_path": "uploads/bars/1.jpg",
      "logo_path": null,
      "is_locked": 0,
      "created_at": "2026-03-05T19:29:30.000Z"
    },
    {
      "id": 5,
      "name": "Club Neon Cavite",
      "address": "456 Branch Ave",
      "city": "Cavite",
      "status": "pending",
      "is_locked": 0,
      "created_at": "2026-03-15T04:30:00.000Z"
    }
  ]
}
```

#### `POST /branches/create`
Create a new branch. Subscription-gated (checks max_bars limit).

**Request body:**
```json
{
  "name": "Club Neon Cavite",       // required
  "address": "456 Branch Ave",      // required
  "city": "Cavite",                 // required
  "state": "Cavite",
  "zip_code": "4100",
  "phone": "09171234567",
  "email": "cavite@clubneon.com",
  "category": "nightclub",
  "latitude": 14.2829,
  "longitude": 120.8686,
  "description": "Our Cavite branch"
}
```

**Success response:**
```json
{
  "success": true,
  "message": "Branch created successfully!",
  "data": { "id": 5, "name": "Club Neon Cavite", "status": "pending" }
}
```

**Over-limit response (403):**
```json
{
  "success": false,
  "message": "Your current subscription plan allows up to 1 branch. Please upgrade to add more.",
  "data": { "current": 1, "max": 1 }
}
```

#### `POST /branches/switch`
Switch the owner's active branch. Updates `users.bar_id` in the database.

**Request body:**
```json
{ "bar_id": 5 }
```

**Response:**
```json
{
  "success": true,
  "message": "Switched to Club Neon Cavite",
  "data": { "bar_id": 5, "bar_name": "Club Neon Cavite" }
}
```

**Locked branch response (403):**
```json
{
  "success": false,
  "message": "This branch is locked. Please upgrade your subscription to access it."
}
```

#### `PATCH /branches/:id`
Update branch details. Only the owner can edit their own branches.

**Request body (any subset):**
```json
{
  "name": "Club Neon Cavite Updated",
  "address": "789 New St",
  "city": "Imus",
  "latitude": 14.3000,
  "longitude": 120.9400
}
```

**Response:**
```json
{ "success": true, "message": "Branch updated successfully." }
```

#### `GET /branches/subscription-info`
Get the owner's current branch limits and usage.

**Response:**
```json
{
  "success": true,
  "data": {
    "tier": "free",
    "plan_name": "Free",
    "max_bars": 1,
    "current_bars": 1,
    "can_create": false
  }
}
```

### Subscription Endpoints (`/subscriptions`)

#### `GET /subscriptions/plans`
List all active subscription plans. **No auth required.**

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1, "name": "free", "display_name": "Free",
      "description": "Basic listing with 1 bar",
      "price": "0.00", "billing_period": "monthly",
      "max_bars": 1, "max_events": 2, "max_promotions": 1,
      "is_active": 1, "sort_order": 0
    },
    {
      "id": 2, "name": "basic", "display_name": "Basic",
      "description": "Up to 3 bars with more events and promotions",
      "price": "499.00", "billing_period": "monthly",
      "max_bars": 3, "max_events": 10, "max_promotions": 5,
      "is_active": 1, "sort_order": 1
    },
    {
      "id": 3, "name": "premium", "display_name": "Premium",
      "description": "Up to 10 bars with unlimited events",
      "price": "1499.00", "billing_period": "monthly",
      "max_bars": 10, "max_events": null, "max_promotions": null,
      "is_active": 1, "sort_order": 2
    }
  ]
}
```

#### `GET /subscriptions/my`
Get the authenticated owner's current subscription, pending subscription, and usage. **Requires auth.**

**Response (with active + pending):**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": 1,
      "bar_owner_id": 1,
      "plan_id": 2,
      "status": "active",
      "starts_at": "2026-03-15T04:00:00.000Z",
      "expires_at": "2026-04-14T04:00:00.000Z",
      "payment_method": "gcash",
      "payment_reference": "GCash Ref #123456789",
      "amount_paid": "499.00",
      "plan_name": "basic",
      "display_name": "Basic",
      "max_bars": 3,
      "max_events": 10,
      "max_promotions": 5,
      "price": "499.00",
      "billing_period": "monthly"
    },
    "pending_subscription": null,
    "tier": "basic",
    "expires_at": "2026-04-14T04:00:00.000Z",
    "usage": {
      "bars": 2,
      "events": 3,
      "promotions": 1
    }
  }
}
```

If owner has a pending upgrade request:
```json
{
  "success": true,
  "data": {
    "subscription": null,
    "pending_subscription": {
      "id": 5,
      "status": "pending",
      "plan_name": "basic",
      "display_name": "Basic",
      "price": "499.00",
      "payment_method": "gcash",
      "payment_reference": "GCash Ref #123456789",
      "created_at": "2026-03-15T04:00:00.000Z"
    },
    "tier": "free",
    "expires_at": null,
    "usage": { "bars": 1, "events": 0, "promotions": 0 }
  }
}
```

If no subscription exists (free tier, no pending):
```json
{
  "success": true,
  "data": {
    "subscription": null,
    "pending_subscription": null,
    "tier": "free",
    "expires_at": null,
    "usage": { "bars": 1, "events": 0, "promotions": 0 }
  }
}
```

#### `POST /subscriptions/subscribe`
Submit a subscription upgrade request. Creates a **pending** subscription that awaits admin approval. **Requires auth.**

**Request body:**
```json
{
  "plan_id": 2,
  "payment_method": "gcash",           // required: 'gcash' | 'maya' | 'card' | 'manual'
  "payment_reference": "GCash Ref #123456789"  // required: transaction/reference number
}
```

**What the backend does:**
1. Cancels any existing **pending** subscription (replaces with new request)
2. Creates new subscription record with `status = 'pending'`
3. Does NOT activate the plan or unlock branches yet — waits for admin approval

**Response:**
```json
{
  "success": true,
  "message": "Payment submitted! Your Basic plan upgrade is pending admin approval.",
  "data": {
    "subscription_id": 5,
    "plan": "basic",
    "status": "pending"
  }
}
```

#### `POST /subscriptions/cancel`
Cancel both active and pending subscriptions. Reverts to free tier. **Requires auth.**

**What the backend does:**
1. Sets subscription status to 'cancelled' for both `active` and `pending` subscriptions
2. Reverts `bar_owners.subscription_tier` to 'free'
3. Locks all bars except the first one (free plan = 1 bar)

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled. Reverted to Free plan."
}
```

### Super Admin Subscription Endpoints (`/subscriptions/admin`)

These endpoints require **Super Admin** role. Used to verify payment references and approve/reject subscription requests.

#### `GET /subscriptions/admin/pending`
List all pending subscription requests. **Super Admin only.**

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "bar_owner_id": 1,
      "plan_id": 2,
      "status": "pending",
      "payment_method": "gcash",
      "payment_reference": "GCash Ref #123456789",
      "amount_paid": "499.00",
      "created_at": "2026-03-15T04:00:00.000Z",
      "plan_name": "basic",
      "plan_display_name": "Basic",
      "plan_price": "499.00",
      "max_bars": 3,
      "billing_period": "monthly",
      "first_name": "Juan",
      "last_name": "Dela Cruz",
      "email": "juan@example.com",
      "owner_record_id": 1
    }
  ]
}
```

#### `GET /subscriptions/admin/all?status=<optional>`
List all subscriptions (history). Optional `status` filter. **Super Admin only.**

**Response:** Same shape as pending but includes all statuses and additional fields (`starts_at`, `expires_at`, `cancelled_at`).

#### `POST /subscriptions/admin/approve/:id`
Approve a pending subscription. **Super Admin only.**

**What the backend does:**
1. Validates the subscription exists and has `status = 'pending'`
2. Cancels any existing **active** subscription for that owner
3. Sets the pending subscription to `status = 'active'`, calculates `expires_at` from NOW
4. Updates `bar_owners.subscription_tier` and `subscription_expires_at`
5. Unlocks bars up to the new plan's `max_bars` limit (locks extras)

**Response:**
```json
{
  "success": true,
  "message": "Approved Basic plan for owner #1",
  "data": { "subscription_id": 5, "plan": "basic", "expires_at": "2026-04-14T04:00:00.000Z" }
}
```

#### `POST /subscriptions/admin/reject/:id`
Reject a pending subscription. **Super Admin only.**

**Request body (optional):**
```json
{ "reason": "Invalid reference number" }
```

**What the backend does:**
1. Sets subscription status to `'rejected'`
2. Does NOT change the owner's current tier or bar locks

**Response:**
```json
{
  "success": true,
  "message": "Subscription request rejected.",
  "data": { "subscription_id": 5, "reason": "Invalid reference number" }
}
```

---

## 4. Authentication & Branch Scoping

### How `X-Bar-Id` header works

1. Frontend stores `selectedBarId` in `localStorage`
2. Every API request includes header: `X-Bar-Id: <selectedBarId>`
3. Backend `requireAuth` middleware:
   - Loads user from DB (gets default `bar_id` from `users` table)
   - If `X-Bar-Id` header is present AND user is `bar_owner`:
     - Looks up `bar_owners.id` from `user_id`
     - Verifies the bar exists, is owned by them, and is NOT locked
     - If valid, overrides `req.user.bar_id` with the requested value
   - All downstream route handlers use `req.user.bar_id` — automatically scoped

### Security

- Only `bar_owner` role can override `bar_id` via header
- Staff/HR cannot switch — they are locked to their assigned branch
- Locked branches (`is_locked = 1`) cannot be switched to
- Ownership is verified every request (owner must own the bar)

### Login flow

```
POST /auth/login → returns { token, user: { id, bar_id, role, ... } }
                    bar_id = the user's default/last active branch
```

The JWT token contains `{ id: user_id }`. The middleware fetches full user data from DB on every request.

---

## 5. Subscription Plans & Payment

### Payment Flow (with Admin Approval)

```
1. Owner clicks "Upgrade Plan" (on Branches page or Subscription page)
2. Sees plan comparison cards (Free / Basic / Premium)
3. Clicks "Upgrade to Basic" (or Premium)
4. Payment modal opens:
   - Shows plan details and price
   - Owner selects payment method: GCash / Maya / Card / Bank Transfer
   - Enters payment reference / transaction number (REQUIRED)
5. POST /subscriptions/subscribe { plan_id, payment_method, payment_reference }
6. Backend creates subscription with status = 'pending'
7. Owner sees "Pending Approval" banner on Subscription page
8. Super Admin reviews the request in "Subscription Approvals" page:
   - Sees owner name, plan, amount, payment method, reference number
   - Verifies the payment reference is real
   - Clicks "Approve" or "Reject"
9. On APPROVE: backend activates subscription → unlocks branches → owner sees active plan
10. On REJECT: subscription marked as rejected → owner can submit a new request
```

### Payment methods

| Method   | ID       | Description                    |
|----------|----------|--------------------------------|
| GCash    | `gcash`  | Philippine e-wallet            |
| Maya     | `maya`   | Philippine e-wallet            |
| Card     | `card`   | Credit/Debit card              |
| Bank     | `manual` | Manual bank deposit/transfer   |

### Plan limits enforcement

- **Creating a branch**: `POST /branches/create` checks `current_bar_count < max_bars`
- **Subscribing**: `POST /subscriptions/subscribe` creates a pending request (does NOT unlock branches yet)
- **Admin approves**: `POST /subscriptions/admin/approve/:id` activates plan, unlocks bars up to new limit, locks extras
- **Admin rejects**: `POST /subscriptions/admin/reject/:id` marks as rejected, no changes to bars
- **Cancelling**: `POST /subscriptions/cancel` cancels both active and pending, locks all bars except the first one
- **Switching**: `POST /branches/switch` rejects if `bars.is_locked = 1`

---

## 6. Frontend Implementation (React Manager App)

### Files created/modified

| File | Purpose |
|------|---------|
| `src/api/subscriptionApi.js` | API client for subscription endpoints (owner + admin) |
| `src/api/branchApi.js` | API client for branch endpoints |
| `src/stores/branchStore.js` | Zustand store for branch state (list, selected, switch) |
| `src/pages/Subscription.jsx` | Subscription & Billing page with plan cards, payment modal, pending banner |
| `src/pages/SubscriptionApprovals.jsx` | Super Admin page to review/approve/reject pending subscriptions |
| `src/pages/Branches.jsx` | My Branches page with branch cards, create/edit modal, map picker |
| `src/components/layout/Header.jsx` | Branch selector dropdown in header |
| `src/components/layout/Sidebar.jsx` | Added GitBranch, Crown, ShieldCheck icons + role-based nav filtering |
| `src/utils/permissions.js` | Added "My Branches", "Subscription", "Subscription Approvals" nav items |
| `src/api/apiClient.js` | Injects `X-Bar-Id` header on every request |
| `src/stores/authStore.js` | Clears `selectedBarId` on logout |
| `src/App.jsx` | Added `/branches`, `/subscription`, `/subscription-approvals` routes |

### Branch Store (Zustand)

```javascript
// Key state
branches: []           // all branches owned by this user
selectedBarId: number   // currently active branch ID (persisted in localStorage)
selectedBranch: object  // full branch object for selected

// Key actions
fetchBranches()         // GET /branches/my → populates branches[]
switchBranch(barId)     // POST /branches/switch → updates DB + local state
setSelectedBarId(barId) // local-only switch (no API call)
fetchSubscriptionInfo() // GET /branches/subscription-info
reset()                 // clear everything (on logout)
```

### apiClient X-Bar-Id injection

```javascript
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const selectedBarId = localStorage.getItem('selectedBarId');
  if (selectedBarId) config.headers['X-Bar-Id'] = selectedBarId;

  return config;
});
```

---

## 7. Flutter/Dart AI Prompt

Copy and paste the prompt below into your AI coding assistant when building the Flutter app. It contains everything the AI needs to implement multi-branch and subscription features correctly.

---

### PROMPT START — Copy everything below this line

```
You are building a Flutter/Dart mobile app (customer-facing + bar owner features) that connects to an existing Express.js backend. The backend already has full multi-branch and subscription support implemented. Your job is to build the Flutter frontend that integrates with these existing endpoints.

## BACKEND API INFO

Base URL: Use the environment variable or config for the API base URL (e.g. http://localhost:3000 or production URL).

All authenticated requests must include:
- Header: `Authorization: Bearer <jwt_token>`
- Header: `X-Bar-Id: <selected_bar_id>` (for bar owners who have multiple branches)

The `X-Bar-Id` header tells the backend which branch to scope data to. The backend verifies ownership. Only bar_owner role users can use this header. Staff/customers should NOT send it.

## BRANCH ENDPOINTS (for bar_owner role users)

### GET /branches/my
Returns all branches the owner has.
Response: { success: true, data: [ { id, name, address, city, status, latitude, longitude, image_path, logo_path, is_locked, created_at } ] }
- is_locked = 1 means the branch is over the subscription limit and cannot be accessed

### POST /branches/create
Body: { name (required), address (required), city (required), state, zip_code, phone, email, category, latitude, longitude, description }
Returns: { success: true, data: { id, name, status: "pending" } }
Returns 403 if over subscription limit with: { message: "Your current subscription plan allows up to X branch(es)...", data: { current, max } }

### POST /branches/switch
Body: { bar_id: <number> }
Returns: { success: true, data: { bar_id, bar_name } }
Returns 403 if branch is locked

### PATCH /branches/:id
Body: any subset of { name, description, address, city, state, zip_code, phone, email, category, latitude, longitude }
Returns: { success: true, message: "Branch updated successfully." }

### GET /branches/subscription-info
Returns: { success: true, data: { tier, plan_name, max_bars, current_bars, can_create: bool } }

## SUBSCRIPTION ENDPOINTS

### GET /subscriptions/plans (no auth required)
Returns: { success: true, data: [ { id, name, display_name, description, price, billing_period, max_bars, max_events, max_promotions, is_active, sort_order } ] }
Current plans: Free (₱0, 1 bar), Basic (₱499/mo, 3 bars), Premium (₱1,499/mo, 10 bars)

### GET /subscriptions/my (auth required)
Returns the owner's active subscription, pending subscription (if any), and usage stats.
Response: { success: true, data: { subscription: { id, status, plan_name, display_name, max_bars, price, billing_period, payment_method, amount_paid, starts_at, expires_at } | null, pending_subscription: { id, status, plan_name, display_name, price, payment_method, payment_reference, created_at } | null, tier: "free"|"basic"|"premium", expires_at, usage: { bars, events, promotions } } }
- `subscription` = currently active plan (or null if free)
- `pending_subscription` = upgrade request awaiting admin approval (or null)
- Both can be null (free tier, no pending), or pending can exist while subscription is null (free tier with pending upgrade)

### POST /subscriptions/subscribe (auth required)
Body: { plan_id: <number>, payment_method: "gcash"|"maya"|"card"|"manual" (required), payment_reference: "string" (required) }
IMPORTANT: This does NOT instantly activate the subscription. It creates a PENDING request.
Backend cancels any existing pending request, creates new one with status='pending'.
The subscription only becomes active after a Super Admin approves it.
Returns: { success: true, message: "Payment submitted! Your Basic plan upgrade is pending admin approval.", data: { subscription_id, plan, status: "pending" } }

### POST /subscriptions/cancel (auth required)
Cancels both active AND pending subscriptions. Reverts to free tier, locks all bars except first one.
Returns: { success: true, message: "Subscription cancelled. Reverted to Free plan." }

## WHAT TO BUILD IN FLUTTER

### 1. Branch Service/Provider
- Store the list of branches, selected branch ID, and subscription info
- Persist selectedBarId in SharedPreferences
- On app start (for bar_owner users), call GET /branches/my to load branches
- Auto-select the first branch if none saved
- Provide a switchBranch(barId) method that calls POST /branches/switch and updates local state

### 2. API Client X-Bar-Id Header
- In your Dio/http interceptor, read selectedBarId from SharedPreferences
- Add header `X-Bar-Id: <value>` to every authenticated request
- This ensures all data (inventory, menu, staff, events, POS, etc.) is automatically scoped to the selected branch

### 3. Branch Selector UI
- For bar_owner users with 2+ branches, show a branch switcher (dropdown or bottom sheet)
- Can be in the app bar, drawer, or settings
- Show branch name, city, status, and "Active" indicator
- Locked branches (is_locked = true) should be greyed out and not selectable
- On switch, refresh all displayed data

### 4. My Branches Page (bar_owner only)
- Show subscription banner: plan name, X of Y branches used, progress bar
- If can_create = true, show "Add Branch" button
- If can_create = false, show "Upgrade Plan" button → navigate to subscription page
- List branch cards with: image, name, address, status badge, lat/lng
- Each card has: "Switch to this branch" button (if not active), "Edit" button
- Create/Edit form: name, address, city, state, zip, phone, email, category, description, lat/lng
- Optional: integrate a map picker (Google Maps or OpenStreetMap) for lat/lng with reverse geocoding

### 5. Subscription Page (bar_owner only)
- Show current plan banner with usage stats (branches, events, promotions count)
- **PENDING STATE**: If `pending_subscription` exists in GET /subscriptions/my response:
  - Show an amber/yellow "Pending Approval" banner with: plan name, price, payment method, reference number, submission date
  - Disable all upgrade buttons (show "Upgrade pending..." or "Pending Approval" on the target plan card)
  - Show a "Cancel Request" button instead of "Cancel Plan"
- Show plan cards: Free / Basic / Premium with pricing, features, limits
- "Upgrade" button on higher plans (disabled if a pending request exists)
- Payment bottom sheet/dialog:
  - Plan summary (name, price, features)
  - Payment method selection: GCash, Maya, Card, Bank Transfer
  - Reference number input field (REQUIRED - user must enter their payment transaction number)
  - "Pay ₱XXX" button → calls POST /subscriptions/subscribe
  - After submitting, show success message: "Payment submitted! Awaiting admin approval."
- "Cancel Plan" button (if on paid plan or has pending request) with confirmation dialog
- Show billing details if active subscription exists (amount, method, dates)

### 6. Payment Methods
Available methods: gcash, maya, card, manual (bank transfer)
The backend stores the payment_method and payment_reference strings. The actual payment processing is done OUTSIDE the app (e.g., owner pays via GCash app, then enters the reference number in the app). The backend records the payment info, and a Super Admin must verify and approve it before the subscription activates.

### 7. Subscription Flow Summary
```
Owner submits payment → status = 'pending' → Admin reviews → Approve/Reject
  - Approved → status = 'active', branches unlocked
  - Rejected → status = 'rejected', owner can try again
```

## IMPORTANT RULES
- NEVER send X-Bar-Id header for customer role users — only for bar_owner
- Staff users cannot switch branches — they see only their assigned branch
- Always check is_locked before allowing branch switch
- The subscription page should only be accessible to bar_owner role
- Subscribing does NOT instantly activate — it creates a PENDING request that awaits admin approval
- While a pending request exists, disable all upgrade buttons and show the pending status clearly
- The owner can cancel a pending request (POST /subscriptions/cancel)
- After subscribing/cancelling, refresh subscription data and branch list
- After switching branches, refresh all data on the current screen
- The backend handles all subscription enforcement — the frontend just needs to show appropriate UI
- Both payment_method AND payment_reference are REQUIRED when subscribing
- All API responses follow the format: { success: bool, message?: string, data?: any }
- Error responses: { success: false, message: "error description" }
- 401 = token expired/invalid → redirect to login
- 403 = forbidden (no permission, over limit, locked branch, etc.)
- 503 with code "MAINTENANCE_MODE" = platform under maintenance

## CURRENCY
All prices are in Philippine Peso (₱ / PHP).
```

### PROMPT END — Copy everything above this line

---

## Migration File

Located at: `thesis-backend/migrations/multi_branch_support.sql`

```sql
-- Add 'pending' and 'rejected' to subscriptions.status enum for admin approval flow
ALTER TABLE `subscriptions`
  MODIFY COLUMN `status` enum('pending','active','cancelled','expired','past_due','rejected') NOT NULL DEFAULT 'pending';

-- Add BRANCH_MANAGE permission if not exists
INSERT IGNORE INTO `permissions` (`code`, `description`, `created_at`)
VALUES ('BRANCH_MANAGE', 'Create and manage bar branches', NOW());

-- Add the permission to role_permissions for bar_owner role (role_id = 7)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 7, id FROM permissions WHERE code = 'BRANCH_MANAGE';

COMMIT;
```

Run this migration on your database before using the branch features.

---

## Quick Reference: File Locations

### Backend
- `thesis-backend/routes/branches.js` — Branch CRUD + switch + subscription-info
- `thesis-backend/routes/subscriptions.js` — Plan listing, subscribe, cancel + admin approve/reject
- `thesis-backend/middlewares/requireAuth.js` — X-Bar-Id header processing
- `thesis-backend/migrations/multi_branch_support.sql` — DB migration (enum update + permissions)

### Frontend (React Manager App)
- `src/api/branchApi.js` — Branch API client
- `src/api/subscriptionApi.js` — Subscription API client (owner + admin endpoints)
- `src/api/apiClient.js` — Axios client with X-Bar-Id injection
- `src/stores/branchStore.js` — Branch Zustand store
- `src/pages/Branches.jsx` — My Branches page
- `src/pages/Subscription.jsx` — Subscription & Billing page (with pending state)
- `src/pages/SubscriptionApprovals.jsx` — Super Admin approval page
- `src/components/layout/Header.jsx` — Branch selector dropdown
