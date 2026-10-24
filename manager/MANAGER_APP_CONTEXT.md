# THE PARTY GOERS — Manager Website Application Context

> Auto-generated codebase analysis for Flutter agent implementation.

---

## 1. PROJECT OVERVIEW

### Platform
- **Name:** The Party Goers PH — Bar Operation Portal
- **Purpose:** Web dashboard for bar owners/staff to manage all bar operations
- **Users:** bar_owner, manager, hr, staff, cashier — each with RBAC access

### Capabilities
Bar details, tax config (BIR), menu, inventory, tables, reservations, events, staff CRUD + RBAC, attendance, leaves, payroll (SSS/PhilHealth/PagIBIG), documents, customers/bans, reviews, promotions, POS, analytics, financials (auto-payout, cashflow, tax reports), audit logs, multi-branch, subscriptions, DSS (AI suggestions), social (posts, comments, followers, notifications)

### Frontend Stack
- React 19 + Vite 6, Axios 1.7, Zustand 5, React Router DOM 7, TailwindCSS 3.4, Lucide React, Recharts 2.15, date-fns 4.1, react-hot-toast 2.5, Leaflet (CDN, CartoDB Dark Matter tiles)

### Backend Stack
- Express 5 (CommonJS), MySQL 8 (mysql2/promise, timezone +08:00), JWT + bcrypt, PayMongo, Multer 2, Nodemailer + Resend, PDFKit, Helmet, express-rate-limit, google-auth-library

### Environment
- Frontend: `http://localhost:5173` — env: `VITE_API_URL=http://localhost:3000`
- Backend: `http://localhost:3000` — env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, PAYMONGO keys, PLATFORM_FEE_PERCENTAGE, SMTP config
- Timezone: Asia/Manila (UTC+8)

---

## 2. DIRECTORY STRUCTURE

### Frontend (`src/`)
```
src/
├── main.jsx                — React root: BrowserRouter + Toaster + global error handlers
├── App.jsx                 — 28+ routes with ProtectedRoute guards
├── index.css               — TailwindCSS + custom classes (btn, card, badge, table, input, label, animations)
├── api/                    — 26 Axios API modules (one per domain)
│   ├── apiClient.js        — Base Axios: Bearer token, X-Bar-Id header, 401/403 interceptors
│   ├── authApi.js          — login, getMe, getPermissions, registerBarOwner
│   ├── barApi.js           — bar CRUD, media upload, dashboard, posts, tax config
│   ├── analyticsApi.js     — dashboard, visits, reviews, followers
│   ├── attendanceApi.js    — clockInOut, HR management
│   ├── auditApi.js         — list audit logs
│   ├── branchApi.js        — branches CRUD, switch, subscription info
│   ├── customerApi.js      — list, ban, unban
│   ├── documentApi.js      — upload, list, view, send, recipients, received, markRead
│   ├── dssApi.js           — getRecommendations (AI)
│   ├── eventApi.js         — events CRUD, image, analytics, comments
│   ├── financialsApi.js    — autoPayout, cashflow, trends, payouts
│   ├── inventoryApi.js     — inventory CRUD, image, sales
│   ├── leaveApi.js         — apply, myLeaves, list, decide
│   ├── menuApi.js          — menu CRUD
│   ├── orderApi.js         — customer orders, tax, receipts, sales report
│   ├── paymentApi.js       — payments, subscriptions, payouts
│   ├── payrollApi.js       — payroll runs, items, finalize
│   ├── posApi.js           — POS menu, tables, orders, pay, dashboard
│   ├── promotionApi.js     — promotions CRUD, toggle
│   ├── reservationApi.js   — list, approve/reject/cancel, lookup
│   ├── reviewApi.js        — reviews, respond, stats
│   ├── socialApi.js        — follows, comments, notifications
│   ├── staffApi.js         — staff CRUD, RBAC, archive, password reset
│   ├── subscriptionApi.js  — plans, subscribe, cancel, admin approve/reject
│   └── tableApi.js         — tables CRUD, image, status
├── components/
│   ├── common/ConfirmModal.jsx, LoadingSpinner.jsx, ProtectedRoute.jsx
│   ├── layout/DashboardLayout.jsx, Header.jsx, Sidebar.jsx
│   └── landing/ (10 marketing components)
├── hooks/usePermission.js  — isOwner, isManager, isHR, can() helper
├── pages/ (31 pages)       — See Section 3
├── services/orderService.js — Thin wrapper over orderApi
├── stores/
│   ├── authStore.js        — Zustand: user, permissions, token, login/logout/init/hasPermission
│   └── branchStore.js      — Zustand: branches, selectedBarId, switch, subscription
└── utils/
    ├── dateUtils.js        — parseUTC() for MySQL timestamps
    ├── navigationGroups.js — 7 nav groups, getVisibleGroups(), findGroupForRoute()
    └── permissions.js      — PERMISSIONS enum, NAV_ITEMS, hasPermission(), isOwnerRole()
```

### Backend (`thesis-backend/`)
```
├── index.js                — Express entry: middleware, 37 route mounts, rate limiters, reminder scheduler
├── config/database.js      — MySQL2 pool (timezone +08:00)
├── config/constants.js     — USER_ROLES, ALLOWED_CREATE arrays, EMPLOYMENT_STATUSES
├── middlewares/
│   ├── requireAuth.js      — JWT verify, user lookup, inactive check, maintenance mode, X-Bar-Id override
│   ├── requireRole.js      — Role array check
│   ├── requirePermission.js — DB-driven RBAC (SUPER_ADMIN/BAR_OWNER bypass, user→role fallback)
│   ├── sanitize.js, sanitizePath.js, uploadFallback.js
├── routes/ (37 files)      — See Section 5
├── utils/audit.js, deductionCalculator.js, emailService.js, helpers.js, profileUrl.js, reservationReminders.js
├── migrations/             — SQL migration files
└── uploads/                — File storage
```

---

## 3. ALL VIEWS / PAGES

### 3.1 LandingPage (`/`)
- **Purpose:** Public marketing landing page
- **Sections:** Hero, SocialProofBar, WhatIsIt, Features, RoleShowcase, HowItWorks, Pricing, Testimonials, FinalCTA, Footer
- **API Calls:** None | **Auth:** No

### 3.2 Login (`/login`)
- **Purpose:** Email + password authentication
- **UI:** Login form (email, password), error display, forgot password link, register link
- **API:** `POST /auth/login` → `{ token, user }`
- **State:** email, password, error, isLoading (via authStore.login)
- **Rules:** On success → store token → fetch permissions → redirect `/dashboard`. Rate limited (20/15min).

### 3.3 Register (`/register`)
- **Purpose:** Bar owner registration (multi-step)
- **UI:** Step 1: Personal info (name, email, password). Step 2: Bar info (name, address, city, province, description). Step 3: Media (image, icon). Step 4: Operating hours + map location picker.
- **API:** `POST /auth/register-bar-owner` (FormData multipart)
- **State:** All form fields, step, loading, errors
- **Rules:** Cavite bounds restriction `[[13.90, 120.50], [14.65, 121.25]]`. Password min length. Email uniqueness (409).

### 3.4 Dashboard (`/dashboard`) — Permission: none (all authenticated)
- **Purpose:** Overview with stats, alerts, AI suggestions
- **UI Sections:**
  - Welcome banner (gradient red card)
  - Stats grid: Today's Reservations, Revenue (₱), Orders, Upcoming Events
  - Low Stock Alerts (top 5, critical/warning badges)
  - Top Menu Items (top 5 by sales)
  - Smart Suggestions DSS (AI recommendations: critical/warning/insight/positive severity)
  - Recent Staff Activity
  - Attendance shortcut (staff-only users)
- **API:**
  - `GET /owner/bar/dashboard/summary` → `{ reservations_today, today_revenue, today_orders, upcoming_events, low_stock_alerts[], top_menu_items[], recent_staff_activity[] }`
  - `GET /owner/dss/recommendations` → `{ recommendations[{ id, severity, title, message, action_label, action_route }] }`
- **State:** summary, loading, dss, dssLoading, dssUpdatedAt
- **Rules:** DSS auto-refreshes every 30min. Cards shown per permission.

### 3.5 BarManagement (`/bar-management`) — Permission: `bar_details_view`
- **Purpose:** Edit bar details, hours, reservation settings, tax config, location
- **UI Sections:**
  - Bar Info card (name, description, city, province, address, phone, email)
  - Bar Media (cover image, icon, GIF/video with preview)
  - Operating Hours (7-day schedule, open/close times, closed toggle)
  - Reservation Settings (auto-approve, max guests, advance days, cancellation hours, time slot interval, guest increment)
  - Tax Configuration (BIR registered toggle, TIN, tax type VAT/NON_VAT, tax rate, tax mode EXCLUSIVE/INCLUSIVE, live preview for ₱100)
  - Map Location Picker modal (Leaflet + CartoDB Dark Matter tiles, draggable marker, Nominatim reverse geocode, Cavite bounds)
- **API:**
  - `GET /owner/bar/details` → bar object
  - `PATCH /owner/bar/details`, `PATCH /owner/bar/settings`
  - `POST /owner/bar/image`, `POST /owner/bar/icon`, `POST /owner/bar/gif` (FormData)
  - `GET /owner/tax-config` → `{ tin, is_bir_registered, tax_type, tax_rate, tax_mode }`
  - `PUT /owner/tax-config` → update tax settings
- **State:** bar, loading, saving, taxConfig, taxLoading, taxSaving, showMap, mapCoords
- **Rules:** TIN format `123-456-789-000`. Tax preview: EXCLUSIVE = tax on top, INCLUSIVE = tax embedded.

