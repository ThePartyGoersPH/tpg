---
description: Customer App backend integration context for Platform Bar System
---

# Customer App Context (Platform Bar System)

This file documents the **Customer App** backend contract, including recently added social and ban-related features.

> Scope source: `thesis-backend/routes/publicBars.js`, `routes/social.js`, `routes/reservations.js`, `routes/reviews.js`, `routes/auth.js`, and mounted routes in `index.js`.

## 1) Route Mounting and Base Paths

- Public browse/data routes:
  - `app.use("/public", publicBarsRoutes)`
  - `app.use("/public", reviewsRoutes)`
  - `app.use("/public", reservationRoutes)`
- Social routes:
  - `app.use("/social", socialRoutes)`
- Auth routes:
  - `app.use("/auth", authRoutes)`

So Customer App usually calls:
- `/auth/*`
- `/public/*`
- `/social/*`

## 2) Authentication for Customer App

## Register
- `POST /auth/register`
- Body:
  - `first_name`, `last_name`, `email`, `password`, optional `phone_number`

## Login
- `POST /auth/login`
- Body:
  - `email`, `password`
- Success:
  - returns JWT token + user profile data
- Failure:
  - backend returns `message: "Invalid credentials"` (401)
  - backend returns `code: "MAINTENANCE_MODE"` (503) for non-super-admin users when platform maintenance is ON
  - backend returns `code: "ACCOUNT_BANNED"` (403) for globally banned users
    - `message` uses admin-entered ban reason when available (`users.ban_reason`), otherwise fallback text
  - backend returns `code: "BAR_SUSPENDED"` (403) for bar-side roles assigned to suspended bars
    - `message` uses admin suspension message when available (`bars.suspension_message`)
  - UI may display friendly equivalent (example: `Invalid information`)

## Maintenance status endpoint (public read)
- `GET /auth/platform/maintenance`
- Purpose:
  - lets Customer App check platform availability before login and during app bootstrap
- Response shape:
  - `success: true`
  - `data.maintenance_mode` (`0|1`)
  - `data.maintenance_message` (`string|null`)
  - `data.updated_at` (`datetime|null`)

## Active platform announcements endpoint (public read)
- `GET /auth/platform/announcements?limit=20`
- Purpose:
  - fetch announcement banners to display in Customer App
- Response shape:
  - `success: true`
  - `data: [{ id, title, message, is_active, starts_at, ends_at, created_at, updated_at }]`
- Backend filtering:
  - only `is_active = 1`
  - current time within optional `starts_at`/`ends_at` window

## Platform feedback (customer app)
- Submit feedback:
  - `POST /platform-feedback` (Bearer token)
  - body: `{ rating, comment, category }`
- View own feedback history with admin replies:
  - `GET /platform-feedback/my` (Bearer token)
  - each item now includes:
    - `admin_reply`
    - `replied_at`
    - `replied_by_name`
    - `replied_by_email`
  - use these fields to show the super admin response under each feedback item

## Current user profile
- `GET /auth/me` (Bearer token required)

## Current user permissions
- `GET /auth/me/permissions` (Bearer token required)
- For customer features this is typically not used for authorization gates, but can be used for diagnostics.

## 3) Core Customer Features: Endpoint Mapping

### A) Platform-wide status + announcements
- Maintenance state:
  - `GET /auth/platform/maintenance`
- Announcement feed:
  - `GET /auth/platform/announcements`
- UX expectation:
  - if maintenance is ON, show:
    - `Platform is currently under maintenance. Please try again later.`
  - disable normal customer interactions while maintenance is active

### B) Browse bars (with map support)
- `GET /public/bars`
- Query params supported:
  - `city`
  - `category`
  - `has_coords=1` (returns bars with lat/lng)
- Key fields returned per bar:
  - `id`, `name`, `description`, `address`, `city`, `state`, `zip_code`
  - `image_path`, `logo_path`, `video_path`
  - aliases: `bar_icon`, `bar_gif`
  - `latitude`, `longitude` (**map pin source**)
  - `follower_count`, `rating`, `review_count`
  - open-hours fields (`monday_hours` ... `sunday_hours`)

### C) Bar details
- `GET /public/bars/:id`
- Same core detail fields as browse list (single item)

### D) Bar menu
- `GET /public/bars/:id/menu`
- Returns available menu items and image paths.

### E) Bar events list (for event cards)
- `GET /public/bars/:id/events`
- Returns active upcoming events with:
  - event metadata (`title`, `description`, `event_date`, `start_time`, `end_time`)
  - media fields (`image_url`, `image_path`)
  - social counters:
    - `like_count`
    - `comment_count`

