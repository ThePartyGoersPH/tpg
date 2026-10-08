# Customer Web Application - Implementation Context

## Overview

This document provides the complete technical context for implementing the **Customer Web Application** for the Platform Bar System. The customer app will enable users to browse bars, make reservations, order menu items, and complete payments online.

---

## ⚠️ CRITICAL RULES

1. **DO NOT create new backend architecture** - Reuse all existing endpoints
2. **DO NOT break existing bar owner/management flows**
3. **Use existing database tables** - Only add migrations if absolutely necessary
4. **Follow existing RBAC patterns** - Customer role already exists
5. **Integrate with PayMongo** - Payment infrastructure is ready

---

## 1. AUTHENTICATION & AUTHORIZATION

### User Roles
The system supports role-based access control (RBAC). Customer Web uses:
- **Role:** `CUSTOMER`
- **Restricted from:** Bar Owner/Management portal (enforced in `/auth/login`)

### Existing Auth Endpoints

```javascript
// Backend: thesis-backend/routes/auth.js

POST /auth/register
// Register new customer account
// Body: { first_name, last_name, email, password, phone_number, date_of_birth }
// Response: { success, data: { token, user } }

POST /auth/login
// Customer login (CUSTOMER role allowed in customer app, blocked in bar owner app)
// Body: { email, password }
// Response: { success, data: { token, user, permissions } }

GET /auth/me
// Get current user profile
// Headers: { Authorization: "Bearer <token>" }
// Response: { success, data: user }

PUT /auth/me
// Update customer profile
// Body: { first_name, last_name, phone_number, date_of_birth, profile_picture }
```

### Role Restriction Notes
- Bar Owner portal blocks `CUSTOMER` role (returns 403 with code `ROLE_NOT_ALLOWED`)
- Customer Web should only allow `CUSTOMER` role
- Use JWT token in `Authorization: Bearer <token>` header for authenticated requests

---

## 2. BAR DISCOVERY & BROWSING

### Public Bar Endpoints

```javascript
// Backend: thesis-backend/routes/publicBars.js

GET /public/bars
// List all active bars (public, no auth required)
// Query params: { search, category, city, sortBy, page, limit }
// Response: { success, data: [bars], pagination }

GET /public/bars/:barId
// Get single bar details with reviews, menu, events
// Response: { success, data: { bar, menu, events, reviews, stats } }

GET /public/bars/:barId/menu
// Get bar menu items
// Response: { success, data: [menu_items] }

GET /public/bars/:barId/reviews
// Get bar reviews (public)
// Response: { success, data: [reviews with responses] }

GET /public/bars/:barId/events
// Get upcoming bar events
// Response: { success, data: [events] }
```

### Search & Filtering
- **Search:** by bar name, description, address
- **Filter:** by category, city, price_range
- **Sort:** by rating, review_count, distance (if geolocation enabled)

---

## 3. TABLE RESERVATIONS

### Reservation Flow

**Customer Journey:**
1. Browse available bars
2. Select bar → view table availability
3. Choose date, time, party size
4. Select table (if manual selection enabled)
5. Enter reservation details
6. **Create payment** (if deposit required)
7. Complete payment via PayMongo (GCash)
8. Receive confirmation

### Existing Reservation Endpoints

```javascript
// Backend: thesis-backend/routes/reservations.js

GET /reservations/availability
// Check table availability for specific date/time
// Query: { bar_id, date, start_time, party_size }
// Response: { success, data: { available_tables: [...] } }

POST /reservations
// Create new reservation
// Body: { 
//   bar_id, 
//   table_id (optional if auto-assign),
//   reservation_date,
//   reservation_time,
//   party_size,
//   customer_notes,
//   deposit_amount (if required)
// }
// Response: { success, data: reservation }

GET /reservations/my
// Get customer's reservations (requires auth)
// Response: { success, data: [reservations] }

PUT /reservations/:id/cancel
// Cancel reservation
// Response: { success, message }
```