### 3.6 Inventory (`/inventory`) — Permission: `menu_view`
- **Purpose:** Manage inventory items (ingredients/supplies)
- **UI:** Item table, Create/Edit modal, image upload, deactivate confirm
- **API:** `GET /owner/inventory`, `POST /owner/inventory`, `PATCH /owner/inventory/:id`, `POST /owner/inventory/:id/image`, `DELETE /owner/inventory/:id`, `POST /owner/sales`, `GET /owner/sales`, `GET /owner/bar/sales/summary`
- **State:** items, loading, modalOpen, editingItem, form, saving
- **Rules:** Low stock = stock_qty ≤ reorder_level. Linked to menu items.

### 3.7 Menu (`/menu`) — Permission: `menu_view`
- **Purpose:** Manage menu items (drinks, food)
- **UI:** Menu grid/list, Create/Edit modal, inventory link, availability toggle
- **API:** `GET /owner/menu`, `POST /owner/menu`, `PATCH /owner/menu/:id`, `DELETE /owner/menu/:id`
- **State:** menuItems, loading, modalOpen, editingItem, form
- **Rules:** Each item links to inventory_item_id. Selling price > 0.

### 3.8 Tables (`/tables`) — Permission: `table_view`
- **Purpose:** Manage bar tables/seating
- **UI:** Tables grid cards, Create/Edit modal, image upload, reservation status calendar
- **API:** `GET /owner/bar/tables`, `POST /owner/bar/tables`, `PATCH /owner/bar/tables/:id`, `POST /owner/bar/tables/:id/image`, `GET /owner/bar/tables/status?date=`
- **State:** tables, loading, modalOpen, editingTable, selectedDate

### 3.9 Reservations (`/reservations`) — Permission: `reservation_view`
- **Purpose:** View/manage customer reservations
- **UI:** Filter bar (status, date range), reservations table, detail modal, lookup by txn
- **API:** `GET /owner/reservations?status=&from=&to=`, `PATCH /owner/reservations/:id/status` `{ action }`, `GET /reservations/lookup/:txn`
- **State:** reservations, loading, filters, selectedReservation
- **Rules:** Statuses: pending→approved/rejected, approved→cancelled. Payment status checked.

### 3.10 Events (`/events`) — Permission: `events_view`
- **Purpose:** Manage events + social posts
- **UI:** Tabs (Events, Social Posts), event list/grid, Create/Edit modal, detail+comments, analytics, archived, post creation
- **API:** `GET /owner/bar/events`, `GET /owner/bar/events/:id/details`, `GET /owner/bar/events/archived`, `POST /owner/bar/events`, `PATCH /owner/bar/events/:id`, `DELETE /owner/bar/events/:id?mode=cancel|archive`, `POST /owner/bar/events/:id/image`, `GET /owner/bar/events/analytics`, `POST /owner/bar/comments/events/:commentId/replies`, `DELETE /owner/bar/comments/events/:commentId`, `GET /owner/bar/posts`, `POST /social/bar-posts` (FormData), `DELETE /owner/bar/posts/:postId`, `GET /owner/bar/comments`, `DELETE /owner/bar/comments/:type/:commentId`
- **State:** events, archivedEvents, selectedEvent, eventForm, posts, comments, analytics, activeTab, loading

### 3.11 Staff (`/staff`) — Permission: `staff_view`
- **Purpose:** Staff accounts + RBAC permissions
- **UI:** Staff table, Create/Edit modal (name, email, password, role), archived, RBAC permission editor, password reset
- **API:** `GET /owner/bar/users`, `POST /owner/bar/users`, `PATCH /owner/bar/users/:id`, `POST /owner/bar/users/:id/toggle`, `DELETE /owner/bar/users/:id`, `GET /owner/bar/users/archived`, `POST /owner/bar/users/:id/restore`, `POST /owner/bar/users/:id/permanent-delete`, `POST /owner/bar/users/:id/reset-password`, `GET /owner/rbac/roles`, `GET /owner/rbac/permissions`, `GET /owner/rbac/users/:id/permissions`, `PATCH /owner/rbac/users/:id/role`, `PATCH /owner/rbac/users/:id/permissions`
- **State:** staff, archivedStaff, roles, permissions, modalOpen, editingStaff, form, permissionModal
- **Rules:** Owner creates: staff/hr/cashier/manager. HR creates: staff only. Per-user permission overrides.

### 3.12 Attendance (`/attendance`) — Permission: `attendance_view_own` | `attendance_view_all`
- **Purpose:** Track staff attendance
- **UI:** My Attendance tab, HR tab (all staff), clock in/out buttons, date filters, manual entry
- **API:** `POST /attendance/employee/attendance { action }`, `GET /attendance/my/attendance`, `GET /attendance/hr/attendance`, `POST /attendance/hr/attendance`, `PATCH /attendance/hr/attendance/:id`
- **State:** myAttendance, allAttendance, loading, activeTab, filters

### 3.13 Leaves (`/leaves`) — Permission: `leave_view_own` | `leave_view_all`
- **Purpose:** Leave application and management
- **UI:** My Leaves tab, All Leaves tab (HR), apply form, approve/reject
- **API:** `POST /api/leaves`, `GET /api/leaves/my`, `GET /api/leaves`, `PATCH /api/leaves/:id/decision`
- **State:** myLeaves, allLeaves, loading, activeTab, form

### 3.14 Payroll (`/payroll`) — Permission: `payroll_view_own` | `payroll_view_all`
- **Purpose:** Full payroll management
- **UI:** My Payroll tab (payslips), Payroll Runs tab (create/manage), Run Detail (items, finalize), Preview
- **API:** `GET /hr/payroll/my-payroll`, `GET /hr/payroll/payroll`, `POST /hr/payroll/run`, `GET /hr/payroll/runs`, `POST /hr/payroll/runs/:runId/generate`, `GET /hr/payroll/runs/:runId/items`, `PATCH /hr/payroll/runs/:runId/finalize`, `DELETE /hr/payroll/runs/:runId`
- **State:** myPayroll, runs, selectedRun, runItems, preview, form, loading, activeTab
- **Rules:** Run statuses: draft→finalized. Auto-calculates SSS, PhilHealth, PagIBIG, withholding tax.

### 3.15 DeductionSettings (`/deduction-settings`) — Permission: `payroll_create`
- **Purpose:** Configure statutory deduction brackets
- **UI:** Tabs per deduction type (SSS, PhilHealth, PagIBIG, tax), bracket tables, CRUD
- **API:** Various `/hr/payroll/` deduction endpoints
- **State:** settings, loading, activeTab, editingBracket

### 3.16 Documents (`/documents`) — Permission: `documents_view_own` | `documents_view_all`
- **Purpose:** Upload, send, manage HR documents
- **UI:** Upload form, document list, send modal (select recipients), received docs, read tracking
- **API:** `POST /documents/upload` (FormData), `GET /documents`, `GET /documents/my`, `GET /documents/:id/view` (blob), `POST /documents/:id/send`, `GET /documents/:id/recipients`, `GET /documents/received`, `PATCH /documents/:id/mark-read`
- **State:** documents, received, myDocuments, loading, selectedDoc, sendModal

### 3.17 Customers (`/customers`) — Permission: `ban_view`
- **Purpose:** View customers, manage bans
- **UI:** Customer list table, ban/unban buttons
- **API:** `GET /owner/bar/customers`, `POST /owner/bar/customers/:id/ban`, `DELETE /owner/bar/customers/:id/ban`
- **State:** customers, loading

### 3.18 Reviews (`/reviews`) — Permission: `reviews_view`
- **Purpose:** View/respond to customer reviews
- **UI:** Stats summary, review list, detail modal with response form
- **API:** `GET /owner-reviews`, `GET /owner-reviews/:id`, `POST /owner-reviews/:id/respond`, `GET /owner-reviews/stats/summary`
- **State:** reviews, stats, loading, selectedReview, response

### 3.19 Promotions (`/promotions`) — No permission required
- **Purpose:** Manage bar promotions
- **UI:** Promotion list/grid, Create/Edit modal (FormData), toggle active
- **API:** `GET /promotions`, `GET /promotions/:id`, `POST /promotions` (FormData), `PATCH /promotions/:id` (FormData), `POST /promotions/:id/toggle`, `DELETE /promotions/:id`
- **State:** promotions, loading, modalOpen, editingPromo, form

### 3.20 Analytics (`/analytics`) — Permission: `analytics_bar_view`
- **Purpose:** Bar analytics dashboard with charts
- **UI:** Overview stats, visits/reviews/followers charts (Recharts)
- **API:** `GET /analytics/dashboard`, `GET /analytics/visits`, `GET /analytics/reviews`, `GET /analytics/followers`
- **State:** dashboard, visits, reviews, followers, loading

### 3.21 Financials (`/financials`) — Permission: `financials_view`
- **Purpose:** Financial management with 5 tabs
- **UI Tabs:**
  - **Auto Payout:** Date filter, stat cards (Total Sales, Platform Fees, Net Earnings), Revenue Breakdown
  - **Cashflow:** Stat cards (Income, Expenses, Platform Fees, Net Profit), sources, payout status, Sales Trend chart
  - **POS Orders:** Filter bar, orders table, detail modal
  - **Payouts:** Summary cards, filters, payouts table
  - **Tax Report:** Date filter (default: current month), 4 cards (Orders, Net Sales, Tax Collected, Gross Sales), Tax Breakdown panel, Daily Tax table with totals, Revenue vs Tax stacked bar chart
- **API:**
  - `GET /owner/financials/auto-payout?from=&to=`
  - `GET /owner/financials/cashflow?from=&to=`
  - `GET /owner/financials/trends?period=30days`
  - `GET /owner/financials/payouts?status=&from=&to=`
  - `GET /pos/orders?status=&from=&to=`, `GET /pos/orders/:id`
  - `GET /customer-orders/reports/sales?from=&to=` → `{ total_orders, net_sales, total_tax_collected, total_sales, daily[] }`
