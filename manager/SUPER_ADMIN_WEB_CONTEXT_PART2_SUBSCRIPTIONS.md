# SUPER ADMIN WEB - SUBSCRIPTION & BRANCH MANAGEMENT CONTEXT

**Last Updated:** March 18, 2026  
**Database:** `tpg`

---

## 📦 SUBSCRIPTION SYSTEM

### Overview

The platform operates on a **subscription-based model** where bar owners pay monthly fees to use the system. Each subscription plan determines:
- Number of branches allowed
- Access to premium features
- Support level
- Analytics capabilities

**Critical Flow:**
```
Bar Owner Registers → Chooses Plan → Payment → Super Admin Approves → Subscription Active
```

---

## DATABASE SCHEMA: SUBSCRIPTIONS

### 1. `subscription_plans` — Available Plans

```sql
CREATE TABLE `subscription_plans` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `billing_cycle` ENUM('monthly', 'quarterly', 'yearly') NOT NULL DEFAULT 'monthly',
  `max_branches` INT(11) NOT NULL DEFAULT 1 COMMENT 'Max branches allowed',
  `max_users` INT(11) NULL DEFAULT NULL COMMENT 'Max staff users (NULL = unlimited)',
  `features` JSON NULL COMMENT 'Feature flags and limits',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT(11) DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```

**Example Plans:**
```sql
INSERT INTO `subscription_plans` VALUES
  (1, 'Starter', 'Basic plan for single location', 999.00, 'monthly', 1, 10, 
   '{"pos":true,"inventory":true,"reservations":true,"analytics":false}', 1, 1),
  (2, 'Professional', 'For growing businesses', 2499.00, 'monthly', 3, 50,
   '{"pos":true,"inventory":true,"reservations":true,"analytics":true,"multi_branch":true}', 1, 2),
  (3, 'Enterprise', 'Unlimited branches', 4999.00, 'monthly', 999, NULL,
   '{"pos":true,"inventory":true,"reservations":true,"analytics":true,"multi_branch":true,"priority_support":true}', 1, 3);
```

### 2. `subscriptions` — Active Bar Subscriptions

```sql
CREATE TABLE `subscriptions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL COMMENT 'Bar owner user ID',
  `bar_id` INT(11) NULL COMMENT 'First/primary bar ID',
  `plan_id` INT(11) NOT NULL,
  `status` ENUM('pending', 'active', 'cancelled', 'expired', 'past_due', 'rejected') NOT NULL DEFAULT 'pending',
  `start_date` DATE NULL DEFAULT NULL,
  `end_date` DATE NULL DEFAULT NULL,
  `next_billing_date` DATE NULL DEFAULT NULL,
  `auto_renew` TINYINT(1) NOT NULL DEFAULT 1,
  `payment_method` VARCHAR(50) NULL,
  `approved_by` INT(11) NULL COMMENT 'Super Admin user ID',
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  `rejection_reason` TEXT NULL,
  `cancelled_at` TIMESTAMP NULL DEFAULT NULL,
  `cancellation_reason` TEXT NULL,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_status` (`user_id`, `status`)
);
```

**Status Flow:**
- `pending` → Bar owner submitted, awaiting Super Admin approval
- `active` → Subscription is active ✅
- `past_due` → Payment failed, grace period
- `expired` → Subscription ended
- `cancelled` → Bar owner cancelled
- `rejected` → Super Admin rejected ❌

### 3. `subscription_payments` — Payment History

```sql
CREATE TABLE `subscription_payments` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `subscription_id` INT(11) NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `status` ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(50) NULL,
  `payment_transaction_id` INT(11) NULL COMMENT 'Links to payment_transactions',
  `receipt_url` VARCHAR(500) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```

---

## SUBSCRIPTION APPROVAL WORKFLOW

### Bar Owner Side:
1. Bar owner registers account
2. Submits bar details + documents
3. Chooses subscription plan
4. Makes initial payment via PayMongo
5. Waits for Super Admin approval

### Super Admin Side:
1. Receives notification of new subscription request
2. Reviews:
   - Bar documentation
   - Owner verification status
   - Payment confirmation
3. Approves or Rejects:
   - **Approve:** Subscription status → `active`, bar status → `approved`
   - **Reject:** Subscription status → `rejected`, add rejection reason

---

## BACKEND API ENDPOINTS: SUBSCRIPTIONS

### 1. Subscription Plan Management

