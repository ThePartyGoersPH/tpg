# Payment Reservation System Context

## Overview

This document explains the payment configuration system for online reservation payments in the Platform Bar System. Bar owners can configure payment options that customers will use when making reservations.

## Database Schema

### Bars Table - Payment Configuration Fields

```sql
accept_cash_payment TINYINT(1) NOT NULL DEFAULT 1
accept_online_payment TINYINT(1) NOT NULL DEFAULT 0  
accept_gcash TINYINT(1) NOT NULL DEFAULT 0
minimum_reservation_deposit DECIMAL(10,2) NOT NULL DEFAULT 0.00
```

**Field Descriptions:**
- `accept_cash_payment`: Whether bar accepts cash payments (1 = enabled, 0 = disabled)
- `accept_online_payment`: Whether bar accepts any online payments (automatically set when GCash is enabled)
- `accept_gcash`: Whether bar accepts GCash payments specifically
- `minimum_reservation_deposit`: Minimum deposit amount required for online reservations

### Reservations Table - Payment Tracking Fields

```sql
payment_status ENUM('pending', 'paid', 'refunded', 'failed') NULL DEFAULT NULL
payment_method ENUM('cash', 'gcash', 'other') NULL DEFAULT NULL
deposit_amount DECIMAL(10,2) NULL DEFAULT NULL
payment_reference VARCHAR(255) NULL DEFAULT NULL
paid_at TIMESTAMP NULL DEFAULT NULL
```

**Field Descriptions:**
- `payment_status`: Current payment status of the reservation
- `payment_method`: Payment method used (cash, gcash, other)
- `deposit_amount`: Amount paid as deposit
- `payment_reference`: Transaction ID or reference number
- `paid_at`: Timestamp when payment was completed

## Backend API Endpoints

### Get Bar Details (includes payment config)
```
GET /owner/bar/details
Authorization: Bearer <token>
```

**Response includes payment fields:**
```json
{
  "success": true,
  "data": {
    "id": 11,
    "name": "Juan Bar",
    "accept_cash_payment": 1,
    "accept_online_payment": 0,
    "accept_gcash": 0,
    "minimum_reservation_deposit": 500.00,
    // ... other bar fields
  }
}
```

### Update Bar Details (includes payment config)
```
PATCH /owner/bar/details
Authorization: Bearer <token>
Content-Type: application/json
```

**Request body can include payment fields:**
```json
{
  "accept_cash_payment": 1,
  "accept_online_payment": 1,
  "accept_gcash": 1,
  "minimum_reservation_deposit": 500.00
}
```

### Get Public Bar Details (for customers)
```
GET /public/bars/:id
```

**Response includes payment configuration for customers:**
```json
{
  "success": true,
  "data": {
    "id": 11,
    "name": "Juan Bar",
    "accept_cash_payment": 1,
    "accept_online_payment": 1,
    "accept_gcash": 1,
    "minimum_reservation_deposit": 500.00,
    // ... other public bar fields
  }
}
```

## Bar Owner Configuration Behavior

### Payment Options Logic

1. **Cash Payment**: Can be enabled/disabled independently
2. **GCash Online Payment**: 
   - When enabled, automatically enables `accept_online_payment`
   - When disabled, may disable `accept_online_payment` if no other online methods exist
3. **Minimum Deposit**: 
   - Only applies to online payments
   - Must be ≥ 0
   - Used as required deposit amount for online reservations

### Customer Policy Message

When online payment is enabled, the system displays:
> "Reservation deposits are non-refundable. Once payment is completed, cancellation is no longer allowed."

This message is shown to customers before they proceed with payment.

## Reservation Deposit Logic

### For Customers Making Reservations

1. **Check Payment Options**: 
   - Read bar's payment configuration from `/public/bars/:id`
   - If `accept_online_payment = 0`, hide online payment options
   - If `accept_cash_payment = 1`, show "Pay on arrival" option

2. **Online Payment Flow**:
   - Require deposit amount = `minimum_reservation_deposit`
   - Show GCash payment option if `accept_gcash = 1`
   - Display policy message before payment
   - After successful payment: set `payment_status = 'paid'`

3. **Cash Payment Flow**:
   - No deposit required
   - Set `payment_method = 'cash'`, `payment_status = 'pending'`
   - Customer pays upon arrival

### Payment Status Transitions

```
pending → paid (after successful online payment)
pending → cash (when customer pays on arrival)
paid → refunded (admin initiated refund)
failed → pending (retry payment)
```

### Cancellation Rules

- **Unpaid reservations**: Can be cancelled anytime
- **Paid reservations**: Cannot be cancelled (non-refundable policy)
- **Cash reservations**: Can be cancelled before arrival (no deposit taken)

## Expected API Responses

### Success Response
```json
{
  "success": true,
  "message": "Reservation created successfully",
  "data": {
    "reservation_id": 123,
    "payment_required": true,
    "deposit_amount": 500.00,
    "payment_methods": ["gcash"],
    "policy_message": "Reservation deposits are non-refundable..."
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Online payments are not available for this bar"
}
```

