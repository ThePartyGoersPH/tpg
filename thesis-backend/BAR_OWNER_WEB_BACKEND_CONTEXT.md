# Bar Owner Web Application — Backend Integration Context

> **Purpose:** Developer-friendly reference for building the **Bar Owner React Website**.
> The backend (Express.js + MySQL/MariaDB) is **shared** and **must not be changed**.
> Base URL default: `http://localhost:3000`

---

## 1. Authentication

### 1.1 Login

| | |
|---|---|
| **Endpoint** | `POST /auth/login` |
| **Auth** | None |
| **Body** | `{ "email": "string", "password": "string" }` |
| **Response** | `{ "token": "JWT_STRING", "user": { id, first_name, last_name, email, role, bar_id, profile_picture, is_active } }` |

- Store the JWT token and send it in all subsequent requests as `Authorization: Bearer <token>`.
- The `bar_id` on the user determines which bar/branch the user belongs to.
- `role` will be one of: `bar_owner`, `hr`, `manager`, `staff`, `cashier`, `employee`.

### 1.2 Get Current User

| | |
|---|---|
| **Endpoint** | `GET /auth/me` |
| **Auth** | `requireAuth` |
| **Response** | `{ id, first_name, last_name, email, role, role_id, bar_id, phone_number, profile_picture, date_of_birth, is_active }` |

### 1.3 Get User Permissions

| | |
|---|---|
| **Endpoint** | `GET /auth/me/permissions` |
| **Auth** | `requireAuth` |
| **Response** | `{ "permissions": ["BAR_SETTINGS", "INVENTORY_READ", ...] }` |

- **Critical for frontend RBAC**: Call after login to determine which modules/screens the user can access.
- Permissions are stored as an array of permission code strings.

### 1.4 Auth Middleware Behavior

- `requireAuth` — Validates JWT, checks `is_active`, checks platform maintenance mode (SUPER_ADMIN bypasses).
- `requirePermission("CODE")` — Checks `user_permissions` table; SUPER_ADMIN bypasses all checks; enforces `bar_id` scoping.
- `requireRole(["bar_owner", "hr"])` — Checks user's `role` string directly.

---

## 2. Bar Details & Branch Management

### 2.1 Get Bar Details

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/details` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Response** | Full bar object (see schema below) |

### 2.2 Update Bar Details

| | |
|---|---|
| **Endpoint** | `PATCH /owner/bar/details` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Body** | Any subset of: `{ name, description, address, city, state, zip_code, phone, contact_number, email, website, category, price_range, monday_hours..sunday_hours, latitude, longitude, accept_cash_payment, accept_online_payment, accept_gcash, minimum_reservation_deposit }` |
| **Response** | `{ success: true, message: "Bar details updated" }` |

### 2.3 Upload Bar Image

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/image` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Body** | `multipart/form-data` — field `image` (max 5MB, jpg/png/gif/webp) |
| **Response** | `{ success: true, data: { image_path } }` |
| **Storage** | `uploads/bars/bar_{bar_id}_{timestamp}.ext` |

### 2.4 Upload Bar Logo/Icon

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/icon` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Body** | `multipart/form-data` — field `icon` |
| **Storage** | `uploads/bars/bar_{bar_id}_{timestamp}.ext` |

### 2.5 Upload Bar Video/GIF

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/gif` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Body** | `multipart/form-data` — field `video` |
| **Storage** | `uploads/videos/bars/video_{timestamp}_{originalname}` |

### 2.6 Soft-Delete Bar

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/delete` |
| **Auth** | `requireAuth` (ownership verified) |
| **Body** | `{ "bar_id": number }` |

### 2.7 Toggle Bar Status

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/toggle-status` |
| **Auth** | `requireAuth` (ownership verified) |
| **Body** | `{ "bar_id": number, "status": "active" | "inactive" }` |

### 2.8 Bar Settings (Reservation Mode)

| | |
|---|---|
| **Endpoint** | `PATCH /owner/bar/settings` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Body** | `{ "reservation_mode": "manual_approval" | "auto_accept" }` |

### Multi-Branch Notes
- Each bar row in `bars` represents a branch.
- `bars.owner_id` → `bar_owners.id` links to the owning user.
- `users.bar_id` scopes every staff/employee to a specific branch.
- All queries are scoped by `req.user.bar_id`.

---

## 3. Staff / Employee Management

### 3.1 Create Staff/HR/Employee (Owner)

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/users` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Body** | `{ "first_name", "last_name", "email", "password", "phone_number"?, "role": "staff"|"hr"|"cashier"|"manager", "permissions"?: [permission_id_array] }` |
| **Response** | `{ success: true, data: { user_id, bar_id } }` |

- Owner can create: `staff`, `hr`, `cashier`, `manager` (from `OWNER_ALLOWED_CREATE` constant).
- Auto-assigns default role permissions from `role_permissions` table.

### 3.2 Create Employee with Profile (HR)

| | |
|---|---|
| **Endpoint** | `POST /hr/hr/employees` |
| **Auth** | `requireAuth` + `requirePermission("EMPLOYEE_CREATE")` |
| **Body** | `{ "first_name", "last_name", "email", "password", "phone_number"?, "position"?, "department"?, "employment_status"?, "hired_date"?, "emergency_contact_name"?, "emergency_contact_phone"?, "emergency_contact_relationship"?, "address"?, "role_id"? }` |
| **Employment statuses** | `probationary`, `regular`, `contractual`, `part_time`, `intern` |

### 3.3 List Bar Users

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/users` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Response** | Array of users with `{ id, first_name, last_name, email, role, role_id, phone_number, is_active, bar_id, created_at }` |

### 3.4 List Employees (HR)