### Payment Integration for Reservations

```javascript
// When deposit is required:
// 1. Create reservation with status = 'pending_payment'
// 2. Create PayMongo payment (see Payment Flow below)
// 3. On payment success webhook, update reservation status = 'confirmed'
// 4. Send confirmation notification
```

### Reservation Modes
- **Manual Approval:** Bar owner must approve
- **Auto Confirm:** Instant confirmation if table available
- Check `bars.reservation_mode` field

---

## 4. MENU ORDERING (POS Integration)

### Order Flow

**Customer Journey:**
1. Browse bar menu
2. Add items to cart
3. Review order summary
4. **Create payment**
5. Complete payment via PayMongo
6. Bar receives order notification
7. Bar staff processes order

### Menu Endpoints

```javascript
// Backend: thesis-backend/routes/publicBars.js

GET /public/bars/:barId/menu
// Get available menu items
// Response: { 
//   success, 
//   data: [{ 
//     id, menu_name, menu_description, 
//     selling_price, category, 
//     inventory_item_id, image_path, stock_status 
//   }] 
// }
```

### Order Endpoints

```javascript
// Backend: thesis-backend/routes/pos.js or create /orders.js for customers

POST /orders/create
// Create customer order
// Body: {
//   bar_id,
//   items: [{ menu_item_id, quantity, price }],
//   customer_notes,
//   delivery_type: 'dine_in' | 'pickup',
//   table_id (optional)
// }
// Response: { success, data: order }

GET /orders/my
// Get customer's order history
// Response: { success, data: [orders] }

GET /orders/:id
// Get order details
// Response: { success, data: order_with_items }
```

---

## 5. PAYMENT SYSTEM (PayMongo Integration)

### Payment Architecture

**Flow:**
```
Customer → Create Order/Reservation → Generate Payment → PayMongo Checkout → 
Webhook (payment.paid) → Update Transaction Status → Confirm Order/Reservation
```

### Payment Endpoints

```javascript
// Backend: thesis-backend/routes/payments.js

POST /payments/create
// Create PayMongo payment
// Body: {
//   amount,              // in cents (e.g., 50000 = PHP 500.00)
//   type: 'reservation' | 'order',
//   reference_id,        // reservation_id or order_id
//   bar_id,
//   customer_email,
//   customer_name,
//   description,
//   payment_method: 'gcash' | 'paymaya' | 'card'
// }
// Response: { 
//   success, 
//   data: { 
//     checkout_url,      // Redirect customer here
//     payment_intent_id,
//     transaction_id 
//   } 
// }

GET /payments/status/:transactionId
// Check payment status
// Response: { success, data: { status, paid_at, amount } }

POST /payments/webhook
// PayMongo webhook endpoint (handled by backend)
// Updates payment_transactions table
// Triggers order/reservation confirmation
```

### Payment Transaction Statuses

```sql
-- From payment_transactions table
'pending_payment'   // Created, awaiting payment
'paid'              // Payment successful
'failed'            // Payment failed
'cancelled'         // Cancelled by customer
'refunded'          // Refunded by admin
```

### Payment Flow Implementation

```javascript
// 1. Customer initiates payment
const createPayment = async (orderData) => {
  // Create order/reservation first
  const order = await api.post('/orders/create', orderData);
  
  // Create payment
  const payment = await api.post('/payments/create', {
    amount: order.total_amount * 100, // Convert to cents
    type: 'order',
    reference_id: order.id,
    bar_id: order.bar_id,
    customer_email: user.email,
    customer_name: `${user.first_name} ${user.last_name}`,
    description: `Order #${order.order_number}`,
    payment_method: 'gcash'
  });
  
  // Redirect to PayMongo checkout
  window.location.href = payment.checkout_url;
};

// 2. After payment, PayMongo redirects back to success_url
// Query params: ?payment_intent_id=xxx&status=succeeded

