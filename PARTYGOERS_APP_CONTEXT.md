# THE PARTY GOERS — Customer Website Application Context

> **Generated from full codebase analysis.** This document covers the entire customer-facing web application and its Express.js backend.

---

## 1. PROJECT OVERVIEW

**Platform:** "The Party Goers" (TPG) — a nightlife discovery and reservation platform focused on bars in Cavite, Philippines.

**Purpose:** Lets customers browse bars, view menus, reserve tables, pay online (GCash/PayMaya via PayMongo), follow bars, interact with events/posts (like, comment, report), view a live map with navigation, manage reservations/payments, and submit platform feedback.

**Tech Stack:**
- **Frontend:** React 18 + Vite, no router (SPA view-switching via `ViewContext`), Axios HTTP client, Lucide icons, Leaflet + leaflet-routing-machine for maps, Google OAuth (`@react-oauth/google`), custom CSS (dark glassmorphism theme).
- **Backend:** Express.js, MySQL 2 (promise pool), JWT auth, bcrypt, PayMongo API integration, multer for uploads, Helmet + CORS + rate limiting, audit logging, email service (verification + password reset).
- **Database:** MySQL with timezone `Asia/Manila (+08:00)`.
- **Deployment:** Vite dev server on `:5173`, Express API on `:3000` (configurable via `VITE_API_URL`).

---

## 2. DIRECTORY STRUCTURE

### Frontend (`customer_website/`)
```
src/
├── api/
│   ├── client.js              # Axios instance, auth interceptor, 401 handler
│   ├── authApi.js             # Auth endpoints (login, register, me, profile, password, google)
│   ├── barApi.js              # Bar CRUD, menu, events, tables, reviews
│   ├── eventApi.js            # Event like/unlike, comments
│   ├── feedWidgetsApi.js      # Feed sidebar data (active bars, stats, hot tonight, genres, cities)
│   ├── paymentApi.js          # Payment create, confirm, cancel, history
│   ├── reservationApi.js      # Reservation create, list, cancel, recheck
│   └── socialApi.js           # Follow, notifications, search, feed, posts, comments, reports
├── contexts/
│   ├── AuthContext.jsx         # Auth state, login/logout/register, maintenance check
│   └── ViewContext.jsx         # SPA navigation, view history, URL detection, session persistence
├── hooks/
│   ├── useAuth.js             # AuthContext consumer
│   ├── useBars.js             # Bar list fetching with filters
│   ├── useCartPersistence.js  # localStorage cart with expiry (keyed by barId)
│   ├── useReservations.js     # User reservations fetching
│   └── useView.js             # ViewContext consumer
├── services/
│   ├── authService.js         # Wraps authApi with error extraction + role validation
│   ├── barService.js          # Wraps barApi (list, trending, details, menu, events, tables, reviews)
│   ├── eventService.js        # Wraps eventApi (like, unlike, comments, postComment)
│   ├── feedWidgetsService.js  # Wraps feedWidgetsApi
│   ├── paymentService.js      # Wraps paymentApi (create, confirm, cancel, history)
│   ├── reservationService.js  # Wraps reservationApi
│   └── socialService.js       # Wraps socialApi (follow, notifications, feed, likes, comments, reports)
├── utils/
│   ├── constants.js           # CUSTOMER_ROLE, error messages, reservation status colors
│   ├── dateHelpers.js         # formatDate, formatTime, fullName, timeAgo
│   └── imageUrl.js            # Normalizes image paths to full API URLs
├── views/
│   ├── LandingView.jsx        # Public landing page (slideshow, features, trending bars, CTA)
│   ├── LoginView.jsx          # Email/password + Google OAuth login, age verification
│   ├── RegisterView.jsx       # Registration form + Google OAuth signup
│   ├── HomeView.jsx           # Dashboard (trending bars, latest events, stats, geolocation)
│   ├── BarsView.jsx           # Bar listing with search, category filter, proximity badges
│   ├── BarDetailView.jsx      # Bar detail: tabs (overview/menu/events/about), cart, reservation, payment
│   ├── MapView.jsx            # Leaflet map with bar markers, routing, voice navigation
│   ├── EventsView.jsx         # Social feed (events + posts), comments, likes, event table reservation
│   ├── ReservationsView.jsx   # User reservations list + detail modal + cancel + recheck
│   ├── PaymentsView.jsx       # Payment history + detail modal + cancel pending + favorite bar stats
│   ├── ProfileView.jsx        # Profile edit, password change, platform feedback, danger zone
│   ├── NotificationsView.jsx  # Full notifications page with pagination
│   ├── PaymentSuccessView.jsx # Post-payment success handler
│   ├── PaymentFailedView.jsx  # Post-payment failure handler
│   ├── VerifyEmailView.jsx    # Email verification token handler
│   └── ResetPasswordView.jsx  # Password reset form
├── components/
│   ├── auth/ProtectedRoute.jsx
│   ├── bars/BarCard.jsx, BarMap.jsx, BarMenu.jsx
│   ├── events/EventCard.jsx, EventComments.jsx
│   ├── feed/FeedSidebar.jsx   # LeftSidebar (filters, active bars, stats) + RightSidebar (hot tonight, genres, cities)
│   ├── layout/Footer.jsx, Navbar.jsx
│   ├── reservations/ReservationForm.jsx, ReservationList.jsx
│   ├── reviews/ReviewForm.jsx, ReviewList.jsx
│   ├── social/UnifiedFeedCard.jsx
│   └── ui/EmptyState.jsx, LoadingState.jsx
├── App.jsx                    # Shell: GlassNav, Sidebar, ViewRenderer, NotificationsPanel
└── main.jsx                   # Entry point
```

