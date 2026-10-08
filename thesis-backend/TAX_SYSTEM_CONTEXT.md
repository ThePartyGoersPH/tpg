# Tax-Aware Ordering System — Implementation Context

## Overview
This document describes the tax-aware architecture built into the reservation+ordering system. Use this as the precise spec when implementing or extending any tax-related feature.

---

## Database Schema (already migrated — do NOT re-run)

### `bars` table — added columns
```sql
ALTER TABLE bars
  ADD COLUMN IF NOT EXISTS tin VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_bir_registered TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_type ENUM('VAT','NON_VAT') NOT NULL DEFAULT 'NON_VAT',
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tax_mode ENUM('EXCLUSIVE','INCLUSIVE') NOT NULL DEFAULT 'EXCLUSIVE';
```
- `tin` — BIR Tax Identification Number (e.g. `123-456-789-000`)
- `is_bir_registered` — 1 if bar is BIR-registered, 0 otherwise
- `tax_type` — `VAT` (12%) or `NON_VAT` (0%)
- `tax_rate` — decimal rate, e.g. `12.00` for 12%
- `tax_mode` — `EXCLUSIVE` (tax added on top) or `INCLUSIVE` (tax already inside price)

### `pos_orders` table — added columns
```sql
ALTER TABLE pos_orders
  ADD COLUMN IF NOT EXISTS customer_user_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS order_source ENUM('pos','web') NOT NULL DEFAULT 'pos',
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tax_type_snapshot VARCHAR(10) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_rate_snapshot DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS or_number VARCHAR(50) DEFAULT NULL;
```
- `customer_user_id` — FK to `users.id`, NULL for POS walk-in orders
- `order_source` — `'pos'` for staff POS, `'web'` for online orders
- `tax_amount` — computed tax stored at order time (snapshot)
- `tax_type_snapshot` — copy of `bars.tax_type` at order time
- `tax_rate_snapshot` — copy of `bars.tax_rate` at order time
- `or_number` — generated OR number string (format: `BARID-YYYYMMDD-XXXX`)
- `staff_user_id` is now nullable (web orders have no staff)

### `or_number_sequences` table — new table
```sql
CREATE TABLE IF NOT EXISTS or_number_sequences (
  bar_id INT NOT NULL,
  date_key VARCHAR(8) NOT NULL,   -- YYYYMMDD
  last_seq INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bar_id, date_key)
);
```
Used for atomic sequential OR number generation per bar per day.

---

## Tax Computation Logic

**This exact function must be used identically on both backend and frontend.**

```js
function computeTax(rawSubtotal, bar) {
  const taxType = (bar.tax_type || 'NON_VAT').toUpperCase();
  const taxRate = Number(bar.tax_rate || 0);
  const taxMode = (bar.tax_mode || 'EXCLUSIVE').toUpperCase();
  const s = Number(rawSubtotal);

  if (taxType === 'NON_VAT' || taxRate === 0) {
    return { net_subtotal: s, tax_amount: 0, total_amount: s };
  }
  if (taxMode === 'EXCLUSIVE') {
    // Tax is ADDED ON TOP of subtotal
    const tax = parseFloat((s * taxRate / 100).toFixed(2));
    return { net_subtotal: s, tax_amount: tax, total_amount: parseFloat((s + tax).toFixed(2)) };
  }
  // INCLUSIVE — Tax is ALREADY INSIDE the price
  const tax = parseFloat((s - s / (1 + taxRate / 100)).toFixed(2));
  return { net_subtotal: parseFloat((s - tax).toFixed(2)), tax_amount: tax, total_amount: s };
}
```

### Tax Mode Explained
| Mode | Meaning | Example (₱100 subtotal, 12% VAT) |
|------|---------|----------------------------------|
| `EXCLUSIVE` | Tax added on top | net=₱100, tax=₱12, total=₱112 |
| `INCLUSIVE` | Tax already inside price | net=₱89.29, tax=₱10.71, total=₱100 |

---

## OR Number Generation (Backend Only)