| | |
|---|---|
| **Endpoint** | `GET /hr/employees` |
| **Auth** | `requireAuth` + `requirePermission("EMPLOYEE_READ")` |
| **Response** | Array with employee profile joined: `{ id, first_name, last_name, email, role, position, department, employment_status, daily_rate, hired_date, bar_name }` |

### 3.5 Update User (Owner)

| | |
|---|---|
| **Endpoint** | `PATCH /owner/bar/users/:id` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Body** | `{ "first_name"?, "last_name"?, "email"?, "phone_number"?, "role"?, "permissions"?: [ids] }` |

### 3.6 Update Employee Profile (HR)

| | |
|---|---|
| **Endpoint** | `PUT /hr/employees/:userId/profile` |
| **Auth** | `requireAuth` + `requirePermission("EMPLOYEE_UPDATE")` |
| **Body** | `{ position, department, employment_status, daily_rate, hired_date, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, address }` |

### 3.7 Toggle User Active/Inactive

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/users/:id/toggle` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |

### 3.8 Archive User (Soft Delete)

| | |
|---|---|
| **Endpoint** | `DELETE /owner/bar/users/:id` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |

### 3.9 List Archived Users

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/users/archived` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |

### 3.10 Restore Archived User

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/users/:id/restore` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |

### 3.11 Permanently Delete User

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/users/:id/permanent-delete` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |

### 3.12 Reset Employee Password

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/users/:id/reset-password` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Body** | `{ "new_password": "string" }` |

### 3.13 Delete Employee (HR Soft Delete)

| | |
|---|---|
| **Endpoint** | `DELETE /hr/employees/:id` |
| **Auth** | `requireAuth` + `requirePermission("EMPLOYEE_DELETE")` |

---

## 4. RBAC Management

### 4.1 List Assignable Roles

| | |
|---|---|
| **Endpoint** | `GET /owner/rbac/roles` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Response** | `[{ id, name, description }]` — Only STAFF, HR, CASHIER, MANAGER |

### 4.2 List All Permissions

| | |
|---|---|
| **Endpoint** | `GET /owner/rbac/permissions` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Response** | `[{ id, code, description }]` |

### 4.3 Get User Permissions

| | |
|---|---|
| **Endpoint** | `GET /owner/rbac/users/:id/permissions` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Response** | `[{ id, code, description }]` |

### 4.4 Update User Role

| | |
|---|---|
| **Endpoint** | `PATCH /owner/rbac/users/:id/role` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Body** | `{ "role_id": number }` |
| **Note** | Triggers DB trigger `after_user_role_update` → calls `AssignRolePermissions()` stored procedure |

### 4.5 Update User Permissions (Custom)

| | |
|---|---|
| **Endpoint** | `PATCH /owner/rbac/users/:id/permissions` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Body** | `{ "permission_ids": [1, 2, 5, 16, ...] }` |
| **Behavior** | Deletes all existing `user_permissions` for user, then inserts the new set |

---

## 5. Inventory Management

### 5.1 List Inventory

| | |
|---|---|
| **Endpoint** | `GET /owner/inventory` |
| **Auth** | `requireAuth` + `requirePermission("INVENTORY_READ")` |
| **Response** | `[{ id, bar_id, name, unit, stock_qty, reorder_level, cost_price, is_active, stock_status, image_path, created_at }]` |

### 5.2 Create Inventory Item

| | |
|---|---|
| **Endpoint** | `POST /owner/inventory` |
| **Auth** | `requireAuth` + `requirePermission("INVENTORY_MANAGE")` |
| **Body** | `{ "name", "unit"?, "stock_qty"?, "reorder_level"?, "cost_price"? }` |
| **Note** | Auto-calculates `stock_status`: critical (≤0), low (<reorder_level), normal |

### 5.3 Update Inventory Item

| | |
|---|---|
| **Endpoint** | `PATCH /owner/inventory/:id` |
| **Auth** | `requireAuth` + `requirePermission("INVENTORY_MANAGE")` |
| **Body** | `{ "name"?, "unit"?, "stock_qty"?, "reorder_level"?, "cost_price"? }` |

### 5.4 Upload Inventory Image

| | |
|---|---|
| **Endpoint** | `POST /owner/inventory/:id/image` |
| **Auth** | `requireAuth` + `requirePermission("INVENTORY_MANAGE")` |
| **Body** | `multipart/form-data` — field `image` (max 5MB) |
| **Storage** | `uploads/inventory/item_{id}_{timestamp}.ext` |

### 5.5 Deactivate Inventory Item

| | |
|---|---|
| **Endpoint** | `DELETE /owner/inventory/:id` |
| **Auth** | `requireAuth` + `requirePermission("INVENTORY_MANAGE")` |
| **Note** | Fails if item has sales records or is linked to menu — returns 409 |

### 5.6 Record Sale (Legacy)

| | |
|---|---|
| **Endpoint** | `POST /owner/sales` |
| **Auth** | `requireAuth` + `requirePermission("INVENTORY_MANAGE")` |
| **Body** | `{ "item_id", "quantity" }` |
| **Note** | Deducts stock and auto-calculates stock_status |

### 5.7 List Sales

| | |
|---|---|
| **Endpoint** | `GET /owner/sales` |
| **Auth** | `requireAuth` + `requirePermission(["INVENTORY_READ", "POS_VIEW_SALES"])` |
| **Query** | `?from=YYYY-MM-DD&to=YYYY-MM-DD` |

### 5.8 Sales Summary

| | |
|---|---|
| **Endpoint** | `GET /owner/sales/summary` |
| **Auth** | `requireAuth` + `requirePermission(["INVENTORY_READ", "POS_VIEW_SALES"])` |
| **Response** | `{ today: {revenue, count}, week: {...}, month: {...}, best_seller: {name, total_qty} }` |

---

## 6. Menu Management

### 6.1 List Menu Items

| | |
|---|---|
| **Endpoint** | `GET /owner/menu` |
| **Auth** | `requireAuth` + `requirePermission("MENU_READ")` |
| **Response** | `[{ id, inventory_item_id, menu_name, menu_description, selling_price, category, is_available, sort_order, inventory_name, stock_qty, unit, cost_price, inventory_image, stock_status }]` |

### 6.2 Add Item to Menu

| | |
|---|---|
| **Endpoint** | `POST /owner/menu` |
| **Auth** | `requireAuth` + `requirePermission("MENU_MANAGE")` |
| **Body** | `{ "inventory_item_id" (required), "menu_name"?, "menu_description"?, "selling_price"?, "category"? }` |
| **Note** | One inventory item = one menu entry (unique constraint) |

### 6.3 Update Menu Item

| | |
|---|---|
| **Endpoint** | `PATCH /owner/menu/:id` |
| **Auth** | `requireAuth` + `requirePermission("MENU_MANAGE")` |
| **Allowed fields** | `menu_name`, `menu_description`, `selling_price`, `category`, `is_available`, `sort_order` |

### 6.4 Remove from Menu

| | |
|---|---|
| **Endpoint** | `DELETE /owner/menu/:id` |
| **Auth** | `requireAuth` + `requirePermission("MENU_MANAGE")` |

---

## 7. Table Management

### 7.1 List Tables

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/tables` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Response** | `[{ id, bar_id, table_number, capacity, is_active, image_path, price, created_at }]` |