- **State:** autoPayout, cashflow, trends, posOrders, payoutsData, taxReport, activeTab, dateRange, taxFilters, selectedOrder, loading states

### 3.22 AuditLogs (`/audit-logs`) — Permission: `logs_view`
- **Purpose:** System audit trail
- **UI:** Filter bar (date, action type), logs table
- **API:** `GET /hr/audit-logs?from=&to=&action=&page=&limit=`
- **State:** logs, loading, filters, pagination

### 3.23 Profile (`/profile`) — No permission required
- **Purpose:** View/edit own profile
- **UI:** Profile card (name, email, role, avatar), edit form
- **API:** `GET /auth/me`

### 3.24 Settings (`/settings`) — No permission required
- **Purpose:** Password change, preferences
- **UI:** Password change form, notification preferences

### 3.25 Branches (`/branches`) — Permission: `bar_details_view`
- **Purpose:** Multi-branch management
- **UI:** Branch list cards, create form, edit, switch
- **API:** `GET /branches/my`, `POST /branches/create`, `PATCH /branches/:id`, `POST /branches/switch`, `GET /branches/subscription-info`
- **State:** branches (branchStore), form, loading
- **Rules:** Branch limit by subscription tier. Switch reloads page. Locked branches inaccessible.

### 3.26 Subscription (`/subscription`) — Permission: `bar_details_view`
- **Purpose:** Manage bar subscription
- **UI:** Current plan card, plan comparison, subscribe/renew, payment status
- **API:** `GET /subscriptions/plans`, `GET /subscriptions/my`, `POST /subscriptions/subscribe`, `POST /subscriptions/cancel`, `POST /subscription-payments/subscribe`, `POST /subscription-payments/renew`, `GET /subscription-payments/status/:ref`
- **State:** plans, mySubscription, loading, paymentStatus

### 3.27 SubscriptionApprovals (`/subscription-approvals`) — Roles: `super_admin`
- **Purpose:** Admin approval of subscriptions
- **UI:** Pending list, approve/reject, all subscriptions view
- **API:** `GET /subscriptions/admin/pending`, `GET /subscriptions/admin/all`, `POST /subscriptions/admin/approve/:id`, `POST /subscriptions/admin/reject/:id`

### 3.28 PaymentSuccess (`/payment/success`, `/subscription/success`)
- **Purpose:** Payment confirmation
- **API:** `POST /payment-check/verify/:reference`

### 3.29 PaymentFailed (`/payment/failed`, `/subscription/failed`)
- **Purpose:** Payment failure page

### 3.30 POS (`POS.jsx` — exists but not in main nav routes)
- **Purpose:** Point of Sale terminal
- **API:** `GET /pos/menu`, `GET /pos/tables`, `POST /pos/orders`, `POST /pos/orders/:id/pay`, `POST /pos/orders/:id/cancel`, `GET /pos/orders`, `GET /pos/dashboard`

### 3.31 Social (embedded in Events page)
- **Purpose:** Bar social media management (posts, comments, followers, notifications)

---

## 4. ALL API ENDPOINTS USED (FRONTEND → BACKEND)

### Auth (`authApi.js`)
| Method | Endpoint | Body/Params | Response | View | Auth |
|--------|----------|-------------|----------|------|------|
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` | Login | No |
| GET | `/auth/me` | — | `{ user }` | ProtectedRoute, Profile | Yes |
| GET | `/auth/me/permissions` | — | `{ permissions[] }` | ProtectedRoute | Yes |
| POST | `/auth/register-bar-owner` | FormData | `{ user, bar }` | Register | No |

### Bar (`barApi.js`)
| Method | Endpoint | Body/Params | Response | View | Auth |
|--------|----------|-------------|----------|------|------|
| GET | `/owner/bar/details` | — | bar object | BarManagement | Yes |
| PATCH | `/owner/bar/details` | `{ name, description, ... }` | bar | BarManagement | Yes |
| POST | `/owner/bar/image` | FormData | `{ image_url }` | BarManagement | Yes |
| POST | `/owner/bar/icon` | FormData | `{ icon_url }` | BarManagement | Yes |
| POST | `/owner/bar/gif` | FormData | `{ gif_url }` | BarManagement | Yes |
| POST | `/owner/bar/delete` | `{ bar_id }` | success | BarManagement | Yes |
| POST | `/owner/bar/toggle-status` | `{ bar_id, status }` | success | BarManagement | Yes |
| PATCH | `/owner/bar/settings` | settings object | success | BarManagement | Yes |
| GET | `/owner/bar/dashboard/summary` | — | stats | Dashboard | Yes |
| GET | `/owner/bar/customer-insights` | — | insights | Dashboard | Yes |
| GET | `/owner/bar/staff-performance` | — | performance | Dashboard | Yes |
| GET | `/owner/bar/followers` | — | followers[] | Events | Yes |
| GET | `/owner/bar/posts` | — | posts[] | Events | Yes |
| GET | `/owner/bar/comments` | `?type=&page=` | comments[] | Events | Yes |
| DELETE | `/owner/bar/posts/:postId` | — | success | Events | Yes |
| DELETE | `/owner/bar/comments/:type/:commentId` | — | success | Events | Yes |
| GET | `/owner/tax-config` | — | `{ tin, is_bir_registered, tax_type, tax_rate, tax_mode }` | BarManagement | Yes |
| PUT | `/owner/tax-config` | `{ tin, is_bir_registered, tax_type, tax_rate, tax_mode }` | success | BarManagement | Yes |

### Analytics (`analyticsApi.js`)
| Method | Endpoint | Response | View | Auth |
|--------|----------|----------|------|------|
| GET | `/analytics/dashboard` | metrics | Analytics | Yes |
| GET | `/analytics/visits` | trends | Analytics | Yes |
| GET | `/analytics/reviews` | trends | Analytics | Yes |
| GET | `/analytics/followers` | trends | Analytics | Yes |

### Attendance (`attendanceApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| POST | `/attendance/employee/attendance` | `{ action }` | Attendance | Yes |
| GET | `/attendance/my/attendance` | `?from=&to=` | Attendance | Yes |
| GET | `/attendance/hr/attendance` | `?from=&to=&user_id=` | Attendance | Yes |
| POST | `/attendance/hr/attendance` | record data | Attendance | Yes |
| PATCH | `/attendance/hr/attendance/:id` | updates | Attendance | Yes |
| GET | `/hr/attendance` | `?params` | Attendance | Yes |

### Audit (`auditApi.js`)
| Method | Endpoint | Params | View | Auth |
|--------|----------|--------|------|------|
| GET | `/hr/audit-logs` | `?from=&to=&action=&page=&limit=` | AuditLogs | Yes |

### Branches (`branchApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/branches/my` | — | Header, Branches | Yes |
| POST | `/branches/create` | branch data | Branches | Yes |
| POST | `/branches/switch` | `{ bar_id }` | Header | Yes |
| PATCH | `/branches/:id` | updates | Branches | Yes |
| GET | `/branches/subscription-info` | — | Branches | Yes |

### Customers (`customerApi.js`)
| Method | Endpoint | View | Auth |
|--------|----------|------|------|
| GET | `/owner/bar/customers` | Customers | Yes |
| POST | `/owner/bar/customers/:id/ban` | Customers | Yes |
| DELETE | `/owner/bar/customers/:id/ban` | Customers | Yes |

### Documents (`documentApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| POST | `/documents/upload` | FormData | Documents | Yes |
| GET | `/documents` | `?page=&limit=` | Documents | Yes |
| GET | `/documents/my` | — | Documents | Yes |
| GET | `/documents/:id/view` | — (blob) | Documents | Yes |
| POST | `/documents/:id/send` | `{ recipient_user_ids[] }` | Documents | Yes |
| GET | `/documents/:id/recipients` | — | Documents | Yes |
| GET | `/documents/received` | — | Documents | Yes |
| PATCH | `/documents/:id/mark-read` | — | Documents | Yes |

### DSS (`dssApi.js`)
| Method | Endpoint | View | Auth |
|--------|----------|------|------|
| GET | `/owner/dss/recommendations` | Dashboard | Yes |

### Events (`eventApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/owner/bar/events` | `?params` | Events | Yes |
| GET | `/owner/bar/events/:id/details` | — | Events | Yes |
| GET | `/owner/bar/events/archived` | — | Events | Yes |
| POST | `/owner/bar/events` | event data | Events | Yes |
| PATCH | `/owner/bar/events/:id` | updates | Events | Yes |
| DELETE | `/owner/bar/events/:id` | `?mode=cancel\|archive` | Events | Yes |
| POST | `/owner/bar/events/:id/image` | FormData | Events | Yes |
| GET | `/owner/bar/events/analytics` | — | Events | Yes |
| POST | `/owner/bar/comments/events/:id/replies` | `{ reply }` | Events | Yes |
| DELETE | `/owner/bar/comments/events/:id` | — | Events | Yes |

### Financials (`financialsApi.js`)
| Method | Endpoint | Params | View | Auth |
|--------|----------|--------|------|------|
| GET | `/owner/financials/auto-payout` | `?from=&to=` | Financials | Yes |
| GET | `/owner/financials/cashflow` | `?from=&to=` | Financials | Yes |
| GET | `/owner/financials/trends` | `?period=` | Financials | Yes |
| GET | `/owner/financials/payouts` | `?status=&from=&to=` | Financials | Yes |

### Inventory (`inventoryApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/owner/inventory` | — | Inventory | Yes |
| POST | `/owner/inventory` | item data | Inventory | Yes |
| PATCH | `/owner/inventory/:id` | updates | Inventory | Yes |
| POST | `/owner/inventory/:id/image` | FormData | Inventory | Yes |
| DELETE | `/owner/inventory/:id` | — | Inventory | Yes |
| POST | `/owner/sales` | sale data | Inventory | Yes |
| GET | `/owner/sales` | `?params` | Inventory | Yes |
| GET | `/owner/bar/sales/summary` | — | Inventory | Yes |

