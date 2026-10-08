-- Migration: Add POS permissions to BAR_OWNER and STAFF roles
-- Date: 2026-03-07
-- Description: Ensures POS permissions are properly assigned for role-based access

-- Insert POS permissions if they don't exist
INSERT IGNORE INTO `permissions` (`id`, `code`, `description`, `created_at`) VALUES
(65, 'POS_ACCESS', 'Access the POS system', NOW()),
(66, 'POS_CREATE_ORDER', 'Create POS orders', NOW()),
(67, 'POS_VIEW_ORDERS', 'View POS order history', NOW()),
(68, 'POS_VOID_ORDER', 'Void/cancel POS orders', NOW());

-- Assign POS permissions to BAR_OWNER role (role_id = 7)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(7, 65), -- POS_ACCESS
(7, 66), -- POS_CREATE_ORDER
(7, 67), -- POS_VIEW_ORDERS
(7, 68); -- POS_VOID_ORDER

-- Assign basic POS permissions to STAFF role (role_id = 5)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(5, 65), -- POS_ACCESS
(5, 66), -- POS_CREATE_ORDER
(5, 67); -- POS_VIEW_ORDERS (staff can view orders)

-- Note: Staff do NOT get POS_VOID_ORDER by default (only bar owners can void orders)
-- Individual staff members can be granted additional permissions via user_permissions table

-- Verification query (run this to check permissions):
-- SELECT r.name AS role_name, p.code AS permission_code, p.description
-- FROM role_permissions rp
-- JOIN roles r ON r.id = rp.role_id
-- JOIN permissions p ON p.id = rp.permission_id
-- WHERE rp.role_id IN (5, 7) AND p.code LIKE 'POS_%'
-- ORDER BY r.name, p.code;
