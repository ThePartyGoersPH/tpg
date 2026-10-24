---
description: Live sales data flow from customer payment to bar owner dashboard
---

# Sales Live Context (Platform Bar System)

## 1) What Triggers a Sale Record

A sale record is created when a **customer payment is confirmed** via PayMongo (GCash, PayMaya, or card).

**Flow:**
1. Customer creates a reservation with menu items on the customer web
2. Customer initiates payment → `POST /payments/create` creates a `payment_transactions` row with `status = 'pending'`
3. Customer completes payment on PayMongo checkout
4. Payment is confirmed via `POST /payments/:reference_id/confirm` or webhook
5. `markPaymentSuccess()` in `routes/payments.js` runs:
   - Updates `payment_transactions.status = 'paid'`, sets `paid_at = NOW()`
   - Updates `reservations.payment_status = 'paid'`, `status = 'confirmed'`
   - Deducts inventory for ordered items (see `inventory_deduction_context.md`)
   - Creates a payout record in `payouts` table (platform fee deducted)

## 2) Table: `payment_transactions`

This is the **primary source of truth** for all customer payments.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | Auto-increment |
| `reference_id` | VARCHAR | Unique PayMongo reference (e.g., `RES-20260322-XXXXXX`) |
| `payment_type` | ENUM | `'reservation'` or `'order'` |
| `related_id` | INT | FK to `reservations.id` or `pos_orders.id` |
| `bar_id` | INT | FK to `bars.id` — **key field for bar owner queries** |
| `user_id` | INT | FK to `users.id` (customer who paid) |
| `amount` | DECIMAL(10,2) | Total amount paid |
| `status` | ENUM | `'pending'`, `'paid'`, `'failed'` |
| `payment_method` | VARCHAR | `'gcash'`, `'paymaya'`, `'card'` |
| `paid_at` | TIMESTAMP | When payment was confirmed |
| `created_at` | TIMESTAMP | When payment was initiated |

## 3) API Endpoints for Bar Owner

### GET /owner/bar/sales/today
Returns today's paid transactions and revenue for the authenticated bar owner's bar.

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_transactions": 5,
      "total_revenue": 4500.00,
      "reservation_revenue": 3200.00,
      "paid_reservations": 3,
      "order_revenue": 1300.00,
      "paid_orders": 2
    },
    "recent_transactions": [
      {
        "id": 42,
        "reference_id": "RES-20260322-ABC123",
        "payment_type": "reservation",
        "amount": 1200.00,
        "payment_method": "gcash",
        "paid_at": "2026-03-22T14:30:00Z",
        "customer_name": "Juan Dela Cruz",
        "transaction_number": "RES-20260322-YDQBEH",
        "reservation_date": "2026-03-24",
        "reservation_time": "20:00:00"
      }
    ]
  }
}
```

### GET /owner/bar/sales/summary
Returns weekly and monthly revenue breakdown with 30-day daily chart data.

**Response:**
```json
{
  "success": true,
  "data": {
    "this_week": {
      "total_transactions": 15,
      "total_revenue": 18500.00,
      "reservation_revenue": 12000.00,
      "paid_reservations": 10
    },
    "this_month": {
      "total_transactions": 42,
      "total_revenue": 56000.00,
      "reservation_revenue": 38000.00,
      "paid_reservations": 28
    },
    "daily_breakdown": [
      { "date": "2026-03-22", "transactions": 5, "revenue": 4500.00 },
      { "date": "2026-03-21", "transactions": 3, "revenue": 2800.00 }
    ]
  }
}
```

### GET /owner/bar/dashboard/summary
The consolidated dashboard endpoint now includes payment revenue fields:

| Field | Description |
|-------|-------------|
| `today_revenue` | POS sales + customer payments combined |
| `today_pos_revenue` | Revenue from manual POS sales only |
| `today_payment_revenue` | Revenue from customer online payments |
| `today_paid_reservations` | Count of paid reservations today |
| `today_reservation_revenue` | Revenue from reservations only |

## 4) How Bar Owner Dashboard Should Consume This

1. On dashboard load, call `GET /owner/bar/dashboard/summary` for the overview cards
2. For a detailed sales view, call `GET /owner/bar/sales/today` for today's breakdown + recent transactions
3. For weekly/monthly charts, call `GET /owner/bar/sales/summary` and use `daily_breakdown` for line charts

## 5) Payout Flow

When a payment is confirmed:
1. Platform fee (default 5%) is calculated from `platform_settings.platform_fee_percentage`
2. A `payouts` record is created with `net_amount = gross_amount - platform_fee_amount`
3. Payout status starts as `'pending'` and is processed by Super Admin via payout management endpoints