### Leaves (`leaveApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| POST | `/api/leaves` | `{ leave_type, start_date, end_date, reason }` | Leaves | Yes |
| GET | `/api/leaves/my` | — | Leaves | Yes |
| GET | `/api/leaves` | `?status=&from=&to=` | Leaves | Yes |
| PATCH | `/api/leaves/:id/decision` | `{ action }` | Leaves | Yes |

### Menu (`menuApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/owner/menu` | — | Menu | Yes |
| POST | `/owner/menu` | item data | Menu | Yes |
| PATCH | `/owner/menu/:id` | updates | Menu | Yes |
| DELETE | `/owner/menu/:id` | — | Menu | Yes |

### Customer Orders (`orderApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/customer-orders/bars/:barId/tax-config` | — | (Customer) | No |
| GET | `/customer-orders/bars/:barId/tax-preview` | `?subtotal=` | (Customer) | No |
| POST | `/customer-orders` | `{ bar_id, items[], notes }` | (Customer) | Yes |
| GET | `/customer-orders/my` | `?params` | (Customer) | Yes |
| GET | `/customer-orders/:orderId/receipt` | — | (Customer) | Yes |
| GET | `/customer-orders/reports/sales` | `?from=&to=` | Financials Tax | Yes |

### Payments (`paymentApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| POST | `/payments/create` | payment data | (Customer) | Yes |
| GET | `/payments/:reference` | — | PaymentSuccess | Yes |
| GET | `/payments/my/history` | `?params` | (Customer) | Yes |
| POST | `/payment-check/verify/:reference` | — | PaymentSuccess | Yes |
| POST | `/subscription-payments/subscribe` | plan data | Subscription | Yes |
| POST | `/subscription-payments/renew` | data | Subscription | Yes |
| GET | `/subscription-payments/status/:ref` | — | Subscription | Yes |
| GET | `/payouts/my` | `?params` | (Owner) | Yes |
| GET | `/payouts/my/summary` | — | (Owner) | Yes |
| GET | `/payouts/admin/all` | `?params` | SubApprovals | Yes |
| POST | `/payouts/admin/process/:id` | data | SubApprovals | Yes |
| POST | `/payouts/admin/bulk-process` | data | SubApprovals | Yes |

### Payroll (`payrollApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/hr/payroll/payroll` | `?period_start=&period_end=` | Payroll | Yes |
| POST | `/hr/payroll/run` | `{ period_start, period_end, name }` | Payroll | Yes |
| GET | `/hr/payroll/runs` | — | Payroll | Yes |
| POST | `/hr/payroll/runs/:runId/generate` | — | Payroll | Yes |
| GET | `/hr/payroll/runs/:runId/items` | — | Payroll | Yes |
| PATCH | `/hr/payroll/runs/:runId/finalize` | — | Payroll | Yes |
| DELETE | `/hr/payroll/runs/:runId` | — | Payroll | Yes |
| GET | `/hr/payroll/my-payroll` | — | Payroll | Yes |

### POS (`posApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/pos/menu` | — | POS | Yes |
| GET | `/pos/tables` | — | POS | Yes |
| POST | `/pos/orders` | order data | POS | Yes |
| POST | `/pos/orders/:id/pay` | payment data | POS, Financials | Yes |
| POST | `/pos/orders/:id/cancel` | — | POS, Financials | Yes |
| GET | `/pos/orders` | `?status=&from=&to=` | Financials | Yes |
| GET | `/pos/orders/:id` | — | Financials | Yes |
| GET | `/pos/dashboard` | — | POS | Yes |

### Promotions (`promotionApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/promotions` | — | Promotions | Yes |
| GET | `/promotions/:id` | — | Promotions | Yes |
| POST | `/promotions` | FormData | Promotions | Yes |
| PATCH | `/promotions/:id` | FormData | Promotions | Yes |
| POST | `/promotions/:id/toggle` | — | Promotions | Yes |
| DELETE | `/promotions/:id` | — | Promotions | Yes |

### Reservations (`reservationApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/owner/reservations` | `?status=&from=&to=` | Reservations | Yes |
| PATCH | `/owner/reservations/:id/status` | `{ action }` | Reservations | Yes |
| GET | `/reservations/lookup/:txn` | — | Reservations | Yes |

### Reviews (`reviewApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/owner-reviews` | — | Reviews | Yes |
| GET | `/owner-reviews/:id` | — | Reviews | Yes |
| POST | `/owner-reviews/:id/respond` | `{ response }` | Reviews | Yes |
| GET | `/owner-reviews/stats/summary` | — | Reviews | Yes |

### Social (`socialApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| POST | `/social/bar-posts` | FormData | Events | Yes |
| GET | `/social/notifications` | `?limit=` | Header | Yes |
| POST | `/social/notifications/read` | `{ notification_id }` or none | Header | Yes |
| GET | `/social/events/:id/comments` | — | Events | Yes |
| POST | `/social/events/:id/comments` | `{ comment }` | Events | Yes |

### Staff (`staffApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/owner/bar/users` | — | Staff | Yes |
| POST | `/owner/bar/users` | `{ name, email, password, role }` | Staff | Yes |
| PATCH | `/owner/bar/users/:id` | updates | Staff | Yes |
| POST | `/owner/bar/users/:id/toggle` | — | Staff | Yes |
| DELETE | `/owner/bar/users/:id` | — | Staff | Yes |
| GET | `/owner/bar/users/archived` | — | Staff | Yes |
| POST | `/owner/bar/users/:id/restore` | — | Staff | Yes |
| POST | `/owner/bar/users/:id/permanent-delete` | — | Staff | Yes |
| POST | `/owner/bar/users/:id/reset-password` | `{ new_password }` | Staff | Yes |
| GET | `/owner/rbac/roles` | — | Staff | Yes |
| GET | `/owner/rbac/permissions` | — | Staff | Yes |
| GET | `/owner/rbac/users/:id/permissions` | — | Staff | Yes |
| PATCH | `/owner/rbac/users/:id/role` | `{ role_id }` | Staff | Yes |
| PATCH | `/owner/rbac/users/:id/permissions` | `{ permission_ids[] }` | Staff | Yes |
| GET | `/hr/employees` | — | Staff | Yes |
| POST | `/hr/hr/employees` | employee data | Staff | Yes |
| PUT | `/hr/employees/:userId/profile` | profile data | Staff | Yes |
| DELETE | `/hr/employees/:id` | — | Staff | Yes |

### Subscriptions (`subscriptionApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/subscriptions/plans` | — | Subscription | Yes |
| GET | `/subscriptions/my` | — | Subscription | Yes |
| POST | `/subscriptions/subscribe` | `{ plan_id, ... }` | Subscription | Yes |
| POST | `/subscriptions/cancel` | — | Subscription | Yes |
| GET | `/subscriptions/admin/pending` | — | SubApprovals | Yes |
| GET | `/subscriptions/admin/all` | `?status=` | SubApprovals | Yes |
| POST | `/subscriptions/admin/approve/:id` | — | SubApprovals | Yes |
| POST | `/subscriptions/admin/reject/:id` | `{ reason }` | SubApprovals | Yes |

### Tables (`tableApi.js`)
| Method | Endpoint | Body/Params | View | Auth |
|--------|----------|-------------|------|------|
| GET | `/owner/bar/tables` | — | Tables | Yes |
| POST | `/owner/bar/tables` | `{ table_number, capacity, area, status }` | Tables | Yes |
| PATCH | `/owner/bar/tables/:id` | updates | Tables | Yes |
| POST | `/owner/bar/tables/:id/image` | FormData | Tables | Yes |
| GET | `/owner/bar/tables/status` | `?date=` | Tables | Yes |

### Misc
| Method | Endpoint | View | Auth |
|--------|----------|------|------|
| GET | `/auth/platform/announcements?limit=5` | Header | Yes |

---

## 5. ALL BACKEND ROUTES

### `/auth` (auth.js — 50KB)
- `POST /login` — Email+password login → JWT
- `POST /register-bar-owner` — Register owner + bar (multipart)
- `GET /me` — Current user (requireAuth)
- `GET /me/permissions` — Permissions array (requireAuth)
- `POST /google` — Google OAuth login
- `POST /forgot-password` — Send reset email
- `POST /reset-password` — Reset with token
- `POST /verify-email` — Verify email code
- `GET /platform/announcements` — Platform announcements

### `/owner` (owner.js — 96KB)
**Bar Details:** GET/PATCH `/bar/details`, POST `/bar/image|icon|gif`, POST `/bar/delete|toggle-status`, PATCH `/bar/settings`
**Dashboard:** GET `/bar/dashboard/summary`, GET `/bar/customer-insights|staff-performance`
**Tables:** CRUD `/bar/tables`, POST `/:id/image`, GET `/status`
**Events:** CRUD `/bar/events`, POST `/:id/image`, GET `/analytics`, GET `/archived`
**Staff:** CRUD `/bar/users`, toggle/archive/restore/permanent-delete/reset-password
**RBAC:** GET `/rbac/roles|permissions`, GET/PATCH `/rbac/users/:id/permissions|role`
**Customers:** GET `/bar/customers`, POST/DELETE `/:id/ban`
**Comments:** GET `/bar/comments`, DELETE `/:type/:id`, POST `/events/:id/replies`
**Reservations:** GET `/reservations`, PATCH `/:id/status`
**Social:** GET `/bar/followers|posts`
**Tax:** GET/PUT `/tax-config` (requireRole BAR_OWNER)
**Sales:** GET `/bar/sales/summary`

### `/hr` (hr.js + hrPermissions.js + hrAuditLogs.js)
- Employees CRUD, profile updates
- Permission management
- `GET /audit-logs`
- `GET /attendance` summary

