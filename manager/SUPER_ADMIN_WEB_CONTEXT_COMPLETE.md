# 🌐 SUPER ADMIN WEB - COMPLETE CONTEXT DOCUMENT

**Platform Bar Management System**  
**Super Admin Web Application - Technical Context**  
**Last Updated:** March 18, 2026  
**Database:** `tpg`  
**Backend:** Node.js + Express + MySQL  
**Frontend:** React + Vite (To Be Built)

---

## 📋 TABLE OF CONTENTS

1. [Introduction & Overview](#introduction--overview)
2. [System Architecture](#system-architecture)
3. [Authentication & Authorization](#authentication--authorization)
4. [Payment & Payout System](#payment--payout-system)
5. [Subscription Management](#subscription-management)
6. [Branch Management](#branch-management)
7. [Customer Banning System](#customer-banning-system)
8. [RBAC System](#rbac-system)
9. [Audit Logging](#audit-logging)
10. [Complete Feature List](#complete-feature-list)
11. [API Endpoint Reference](#api-endpoint-reference)
12. [Database Schema Reference](#database-schema-reference)
13. [Implementation Guide](#implementation-guide)
14. [Technology Stack](#technology-stack)
15. [Development Phases](#development-phases)

---

## 1. INTRODUCTION & OVERVIEW

### Purpose

This document provides **complete technical context** for building a new **Super Admin Web Application** for the Platform Bar Management System. The Super Admin portal provides global visibility and control over:

- **Payment Processing** - Monitor all transactions, manage payouts
- **Bar Management** - Approve/suspend bars, manage branches
- **Subscription Control** - Approve subscriptions, manage plans
- **User Management** - Global user oversight, customer banning
- **Financial Monitoring** - Platform revenue, fees, payouts
- **Compliance & Audit** - Activity logs, security monitoring

### Key Principles

✅ **Separation of Concerns** - Super Admin web is separate from Bar Manager web  
✅ **Backend Reuse** - Uses existing backend API endpoints  
✅ **Global Visibility** - View and control all platform data  
✅ **Security First** - RBAC, audit logs, secure authentication  
✅ **Action-Oriented** - Approve, reject, suspend, ban workflows  

---

## 2. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│               SUPER ADMIN WEB APPLICATION                    │
│              (React + Vite - To Be Built)                    │
│                                                              │
│  Pages: Dashboard, Bars, Payments, Subscriptions,          │
│         Users, Banning, RBAC, Audit Logs, Reports           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ REST API / HTTPS
                         │ Authorization: Bearer <JWT>
                         │
┌────────────────────────▼────────────────────────────────────┐
│              EXISTING BACKEND API SERVER                     │
│           (Node.js + Express.js + MySQL)                     │
│                                                              │
│  Super Admin Routes:                                         │
│  • /super-admin/*                                           │
│  • /super-admin-payments/*                                  │
│                                                              │
│  Middleware:                                                 │
│  • requireAuth - JWT validation                             │
│  • requireSuperAdmin - Role check                           │
│  • auditLog - Activity logging                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  MYSQL DATABASE (tpg)                        │
│                                                              │
│  Core Tables:                                                │
│  • bars, users, subscriptions                               │
│  • payment_transactions, payouts                            │
│  • audit_logs, platform_audit_logs                          │
│  • roles, permissions, role_permissions                     │
│  • customer_bar_bans, platform_settings                     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│               PAYMONGO PAYMENT API                           │
│           (Payment Processing & Payouts)                     │
└──────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. Super Admin logs in → JWT token issued
2. All requests include `Authorization: Bearer <token>`
3. Backend validates token + checks SUPER_ADMIN role
4. Backend queries MySQL database
5. Backend logs action to `platform_audit_logs`
6. Response returned to frontend

---

## 3. AUTHENTICATION & AUTHORIZATION

### Login Flow

**Endpoint:** `POST /auth/login`

**Request:**
```json
{
  "email": "admin@platform.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@platform.com",
    "role": "SUPER_ADMIN",
    "first_name": "Admin",
    "last_name": "User"
  }
}
```

### JWT Token Structure

```javascript
{
  "userId": 1,
  "email": "admin@platform.com",
  "role": "SUPER_ADMIN",
  "iat": 1710748800,
  "exp": 1710835200
}
```

### Backend Middleware

**`requireAuth` - Token Validation:**
```javascript
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const [user] = await pool.query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
  
  if (user[0].is_banned) {
    return res.status(403).json({ message: 'Account banned' });
  }
  
  req.user = user[0];
  next();
};
```

**`requireSuperAdmin` - Role Check:**
```javascript
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }
  next();
};
```

---

## 4. PAYMENT & PAYOUT SYSTEM

### Overview

The platform uses **PayMongo** for payment processing with a **5% platform fee** model:

```
Customer Payment (₱1,000)
  ↓
PayMongo Processing
  ↓
Recorded in payment_transactions
  ↓
Platform Fee: ₱50 (5%)
Bar Earnings: ₱950
  ↓
Stored in payouts table (status: pending)
  ↓
Super Admin reviews and marks as sent
  ↓
Bar owner receives GCash transfer
```

### Database Tables

**`payment_transactions` - All Customer Payments**

```sql
CREATE TABLE `payment_transactions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `user_id` INT(11) NULL COMMENT 'Customer user ID',
  `amount` DECIMAL(10,2) NOT NULL,
  `platform_fee` DECIMAL(10,2) DEFAULT 0.00,
  `net_amount` DECIMAL(10,2) NOT NULL COMMENT 'Amount after platform fee',
  `payment_method` ENUM('card', 'gcash', 'paymaya', 'grabpay', 'cash') NOT NULL,
  `status` ENUM('pending', 'processing', 'paid', 'failed', 'refunded', 'expired') NOT NULL DEFAULT 'pending',
  `payment_intent_id` VARCHAR(255) NULL COMMENT 'PayMongo payment intent ID',
  `source_id` VARCHAR(255) NULL COMMENT 'PayMongo source ID',
  `reference_number` VARCHAR(100) NULL,
  `entity_type` ENUM('order', 'reservation', 'subscription') NOT NULL,
  `entity_id` INT(11) NOT NULL,
  `metadata` JSON NULL,
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  `failed_at` TIMESTAMP NULL DEFAULT NULL,
  `failure_reason` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar` (`bar_id`),
  KEY `idx_status` (`status`),
  KEY `idx_payment_intent` (`payment_intent_id`)
);
```

**`payouts` - Bar Owner Payouts**

```sql
CREATE TABLE `payouts` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL COMMENT 'Net amount to be paid out',
  `platform_fee` DECIMAL(10,2) NOT NULL COMMENT 'Platform fee deducted',
  `gross_amount` DECIMAL(10,2) NOT NULL COMMENT 'Original amount before fee',
  `status` ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  `payout_method` ENUM('gcash', 'bank_transfer', 'paymongo') DEFAULT 'gcash',
  `gcash_number` VARCHAR(20) NULL,
  `gcash_account_name` VARCHAR(255) NULL,
  `reference_number` VARCHAR(100) NULL,
  `processed_by` INT(11) NULL COMMENT 'Super Admin user ID',
  `processed_at` TIMESTAMP NULL DEFAULT NULL,
  `notes` TEXT NULL,
  `period_start` DATE NOT NULL COMMENT 'Payout period start',
  `period_end` DATE NOT NULL COMMENT 'Payout period end',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_status` (`bar_id`, `status`)
);
```

**`platform_settings` - Platform Configuration**

```sql
CREATE TABLE `platform_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `description` TEXT NULL,
  `updated_by` INT(11) NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_setting_key` (`setting_key`)
);

INSERT INTO `platform_settings` VALUES
  (1, 'platform_fee_percentage', '5.00', 'Platform commission percentage', 1, NOW()),
  (2, 'paymongo_public_key', 'pk_test_...', 'PayMongo public API key', 1, NOW()),
  (3, 'paymongo_secret_key', 'sk_test_...', 'PayMongo secret API key', 1, NOW());
```

### Payment API Endpoints

**Dashboard:**
- `GET /super-admin-payments/dashboard` - Financial overview
- `GET /super-admin-payments/charts` - Revenue charts

**Transactions:**
- `GET /super-admin-payments/transactions` - All transactions
- `GET /super-admin-payments/transactions/:id` - Transaction details
- `POST /super-admin-payments/refunds/:id` - Process refund

**Payouts:**
- `GET /super-admin-payments/payouts` - All payouts
- `GET /super-admin-payments/payouts/:id` - Payout details
- `POST /super-admin-payments/payouts/:id/mark-sent` - Mark as sent
- `POST /super-admin-payments/payouts/bulk-mark-sent` - Bulk update

**Settings:**
- `GET /super-admin-payments/settings` - Payment settings
- `PUT /super-admin-payments/settings` - Update settings

### Payment Flow Example

**Customer Orders Food (₱1,000)**

1. Customer places order at Bar X
2. Backend creates payment intent via PayMongo
3. Customer pays via GCash
4. PayMongo webhook confirms payment
5. Backend records transaction:
   ```sql
   INSERT INTO payment_transactions (
     bar_id, user_id, amount, platform_fee, net_amount,
     payment_method, status, entity_type, entity_id
   ) VALUES (
     10, 123, 1000.00, 50.00, 950.00,
     'gcash', 'paid', 'order', 500
   );
   ```
6. Backend creates payout entry:
   ```sql
   INSERT INTO payouts (
     bar_id, amount, platform_fee, gross_amount,
     status, period_start, period_end
   ) VALUES (
     10, 950.00, 50.00, 1000.00,
     'pending', '2024-03-01', '2024-03-31'
   );
   ```

**Super Admin Processes Payout**

1. Super Admin views pending payouts
2. Transfers ₱950 to bar owner's GCash
3. Marks payout as sent:
   ```
   POST /super-admin-payments/payouts/15/mark-sent
   {
     "reference_number": "GCASH-20240318-XXXXX",
     "notes": "GCash transfer completed"
   }
   ```
4. Backend updates payout:
   ```sql
   UPDATE payouts SET
     status = 'completed',
     processed_by = 1,
     processed_at = NOW(),
     reference_number = 'GCASH-20240318-XXXXX'
   WHERE id = 15;
   ```

---

## 5. SUBSCRIPTION MANAGEMENT

### Subscription Plans

**`subscription_plans` Table:**

```sql
CREATE TABLE `subscription_plans` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `billing_cycle` ENUM('monthly', 'quarterly', 'yearly') NOT NULL DEFAULT 'monthly',
  `max_branches` INT(11) NOT NULL DEFAULT 1,
  `max_users` INT(11) NULL DEFAULT NULL,
  `features` JSON NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
);
```

**Default Plans:**
- **Starter** (₱999/mo): 1 branch, 10 staff
- **Professional** (₱2,499/mo): 3 branches, 50 staff
- **Enterprise** (₱4,999/mo): Unlimited branches

### Subscription Approval Workflow

```
Bar Owner Registers
  ↓
Submits Bar Details
  ↓
Chooses Subscription Plan
  ↓
Makes Payment (status: pending)
  ↓
Super Admin Reviews
  ↓
Approve → status: active, bar: approved
Reject → status: rejected, add reason
```

### Subscription API Endpoints

**Plans:**
- `GET /super-admin/subscription-plans` - List plans
- `POST /super-admin/subscription-plans` - Create plan
- `PUT /super-admin/subscription-plans/:id` - Update plan

**Approvals:**
- `GET /super-admin/subscription-approvals` - Pending subscriptions
- `POST /super-admin/subscriptions/:id/approve` - Approve
- `POST /super-admin/subscriptions/:id/reject` - Reject

**Management:**
- `GET /super-admin/subscriptions` - All subscriptions
- `PUT /super-admin/subscriptions/:id/extend` - Extend period
- `POST /super-admin/subscriptions/:id/cancel` - Force cancel

---

## 6. BRANCH MANAGEMENT

### Multi-Branch System

Bar owners can operate **multiple branches** based on subscription limits:

**`bars` Table:**
```sql
CREATE TABLE `bars` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `owner_id` INT(11) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `address` VARCHAR(255) NULL,
  `status` ENUM('pending', 'approved', 'suspended', 'rejected') DEFAULT 'pending',
  `is_main_branch` TINYINT(1) DEFAULT 0,
  `branch_code` VARCHAR(20) NULL,
  `gcash_number` VARCHAR(20) NULL,
  `payout_enabled` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`)
);
```

### Branch Approval Flow

1. Bar owner creates new branch (if within limit)
2. Submits branch details
3. Status: `pending`
4. Super Admin reviews
5. Approves → `status = 'approved'`
6. Rejects → `status = 'rejected'` + reason

### Branch API Endpoints

- `GET /super-admin/bars?status=pending` - Pending branches
- `GET /super-admin/bars/:id` - Branch details
- `POST /super-admin/bars/:id/approve` - Approve branch
- `POST /super-admin/bars/:id/suspend` - Suspend branch

---

## 7. CUSTOMER BANNING SYSTEM

### Two-Level Banning

**1. Global Platform Ban (Super Admin)**
- Customer banned from ALL bars
- Cannot login to platform
- Used for fraud, harassment, legal issues

**2. Per-Bar Ban (Bar Owner)**
- Customer banned from SPECIFIC bar only
- Can still use other bars
- Used for local incidents

### Database Schema

**Global Ban (`users` table):**
```sql
ALTER TABLE `users` 
  ADD COLUMN `is_banned` TINYINT(1) DEFAULT 0,
  ADD COLUMN `banned_at` TIMESTAMP NULL,
  ADD COLUMN `banned_by` INT(11) NULL,
  ADD COLUMN `ban_reason` TEXT NULL;
```

**Per-Bar Ban:**
```sql
CREATE TABLE `customer_bar_bans` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `customer_user_id` INT(11) NOT NULL,
  `bar_id` INT(11) NOT NULL,
  `reason` TEXT NOT NULL,
  `banned_by` INT(11) NOT NULL,
  `banned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_customer_bar` (`customer_user_id`, `bar_id`)
);
```

### Banning API Endpoints

**Global Banning:**
- `GET /super-admin/customers/banned` - Banned customers
- `POST /super-admin/customers/:id/ban` - Ban globally
- `DELETE /super-admin/customers/:id/ban` - Unban

**Per-Bar Bans:**
- `GET /super-admin/bar-bans` - All per-bar bans
- `POST /super-admin/bar-bans/:id/override` - Lift bar ban

---

## 8. RBAC SYSTEM

### Roles

1. **SUPER_ADMIN** - Full platform access
2. **BAR_OWNER** - Manage own bars
3. **MANAGER** - Bar management
4. **HR** - Employee management
5. **STAFF** - Limited permissions
6. **CASHIER** - POS operations
7. **CUSTOMER** - Public user

### Permissions (30+ Total)

**Categories:**
- POS & Sales: `POS_ACCESS`, `POS_CREATE_ORDER`, `POS_VIEW_SALES`
- Inventory: `INVENTORY_READ`, `INVENTORY_MANAGE`
- Menu: `MENU_READ`, `MENU_MANAGE`
- Reservations: `RESERVATION_READ`, `RESERVATION_MANAGE`
- HR: `HR_VIEW_EMPLOYEES`, `HR_MANAGE_PAYROLL`
- Bar: `BAR_SETTINGS`, `BAR_MANAGE_USERS`
- Branch: `BRANCH_MANAGE`
- Super Admin: `SUPER_ADMIN_FULL_ACCESS`, `SUPER_ADMIN_MANAGE_BARS`

### Database Tables

```sql
CREATE TABLE `roles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` TEXT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(50) NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `role_permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `role_id` INT(11) NOT NULL,
  `permission_id` INT(11) NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `user_permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `permission_id` INT(11) NOT NULL,
  `granted_by` INT(11) NULL,
  PRIMARY KEY (`id`)
);
```

---

## 9. AUDIT LOGGING

### Two-Level Logging

**1. Bar Activity (`audit_logs`)**
- Bar-specific actions
- Staff activities
- POS operations

**2. Platform Activity (`platform_audit_logs`)**
- Super Admin actions
- System-wide changes
- Critical operations

### Database Schema

```sql
CREATE TABLE `platform_audit_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin_user_id` INT(11) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity` VARCHAR(50) NOT NULL,
  `entity_id` INT(11) NULL,
  `details` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```

**Super Admin Actions Logged:**
- `SUPER_ADMIN_APPROVE_BAR`
- `SUPER_ADMIN_SUSPEND_BAR`
- `SUPER_ADMIN_BAN_CUSTOMER`
- `SUPER_ADMIN_APPROVE_SUBSCRIPTION`
- `SUPER_ADMIN_PROCESS_PAYOUT`
- `SUPER_ADMIN_UPDATE_PLATFORM_FEE`

### Audit API Endpoints

- `GET /super-admin/audit-logs` - Platform logs
- `GET /super-admin/bars/:id/audit-logs` - Bar logs
- `GET /super-admin/users/:id/activity` - User activity

---

## 10. COMPLETE FEATURE LIST

### ✅ Dashboard & Analytics
- Financial overview (revenue, fees, payouts)
- Bar statistics (total, active, pending)
- Subscription metrics
- Customer metrics
- Transaction analytics
- Real-time charts

### ✅ Bar Management
- Bar directory (search, filter, sort)
- Bar approvals
- Branch management
- Bar suspension/reactivation
- Document verification
- Bar analytics

### ✅ Payment & Payout Control
- Transaction monitoring
- Payout processing
- Platform fee management
- Payment settings
- Refund handling
- Financial reports

### ✅ Subscription Management
- Plan creation/editing
- Subscription approvals
- Active subscriptions
- Plan analytics
- Revenue by plan

### ✅ User Management
- User directory (all roles)
- Bar owner management
- Customer management
- Staff monitoring
- User activity logs
- Permission viewer

### ✅ Security & Compliance
- Global customer banning
- Per-bar ban monitoring
- RBAC viewer
- Audit log viewer
- Security alerts
- Data compliance

### ✅ Content Moderation
- Review monitoring
- Event moderation
- Social content flagging
- Inappropriate content removal

### ✅ Operational Monitoring
- Order tracking
- Reservation monitoring
- Inventory oversight
- Employee analytics

### ✅ Reporting
- Financial reports
- Operational reports
- Compliance reports
- Export (CSV/PDF)

### ✅ System Settings
- Platform fee configuration
- PayMongo settings
- Feature flags
- Notification system

---

## 11. API ENDPOINT REFERENCE

### Authentication
```
POST   /auth/login                    - Login
POST   /auth/logout                   - Logout
POST   /auth/refresh                  - Refresh token
```

### Dashboard
```
GET    /super-admin/dashboard/overview - Main dashboard
GET    /super-admin/dashboard/charts   - Chart data
```

### Bar Management
```
GET    /super-admin/bars                     - List all bars
GET    /super-admin/bars/:id                 - Bar details
GET    /super-admin/bars/:id/branches        - Bar branches
GET    /super-admin/bars/:id/financials      - Bar financials
POST   /super-admin/bars/:id/approve         - Approve bar
POST   /super-admin/bars/:id/reject          - Reject bar
POST   /super-admin/bars/:id/suspend         - Suspend bar
POST   /super-admin/bars/:id/reactivate      - Reactivate bar
```

### Payments & Payouts
```
GET    /super-admin-payments/dashboard           - Payment dashboard
GET    /super-admin-payments/transactions        - All transactions
GET    /super-admin-payments/payouts             - All payouts
POST   /super-admin-payments/payouts/:id/mark-sent - Mark sent
GET    /super-admin-payments/settings            - Payment settings
PUT    /super-admin-payments/settings            - Update settings
```

### Subscriptions
```
GET    /super-admin/subscription-plans         - List plans
POST   /super-admin/subscription-plans         - Create plan
PUT    /super-admin/subscription-plans/:id     - Update plan
GET    /super-admin/subscription-approvals     - Pending subscriptions
POST   /super-admin/subscriptions/:id/approve  - Approve
POST   /super-admin/subscriptions/:id/reject   - Reject
```

### User Management
```
GET    /super-admin/users               - All users
GET    /super-admin/users/:id           - User details
GET    /super-admin/users/:id/activity  - User activity
GET    /super-admin/bar-owners          - Bar owners
GET    /super-admin/customers           - Customers
```

### Customer Banning
```
GET    /super-admin/customers/banned       - Banned customers
POST   /super-admin/customers/:id/ban      - Ban globally
DELETE /super-admin/customers/:id/ban      - Unban
GET    /super-admin/bar-bans               - Per-bar bans
```

### Audit Logs
```
GET    /super-admin/audit-logs             - Platform logs
GET    /super-admin/bars/:id/audit-logs    - Bar logs
```

---

## 12. DATABASE SCHEMA REFERENCE

### Core Tables

**users** - All platform users
**bars** - Bar/branch records
**subscriptions** - Active subscriptions
**subscription_plans** - Available plans
**payment_transactions** - All payments
**payouts** - Bar payouts
**roles** - User roles
**permissions** - System permissions
**role_permissions** - Role-permission mapping
**user_permissions** - User-specific permissions
**customer_bar_bans** - Per-bar customer bans
**audit_logs** - Bar activity logs
**platform_audit_logs** - Super Admin activity
**platform_settings** - System configuration

---

## 13. IMPLEMENTATION GUIDE

### Phase 1: Foundation (Week 1-2)
- Setup Vite + React project
- Install dependencies
- Create authentication system
- Build layout components
- Implement protected routes

### Phase 2: Core Features (Week 3-4)
- Build dashboard
- Implement bar management
- Create payment monitoring pages
- Develop payout processing

### Phase 3: Subscriptions & Users (Week 5)
- Subscription plan management
- Subscription approvals
- User directory
- Customer management

### Phase 4: Security & Compliance (Week 6)
- Customer banning system
- RBAC viewer
- Audit log viewer

### Phase 5: Monitoring & Reports (Week 7)
- Content moderation
- Document verification
- Report generation

### Phase 6: Polish & Testing (Week 8)
- System settings
- UI/UX improvements
- Testing
- Production deployment

---

## 14. TECHNOLOGY STACK

### Frontend (To Be Built)
- **React 18+** - UI framework
- **Vite** - Build tool
- **Zustand** - State management
- **React Router v6** - Routing
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Recharts** - Data visualization
- **Axios** - HTTP client
- **React Hook Form + Zod** - Forms

### Backend (Existing)
- **Node.js 18+** - Runtime
- **Express.js** - API framework
- **MySQL 8.0+** - Database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **PayMongo** - Payment processing

### Infrastructure
- **Vercel/Netlify** - Frontend hosting
- **VPS/AWS** - Backend hosting
- **MySQL** - Database server

---

## 15. DEVELOPMENT PHASES

### Immediate Next Steps

1. **Create Project Structure**
   ```bash
   npm create vite@latest super-admin-web -- --template react
   cd super-admin-web
   npm install
   ```

2. **Install Dependencies**
   ```bash
   npm install react-router-dom zustand axios
   npm install -D tailwindcss postcss autoprefixer
   npm install recharts lucide-react react-hook-form zod
   npm install @hookform/resolvers react-hot-toast
   ```

3. **Setup Tailwind**
   ```bash
   npx tailwindcss init -p
   ```

4. **Create Environment File**
   ```env
   VITE_API_BASE_URL=http://localhost:3000
   VITE_APP_NAME=Super Admin Portal
   ```

5. **Build Login Page**
   - Create login form
   - Implement authentication
   - Store JWT token
   - Redirect to dashboard

6. **Build Layout**
   - Create sidebar navigation
   - Create top navbar
   - Implement protected routes

7. **Build Dashboard**
   - Fetch dashboard data
   - Display key metrics
   - Render charts

---

## 🎯 SUCCESS CRITERIA

✅ **Functional Requirements Met:**
- All features documented are implemented
- All API endpoints integrated
- Data displays accurately
- Actions work correctly

✅ **Performance:**
- Page load < 2 seconds
- API response < 500ms
- Smooth navigation

✅ **Security:**
- Secure authentication
- Role-based access control
- Audit logging functional

✅ **Usability:**
- Intuitive navigation
- Clear action feedback
- Responsive design
- Fast search/filter

---

## 📚 ADDITIONAL RESOURCES

**Backend API Base URL:** `http://localhost:3000`

**Authentication Header:** `Authorization: Bearer <JWT_TOKEN>`

**Database:** `tpg` on MySQL

**Related Documents:**
- SUPER_ADMIN_WEB_CONTEXT_PART1_PAYMENTS.md
- SUPER_ADMIN_WEB_CONTEXT_PART2_SUBSCRIPTIONS.md
- SUPER_ADMIN_WEB_CONTEXT_PART3_BANNING_RBAC.md
- SUPER_ADMIN_WEB_CONTEXT_PART4_COMPLETE_FEATURES.md
- SUPER_ADMIN_WEB_CONTEXT_PART5_IMPLEMENTATION.md

---

**END OF COMPLETE CONTEXT DOCUMENT**

**Document Status:** ✅ Complete and Ready for Implementation

**Last Updated:** March 18, 2026

---

This document provides everything needed to build the Super Admin Web Application. All backend routes exist and are functional. The frontend needs to be built following the structure and patterns described in this document.
