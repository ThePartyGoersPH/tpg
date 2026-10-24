# Payout System Context (Super Admin Website)

## 1) Full Flow: Customer -> Payment -> Platform -> Bar Owner

1. Customer initiates payment (`/payments/create`) for reservation/order.
2. Payment transaction is created in `payment_transactions` with `status='pending'`.
3. PayMongo success is resolved via:
   - webhook: `/webhook/paymongo`
   - confirmation endpoint: `/payments/:reference_id/confirm`
4. On success, system marks:
   - `payment_transactions.status = 'paid'`
   - related order/reservation status = `paid`
5. Platform computes fees and creates a `payouts` row (money remains under platform control first).
6. Super Admin marks payout:
   - `pending` -> `sent` (when transfer is initiated)
   - `sent` -> `completed` (when transfer is confirmed)
7. Bar owner can view payout history/summary through owner-facing payout endpoints.

---

## 2) Data Structures and Relationships

### `payment_transactions`
Core payment ledger for customer-to-platform collection.

Important fields:
- `id`
- `reference_id`
- `payment_type` (`order` | `reservation` | `subscription`)
- `related_id` (points to order/reservation/subscription)
- `bar_id`
- `user_id`
- `amount`
- `status` (`pending`, `processing`, `paid`, `failed`, ...)
- `payment_method`
- `paymongo_source_id`, `paymongo_payment_id`, `paymongo_payment_intent_id`
- `paid_at`, `failed_reason`

### `payouts`
Platform-to-bar-owner disbursement ledger.

Important fields:
- `id`
- `bar_id`
- `bar_owner_id`
- `payment_transaction_id`
- `order_id`
- `reservation_id`
- `gross_amount`
- `platform_fee` (percentage)
- `platform_fee_amount`
- `net_amount`
- `status` (`pending`, `sent`, `completed`, `processing`, `failed`, `cancelled`)
- `payout_reference`
- `gcash_number`
- `gcash_account_name`
- `processed_at`

### Relationships
- `payment_transactions.id` -> `payouts.payment_transaction_id`
- `payment_transactions.related_id` -> `pos_orders.id` or `reservations.id` depending on `payment_type`
- `payment_transactions.bar_id` -> `bars.id`
- `bars.owner_id` -> `bar_owners.id`
- `bar_owners.user_id` -> `users.id`

---

## 3) Required Financial Fields for Super Admin UI

Use these values directly from payouts/payment records:
- `total_amount`: `payment_transactions.amount` (or `payouts.gross_amount`)
- `platform_fee`: `payouts.platform_fee_amount` (percentage in `payouts.platform_fee`)
- `net_payout`: `payouts.net_amount`
- `payout_status`: `payouts.status` (`pending`, `sent`, `completed`)

---

## 4) Bar Owner Payout Details

Source table: `bars`
- `gcash_number`
- `gcash_account_name`

These fields are copied into `payouts` at payout creation time to preserve historical payout destination details.

---

## 5) API Endpoints

### Payment
- `POST /payments/create` -> create payment transaction + PayMongo checkout/session
- `POST /payments/:reference_id/confirm` -> confirm pending payment from PayMongo
- `GET /payments/my/history` -> customer payment history with line-item details

### Webhook
- `POST /webhook/paymongo` -> async payment status updates from PayMongo

### Payout generation
- Auto-generated after successful payment in webhook/confirm flow
- Implemented in backend payout creation helpers (idempotent by `payment_transaction_id`)

### Payout listing/monitoring
- `GET /super-admin-payments/payouts`
- `GET /super-admin-payments/transactions`
- `GET /super-admin-payments/transactions/:id`
- `GET /payouts/admin/all`
- `GET /payouts/my`
- `GET /payouts/my/summary`

### Payout status update
- Mark as sent:
  - `POST /super-admin-payments/payouts/:id/mark-sent`
  - `POST /super-admin-payments/payouts/bulk-mark-sent`
  - `POST /payouts/admin/process/:id`
  - `POST /payouts/admin/bulk-process`
- Mark as completed:
  - `POST /super-admin-payments/payouts/:id/complete`
  - `POST /payouts/admin/complete/:id`

---

## 6) Status Lifecycle

### Payment lifecycle
- `pending` -> `paid` (on PayMongo success)
- `pending` -> `failed` / `expired` (on failure)

### Payout lifecycle
- `pending` -> `sent` -> `completed`
- Legacy `processing` is still accepted for backward compatibility

---

## 7) Super Admin Integration Notes

1. Monitoring dashboard
   - Use `/super-admin-payments/dashboard` for high-level totals.
   - Use `/super-admin-payments/transactions` for payment-level tracing.

2. Payout operations
   - Use `/super-admin-payments/payouts` for payout queue.
   - Trigger transfer action with `mark-sent` endpoint.
   - Confirm transfer completion with `complete` endpoint.

3. Financial display
   - Show `gross_amount`, `platform_fee_amount`, `net_amount` per payout.
   - Aggregate pending/sent/completed buckets for operational visibility.

4. Data trust
   - Treat `payment_transactions` as source-of-truth for customer payments.
   - Treat `payouts` as source-of-truth for owner disbursement state.