### `/hr/payroll` (hrPayroll.js + deductionSettings.js)
- Payroll runs: create, generate, items, finalize, cancel
- `GET /my-payroll` — own payslips
- Deduction settings CRUD (SSS, PhilHealth, PagIBIG, tax brackets)
- **Business Logic:** Auto-calculates Philippine statutory deductions using bracket tables

### `/attendance` (attendance.js)
- `POST /employee/attendance` — clock in/out
- `GET /my/attendance`, `GET /hr/attendance` — records
- `POST /hr/attendance`, `PATCH /hr/attendance/:id` — HR management

### `/api/leaves` (leave.js)
- `POST /` — apply, `GET /my` — own, `GET /` — all (HR)
- `PATCH /:id/decision` — approve/reject

### `/documents` (hrDocuments.js)
- Upload (multipart), list, view (blob), send, recipients, received, mark-read

### `/pos` (pos.js — 25KB)
- Menu, tables, orders CRUD, pay, cancel, dashboard
- **Business Logic:** Stock deduction on order pay, table status updates

### `/customer-orders` (customerOrders.js — 20KB)
- `GET /bars/:barId/tax-config` — public
- `GET /bars/:barId/tax-preview` — public
- `POST /` — create order (requireAuth) — validates items/stock, computeTax, generateORNumber
- `GET /my`, `GET /:id/receipt`
- `GET /reports/sales` — owner sales + tax report
- **Business Logic:** `computeTax(subtotal, bar)` handles VAT/NON_VAT × EXCLUSIVE/INCLUSIVE. `generateORNumber()` atomic sequence via `or_number_sequences` table.

### `/owner/financials` (financials.js — 13KB)
- Auto-payout computation, cashflow breakdown, trends, payouts list
- **Business Logic:** Platform fee deduction (PLATFORM_FEE_PERCENTAGE from settings)

### `/analytics` (analytics.js)
- Dashboard metrics, visits, reviews, followers analytics

### `/promotions` (promotions.js)
- CRUD with multipart image, toggle active

### `/owner-reviews` (ownerReviews.js)
- List, detail, respond, stats summary

### `/branches` (branches.js)
- My branches, create, switch, update, subscription-info
- **Business Logic:** Branch limit by subscription tier

### `/social` (social.js — 67KB)
- Follows, likes, comments (events + posts), bar posts, notifications

### `/subscriptions` (subscriptions.js)
- Plans, subscribe, cancel, admin approve/reject

### `/payments` (payments.js — 30KB)
- PayMongo payment link creation, history, processing

### `/payouts` (payouts.js)
- Owner payouts, summary, admin management

### `/webhook/paymongo` (paymongoWebhook.js)
- PayMongo webhook handler (raw body, signature verification)

### `/payment-check` (paymentCheck.js)
- Payment verification and auto-activation

### `/super-admin` (superAdmin.js — 129KB)
- Full platform admin: users, bars, subscriptions, settings, maintenance mode, announcements

---

## 6. DATABASE TABLES

### Core Tables

**`users`** — id, email, password (bcrypt), first_name, last_name, role, role_id→roles, bar_id→bars, is_active, profile_image, phone, google_id, email_verified, created_at, updated_at

**`bars`** — id, owner_id→bar_owners, name, description, address, city, province, phone, email, latitude, longitude, image_url, icon_url, gif_url, status (active/inactive), is_locked, operating_hours (JSON), auto_approve_reservations, max_guests_per_reservation, advance_booking_days, cancellation_hours, time_slot_interval, guest_increment, accept_gcash, accept_online_payment, tin, is_bir_registered, tax_type (VAT/NON_VAT), tax_rate, tax_mode (EXCLUSIVE/INCLUSIVE), created_at, updated_at

**`bar_owners`** — id, user_id→users

### RBAC Tables
**`roles`** — id, name (BAR_OWNER, STAFF, HR, MANAGER, CASHIER, SUPER_ADMIN)
**`permissions`** — id, name (bar_details_view, staff_create, etc.), description
**`role_permissions`** — role_id→roles, permission_id→permissions
**`user_permissions`** — user_id→users, permission_id→permissions, granted (boolean)

### Operations Tables
**`tables`** — id, bar_id→bars, table_number, capacity, area, status, image_url
**`reservations`** — id, bar_id→bars, user_id→users, table_id→tables, reservation_date, time_slot, guest_count, status (pending/approved/rejected/cancelled/completed), payment_status, transaction_number, notes, created_at
**`menu_items`** — id, bar_id→bars, menu_name, selling_price, category, description, inventory_item_id→inventory_items, is_available
**`inventory_items`** — id, bar_id→bars, name, category, stock_qty, unit, cost_price, reorder_level, image_url, is_active
**`events`** — id, bar_id→bars, title, description, event_date, start_time, end_time, location, image_url, status, max_attendees, created_at
**`promotions`** — id, bar_id→bars, title, description, discount_type, discount_value, start_date, end_date, image_url, is_active

### POS & Orders Tables
**`pos_orders`** — id, bar_id→bars, table_id→tables, staff_user_id→users, customer_user_id→users, order_number, order_source (pos/web), status, subtotal, discount_amount, total_amount, tax_amount, tax_type_snapshot, tax_rate_snapshot, or_number, payment_status, payment_method, notes, created_at
**`pos_order_items`** — id, order_id→pos_orders, menu_item_id→menu_items, inventory_item_id→inventory_items, item_name, unit_price, quantity, subtotal
**`or_number_sequences`** — id, bar_id→bars, current_sequence (INT), year (INT), updated_at — Atomic OR number generation

### HR Tables
**`attendance_records`** — id, user_id→users, bar_id→bars, clock_in, clock_out, date, status, created_by
**`leaves`** — id, user_id→users, leave_type, start_date, end_date, reason, status (pending/approved/rejected), decided_by, decided_at
**`payroll_runs`** — id, bar_id→bars, name, period_start, period_end, status (draft/finalized), created_by, created_at
**`payroll_items`** — id, run_id→payroll_runs, user_id→users, basic_pay, overtime_pay, deductions (JSON), net_pay, gross_pay
**`deduction_settings`** — id, bar_id→bars, type (sss/philhealth/pagibig/tax), brackets (JSON)
**`documents`** — id, bar_id→bars, uploaded_by→users, filename, original_name, file_type, created_at
**`document_recipients`** — id, document_id→documents, user_id→users, is_read, read_at

### Social & Customer Tables
**`reviews`** — id, bar_id→bars, user_id→users, rating, comment, owner_response, created_at
**`bar_followers`** — id, bar_id→bars, user_id→users
**`bar_posts`** — id, bar_id→bars, content, image_url, created_at
**`event_comments`** — id, event_id→events, user_id→users, comment, created_at
**`post_comments`** — id, post_id→bar_posts, user_id→users, comment, created_at
**`event_likes`** — id, event_id→events, user_id→users
**`notifications`** — id, user_id→users, type, title, message, reference_id, reference_type, is_read, created_at
**`customer_bar_bans`** — id, bar_id→bars, customer_id→users

### Payment & Subscription Tables
**`payments`** — id, user_id→users, bar_id→bars, reference, amount, payment_method, status, paymongo_link_id, created_at
**`payouts`** — id, bar_id→bars, amount, status, period_start, period_end, processed_at
**`subscription_plans`** — id, name, price, branch_limit, features (JSON)
**`bar_subscriptions`** — id, bar_id→bars, plan_id→subscription_plans, status, start_date, end_date, payment_reference

### Platform Tables
**`platform_settings`** — id, maintenance_mode, maintenance_message, platform_fee_percentage, paymongo keys
**`platform_announcements`** — id, title, message, is_active, created_at
**`audit_logs`** — id, bar_id, user_id, action, entity, entity_id, details (JSON), ip_address, user_agent, created_at

---

## 7. STATE MANAGEMENT

### Auth Store (`authStore.js` — Zustand)
```
user, permissions[], token, isAuthenticated, isLoading, hasInitialized, error
Actions: login(), fetchUser(), fetchPermissions(), initialize(), logout(), hasPermission()
```
- Token stored in `localStorage.token`
- `initialize()` called on app mount — fetches user + permissions with 5s timeout
- `hasPermission()` — bar_owner bypasses all checks; others require at least one match
- 401 response → clear token → redirect `/login`

### Branch Store (`branchStore.js` — Zustand)
```
branches[], selectedBarId, selectedBranch, subscriptionInfo, loading
Actions: fetchBranches(), switchBranch(), setSelectedBarId(), fetchSubscriptionInfo(), reset()
```
- `selectedBarId` stored in `localStorage.selectedBarId`
- Auto-selects first branch if none stored
- Switch triggers page reload

### Local/Session Storage
- `localStorage.token` — JWT token
- `localStorage.selectedBarId` — Active branch ID
- No sessionStorage usage

### Request Scoping
- `apiClient` request interceptor injects `Authorization: Bearer <token>` and `X-Bar-Id: <selectedBarId>` on every request
- Backend `requireAuth` validates X-Bar-Id ownership for bar_owner role

---

## 8. SECURITY & PERMISSIONS

### Auth Flow
1. User submits email+password → `POST /auth/login`
2. Backend verifies bcrypt hash → generates JWT with `{ id }` payload using `JWT_SECRET`
3. Frontend stores token in `localStorage.token`
4. Every API request includes `Authorization: Bearer <token>` header
5. Backend `requireAuth` middleware: decodes JWT → fetches user from DB → checks `is_active` → checks maintenance mode → attaches `req.user`
6. On 401 → frontend clears token → redirects to `/login`
7. Google OAuth available as alternative login

### Role-Based Access Control
**Roles:** `super_admin`, `bar_owner`, `hr`, `manager`, `staff`, `cashier`, `customer`