### F) Event details screen data composition
Use:
1. `GET /public/bars/:id/events` to get event metadata and counters
2. `GET /social/events/:eventId/comments` to get comment list

Comments payload includes:
- `id`, `event_id`, `user_id`, `comment`, `created_at`, `updated_at`
- user display fields: `first_name`, `last_name`, `profile_picture`

### G) Follow / unfollow bars
Primary REST endpoints:
- `POST /social/bars/:barId/follow`
- `DELETE /social/bars/:barId/follow`

Legacy fallback endpoint still exists:
- `POST /social/follow-bar`

### H) Event likes
- `POST /social/events/:eventId/like`
- `DELETE /social/events/:eventId/like`
- Returns `liked` + `likeCount`

### I) Event comments
- List comments:
  - `GET /social/events/:eventId/comments`
- Create comment:
  - `POST /social/events/:eventId/comments`
  - Body: `{ "comment": "..." }`

### J) Reservations (customer side)
(From public/shared reservation routes)
- Browse available tables:
  - `GET /public/bars/:id/tables`
- Create/manage reservations use routes from `routes/reservations.js` (customer flows are mounted at `/public` and `/`).

### K) Reviews (customer side)
- Public list:
  - `GET /public/bars/:id/reviews`
- My review:
  - `GET /public/bars/:id/reviews/mine`
- Eligibility:
  - `GET /public/bars/:id/reviews/eligibility`
- Create/update:
  - `POST /public/bars/:id/reviews`
- Delete mine:
  - `DELETE /public/bars/:id/reviews`

## 4) Customer Banning Behavior (Critical)

Bans are enforced at **two levels**:

1. **Global platform ban** (Super Admin)
   - source fields: `users.is_banned`, `users.banned_at`, `users.banned_by`, `users.ban_reason`
   - enforcement:
     - `POST /auth/login` returns `403` and blocks session creation when globally banned
     - response code: `ACCOUNT_BANNED`
     - response message: ban reason if provided by admin

2. **Bar-level ban** (Bar Owner)
   - source table: `customer_bar_bans`
   - enforcement:
     - public/social/reservation/review flows block interactions per specific bar

Effects for banned customer:
- Global ban:
  - cannot login to platform at all
- Bar-level ban:
  - Public bar list/detail/menu/events/tables hide denied bar (often 404-style behavior)
- Follow endpoint returns forbidden
- Event like/comment endpoints return forbidden
- Reviews and other actions also block with ban checks

Typical backend message when blocked:
- `"You are banned from this bar"`

## 5) Data Structures (Customer App focus)

## Event object (from public events)
- `id`, `bar_id`, `title`, `description`
- `event_date`, `start_time`, `end_time`
- `entry_price`, `max_capacity`, `current_bookings`, `status`
- `image_url`, `image_path`
- `like_count`, `comment_count`
- `created_at`, `updated_at`

## Event comment object
- `id`, `event_id`, `user_id`, `comment`
- `first_name`, `last_name`, `profile_picture`
- `created_at`, `updated_at`

## Bar object (map-ready)
- includes `latitude`, `longitude`, `address`, `name`, media fields, `follower_count`

## 6) Integration Notes for AI Agents / Scripts

1. Prefer `image_path` for media hosted in backend uploads.
   - Render as: `${BASE_URL}/${image_path}`
2. Use optional auth token even for public endpoints when available:
   - token allows backend to apply ban filtering accurately per user.
3. Event details screen should not assume a dedicated `/public/events/:id` endpoint; compose from existing endpoints.
4. Do not remove legacy social endpoints; both REST and legacy routes may be in use by old clients.

## 7) Error Handling Guidance (Customer App)

Recommended UI mapping:
- `401` + invalid auth/login -> `Invalid information`
- `503` + `code=MAINTENANCE_MODE` -> `Platform is currently under maintenance. Please try again later.`
- `403` + `code=ACCOUNT_BANNED` -> show backend `message` directly (ban reason)
- `403` + `code=BAR_SUSPENDED` -> show backend `message` directly (suspension notice)
- `403` + message contains banned -> `You cannot interact with this bar`
- `404` for hidden banned bar/public data -> show `Bar not found`
- network/server -> `Something went wrong. Please try again.`

## 8) Endpoint Compatibility Statement

This context relies on existing mounted endpoints and additive features already present in backend.
No endpoint replacement is required to support the Customer App features documented above.