### Backend (`thesis-backend/`)
```
├── index.js                    # Express app setup, middleware, route mounting
├── config/
│   ├── database.js             # MySQL2 connection pool
│   └── constants.js            # USER_ROLES, ACCOUNT_STATUSES, role-create permissions
├── middlewares/
│   ├── requireAuth.js          # JWT verification, user lookup, maintenance gate, multi-branch X-Bar-Id
│   ├── requireRole.js          # Role-based access (array of allowed roles)
│   ├── requirePermission.js    # DB-driven RBAC (user_permissions → role_permissions fallback)
│   ├── sanitize.js             # Input sanitization (null bytes, trim, length)
│   ├── sanitizePath.js         # Path traversal prevention
│   └── uploadFallback.js       # Default avatar for missing profile images
├── services/
│   └── paymongoService.js      # PayMongo API wrapper (sources, intents, payments, refunds, webhooks)
├── utils/
│   ├── audit.js                # Audit logging helper
│   ├── emailService.js         # Verification + password reset emails
│   └── profileUrl.js           # Safe profile URL generation
├── routes/
│   ├── auth.js                 # Login, register, Google OAuth, /me, permissions, maintenance, announcements
│   ├── reservations.js         # Public browse + customer CRUD + owner manage
│   ├── payments.js             # Payment creation (GCash/card), confirmation, history, line items, payouts
│   ├── social.js               # Follow/unfollow, likes, comments, notifications, unified feed, reports
│   ├── publicBars.js           # Public bar listing, trending, detail, menu-with-bestsellers
│   ├── reviews.js              # Bar reviews (CRUD, eligibility, averages)
│   ├── feedWidgets.js          # Active bars, quick stats, hot tonight, genre tags, bar cities
│   ├── dss.js                  # Decision Support System (reservation analytics, inventory, recommendations)
│   ├── paymongoWebhook.js      # PayMongo webhook handler
│   ├── platformFeedback.js     # Customer platform feedback
│   ├── owner.js                # Bar owner management endpoints
│   ├── admin.js                # Admin endpoints
│   ├── superAdmin.js           # Super admin endpoints
│   ├── pos.js                  # Point of Sale system
│   ├── inventory.js            # Inventory management
│   ├── hr.js, hrPayroll.js, hrPermissions.js, hrDocuments.js, hrAuditLogs.js
│   ├── attendance.js, leave.js, leaveBalance.js, hrLeaveTypes.js
│   ├── analytics.js            # Dashboard analytics
│   ├── promotions.js           # Bar promotions
│   ├── subscriptions.js        # Subscription plans
│   ├── branches.js             # Multi-branch management
│   ├── payouts.js              # Bar owner earnings/payouts
│   └── financials.js           # Financial analytics
```

