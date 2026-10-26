-- ============================================================================
-- RBAC ENHANCEMENT MIGRATION
-- Date: 2026-03-09
-- ============================================================================
-- This migration adds missing permissions and enhances RBAC functionality

-- ─── 1. Add missing POS permissions ────────────────────────────────────────

INSERT INTO permissions (name, module, action, description, created_at) VALUES
('pos_manage', 'pos', 'manage', 'Manage POS system settings and configuration', NOW()),
('pos_view_sales', 'pos', 'view_sales', 'View POS sales reports and analytics', NOW()),
('pos_manage_orders', 'pos', 'manage_orders', 'Manage and update POS orders', NOW()),
('pos_refund', 'pos', 'refund', 'Process refunds and returns', NOW()),
('reservation_create', 'reservation', 'create', 'Create new reservations', NOW()),
('table_manage', 'table', 'manage', 'Manage table arrangements and status', NOW()),
('event_manage', 'event', 'manage', 'Manage bar events and promotions', NOW()),
('menu_manage', 'menu', 'manage', 'Manage menu items and pricing', NOW()),
('analytics_view', 'analytics', 'view', 'View business analytics and reports', NOW()),
('staff_manage', 'staff', 'manage', 'Manage staff accounts and permissions', NOW())
ON DUPLICATE KEY UPDATE
description = VALUES(description),
created_at = NOW();
-- ─── 2. Update role permissions mapping ───────────────────────────────────

-- STAFF role permissions
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'STAFF' AND p.name IN (
    'attendance_create', 'attendance_view_own', 'leave_apply', 'leave_view_own',
    'documents_send', 'documents_view_own', 'reservation_view', 'reservation_create',
    'POS_ACCESS', 'POS_CREATE_ORDER', 'POS_VIEW_ORDERS', 'table_update',
    'MENU_READ', 'events_view'
) ON DUPLICATE KEY UPDATE role_id = role_id;
-- CASHIER role permissions
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'CASHIER' AND p.name IN (
    'attendance_create', 'attendance_view_own', 'leave_apply', 'leave_view_own',
    'documents_send', 'documents_view_own', 'reservation_view', 'reservation_create',
    'POS_ACCESS', 'POS_CREATE_ORDER', 'POS_VIEW_ORDERS', 'pos_manage_orders',
    'pos_view_sales', 'table_update', 'MENU_READ', 'events_view'
) ON DUPLICATE KEY UPDATE role_id = role_id;
-- MANAGER role (if exists, or create it)
INSERT IGNORE INTO roles (id, name, description, created_at) 
VALUES (9, 'MANAGER', 'Bar manager with extended permissions', NOW());
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'MANAGER' AND p.name IN (
    'staff_view', 'staff_update', 'attendance_view_all',
    'leave_view_all', 'leave_approve', 'documents_view_all', 'documents_manage', 'payroll_view_all',
    'reservation_view', 'reservation_manage', 'POS_ACCESS', 'POS_CREATE_ORDER',
    'POS_VIEW_ORDERS', 'pos_manage', 'pos_view_sales', 'pos_refund',
    'table_update', 'INVENTORY_READ',
    'staff_edit_permissions', 'events_view', 'events_update',
    'MENU_READ', 'menu_update', 'analytics_bar_view'
) ON DUPLICATE KEY UPDATE role_id = role_id;
-- ─── 3. Create function for automatic permission assignment ─────────────────


DROP PROCEDURE IF EXISTS AssignRolePermissions;
CREATE PROCEDURE AssignRolePermissions(
    IN p_user_id INT,
    IN p_role_id INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
RESIGNAL;
END;
START TRANSACTION;
-- Remove existing user permissions for this role
    DELETE up FROM user_permissions up
    INNER JOIN role_permissions rp ON up.permission_id = rp.permission_id
    WHERE up.user_id = p_user_id AND rp.role_id = p_role_id;
-- Assign all permissions for the role
    INSERT INTO user_permissions (user_id, permission_id, granted_by)
    SELECT p_user_id, rp.permission_id, p_user_id
    FROM role_permissions rp
    WHERE rp.role_id = p_role_id
    ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by);
COMMIT;
END;

-- ─── 4. Add trigger for automatic permission assignment on role change ───────


DROP TRIGGER IF EXISTS after_user_role_update;
CREATE TRIGGER after_user_role_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.role_id IS NOT NULL AND NEW.role_id != OLD.role_id THEN
        CALL AssignRolePermissions(NEW.id, NEW.role_id);
END IF;
END;

-- ─── 5. Add indexes for better performance ───────────────────────────────────

SET @cx2001 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_permissions' AND INDEX_NAME = 'idx_user_permissions_user_id');
SET @sx2001 := IF(@cx2001 = 0, 'CREATE INDEX idx_user_permissions_user_id ON user_permissions (user_id)', 'SELECT 1');
PREPARE stx2001 FROM @sx2001;
EXECUTE stx2001;
DEALLOCATE PREPARE stx2001;
SET @cx2002 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'role_permissions' AND INDEX_NAME = 'idx_role_permissions_role_id');
SET @sx2002 := IF(@cx2002 = 0, 'CREATE INDEX idx_role_permissions_role_id ON role_permissions (role_id)', 'SELECT 1');
PREPARE stx2002 FROM @sx2002;
EXECUTE stx2002;
DEALLOCATE PREPARE stx2002;
-- ─── 6. Verification queries ────────────────────────────────────────────────────

-- Check role permissions:
-- SELECT r.name as role, p.name as permission, p.description 
-- FROM role_permissions rp 
-- JOIN roles r ON rp.role_id = r.id 
-- JOIN permissions p ON rp.permission_id = p.id 
-- ORDER BY r.name, p.name;
-- Check user permissions:
-- SELECT u.email, r.name as role, p.name as permission 
-- FROM user_permissions up 
-- JOIN users u ON up.user_id = u.id 
-- JOIN permissions p ON up.permission_id = p.id 
-- JOIN roles r ON u.role_id = r.id 
-- ORDER BY u.email, p.name;
-- ============================================================================
-- SUMMARY OF CHANGES:
-- ============================================================================
-- 1. Added missing POS and management permissions
-- 2. Updated role permissions for STAFF, CASHIER, and MANAGER roles
-- 3. Created stored procedure for automatic permission assignment
-- 4. Added trigger for automatic permission assignment on role change
-- 5. Added performance indexes
-- ============================================================================;
