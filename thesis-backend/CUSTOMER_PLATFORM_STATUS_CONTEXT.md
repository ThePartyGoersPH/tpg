---
description: Customer-only backend context for announcements, maintenance, platform feedback replies, and banning reasons
---

# Customer Platform Status Context

This document is **customer-focused only** and covers:
1. Announcements
2. Maintenance mode
3. Platform feedback + admin replies
4. Banning and ban reasons

## 1) Announcements (Customer-visible)

### Endpoint
- `GET /auth/platform/announcements?limit=20`

### Behavior
- Returns only active announcements that are currently valid:
  - `is_active = 1`
  - `starts_at IS NULL OR starts_at <= NOW()`
  - `ends_at IS NULL OR ends_at >= NOW()`

### Response shape
- `success: true`
- `data: [{ id, title, message, is_active, starts_at, ends_at, created_at, updated_at }]`

### Customer app usage
- Show as banner/cards in home/dashboard.
- Safe to poll on app start and periodic refresh.

---

## 2) Maintenance Mode (Customer-visible)

### Public status endpoint
- `GET /auth/platform/maintenance`

### Response shape
- `success: true`
- `data: { maintenance_mode, maintenance_message, updated_at }`
  - `maintenance_mode`: `0 | 1`
  - `maintenance_message`: `string | null`

### Login enforcement
- During login (`POST /auth/login`), non-super-admin users are blocked when maintenance is on.
- Error response:
  - HTTP `503`
  - `code: "MAINTENANCE_MODE"`
  - `message`: admin-configured maintenance message (or fallback)

### Customer app usage
- On app bootstrap, check `/auth/platform/maintenance`.
- If `maintenance_mode === 1`, show maintenance screen/message and block normal flow.

---

## 3) Platform Feedback + Admin Replies (Customer-visible)

### Submit feedback
- `POST /platform-feedback` (auth required)
- Body:
  - `rating` (1-5)
  - `comment` (optional)
  - `category` (optional)

### View my feedback history
- `GET /platform-feedback/my` (auth required)

### Feedback history response fields
Each feedback item includes:
- `id, rating, comment, category, status, created_at`
- `admin_reply`
- `replied_at`
- `replied_by_name`
- `replied_by_email`

### Customer app usage
- Render admin reply directly beneath each feedback entry.
- If `admin_reply` is null, show "No admin reply yet".

---

## 4) Banning and Ban Reasons (Customer-visible)

## A) Global platform ban
- Enforced on login (`POST /auth/login`).
- If banned:
  - HTTP `403`
  - `code: "ACCOUNT_BANNED"`
  - `message`: uses admin-provided ban reason (if available), otherwise fallback message.

### Backing fields
- `users.is_banned`
- `users.ban_reason` (if migration applied)

## B) Bar suspension message for bar-side accounts
- For non-customer bar-side roles, login may return:
  - HTTP `403`
  - `code: "BAR_SUSPENDED"`
  - `message`: uses admin suspension message when set.

> Note: This is mainly for bar management login. Customer web should still handle this code safely.

---

## Recommended Customer Error Mapping

- `503` + `code=MAINTENANCE_MODE`
  - Show maintenance UI with backend `message`.
- `403` + `code=ACCOUNT_BANNED`
  - Show restriction UI and backend `message` (ban reason).
- `403` + `code=BAR_SUSPENDED`
  - Show backend `message`.
- `401`
  - Invalid credentials/session.

---

## Quick Integration Checklist

- [ ] Read `/auth/platform/maintenance` on app startup.
- [ ] Read `/auth/platform/announcements` for customer banners.
- [ ] Show `admin_reply` from `/platform-feedback/my`.
- [ ] Handle login errors by `code` (`MAINTENANCE_MODE`, `ACCOUNT_BANNED`, `BAR_SUSPENDED`).
- [ ] Display backend message text directly for ban/maintenance reasons.