// 3. Backend webhook updates transaction status automatically
// 4. Frontend polls or checks payment status
const checkPaymentStatus = async (transactionId) => {
  const status = await api.get(`/payments/status/${transactionId}`);
  if (status.data.status === 'paid') {
    // Show success, redirect to order confirmation
  }
};
```

---

## 6. REVIEWS & RATINGS

### Review Flow

**Customer Journey:**
1. Complete order/reservation
2. Eligible to review after visit
3. Submit rating (1-5 stars) + comment
4. View bar owner response (if any)

### Review Endpoints

```javascript
// Backend: thesis-backend/routes/reviews.js

GET /reviews/eligibility/:barId
// Check if customer can review this bar
// Response: { success, eligible: boolean, reason }

POST /reviews
// Submit review
// Body: { bar_id, rating, comment }
// Response: { success, data: review }

GET /reviews/my
// Get customer's reviews
// Response: { success, data: [reviews_with_responses] }

PUT /reviews/:id
// Update own review
// Body: { rating, comment }

DELETE /reviews/:id
// Delete own review
```

### Review Response Display

```javascript
// Each review object includes:
{
  id, bar_id, customer_id,
  rating, comment,
  created_at, updated_at,
  customer_name,
  response: {              // If bar owner replied
    id, review_id,
    response, created_at,
    responder_name,
    responder_role         // For badge display
  }
}

// Frontend: Display badge if responder_role === 'BAR_OWNER'
```

---

## 7. EVENT PARTICIPATION

### Event Endpoints

```javascript
// Backend: thesis-backend/routes/events.js or publicBars.js

GET /public/bars/:barId/events
// List upcoming events
// Response: { success, data: [events] }

POST /events/:eventId/register
// Register for event (if registration enabled)
// Body: { customer_notes }
// Response: { success, data: registration }

GET /events/my-registrations
// Get customer's event registrations
// Response: { success, data: [registrations] }

POST /events/:eventId/comments
// Post comment on event
// Body: { comment_text }
// Response: { success, data: comment }
```

---

## 8. CUSTOMER PROFILE & PREFERENCES

### Profile Management

```javascript
// Use existing auth endpoints

PUT /auth/me
// Update profile
// Body: { first_name, last_name, phone_number, date_of_birth }

PUT /auth/password
// Change password
// Body: { current_password, new_password }

POST /auth/me/avatar
// Upload profile picture
// multipart/form-data: { profile_picture: File }
```

### Favorite Bars (if implemented)

```javascript
// Backend: bar_followers table exists

POST /bars/:barId/follow
// Follow/favorite a bar
// Response: { success, message }

DELETE /bars/:barId/unfollow
// Unfollow bar

GET /bars/following
// Get customer's followed bars
// Response: { success, data: [bars] }
```

---

## 9. DATABASE SCHEMA REFERENCE

### Key Tables for Customer Web

```sql
-- Users (customers)
users (
  id, email, password, first_name, last_name,
  role = 'CUSTOMER', phone_number, date_of_birth,
  profile_picture, is_active, created_at
)

-- Bars
bars (
  id, name, address, city, category,
  latitude, longitude, rating, review_count,
  gcash_number, gcash_account_name, -- For payouts
  image_path, logo_path, video_path,
  reservation_mode, minimum_reservation_deposit
)

-- Reservations
reservations (
  id, bar_id, customer_id, table_id,
  reservation_date, reservation_time, party_size,
  status, deposit_amount, customer_notes,
  created_at
)

-- Reviews
reviews (
  id, bar_id, customer_id,
  rating, comment, created_at
)

review_responses (
  id, review_id, user_id,
  response, created_at
)

-- Orders (POS or customer orders)
pos_orders (
  id, bar_id, customer_id, table_id,
  order_number, status, total_amount,
  payment_method, created_at
)

pos_order_items (
  id, order_id, menu_item_id, inventory_item_id,
  quantity, price, subtotal
)