Format: `{barId}-{YYYYMMDD}-{4-digit-seq}` — e.g. `11-20260326-0001`

```js
async function generateORNumber(conn, barId) {
  const dateKey = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  // Atomic upsert — increments sequence
  await conn.query(
    `INSERT INTO or_number_sequences (bar_id, date_key, last_seq)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    [barId, dateKey]
  );
  const [[row]] = await conn.query(
    `SELECT last_seq FROM or_number_sequences WHERE bar_id = ? AND date_key = ?`,
    [barId, dateKey]
  );
  const seq = String(row.last_seq).padStart(4, '0');
  return `${barId}-${dateKey}-${seq}`;
}
```

---

## Backend Route: `/customer-orders`

File: `thesis-backend/routes/customerOrders.js`
Mounted in `thesis-backend/index.js` as: `app.use('/customer-orders', customerOrdersRouter)`

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/customer-orders/bars/:barId/tax-config` | Public | Get bar tax config fields |
| GET | `/customer-orders/bars/:barId/tax-preview?subtotal=X` | Public | Preview tax for a given subtotal |
| POST | `/customer-orders` | `requireAuth` (customer) | Create a web order |
| GET | `/customer-orders/my` | `requireAuth` (customer) | Get own order history |
| GET | `/customer-orders/:id/receipt` | `requireAuth` (customer) | Get receipt details |
| GET | `/customer-orders/reports/sales` | `requireAuth` (owner/admin) | Sales + tax report |

### POST `/customer-orders` — Request Body
```json
{
  "bar_id": 11,
  "items": [
    { "menu_item_id": 42, "quantity": 2 },
    { "menu_item_id": 17, "quantity": 1 }
  ]
}
```

### POST `/customer-orders` — What it does (in order)
1. Validates `bar_id` and `items`
2. Fetches bar row (includes tax config columns)
3. Checks `customer_bar_bans` — rejects if banned
4. Fetches each `menu_item` from DB, validates stock/availability
5. Computes `rawSubtotal` = sum of (price × qty)
6. Calls `computeTax(rawSubtotal, bar)` → gets `net_subtotal`, `tax_amount`, `total_amount`
7. Generates `or_number` via `generateORNumber()` (if `or_number_sequences` table exists)
8. Generates `order_number` = `WEB-{barId}-{timestamp}`
9. INSERTs into `pos_orders` with `order_source='web'`, `customer_user_id`, all tax fields
10. INSERTs order items into `pos_order_items`
11. Deducts stock from `menu_items`
12. Sends customer notification (type `order_placed`, uses `reference_id`/`reference_type`)
13. Logs audit trail
14. Returns `{ success, data: { id, order_number, or_number, subtotal, tax_amount, total_amount } }`

### GET `/customer-orders/:id/receipt` — Response shape
```json
{
  "id": 83,
  "order_number": "WEB-11-1743000000000",
  "or_number": "11-20260326-0001",
  "status": "pending",
  "payment_status": "pending",
  "subtotal": 100.00,
  "tax_amount": 12.00,
  "total_amount": 112.00,
  "tax_type_snapshot": "VAT",
  "tax_rate_snapshot": 12.00,
  "tax_mode": "EXCLUSIVE",
  "created_at": "2026-03-26T...",
  "bar_name": "Juan Bar",
  "bar_address": "...",
  "bar_tin": "123-456-789-000",
  "bar_phone": "...",
  "bar_email": "...",
  "is_bir_registered": 1,
  "payment_method": "gcash",
  "items": [
    { "item_name": "Draft Beer", "quantity": 2, "unit_price": 50.00, "subtotal": 100.00 }
  ]
}
```

---

## Bar Owner Tax Config Endpoints

