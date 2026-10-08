# SUPER ADMIN WEB - CUSTOMER BANNING, RBAC & AUDIT LOGS

**Last Updated:** March 18, 2026  
**Database:** `tpg`

---

## 🚫 CUSTOMER BANNING SYSTEM

### Two-Level Banning System

The platform implements a **dual-level banning system**:

1. **Global Platform Ban** (Super Admin only)
   - Customer is banned from ALL bars on the platform
   - Prevents login and any platform interaction
   - Used for serious violations (fraud, harassment, legal issues)

2. **Per-Bar Ban** (Bar Owner/Manager)
   - Customer is banned from a SPECIFIC bar only
   - Can still use other bars on the platform
   - Used for bar-specific incidents (disturbances, unpaid bills)

---

## DATABASE SCHEMA: BANNING

### 1. Global Ban — `users` Table Columns

```sql
ALTER TABLE `users` ADD COLUMN `is_banned` TINYINT(1) DEFAULT 0;
ALTER TABLE `users` ADD COLUMN `banned_at` TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN `banned_by` INT(11) NULL COMMENT 'Super Admin user ID';
ALTER TABLE `users` ADD COLUMN `ban_reason` TEXT NULL;

ALTER TABLE `users` ADD INDEX `idx_banned` (`is_banned`);
ALTER TABLE `users` ADD CONSTRAINT `fk_users_banned_by` 
  FOREIGN KEY (`banned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL;
```

**Key Points:**
- `is_banned = 1` → User cannot login or interact with platform
- `banned_by` → Which Super Admin issued the ban
- `ban_reason` → Required explanation for audit trail

### 2. Per-Bar Ban — `customer_bar_bans` Table

```sql
CREATE TABLE `customer_bar_bans` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `customer_user_id` INT(11) NOT NULL COMMENT 'Banned customer',
  `bar_id` INT(11) NOT NULL COMMENT 'Bar issuing the ban',
  `reason` TEXT NOT NULL,
  `banned_by` INT(11) NOT NULL COMMENT 'Staff who issued ban',
  `banned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active` TINYINT(1) DEFAULT 1,
  `unbanned_at` TIMESTAMP NULL DEFAULT NULL,
  `unbanned_by` INT(11) NULL,
  `notes` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_customer_bar` (`customer_user_id`, `bar_id`),
  KEY `idx_bar_active` (`bar_id`, `is_active`)
);
```

**Key Points:**
- Each customer can have one active ban per bar
- `is_active = 1` → Ban is currently enforced
- Can be lifted by bar owner/manager or Super Admin

---

## BAN ENFORCEMENT LOGIC

### Global Ban Check (Authentication Level)

**File:** `thesis-backend/middleware/auth.js`

```javascript
const requireAuth = async (req, res, next) => {
  try {
    // ... JWT verification ...
    
    const [user] = await pool.query(
      `SELECT id, email, role, bar_id, is_banned, ban_reason 
       FROM users WHERE id = ?`,
      [userId]
    );
    
    if (user[0].is_banned) {
      return res.status(403).json({
        success: false,
        message: "Your account has been banned from the platform",
        ban_reason: user[0].ban_reason
      });
    }
    
    req.user = user[0];
    next();
  } catch (error) {
    // Handle error
  }
};
```

### Per-Bar Ban Check (Reservation/Order Level)

```javascript
// Check before allowing reservation
const checkBarBan = async (customerId, barId) => {
  const [ban] = await pool.query(
    `SELECT * FROM customer_bar_bans 
     WHERE customer_user_id = ? AND bar_id = ? AND is_active = 1`,
    [customerId, barId]
  );
  
  return ban.length > 0;
};

// Usage in reservation endpoint
router.post("/reservations", requireAuth, async (req, res) => {
  const { bar_id, table_id, date, time } = req.body;
  const customerId = req.user.id;
  
  // Check if customer is banned from this bar
  if (await checkBarBan(customerId, bar_id)) {
    return res.status(403).json({
      success: false,
      message: "You are banned from making reservations at this bar"
    });
  }
  
  // Continue with reservation...
});
```

---

## BACKEND API ENDPOINTS: CUSTOMER BANNING

### 1. Global Ban Management (Super Admin)

