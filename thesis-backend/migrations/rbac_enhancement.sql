-- ============================================================================
-- RBAC ENHANCEMENT MIGRATION
-- Date: 2026-03-09
-- ============================================================================
-- This migration adds missing permissions and enhances RBAC functionality

-- ─── 1. Add missing POS permissions ────────────────────────────────────────

INSERT INTO permissions (code, description, created_at) VALUES
('POS_MANAGE', 'Manage POS system settings and configuration', NOW()),
('POS_VIEW_SALES', 'View POS sales reports and analytics', NOW()),
('POS_MANAGE_ORDERS', 'Manage and update POS orders', NOW()),
('POS_REFUND', 'Process refunds and returns', NOW()),
('RESERVATION_CREATE', 'Create new reservations', NOW()),
('TABLE_MANAGE', 'Manage table arrangements and status', NOW()),
('EVENT_MANAGE', 'Manage bar events and promotions', NOW()),
('MENU_MANAGE', 'Manage menu items and pricing', NOW()),
('ANALYTICS_VIEW', 'View business analytics and reports', NOW()),
('STAFF_MANAGE', 'Manage staff accounts and permissions', NOW())
ON DUPLICATE KEY UPDATE 
description = VALUES(description),
created_at = NOW();

-- ─── 2. Update role permissions mapping ───────────────────────────────────

-- STAFF role permissions
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'STAFF' AND p.code IN (
    'ATTENDANCE_CREATE', 'ATTENDANCE_READ', 'LEAVE_APPLY', 'LEAVE_READ', 
    'DOC_UPLOAD', 'DOC_READ', 'RESERVATION_READ', 'RESERVATION_CREATE',
    'POS_ACCESS', 'POS_CREATE_ORDER', 'POS_VIEW_ORDERS', 'TABLE_MANAGE',
    'MENU_READ', 'BAR_EVENTS_READ'
) ON DUPLICATE KEY UPDATE role_id = role_id;

-- CASHIER role permissions
INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'CASHIER' AND p.code IN (
    'ATTENDANCE_CREATE', 'ATTENDANCE_READ', 'LEAVE_APPLY', 'LEAVE_READ', 
    'DOC_UPLOAD', 'DOC_READ', 'RESERVATION_READ', 'RESERVATION_CREATE',
    'POS_ACCESS', 'POS_CREATE_ORDER', 'POS_VIEW_ORDERS', 'POS_MANAGE_ORDERS',
    'POS_VIEW_SALES', 'TABLE_MANAGE', 'MENU_READ', 'BAR_EVENTS_READ'
) ON DUPLICATE KEY UPDATE role_id = role_id;

-- MANAGER role (if exists, or create it)
INSERT IGNORE INTO roles (id, name, description, created_at) 
VALUES (9, 'MANAGER', 'Bar manager with extended permissions', NOW());

INSERT INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'MANAGER' AND p.code IN (
    'EMPLOYEE_READ', 'EMPLOYEE_UPDATE', 'ATTENDANCE_READ', 'ATTENDANCE_UPDATE',
    'LEAVE_READ', 'LEAVE_DECIDE', 'DOC_READ', 'DOC_APPROVE', 'PAYROLL_READ',
    'RESERVATION_READ', 'RESERVATION_MANAGE', 'POS_ACCESS', 'POS_CREATE_ORDER',
    'POS_VIEW_ORDERS', 'POS_MANAGE', 'POS_VIEW_SALES', 'POS_REFUND',
    'TABLE_MANAGE', 'INVENTORY_READ', 'INVENTORY_MANAGE', 'DSS_READ',
    'BAR_SETTINGS', 'BAR_MANAGE_USERS', 'BAR_EVENTS_READ', 'BAR_EVENTS_MANAGE',
    'MENU_READ', 'MENU_MANAGE', 'ANALYTICS_VIEW', 'AUDIT_READ'
) ON DUPLICATE KEY UPDATE role_id = role_id;

-- ─── 3. Create function for automatic permission assignment ─────────────────

DELIMITER //
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
END //
DELIMITER ;

-- ─── 4. Add trigger for automatic permission assignment on role change ───────

DELIMITER //
CREATE TRIGGER after_user_role_update
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    IF NEW.role_id IS NOT NULL AND NEW.role_id != OLD.role_id THEN
        CALL AssignRolePermissions(NEW.id, NEW.role_id);
    END IF;
END //
DELIMITER ;

-- ─── 5. Add indexes for better performance ───────────────────────────────────

CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_permissions_code ON permissions(code);

-- ─── 6. Verification queries ────────────────────────────────────────────────────

-- Check role permissions:
-- SELECT r.name as role, p.code as permission, p.description 
-- FROM role_permissions rp 
-- JOIN roles r ON rp.role_id = r.id 
-- JOIN permissions p ON rp.permission_id = p.id 
-- ORDER BY r.name, p.code;

-- Check user permissions:
-- SELECT u.email, r.name as role, p.code as permission 
-- FROM user_permissions up 
-- JOIN users u ON up.user_id = u.id 
-- JOIN permissions p ON up.permission_id = p.id 
-- JOIN roles r ON u.role_id = r.id 
-- ORDER BY u.email, p.code;

-- ============================================================================
-- SUMMARY OF CHANGES:
-- ============================================================================
-- 1. Added missing POS and management permissions
-- 2. Updated role permissions for STAFF, CASHIER, and MANAGER roles
-- 3. Created stored procedure for automatic permission assignment
-- 4. Added trigger for automatic permission assignment on role change
-- 5. Added performance indexes
-- ============================================================================
