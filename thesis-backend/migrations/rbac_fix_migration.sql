-- ============================================================================
-- RBAC FIX MIGRATION
-- Date: 2026-03-07
-- ============================================================================
-- This migration fixes RBAC inconsistencies discovered during audit:
--
-- 1. Ensures user_permissions table exists (may already exist)
-- 2. Ensures all permissions used by backend routes exist in the DB
-- 3. Grants newly-wired permissions to existing roles so nothing breaks
-- 4. Adds missing permissions for complete RBAC coverage
-- ============================================================================

-- ─── 1. Ensure user_permissions table exists ─────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INT NOT NULL,
  permission_id INT NOT NULL,
  granted_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_permissions_user (user_id),
  INDEX idx_user_permissions_permission (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
-- ─── 2. Ensure route-used permissions exist (current name/module/action schema) ──
INSERT IGNORE INTO permissions (name, module, action, description) VALUES
('POS_ACCESS', 'pos', 'access', 'Access the POS system'),
('POS_CREATE_ORDER', 'pos', 'create_order', 'Create POS orders'),
('POS_VIEW_ORDERS', 'pos', 'view_orders', 'View POS order history'),
('POS_VOID_ORDER', 'pos', 'void_order', 'Void/cancel POS orders'),
('bar_events_manage', 'event', 'manage', 'Create/update/delete bar events'),
('bar_events_read', 'event', 'read', 'View bar events'),
('menu_read', 'menu', 'read', 'View menu items'),
('menu_manage', 'menu', 'manage', 'Create/update/remove menu items');
-- ─── 3. Grant permissions to roles (name-based, idempotent) ─────────────────
-- BAR_OWNER (7): events + menu (legacy and canonical names) + POS
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 7, p.id FROM permissions p WHERE p.name IN ('bar_events_read','bar_events_manage','menu_read','menu_manage','events_view','events_create','events_update','events_comment_reply','events_comment_manage','menu_view','menu_create','menu_update','POS_ACCESS','POS_CREATE_ORDER','POS_VIEW_ORDERS','POS_VOID_ORDER');
-- HR (2): read-only events/menu
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 2, p.id FROM permissions p WHERE p.name IN ('bar_events_read','menu_read','events_view','menu_view');
-- STAFF (5): events/menu read + basic POS
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 5, p.id FROM permissions p WHERE p.name IN ('bar_events_read','menu_read','events_view','menu_view','POS_ACCESS','POS_CREATE_ORDER','POS_VIEW_ORDERS');
-- CASHIER (8): same as staff
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 8, p.id FROM permissions p WHERE p.name IN ('bar_events_read','menu_read','events_view','menu_view','POS_ACCESS','POS_CREATE_ORDER','POS_VIEW_ORDERS');
-- SUPER_ADMIN (6): every permission
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 6, p.id FROM permissions p;
-- ─── 4. Verification queries ─────────────────────────────────────────────────
-- Run these to verify the migration worked:

-- Check all permissions exist:
-- SELECT id, code, description FROM permissions ORDER BY id;
-- Check BAR_OWNER role_permissions:
-- SELECT rp.role_id, r.name AS role_name, p.code AS permission
-- FROM role_permissions rp
-- JOIN roles r ON r.id = rp.role_id
-- JOIN permissions p ON p.id = rp.permission_id
-- WHERE rp.role_id = 7
-- ORDER BY p.code;
-- Check user_permissions table:
-- SELECT up.user_id, u.first_name, u.last_name, p.code
-- FROM user_permissions up
-- JOIN users u ON u.id = up.user_id
-- JOIN permissions p ON p.id = up.permission_id
-- ORDER BY up.user_id, p.code;
-- ============================================================================
-- SUMMARY OF CHANGES:
-- ============================================================================
-- 1. user_permissions table: Created if not exists (for user-specific perms)
-- 2. Bar events routes: Now use BAR_EVENTS_READ/MANAGE instead of BAR_SETTINGS
--    - BAR_OWNER already had these permissions, so no access change
-- 3. Menu routes: Now use MENU_READ/MENU_MANAGE instead of INVENTORY_READ/MANAGE
--    - BAR_OWNER already had these permissions, so no access change
-- 4. SUPER_ADMIN: Granted all missing permissions for full system access
-- 5. All existing endpoints remain intact and functional
-- ============================================================================;
