-- ============================================================
-- RBAC Consistency Fix Migration
-- Fixes missing role_permissions for BAR_OWNER and other roles
-- Safe: uses INSERT IGNORE to skip existing mappings
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Add missing permissions to BAR_OWNER (role_id = 7)
--    Missing: POS_MANAGE(69), POS_VIEW_SALES(70), POS_MANAGE_ORDERS(71),
--             POS_REFUND(72), RESERVATION_CREATE(73), TABLE_MANAGE(74),
--             ANALYTICS_VIEW(76), STAFF_MANAGE(77)
-- ──────────────────────────────────────────────────────────────
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(7, 69),  -- POS_MANAGE
(7, 70),  -- POS_VIEW_SALES
(7, 71),  -- POS_MANAGE_ORDERS
(7, 72),  -- POS_REFUND
(7, 73),  -- RESERVATION_CREATE
(7, 74),  -- TABLE_MANAGE
(7, 76),  -- ANALYTICS_VIEW
(7, 77);  -- STAFF_MANAGE

-- ──────────────────────────────────────────────────────────────
-- 2. Add missing permissions to SUPER_ADMIN (role_id = 6)
--    Should have ALL permissions
-- ──────────────────────────────────────────────────────────────
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(6, 69),  -- POS_MANAGE
(6, 70),  -- POS_VIEW_SALES
(6, 71),  -- POS_MANAGE_ORDERS
(6, 72),  -- POS_REFUND
(6, 73),  -- RESERVATION_CREATE
(6, 74),  -- TABLE_MANAGE
(6, 75),  -- EVENT_MANAGE
(6, 76),  -- ANALYTICS_VIEW
(6, 77);  -- STAFF_MANAGE

-- ──────────────────────────────────────────────────────────────
-- 3. Add PAYROLL_READ to STAFF (role_id = 5) so they can view their payslips
-- ──────────────────────────────────────────────────────────────
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(5, 14);  -- PAYROLL_READ

-- ──────────────────────────────────────────────────────────────
-- 4. Add PAYROLL_READ to CASHIER (role_id = 8) - already present, but ensure
-- ──────────────────────────────────────────────────────────────
-- (already has 14, skip)

-- ──────────────────────────────────────────────────────────────
-- 5. Sync user_permissions for existing BAR_OWNER users
--    Re-grant the new permissions to all bar_owner users
-- ──────────────────────────────────────────────────────────────
INSERT IGNORE INTO user_permissions (user_id, permission_id, granted_by)
SELECT u.id, rp.permission_id, u.id
FROM users u
JOIN role_permissions rp ON rp.role_id = u.role_id
WHERE u.role = 'bar_owner'
  AND u.role_id = 7
  AND rp.permission_id IN (69, 70, 71, 72, 73, 74, 76, 77);

-- ──────────────────────────────────────────────────────────────
-- 6. Sync user_permissions for existing SUPER_ADMIN users
-- ──────────────────────────────────────────────────────────────
INSERT IGNORE INTO user_permissions (user_id, permission_id, granted_by)
SELECT u.id, rp.permission_id, u.id
FROM users u
JOIN role_permissions rp ON rp.role_id = u.role_id
WHERE u.role = 'super_admin'
  AND u.role_id = 6
  AND rp.permission_id IN (69, 70, 71, 72, 73, 74, 75, 76, 77);

-- ──────────────────────────────────────────────────────────────
-- 7. Sync user_permissions for existing MANAGER users
-- ──────────────────────────────────────────────────────────────
INSERT IGNORE INTO user_permissions (user_id, permission_id, granted_by)
SELECT u.id, rp.permission_id, u.id
FROM users u
JOIN role_permissions rp ON rp.role_id = u.role_id
WHERE u.role = 'manager'
  AND u.role_id = 9;

-- ──────────────────────────────────────────────────────────────
-- 8. Sync user_permissions for existing STAFF users (add PAYROLL_READ)
-- ──────────────────────────────────────────────────────────────
INSERT IGNORE INTO user_permissions (user_id, permission_id, granted_by)
SELECT u.id, 14, u.id
FROM users u
WHERE u.role = 'staff'
  AND u.role_id = 5;
