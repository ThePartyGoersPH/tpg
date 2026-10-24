---
description: POS App RBAC and endpoint integration context for Platform Bar System
---

# POS App Context (Platform Bar System)

This file defines the runtime contract for the **POS App**, especially RBAC/permission behavior.

> Scope source: `thesis-backend/routes/pos.js`, `routes/auth.js`, `middlewares/requirePermission.js`, route mounts in `index.js`, and DB dump `tpg (16).sql` (`roles`, `permissions`, `role_permissions`).

## 1) Route Mounting and Base Paths

- POS routes are mounted as:
  - `app.use("/pos", posRoutes)`
- Auth routes for token + permissions:
  - `app.use("/auth", authRoutes)`

POS clients call:
- `/auth/login`
- `/auth/me`
- `/auth/me/permissions`
- `/pos/*`

## 2) POS Endpoints and Required Permissions

From `routes/pos.js`:

1. `GET /pos/menu`
   - Permission: `POS_ACCESS`
2. `GET /pos/tables`
   - Permission: `POS_ACCESS`
3. `POST /pos/orders`
   - Permission: `POS_CREATE_ORDER`
4. `POST /pos/orders/:id/pay`
   - Permission: `POS_CREATE_ORDER`
5. `POST /pos/orders/:id/cancel`
   - Permission: `POS_CREATE_ORDER`
6. `GET /pos/orders`
   - Permission: `POS_VIEW_ORDERS`
7. `GET /pos/orders/:id`
   - Permission: `POS_VIEW_ORDERS`
8. `GET /pos/dashboard`
   - Permission: `POS_ACCESS`

All above also require:
- authenticated user (`requireAuth`)
- valid bar scope for non-super-admin users (`requirePermission` checks `bar_id`)

## 3) Permissions Defined in Database (POS-related)

From `permissions` table:
- `POS_ACCESS` (id 65)
- `POS_CREATE_ORDER` (id 66)
- `POS_VIEW_ORDERS` (id 67)
- `POS_VOID_ORDER` (id 68)
- `POS_MANAGE` (id 69)
- `POS_VIEW_SALES` (id 70)
- `POS_MANAGE_ORDERS` (id 71)
- `POS_REFUND` (id 72)

### Required by current POS routes
- Used now: `POS_ACCESS`, `POS_CREATE_ORDER`, `POS_VIEW_ORDERS`
- Not used by current `/pos/*` routes: `POS_VOID_ORDER`, `POS_MANAGE`, `POS_VIEW_SALES`, `POS_MANAGE_ORDERS`, `POS_REFUND`

## 4) Role -> POS Permission Mapping

Roles (from `roles` table):
- 1 ADMIN
- 2 HR
- 3 EMPLOYEE
- 4 CUSTOMER
- 5 STAFF
- 6 SUPER_ADMIN
- 7 BAR_OWNER
- 8 CASHIER
- 9 MANAGER

From `role_permissions` dump, roles with all currently required POS permissions (`65, 66, 67`):
- STAFF (5)
- SUPER_ADMIN (6)
- BAR_OWNER (7)
- CASHIER (8)
- MANAGER (9)

Roles without full required POS permissions by default:
- ADMIN (1)
- HR (2)
- EMPLOYEE (3)
- CUSTOMER (4)

> Note: user-specific grants in `user_permissions` can override role defaults.

## 5) Login and Access-Control Behavior (Required UX)

## Credential validation
- Backend login endpoint: `POST /auth/login`
- On invalid email/password backend returns:
  - `401` with message `Invalid credentials`
- POS UI should display:
  - **"Invalid information"**

## Permission gate after login
After successful login:
1. call `GET /auth/me/permissions`
2. evaluate required POS permissions

### Minimum recommended gate
- Must have `POS_ACCESS` to enter POS module.

### Feature-level gates
- Create/pay/cancel order requires `POS_CREATE_ORDER`
- View order list/detail requires `POS_VIEW_ORDERS`
- Dashboard/menu/tables requires `POS_ACCESS`

If missing required permission:
- block feature or whole POS module
- show:
  - **"Cannot use POS, insufficient permissions"**

## 6) Dynamic Permission Check Strategy (Frontend)

At app startup/login:
- cache `permissions` array from `/auth/me/permissions`

Recommended helper:
- `hasPermission(code)`
- `canAny([codes])` only when endpoint allows alternatives (none in current `/pos/*` routes)

Bind every POS action to permission constants, not role strings.

Example matrix:
- open POS tab -> `POS_ACCESS`
- load tables/menu -> `POS_ACCESS`
- submit order -> `POS_CREATE_ORDER`
- collect payment -> `POS_CREATE_ORDER`
- cancel pending order -> `POS_CREATE_ORDER`
- open order history/detail -> `POS_VIEW_ORDERS`

## 7) Undefined Permission Audit (Important)

Check performed against current POS routes vs `permissions` dump:
- **Undefined required permissions: none**

All permission codes required by current `/pos/*` routes exist in DB dump.

## 8) Data Structures Used by POS Endpoints

## `/pos/menu` response item
- menu + inventory snapshot:
  - `id`, `inventory_item_id`, `menu_name`, `menu_description`, `selling_price`
  - `category`, `is_available`, `sort_order`
  - `inventory_name`, `stock_qty`, `unit`, `cost_price`, `image_path`, `stock_status`

## `/pos/tables` response item
- table + computed status:
  - `id`, `table_number`, `capacity`, `is_active`, `image_path`, `price`
  - `status`: `available|reserved|occupied`
  - `active_order`: `{ order_id, order_number } | null`

## `/pos/orders` create payload
- body:
  - `table_id` (optional)
  - `items[]`: `{ menu_item_id, quantity }`
  - `notes` (optional)
  - `order_timestamp` (optional client timestamp)

## `/pos/orders/:id/pay` payload
- `payment_method`: `cash|digital`
- `amount_received` (required for cash in practice)
- `discount_amount` (optional)

## 9) Error Handling Guidance (POS App)

Map backend failures to consistent UX:

- `401` on login -> **Invalid information**
- `403` on POS route + missing permission -> **Cannot use POS, insufficient permissions**
- `403` with no bar scope -> show insufficient permission/access scope message
- `404` entity missing (order/table/menu) -> specific not found message
- `400` validation/business rule errors -> show backend `message`
- `500` -> generic retry message

## 10) Compatibility Statement

This context does not require replacing or removing existing endpoints.
It is designed to reuse current backend contracts and permission middleware as-is.
