# Downpayment Feature Implementation Guide

**Date:** March 30, 2026  
**Feature:** Allow bar owners to require downpayment and customers to choose payment option

---

## 📋 Overview

This feature allows:
- **Bar Owners/Managers:** Configure downpayment requirements (percentage or fixed amount)
- **Customers:** Choose between full payment or downpayment when making reservations
- **System:** Track partial payments and remaining balances

---

## 🗄️ Database Changes

### Migration File Created
`migrations/20260330_add_downpayment_feature.sql`

### New Columns in `bars` Table
- `downpayment_enabled` - Enable/disable downpayment for the bar
- `downpayment_type` - 'percentage' or 'fixed'
- `downpayment_value` - Percentage (0-100) or fixed amount
- `downpayment_description` - Optional terms/description

### New Columns in `reservations` Table
- `payment_option` - 'full' or 'downpayment'
- `total_price` - Total reservation price
- `downpayment_amount` - Actual downpayment amount
- `remaining_balance` - Balance after downpayment
- `balance_paid` - Whether balance is paid
- `balance_paid_at` - When balance was paid

---

## 🚀 Implementation Steps

### Step 1: Run Database Migration

On your Kamatera server:

```bash
cd /var/www/thesis-backend
mysql -u root -p bar_platform < migrations/20260330_add_downpayment_feature.sql
```

Verify:
```bash
mysql -u root -p -e "USE bar_platform; DESCRIBE bars;" | grep downpayment
mysql -u root -p -e "USE bar_platform; DESCRIBE reservations;" | grep -E 'payment_option|downpayment|balance'
```

---

### Step 2: Backend API Updates Needed

#### A. Bar Settings API (`routes/owner.js` or new route)

**GET /owner/bars/:barId/downpayment-settings**
```javascript
// Get current downpayment settings
{
  "downpayment_enabled": true,
  "downpayment_type": "percentage",
  "downpayment_value": 50.00,
  "downpayment_description": "50% downpayment required to confirm reservation"
}
```

**PUT /owner/bars/:barId/downpayment-settings**
```javascript
// Update downpayment settings
{
  "downpayment_enabled": true,
  "downpayment_type": "percentage", // or "fixed"
  "downpayment_value": 50.00,
  "downpayment_description": "Optional description"
}
```

#### B. Public Bar API (`routes/publicBars.js`)

Update bar detail endpoint to include downpayment settings:
```javascript
GET /public/bars/:id
// Add to response:
{
  ...existing fields,
  "downpayment_enabled": true,
  "downpayment_type": "percentage",
  "downpayment_value": 50.00,
  "downpayment_description": "50% required upfront"
}
```

#### C. Reservation Creation API (`routes/reservations.js`)

Update reservation creation to:
1. Accept `payment_option` field ('full' or 'downpayment')
2. Calculate downpayment amount based on bar settings
3. Store total_price, downpayment_amount, remaining_balance

```javascript
POST /reservations
{
  ...existing fields,
  "payment_option": "downpayment" // or "full"
}

// Backend calculates:
// - total_price = sum of items/packages
// - If payment_option === 'downpayment':
//   - If downpayment_type === 'percentage':
//     downpayment_amount = total_price * (downpayment_value / 100)
//   - If downpayment_type === 'fixed':
//     downpayment_amount = downpayment_value
//   - remaining_balance = total_price - downpayment_amount
// - If payment_option === 'full':
//   - downpayment_amount = total_price
//   - remaining_balance = 0
```

#### D. Payment API (`routes/payments.js`)

Update payment creation to use correct amount:
```javascript
// When creating payment for reservation:
const amountToPay = reservation.payment_option === 'downpayment' 
  ? reservation.downpayment_amount 
  : reservation.total_price;
```

#### E. Balance Payment API (NEW)

**POST /reservations/:id/pay-balance**
```javascript
// Allow customer to pay remaining balance
// Only if:
// - payment_option === 'downpayment'
// - initial payment is confirmed
// - balance_paid === false
// - remaining_balance > 0
```

---

### Step 3: Manager App Frontend Updates

#### A. Bar Settings Page

Add new section for Downpayment Settings:

```jsx
// Location: manager/src/pages/BarSettings.jsx or similar

<div className="downpayment-settings">
  <h3>Downpayment Settings</h3>
  
  <label>
    <input 
      type="checkbox" 
      checked={downpaymentEnabled}
      onChange={(e) => setDownpaymentEnabled(e.target.checked)}
    />
    Require downpayment for reservations
  </label>

  {downpaymentEnabled && (
    <>
      <select 
        value={downpaymentType}
        onChange={(e) => setDownpaymentType(e.target.value)}
      >
        <option value="percentage">Percentage</option>
        <option value="fixed">Fixed Amount</option>
      </select>

      <input
        type="number"
        value={downpaymentValue}
        onChange={(e) => setDownpaymentValue(e.target.value)}
        placeholder={downpaymentType === 'percentage' ? 'Enter percentage (0-100)' : 'Enter fixed amount'}
        min="0"
        max={downpaymentType === 'percentage' ? '100' : undefined}
        step="0.01"
      />

      <textarea
        value={downpaymentDescription}
        onChange={(e) => setDownpaymentDescription(e.target.value)}
        placeholder="Optional: Add terms or description for customers"
      />

      <button onClick={saveDownpaymentSettings}>Save Settings</button>
    </>
  )}
</div>
```

#### B. Reservations List

Update reservation display to show payment status:
- Full payment
- Downpayment paid (show remaining balance)
- Balance paid

---

### Step 4: Customer App Frontend Updates

#### A. Reservation Flow

Update reservation page to show payment options:

