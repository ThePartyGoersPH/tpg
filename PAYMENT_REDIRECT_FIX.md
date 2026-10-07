# Payment Redirect URL Fix

**Date:** March 30, 2026  
**Issue:** PayMongo payment redirects were going to customer website instead of manager app for bar owner subscriptions

---

## 🐛 Problem

After deploying to Kamatera, payment redirects for:
- Bar owner subscription payments
- Payroll downloads (if applicable)

Were redirecting to the customer website (`https://thepartygoers.fun`) instead of the manager app (`https://baroperations.thepartygoers.fun`).

---

## ✅ Solution

### Files Modified

#### 1. `thesis-backend/routes/subscriptionPayments.js`
**Changed:** Subscription payment redirects now use `BAR_OWNER_APP_URL` instead of `FRONTEND_URL`

**Before:**
```javascript
success_url: `${process.env.FRONTEND_URL}/subscription/success?ref=${referenceId}`,
failed_url: `${process.env.FRONTEND_URL}/subscription/failed?ref=${referenceId}`,
```

**After:**
```javascript
success_url: `${process.env.BAR_OWNER_APP_URL || 'https://baroperations.thepartygoers.fun'}/subscription/success?ref=${referenceId}`,
failed_url: `${process.env.BAR_OWNER_APP_URL || 'https://baroperations.thepartygoers.fun'}/subscription/failed?ref=${referenceId}`,
```

**Locations:**
- Line 68-69: Initial subscription payment
- Line 213-214: Subscription renewal payment

#### 2. `thesis-backend/services/paymongoService.js`
**Changed:** Default fallback URL now uses `FRONTEND_URL` with proper default

**Before:**
```javascript
success: metadata.success_url || `${process.env.APP_URL}/payment/success`,
failed: metadata.failed_url || `${process.env.APP_URL}/payment/failed`,
```

**After:**
```javascript
success: metadata.success_url || `${process.env.FRONTEND_URL || 'https://thepartygoers.fun'}/payment/success`,
failed: metadata.failed_url || `${process.env.FRONTEND_URL || 'https://thepartygoers.fun'}/payment/failed`,
```

---

## 🔧 Environment Variables

### Required Environment Variables

Add to your `.env` file on Kamatera:

```bash
# Customer Website (for customer reservations/orders)
FRONTEND_URL=https://thepartygoers.fun

# Manager/Bar Owner App (for subscriptions, payroll, etc.)
BAR_OWNER_APP_URL=https://baroperations.thepartygoers.fun

# Super Admin App (if needed)
SUPER_ADMIN_URL=https://superadmin.thepartygoers.fun

# API URL
API_URL=https://api.thepartygoers.fun
```

### URL Usage Guide

| Payment Type | Uses | Redirects To |
|-------------|------|--------------|
| Customer Reservations | `FRONTEND_URL` | Customer website |
| Customer Orders | `FRONTEND_URL` | Customer website |
| Bar Owner Subscriptions | `BAR_OWNER_APP_URL` | Manager app |
| Subscription Renewals | `BAR_OWNER_APP_URL` | Manager app |

---

## 📋 Verification Checklist

### Test Bar Owner Subscription Payment
- [ ] Login to manager app as bar owner
- [ ] Navigate to Subscription page
- [ ] Click "Subscribe" or "Upgrade Plan"
- [ ] Select GCash or PayMaya payment method
- [ ] Complete payment on PayMongo
- [ ] **Verify:** Redirects to `https://baroperations.thepartygoers.fun/subscription/success`
- [ ] **Verify:** Success page displays correctly
- [ ] **Verify:** Subscription is activated

### Test Subscription Renewal
- [ ] Login to manager app with active subscription
- [ ] Navigate to Subscription page
- [ ] Click "Renew" or renewal button
- [ ] Complete payment
- [ ] **Verify:** Redirects to manager app success page
- [ ] **Verify:** Subscription is renewed

### Test Customer Payments (Should Still Work)
- [ ] Open customer website
- [ ] Make a reservation
- [ ] Complete payment
- [ ] **Verify:** Redirects to `https://thepartygoers.fun/payment/success`
- [ ] **Verify:** Reservation is confirmed

---

## 🚀 Deployment Steps

### 1. Update Backend Code
```bash
cd thesis-backend
git pull origin main
```

### 2. Update Environment Variables
Edit `.env` file on Kamatera server:
```bash
nano .env
```

Add/update:
```bash
BAR_OWNER_APP_URL=https://baroperations.thepartygoers.fun
FRONTEND_URL=https://thepartygoers.fun
```

### 3. Restart Backend Server
```bash
pm2 restart thesis-backend
# or
npm run start
```

### 4. Verify Changes
```bash
# Check if environment variables are loaded
pm2 logs thesis-backend --lines 50 | grep URL
```

### 5. Test Payment Flow
- Test subscription payment from manager app
- Verify redirect goes to correct URL
- Check payment is processed correctly

---

## 🔍 How Redirects Work

### Payment Flow

1. **User initiates payment:**
   - Manager app calls backend API
   - Backend creates PayMongo source/payment intent

2. **Backend sets redirect URLs:**
   - For subscriptions: Uses `BAR_OWNER_APP_URL`
   - For customer payments: Uses `FRONTEND_URL`
   - Fallback to hardcoded URLs if env vars missing

3. **PayMongo processes payment:**
   - User completes payment on PayMongo page
   - PayMongo redirects to success/failed URL

4. **User returns to app:**
   - Success URL: Shows confirmation, processes webhook
   - Failed URL: Shows error, allows retry

### URL Resolution Priority

```javascript
// For subscriptions
success_url: process.env.BAR_OWNER_APP_URL || 'https://baroperations.thepartygoers.fun'

// For customer payments  
success_url: req.body.success_url || process.env.FRONTEND_URL || 'https://thepartygoers.fun'
```

---

## 📝 Additional Notes

### Why This Happened
- `FRONTEND_URL` was set to customer website
- Subscription payments were using `FRONTEND_URL`
- No separate `BAR_OWNER_APP_URL` variable existed
- All payments redirected to same URL

### Why This Fix Works
- Separate environment variables for different apps
- Subscription payments use manager app URL
- Customer payments use customer website URL
- Hardcoded fallbacks prevent errors

### Future Considerations
- Consider adding URL validation
- Log redirect URLs for debugging
- Add admin panel to configure URLs
- Support multiple domains per deployment

---

## 🐛 Troubleshooting

### Issue: Still redirecting to wrong URL
**Solution:**
1. Check `.env` file has correct URLs
2. Restart backend server
3. Clear browser cache
4. Test in incognito mode

### Issue: Environment variable not loading
**Solution:**
```bash
# Check if variable is set
echo $BAR_OWNER_APP_URL

# Check PM2 environment
pm2 env 0

# Reload environment
pm2 reload thesis-backend --update-env
```

### Issue: Payment succeeds but redirect fails
**Solution:**
1. Check CORS settings include redirect URL
2. Verify SSL certificate is valid
3. Check firewall allows redirects
4. Review PayMongo webhook logs

---

## 📞 Support

If issues persist:
1. Check backend logs: `pm2 logs thesis-backend`
2. Check PayMongo dashboard for payment status
3. Verify environment variables are set correctly
4. Test with different payment methods
5. Contact PayMongo support if needed

---

## ✅ Summary

**What was fixed:**
- Subscription payments now redirect to manager app
- Customer payments still redirect to customer website
- Added proper environment variable separation
- Added fallback URLs for safety

**Impact:**
- Bar owners can complete subscriptions properly
- Payment flow works as expected
- No impact on customer payments
- Better separation of concerns