**`GET /super-admin/subscription-plans`** — List all plans

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Starter",
      "description": "Basic plan for single location",
      "price": 999.00,
      "billing_cycle": "monthly",
      "max_branches": 1,
      "max_users": 10,
      "features": {"pos": true, "inventory": true, "reservations": true},
      "is_active": true,
      "active_subscriptions": 45,
      "monthly_revenue": 44955.00
    }
  ]
}
```

**`POST /super-admin/subscription-plans`** — Create new plan

**`PUT /super-admin/subscription-plans/:id`** — Update plan

**`DELETE /super-admin/subscription-plans/:id`** — Deactivate plan

### 2. Subscription Approvals

**`GET /super-admin/subscription-approvals`** — Pending subscriptions

**Query Parameters:**
- `status`: pending, active, rejected
- `search`: Bar name, owner name, email
- `plan_id`: Filter by plan

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 15,
      "bar_id": 25,
      "bar_name": "New Sports Bar",
      "owner_name": "John Doe",
      "owner_email": "john@sportsbar.com",
      "plan_id": 1,
      "plan_name": "Starter",
      "price": 999.00,
      "status": "pending",
      "payment_status": "paid",
      "payment_transaction_id": 250,
      "created_at": "2024-03-18T10:00:00.000Z",
      "documents_submitted": true,
      "verification_status": "manual_review"
    }
  ]
}
```

**`POST /super-admin/subscriptions/:id/approve`** — Approve subscription

**Request:**
```json
{
  "start_date": "2024-03-18",
  "notes": "All documents verified"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription approved successfully",
  "data": {
    "subscription_id": 15,
    "status": "active",
    "start_date": "2024-03-18",
    "end_date": "2024-04-18",
    "next_billing_date": "2024-04-18"
  }
}
```

**`POST /super-admin/subscriptions/:id/reject`** — Reject subscription

**Request:**
```json
{
  "reason": "Incomplete documentation - missing business permit"
}
```

### 3. Active Subscription Management

**`GET /super-admin/subscriptions`** — List all subscriptions

**Query Parameters:**
- `status`: active, expired, cancelled
- `plan_id`: Filter by plan
- `search`: Bar/owner search
- `from`, `to`: Date range

**`PUT /super-admin/subscriptions/:id/extend`** — Extend subscription

**Request:**
```json
{
  "days": 30,
  "reason": "Compensation for downtime"
}
```

**`POST /super-admin/subscriptions/:id/cancel`** — Force cancel subscription

**Request:**
```json
{
  "reason": "Violation of terms - fraudulent activity",
  "immediate": true
}
```

**`POST /super-admin/subscriptions/:id/reactivate`** — Reactivate cancelled/expired

---

## 🏢 MULTI-BRANCH MANAGEMENT

### Overview

Bar owners can create **multiple branches** based on their subscription plan:
- **Starter Plan:** 1 branch
- **Professional Plan:** 3 branches
- **Enterprise Plan:** Unlimited branches

Each branch has its own:
- Staff members
- Inventory
- POS system
- Reservations
- Analytics

All branches share the same owner account and subscription.

---

## DATABASE SCHEMA: BRANCHES

### `bars` Table — Each Bar/Branch

```sql
CREATE TABLE `bars` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `owner_id` INT(11) NOT NULL COMMENT 'Bar owner user_id',
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `address` VARCHAR(255) NULL,
  `city` VARCHAR(100) NULL,
  `state` VARCHAR(100) NULL,
  `zip_code` VARCHAR(20) NULL,
  `country` VARCHAR(100) DEFAULT 'Philippines',
  `phone` VARCHAR(20) NULL,
  `contact_number` VARCHAR(20) NULL,
  `email` VARCHAR(100) NULL,
  `website` VARCHAR(200) NULL,
  `latitude` DECIMAL(10,8) NULL,
  `longitude` DECIMAL(11,8) NULL,
  `status` ENUM('pending', 'approved', 'suspended', 'rejected') DEFAULT 'pending',
  `rejection_reason` TEXT NULL,
  `approved_by` INT(11) NULL COMMENT 'Super Admin user ID',
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  `is_main_branch` TINYINT(1) DEFAULT 0 COMMENT 'First branch created',
  `branch_code` VARCHAR(20) NULL COMMENT 'Internal branch identifier',
  `opening_hours` JSON NULL,
  `amenities` JSON NULL,
  `image_path` VARCHAR(500) NULL,
  `icon_path` VARCHAR(500) NULL,
  `gif_path` VARCHAR(500) NULL,
  `rating` DECIMAL(3,2) DEFAULT 0.00,
  `review_count` INT(11) DEFAULT 0,
  `gcash_number` VARCHAR(20) NULL COMMENT 'For payouts',
  `gcash_account_name` VARCHAR(255) NULL,
  `payout_enabled` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_owner` (`owner_id`),
  KEY `idx_status` (`status`)
);
```

**Key Points:**
- Each bar has `owner_id` linking to bar owner account
- `is_main_branch = 1` for the first branch created
- `status` controls if bar is operational
- Super Admin must approve each branch

---

## BRANCH APPROVAL WORKFLOW

### Bar Owner Creates New Branch:
1. Check if subscription allows more branches
2. Submit branch details:
   - Name, address, contact
   - Operating hours
   - GCash details
3. Status: `pending`
4. Notification sent to Super Admin

### Super Admin Approval:
1. Review branch details
2. Verify location/documentation
3. Approve or Reject:
   - **Approve:** status → `approved`, branch goes live
   - **Reject:** status → `rejected`, add reason

---

## BACKEND API ENDPOINTS: BRANCH MANAGEMENT

### 1. Branch Approvals

**`GET /super-admin/bars?status=pending`** — Pending branches

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 25,
      "owner_id": 12,
      "name": "The Craft Bar - BGC Branch",
      "address": "123 BGC Street, Taguig City",
      "phone": "09171234567",
      "email": "bgc@craftbar.com",
      "status": "pending",
      "is_main_branch": false,
      "owner_name": "Jane Smith",
      "owner_email": "jane@craftbar.com",
      "subscription_plan": "Professional",
      "current_branches": 2,
      "max_branches": 3,
      "created_at": "2024-03-18T10:00:00.000Z"
    }
  ]
}
```