## Integration Points

### PayMongo GCash Integration

When implementing GCash payments:

1. Create PayMongo checkout session with deposit amount
2. Include reservation ID in metadata
3. Handle webhook notifications for payment status
4. Update reservation `payment_status` based on webhook

### Webhook Handling

Expected PayMongo webhook payload:
```json
{
  "data": {
    "id": "pay_xxx",
    "attributes": {
      "status": "paid",
      "amount": 50000,
      "metadata": {
        "reservation_id": "123"
      }
    }
  }
}
```

Update reservation based on webhook:
- `paid`: Set `payment_status = 'paid'`, `paid_at = NOW()`
- `failed`: Set `payment_status = 'failed'`
- `paid` but reservation cancelled: Set `payment_status = 'refunded'`

## Security Considerations

1. **Payment Amount Validation**: Server must validate deposit amount matches bar's configuration
2. **Webhook Verification**: Verify PayMongo webhook signatures
3. **Idempotency**: Handle duplicate webhook notifications gracefully
4. **Audit Trail**: Log all payment status changes with user context

## Testing Scenarios

1. **Bar with online payments disabled**: Only cash option shown
2. **Bar with GCash enabled**: Show deposit amount and GCash option
3. **Payment failure**: Allow retry with same reservation
4. **Paid reservation cancellation**: Show error message about non-refundable policy
5. **Partial payment**: Handle edge cases where payment amount doesn't match required deposit

---

## Customer App Implementation Prompt

**Copy and use this prompt when implementing the payment feature in the Customer App:**

---

You are implementing **Online Reservation Payments** for the Customer App of the Platform Bar System.

**CONTEXT:**
- Bar owners can configure payment options (cash, GCash) and minimum deposit amounts
- Payment configuration is stored in the `bars` table with fields: `accept_cash_payment`, `accept_online_payment`, `accept_gcash`, `minimum_reservation_deposit`
- Reservations track payment status in: `payment_status`, `payment_method`, `deposit_amount`, `payment_reference`, `paid_at`
- Policy: "Reservation deposits are non-refundable. Once payment is completed, cancellation is no longer allowed."

**IMPLEMENTATION REQUIREMENTS:**

1. **Read Payment Settings:**
   - Call `GET /public/bars/:id` to get bar's payment configuration
   - Parse `accept_cash_payment`, `accept_gcash`, `minimum_reservation_deposit` fields
   - Store payment config in state for the reservation flow

2. **Display Payment Methods Dynamically:**
   - If `accept_cash_payment = 1`: Show "Pay on Arrival" option
   - If `accept_gcash = 1`: Show "Pay with GCash" option with deposit amount
   - If both disabled: Show "This bar doesn't accept online payments"
   - Display deposit amount prominently: "Minimum Deposit: ₱500"

3. **Payment Flow Implementation:**
   - **Cash Payment**: Create reservation with `payment_method = 'cash'`, `payment_status = 'pending'`
   - **GCash Payment**: 
     - Show deposit amount and policy message before payment
     - Create reservation first, then initiate PayMongo payment
     - Pass reservation ID in PayMongo metadata
     - Update reservation with payment reference after success

4. **Integrate PayMongo GCash:**
   - Use PayMongo SDK for checkout creation
   - Create checkout with: amount (deposit in cents), currency = PHP, metadata = {reservation_id}
   - Handle payment success/failure appropriately
   - Store PayMongo source ID as `payment_reference`

5. **Enforce Cancellation Rules:**
   - Check `payment_status` before allowing cancellation
   - If `payment_status = 'paid'`: Show error "Cannot cancel paid reservation (non-refundable)"
   - If `payment_status = 'pending'` or `null`: Allow cancellation
   - Show policy message prominently during payment flow

6. **UI/UX Requirements:**
   - Show payment options as radio buttons or cards
   - Display policy message in amber/yellow warning box
   - Show loading states during payment processing
   - Handle payment errors gracefully with retry options
   - Update UI based on payment status changes

7. **Error Handling:**
   - PayMongo API failures: Allow retry
   - Network errors: Queue payment for retry
   - Invalid amounts: Show validation error
   - Payment timeout: Mark as failed, allow retry

**API ENDPOINTS TO USE:**
- `GET /public/bars/:id` - Get bar payment configuration
- `POST /reservations` - Create reservation (include payment_method if known)
- `PATCH /reservations/:id/payment` - Update payment info after success
- PayMongo Checkout API for GCash integration

**SUCCESS CRITERIA:**
- Customers see only enabled payment methods
- Deposit amount is correctly calculated and displayed
- GCash payments integrate with PayMongo successfully
- Paid reservations cannot be cancelled
- Policy message is shown before payment
- Payment status updates correctly in database

**TEST CASES TO IMPLEMENT:**
1. Bar with only cash payments
2. Bar with GCash enabled (show deposit)
3. Bar with both payment methods
4. Successful GCash payment flow
5. Failed GCash payment with retry
6. Attempt to cancel paid reservation (should fail)
7. Cancel unpaid reservation (should succeed)

---