### 7.2 Create Table

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/tables` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Body** | `{ "table_number", "capacity", "price"? }` |

### 7.3 Update Table

| | |
|---|---|
| **Endpoint** | `PATCH /owner/bar/tables/:id` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Body** | `{ "table_number"?, "capacity"?, "is_active"?, "price"? }` |

### 7.4 Upload Table Image

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/tables/:id/image` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |
| **Body** | `multipart/form-data` — field `image` |
| **Storage** | `uploads/tables/table_{bar_id}_{timestamp}.ext` |

### 7.5 Table Status Dashboard

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/tables/status?date=YYYY-MM-DD` |
| **Auth** | `requireAuth` + `requirePermission(["RESERVATION_READ", "POS_ACCESS"])` |
| **Response** | `{ date, tables: [{ id, table_number, capacity, is_active, image_path, price, status: "available"|"reserved"|"occupied" }] }` |
| **Logic** | occupied = pending POS order on table; reserved = pending/approved reservation on date; else available |

---

## 8. Event Management

### 8.1 List Events

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/events` |
| **Auth** | `requireAuth` + `requirePermission("BAR_EVENTS_READ")` |
| **Query** | `?status=active|cancelled|completed&upcoming=true&include_archived=true` |
| **Response** | `[{ id, bar_id, title, description, event_date, start_time, end_time, entry_price, max_capacity, current_bookings, status, image_url, image_path, like_count, comment_count, reservation_count, created_at, updated_at, archived_at }]` |

### 8.2 Event Details (with comments & replies)

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/events/:id/details` |
| **Auth** | `requireAuth` + `requirePermission("BAR_EVENTS_READ")` |
| **Response** | `{ event: {...}, comments: [{ ...comment, replies: [...] }] }` |

### 8.3 List Archived Events

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/events/archived` |
| **Auth** | `requireAuth` + `requirePermission("BAR_EVENTS_READ")` |

### 8.4 Create Event

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/events` |
| **Auth** | `requireAuth` + `requirePermission("BAR_EVENTS_MANAGE")` |
| **Body** | `{ "title" (required), "event_date": "YYYY-MM-DD" (required), "description"?, "start_time"?, "end_time"?, "entry_price"?, "max_capacity"?, "image_url"? }` |
| **Validation** | `event_date` must be today or future |

### 8.5 Update Event

| | |
|---|---|
| **Endpoint** | `PATCH /owner/bar/events/:id` |
| **Auth** | `requireAuth` + `requirePermission("BAR_EVENTS_MANAGE")` |
| **Allowed fields** | `title`, `description`, `event_date`, `start_time`, `end_time`, `entry_price`, `max_capacity`, `status`, `image_url` |

### 8.6 Cancel / Archive Event

| | |
|---|---|
| **Endpoint** | `DELETE /owner/bar/events/:id?mode=cancel|archive` |
| **Auth** | `requireAuth` + `requirePermission("BAR_EVENTS_MANAGE")` |
| **Behavior** | `mode=cancel` (default): sets `status='cancelled'`. `mode=archive`: copies to `bar_events_archive` table, sets cancelled + archived_at |

### 8.7 Upload Event Image

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/events/:id/image` |
| **Auth** | `requireAuth` + `requirePermission("BAR_EVENTS_MANAGE")` |
| **Body** | `multipart/form-data` — field `image` |
| **Storage** | `uploads/events/event_{bar_id}_{timestamp}.ext` |

### 8.8 Event Analytics

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/events/analytics` |
| **Auth** | `requireAuth` + `requirePermission("BAR_EVENTS_READ")` |
| **Response** | `[{ id, title, event_date, status, like_count, comment_count, reservation_count }]` |

### 8.9 Reply to Event Comment

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/comments/events/:id/replies` |
| **Auth** | `requireAuth` |
| **Body** | `{ "reply": "string" }` |

### 8.10 Delete Event Comment

| | |
|---|---|
| **Endpoint** | `DELETE /owner/bar/comments/events/:commentId` |
| **Auth** | `requireAuth` + `requirePermission("BAR_EVENTS_MANAGE")` |

---

## 9. Reservation Management

