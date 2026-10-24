# SUPER ADMIN WEB - PAYMENT & PAYOUT SYSTEM CONTEXT

**Last Updated:** March 18, 2026  
**Database:** `tpg`  
**Backend:** Node.js + Express + MySQL  
**Payment Gateway:** PayMongo (GCash, PayMaya, Card)

---

## 🔴 CRITICAL: PAYMENT FLOW (Customer → Platform → Bar Owner)

### Complete Payment Flow

```
CUSTOMER PAYMENT → PLATFORM RECEIVES → PLATFORM FEE DEDUCTION → BAR OWNER PAYOUT
```

#### Step-by-Step Process:

**1. Customer Makes Payment**
- Customer places order/reservation
- Payment is initiated via PayMongo (GCash/PayMaya/Card)
- Amount goes to **Platform's PayMongo account**

**2. Payment Transaction Created**
- Record created in `payment_transactions` table
- Status: `pending` → `processing` → `paid` or `failed`
- PayMongo webhook updates status

**3. Platform Fee Calculation**
- Platform fee percentage stored in `platform_settings.platform_fee_percentage` (default: 5%)
- Formula:
  ```
  Gross Amount = Customer Payment
  Platform Fee Amount = Gross Amount × (Platform Fee % / 100)
  Net Amount = Gross Amount - Platform Fee Amount
  ```

**4. Payout Record Created**
- When payment status = `paid`, system creates `payouts` record
- Payout contains: gross_amount, platform_fee, platform_fee_amount, net_amount
- Status: `pending` (awaiting Super Admin processing)

**5. Super Admin Processes Payout**
- Super Admin views pending payouts
- Super Admin sends money to bar's GCash account manually
- Super Admin marks payout as `completed` with reference number
- Bar owner receives net amount

---

## DATABASE SCHEMA: PAYMENT SYSTEM

### 1. `payment_transactions` — All Customer Payments

```sql
CREATE TABLE `payment_transactions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `reference_id` VARCHAR(100) NOT NULL COMMENT 'Internal reference (PAY-xxx)',
  `payment_type` ENUM('order', 'reservation', 'subscription') NOT NULL,
  `related_id` INT(11) NOT NULL COMMENT 'Order/Reservation/Subscription ID',
  `bar_id` INT(11) NULL COMMENT 'Bar ID (NULL for subscriptions)',
  `user_id` INT(11) NOT NULL COMMENT 'Customer user ID',
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'PHP',
  `status` ENUM('pending', 'processing', 'paid', 'failed', 'refunded', 'expired') NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(50) NULL COMMENT 'gcash, paymaya, card',
  `paymongo_payment_intent_id` VARCHAR(255) NULL,
  `paymongo_payment_id` VARCHAR(255) NULL,
  `paymongo_source_id` VARCHAR(255) NULL,
  `checkout_url` TEXT NULL,
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  `failed_reason` TEXT NULL,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_payment_reference` (`reference_id`)
);
```

**Status Flow:**
- `pending` → Customer initiated payment
- `processing` → PayMongo processing payment
- `paid` → Payment successful ✅
- `failed` → Payment failed ❌
- `refunded` → Payment refunded
- `expired` → Payment link expired

### 2. `payouts` — Bar Owner Payouts

```sql
CREATE TABLE `payouts` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `payment_transaction_id` INT(11) NULL,
  `order_id` INT(11) NULL,
  `reservation_id` INT(11) NULL,
  `gross_amount` DECIMAL(10,2) NOT NULL COMMENT 'Total payment from customer',
  `platform_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Fee percentage',
  `platform_fee_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Actual fee deducted',
  `net_amount` DECIMAL(10,2) NOT NULL COMMENT 'Amount bar receives',
  `status` ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  `payout_method` VARCHAR(50) NULL COMMENT 'gcash, bank_transfer',
  `payout_reference` VARCHAR(255) NULL COMMENT 'GCash reference number',
  `gcash_number` VARCHAR(20) NULL,
  `gcash_account_name` VARCHAR(255) NULL,
  `processed_at` TIMESTAMP NULL DEFAULT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```

**Status Flow:**
- `pending` → Awaiting Super Admin processing
- `processing` → Super Admin processing payout
- `completed` → Payout sent to bar ✅
- `failed` → Payout failed ❌
- `cancelled` → Payout cancelled

### 3. `platform_settings` — System Configuration

```sql
CREATE TABLE `platform_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `description` TEXT NULL,
  `updated_by` INT(11) NULL COMMENT 'Super Admin user ID',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_setting_key` (`setting_key`)
);

-- Default Settings
INSERT INTO `platform_settings` (`setting_key`, `setting_value`, `description`) VALUES
  ('platform_fee_percentage', '5.00', 'Platform fee percentage for customer payments'),
  ('payments_enabled', '1', 'Enable/disable global payment processing'),
  ('paymongo_public_key', '', 'PayMongo public API key'),
  ('paymongo_secret_key', '', 'PayMongo secret API key'),
  ('paymongo_webhook_secret', '', 'PayMongo webhook signing secret');
```