**Middleware Chain:**
1. `requireAuth` — JWT + user lookup + active check + maintenance mode
2. `requireRole([roles])` — Simple role string check (case-insensitive)
3. `requirePermission(codes)` — DB-driven RBAC:
   - `SUPER_ADMIN` → **always bypass**
   - `BAR_OWNER` → **always bypass** (has all permissions by design)
   - Others → check `user_permissions` first (per-user overrides); if no overrides exist, fall back to `role_permissions`
   - OR logic: any matching permission grants access

### Permission Codes (33 permissions)
```
bar_details_view, bar_details_update,
staff_view, staff_create, staff_update, staff_delete, staff_deactivate, staff_reset_password, staff_edit_permissions,
attendance_view_own, attendance_view_all, attendance_create,
leave_apply, leave_view_own, leave_view_all, leave_approve,
payroll_view_own, payroll_view_all, payroll_create,
documents_view_own, documents_view_all, documents_send, documents_manage,
menu_view, menu_create, menu_update, menu_delete,
reservation_view, reservation_manage, reservation_create,
events_view, events_create, events_update, events_delete, events_comment_manage, events_comment_reply,
table_view, table_update,
financials_view,
analytics_bar_view,
reviews_view, reviews_reply,
ban_view, ban_branch, ban_lift,
logs_view
```

### Route Guards (Frontend)
- `ProtectedRoute` component wraps authenticated routes
- Checks `isAuthenticated` + `hasPermission(permissions[])`
- If not authenticated → redirect `/login`
- If no permission → show "Access Denied" screen
- `bar_owner` role bypasses all permission checks in `hasPermission()`

### Multi-Branch Scoping
- `X-Bar-Id` header sent on every request for bar_owner users
- Backend `requireAuth` verifies ownership: checks `bar_owners` table → confirms `bars.owner_id` match + `is_locked = 0`
- Non-owner roles always use their assigned `bar_id`

### Rate Limiting
- Auth endpoints (login, register): 20 requests / 15 minutes
- Session checks (/me, /refresh): 120 requests / 1 minute
- Global API: 200 requests / 1 minute

### Input Security
- `sanitize.js` middleware: strips null bytes, trims strings, enforces length limits
- `sanitizePath.js`: prevents path traversal in file routes
- `helmet`: security headers (CSP disabled for frontend management)
- PayMongo webhook: raw body parsing for signature verification (mounted before `express.json()`)

---

## 9. DESIGN SYSTEM

### Color Palette
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0A0A0A` | Page background (near-black) |
| Surface/Cards | `#111111` | Card backgrounds |
| Surface Hover | `#161616` | Input fields, hover states, dropdowns |
| Primary Accent | `#CC0000` | Buttons, highlights, active nav, badges, logo accent |
| Primary Hover | `#991500` | Button hover state |
| Primary Glow | `rgba(204,0,0,0.25)` | Button box-shadow |
| Text Primary | `#FFFFFF` | Headings, primary text |
| Text Secondary | `#CCCCCC` | Body text, table cells |
| Text Muted | `#888888` | Labels, descriptions |
| Text Dim | `#666666` | Timestamps, secondary labels |
| Text Faint | `#555555` | Placeholders, inactive items |
| Border Default | `rgba(255,255,255,0.06)` | Card borders, dividers |
| Border Subtle | `rgba(255,255,255,0.08)` | Input borders |
| Border Focus | `rgba(204,0,0,0.5)` | Input focus border |
| Success | `#4ade80` / bg `rgba(34,197,94,0.12)` | Active, approved, paid |
| Warning | `#fbbf24` / bg `rgba(245,158,11,0.12)` | Pending, low stock warning |
| Danger | `#ff6666` / bg `rgba(204,0,0,0.12)` | Critical, banned, failed |
| Info | `#60a5fa` / bg `rgba(59,130,246,0.12)` | Insights, information |
| Purple | `#c084fc` / bg `rgba(168,85,247,0.12)` | Orders, special metrics |

### CSS Component Classes

**Buttons:**
- `.btn-primary` — Red filled (`#CC0000`), white text, red glow shadow, hover `#991500`
- `.btn-secondary` — Dark glass (`rgba(255,255,255,0.05)`), subtle border, gray text → white on hover
- `.btn-danger` — Dark red (`#991500`), red border, hover `#CC0000`

**Cards:**
- `.card` — `background: #111111`, `border: 1px solid rgba(255,255,255,0.06)`, `rounded-xl`, `p-6`

**Inputs:**
- `.input-field` — `background: #161616`, subtle border, focus: red border + red glow ring
- `.label` — Uppercase, `text-xs`, `font-semibold`, `tracking-wider`, `color: #666666`

**Badges:**
- `.badge-success` — Green tint bg, green text, green border
- `.badge-warning` — Amber tint bg, amber text, amber border
- `.badge-danger` — Red tint bg, red text, red border
- `.badge-info` — Blue tint bg, blue text, blue border
- `.badge-gray` — Dark glass bg, gray text
- `.badge-purple` — Purple tint bg, purple text

**Tables:**
- `.table-header` — `background: #161616`, uppercase, `text-xs`, `tracking-wider`, `color: #666666`
- `.table-cell` — `color: #cccccc`, `text-sm`
- `.table-row-hover:hover` — `background: rgba(204,0,0,0.04)` (subtle red tint)

### Typography
- Font: System sans-serif (Tailwind default), antialiased
- Headings: `font-bold`, white
- Body: `text-sm`, `#cccccc`
- Labels: `text-xs`, `font-semibold`, `uppercase`, `tracking-wider`, `#666666`
- Stat values: `text-2xl`, `font-extrabold`, white

### Layout
- Sidebar: Fixed left, 260px expanded / 68px collapsed, `#111111` background
- Header: Sticky top, 64px height, `#111111` background
- Main content: `p-6` padding, flexible width with sidebar margin transition
- Grid: Tailwind responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)

### Animations
- `slideDown` — dropdown reveal (opacity + translateY + max-height)
- `fadeIn` — simple opacity fade
- `redGlowPulse` — CTA button pulsing red glow
- `floatCard` — landing page floating card
- `marquee` — scrolling marquee
- `roleCardEnter` — scale + opacity card entrance
- `heroFadeUp` — hero section stagger fade-in

### Scrollbar
- 6px width, transparent track, `rgba(255,255,255,0.12)` thumb, hover `rgba(255,255,255,0.22)`

---

## 10. BUSINESS RULES & CONVENTIONS

### Naming Conventions
- **Files:** camelCase for JS/JSX (e.g., `barApi.js`, `BarManagement.jsx`)
- **API response:** `{ success: boolean, data?: any, message?: string }` — frontend unwraps via `data.data || data`
- **Routes:** kebab-case paths (`/bar-management`, `/audit-logs`)
- **Permissions:** snake_case (`bar_details_view`, `staff_create`)
- **Roles:** snake_case (`bar_owner`, `super_admin`)

### Date/Time Handling
- **Timezone:** Asia/Manila (UTC+8) everywhere
- **Backend:** `process.env.TZ = 'Asia/Manila'`, MySQL pool `timezone: '+08:00'`
- **Frontend:** `parseUTC()` utility appends 'Z' to MySQL datetime strings for correct UTC interpretation
- **Display:** `date-fns` `formatDistanceToNow` for relative times, `toLocaleTimeString()` for absolute

### Currency Formatting
- **Currency:** Philippine Peso (₱)
- **Format:** `₱${Number(value).toLocaleString()}` or `₱${value.toFixed(2)}`
- **Precision:** 2 decimal places for all monetary values
- **Tax computation:** Server-side `parseFloat(x.toFixed(2))` for consistent rounding

### Tax System
- **Tax Types:** `VAT` (12% default) or `NON_VAT` (0%)
- **Tax Modes:** `EXCLUSIVE` (tax added on top of subtotal) or `INCLUSIVE` (tax embedded in price)
- **Computation:**
  - EXCLUSIVE: `tax = subtotal * (rate/100)`, `total = subtotal + tax`
  - INCLUSIVE: `tax = subtotal - subtotal / (1 + rate/100)`, `net = subtotal - tax`, `total = subtotal`
  - NON_VAT: `tax = 0`, `total = subtotal`
- **Snapshot:** Tax type/rate copied into order at creation time (never retroactively changed)
- **OR Numbers:** Atomic sequential generation per bar per year via `or_number_sequences` table

### Reservation Rules
- Configurable per bar: auto_approve, max_guests, advance_booking_days, cancellation_hours, time_slot_interval, guest_increment
- Status flow: `pending` → `approved` / `rejected`; `approved` → `cancelled` / `completed`
- Payment integration with PayMongo (GCash, cards)

### Inventory Rules
- Each menu item links to exactly one inventory item
- Stock deducted on POS order payment / customer order creation
- Low stock alert: `stock_qty ≤ reorder_level`
- DSS generates recommendations based on stock levels

### Payroll Rules
- Philippine statutory deductions: SSS, PhilHealth, PagIBIG, withholding tax
- Deduction brackets configurable per bar
- Run lifecycle: `draft` → `finalized` (irreversible)
- Payroll items auto-generated from attendance records

### Error Handling
- Backend: `try/catch` with `{ success: false, message }` responses
- Frontend: Axios response interceptor — 401 → redirect, 403 → toast (unless `silentError`), others → toast error message
- `silentError` flag on Axios config suppresses toast for expected failures (e.g., missing permissions, optional data)

### Image/File Handling
- Backend: Multer stores files in `uploads/` directory
- Frontend: `getUploadUrl(path)` prepends API base URL to relative paths
- Accepted: JPEG, PNG, GIF (images), PDF (documents)
- Max size: 5MB (`MAX_FILE_SIZE=5242880`)
- Default avatar served for missing profile images (`uploadFallback` middleware)

### Platform Fees
- Configurable `PLATFORM_FEE_PERCENTAGE` (default 5%)
- Applied to customer payments for reservations/orders
- Auto-payout calculates: `net = gross - (gross * fee_percentage / 100)`

