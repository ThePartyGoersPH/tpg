# Customer Website Enhancements - Testing Guide

**Date:** March 20, 2026  
**Purpose:** Step-by-step testing instructions for all new features

---

## 🚀 Quick Start

### 1. Run Database Migrations

```bash
cd thesis-backend

# Migration 1: Add bar_owner_id to payouts
mysql -u root -p bar_platform < migrations/20260319_payout_status_sent_lifecycle.sql

# Migration 2: Platform feedback & best sellers
mysql -u root -p bar_platform < migrations/20260320_customer_enhancements.sql
```

### 2. Start Backend

```bash
cd thesis-backend
npm run dev
```

Expected output:
```
Server running on port 5000
Database connected successfully
```

### 3. Start Frontend

```bash
cd customer_website
npm run dev
```

Expected output:
```
Local: http://localhost:5173/
```

---

## ✅ Feature Testing Checklist

### 1. Reservation Status Sync ✅

**Test Steps:**
1. Login as customer
2. Navigate to a bar detail page
3. Create a reservation with GCash payment
4. Complete payment in PayMongo
5. Wait 3-5 seconds on success page
6. Navigate to "My Reservations"

**Expected Results:**
- ✅ Payment status: "paid"
- ✅ Reservation status: "paid"
- ✅ Both statuses synchronized

**Test Endpoints:**
```bash
# Check payment status
GET http://localhost:5000/payments/history

# Check reservation status
GET http://localhost:5000/reservations/my
```

---

### 2. Payment Success Redirect Loop Fix ✅

**Test Steps:**
1. Complete a payment successfully
2. You'll be redirected to payment success page
3. **Refresh the page (F5)**
4. Observe behavior

**Expected Results:**
- ✅ First visit: Shows payment success page
- ✅ After refresh: Redirects to `/dashboard/payments`
- ✅ No infinite redirect loop

**SessionStorage Check:**
```javascript
// Open browser console on success page
console.log(sessionStorage.getItem('payment_success_REF123'));
// Should show: "true"
```

---

### 3. Unified Social Feed ✅

**Test Steps:**
1. Login as customer
2. Navigate to "Events" page (now "Social Feed")
3. Observe mixed content of events and posts
4. Click "Like" on an event
5. Click "Like" on a post
6. Click "Comment" and add a comment

**Expected Results:**
- ✅ Feed shows both events and posts mixed
- ✅ Each item shows bar name, logo, timestamp
- ✅ Like count updates immediately
- ✅ Comment count updates after posting
- ✅ "Best Seller" badge on event/post type

**Test API:**
```bash
# Get unified feed
curl -X GET http://localhost:5000/social/unified-feed \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "feed_type": "event",
      "bar_name": "Sample Bar",
      "description": "Event description",
      "like_count": 5,
      "comment_count": 3,
      "user_liked": false,
      "time_ago": "2 hours ago"
    },
    {
      "id": 2,
      "feed_type": "post",
      "bar_name": "Another Bar",
      "description": "Post content",
      "like_count": 10,
      "comment_count": 7,
      "user_liked": true,
      "time_ago": "5 hours ago"
    }
  ]
}
```

---

### 4. Profile Picture in Navbar ✅

**Test Steps:**
1. Login as customer
2. Look at top-right navbar
3. Observe user profile section

**Expected Results:**
- ✅ If user has profile picture: Shows circular avatar image
- ✅ If no profile picture: Shows circular placeholder with first letter
- ✅ User's first name displayed next to avatar (desktop only)

**Update Profile Picture:**
```bash
# Navigate to Profile page
# Upload new profile picture
# Refresh page and check navbar
```

---

### 5. DSS Best Seller Indicator ✅

**Test Steps:**
1. Navigate to any bar detail page
2. View the menu section
3. Look for "Best Seller" badges

**Expected Results:**
- ✅ Top 3 most-sold items marked as "Best Seller"
- ✅ Badge displayed prominently on menu cards
- ✅ Items sorted with best sellers first

