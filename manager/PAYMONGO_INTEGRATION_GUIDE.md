# PayMongo Payment Integration Guide

## Overview

This guide covers the complete PayMongo payment integration for the Platform Bar System, including:
- **Customer Payments**: Online payments for orders and reservations via GCash, PayMaya, and Cards
- **Subscription Payments**: Automated subscription payment processing for bar owner plans
- **Branch Restrictions**: Subscription-based limits on branch creation
- **Payout System**: Platform fee calculation and bar owner payouts

---

## Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [Setup Instructions](#setup-instructions)
4. [PayMongo Configuration](#paymongo-configuration)
5. [API Endpoints](#api-endpoints)
6. [Webhook Configuration](#webhook-configuration)
7. [Frontend Integration](#frontend-integration)
8. [Testing](#testing)
9. [Production Deployment](#production-deployment)

---

## Architecture

### Payment Flow Diagram

```
Customer/Owner → Frontend → Backend → PayMongo → Webhook → Database Update
                                          ↓
                                    Checkout URL
                                          ↓
                                    Customer Payment
                                          ↓
                                    Webhook Event
                                          ↓
                               Update Status & Create Payout
```

### Key Components

1. **PayMongo Service** (`services/paymongoService.js`)
   - Handles all PayMongo API interactions
   - Creates payment sources and intents
   - Processes refunds
   - Verifies webhook signatures

2. **Payment Routes** (`routes/payments.js`)
   - Customer payment creation for orders/reservations
   - Payment history and status checking

3. **Subscription Payment Routes** (`routes/subscriptionPayments.js`)
   - Subscription payment creation
   - Renewal payment processing

4. **Webhook Handler** (`routes/paymongoWebhook.js`)
   - Processes payment confirmations
   - Updates subscription status
   - Creates payout records

5. **Payout Routes** (`routes/payouts.js`)
   - Bar owner payout management
   - Admin payout processing

---

## Database Schema

### New Tables Created

#### 1. `payment_transactions`
Unified payment tracking for all payment types.

```sql
- id
- reference_id (unique)
- payment_type (order, reservation, subscription)
- related_id
- bar_id
- user_id
- amount
- status (pending, processing, paid, failed, refunded, expired)
- payment_method (gcash, paymaya, card)
- paymongo_payment_intent_id
- paymongo_payment_id
- paymongo_source_id
- checkout_url
- paid_at
- metadata (JSON)
```

#### 2. `subscription_payments`
Dedicated subscription payment tracking.

```sql
- id
- subscription_id
- payment_transaction_id
- amount
- status
- paymongo_payment_id
- paid_at
```

#### 3. `payouts`
Platform fee calculation and bar owner payouts.

```sql
- id
- bar_id
- payment_transaction_id
- order_id / reservation_id
- gross_amount
- platform_fee (percentage)
- platform_fee_amount
- net_amount
- status (pending, processing, completed, failed, cancelled)
- payout_method (gcash, bank_transfer)
- gcash_number
- gcash_account_name
- processed_at
```

#### 4. `webhook_events`
PayMongo webhook event logging.

```sql
- id
- event_id (unique)
- event_type
- resource_type
- resource_id
- payload (JSON)
- processed
- processed_at
- error_message
```

#### 5. `platform_settings`
Platform configuration storage.

```sql
- id
- setting_key (unique)
- setting_value
- description
```

### Updated Tables

- **subscriptions**: Added `paymongo_payment_id`, `paymongo_source_id`, `checkout_url`
- **bars**: Added `gcash_number`, `gcash_account_name` for payout details
- **pos_orders**: Added `payment_transaction_id`, `payment_status`

---

## Setup Instructions

### 1. Run Database Migration

```bash
cd thesis-backend
node run_migration.js paymongo_payment_integration.sql
```

### 2. Install Dependencies

All required dependencies (axios) are already installed.

### 3. Configure Environment Variables

Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Update the following values:

```env
# Application URLs
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# PayMongo Keys (get from PayMongo dashboard)
PAYMONGO_PUBLIC_KEY=pk_test_your_key_here
PAYMONGO_SECRET_KEY=sk_test_your_key_here
PAYMONGO_WEBHOOK_SECRET=whsec_your_secret_here

# Platform Settings
PLATFORM_FEE_PERCENTAGE=5.00
```

### 4. Update Platform Settings in Database

```sql
UPDATE platform_settings 
SET setting_value = 'pk_test_your_public_key' 
WHERE setting_key = 'paymongo_public_key';

UPDATE platform_settings 
SET setting_value = 'sk_test_your_secret_key' 
WHERE setting_key = 'paymongo_secret_key';

UPDATE platform_settings 
SET setting_value = 'whsec_your_webhook_secret' 
WHERE setting_key = 'paymongo_webhook_secret';
```

---

## PayMongo Configuration

### 1. Create PayMongo Account

1. Sign up at https://paymongo.com
2. Complete business verification
3. Access dashboard at https://dashboard.paymongo.com

### 2. Get API Keys

1. Navigate to **Developers > API Keys**
2. Copy **Test Public Key** and **Test Secret Key**
3. For production: Generate **Live Keys** after account approval

### 3. Set Up Webhook

1. Navigate to **Developers > Webhooks**
2. Create new webhook:
   - **URL**: `https://tpg.com/webhook/paymongo`
   - **Events to listen**:
     - `source.chargeable`
     - `payment.paid`
     - `payment.failed`
3. Copy **Webhook Signing Secret**

---

## API Endpoints

### Customer Payments

#### Create Payment
```http
POST /payments/create
Authorization: Bearer {jwt_token}

Body:
{
  "payment_type": "order" | "reservation",
  "related_id": 123,
  "amount": 1500.00,
  "payment_method": "gcash" | "paymaya" | "card",
  "bar_id": 1
}

Response:
{
  "success": true,
  "message": "Payment created",
  "data": {
    "payment_id": 456,
    "reference_id": "ORD-1234567890-ABC123",
    "checkout_url": "https://checkout.paymongo.com/...",
    "amount": 1500.00
  }
}
```

#### Get Payment Status
```http
GET /payments/:reference_id
Authorization: Bearer {jwt_token}

Response:
{
  "success": true,
  "data": {
    "id": 456,
    "reference_id": "ORD-1234567890-ABC123",
    "status": "paid",
    "amount": 1500.00,
    "paid_at": "2024-03-18T10:30:00Z"
  }
}
```

### Subscription Payments

#### Subscribe with Payment
```http
POST /subscription-payments/subscribe
Authorization: Bearer {jwt_token}

Body:
{
  "plan_id": 2,
  "payment_method": "gcash"
}

Response:
{
  "success": true,
  "message": "Subscription created",
  "data": {
    "subscription_id": 789,
    "checkout_url": "https://checkout.paymongo.com/...",
    "amount": 999.00
  }
}
```

#### Renew Subscription
```http
POST /subscription-payments/renew
Authorization: Bearer {jwt_token}

Body:
{
  "payment_method": "gcash"
}
```

### Payouts

#### Get Bar Owner Payouts
```http
GET /payouts/my?status=pending
Authorization: Bearer {jwt_token}

Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "bar_name": "My Bar",
      "gross_amount": 1500.00,
      "platform_fee": 5.00,
      "platform_fee_amount": 75.00,
      "net_amount": 1425.00,
      "status": "pending",
      "created_at": "2024-03-18T10:00:00Z"
    }
  ]
}
```

#### Process Payout (Admin Only)
```http
POST /payouts/admin/process/:id
Authorization: Bearer {jwt_token}

Body:
{
  "payout_reference": "GCASH-REF-123",
  "notes": "Processed via GCash"
}
```

---

## Webhook Configuration

### Webhook Endpoint

```
POST https://your-domain.com/webhook/paymongo
Content-Type: application/json
PayMongo-Signature: {signature}
```

### Handled Events

1. **source.chargeable**: GCash/PayMaya payment approved
   - Attaches source to payment
   - Updates status to "processing"

2. **payment.paid**: Payment successfully completed
   - Updates payment status to "paid"
   - Activates subscription (if subscription payment)
   - Creates payout record
   - Updates order/reservation status

3. **payment.failed**: Payment failed
   - Updates payment status to "failed"
   - Records failure reason
   - Rejects subscription (if applicable)

### Webhook Security

The webhook handler verifies PayMongo signatures to prevent fraudulent requests.

---

## Frontend Integration

### 1. Subscription Page Payment Flow

```javascript
import { paymentApi } from '../api/paymentApi';

const handleSubscribe = async () => {
  const { data } = await paymentApi.subscribeWithPayment({
    plan_id: selectedPlan.id,
    payment_method: 'gcash'
  });
  
  // Redirect to PayMongo checkout
  window.location.href = data.data.checkout_url;
};
```

### 2. Payment Success Handler

After payment, user is redirected to:
- Success: `/payment/success?ref={reference_id}`
- Failed: `/payment/failed?ref={reference_id}`

The frontend checks payment status and displays appropriate message.

---

## Testing

### Test Mode

PayMongo provides test mode for development:

**Test Cards:**
- Success: `4343434343434345` (Visa)
- Declined: `4571736000000075`

**Test GCash:**
- Use test credentials from PayMongo dashboard
- Webhook events are simulated

### Manual Testing Steps

1. **Subscription Payment**:
   - Navigate to `/subscription`
   - Select a plan
   - Choose GCash payment
   - Complete mock payment
   - Verify webhook received
   - Check subscription activated

2. **Branch Creation**:
   - Try creating branch beyond limit
   - Verify restriction message
   - Upgrade subscription
   - Create additional branch successfully

3. **Payout Creation**:
   - Make test payment
   - Verify payout record created
   - Check platform fee calculation
   - View payout in owner dashboard

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Replace test API keys with live keys
- [ ] Update webhook URL to production domain
- [ ] Configure SSL certificate
- [ ] Set `NODE_ENV=production`
- [ ] Update FRONTEND_URL to production domain
- [ ] Test webhook delivery
- [ ] Enable PayMongo live mode
- [ ] Configure email notifications (optional)
- [ ] Set up monitoring/alerts

### Security Best Practices

1. **Never commit** `.env` file or API keys to git
2. Use environment variables for all secrets
3. Verify webhook signatures
4. Use HTTPS for all payment URLs
5. Implement rate limiting on payment endpoints
6. Log all payment transactions
7. Encrypt sensitive payout information

---

## Troubleshooting

### Common Issues

**Issue**: Payment webhook not received
- **Solution**: Check webhook URL is publicly accessible, verify signing secret

**Issue**: Subscription not activated after payment
- **Solution**: Check webhook event logs, verify payment status in PayMongo dashboard

**Issue**: Branch creation still restricted
- **Solution**: Verify subscription status is "active", check max_bars limit

**Issue**: Payout calculation incorrect
- **Solution**: Check platform_fee_percentage in platform_settings

### Debugging

Enable detailed logging:

```javascript
console.log('Payment webhook received:', event);
console.log('Processing payment:', paymentId);
```

Check database for webhook events:

```sql
SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT 10;
```

---

## Support

For PayMongo API support:
- Documentation: https://developers.paymongo.com
- Support: support@paymongo.com

For system issues:
- Check backend logs
- Review webhook_events table
- Verify API keys are correct

---

## Summary

This integration provides:
✅ Automated online payments via GCash, PayMaya, Cards
✅ Subscription payment processing
✅ Branch creation restrictions based on subscription
✅ Platform fee calculation and payouts
✅ Secure webhook handling
✅ Comprehensive payment tracking

The system is production-ready and follows PayMongo best practices.