**`GET /super-admin/customers/banned`** — List globally banned customers

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "email": "problematic@email.com",
      "first_name": "John",
      "last_name": "Doe",
      "phone": "09171234567",
      "is_banned": true,
      "banned_at": "2024-03-15T10:00:00.000Z",
      "banned_by": 1,
      "banned_by_name": "Admin User",
      "ban_reason": "Fraudulent chargebacks across multiple bars",
      "total_reservations": 25,
      "total_orders": 15,
      "total_spent": 12500.00
    }
  ]
}
```

**`POST /super-admin/customers/:id/ban`** — Ban customer globally

**Request:**
```json
{
  "reason": "Multiple fraudulent chargebacks. Customer violated terms of service by deliberately disputing legitimate charges."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer banned globally from platform",
  "data": {
    "customer_id": 123,
    "banned_at": "2024-03-18T10:00:00.000Z",
    "banned_by": 1
  }
}
```

**`DELETE /super-admin/customers/:id/ban`** — Unban customer globally

**Request:**
```json
{
  "notes": "Customer resolved issues with bar owners. Second chance granted."
}
```

### 2. Per-Bar Ban Monitoring (Super Admin)

**`GET /super-admin/bar-bans`** — List all per-bar bans

**Query Parameters:**
- `bar_id`: Filter by specific bar
- `customer_id`: Filter by customer
- `is_active`: true/false
- `search`: Customer name, email

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 45,
      "customer_user_id": 200,
      "customer_name": "Jane Smith",
      "customer_email": "jane@email.com",
      "bar_id": 10,
      "bar_name": "The Craft Bar",
      "reason": "Caused disturbance after excessive drinking",
      "banned_by": 15,
      "banned_by_name": "Manager Mike",
      "banned_at": "2024-03-10T20:00:00.000Z",
      "is_active": true
    }
  ]
}
```

**`POST /super-admin/bar-bans/:id/override`** — Lift per-bar ban

**Request:**
```json
{
  "notes": "Super Admin override - customer appealed successfully"
}
```

---

## 👥 RBAC SYSTEM (Role-Based Access Control)

### Overview

The platform uses a comprehensive RBAC system with:
- **6 User Roles**
- **30+ Granular Permissions**
- **Role-Permission Mapping**
- **User-Permission Customization**

---

## DATABASE SCHEMA: RBAC

### 1. `roles` — System Roles

```sql
CREATE TABLE `roles` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` TEXT NULL,
  `is_system_role` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_role_name` (`name`)
);

INSERT INTO `roles` VALUES
  (1, 'SUPER_ADMIN', 'Platform administrator with full system access', 1),
  (2, 'BAR_OWNER', 'Bar owner with full bar management access', 1),
  (3, 'MANAGER', 'Bar manager with management permissions', 1),
  (4, 'HR', 'HR staff with employee management permissions', 1),
  (5, 'STAFF', 'General staff with limited permissions', 1),
  (6, 'CASHIER', 'Cashier with POS and sales permissions', 1),
  (7, 'CUSTOMER', 'Customer role for public users', 1);
```

### 2. `permissions` — System Permissions

```sql
CREATE TABLE `permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(50) NULL COMMENT 'Group permissions by feature',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_permission_code` (`code`)
);
```

**Permission Categories & Examples:**

**POS & Sales:**
- `POS_ACCESS` — Access POS system
- `POS_CREATE_ORDER` — Create orders
- `POS_VIEW_ORDERS` — View order history
- `POS_VIEW_SALES` — View sales reports

**Inventory:**
- `INVENTORY_READ` — View inventory
- `INVENTORY_MANAGE` — Add/edit inventory items

**Menu:**
- `MENU_READ` — View menu
- `MENU_MANAGE` — Add/edit menu items

**Reservations:**
- `RESERVATION_READ` — View reservations
- `RESERVATION_MANAGE` — Approve/reject reservations

**Bar Management:**
- `BAR_SETTINGS` — Edit bar settings
- `BAR_MANAGE_USERS` — Manage staff accounts
- `BAR_EVENTS_READ` — View events
- `BAR_EVENTS_MANAGE` — Create/edit events

**HR & Payroll:**
- `HR_VIEW_EMPLOYEES` — View employee list
- `HR_MANAGE_EMPLOYEES` — Add/edit employees
- `HR_MANAGE_PAYROLL` — Process payroll
- `HR_VIEW_ATTENDANCE` — View attendance

**Branch Management:**
- `BRANCH_MANAGE` — Create/manage branches

**Analytics:**
- `ANALYTICS_VIEW` — View analytics dashboard

### 3. `role_permissions` — Default Role Permissions