---

## 3. NAVIGATION & VIEW SYSTEM

The app uses a **custom SPA view-switching system** (no React Router).

**ViewContext** (`src/contexts/ViewContext.jsx`):
- `VIEWS` enum defines all 16 view keys (LANDING, LOGIN, REGISTER, HOME, BARS, BAR_DETAIL, MAP, EVENTS, RESERVATIONS, PAYMENTS, PAYMENT_SUCCESS, PAYMENT_FAILED, NOTIFICATIONS, PROFILE, VERIFY_EMAIL, RESET_PASSWORD).
- `navigate(view, params)` triggers a 150ms transition, pushes to history stack, saves to sessionStorage.
- `goBack()` pops from history.
- `detectInitialView()` reads URL path on load for deep-link support (`/payment/success?ref=`, `/verify-email?token=`, `/reset-password?token=`, etc.).
- Views like PAYMENT_SUCCESS/FAILED use sessionStorage to prevent reload loops.

**ViewRenderer** (`App.jsx`):
- Switch-case renders the correct view component based on `currentView`.
- Unauthenticated users trying protected views get redirected to `LoginView`.
- `FULL_WIDTH_VIEWS` (Landing, Login, Register, PaymentSuccess/Failed, VerifyEmail, Home, ResetPassword, Map) skip the sidebar layout.

**Sidebar & Navigation** (`App.jsx`):
- `GlassNav` — top navigation bar with brand, notification bell (unread badge polled every 30s), user avatar, logout.
- `Sidebar` — collapsible left sidebar with nav items (Home, Bars, Map, Events, Reservations, Payments, Profile).
- `NotificationsPanel` — slide-in panel with Updates + Announcements tabs, mark-read, navigate-to-context.

---

## 4. AUTHENTICATION SYSTEM

### Frontend Flow
- **AuthContext** (`src/contexts/AuthContext.jsx`): Manages user state, token (localStorage), loading, maintenance status.
- On mount: checks maintenance status + calls `/auth/me` to refresh user. Non-customer roles are blocked with `CUSTOMER_ROLE_BLOCK_MESSAGE`.
- `login(email, password)` → `authService.login()` → stores token + user.
- `loginWithGoogle(data)` → directly sets token + user from Google OAuth response.
- `register(payload)` → `authService.register()`.
- `logout()` → clears localStorage token + user state.
- 401 interceptor on apiClient triggers `handleUnauthorized()` → clears auth, shows session expired.

### Backend Auth (`routes/auth.js`)
- **POST /auth/login**: Email/password login with bcrypt. Returns JWT (7-day expiry) with `{id, role, email, bar_id}`. Checks: email verification, account active/banned, bar suspension, role-based permissions. Pending business registrations get custom message.
- **POST /auth/register**: Customer registration. Validates age (18+), unique email, hashes password, sends verification email.
- **POST /auth/google-login**: Google OAuth. Creates account if new, age-verifiable.
- **GET /auth/me**: Returns authenticated user profile with bar info.
- **GET /auth/me/permissions**: Returns effective permission codes (user_permissions → role_permissions fallback).
- **GET /auth/platform/maintenance**: Returns maintenance mode status.
- **GET /auth/platform/announcements**: Returns active platform announcements.
- **POST /auth/forgot-password**: Sends password reset email.
- **POST /auth/reset-password**: Resets password with token.
- **GET /auth/verify-email**: Verifies email with token.
- **POST /auth/resend-verification**: Resends verification email.

