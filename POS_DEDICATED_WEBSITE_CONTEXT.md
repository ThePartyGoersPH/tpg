# POS Dedicated Website Context (Prepared)

## Purpose
This file is a reusable implementation context for building a dedicated POS website later, without re-discovering the current system behavior.

## Source Scope Reviewed
- thesis-backend (route mounts, middleware, POS routes, RBAC)
- manager (routing, POS page, POS API client, integration points)
- existing context docs in both projects

## Critical Reality Snapshot
- Backend POS API already exists and is production-ready under /pos.
- Manager has a POS page and POS API client, but POS page is not currently routed in manager/src/App.jsx.
- POS endpoints use permissions menu_view, reservation_manage, reservation_view in live backend code.
- Existing thesis-backend/POS_APP_CONTEXT.md currently documents older permission names (POS_ACCESS, POS_CREATE_ORDER, POS_VIEW_ORDERS), which do not match current route middleware.

## Backend Architecture (thesis-backend)
- Entry: thesis-backend/index.js
- POS route mount: app.use("/pos", posRoutes)
- POS routes file: thesis-backend/routes/pos.js
- Auth middleware: thesis-backend/middlewares/requireAuth.js
- Permission middleware: thesis-backend/middlewares/requirePermission.js

### Middleware/Access Pattern
1. requireAuth validates JWT and loads user context.
2. requirePermission validates RBAC:
- SUPER_ADMIN bypass
- BAR_OWNER bypass
- otherwise user_permissions override role_permissions
- enforces bar scope for non-bypass roles

## Live POS API Contract (from thesis-backend/routes/pos.js)

### GET /pos/menu
- Permission: menu_view
- Returns menu joined with inventory snapshot.

### GET /pos/tables
- Permission: menu_view
- Returns bar tables with computed status:
- available
- reserved (based on reservations)
- occupied (based on pending pos_orders)

### POST /pos/orders
- Permission: reservation_manage
- Payload:
- table_id (optional)
- items: [{ menu_item_id, quantity }]
- notes (optional)
- order_timestamp (optional)
- Behavior:
- validates menu availability and stock
- creates POS order with order number POS-YYYYMMDD-NNN
- inserts pos_order_items

### POST /pos/orders/:id/pay
- Permission: reservation_manage
- Payload:
- payment_method: cash | digital
- amount_received (required for practical cash use)
- discount_amount (optional)
- Behavior:
- validates pending order
- computes final totals/change
- deducts inventory
- inserts legacy sales records
- marks order completed

### POST /pos/orders/:id/cancel
- Permission: reservation_manage
- Behavior:
- only pending orders can be cancelled
- marks order cancelled

### GET /pos/orders
- Permission: reservation_view
- Query: status, from, to, limit
- Behavior:
- returns pos_orders history
- merges legacy sales grouped by date

### GET /pos/orders/:id
- Permission: reservation_view
- Returns order with items array.

### GET /pos/dashboard
- Permission: menu_view
- Returns today, week, top_items, low_stock summary.

## Manager Frontend Architecture (manager)
- Route config: manager/src/App.jsx
- POS page: manager/src/pages/POS.jsx
- POS API client: manager/src/api/posApi.js
- Permission helper: manager/src/hooks/usePermission.js
- Financial integration: manager/src/pages/Financials.jsx uses POS order data

### Important Manager Findings
- manager/src/pages/POS.jsx exists and calls posApi endpoints.
- manager/src/App.jsx currently does not register a /pos route.
- POS data is still used through Financials page.

## Key Data Entities Used by POS
- pos_orders
- pos_order_items
- menu_items
- inventory_items
- bar_tables
- reservations
- sales (legacy analytics compatibility)

## End-to-End POS Transaction Flow
1. Client loads menu and tables.
2. Client creates pending order.
3. Client pays order.
4. Backend deducts inventory and logs legacy sales record.
5. Order transitions to completed.
6. Dashboard and history endpoints reflect results.

## Constraints for Dedicated POS Website
- Must remain bar-scoped by authenticated user context.
- Must keep existing /pos backend contracts unless intentionally versioned.
- Must align permission checks with live backend middleware names.
- Must not break manager financial reporting which depends on POS data.
- Must preserve audit logging behavior for POS actions.

## Recommended Build Strategy for Dedicated POS Website
1. Reuse existing /pos APIs first (no backend rewrite).
2. Build a POS-specific frontend with focused routes:
- login/session
- menu + cart
- table assignment
- payment
- order history
- dashboard
3. Implement permission gating in frontend using live permission names:
- menu_view
- reservation_manage
- reservation_view
4. Keep data model unchanged in first release.
5. Add only missing backend features as additive endpoints (example: refund endpoint) if required.

## Risks and Gaps to Address During Dedicated POS Build
- Permission naming mismatch between docs and runtime code can cause false access issues.
- Concurrent payment/stock updates need careful transaction coverage.
- sales legacy compatibility can create analytics confusion if not documented.
- POS page missing from manager routing indicates feature split uncertainty; align product decision first.

## Pre-Implementation Checklist (when build starts)
- Confirm user roles allowed in dedicated POS (staff/cashier/manager/bar_owner/admin policy).
- Confirm device model (desktop terminal, tablet, mobile).
- Confirm online-only or offline-tolerant mode.
- Confirm payment methods and cash drawer flow.
- Confirm receipt printing requirements.
- Confirm if table reservations should be editable from POS UI.
- Confirm if refunds/voids are required in v1.

## Implementation Note for Future Prompt
When asked to create the dedicated POS website, use this file as the baseline contract and verify only deltas from current backend behavior before coding.