```sql
CREATE TABLE `role_permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `role_id` INT(11) NOT NULL,
  `permission_id` INT(11) NOT NULL,
  `granted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_role_permission` (`role_id`, `permission_id`)
);
```

**Example: Staff Role Default Permissions**
```sql
INSERT INTO role_permissions (role_id, permission_id)
SELECT 5, id FROM permissions WHERE code IN (
  'POS_ACCESS',
  'POS_CREATE_ORDER',
  'POS_VIEW_ORDERS',
  'RESERVATION_READ',
  'INVENTORY_READ'
);
```

### 4. `user_permissions` — User-Specific Permissions

```sql
CREATE TABLE `user_permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `permission_id` INT(11) NOT NULL,
  `granted_by` INT(11) NULL COMMENT 'Who granted this permission',
  `granted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_permission` (`user_id`, `permission_id`)
);
```

**Key Points:**
- Bar owners can customize permissions per user
- Overrides default role permissions
- Allows fine-grained access control

---

## SUPER ADMIN ROLE & PERMISSIONS

**Super Admin has ALL permissions by default**, including exclusive ones:

### Exclusive Super Admin Permissions:
- `SUPER_ADMIN_FULL_ACCESS` — Complete system access
- `SUPER_ADMIN_MANAGE_BARS` — Approve/suspend bars
- `SUPER_ADMIN_MANAGE_SUBSCRIPTIONS` — Manage subscriptions
- `SUPER_ADMIN_MANAGE_PAYOUTS` — Process payouts
- `SUPER_ADMIN_BAN_CUSTOMERS` — Global customer ban
- `SUPER_ADMIN_VIEW_FINANCIALS` — View all financial data
- `SUPER_ADMIN_SYSTEM_SETTINGS` — Change system settings
- `SUPER_ADMIN_MANAGE_PLANS` — Create/edit subscription plans

**Backend Middleware:**

```javascript
// Require Super Admin role
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      success: false,
      message: "Super Admin access required"
    });
  }
  next();
};

// Usage
router.get("/super-admin/dashboard", requireAuth, requireSuperAdmin, async (req, res) => {
  // Super Admin only endpoint
});
```

---

## BACKEND API ENDPOINTS: RBAC

### 1. Role Management

**`GET /super-admin/roles`** — List all roles

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "SUPER_ADMIN",
      "description": "Platform administrator",
      "is_system_role": true,
      "user_count": 3,
      "permission_count": 50
    }
  ]
}
```

**`GET /super-admin/roles/:id/permissions`** — Get role permissions

### 2. Permission Management

**`GET /super-admin/permissions`** — List all permissions

**Query Parameters:**
- `category`: Filter by category

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "POS_ACCESS",
      "name": "Access POS System",
      "description": "Can access the Point of Sale interface",
      "category": "POS",
      "roles_with_permission": ["BAR_OWNER", "MANAGER", "STAFF", "CASHIER"]
    }
  ]
}
```

### 3. User Permission Monitoring

**`GET /super-admin/users/:id/permissions`** — View user permissions

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 50,
    "name": "John Doe",
    "role": "STAFF",
    "bar_id": 10,
    "bar_name": "The Craft Bar",
    "permissions": [
      {
        "code": "POS_ACCESS",
        "name": "Access POS System",
        "source": "role",
        "granted_at": "2024-03-01T00:00:00.000Z"
      },
      {
        "code": "MENU_MANAGE",
        "name": "Manage Menu Items",
        "source": "custom",
        "granted_by": "Jane Smith (Owner)",
        "granted_at": "2024-03-15T10:00:00.000Z"
      }
    ]
  }
}
```

---

## 📋 AUDIT LOGS

### Overview

The system maintains **two levels of audit logs**:

1. **Bar-Level Logs** (`audit_logs`) — Bar-specific actions
2. **Platform-Level Logs** (`platform_audit_logs`) — Super Admin actions

---

## DATABASE SCHEMA: AUDIT LOGS

### 1. `audit_logs` — Bar Activity Logs

```sql
CREATE TABLE `audit_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `user_id` INT(11) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity` VARCHAR(50) NOT NULL COMMENT 'user, inventory, menu, order, etc.',
  `entity_id` INT(11) NULL COMMENT 'Related entity ID',
  `details` JSON NULL COMMENT 'Action details',
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_action` (`bar_id`, `action`),
  KEY `idx_user` (`user_id`),
  KEY `idx_created` (`created_at`)
);
```