```jsx
// Location: customer_website/src/pages/ReservationPage.jsx or similar

{bar.downpayment_enabled && (
  <div className="payment-options">
    <h4>Payment Option</h4>
    
    <label>
      <input
        type="radio"
        name="payment_option"
        value="full"
        checked={paymentOption === 'full'}
        onChange={(e) => setPaymentOption(e.target.value)}
      />
      <div>
        <strong>Pay Full Amount</strong>
        <p>₱{totalPrice.toFixed(2)}</p>
      </div>
    </label>

    <label>
      <input
        type="radio"
        name="payment_option"
        value="downpayment"
        checked={paymentOption === 'downpayment'}
        onChange={(e) => setPaymentOption(e.target.value)}
      />
      <div>
        <strong>Pay Downpayment Only</strong>
        <p>
          Pay now: ₱{calculateDownpayment().toFixed(2)}
          <br />
          Remaining: ₱{(totalPrice - calculateDownpayment()).toFixed(2)}
        </p>
        {bar.downpayment_description && (
          <small>{bar.downpayment_description}</small>
        )}
      </div>
    </label>
  </div>
)}

<button onClick={proceedToPayment}>
  {paymentOption === 'full' 
    ? `Pay ₱${totalPrice.toFixed(2)}` 
    : `Pay Downpayment ₱${calculateDownpayment().toFixed(2)}`}
</button>
```

#### B. My Reservations Page

Show payment status and allow balance payment:

```jsx
{reservation.payment_option === 'downpayment' && !reservation.balance_paid && (
  <div className="balance-payment">
    <p>Downpayment: ₱{reservation.downpayment_amount} (Paid)</p>
    <p>Remaining Balance: ₱{reservation.remaining_balance}</p>
    <button onClick={() => payBalance(reservation.id)}>
      Pay Remaining Balance
    </button>
  </div>
)}
```

---

## 🧮 Calculation Logic

### Downpayment Amount Calculation

```javascript
function calculateDownpaymentAmount(totalPrice, downpaymentType, downpaymentValue) {
  if (downpaymentType === 'percentage') {
    return totalPrice * (downpaymentValue / 100);
  } else if (downpaymentType === 'fixed') {
    // Don't exceed total price
    return Math.min(downpaymentValue, totalPrice);
  }
  return totalPrice; // fallback to full payment
}
```

### Example Scenarios

**Scenario 1: Percentage Downpayment**
- Total Price: ₱2,000
- Downpayment Type: percentage
- Downpayment Value: 50
- **Downpayment Amount: ₱1,000**
- **Remaining Balance: ₱1,000**

**Scenario 2: Fixed Downpayment**
- Total Price: ₱2,000
- Downpayment Type: fixed
- Downpayment Value: 500
- **Downpayment Amount: ₱500**
- **Remaining Balance: ₱1,500**

---

## 🔒 Business Rules

1. **Downpayment cannot exceed total price**
2. **If downpayment is disabled, always use full payment**
3. **Customer can only pay balance after initial payment is confirmed**
4. **Once balance is paid, mark `balance_paid = 1` and set `balance_paid_at`**
5. **Reservation is only fully confirmed after:**
   - Full payment is made, OR
   - Downpayment is made (partial confirmation)
6. **Balance payment creates a new payment transaction linked to same reservation**

---

## 📊 Database Query Examples

### Get bars with downpayment enabled
```sql
SELECT id, name, downpayment_type, downpayment_value, downpayment_description
FROM bars
WHERE downpayment_enabled = 1;
```

### Get reservations with unpaid balance
```sql
SELECT r.id, r.transaction_number, r.total_price, r.downpayment_amount, r.remaining_balance
FROM reservations r
WHERE r.payment_option = 'downpayment'
  AND r.balance_paid = 0
  AND r.remaining_balance > 0
  AND r.payment_status = 'paid'; -- initial payment confirmed
```

### Update reservation when balance is paid
```sql
UPDATE reservations
SET balance_paid = 1,
    balance_paid_at = NOW(),
    payment_status = 'paid'
WHERE id = ?;
```

---

## ✅ Testing Checklist

### Bar Owner Tests
- [ ] Enable downpayment with percentage (e.g., 50%)
- [ ] Enable downpayment with fixed amount (e.g., ₱500)
- [ ] Disable downpayment
- [ ] Add custom description
- [ ] View reservations with different payment statuses

### Customer Tests
- [ ] Make reservation with full payment
- [ ] Make reservation with downpayment only
- [ ] See correct amounts at checkout
- [ ] Pay remaining balance later
- [ ] View payment history showing both transactions

### Edge Cases
- [ ] Downpayment value = 100% (same as full payment)
- [ ] Fixed downpayment > total price (should cap at total)
- [ ] Try to pay balance before initial payment confirmed
- [ ] Try to pay balance twice

---

## 🚨 Important Notes

1. **This is a major feature** - Test thoroughly before deploying to production
2. **Existing reservations** will have NULL values for new columns (default behavior is fine)
3. **Payment gateway integration** - Ensure PayMongo handles both initial and balance payments correctly
4. **Inventory deduction** - Decide when to deduct:
   - On downpayment? (reserves items)
   - On full payment? (safer but may cause stock issues)
5. **Cancellation policy** - Define refund rules for downpayments
6. **Reminder system** - Consider sending reminders for unpaid balances

---

## 📝 Next Steps

1. **Run the migration** on your development database first
2. **Implement backend API endpoints** (start with bar settings)
3. **Update manager app UI** for configuration
4. **Update customer app UI** for payment selection
5. **Test thoroughly** with test payments
6. **Deploy to production** after all tests pass

---

**This is a complete implementation guide. Would you like me to start implementing the backend API endpoints now, or would you prefer to review this plan first?**