### 4. `bars` — Bar Payout Configuration

**Key Columns:**
- `gcash_number` VARCHAR(20) — GCash mobile number for payouts
- `gcash_account_name` VARCHAR(255) — Registered GCash account name
- `payout_enabled` TINYINT(1) DEFAULT 1 — Enable/disable payouts for this bar

---

## BACKEND API ENDPOINTS: SUPER ADMIN PAYMENTS

**Base URL:** `http://localhost:3000`  
**Authentication:** Bearer JWT Token (Super Admin role required)

### 1. Global Payment Dashboard

**`GET /super-admin-payments/dashboard`**

**Query Parameters:**
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "revenue": {
      "total_transactions": 150,
      "total_revenue": 125000.00,
      "paid_revenue": 120000.00,
      "pending_revenue": 3000.00,
      "failed_revenue": 2000.00
    },
    "payouts": {
      "total_payouts": 80,
      "total_gross_amount": 120000.00,
      "total_platform_fees": 6000.00,
      "total_net_amount": 114000.00,
      "pending_payouts": 15000.00,
      "completed_payouts": 99000.00
    },
    "platform_earnings": 6000.00,
    "platform_fee_percentage": 5.00,
    "payment_methods": [
      { "payment_method": "gcash", "count": 120, "total_amount": 100000.00 }
    ],
    "recent_transactions": [...]
  }
}
```

### 2. Transaction Monitoring

**`GET /super-admin-payments/transactions`**

**Query Parameters:**
- `status`: paid, pending, failed, refunded, expired
- `payment_type`: order, reservation, subscription
- `bar_id`: Filter by specific bar
- `from`, `to`: Date range
- `search`: Search reference, bar name, customer
- `limit`: Number of results (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": 150,
        "reference_id": "PAY-1234567890",
        "payment_type": "order",
        "related_id": 45,
        "amount": 1500.00,
        "status": "paid",
        "payment_method": "gcash",
        "bar_id": 1,
        "bar_name": "The Craft Bar",
        "customer_name": "John Doe",
        "customer_email": "john@email.com",
        "order_number": "ORD-2024-0045",
        "created_at": "2024-03-18T10:30:00.000Z",
        "paid_at": "2024-03-18T10:31:00.000Z"
      }
    ],
    "summary": {
      "total_count": 150,
      "total_amount": 125000.00,
      "paid_amount": 120000.00,
      "pending_amount": 3000.00,
      "failed_amount": 2000.00
    }
  }
}
```

**`GET /super-admin-payments/transactions/:id`** — Get transaction details

### 3. Payout Management

**`GET /super-admin-payments/payouts`**

**Query Parameters:**
- `status`: pending, processing, completed, failed
- `bar_id`: Filter by bar
- `from`, `to`: Date range
- `search`: Search bar name, GCash, reference
- `limit`: Number of results (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "payouts": [
      {
        "id": 75,
        "bar_id": 1,
        "payment_transaction_id": 150,
        "gross_amount": 1500.00,
        "platform_fee": 5.00,
        "platform_fee_amount": 75.00,
        "net_amount": 1425.00,
        "status": "pending",
        "gcash_number": "09171234567",
        "gcash_account_name": "The Craft Bar Inc",
        "bar_name": "The Craft Bar",
        "owner_name": "Jane Smith",
        "owner_email": "jane@craftbar.com",
        "payment_reference": "PAY-1234567890",
        "created_at": "2024-03-18T10:31:00.000Z"
      }
    ],
    "summary": {
      "total_count": 80,
      "total_gross": 120000.00,
      "total_fees": 6000.00,
      "total_net": 114000.00,
      "pending_amount": 15000.00,
      "completed_amount": 99000.00
    }
  }
}
```

**`POST /super-admin-payments/payouts/:id/mark-sent`** — Mark single payout as completed

**Request:**
```json
{
  "payout_reference": "GC-987654321",
  "notes": "GCash transfer completed on 2024-03-18"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payout marked as sent successfully"
}
```

**`POST /super-admin-payments/payouts/bulk-mark-sent`** — Mark multiple payouts as completed

**Request:**
```json
{
  "payout_ids": [75, 76, 77],
  "payout_reference": "BATCH-2024-03-18",
  "notes": "Batch GCash transfer"
}
```

### 4. Bar Payment Configuration

**`GET /super-admin-payments/bar-configs`**

**Query Parameters:**
- `search`: Bar name, GCash, owner name
- `status`: Bar status filter
- `limit`: Number of results (default: 100)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "The Craft Bar",
      "gcash_number": "09171234567",
      "gcash_account_name": "The Craft Bar Inc",
      "status": "approved",
      "payout_enabled": 1,
      "owner_name": "Jane Smith",
      "owner_email": "jane@craftbar.com",
      "pending_payouts": 5,
      "pending_amount": 15000.00,
      "total_paid_out": 99000.00
    }
  ]
}
```

**`PUT /super-admin-payments/bar-configs/:barId`** — Update bar payout configuration