### 9.1 Owner: List Reservations

Reservations are accessed via the `reservations.js` routes mounted at both `/public` and `/`.

| | |
|---|---|
| **Endpoint** | `GET /owner/reservations` or via custom query on `/public/bars/:id` tables |
| **Auth** | `requireAuth` + `requirePermission("RESERVATION_READ")` |
| **Note** | The `reservations` table contains: `bar_id, table_id, customer_user_id, guest_name, guest_email, guest_phone, reservation_date, reservation_time, party_size, occasion, notes, status, payment_status, payment_method, deposit_amount, payment_reference` |

### 9.2 Reservation Statuses

- `pending` → `approved` / `rejected` / `cancelled`
- `reservation_mode` on the bar: `manual_approval` or `auto_accept`
- Banned customers (in `customer_bar_bans`) are blocked from making reservations

### 9.3 Public Bar Browse (used by Customer App, reference only)

| Endpoint | Description |
|---|---|
| `GET /public/bars` | Browse all active bars |
| `GET /public/bars/:id` | Single bar details |
| `GET /public/bars/:id/tables` | List bar tables |
| `GET /public/bars/:id/available-tables?date=&time=&party_size=` | Check availability |

---

## 10. POS (Point of Sale)

All POS routes are prefixed with `/pos`.

### 10.1 Get Menu (for POS terminal)

| | |
|---|---|
| **Endpoint** | `GET /pos/menu` |
| **Auth** | `requireAuth` + `requirePermission("POS_ACCESS")` |
| **Response** | Menu items joined with inventory (stock info) |

### 10.2 Get Tables (for POS)

| | |
|---|---|
| **Endpoint** | `GET /pos/tables` |
| **Auth** | `requireAuth` + `requirePermission("POS_ACCESS")` |
| **Response** | Tables with computed status: `occupied` / `reserved` / `available` |

### 10.3 Create Order

| | |
|---|---|
| **Endpoint** | `POST /pos/orders` |
| **Auth** | `requireAuth` + `requirePermission("POS_CREATE_ORDER")` |
| **Body** | `{ "table_id"? (nullable for takeout), "items": [{ "menu_item_id", "quantity" }], "notes"? }` |
| **Response** | `{ success: true, data: { order_id, order_number } }` |
| **Behavior** | Creates `pos_orders` + `pos_order_items` rows, auto-generates order_number `POS-YYYYMMDD-NNN` |

### 10.4 Complete Order (Pay)

| | |
|---|---|
| **Endpoint** | `POST /pos/orders/:id/pay` |
| **Auth** | `requireAuth` + `requirePermission("POS_CREATE_ORDER")` |
| **Body** | `{ "payment_method": "cash"|"digital", "amount_received": number, "discount_amount"?: number }` |
| **Behavior** | Deducts inventory stock, inserts `sales` records, updates order to `completed`, calculates change |

### 10.5 Cancel Order

| | |
|---|---|
| **Endpoint** | `POST /pos/orders/:id/cancel` |
| **Auth** | `requireAuth` + `requirePermission("POS_CREATE_ORDER")` |
| **Note** | Only `pending` orders can be cancelled |

### 10.6 Order History

| | |
|---|---|
| **Endpoint** | `GET /pos/orders` |
| **Auth** | `requireAuth` + `requirePermission("POS_VIEW_ORDERS")` |
| **Query** | `?status=pending|completed|cancelled&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100` |
| **Response** | Merged list of POS orders + legacy sales (grouped by date), sorted by date DESC |

### 10.7 Order Detail

| | |
|---|---|
| **Endpoint** | `GET /pos/orders/:id` |
| **Auth** | `requireAuth` + `requirePermission("POS_VIEW_ORDERS")` |
| **Response** | Full order with `items` array |

### 10.8 POS Dashboard

| | |
|---|---|
| **Endpoint** | `GET /pos/dashboard` |
| **Auth** | `requireAuth` + `requirePermission("POS_ACCESS")` |
| **Response** | `{ today: { revenue, completed_count, pending_count, cancelled_count }, week: { revenue, order_count }, top_items: [...], low_stock: [...] }` |

---

## 11. Attendance Tracking

### 11.1 Employee Clock In/Out

| | |
|---|---|
| **Endpoint** | `POST /attendance/employee/attendance` |
| **Auth** | `requireAuth` |
| **Body** | `{ "action": "clock_in" | "clock_out" }` |
| **Note** | Eligible roles: staff, hr, cashier, manager, employee. Prevents duplicate clock-in. |

### 11.2 HR: Create Attendance Record

| | |
|---|---|
| **Endpoint** | `POST /attendance/hr/attendance` |
| **Auth** | `requireAuth` + `requirePermission("ATTENDANCE_CREATE")` |
| **Body** | `{ "employee_user_id", "work_date": "YYYY-MM-DD", "time_in"?, "time_out"? }` |

### 11.3 View Personal Attendance

| | |
|---|---|
| **Endpoint** | `GET /attendance/my/attendance` |
| **Auth** | `requireAuth` |
| **Query** | `?from=YYYY-MM-DD&to=YYYY-MM-DD` |

### 11.4 HR: List All Attendance

| | |
|---|---|
| **Endpoint** | `GET /attendance/hr/attendance` |
| **Auth** | `requireAuth` + `requirePermission("ATTENDANCE_READ")` |
| **Query** | `?from=YYYY-MM-DD&to=YYYY-MM-DD&employee_user_id=` |

### 11.5 HR: Update Attendance

| | |
|---|---|
| **Endpoint** | `PATCH /attendance/hr/attendance/:id` |
| **Auth** | `requireAuth` + `requirePermission("ATTENDANCE_UPDATE")` |
| **Body** | `{ "time_in"?, "time_out"?, "minutes_late"?, "minutes_overtime"? }` |

