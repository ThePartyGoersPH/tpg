---
description: Date/time reservation system, duplicate prevention, availability API
---

# Reservation Availability Context (Platform Bar System)

## 1) Table Schema

### `reservations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | Auto-increment |
| `transaction_number` | VARCHAR(50) UNIQUE | Format: `RES-YYYYMMDD-XXXXXX` |
| `bar_id` | INT | FK to `bars.id` |
| `table_id` | INT | FK to `bar_tables.id` |
| `customer_user_id` | INT | FK to `users.id` |
| `reservation_date` | DATE | **Required** — the date of the reservation |
| `reservation_time` | TIME | **Required** — normalized to on-the-hour (`HH:00:00`) |
| `party_size` | INT | Number of guests |
| `status` | ENUM | `'pending'`, `'approved'`, `'confirmed'`, `'cancelled'`, `'completed'` |
| `payment_status` | ENUM | `'pending'`, `'paid'`, `'failed'` |
| `notes` | TEXT | Customer notes / order summary |
| `paid_at` | TIMESTAMP | When payment was confirmed |
| `created_at` | TIMESTAMP | Row creation time |

### Unique Constraint (Migration: `20260322_reservation_unique_slot.sql`)

```sql
ALTER TABLE reservations
  ADD UNIQUE KEY unique_table_slot (table_id, reservation_date, reservation_time);
```

This ensures no two reservations can exist for the same table + date + time at the database level.

## 2) How Duplicate Prevention Works

### Layer 1: Backend Check (1-hour window)
Before inserting, the backend checks:
```sql
SELECT id FROM reservations
WHERE bar_id = ? AND table_id = ? AND reservation_date = ?
  AND status IN ('pending','approved','paid')
  AND ABS(TIME_TO_SEC(TIMEDIFF(reservation_time, ?))) < 3600
LIMIT 1
```
If a conflict exists → `409 Conflict`: "This table is already reserved within the same time slot."

### Layer 2: Database Unique Constraint
Even if the app-level check is bypassed (race condition), the DB constraint prevents exact duplicates.

### Layer 3: Available Tables Filtering
The `GET /public/bars/:id/available-tables` endpoint excludes tables that are already reserved:
```sql
WHERE t.id NOT IN (
  SELECT r.table_id FROM reservations r
  WHERE r.bar_id = ? AND r.reservation_date = ? AND r.reservation_time = ?
    AND r.status IN ('pending','approved','paid')
)
```

## 3) Availability Endpoint

### GET /public/bars/:id/available-tables?date=YYYY-MM-DD&time=HH:00&party_size=N

**Query Params:**
- `date` (required) — reservation date
- `time` (required) — on-the-hour time slot (e.g., `20:00`)
- `party_size` (optional) — filters tables with sufficient capacity

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "bar_id": 1,
      "table_number": "VIP3",
      "capacity": 6,
      "is_active": 1,
      "manual_status": "available",
      "image_path": "uploads/tables/vip3.jpg",
      "price": 500.00
    }
  ],
  "available_hours": ["18:00", "19:00", "20:00", "21:00", "22:00", "23:00"]
}
```

**Behavior:**
- Returns only active tables that are NOT reserved for the selected date+time
- `available_hours` lists all valid hourly slots for that bar on the selected day (based on bar operating hours)
- Times in the past are excluded
- If bar is closed on selected day → empty array with message

## 4) How Bar Owner Fetches Today's Reservations per Table

### GET /owner/bar/tables/status?date=YYYY-MM-DD
Returns all tables with their current reservation status for the given date.

Each table includes reservation info showing which slots are booked.

### GET /owner/bar/reservations?date=YYYY-MM-DD&status=all
Returns all reservations for the bar on the specified date.

## 5) Customer Booking Flow

1. Customer selects a date → frontend calls `GET /public/bars/:id/available-tables?date=2026-03-24&time=20:00`
2. Available tables are shown; unavailable ones are hidden
3. Customer selects table, time, party size, and optional menu items
4. Frontend calls `POST /reservations` with `{ bar_id, table_id, reservation_date, reservation_time, party_size, menu_items }`
5. Backend validates: bar hours, table capacity, conflict check, ban check
6. Reservation created with `transaction_number`
7. Customer proceeds to payment via `POST /payments/create`

## 6) Migration for Existing Duplicates

The migration `20260322_reservation_unique_slot.sql` handles existing duplicates by:
1. Auto-cancelling duplicate reservations (keeping the earliest one per slot)
2. Adding the unique constraint after cleanup