### Notifications
- Stored in `notifications` table with `reference_id` + `reference_type` (never `related_id`)
- Fetched every 30 seconds in Header component
- Types: order_placed, reservation_confirmed, event_reminder, etc.
- Platform announcements shown separately above user notifications

---

# FLUTTER/DART IMPLEMENTATION PROMPT — The Party Goers Manager App

## IDENTITY

You are a senior Flutter/Dart developer. Your task is to implement the **The Party Goers Manager App** — a mobile application that replicates 100% of the functionality documented above in the Manager Website. Use the exact same backend API at `http://localhost:3000`. Every screen, every API call, every business rule described in the context document above must be faithfully implemented.

---

## DESIGN SYSTEM (HARD REQUIREMENT — DO NOT CHANGE)

### Theme Colors
```dart
static const Color background = Color(0xFF0A0A0A);
static const Color surface = Color(0xFF111111);
static const Color surfaceHover = Color(0xFF161616);
static const Color primary = Color(0xFFCC0000);
static const Color primaryHover = Color(0xFF991500);
static const Color textPrimary = Color(0xFFFFFFFF);
static const Color textSecondary = Color(0xFFCCCCCC);
static const Color textMuted = Color(0xFF888888);
static const Color textDim = Color(0xFF666666);
static const Color textFaint = Color(0xFF555555);
static const Color borderDefault = Color(0x0FFFFFFF); // rgba(255,255,255,0.06)
static const Color borderSubtle = Color(0x14FFFFFF); // rgba(255,255,255,0.08)
static const Color success = Color(0xFF4ADE80);
static const Color successBg = Color(0x1F22C55E); // rgba(34,197,94,0.12)
static const Color warning = Color(0xFFFBBF24);
static const Color warningBg = Color(0x1FF59E0B); // rgba(245,158,11,0.12)
static const Color danger = Color(0xFFFF6666);
static const Color dangerBg = Color(0x1FCC0000); // rgba(204,0,0,0.12)
static const Color info = Color(0xFF60A5FA);
static const Color infoBg = Color(0x1F3B82F6); // rgba(59,130,246,0.12)
static const Color purple = Color(0xFFC084FC);
static const Color purpleBg = Color(0x1FA855F7); // rgba(168,85,247,0.12)
```

### Rules
- **NO white or light backgrounds anywhere** — entire app is dark themed
- **Logo:** "THE PARTY" white bold + "GOERS" red bold (split color)
- **Section Labels:** Small uppercase red tracking-wide labels above white+red title combos
- **Buttons:** Red filled (primary CTA), dark outlined ghost (secondary), dark glass (tertiary)
- **Badges/Chips:** Red=danger, Green=active/approved, Amber=pending/warning, Gray=neutral
- **Status Colors:** paid=green, pending=amber, cancelled=dim gray, failed=red, approved=green

---

## REUSABLE WIDGETS TO BUILD

### `GlassCard`
Dark translucent card with `color: Color(0xFF111111)`, `border: Border.all(color: Color(0x0FFFFFFF))`, `borderRadius: 16`. Optional `BackdropFilter` blur for overlays.

### `RedButton`
Filled red CTA: `backgroundColor: Color(0xFFCC0000)`, white text, `borderRadius: 12`, optional loading spinner. Hover/press: `Color(0xFF991500)`. Box shadow: `BoxShadow(color: Color(0x40CC0000), blurRadius: 16)`.

### `GhostButton`
Outlined dark button: `border: Border.all(color: Color(0x14FFFFFF))`, `backgroundColor: Color(0x0DFFFFFF)`, gray text. Optional leading icon.

### `GlassInput` / `GlassDropdown` / `GlassTextArea`
Dark translucent form controls: `fillColor: Color(0xFF161616)`, `border: Color(0x14FFFFFF)`, focus border `Color(0x80CC0000)`, placeholder `Color(0xFF555555)`, text `Color(0xFFFFFFFF)`.

### `BadgeChip`
Rounded status chip with tinted background + matching text color + subtle border. Variants: success, warning, danger, info, gray, purple.

### `StatCard`
Large bold number (`fontSize: 24, fontWeight: bold, white`) + small uppercase label (`fontSize: 12, color: #888`) on dark card. Optional icon with colored background circle.

### `SectionHeader`
Red small-caps label (`fontSize: 10, color: #CC0000, letterSpacing: 1.5, uppercase`) + bold white title below.

### `StatusTag`
Reservation/payment/inventory status with correct color mapping:
- `active|approved|paid|completed|finalized` → green
- `pending|draft` → amber
- `rejected|failed|cancelled|critical` → red
- `inactive|archived` → gray

### `ShimmerPlaceholder`
Loading skeleton with dark base `Color(0xFF1A1A1A)` and highlight `Color(0xFF222222)`.

### `EmptyState`
Centered column: icon (large, muted), title (white), message (muted), optional action button.

### `ErrorCard`
Dark card with red-tinted icon, error title, message, retry button.

---

## NAVIGATION

### Bottom Navigation Bar (Mobile)
5 tabs: **Dashboard**, **Operations** (bar, menu, inventory, tables, reservations), **People** (staff, attendance, leaves, payroll), **Insights** (analytics, financials, audit), **More** (events, customers, reviews, promotions, settings, branches, subscription)

### AppBar
Dark `Color(0xFF111111)`: logo left, page title center, notification bell (with unread badge count) + user avatar right.

### Drawer / Sub-navigation
For grouped sections (Operations, People, Insights, More) — use either nested navigation or a sub-menu list inside each tab matching the web sidebar groups.

### Branch Switcher
If user has multiple branches → show branch picker in AppBar (dropdown or bottom sheet). Store `selectedBarId` in secure storage. On switch → reload all data.

---

## ALL SCREENS

Build every screen listed in Section 3 of the context document. For each screen implement:

### Login Screen
- Email + password fields (GlassInput)
- RedButton "Login"
- API: `POST /auth/login` → store JWT in flutter_secure_storage
- Error handling: show inline error message
- On success: fetch permissions → navigate to Dashboard

### Register Screen
- Multi-step form (4 steps matching web)
- Step 1: Personal info, Step 2: Bar info, Step 3: Media (image_picker), Step 4: Operating hours + map
- API: `POST /auth/register-bar-owner` (multipart via Dio)
- Map: use `flutter_map` or `google_maps_flutter` with dark theme

### Dashboard Screen
- Welcome banner (gradient red container)
- Stats grid: 4 StatCards (reservations, revenue ₱, orders, events)
- Low Stock Alerts list
- Top Menu Items list
- Smart Suggestions (DSS) panel with severity-colored cards
- Recent Staff Activity list
- Pull-to-refresh on entire screen
- API: `GET /owner/bar/dashboard/summary`, `GET /owner/dss/recommendations`

### Bar Management Screen
- Tabbed or scrollable sections: Info, Media, Hours, Reservation Settings, Tax Config
- All fields editable with save buttons per section
- Image upload via image_picker + Dio multipart
- Tax config: BIR toggle, TIN field, tax type dropdown, rate input, mode dropdown, live preview
- Map picker: show current location, tap to change, dark map theme
- API: all barApi endpoints

### Inventory Screen
- List/grid of inventory items with stock indicators
- FAB for add new
- Edit modal/bottom sheet
- Image upload
- Low stock highlighted in warning color
- API: all inventoryApi endpoints

### Menu Screen
- Grid/list of menu items with price, category, availability toggle
- CRUD via bottom sheets
- Link to inventory item picker
- API: all menuApi endpoints

### Tables Screen
- Visual grid of table cards (number, capacity, area, status)
- CRUD via bottom sheet
- Image upload
- Calendar view for table status by date
- API: all tableApi endpoints

### Reservations Screen
- Filter chips (status), date range picker
- List with status badges, guest count, date/time
- Tap for detail → approve/reject/cancel actions
- Transaction lookup search
- API: all reservationApi endpoints

### Events Screen
- Two tabs: Events, Social Posts
- Events: list with image, date, status, attendees
- CRUD via form screens
- Image upload, comment management
- Analytics section
- Social Posts: post creation (text + optional image), post list, comment management
- API: all eventApi + barApi social endpoints

### Staff Screen
- Staff list with role badges, active status
- CRUD form (name, email, password, role dropdown)
- RBAC permission editor (checkbox grid)
- Archived staff tab
- Password reset action
- API: all staffApi endpoints

### Attendance Screen
- Two tabs: My Attendance, HR View
- Clock in/out buttons (large, prominent)
- Date filter
- Attendance records list with times
- HR: manual entry form, edit records
- API: all attendanceApi endpoints

### Leaves Screen
- Two tabs: My Leaves, All Leaves
- Apply form (type, dates, reason)
- Leave list with status badges
- Approve/reject actions for HR
- API: all leaveApi endpoints

### Payroll Screen
- Three tabs: My Payroll, Payroll Runs, Preview
- My: payslip list with period, gross, deductions, net
- Runs: create run form, run list, tap for detail
- Run detail: employee items table, generate/finalize actions
- Preview: period picker, preview calculation
- API: all payrollApi endpoints

### Deduction Settings Screen
- Tabs: SSS, PhilHealth, PagIBIG, Tax
- Bracket tables with add/edit/delete
- API: deduction endpoints

### Documents Screen
- Upload button (file_picker)
- Three tabs: All Documents, My Documents, Received
- Send to staff (multi-select picker)
- View document (open in viewer/browser)
- Read tracking indicators
- API: all documentApi endpoints

### Customers Screen
- Customer list with search
- Ban/unban actions with confirmation dialog
- API: all customerApi endpoints

### Reviews Screen
- Stats summary cards (average rating, total, distribution)
- Review list with star ratings
- Detail with response form
- API: all reviewApi endpoints