-- Payments
payment_transactions (
  id, bar_id, customer_id, amount,
  payment_type: 'reservation' | 'order',
  reference_id, status,
  paymongo_payment_intent_id, checkout_url,
  paid_at, created_at
)

-- Menu
menu_items (
  id, bar_id, inventory_item_id,
  menu_name, menu_description,
  selling_price, category, is_available
)

inventory_items (
  id, bar_id, name, stock_qty, cost_price,
  image_path, stock_status
)
```

---

## 10. IMPLEMENTATION CHECKLIST

### Phase 1: Core Features
- [ ] Customer authentication (register, login, profile)
- [ ] Bar discovery & browsing (list, search, filter)
- [ ] Bar detail page (info, menu, reviews, events)
- [ ] Menu display with categories

### Phase 2: Reservations
- [ ] Table availability check
- [ ] Reservation creation
- [ ] Deposit payment (if required)
- [ ] Reservation management (view, cancel)

### Phase 3: Ordering
- [ ] Shopping cart functionality
- [ ] Order creation
- [ ] Payment integration
- [ ] Order tracking & history

### Phase 4: Payments (PayMongo)
- [ ] Payment creation endpoint integration
- [ ] GCash checkout flow
- [ ] Payment status polling
- [ ] Success/failure handling
- [ ] Transaction history

### Phase 5: Social Features
- [ ] Reviews & ratings
- [ ] Event registration
- [ ] Event comments
- [ ] Favorite bars (follow/unfollow)

### Phase 6: Polish
- [ ] Notifications (email/SMS for confirmations)
- [ ] Order status real-time updates
- [ ] Profile picture upload
- [ ] Location-based search (geolocation)

---

## 11. SECURITY & BEST PRACTICES

### Authentication
- Store JWT token in `localStorage` or `httpOnly` cookie
- Include token in all authenticated requests: `Authorization: Bearer <token>`
- Handle token expiration (401) → prompt re-login
- Validate customer role on frontend

### Payment Security
- **NEVER store PayMongo secret keys in frontend**
- All payment creation happens server-side
- Validate amounts server-side before creating payment
- Handle webhook verification properly (backend only)
- Use HTTPS for all payment-related requests

### Data Validation
- Validate all user inputs (email format, phone, dates)
- Sanitize text inputs (reviews, comments, notes)
- Check minimum/maximum values (party size, order quantity)
- Verify business logic (reservation date >= today)

### Error Handling
- Display user-friendly error messages
- Log errors for debugging (Sentry, console)
- Handle network failures gracefully
- Provide fallback UI states (loading, error, empty)

---

## 12. UI/UX RECOMMENDATIONS

### Design System
- Use **TailwindCSS** for styling (consistent with bar owner app)
- Use **Lucide React** for icons
- Use **React Router** for navigation
- Use **Zustand** for state management
- Use **React Hot Toast** for notifications

### Key Pages
1. **Home/Landing** - Featured bars, search, categories
2. **Bar Listing** - Grid/list view, filters, sort
3. **Bar Detail** - Info, menu, reviews, events, booking CTA
4. **Reservation** - Date picker, table selection, payment
5. **Menu/Order** - Cart, checkout, payment
6. **Profile** - Account settings, order history, reviews
7. **Order Tracking** - Real-time status, contact bar
8. **Payment Success** - Confirmation, receipt, next steps

### Mobile-First
- Responsive design (mobile, tablet, desktop)
- Touch-friendly buttons (min 44px)
- Bottom navigation for mobile
- Swipeable carousels for images

---

## 13. PAYMONGO INTEGRATION DETAILS

### Environment Variables
```env
PAYMONGO_PUBLIC_KEY=pk_test_xxxx
PAYMONGO_SECRET_KEY=sk_test_xxxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxxx
```

### Payment Methods Supported
- **GCash** (most common in PH)
- **PayMaya**
- **Credit/Debit Cards**
- **GrabPay** (optional)

### Checkout Flow
```javascript
// 1. Create payment intent (backend)
const paymentIntent = await paymongo.createPaymentIntent({
  amount: totalAmount * 100,        // PHP 500 = 50000 cents
  currency: 'PHP',
  payment_method_allowed: ['gcash'],
  metadata: {
    bar_id, customer_id, order_id, type: 'order'
  }
});