**Example Actions:**
- `LOGIN` — User login
- `RESET_PASSWORD` — Password reset
- `CREATE_INVENTORY` — Inventory item created
- `UPDATE_MENU_ITEM` — Menu item updated
- `POS_CREATE_ORDER` — Order created
- `POS_COMPLETE_ORDER` — Order completed
- `UPDATE_USER_ROLE` — Staff role changed
- `APPROVE_RESERVATION` — Reservation approved

**Example Log Entry:**
```json
{
  "id": 150,
  "bar_id": 10,
  "user_id": 15,
  "action": "POS_COMPLETE_ORDER",
  "entity": "pos_orders",
  "entity_id": 250,
  "details": {
    "payment_method": "cash",
    "total": 1500.00,
    "received": 2000.00,
    "change": 500.00
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2024-03-18T10:30:00.000Z"
}
```

### 2. `platform_audit_logs` — Super Admin Activity

```sql
CREATE TABLE `platform_audit_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin_user_id` INT(11) NOT NULL COMMENT 'Super Admin who performed action',
  `action` VARCHAR(100) NOT NULL,
  `entity` VARCHAR(50) NOT NULL COMMENT 'bar, user, subscription, payout, etc.',
  `entity_id` INT(11) NULL,
  `details` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin` (`admin_user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created` (`created_at`)
);
```

**Example Super Admin Actions:**
- `SUPER_ADMIN_APPROVE_BAR` — Bar approved
- `SUPER_ADMIN_SUSPEND_BAR` — Bar suspended
- `SUPER_ADMIN_BAN_CUSTOMER` — Customer banned globally
- `SUPER_ADMIN_APPROVE_SUBSCRIPTION` — Subscription approved
- `SUPER_ADMIN_PROCESS_PAYOUT` — Payout processed
- `SUPER_ADMIN_UPDATE_PLATFORM_FEE` — Platform fee changed
- `SUPER_ADMIN_CREATE_PLAN` — Subscription plan created

---

## BACKEND API ENDPOINTS: AUDIT LOGS

### 1. Platform Audit Logs (Super Admin Actions)

**`GET /super-admin/audit-logs`** — View platform audit logs

**Query Parameters:**
- `action`: Filter by action type
- `admin_id`: Filter by Super Admin
- `entity`: Filter by entity type
- `from`, `to`: Date range
- `search`: Search details
- `limit`: Number of results

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 500,
        "admin_user_id": 1,
        "admin_name": "Super Admin",
        "admin_email": "admin@platform.com",
        "action": "SUPER_ADMIN_SUSPEND_BAR",
        "entity": "bar",
        "entity_id": 15,
        "details": {
          "bar_name": "The Craft Bar",
          "reason": "Multiple customer complaints"
        },
        "ip_address": "192.168.1.1",
        "created_at": "2024-03-18T10:00:00.000Z"
      }
    ],
    "total": 500,
    "actions_summary": {
      "SUPER_ADMIN_APPROVE_BAR": 50,
      "SUPER_ADMIN_SUSPEND_BAR": 5,
      "SUPER_ADMIN_PROCESS_PAYOUT": 200
    }
  }
}
```

### 2. Bar Activity Logs (Super Admin View)

**`GET /super-admin/bars/:id/audit-logs`** — View specific bar's activity

**Response:**
```json
{
  "success": true,
  "data": {
    "bar_id": 10,
    "bar_name": "The Craft Bar",
    "logs": [
      {
        "id": 1500,
        "user_id": 15,
        "user_name": "Staff John",
        "action": "POS_COMPLETE_ORDER",
        "entity": "pos_orders",
        "entity_id": 250,
        "details": {"total": 1500.00},
        "created_at": "2024-03-18T10:30:00.000Z"
      }
    ]
  }
}
```

### 3. User Activity History

**`GET /super-admin/users/:id/activity`** — View user activity across all bars

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": 50,
    "name": "John Doe",
    "role": "STAFF",
    "total_actions": 1250,
    "recent_activity": [],
    "actions_summary": {
      "LOGIN": 200,
      "POS_CREATE_ORDER": 500,
      "UPDATE_INVENTORY": 50
    }
  }
}
```

---

## SUPER ADMIN AUDIT TRAIL BEST PRACTICES

✅ **All Super Admin actions are logged automatically**  
✅ **Cannot delete audit logs (immutable)**  
✅ **IP address and user agent captured**  
✅ **JSON details for complex actions**  
✅ **Searchable and filterable**  
✅ **Export capability for compliance**  

---

**END OF PART 3: BANNING, RBAC & AUDIT LOGS**

See PART 4 for Complete Feature List and Implementation Guide.