### Middleware
- **requireAuth**: JWT verification → DB user lookup → inactive check → maintenance gate (non-super_admin) → attaches `req.user`. Supports multi-branch `X-Bar-Id` header for bar owners.
- **requireRole**: Checks `req.user.role` against allowed role array.
- **requirePermission**: DB-driven RBAC. Super_admin + bar_owner bypass. Others: checks user_permissions (if overrides exist) → falls back to role_permissions.

---

## 5. CORE FEATURES

### 5.1 Bar Browsing
- **BarsView**: Search by name, filter by category. Uses `useBars` hook → `barService.list()`. Shows bar cards with image, logo, follower count, rating, "NEAR" badge (geolocation-based, 5km radius via haversine).
- **BarDetailView**: Detailed bar page with 4 tabs:
  - **Overview**: Operating hours, contact info, featured events preview (first 3), reviews preview (first 3).
  - **Menu**: Menu items with images, prices, best-seller badges, category tags. Add-to-cart with quantity controls.
  - **Events**: Full event cards with date badges, entrance fee display, like button.
  - **About**: Duplicate hours/contact + full reviews with star ratings, owner replies, write/update/delete review form (eligibility-gated by completed reservation).
- Follow/unfollow bar toggle.
- **API**: `GET /public/bars` (list with filters), `GET /public/bars/:id` (detail), `GET /public/bars/:barId/menu-with-bestsellers`, `GET /public/bars/trending` (weighted scoring: followers 45%, reviews 20%, reservations 20%, engagement 15%).

### 5.2 Map & Navigation
- **MapView**: Leaflet dark tile map (CARTO dark_all) bounded to Cavite. Bar markers with logo, name label, color-coded (green = near, red = far). Popup with bar details, "Details" and "Navigate" buttons.
- User location: blue pulsing dot with heading arrow, auto-detect on mount.
- **Navigation**: OSRM routing with red route line, voice directions (Web Speech API), distance/time display, step-by-step instructions.
- Nearby count badge showing bars within 5km.

### 5.3 Events & Social Feed
- **EventsView**: Unified social feed combining events + bar posts. Three-column layout: LeftSidebar (filters, active bars, quick stats) | Feed center | RightSidebar (hot tonight, genre tags, party weather by city, invite CTA).
- **EventPost component**: Renders event or post cards with:
  - Like/unlike toggle (optimistic UI).
  - Comment section with nested `CommentThread` (replies, report).
  - Event table reservation (inline `EventTableReservation` component).
  - Entrance fee badge (paid or FREE).
- **Feed data**: Tries unified feed first (`socialService.getUnifiedFeed`), falls back to aggregating events from top 12 bars.
- **API**: `POST/DELETE /social/events/:eventId/like`, `GET/POST /social/events/:eventId/comments`, `GET /social/unified-feed`, `POST /social/bar-posts`.