### 11.6 HR: Attendance Summary (via hr.js)

| | |
|---|---|
| **Endpoint** | `GET /hr/attendance` |
| **Auth** | `requireAuth` + `requirePermission("ATTENDANCE_READ")` |
| **Query** | `?from=YYYY-MM-DD&to=YYYY-MM-DD&employee_user_id=` |

---

## 12. Leave Management

All leave routes are prefixed with `/api/leaves`.

### 12.1 Apply for Leave (Employee)

| | |
|---|---|
| **Endpoint** | `POST /api/leaves` |
| **Auth** | `requireAuth` + `requirePermission("LEAVE_APPLY")` |
| **Body** | `{ "leave_type": "vacation"|"sick"|"emergency"|"maternity"|"paternity"|"special", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "reason"? }` |

### 12.2 View Own Leaves

| | |
|---|---|
| **Endpoint** | `GET /api/leaves/my` |
| **Auth** | `requireAuth` + `requirePermission("LEAVE_READ")` |

### 12.3 List All Leaves (HR/Owner)

| | |
|---|---|
| **Endpoint** | `GET /api/leaves` |
| **Auth** | `requireAuth` + `requirePermission("LEAVE_READ")` |
| **Query** | `?status=pending|approved|rejected&from=YYYY-MM-DD&to=YYYY-MM-DD` |

### 12.4 Decide Leave (Approve/Reject)

| | |
|---|---|
| **Endpoint** | `PATCH /api/leaves/:id/decision` |
| **Auth** | `requireAuth` + `requirePermission("LEAVE_DECIDE")` |
| **Body** | `{ "action": "approve" | "reject" }` |
| **Note** | Only `pending` requests can be decided |

---

## 13. Payroll Management

All payroll routes are prefixed with `/hr/payroll`.

### 13.1 Payroll Preview

| | |
|---|---|
| **Endpoint** | `GET /hr/payroll/payroll` |
| **Auth** | `requireAuth` + `requirePermission("PAYROLL_READ")` |
| **Query** | `?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD` |
| **Response** | Preview of employee pay based on `daily_rate` × days present in attendance |

### 13.2 Create Payroll Run

| | |
|---|---|
| **Endpoint** | `POST /hr/payroll/run` |
| **Auth** | `requireAuth` + `requirePermission("PAYROLL_RUN")` |
| **Body** | `{ "period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD" }` |

### 13.3 List Payroll Runs

| | |
|---|---|
| **Endpoint** | `GET /hr/payroll/runs` |
| **Auth** | `requireAuth` + `requirePermission("PAYROLL_READ")` |

### 13.4 Generate Payroll Items from Attendance

| | |
|---|---|
| **Endpoint** | `POST /hr/payroll/runs/:id/generate` |
| **Auth** | `requireAuth` + `requirePermission("PAYROLL_RUN")` |
| **Behavior** | Calculates `gross_pay = daily_rate × days_present` for each employee with attendance in the period |

---

## 14. Document Management

Routes mounted at root `/` via `hrDocuments.js`.

### 14.1 Upload Document

| | |
|---|---|
| **Endpoint** | `POST /documents/upload` |
| **Auth** | `requireAuth` + `requirePermission("DOC_UPLOAD")` |
| **Body** | `multipart/form-data` — field `document`, plus `{ "doc_type": "contract"|"id"|"nbi"|"medical"|"clearance"|"other", "title", "employee_user_id"? }` |
| **Storage** | `uploads/bar_{bar_id}/employees/{employee_user_id}/{timestamp}-{random}.ext` |

### 14.2 View Document

| | |
|---|---|
| **Endpoint** | `GET /documents/:id/view` |
| **Auth** | `requireAuth` + `requirePermission("DOC_READ")` |
| **Behavior** | Streams file inline with correct MIME type |

### 14.3 List Documents

| | |
|---|---|
| **Endpoint** | `GET /documents` |
| **Auth** | `requireAuth` + `requirePermission("DOC_READ")` |
| **Query** | `?employee_user_id=&doc_type=` |

### 14.4 My Documents (Staff self-service)

| | |
|---|---|
| **Endpoint** | `GET /documents/my` |
| **Auth** | `requireAuth` |

---

## 15. Analytics & Dashboard

### 15.1 Owner Dashboard Summary (Consolidated)

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/dashboard/summary` |
| **Auth** | `requireAuth` + `requirePermission(["BAR_SETTINGS", "RESERVATION_READ", "INVENTORY_READ"])` |
| **Response** | `{ reservations_today, upcoming_events, low_stock_alerts: [...], recent_staff_activity: [...], top_menu_items: [...], today_revenue, today_orders }` |

### 15.2 Analytics Dashboard

| | |
|---|---|
| **Endpoint** | `GET /analytics/dashboard` |
| **Auth** | `requireAuth` |
| **Response** | Aggregated stats by owner_id and bar_id |

### 15.3 Visit Analytics

| | |
|---|---|
| **Endpoint** | `GET /analytics/visits` |
| **Auth** | `requireAuth` |

### 15.4 Review Analytics

| | |
|---|---|
| **Endpoint** | `GET /analytics/reviews` |
| **Auth** | `requireAuth` |

### 15.5 Follower Analytics

| | |
|---|---|
| **Endpoint** | `GET /analytics/followers` |
| **Auth** | `requireAuth` |

### 15.6 Customer Insights

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/customer-insights` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Response** | Top 20 customers by reservation count |