// 2. Create payment source (frontend redirects to GCash)
const source = await paymongo.createSource({
  type: 'gcash',
  amount: totalAmount * 100,
  currency: 'PHP',
  redirect: {
    success: 'https://customer.app/payment/success',
    failed: 'https://customer.app/payment/failed'
  }
});

// 3. Customer completes payment on GCash app/web

// 4. Webhook receives payment.paid event
// Backend updates payment_transactions.status = 'paid'
// Backend confirms reservation/order
```

---

## 14. EXISTING BACKEND ROUTES SUMMARY

| Route | Method | Purpose | Auth Required |
|-------|--------|---------|---------------|
| `/auth/register` | POST | Register customer | No |
| `/auth/login` | POST | Customer login | No |
| `/auth/me` | GET | Get profile | Yes |
| `/public/bars` | GET | List bars | No |
| `/public/bars/:id` | GET | Bar details | No |
| `/public/bars/:id/menu` | GET | Bar menu | No |
| `/reservations/availability` | GET | Check tables | No |
| `/reservations` | POST | Create reservation | Yes |
| `/reservations/my` | GET | My reservations | Yes |
| `/orders/create` | POST | Create order | Yes |
| `/payments/create` | POST | Create payment | Yes |
| `/reviews` | POST | Submit review | Yes |
| `/reviews/my` | GET | My reviews | Yes |
| `/events/my-registrations` | GET | My events | Yes |

---

## 15. MIGRATION NOTES

### If New Tables Are Needed
- Create migration file: `thesis-backend/migrations/customer_feature_name.sql`
- Use `IF NOT EXISTS` for safety
- Add indexes for performance
- Update this document with schema changes

### Existing Tables to Reuse
✅ `users` (role='CUSTOMER')  
✅ `bars`, `reservations`, `reviews`, `review_responses`  
✅ `menu_items`, `inventory_items`  
✅ `payment_transactions`, `pos_orders`, `pos_order_items`  
✅ `bar_followers`, `bar_events`  

**No new architecture needed - system is ready!**

---

## 16. NEXT STEPS FOR DEVELOPERS

1. **Review this document thoroughly**
2. **Test existing endpoints** using Postman/Insomnia
3. **Set up PayMongo test account** and get API keys
4. **Create React app structure** (pages, components, hooks)
5. **Implement authentication flow** first
6. **Build bar discovery & menu** (read-only features)
7. **Integrate reservations** with payment
8. **Integrate ordering** with payment
9. **Add reviews & social features**
10. **Test end-to-end** with real PayMongo test payments

---

## 17. SUPPORT & REFERENCES

### Backend Code Locations
- Auth: `thesis-backend/routes/auth.js`
- Public Bars: `thesis-backend/routes/publicBars.js`
- Reservations: `thesis-backend/routes/reservations.js`
- Reviews: `thesis-backend/routes/reviews.js`
- Payments: `thesis-backend/routes/payments.js` (check if exists)
- POS: `thesis-backend/routes/pos.js`

### PayMongo Documentation
- Docs: https://developers.paymongo.com/
- GCash: https://developers.paymongo.com/docs/gcash-via-sources
- Webhooks: https://developers.paymongo.com/docs/webhooks

### Database Schema
- Review migrations: `thesis-backend/migrations/*.sql`
- Check existing tables: Run `SHOW TABLES;` in MySQL

---

**This system is production-ready for customer web implementation. All backend infrastructure exists. Focus on building a beautiful, intuitive React frontend that connects to these robust APIs.**

**Happy Coding! 🎉**