### Promotions Screen
- Promotion cards with image, discount, dates, active badge
- CRUD with image upload
- Toggle active/inactive
- API: all promotionApi endpoints

### Analytics Screen
- Dashboard metrics cards
- Charts: visits trend (line), reviews trend, followers trend
- Use `fl_chart` or `syncfusion_flutter_charts`
- API: all analyticsApi endpoints

### Financials Screen
- 5 tabs matching web: Auto Payout, Cashflow, POS Orders, Payouts, Tax Report
- Each tab: date filters, stat cards, data tables/lists, charts
- Tax Report: summary cards, breakdown, daily table, stacked bar chart
- API: all financialsApi + posApi + orderApi endpoints

### Audit Logs Screen
- Filter bar (date, action type)
- Paginated logs list with expandable details
- API: auditApi.list

### Profile Screen
- User info card (avatar, name, email, role)
- Edit form
- API: `GET /auth/me`

### Settings Screen
- Password change form
- Notification preferences
- App version info

### Branches Screen
- Branch cards (name, city, active indicator)
- Create branch form
- Switch branch action
- Subscription limits display
- API: all branchApi endpoints

### Subscription Screen
- Current plan display
- Plan comparison cards
- Subscribe/renew via PayMongo (url_launcher for payment link)
- Payment status tracking
- API: all subscriptionApi + paymentApi endpoints

### Payment Success / Failed Screens
- Confirmation/error display
- Verify payment API call
- Navigate back button

---

## AUTH FLOW

```dart
// 1. JWT stored in flutter_secure_storage
final storage = FlutterSecureStorage();
await storage.write(key: 'token', value: token);
await storage.write(key: 'selectedBarId', value: barId);

// 2. Dio interceptor
dio.interceptors.add(InterceptorsWrapper(
  onRequest: (options, handler) async {
    final token = await storage.read(key: 'token');
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    final barId = await storage.read(key: 'selectedBarId');
    if (barId != null) options.headers['X-Bar-Id'] = barId;
    handler.next(options);
  },
  onError: (error, handler) async {
    if (error.response?.statusCode == 401) {
      await storage.deleteAll();
      // Navigate to login
    }
    handler.next(error);
  },
));

// 3. Role check on login
if (!['bar_owner', 'manager', 'hr', 'staff', 'cashier'].contains(user.role)) {
  // Show "Access Denied — This app is for bar management only"
}

// 4. Maintenance mode
// Check response for code: 'MAINTENANCE_MODE' (503) → show full-screen overlay
```

---

## RECOMMENDED PACKAGES

```yaml
dependencies:
  # Core
  flutter:
    sdk: flutter
  dio: ^5.4.0
  flutter_secure_storage: ^9.0.0
  shared_preferences: ^2.2.2
  provider: ^6.1.2
  go_router: ^13.2.0

  # UI
  cached_network_image: ^3.3.1
  shimmer: ^3.0.0
  lottie: ^3.1.0
  flutter_svg: ^2.0.10+1
  lucide_icons: ^0.257.0

  # Utilities
  intl: ^0.19.0
  url_launcher: ^6.2.5
  image_picker: ^1.1.2
  file_picker: ^8.0.0

  # Charts
  fl_chart: ^0.68.0

  # Maps
  flutter_map: ^6.1.0
  latlong2: ^0.9.0

  # Date
  table_calendar: ^3.1.1

  # PDF (for payroll/receipts)
  pdf: ^3.10.8
  printing: ^5.12.0
  open_file: ^3.3.2

  # Pull to refresh
  pull_to_refresh: ^2.0.0

  # Permissions (camera for uploads)
  permission_handler: ^11.3.0
```

---

## FOLDER STRUCTURE

```
lib/
├── main.dart                    — MaterialApp, theme, GoRouter, Provider setup
├── core/
│   ├── theme.dart               — AppTheme with all colors, text styles, component themes
│   ├── constants.dart           — API base URL, storage keys, enums
│   ├── router.dart              — GoRouter with auth redirect, all routes
│   └── extensions.dart          — String, DateTime, num extensions
├── data/
│   ├── api/
│   │   ├── api_client.dart      — Dio instance with auth interceptor, error handling
│   │   ├── auth_api.dart        — login, getMe, getPermissions, register
│   │   ├── bar_api.dart         — bar details, settings, media, tax config
│   │   ├── analytics_api.dart
│   │   ├── attendance_api.dart
│   │   ├── audit_api.dart
│   │   ├── branch_api.dart
│   │   ├── customer_api.dart
│   │   ├── document_api.dart
│   │   ├── dss_api.dart
│   │   ├── event_api.dart
│   │   ├── financials_api.dart
│   │   ├── inventory_api.dart
│   │   ├── leave_api.dart
│   │   ├── menu_api.dart
│   │   ├── order_api.dart
│   │   ├── payment_api.dart
│   │   ├── payroll_api.dart
│   │   ├── pos_api.dart
│   │   ├── promotion_api.dart
│   │   ├── reservation_api.dart
│   │   ├── review_api.dart
│   │   ├── social_api.dart
│   │   ├── staff_api.dart
│   │   ├── subscription_api.dart
│   │   └── table_api.dart
│   └── models/
│       ├── user.dart
│       ├── bar.dart
│       ├── menu_item.dart
│       ├── inventory_item.dart
│       ├── table.dart
│       ├── reservation.dart
│       ├── event.dart
│       ├── staff.dart
│       ├── attendance.dart
│       ├── leave.dart
│       ├── payroll_run.dart
│       ├── payroll_item.dart
│       ├── document.dart
│       ├── customer.dart
│       ├── review.dart
│       ├── promotion.dart
│       ├── pos_order.dart
│       ├── notification_item.dart
│       ├── branch.dart
│       ├── subscription.dart
│       ├── payout.dart
│       ├── audit_log.dart
│       └── dss_recommendation.dart
├── providers/
│   ├── auth_provider.dart       — user, permissions, token, login/logout/init/hasPermission
│   ├── branch_provider.dart     — branches, selectedBarId, switch
│   └── notification_provider.dart — notifications, unreadCount, polling
├── screens/
│   ├── login_screen.dart
│   ├── register_screen.dart
│   ├── dashboard_screen.dart
│   ├── bar_management_screen.dart
│   ├── inventory_screen.dart
│   ├── menu_screen.dart
│   ├── tables_screen.dart
│   ├── reservations_screen.dart
│   ├── events_screen.dart
│   ├── staff_screen.dart
│   ├── attendance_screen.dart
│   ├── leaves_screen.dart
│   ├── payroll_screen.dart
│   ├── deduction_settings_screen.dart
│   ├── documents_screen.dart
│   ├── customers_screen.dart
│   ├── reviews_screen.dart
│   ├── promotions_screen.dart
│   ├── analytics_screen.dart
│   ├── financials_screen.dart
│   ├── audit_logs_screen.dart
│   ├── profile_screen.dart
│   ├── settings_screen.dart
│   ├── branches_screen.dart
│   ├── subscription_screen.dart
│   ├── payment_success_screen.dart
│   └── payment_failed_screen.dart
├── widgets/
│   ├── glass_card.dart
│   ├── red_button.dart
│   ├── ghost_button.dart
│   ├── glass_input.dart
│   ├── glass_dropdown.dart
│   ├── glass_text_area.dart
│   ├── badge_chip.dart
│   ├── stat_card.dart
│   ├── section_header.dart
│   ├── status_tag.dart
│   ├── shimmer_placeholder.dart
│   ├── empty_state.dart
│   ├── error_card.dart
│   ├── confirm_dialog.dart
│   ├── loading_overlay.dart
│   ├── branch_switcher.dart
│   └── notification_bell.dart
└── utils/
    ├── date_utils.dart          — parseUTC, formatRelative, formatDate
    ├── currency_utils.dart      — formatPeso (₱1,234.00)
    ├── image_utils.dart         — getUploadUrl, pickImage, uploadImage
    ├── permission_utils.dart    — hasPermission, isOwner, permission codes
    └── validators.dart          — email, password, TIN format validators
```

---

## CRITICAL IMPLEMENTATION RULES

1. **Philippine Peso ₱** — format as `₱1,234.00` using `NumberFormat.currency(locale: 'en_PH', symbol: '₱')`
2. **All dates in Asia/Manila (UTC+8)** — parse MySQL strings by appending 'Z' then converting to local
3. **All images via `cached_network_image`** with dark placeholder `Color(0xFF1A1A1A)` — never white placeholders
4. **Error messages** extracted from `e.response?.data['message']` via Dio interceptor
5. **Loading states** always use shimmer with dark base `Color(0xFF1A1A1A)` and highlight `Color(0xFF222222)`
6. **All monetary calculations** match backend precision — use `double`, display `.toStringAsFixed(2)`
7. **Role enforcement:** check `user.role` on login — block non-manager/owner roles with error screen
8. **Maintenance mode:** check 503 with `code: 'MAINTENANCE_MODE'` — show full-screen overlay
9. **Image uploads** use `image_picker` + Dio `MultipartFile.fromFile`
10. **All lists** support pull-to-refresh and infinite scroll pagination where applicable
11. **Notifications** poll every 30 seconds (same as web) — show badge count on bell icon
12. **Multi-branch:** store `selectedBarId` in secure storage, send as `X-Bar-Id` header
13. **API response unwrapping:** always `response.data['data'] ?? response.data` pattern
14. **Tax computation** must match backend exactly: EXCLUSIVE adds tax on top, INCLUSIVE extracts tax from total, NON_VAT = zero tax
15. **Never hardcode tax values** — always fetch from API and snapshot at order time
16. **Notifications use `reference_id` / `reference_type`** — never `related_id` / `related_type`
17. **silentError pattern:** some API calls (tax-config, dss, analytics) should not show error toasts on failure — handle gracefully with empty state
18. **Bar owner bypasses all permission checks** in the app — same as `hasPermission()` in web store
