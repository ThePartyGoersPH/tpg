---
description: Stock deduction on payment, table structure, bar owner stock view
---

# Inventory Deduction Context (Platform Bar System)

## 1) When Stock Deduction Triggers

Stock is deducted **automatically** when a customer payment is confirmed as paid. This happens inside `markPaymentSuccess()` in `routes/payments.js`.

**Trigger chain:**
1. PayMongo payment confirmed → `markPaymentSuccess(conn, payment)` called
2. If `payment_type = 'reservation'` → `deductInventoryForReservation(conn, reservationId)` runs
3. If `payment_type = 'order'` → `deductInventoryForOrder(conn, orderId)` runs

**No manual step required.** Stock deduction is part of the payment confirmation transaction.

## 2) Tables Involved

### `inventory_items` (stock source of truth)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | Auto-increment |
| `bar_id` | INT | FK to `bars.id` |
| `name` | VARCHAR | Item display name |
| `unit` | VARCHAR | Unit of measure (e.g., "bottle", "kg") |
| `stock_qty` | INT | **Current stock count** — decremented on payment |
| `reorder_level` | INT | Threshold for low stock alerts |
| `cost_price` | DECIMAL | Cost price per unit |
| `stock_status` | ENUM | `'normal'`, `'low'`, `'critical'` — auto-calculated |
| `is_active` | TINYINT | 1 = active, 0 = deleted |
| `image_path` | VARCHAR | Optional item image |

### `menu_items` (links menu to inventory)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | Menu item ID |
| `bar_id` | INT | FK to `bars.id` |
| `menu_name` | VARCHAR | Display name on menu |
| `selling_price` | DECIMAL | Customer-facing price |
| `inventory_item_id` | INT | **FK to `inventory_items.id`** — links menu to stock |
| `is_available` | TINYINT | Whether item is shown on menu |

### `reservation_items` (items ordered with a reservation)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | Auto-increment |
| `reservation_id` | INT | FK to `reservations.id` |
| `bar_id` | INT | FK to `bars.id` |
| `menu_item_id` | INT | FK to `menu_items.id` |
| `quantity` | INT | Quantity ordered |
| `unit_price` | DECIMAL | Price at time of order |

## 3) Deduction Logic

```
For each ordered item:
  1. Find menu_item.inventory_item_id (skip if NULL — no stock tracking)
  2. Read current stock_qty from inventory_items
  3. new_stock = MAX(0, stock_qty - ordered_quantity)
  4. Determine status:
     - new_stock <= 0        → 'critical'
     - new_stock < reorder_level → 'low'
     - otherwise             → 'normal'
  5. UPDATE inventory_items SET stock_qty = new_stock, stock_status = status
```

Stock cannot go below 0. If insufficient stock exists, it clamps to 0 and marks as `'critical'`.

## 4) Bar Owner Stock Endpoints

### GET /owner/inventory
Returns all active inventory items for the bar with computed stock status.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "San Miguel Pale Pilsen",
      "unit": "bottle",
      "stock_qty": 48,
      "reorder_level": 20,
      "cost_price": 35.00,
      "stock_status": "normal",
      "is_active": 1,
      "image_path": null,
      "created_at": "2026-01-15T10:00:00Z"
    },
    {
      "id": 5,
      "name": "Nachos Chips",
      "unit": "pack",
      "stock_qty": 3,
      "reorder_level": 10,
      "stock_status": "low",
      ...
    }
  ]
}
```

### GET /owner/bar/dashboard/summary
Includes `low_stock_alerts` array — items where `stock_qty < reorder_level`, sorted by severity (critical first).

```json
{
  "low_stock_alerts": [
    {
      "id": 12,
      "name": "Tequila Shot Glass",
      "stock_qty": 0,
      "reorder_level": 5,
      "unit": "piece",
      "stock_status": "critical"
    }
  ]
}
```

## 5) Low Stock Threshold Logic

| Condition | Status | Bar Owner Action |
|-----------|--------|------------------|
| `stock_qty <= 0` | `critical` | Item essentially out of stock |
| `stock_qty < reorder_level` | `low` | Reorder soon |
| `stock_qty >= reorder_level` | `normal` | No action needed |

The `reorder_level` is set per item by the bar owner. Dashboard highlights `critical` and `low` items.

## 6) Manual Stock Management

Bar owner can also manually adjust stock:

- **PATCH /owner/inventory/:id** — update `stock_qty`, `reorder_level`, `cost_price`
- **POST /owner/sales** — record a manual POS sale (deducts stock + inserts into `sales` table)

Both endpoints auto-calculate `stock_status` after every change.
