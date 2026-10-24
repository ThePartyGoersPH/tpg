# Payout Notification Context

## Overview
When the super admin marks a payout as **sent** or **completed**, the bar owner receives an
in-app notification automatically. This is already implemented in `routes/superAdminPayments.js`.

---

## What is Already Implemented (Bar Owner Manager App)

### Endpoints that trigger notifications
Both endpoints in `thesis-backend/routes/superAdminPayments.js` now insert a notification row
after a successful status change:

| Endpoint | Status Change | Notification Title |
|---|---|---|
| `POST /super-admin-payments/payouts/:id/mark-sent` | `pending/processing → sent` | **Payout Sent** |
| `POST /super-admin-payments/payouts/:id/complete` | `sent → completed` | **Payout Completed** |

### Notification inserted
```sql
INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read)
VALUES (
  <bar_owner_user_id>,   -- from bar_owners.user_id WHERE bar_owners.id = payout.bar_owner_id
  'payout',
  'Payout Sent',         -- or 'Payout Completed'
  'Your payout of ₱X,XXX.XX has been sent via GCash (Ref: XXXXX).',
  <payout_id>,
  'payout',
  0
)
```

### How bar_owner user_id is resolved
```sql
SELECT bo.user_id FROM bar_owners bo WHERE bo.id = payout.bar_owner_id LIMIT 1
```

---

## Notifications Table Schema
```sql
CREATE TABLE notifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,             -- recipient
  type          VARCHAR(50) NOT NULL,     -- 'payout', 'reservation', 'system', etc.
  title         VARCHAR(255),
  message       TEXT,
  link          VARCHAR(500),             -- optional URL
  reference_id  INT,                      -- payout.id
  reference_type VARCHAR(50),             -- 'payout'
  is_read       TINYINT(1) DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

---

## Super Admin Frontend Implementation Guide

### 1. Existing endpoints to call
```
POST /super-admin-payments/payouts/:id/mark-sent
Body: { payout_reference: "REF123", notes: "optional note" }

POST /super-admin-payments/payouts/:id/complete
Body: {} (no body required)
```

### 2. No migration needed
The `notifications` table already exists. No schema changes are required.

### 3. Recommended Super Admin UI flow
1. Super admin views a payout with status `pending` or `processing`
2. Fills in GCash reference number + optional notes
3. Clicks **Mark as Sent** → calls `POST /payouts/:id/mark-sent`
4. Bar owner instantly receives notification: *"Your payout of ₱X has been sent via GCash (Ref: XXXXX)"*
5. Super admin later clicks **Complete** → calls `POST /payouts/:id/complete`
6. Bar owner receives notification: *"Your payout of ₱X has been completed and confirmed"*

### 4. Payout status lifecycle
```
pending → processing → sent → completed
                     ↘ failed / cancelled
```

### 5. Fetching payouts for super admin dashboard
```
GET /super-admin-payments/payouts?status=pending&bar_id=X&from=YYYY-MM-DD&to=YYYY-MM-DD&search=keyword
```
Returns: `{ payouts: [...], summary: { pending_amount, sent_amount, completed_amount } }`

### 6. Key payout fields returned
| Field | Description |
|---|---|
| `id` | Payout ID |
| `bar_name` | Bar name |
| `owner_name` | Bar owner full name |
| `owner_email` | Bar owner email |
| `gross_amount` | Total payment before fees |
| `platform_fee` | Fee percentage |
| `platform_fee_amount` | Fee in pesos |
| `net_amount` | Amount to send to bar |
| `status` | pending / processing / sent / completed / failed / cancelled |
| `payout_method` | gcash / bank_transfer |
| `gcash_number` | Destination GCash number |
| `gcash_account_name` | GCash account name |
| `payout_reference` | Reference number after sending |
| `processed_at` | Timestamp when sent/completed |
| `notes` | Admin notes |

---

## Bar Owner Side (already done)
- `GET /owner/financials/payouts` — returns payout list + summary (pending, paid_out, total)
- Financials page has a **Payouts tab** showing:
  - **Pending Payout** card (amber) — sum of pending + processing
  - **Paid Out** card (green) — sum of sent + completed
  - **Total** card (blue)
  - Records table with all payout details
- Notification appears in the bar owner's notification bell when payout is sent or completed