### 15.7 Staff Performance

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/staff-performance` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Response** | `[{ user_id, first_name, last_name, role, orders_processed, reservations_handled, attendance_records }]` |

---

## 16. Owner Reviews Management

All routes prefixed with `/owner-reviews`.

### 16.1 List All Reviews

| | |
|---|---|
| **Endpoint** | `GET /owner-reviews` |
| **Auth** | `requireAuth` |
| **Response** | Reviews across all owner's bars with customer info and existing responses |

### 16.2 Review Detail

| | |
|---|---|
| **Endpoint** | `GET /owner-reviews/:id` |
| **Auth** | `requireAuth` |

### 16.3 Respond to Review

| | |
|---|---|
| **Endpoint** | `POST /owner-reviews/:id/respond` |
| **Auth** | `requireAuth` |
| **Body** | `{ "response": "string" }` |
| **Note** | Creates or updates response (one response per review) |

### 16.4 Review Stats Summary

| | |
|---|---|
| **Endpoint** | `GET /owner-reviews/stats/summary` |
| **Auth** | `requireAuth` |
| **Response** | `{ total_reviews, avg_rating, five_star..one_star counts, responded_count, unresponded_count }` |

---

## 17. Promotions Management

All routes prefixed with `/promotions`.

### 17.1 List Promotions

| | |
|---|---|
| **Endpoint** | `GET /promotions` |
| **Auth** | `requireAuth` |
| **Response** | All promotions for owner's bars |

### 17.2 Promotion Detail

| | |
|---|---|
| **Endpoint** | `GET /promotions/:id` |
| **Auth** | `requireAuth` |

### 17.3 Create Promotion

| | |
|---|---|
| **Endpoint** | `POST /promotions` |
| **Auth** | `requireAuth` |
| **Body** | `multipart/form-data` — `{ "bar_id" (required), "title" (required), "description"?, "discount_type": "percentage"|"fixed" (required), "discount_value" (required), "valid_from"?, "valid_until"?, image file }` |
| **Note** | Verifies bar ownership via `bar_owners` table |

### 17.4 Update Promotion

| | |
|---|---|
| **Endpoint** | `PATCH /promotions/:id` |
| **Auth** | `requireAuth` |
| **Allowed fields** | `title`, `description`, `discount_type`, `discount_value`, `valid_from`, `valid_until`, `status`, `max_redemptions`, `image` file |

### 17.5 Toggle Promotion Active/Inactive

| | |
|---|---|
| **Endpoint** | `POST /promotions/:id/toggle` |
| **Auth** | `requireAuth` |

### 17.6 Delete Promotion

| | |
|---|---|
| **Endpoint** | `DELETE /promotions/:id` |
| **Auth** | `requireAuth` |
| **Note** | Also deletes the associated image file from disk |

---

## 18. Customer Management

### 18.1 List Customers

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/customers` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |

### 18.2 Ban Customer

| | |
|---|---|
| **Endpoint** | `POST /owner/bar/customers/:id/ban` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |
| **Note** | Inserts into `customer_bar_bans` table. Banned customers cannot make reservations. |

### 18.3 Unban Customer

| | |
|---|---|
| **Endpoint** | `DELETE /owner/bar/customers/:id/ban` |
| **Auth** | `requireAuth` + `requirePermission("BAR_MANAGE_USERS")` |

---

## 19. Bar Followers & Posts

