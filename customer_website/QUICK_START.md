# Quick Start Guide - Customer Website Enhancements

**Last Updated:** March 20, 2026

---

## 🚀 1-Minute Setup

```bash
# 1. Navigate to backend
cd thesis-backend

# 2. Run migrations
mysql -u root -p bar_platform < migrations/20260319_payout_status_sent_lifecycle.sql
mysql -u root -p bar_platform < migrations/20260320_customer_enhancements.sql

# 3. Start backend
npm run dev

# 4. In new terminal, start frontend
cd ..
npm run dev
```

**Done!** Open http://localhost:5173

---

## 📋 What's New?

### ✅ Bug Fixes
- **Reservation Status Sync** - Payments now correctly update reservation status
- **Payment Redirect Loop** - No more infinite redirects after refresh

### 🎉 New Features
- **Unified Social Feed** - Events + Posts in one feed (like Facebook)
- **Best Seller Badges** - Menu items marked based on sales data
- **Platform Feedback** - Rate the platform itself
- **Cart Persistence** - Cart saved across sessions (24hr)
- **Profile Picture** - Shows in navbar
- **Auto-Center Maps** - Map centers on your location
- **Simplified Filters** - Removed city filter (Cavite only)

---

## 🧪 Quick Test

### Test 1: Social Feed
1. Go to "Events" page
2. See mixed events and posts
3. Click "Like" on any item
4. ✅ Count updates instantly

### Test 2: Cart Persistence
1. Add items to cart on any bar page
2. Close browser completely
3. Reopen and go back to same bar
4. ✅ Cart items still there

### Test 3: Maps
1. Go to "Map" page
2. Allow location permission
3. ✅ Map centers on your location (blue marker)

---

## 🗄️ Database Changes

### New Tables
- `platform_feedback` - Customer reviews of platform

### New Columns
- `menu_items.is_best_seller` - Best seller flag
- `payouts.bar_owner_id` - Owner linkage

### New Views
- `menu_best_sellers` - Sales-based rankings

---

## 🔧 New API Endpoints

```bash
# Unified feed
GET /social/unified-feed

# Menu with best sellers
GET /public/bars/:barId/menu-with-bestsellers

# Platform feedback
POST /platform-feedback
GET /platform-feedback/my
GET /platform-feedback/stats
```

---

## 📱 Frontend Changes

### New Components
- `UnifiedFeedCard.jsx` - Social feed card
- `useCartPersistence.js` - Cart hook

### Updated Pages
- `EventsPage.jsx` - Now shows unified feed
- `BarsPage.jsx` - Removed city filter
- `BarsMapPage.jsx` - Auto-centers on user
- `Navbar.jsx` - Shows profile picture

---

## 🎨 CSS Needed

Add to your main CSS file:

```css
/* User Avatar */
.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #ed1c24;
}

/* Feed Cards */
.feed-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 1rem;
}

.feed-action-btn.liked {
  color: #ed1c24;
}
```

---

## ⚡ Performance Tips

1. **Best Sellers Update**
   ```sql
   -- Run weekly to update rankings
   UPDATE menu_items m
   LEFT JOIN menu_best_sellers mbs ON m.id = mbs.menu_item_id
   SET m.is_best_seller = (mbs.sales_rank <= 3);
   ```

2. **Clear Old Feedback**
   ```sql
   -- Archive feedback older than 1 year
   DELETE FROM platform_feedback 
   WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
   ```

3. **localStorage Cleanup**
   - Carts auto-expire after 24 hours
   - Payment success flags cleared on navigation

---

## 🐛 Common Issues

### "Unknown column 'bar_owner_id'"
**Fix:** Run migration 1
```bash
mysql -u root -p bar_platform < migrations/20260319_payout_status_sent_lifecycle.sql
```

### "Table 'platform_feedback' doesn't exist"
**Fix:** Run migration 2
```bash
mysql -u root -p bar_platform < migrations/20260320_customer_enhancements.sql
```

### Feed not loading
**Fix:** Check backend is running
```bash
curl http://localhost:5000/social/unified-feed
```

### Cart not saving
**Fix:** Check localStorage
```javascript
console.log(localStorage.getItem('bar_cart_data'));
```

---

## 📚 Documentation

- **Full Details:** `CUSTOMER_WEBSITE_ENHANCEMENTS.md`
- **Testing Guide:** `TESTING_GUIDE.md`
- **Payout System:** `PAYOUT_SYSTEM_CONTEXT.md`

---

## ✅ Deployment Checklist

- [ ] Migrations run
- [ ] Backend restarted
- [ ] Frontend rebuilt
- [ ] Test all 9 features
- [ ] Check browser console (no errors)
- [ ] Test on mobile
- [ ] Verify API responses

---

## 🎯 Next Steps

1. **Test Everything** - Use TESTING_GUIDE.md
2. **Add CSS** - Copy styles above
3. **Deploy** - Push to production
4. **Monitor** - Check logs for errors

---

**Ready to go! 🚀**

Questions? Check the full documentation or test each feature using the testing guide.