### 5.4 Table Reservation & Cart
- **BarDetailView (Menu tab)**: Cart panel with:
  1. **Date picker** (min today) + **Hour selector** (filtered by bar's business hours for that day-of-week).
  2. **Party size** input.
  3. **Check Availability** → `barService.tables(barId, {date, time, party_size})` → shows available table cards with image, capacity, price, selection.
  4. **Menu items** in cart with quantity controls.
  5. **Order total** breakdown (table price + menu items).
  6. **Payment method** selection (GCash / PayMaya/Card) — only shown if bar accepts online payments.
  7. **Checkout** → creates reservation → creates payment → redirects to PayMongo checkout URL.
- **useCartPersistence hook**: Persists cart state to localStorage keyed by `bar_detail_cart_state_{barId}` with 2-hour expiry. Stores: cartItems, resDate, resTime, partySize, cartTable, paymentMethod.
- **EventTableReservation component** (in EventsView): Similar flow for event-specific table reservation with entrance fee calculation.

### 5.5 Reservation Management
- **ReservationsView**: Lists user's reservations with status badges (Reserved/Pending/Approved/Cancelled/Rejected). Click opens `ReservationModal` with full details (transaction number, table, date/time, menu items, total, cancel action).
- Auto-checks pending payments on load via `paymentService.confirmPaymentByReference`.
- Recheck button for cancelled reservations to fix payment/status mismatches.
- **API**: `POST /reservations` (create with double-booking prevention), `GET /reservations/my`, `PATCH /reservations/:id/cancel`, `POST /reservations/:id/recheck-payment`.

### 5.6 Payment System
- **PaymentsView**: Payment history with total paid stats, favorite bar calculation. Cards show bar name, amount, status, method, date, items. Click opens `PaymentDetailModal` with itemized breakdown.
- Cancel pending payments. Auto-confirms pending payments on load.
- **PayMongo Integration** (`services/paymongoService.js`):
  - GCash: `createSource()` → redirect to PayMongo checkout.
  - Card/PayMaya: `createPaymentIntent()`.
  - Keys loaded from DB (`platform_settings`) with env fallback.
  - Webhook verification via HMAC SHA256.
- **Payment flow**:
  1. Frontend: `paymentService.create()` with reservation_id, amount, method, line_items, success/failed URLs.
  2. Backend: Creates `payment_transactions` record, calls PayMongo, returns checkout URL.
  3. User completes payment externally.
  4. `PaymentSuccessView` / webhook confirms payment → updates reservation status to `confirmed`, creates payout record, deducts inventory.
- **API**: `POST /payments/create`, `GET /payments/history`, `POST /payments/confirm-by-reference/:ref`, `POST /payments/cancel-by-reference/:ref`.
- **Payout**: On successful payment, auto-creates payout record with platform fee percentage (from `platform_settings`), calculates net amount.

### 5.7 Reviews
- Bar reviews with 1-5 star rating + comment.
- Eligibility: Must have approved/completed reservation at the bar.
- Owner replies displayed below reviews.
- Submit, update, delete own review. Recalculates bar average rating.
- **API**: `GET /public/bars/:id/reviews`, `GET /bars/:id/reviews/mine`, `GET /bars/:id/reviews/eligibility`, `POST /bars/:id/reviews`, `DELETE /bars/:id/reviews/mine`.

### 5.8 Profile & Platform Feedback
- **ProfileView**: Edit name/phone (email + DOB read-only), change password, upload profile picture.
- Platform feedback: Star rating + category (general, UI/UX, performance, features, support, other) + comment. Shows feedback history with admin replies and status (reviewed/resolved).
- Danger zone: Logout (with confirm) + Delete account (redirects to support email).

### 5.9 Notifications
- **NotificationsPanel** (App.jsx): Slide-in panel with Updates + Announcements tabs. Context-aware navigation on click (comments→Events, reservations→Reservations, payments→Payments).
- **NotificationsView**: Full page with pagination (20 per page), mark-read, mark-all-read, clear-all.
- Unread count polled every 30s via `socialService.unreadCount()` with fallback.
- Icon mapping by notification type (reply, reservation, payment, event, review, follow, comment).

---

## 6. API ARCHITECTURE

### Frontend API Layer
```
api/client.js (Axios instance)
  ↓ interceptors: auth token, 401 handler
api/*Api.js (endpoint definitions)
  ↓
services/*Service.js (business logic wrappers, error extraction)
  ↓
hooks/use*.js (React state management)
  ↓
views/*.jsx (UI components)
```

### Backend Route Mounting (`index.js`)
| Prefix | Route File | Purpose |
|--------|-----------|---------|
| `/auth` | auth.js | Authentication, profile, maintenance |
| `/public` | publicBars.js, reviews.js, reservations.js | Public browse endpoints |
| `/` | reservations.js | Customer reservation actions |
| `/social` | social.js | Social features (follow, like, comment, feed, notifications) |
| `/payments` | payments.js | Payment processing |
| `/feed-widgets` | feedWidgets.js | Feed sidebar data |
| `/platform-feedback` | platformFeedback.js | Customer platform reviews |
| `/owner` | owner.js | Bar owner management |
| `/pos` | pos.js | Point of Sale |
| `/analytics` | analytics.js | Dashboard stats |
| `/webhook/paymongo` | paymongoWebhook.js | Payment webhooks (raw body) |

### Key Database Tables (inferred)
- `users` — id, first_name, last_name, email, password, role, role_id, bar_id, is_active, is_verified, is_banned, ban_reason, profile_picture, phone_number, date_of_birth
- `bars` — id, name, address, city, description, image_path, logo_path, video_path, latitude, longitude, rating, review_count, status, category, price_range, phone, email, website, monday_hours..sunday_hours, reservation_mode, owner_id, accept_gcash, accept_online, suspension_message
- `bar_tables` — id, bar_id, table_number, capacity, is_active, manual_status, image_path, price
- `bar_events` — id, bar_id, title, description, event_date, start_time, end_time, entry_price, image_path, status, archived_at
- `bar_posts` — id, bar_id, user_id, content, image_path, status
- `bar_followers` — bar_id, user_id
- `reservations` — id, transaction_number, bar_id, table_id, event_id, customer_user_id, reservation_date, reservation_time, party_size, notes, status, payment_status, paid_at, payment_transaction_id
- `reservation_items` — reservation_id, bar_id, menu_item_id, quantity, unit_price
- `payment_transactions` — id, reference_id, payment_type (reservation/order), related_id, bar_id, user_id, amount, status, payment_method, paymongo_payment_id, paid_at, failed_reason
- `payment_line_items` — payment_transaction_id, item_type, item_name, quantity, unit_price, line_total, metadata
- `payouts` — bar_id, bar_owner_id, payment_transaction_id, gross_amount, platform_fee, platform_fee_amount, net_amount, status, payout_method
- `reviews` — id, bar_id, customer_id, rating, comment, reply, reply_author
- `event_likes` — event_id, user_id
- `event_comments` — id, event_id, user_id, comment, parent_id, status
- `menu_items` — id, bar_id, menu_name, category, menu_description, selling_price, is_available, inventory_item_id, sort_order
- `inventory_items` — id, bar_id, name, unit, stock_qty, reorder_level, stock_status, image_path
- `notifications` — id, user_id, type, title, message, is_read, created_at
- `platform_settings` — setting_key, setting_value (maintenance_mode, maintenance_message, paymongo keys, platform_fee_percentage)
- `platform_announcements` — id, title, message, is_active, starts_at, ends_at
- `platform_feedback` — id, user_id, rating, comment, category, status, admin_reply, replied_by_name, replied_at
- `customer_bar_bans` — bar_id, customer_id
- `roles`, `permissions`, `role_permissions`, `user_permissions` — RBAC system
- `bar_owners` — id, user_id
- `business_registrations` — owner_email, status

---

## 7. STATE MANAGEMENT

- **AuthContext**: Global auth state (user, token, loading, maintenance, authError). Persists token in localStorage.
- **ViewContext**: SPA navigation state (currentView, viewParams, viewHistory, transitioning). Persists view in sessionStorage.
- **Component-level state**: Each view manages its own data via `useState` + `useEffect` + service calls. No global store (Redux/Zustand).
- **useCartPersistence**: Per-bar cart persistence in localStorage with 2-hour TTL. Keys: `bar_detail_cart_state_{barId}`.
- **useBars**: Bar list with loading/error/filter state.
- **useReservations**: User reservations with loading/error/reload.

---

## 8. SECURITY MEASURES

### Frontend
- JWT token stored in localStorage, attached via Axios interceptor.
- 401 responses trigger automatic logout + session expired message.
- Customer role enforcement: non-customer users blocked on login.
- Google OAuth age verification for new users.

### Backend
- **Helmet**: Security headers (CORS cross-origin resource policy).
- **CORS**: Whitelist of allowed frontend origins.
- **Rate Limiting**: Auth endpoints (20/15min), API (200/min) — currently disabled for debugging.
- **Input Sanitization**: Null byte stripping, string trimming, length limits.
- **JWT**: 7-day expiry, verified on every authenticated request.
- **Password**: bcrypt hashing.
- **Maintenance Mode**: Blocks non-super_admin users (503 response).
- **Customer Bar Bans**: Banned customers hidden from bar data + blocked from actions.
- **User Bans**: Global ban check on login.
- **Account Deactivation**: Inactive users blocked from all API access.
- **Double-booking Prevention**: 1-hour overlap check on table reservations.
- **Permission System**: DB-driven RBAC with per-user overrides → role defaults fallback.

---

## 9. DESIGN SYSTEM

**Theme**: Dark glassmorphism with red accent (`#CC0000` / `#e8001e`).

**CSS Classes** (from codebase patterns):
- **Cards**: `glass-card`, `glass-card-body` — dark translucent cards with blur.
- **Buttons**: `btn btn-red` (primary), `btn btn-ghost` (outline), `btn btn-glass` (translucent), `btn btn-sm` (small). `btn-red-pulse` for CTA animation.
- **Inputs**: `glass-input`, `glass-select`, `glass-textarea` — dark translucent form controls.
- **Layout**: `g g-2`, `g g-3` (grid), `flex`, `flex-col`, `gap-sm/md/lg/xl`, `justify-between`, `items-center`.
- **Typography**: `text-h2/h3/h4`, `text-body`, `text-muted`, `text-dim`, `text-white`, `text-label`, `text-red`.
- **Badges**: `badge-red`, `badge-glass`, `badge-success`, `badge-warn`.
- **Alerts**: `alert alert-info`, `alert alert-err`, `alert alert-warn`.
- **Status**: `payment-status paid/cancelled/pending/approved/failed`.
- **Navigation**: `glass-nav`, `app-sidebar`, `sidebar-link active`, `feed-tab active`.
- **Animations**: `animate-in` (fade-in), `loading-state` + `spinner`, view transitions (150ms).
- **Responsive**: Sidebar collapses on mobile, mobile menu overlay.

**Currency**: Philippine Peso (₱), formatted with `toFixed(2)` or `toLocaleString('en-PH')`.

---

## 10. KNOWN PATTERNS & CONVENTIONS

### Code Patterns
- **Optimistic UI**: Like/unlike toggles update state immediately, revert on API failure.
- **Auto-payment verification**: ReservationsView and PaymentsView auto-check pending payments on load.
- **Error handling**: Services extract error messages from `e?.response?.data?.message`, fall back to defaults.
- **Image fallbacks**: SVG data URIs or placeholder components for broken/missing images.
- **Geolocation**: Uses browser `navigator.geolocation` for proximity features (haversine distance calculation, 5km threshold).
- **Time formatting**: Backend uses `Asia/Manila` timezone. Frontend uses `dateHelpers.js` for display formatting.
- **Column existence caching**: Backend caches `SHOW COLUMNS` / `INFORMATION_SCHEMA` checks to avoid repeated queries.
- **Maintenance state caching**: 15-second TTL cache for platform_settings queries.

### Naming Conventions
- Frontend: camelCase for variables/functions, PascalCase for components.
- Backend: snake_case for database columns, camelCase for JS variables.
- API responses: `{ success: boolean, data?: any, message?: string }`.
- Transaction numbers: `RES-YYYYMMDD-XXXXXX` (6 random alphanumeric).
- Payment references: `PAY-{timestamp}-{random}`.

### Important Business Rules
- Customers must be 18+ to register.
- Only verified email users can log in.
- Review eligibility requires approved/completed reservation.
- Reservation times must be on the hour (HH:00), within bar operating hours.
- Tables cannot be double-booked within 1-hour window.
- Bar owners can set `reservation_mode` to `auto_accept` or `manual_approval` (default).
- Platform fee percentage is configurable via `platform_settings`.
- Payouts auto-created on successful payment with platform fee deduction.
- Inventory auto-deducted on confirmed payment (reservation items + POS orders).
