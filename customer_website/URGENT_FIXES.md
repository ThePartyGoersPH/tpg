# 🚨 Urgent Fixes - Reservation Status & Missing Tables

## Issues Found

1. ❌ **Reservation status stuck on "pending"** even though payment is "paid"
2. ❌ **Missing database tables** for social feed (bar_posts, bar_post_likes, etc.)

---

## 🔧 Fix #1: Run Missing Migration

The social feed needs tables that don't exist yet. Run this migration:

```bash
cd thesis-backend
mysql -u root -p bar_platform < migrations/20260320_social_tables.sql
```

This creates:
- `bar_posts` - For bar posts
- `bar_post_likes` - For post likes
- `bar_post_comments` - For post comments
- `bar_comment_reactions` - For comment reactions
- `bar_comment_replies` - For comment replies
- `bar_reply_reactions` - For reply reactions

---

## 🔧 Fix #2: Reservation Status Sync

The code is already correct, but the issue is likely one of these:

### Possible Causes:

#### A. Payment confirmation not being triggered
The frontend needs to call the confirm endpoint after payment redirect.

**Check:** `src/pages/PaymentSuccessPage.jsx` line 21
```javascript
await paymentService.confirmPaymentByReference(referenceId);
```

#### B. Webhook not firing
PayMongo webhook might not be configured or firing.

**Test manually:**
```bash
# Get your payment reference ID
# Then call confirm endpoint
curl -X POST http://localhost:5000/payments/YOUR_REFERENCE_ID/confirm \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### C. Transaction rollback
Check backend logs for any errors during payment confirmation.

---

## 🔍 Debug Reservation Status Issue

### Step 1: Check Payment Status
```sql
SELECT 
  pt.id,
  pt.reference_id,
  pt.status AS payment_status,
  pt.payment_type,
  pt.related_id,
  pt.paid_at
FROM payment_transactions pt
WHERE pt.reference_id = 'YOUR_REFERENCE_ID';
```

### Step 2: Check Reservation Status
```sql
SELECT 
  r.id,
  r.status AS reservation_status,
  r.payment_status,
  r.paid_at,
  r.created_at
FROM reservations r
WHERE r.id = (
  SELECT related_id 
  FROM payment_transactions 
  WHERE reference_id = 'YOUR_REFERENCE_ID'
);
```

### Step 3: Check if Update Query Works
```sql
-- If payment is paid but reservation is pending, manually update:
UPDATE reservations 
SET payment_status = 'paid', 
    status = 'paid', 
    paid_at = NOW() 
WHERE id = YOUR_RESERVATION_ID;
```

---

## 🎯 Complete Migration Order

Run these migrations in order:

```bash
cd thesis-backend

# 1. Payout enhancements (adds bar_owner_id)
mysql -u root -p bar_platform < migrations/20260319_payout_status_sent_lifecycle.sql

# 2. Customer enhancements (platform feedback, best sellers)
mysql -u root -p bar_platform < migrations/20260320_customer_enhancements.sql

# 3. Social tables (bar posts, likes, comments)
mysql -u root -p bar_platform < migrations/20260320_social_tables.sql
```

---

## 🧪 Test Reservation Status Sync

### Test 1: Create New Payment
```bash
# 1. Create a reservation with payment
# 2. Complete payment in PayMongo
# 3. Check backend logs for:
```

Look for these log messages:
```
✅ Payment confirmed
✅ Reservation X marked as PAID
```

### Test 2: Manual Confirmation
```bash
# Get reference ID from payment history
# Call confirm endpoint
curl -X POST http://localhost:5000/payments/REF123/confirm \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "message": "Payment confirmed",
  "data": {
    "status": "paid",
    "reference_id": "REF123"
  }
}
```

### Test 3: Check Database
```sql
-- Both should be 'paid'
SELECT 
  pt.status AS payment_status,
  r.status AS reservation_status
FROM payment_transactions pt
JOIN reservations r ON pt.related_id = r.id
WHERE pt.payment_type = 'reservation'
  AND pt.reference_id = 'REF123';
```

---

## 🔨 Quick Fix for Existing Stuck Reservations

If you have reservations stuck on "pending" with paid payments:

```sql
-- Update all reservations where payment is paid but reservation is pending
UPDATE reservations r
JOIN payment_transactions pt ON pt.related_id = r.id AND pt.payment_type = 'reservation'
SET 
  r.payment_status = 'paid',
  r.status = 'paid',
  r.paid_at = COALESCE(r.paid_at, pt.paid_at, NOW())
WHERE pt.status = 'paid'
  AND r.status = 'pending';
```

---

## 📋 Verification Checklist

After running migrations and fixes:

- [ ] All 3 migrations run successfully
- [ ] No SQL errors in backend logs
- [ ] Social feed loads without "table doesn't exist" error
- [ ] Create new reservation with payment
- [ ] Complete payment
- [ ] Check payment history shows "paid"
- [ ] Check reservations page shows "paid" (not "pending")
- [ ] Both payment_status and status are "paid"

---

## 🐛 Common Issues & Solutions

### Issue: "Table doesn't exist"
**Solution:** Run `20260320_social_tables.sql` migration

### Issue: Payment paid but reservation pending
**Solutions:**
1. Check if confirm endpoint is being called
2. Check backend logs for errors
3. Manually run the SQL fix above
4. Ensure webhook is configured in PayMongo

### Issue: Confirm endpoint returns 404
**Solution:** Check reference_id is correct and belongs to logged-in user

### Issue: Transaction rollback
**Solution:** Check backend logs for specific error, likely database constraint issue

---

## 🔍 Backend Logs to Check

Look for these in your backend console:

```
✅ GOOD:
- "Payment confirmed"
- "Reservation X marked as PAID"
- "Payout created for payment X"

❌ BAD:
- "CONFIRM PAYMENT ERROR"
- "Transaction rollback"
- "Unknown column"
- "Table doesn't exist"
```

---

## 📞 Still Not Working?

If reservation status still not syncing after all fixes:

1. **Check webhook configuration:**
   - Go to PayMongo dashboard
   - Verify webhook URL is correct
   - Check webhook secret matches your .env

2. **Enable debug logging:**
   Add to `routes/payments.js` line 530:
   ```javascript
   console.log('🔍 Marking payment success:', {
     paymentId: payment.id,
     type: payment.payment_type,
     relatedId: payment.related_id
   });
   ```

3. **Check database constraints:**
   ```sql
   SHOW CREATE TABLE reservations;
   ```
   Ensure `status` column accepts 'paid' value

4. **Test direct SQL update:**
   ```sql
   UPDATE reservations SET status = 'paid' WHERE id = 1;
   ```
   If this fails, there's a database constraint issue

---

## ✅ Success Criteria

Everything is working when:

1. ✅ Social feed loads without errors
2. ✅ Create payment → Payment history shows "paid"
3. ✅ Same payment → Reservations page shows "paid"
4. ✅ Both happen within 5 seconds of payment completion
5. ✅ No errors in backend console
6. ✅ No errors in browser console

---

**Run the migrations first, then test a new payment to verify the fix!**
