---
description: Reference number system, full transaction detail API
---

# Transaction Reference Context (Platform Bar System)

## 1) Reference Number Format and Generation

### Reservation Transaction Number
- **Format:** `RES-YYYYMMDD-XXXXXX` (6 random alphanumeric chars)
- **Column:** `reservations.transaction_number` (VARCHAR, UNIQUE)
- **Generated at:** reservation creation time in `POST /reservations`
- **Example:** `RES-20260322-YDQBEH`

### Payment Reference ID
- **Format:** `RES-<timestamp>-<random>` or `ORD-<timestamp>-<random>`
- **Column:** `payment_transactions.reference_id` (VARCHAR, UNIQUE)
- **Generated at:** payment creation time in `POST /payments/create`
- **Used for:** PayMongo tracking and payment confirmation

Both numbers are unique and searchable. The reservation `transaction_number` is the primary customer-facing reference.

## 2) Search Endpoint

### GET /reservations/lookup/:txn
**Auth:** Bar Owner (Bearer token)
**Purpose:** Search by transaction number and return full reservation + order + payment details.

**Example:** `GET /reservations/lookup/RES-20260322-YDQBEH`

### Full Response Shape:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "transaction_number": "RES-20260322-YDQBEH",
    "bar_id": 1,
    "bar_name": "Juan Bar",
    "table_id": 5,
    "table_number": "VIP3",
    "capacity": 6,
    "customer_user_id": 38,
    "first_name": "Juan",
    "last_name": "Dela Cruz",
    "email": "juan@email.com",
    "phone_number": "09XX-XXX-XXXX",
    "reservation_date": "2026-03-24",
    "reservation_time": "20:00:00",
    "party_size": 2,
    "occasion": null,
    "notes": "Order: Bucket Beer x2, Nachos x1",
    "status": "confirmed",
    "payment_status": "paid",
    "created_at": "2026-03-22T06:30:00Z",
    "items": [
      {
        "menu_item_id": 10,
        "menu_name": "Bucket Beer",
        "quantity": 2,
        "unit_price": 350.00,
        "line_total": 700.00
      },
      {
        "menu_item_id": 15,
        "menu_name": "Nachos",
        "quantity": 1,
        "unit_price": 180.00,
        "line_total": 180.00
      }
    ],
    "total_amount": 880.00,
    "payment": {
      "payment_id": 99,
      "reference_id": "RES-1711100000-AB12",
      "amount": 880.00,
      "status": "paid",
      "payment_method": "gcash",
      "paid_at": "2026-03-22T14:30:00Z"
    }
  }
}
```

### Fields Breakdown

| Section | Fields | Source |
|---------|--------|--------|
| **Reservation** | `transaction_number`, `reservation_date`, `reservation_time`, `party_size`, `status`, `payment_status` | `reservations` table |
| **Customer** | `first_name`, `last_name`, `email`, `phone_number` | `users` table via `customer_user_id` |
| **Table** | `table_number`, `capacity` | `bar_tables` table |
| **Items Ordered** | `menu_name`, `quantity`, `unit_price`, `line_total` | `reservation_items` + `menu_items` |
| **Payment** | `reference_id`, `amount`, `status`, `payment_method`, `paid_at` | `payment_transactions` table |

### Access Control
- Only the bar owner whose bar owns the reservation can access this endpoint
- Query checks `r.bar_id IN (SELECT bar_id FROM bar_owners WHERE user_id = ?)`

## 3) How Bar Owner UI Should Render the Transaction Detail View

### Search Bar
- Text input accepting transaction number (e.g., `RES-20260322-YDQBEH`)
- Calls `GET /reservations/lookup/:txn` on submit
- Shows 404 message if not found

### Detail Card Layout
```
┌──────────────────────────────────────────┐
│ #RES-20260322-YDQBEH          ✅ Confirmed │
│                                          │
│ Customer: Juan Dela Cruz                 │
│ Contact:  09XX-XXX-XXXX                  │
│ Email:    juan@email.com                 │
│                                          │
│ Table:    VIP3 (cap: 6)                  │
│ Date:     Mar 24, 2026                   │
│ Time:     8:00 PM                        │
│ Party:    2 guests                       │
│                                          │
│ ─── Items Ordered ───────────────────── │
│ Bucket Beer        x2     ₱700.00       │
│ Nachos             x1     ₱180.00       │
│                    Total: ₱880.00       │
│                                          │
│ ─── Payment ─────────────────────────── │
│ Method:  GCash                           │
│ Amount:  ₱880.00                         │
│ Status:  Paid ✅                         │
│ Paid at: Mar 22, 2026 10:30 PM          │
│ Ref:     RES-1711100000-AB12            │
└──────────────────────────────────────────┘
```

## 4) Other Transaction Search Points

### Customer Side
- `GET /reservations/my` — customer sees their own reservations with `transaction_number`
- `GET /payments/my/history` — customer sees payment history with `reference_id` and `transaction_number`

### Super Admin Side
- `GET /super-admin-payments/transactions?search=RES-20260322` — search across all transactions
- `GET /super-admin/reservations/:id` — full reservation detail with items