### 19.1 List Followers

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/followers` |
| **Auth** | `requireAuth` + `requirePermission("BAR_SETTINGS")` |

### 19.2 List Posts

| | |
|---|---|
| **Endpoint** | `GET /owner/bar/posts` |
| **Auth** | `requireAuth` |

### 19.3 Comment Moderation (Delete Post/Event Comments)

| | |
|---|---|
| **Endpoint** | `DELETE /owner/bar/comments/:type/:commentId` |
| **Auth** | `requireAuth` + permission check |
| **Types** | `posts`, `events` |

---

## 20. Audit Logs

| | |
|---|---|
| **Endpoint** | `GET /hr/audit-logs` (via `hrAuditLogs.js`) |
| **Auth** | `requireAuth` + `requirePermission("AUDIT_READ")` |
| **Note** | Returns actions logged for the bar: user_id, action, entity, entity_id, details, timestamps |

---

## 21. Static Files

| Pattern | Served by |
|---|---|
| `/uploads/*` | `express.static("uploads")` |
| Profile pics, bar images, inventory images, event images, documents | All under `uploads/` directory |

---

## 22. Complete Permission Codes Catalog

| ID | Code | Description |
|---|---|---|
| 1 | `EMPLOYEE_READ` | View employee records |
| 2 | `EMPLOYEE_CREATE` | Create employee records |
| 3 | `EMPLOYEE_UPDATE` | Update employee records |
| 4 | `EMPLOYEE_DELETE` | Delete employee records |
| 5 | `ATTENDANCE_READ` | View attendance records |
| 6 | `ATTENDANCE_CREATE` | Create attendance logs |
| 7 | `ATTENDANCE_UPDATE` | Update attendance logs |
| 8 | `LEAVE_APPLY` | Apply leave |
| 9 | `LEAVE_READ` | View leave requests |
| 10 | `LEAVE_DECIDE` | Approve/Reject leave |
| 11 | `DOC_UPLOAD` | Upload documents |
| 12 | `DOC_READ` | View documents |
| 13 | `DOC_APPROVE` | Approve documents |
| 14 | `PAYROLL_READ` | View payroll |
| 15 | `PAYROLL_RUN` | Run payroll |
| 16 | `BAR_MANAGE_USERS` | Manage users inside a bar |
| 17 | `BAR_SETTINGS` | Manage bar settings |
| 34 | `RESERVATION_READ` | View reservations for the bar |
| 35 | `RESERVATION_MANAGE` | Approve/reject/cancel reservations |
| 40 | `DSS_READ` | View DSS dashboards |
| 41 | `INVENTORY_READ` | View inventory |
| 42 | `INVENTORY_MANAGE` | Create/update inventory |
| 43 | `AUDIT_READ` | Read audit logs |
| 56 | `BAR_EVENTS_MANAGE` | Create/update/delete bar events |
| 57 | `BAR_EVENTS_READ` | View bar events |
| 58 | `MENU_READ` | View menu items |
| 59 | `MENU_MANAGE` | Manage menu items and pricing |
| 65 | `POS_ACCESS` | Access the POS system |
| 66 | `POS_CREATE_ORDER` | Create POS orders |
| 67 | `POS_VIEW_ORDERS` | View POS order history |
| 68 | `POS_VOID_ORDER` | Void/cancel POS orders |
| 69 | `POS_MANAGE` | Manage POS system settings |
| 70 | `POS_VIEW_SALES` | View POS sales reports |
| 71 | `POS_MANAGE_ORDERS` | Manage and update POS orders |
| 72 | `POS_REFUND` | Process refunds and returns |
| 73 | `RESERVATION_CREATE` | Create new reservations |
| 74 | `TABLE_MANAGE` | Manage table arrangements |
| 75 | `EVENT_MANAGE` | Manage bar events and promotions |
| 76 | `ANALYTICS_VIEW` | View business analytics |
| 77 | `STAFF_MANAGE` | Manage staff accounts |

---

## 23. Role Definitions

| ID | Name | Description |
|---|---|---|
| 1 | `ADMIN` | System administrator |
| 2 | `HR` | Human resources staff |
| 3 | `EMPLOYEE` | Employee user |
| 4 | `CUSTOMER` | Customer user |
| 5 | `STAFF` | General staff user |
| 6 | `SUPER_ADMIN` | Global super admin |
| 7 | `BAR_OWNER` | Bar owner/admin for a specific bar |
| 8 | `CASHIER` | Cashier role under a bar |
| 9 | `MANAGER` | Bar manager with extended permissions |

**Owner can create roles:** STAFF, HR, CASHIER, MANAGER (from `OWNER_ALLOWED_CREATE` constant).

---

## 24. Key Database Tables (Schema Summary)

### `users`
```
id, first_name, last_name, email, password, phone_number, phone_verified,
profile_picture, date_of_birth, role (string), role_id (FK→roles),
is_verified, is_active, is_banned, banned_at, banned_by, bar_id (FK→bars),
created_at, updated_at
```
- **Trigger**: `after_user_role_update` — auto-calls `AssignRolePermissions(user_id, role_id)` on role change.

### `bars`
```
id, name, description, address, city, state, zip_code, phone, contact_number,
email, website, category, price_range, image_path, logo_path, video_path,
monday_hours..sunday_hours, owner_id (FK→bar_owners.id),
status (active|inactive|pending), is_locked, lifecycle_status,
rating, review_count, latitude, longitude,
accept_cash_payment, accept_online_payment, accept_gcash, minimum_reservation_deposit,
created_at, updated_at
```

### `bar_owners`
```
id, user_id (FK→users), business_name, business_address, business_phone,
business_email, permit_document, subscription_tier, subscription_expires_at, logo_path
```

### `bar_tables`
```
id, bar_id, table_number, capacity, is_active, image_path, price, created_at
```

### `bar_events`
```
id, bar_id, title, description, event_date, start_time, end_time,
entry_price, max_capacity, current_bookings,
status (active|cancelled|completed), image_url, image_path,
created_at, updated_at, archived_at
```

### `bar_events_archive`
Same as `bar_events` plus: `original_event_id`, `original_created_at`, `original_updated_at`, `archived_at`, `archived_by_user_id`

### `inventory_items`
```
id, bar_id, name, unit, stock_qty, reorder_level, cost_price,
is_active, stock_status (normal|low|critical), image_path, created_at
```

### `menu_items`
```
id, bar_id, inventory_item_id (FK→inventory_items, unique per bar),
menu_name, menu_description, selling_price, category, is_available, sort_order,
created_at, updated_at
```

### `pos_orders`
```
id, bar_id, table_id, staff_user_id, order_number,
status (pending|completed|cancelled), subtotal, discount_amount, total_amount,
payment_method (cash|digital), amount_received, change_amount, notes,
completed_at, cancelled_at, created_at, updated_at
```

### `pos_order_items`
```
id, order_id, menu_item_id, inventory_item_id, item_name, unit_price, quantity, subtotal
```

### `reservations`
```
id, bar_id, table_id, customer_user_id, guest_name, guest_email, guest_phone,
reservation_date, reservation_time, party_size, occasion, notes,
status (pending|approved|rejected|cancelled),
payment_status (pending|paid|refunded|failed), payment_method (cash|gcash|other),
deposit_amount, payment_reference, paid_at, created_at
```

### `attendance_logs`
```
id, bar_id, employee_user_id, work_date, time_in, time_out,
minutes_late, minutes_undertime, minutes_overtime,
source (manual|qr|biometric), created_at, updated_at
```

### `leave_requests`
```
id, bar_id, employee_user_id,
leave_type (vacation|sick|emergency|maternity|paternity|special),
start_date, end_date, days, reason,
status (pending|approved|rejected|cancelled),
decided_by, decided_at, created_at
```

### `payroll_runs`
```
id, bar_id, period_start, period_end, status (draft|finalized),
created_by, created_at, finalized_at
```

### `payroll_items`
```
id, payroll_run_id, bar_id, user_id, daily_rate, days_present,
gross_pay, deductions, net_pay, created_at
```

### `employee_profiles`
```
id, user_id, bar_id, position, department,
employment_status (probationary|regular|contractual|part_time|intern),
daily_rate, hired_date,
emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
address, created_at, updated_at
```

### `documents`
```
id, bar_id, employee_user_id, uploaded_by_user_id,
doc_type (contract|id|nbi|medical|clearance|other),
title, stored_filename, original_filename, mime_type, size_bytes, storage_path,
is_active, archived_at, archived_by_user_id, created_at
```

### `promotions`
```
id, bar_id, title, description,
discount_type (percentage|fixed), discount_value,
valid_from, valid_until, image_path,
status (active|inactive|expired),
redeemed_count, max_redemptions, created_by, created_at, updated_at
```

### `bar_reviews`
```
id, bar_id, user_id, rating, review, review_date
```

### `review_responses`
```
id, review_id, user_id, response, created_at, updated_at
```

### `customer_bar_bans`
```
id, bar_id, customer_id, banned_at
```

### `bar_followers`
```
id, bar_id, user_id, created_at
```

### `bar_posts`
```
id, bar_id, user_id, content, image_path, status (active|archived|deleted),
like_count, comment_count, created_at, updated_at
```

### `audit_logs`
```
id, bar_id, user_id, action, entity, entity_id, details (JSON),
ip_address, user_agent, created_at
```

### `roles`
```
id, name, description, created_at
```

### `permissions`
```
id, code, description, created_at
```

### `role_permissions` (many-to-many)
```
role_id, permission_id
```

### `user_permissions` (per-user overrides)
```
user_id, permission_id, granted_by, created_at
```

### `notifications`
```
id, user_id, type, title, message, link, reference_id, reference_type, is_read, created_at
```

---

## 25. Standard API Response Format

All endpoints return JSON with this structure:

```json
// Success
{ "success": true, "data": {...}, "message": "..." }

// Error
{ "success": false, "message": "Error description" }
```

**Common HTTP status codes used:**
- `200` — Success
- `201` — Created
- `400` — Bad Request / Validation error
- `403` — Forbidden (RBAC or ownership check failed)
- `404` — Not Found
- `409` — Conflict (duplicate email, item has dependencies)
- `500` — Server Error

---

## 26. Route Prefix Summary

| Prefix | Route File | Purpose |
|---|---|---|
| `/auth` | `auth.js` | Login, register, current user, permissions |
| `/owner` | `owner.js` | Bar details, staff, tables, events, customers, RBAC, dashboard |
| `/hr` | `hr.js` | Employee CRUD, attendance, fix-permissions |
| `/hr/payroll` | `hrPayroll.js` | Payroll runs, preview, generate |
| `/attendance` | `attendance.js` | Clock in/out, HR attendance CRUD |
| `/api/leaves` | `leave.js` | Leave apply, list, decide |
| `/` | `hrDocuments.js` | Document upload, view, list |
| `/` | `inventory.js` | Inventory CRUD, sales, menu management |
| `/pos` | `pos.js` | POS menu, tables, orders, payments, dashboard |
| `/public` | `reservations.js` | Public bar browse + reservation actions |
| `/analytics` | `analytics.js` | Dashboard, visits, reviews, followers analytics |
| `/owner-reviews` | `ownerReviews.js` | Review management and responses |
| `/promotions` | `promotions.js` | Promotion CRUD |
| `/social` | `social.js` | Follows, likes, comments, notifications |
| `/subscriptions` | `subscriptions.js` | Subscription plans |
| `/hr` | `hrAuditLogs.js` | Audit log viewing |

---

## 27. Key Implementation Notes for React Frontend

1. **Auth flow**: Login → store JWT in localStorage/cookie → call `/auth/me/permissions` → store permissions in context/state → conditionally render nav items and routes.

2. **bar_id scoping**: The backend auto-scopes by `req.user.bar_id`. The frontend does NOT need to send `bar_id` for most endpoints — it is derived from the JWT token's user record.

3. **Multi-branch owners**: Owners with multiple bars have `bar_id` on their user pointing to one bar. Some endpoints (e.g., promotions, reviews) use `bar_owners.id` → `bars.owner_id` to span all bars.

4. **File uploads**: Use `FormData` with `multipart/form-data` content type. Field names must match exactly (`image`, `icon`, `video`, `document`).

5. **Static files**: Access uploaded files at `{BASE_URL}/uploads/{path}` — the backend serves them via `express.static`.

6. **Permission-based UI**: Hide/show modules based on permission codes from `/auth/me/permissions`. Key groupings:
   - **Bar Settings**: `BAR_SETTINGS`
   - **Staff Management**: `BAR_MANAGE_USERS`, `STAFF_MANAGE`
   - **HR Module**: `EMPLOYEE_READ/CREATE/UPDATE/DELETE`
   - **Inventory**: `INVENTORY_READ`, `INVENTORY_MANAGE`
   - **Menu**: `MENU_READ`, `MENU_MANAGE`
   - **POS**: `POS_ACCESS`, `POS_CREATE_ORDER`, `POS_VIEW_ORDERS`, `POS_VIEW_SALES`
   - **Events**: `BAR_EVENTS_READ`, `BAR_EVENTS_MANAGE`
   - **Reservations**: `RESERVATION_READ`, `RESERVATION_MANAGE`
   - **Attendance**: `ATTENDANCE_READ`, `ATTENDANCE_CREATE`, `ATTENDANCE_UPDATE`
   - **Leave**: `LEAVE_READ`, `LEAVE_DECIDE`, `LEAVE_APPLY`
   - **Payroll**: `PAYROLL_READ`, `PAYROLL_RUN`
   - **Documents**: `DOC_UPLOAD`, `DOC_READ`
   - **Audit**: `AUDIT_READ`
   - **Analytics**: `ANALYTICS_VIEW`, `DSS_READ`

7. **Timezone**: Backend runs in `Asia/Manila` (PHT). All timestamps are in this timezone.
