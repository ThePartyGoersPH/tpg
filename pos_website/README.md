# TPG POS Website (Dedicated)

Dedicated POS frontend that reuses existing backend endpoints under `/auth` and `/pos`.

## Stack
- React + Vite
- Axios
- Lucide React

## Implemented in V1
- Staff/manager login via `/auth/login`
- Session bootstrap via `/auth/me` and `/auth/me/permissions`
- Permission-aware UI gates:
	- `menu_view`
	- `reservation_view`
	- `reservation_manage`
- POS dashboard (`/pos/dashboard`)
- New order flow (`/pos/menu`, `/pos/tables`, `POST /pos/orders`)
- Orders list/detail (`GET /pos/orders`, `GET /pos/orders/:id`)
- Payment and cancellation actions (`POST /pos/orders/:id/pay`, `POST /pos/orders/:id/cancel`)

## Setup
1. Copy `.env.example` to `.env`
2. Set `VITE_API_URL`
3. Install and run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Notes
- Backend RBAC must grant the required permission codes to the POS user.
- `X-Bar-Id` is sent from local storage (`pos_selected_bar_id`) when available.
- This app intentionally reuses the existing backend contract to avoid backend rewrites.