**Test API:**
```bash
# Get menu with best sellers
curl -X GET http://localhost:5000/public/bars/1/menu-with-bestsellers

# Expected response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "menu_name": "Beer Bucket",
      "selling_price": 500,
      "is_best_seller": true,
      "total_sold": 150,
      "sales_rank": 1
    },
    {
      "id": 2,
      "menu_name": "Wings Platter",
      "selling_price": 350,
      "is_best_seller": true,
      "total_sold": 120,
      "sales_rank": 2
    }
  ]
}
```

**Manual Best Seller Override:**
```sql
-- Mark specific item as best seller manually
UPDATE menu_items 
SET is_best_seller = TRUE 
WHERE id = 5;
```

---

### 6. Platform Feedback Feature ✅

**Test Steps:**
1. Login as customer
2. Navigate to Profile or Settings
3. Find "Platform Feedback" section
4. Submit feedback with rating and comment
5. View your feedback history

**Expected Results:**
- ✅ Can submit rating (1-5 stars)
- ✅ Can add optional comment
- ✅ Can select category (general, technical, etc.)
- ✅ Feedback appears in history
- ✅ Status shows as "pending"

**Test API:**
```bash
# Submit feedback
curl -X POST http://localhost:5000/platform-feedback \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "comment": "Great platform, very user-friendly!",
    "category": "general"
  }'

# Get my feedback
curl -X GET http://localhost:5000/platform-feedback/my \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get platform statistics (public)
curl -X GET http://localhost:5000/platform-feedback/stats

# Expected stats response:
{
  "success": true,
  "data": {
    "average_rating": "4.75",
    "total_feedback": 24,
    "rating_distribution": [
      { "rating": 5, "count": 15 },
      { "rating": 4, "count": 7 },
      { "rating": 3, "count": 2 }
    ]
  }
}
```

**Admin Testing:**
```bash
# Login as super admin
# View all feedback
curl -X GET http://localhost:5000/platform-feedback/admin/all \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Update feedback status
curl -X PATCH http://localhost:5000/platform-feedback/admin/1/status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "reviewed"}'
```

---

### 7. Cart Persistence ✅

**Test Steps:**
1. Navigate to a bar detail page
2. Add 2-3 menu items to cart
3. Set reservation date and time
4. **Close browser tab completely**
5. Reopen browser and navigate back to same bar
6. Check cart

**Expected Results:**
- ✅ Cart items still present
- ✅ Quantities preserved
- ✅ Reservation data preserved
- ✅ Cart expires after 24 hours

**Test localStorage:**
```javascript
// Open browser console
console.log(localStorage.getItem('bar_cart_data'));

// Expected format:
{
  "barId": 123,
  "cart": [
    { "id": 1, "name": "Beer", "quantity": 2, "price": 100 }
  ],
  "reservationData": {
    "date": "2026-03-21",
    "time": "18:00:00"
  },
  "timestamp": "2026-03-20T16:00:00Z"
}
```

**Test Expiry:**
```javascript
// Manually set old timestamp (25 hours ago)
const oldData = JSON.parse(localStorage.getItem('bar_cart_data'));
oldData.timestamp = new Date(Date.now() - 25*60*60*1000).toISOString();
localStorage.setItem('bar_cart_data', JSON.stringify(oldData));

// Refresh page - cart should be empty
```

---

### 8. City Filter Removal ✅

**Test Steps:**
1. Navigate to "Bars" page
2. Observe filter section

**Expected Results:**
- ✅ Page title: "Find Bars in Cavite"
- ✅ Only category filter visible
- ✅ No city input field
- ✅ Search bar still functional
- ✅ 2-column layout (was 3-column)

**Before:**
```
[City Input] [Category Input] [Apply Filters]
```

**After:**
```
[Category Input] [Apply Filter]
```

---

### 9. Maps Auto-Center on User Location ✅

**Test Steps:**
1. Navigate to "Map" page
2. Browser will request location permission
3. **Grant permission**
4. Observe map behavior

**Expected Results:**
- ✅ Location permission requested automatically
- ✅ Map centers on user's location (blue marker)
- ✅ Zoom level: 14x
- ✅ Bar markers show with names
- ✅ Can click markers for details
- ✅ Can navigate to bars

**Test Without Permission:**
1. Deny location permission
2. Map should center on Cavite default (14.5995, 120.9842)
3. Zoom level: 13x
4. Can manually click "Get My Location" button