File: `thesis-backend/routes/owner.js` (appended at end)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/owner/tax-config` | `requireAuth` + `requireRole([OWNER])` | Get own bar's tax config |
| PUT | `/owner/tax-config` | `requireAuth` + `requireRole([OWNER])` | Update own bar's tax config |

### PUT `/owner/tax-config` — Request Body (all fields optional)
```json
{
  "tin": "123-456-789-000",
  "is_bir_registered": true,
  "tax_type": "VAT",
  "tax_rate": 12,
  "tax_mode": "EXCLUSIVE"
}
```

---

## Frontend Files

### API Layer
File: `src/api/orderApi.js`
```js
import axios from 'axios';
const BASE = import.meta.env.VITE_API_URL;
export const orderApi = {
  getTaxConfig: (barId) => axios.get(`${BASE}/customer-orders/bars/${barId}/tax-config`),
  taxPreview: (barId, subtotal) => axios.get(`${BASE}/customer-orders/bars/${barId}/tax-preview`, { params: { subtotal } }),
  createOrder: (data) => axios.post(`${BASE}/customer-orders`, data, { withCredentials: true }),
  myOrders: (params) => axios.get(`${BASE}/customer-orders/my`, { params, withCredentials: true }),
  getReceipt: (orderId) => axios.get(`${BASE}/customer-orders/${orderId}/receipt`, { withCredentials: true }),
  salesReport: (params) => axios.get(`${BASE}/customer-orders/reports/sales`, { params, withCredentials: true }),
};
```

### Service Layer
File: `src/services/orderService.js`
Wraps `orderApi` with `.data` unwrapping and error handling. Methods:
- `getTaxConfig(barId)` → returns `{ tin, is_bir_registered, tax_type, tax_rate, tax_mode }`
- `createOrder(payload)` → returns full response object
- `myOrders(params)` → returns array of orders
- `getReceipt(orderId)` → returns receipt object
- `salesReport(params)` → returns report object

---

## Notification Column Names (CRITICAL)

The `notifications` table schema is:
```
id, user_id, type, title, message, link, reference_id, reference_type, is_read, created_at
```

**NEVER use**: `related_id`, `related_type`, `bar_id`, `post_id`, `comment_id` — these columns DO NOT EXIST.

**Always use**:
```sql
INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read, created_at)
VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
```

---

## Payment Integration

- Web orders use the **existing** `/payments/create` endpoint (no new payment route needed)
- `payment_type` = `'order'` (already accepted by existing `payment_transactions` schema)
- `related_id` in `payment_transactions` = `pos_orders.id`
- Only `total_amount` (after tax) is sent to PayMongo — tax is never computed inside PayMongo
- Payment success handler already marks `pos_orders.payment_status = 'paid'`

### Payment flow for web orders
1. `POST /customer-orders` → creates order, returns `{ id, total_amount }`
2. `POST /payments/create` with `{ payment_type: 'order', related_id: order.id, amount: total_amount, payment_method: 'gcash'|'paymaya'|'card', bar_id }`
3. Redirect customer to `checkout_url` from PayMongo
4. On success: PayMongo webhook → `/payments/paymongo/webhook` → marks order paid

---

## What Is NOT Implemented (future work)

- Bar Owner UI panel for setting `tin`, `tax_type`, `tax_rate`, `tax_mode` (backend endpoints exist, frontend form not built)
- Tax reporting dashboard for bar owners (backend `/customer-orders/reports/sales` exists)
- BIR-format receipt PDF export
- The standalone `CustomerOrderView.jsx`, `OrderReceiptView.jsx`, `MyOrdersView.jsx` files exist in `src/views/` but are **not wired into the router** — they were created but removed from the nav/routing because ordering is handled inside the existing reservation flow (`BarDetailView` → Bar Menu tab)

---

## Core Rules (do NOT violate)

1. **Never use destructive DB operations** — all migrations are `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`
2. **Never hardcode tax values** — always read from `bars.tax_rate` and `bars.tax_type`
3. **Never compute tax inside PayMongo** — send only the final `total_amount`
4. **Always snapshot tax** — copy `tax_type`/`tax_rate` into the order row at creation time
5. **Notifications use `reference_id`/`reference_type`** — never `related_id`/`related_type`
6. **Ordering stays inside reservations** — the existing `BarDetailView` Bar Menu tab is the order interface; do not build a separate standalone ordering flow