**`POST /super-admin/bars/:id/approve`** — Approve branch

**`POST /super-admin/bars/:id/reject`** — Reject branch with reason

**`POST /super-admin/bars/:id/suspend`** — Suspend operational branch

**Request:**
```json
{
  "reason": "Health code violations reported"
}
```

**`POST /super-admin/bars/:id/reactivate`** — Reactivate suspended branch

### 2. Branch Monitoring

**`GET /super-admin/bars`** — List all branches

**Query Parameters:**
- `status`: approved, pending, suspended, rejected
- `owner_id`: Filter by owner
- `search`: Name, city, address
- `limit`: Number of results

**`GET /super-admin/bars/:id`** — Branch details + analytics

**Response:**
```json
{
  "success": true,
  "data": {
    "bar": {
      "id": 1,
      "name": "The Craft Bar",
      "owner_name": "Jane Smith",
      "status": "approved",
      "address": "123 Main St, Manila",
      "phone": "09171234567",
      "email": "info@craftbar.com",
      "is_main_branch": true,
      "gcash_number": "09171234567",
      "gcash_account_name": "The Craft Bar Inc"
    },
    "statistics": {
      "total_staff": 12,
      "total_reservations": 150,
      "total_orders": 1250,
      "total_revenue": 125000.00,
      "pending_payouts": 5000.00,
      "rating": 4.5,
      "review_count": 45
    },
    "recent_activity": []
  }
}
```

---

## BRANCH LIMIT ENFORCEMENT

**Backend Logic:**

```javascript
// Check branch limit before allowing new branch creation
router.post("/bars", requireAuth, async (req, res) => {
  const ownerId = req.user.id;
  
  // Get user's subscription
  const [subs] = await pool.query(
    `SELECT s.*, sp.max_branches 
     FROM subscriptions s
     JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.user_id = ? AND s.status = 'active'`,
    [ownerId]
  );
  
  if (!subs.length) {
    return res.status(403).json({ 
      success: false, 
      message: "No active subscription" 
    });
  }
  
  const maxBranches = subs[0].max_branches;
  
  // Count current branches
  const [count] = await pool.query(
    "SELECT COUNT(*) as total FROM bars WHERE owner_id = ? AND status != 'rejected'",
    [ownerId]
  );
  
  if (count[0].total >= maxBranches) {
    return res.status(403).json({
      success: false,
      message: `Branch limit reached (${maxBranches}). Please upgrade your subscription.`
    });
  }
  
  // Create new branch...
});
```

---

## SUPER ADMIN KEY ACTIONS

### Subscription Management:
✅ Approve/reject new subscription requests  
✅ View all active subscriptions  
✅ Manually extend subscription periods  
✅ Force cancel fraudulent subscriptions  
✅ Create/edit subscription plans  
✅ View revenue per plan  

### Branch Management:
✅ Approve/reject new branch requests  
✅ Suspend branches for violations  
✅ View all branches across the platform  
✅ Monitor branch performance  
✅ Enforce branch limits per plan  
✅ Override branch status (emergency)  

---

**END OF PART 2: SUBSCRIPTIONS & BRANCHES**

See PART 3 for Customer Banning, RBAC, and Audit Logs.