**Test Navigation:**
1. Click on any bar marker
2. Click "Go to Location"
3. Route should appear with:
   - Distance in km
   - Estimated time in minutes
   - Voice guidance announcement

---

## 🗄️ Database Verification

### Check Tables Created

```sql
-- Check platform_feedback table
DESCRIBE platform_feedback;

-- Check menu_items has is_best_seller column
DESCRIBE menu_items;

-- Check payouts has bar_owner_id column
DESCRIBE payouts;

-- Check menu_best_sellers view
SELECT * FROM menu_best_sellers LIMIT 5;
```

### Sample Data Queries

```sql
-- View platform feedback
SELECT * FROM platform_feedback ORDER BY created_at DESC LIMIT 10;

-- View best sellers per bar
SELECT bar_id, menu_name, total_quantity_sold, sales_rank 
FROM menu_best_sellers 
WHERE sales_rank <= 3
ORDER BY bar_id, sales_rank;

-- Check reservation-payment sync
SELECT 
  r.id AS reservation_id,
  r.status AS reservation_status,
  r.payment_status,
  pt.status AS payment_status_actual,
  pt.amount
FROM reservations r
LEFT JOIN payment_transactions pt ON pt.related_id = r.id AND pt.payment_type = 'reservation'
WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY r.created_at DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

### Issue: Unified feed not loading

**Solution:**
```bash
# Check backend logs
cd thesis-backend
npm run dev

# Test endpoint directly
curl http://localhost:5000/social/unified-feed
```

### Issue: Best sellers not showing

**Solution:**
```sql
-- Manually trigger best seller update
UPDATE menu_items m
LEFT JOIN menu_best_sellers mbs ON m.id = mbs.menu_item_id
SET m.is_best_seller = CASE 
  WHEN mbs.sales_rank <= 3 THEN TRUE 
  ELSE FALSE 
END;

-- Or manually mark items
UPDATE menu_items SET is_best_seller = TRUE WHERE id IN (1, 2, 3);
```

### Issue: Cart not persisting

**Solution:**
```javascript
// Check localStorage quota
console.log(navigator.storage.estimate());

// Clear and test
localStorage.removeItem('bar_cart_data');
// Add items again
```

### Issue: Map not centering

**Solution:**
```javascript
// Check geolocation support
console.log('Geolocation supported:', 'geolocation' in navigator);

// Check permissions
navigator.permissions.query({name:'geolocation'}).then(result => {
  console.log('Permission:', result.state);
});
```

### Issue: Platform feedback not submitting

**Solution:**
```bash
# Check route registration
grep -n "platform-feedback" thesis-backend/index.js

# Test endpoint
curl -X POST http://localhost:5000/platform-feedback \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "comment": "Test"}'
```

---

## 📊 Performance Testing

### Load Testing Unified Feed

```bash
# Install Apache Bench
# Test feed endpoint
ab -n 100 -c 10 http://localhost:5000/social/unified-feed
```

### Database Query Performance

```sql
-- Check best sellers view performance
EXPLAIN SELECT * FROM menu_best_sellers WHERE bar_id = 1;

-- Should use indexes on:
-- - menu_items.bar_id
-- - menu_items.status
-- - payment_line_items.item_name
```

---

## ✅ Final Verification Checklist

Before deploying to production:

- [ ] All migrations run successfully
- [ ] Backend starts without errors
- [ ] Frontend builds without errors
- [ ] All 9 features tested and working
- [ ] Database indexes created
- [ ] localStorage working in all browsers
- [ ] Geolocation permissions handled gracefully
- [ ] API endpoints returning correct data
- [ ] No console errors in browser
- [ ] Mobile responsive (test on phone)
- [ ] Cross-browser tested (Chrome, Firefox, Safari)
- [ ] Performance acceptable (< 2s page load)

---

## 🎯 Success Criteria

Each feature should meet these criteria:

1. **Functional:** Works as designed
2. **Performant:** Loads in < 2 seconds
3. **Reliable:** No errors in console
4. **User-friendly:** Intuitive UI/UX
5. **Accessible:** Works on mobile
6. **Secure:** Proper authentication/authorization

---

**Testing Complete! Ready for Production! 🚀**