**Request:**
```json
{
  "gcash_number": "09181234567",
  "gcash_account_name": "Updated Account Name",
  "payout_enabled": 1
}
```

**`POST /super-admin-payments/bar-configs/:barId/disable-payout`** — Disable payout for suspicious bar

**Request:**
```json
{
  "reason": "Suspicious activity detected - multiple chargebacks"
}
```

### 5. System Settings

**`GET /super-admin-payments/settings`** — Get payment settings

**Response:**
```json
{
  "success": true,
  "data": {
    "platform_fee_percentage": {
      "value": "5.00",
      "description": "Platform fee percentage for customer payments",
      "updated_at": "2024-03-01T00:00:00.000Z"
    },
    "payments_enabled": {
      "value": "1",
      "description": "Enable/disable global payment processing system",
      "updated_at": "2024-03-01T00:00:00.000Z"
    }
  }
}
```

**`PUT /super-admin-payments/settings`** — Update payment settings

**Request:**
```json
{
  "platform_fee_percentage": 7.50,
  "payments_enabled": true
}
```

---

## PAYMONGO INTEGRATION

**Service File:** `thesis-backend/services/paymongoService.js`

### PayMongo Payment Methods

1. **GCash** — E-wallet (most common)
2. **PayMaya** — E-wallet
3. **Card** — Credit/Debit cards

### PayMongo Webhook Events

**Webhook URL:** `POST /webhook/paymongo`

**Events:**
- `payment.paid` — Payment successful
- `payment.failed` — Payment failed
- `source.chargeable` — Source ready to charge

**Webhook Processing:**
- Updates `payment_transactions` status
- Creates `payouts` record when payment is paid
- Logs event in `webhook_events` table

---

## PAYMENT FLOW EXAMPLES

### Example 1: Customer Orders Food (₱1,500)

```
1. Customer places order: ₱1,500
2. Payment goes to Platform PayMongo account
3. payment_transactions created:
   - amount: 1500.00
   - status: pending → paid
4. Platform fee calculation:
   - gross_amount: 1500.00
   - platform_fee: 5%
   - platform_fee_amount: 75.00
   - net_amount: 1425.00
5. payouts record created:
   - bar_id: 1
   - gross_amount: 1500.00
   - platform_fee_amount: 75.00
   - net_amount: 1425.00
   - status: pending
   - gcash_number: 09171234567
6. Super Admin sends ₱1,425 to bar's GCash
7. Super Admin marks payout as completed
```

**Platform Earnings:** ₱75.00  
**Bar Receives:** ₱1,425.00

### Example 2: Customer Books Reservation (₱2,000)

```
Same flow as above:
- Gross: ₱2,000
- Platform Fee (5%): ₱100
- Net to Bar: ₱1,900
```

---

## SUPER ADMIN WORKFLOWS

### Workflow 1: Monitor Daily Revenue

1. Login to Super Admin dashboard
2. View **Payment Dashboard**
3. See total revenue, platform earnings, pending payouts
4. Filter by date range if needed
5. Check payment method breakdown

### Workflow 2: Process Pending Payouts

1. Go to **Payout Management** tab
2. Filter: status = "pending"
3. Review each payout:
   - Bar name
   - GCash details
   - Net amount
4. Send GCash transfer to bar owner
5. Mark payout as sent:
   - Enter GCash reference number
   - Add notes
   - Confirm
6. System updates payout status to "completed"

### Workflow 3: Bulk Payout Processing

1. Go to **Payout Management** tab
2. Select multiple pending payouts (checkboxes)
3. Click "Bulk Mark as Sent"
4. Enter batch reference number
5. Confirm
6. System processes all selected payouts

### Workflow 4: Handle Suspicious Bar

1. Go to **Bar Payment Config** tab
2. Search for bar
3. Review payout history
4. If suspicious:
   - Click "Disable Payout"
   - Enter reason
   - Confirm
5. Bar can no longer receive payouts until re-enabled

### Workflow 5: Adjust Platform Fee

1. Go to **System Settings** tab
2. Change platform fee percentage (e.g., 5% → 7%)
3. Save settings
4. New fee applies to all future payments

### Workflow 6: Emergency Disable Payments

1. Go to **System Settings** tab
2. Toggle "Enable Global Payments" to OFF
3. Confirm action
4. All new payment creation is disabled
5. Existing payments unaffected

---

## KEY POINTS FOR SUPER ADMIN WEBSITE

✅ **Platform receives ALL customer payments first**  
✅ **Platform deducts fee automatically**  
✅ **Super Admin manually sends net amount to bars**  
✅ **GCash is primary payout method**  
✅ **Super Admin can disable payouts per bar**  
✅ **Super Admin controls platform fee percentage**  
✅ **Super Admin can disable all payments (emergency)**  
✅ **All actions are audit logged**  

---

**END OF PART 1: PAYMENT & PAYOUT SYSTEM**

See PART 2 for Subscription System, Branch Management, and Customer Banning.
