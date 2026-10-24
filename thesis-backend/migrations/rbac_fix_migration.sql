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

-- ─── 2. Verify all route-used permissions exist ──────────────────────────────
-- These permissions are already in the DB but confirming for safety.
-- Using INSERT IGNORE to skip if they already exist.

-- POS permissions (should already exist as id 65-68)
INSERT IGNORE INTO permissions (id, code, description) VALUES
(65, 'POS_ACCESS', 'Access the POS system'),
(66, 'POS_CREATE_ORDER', 'Create POS orders'),
(67, 'POS_VIEW_ORDERS', 'View POS order history'),
(68, 'POS_VOID_ORDER', 'Void/cancel POS orders');

-- Bar Events permissions (should already exist as id 56-57)
INSERT IGNORE INTO permissions (id, code, description) VALUES
(56, 'BAR_EVENTS_MANAGE', 'Create/update/delete bar events'),
(57, 'BAR_EVENTS_READ', 'View bar events');

-- Menu permissions (should already exist as id 58-59)
INSERT IGNORE INTO permissions (id, code, description) VALUES
(58, 'MENU_READ', 'View menu items'),
(59, 'MENU_MANAGE', 'Create/update/remove menu items');

-- ─── 3. Grant newly-wired permissions to roles ──────────────────────────────
-- Bar events routes changed from BAR_SETTINGS to BAR_EVENTS_READ/MANAGE
-- Menu routes changed from INVENTORY_READ/MANAGE to MENU_READ/MENU_MANAGE
-- BAR_OWNER (role_id=7) already has all these, but ensuring with INSERT IGNORE

-- BAR_OWNER (7) — ensure has BAR_EVENTS_READ, BAR_EVENTS_MANAGE, MENU_READ, MENU_MANAGE
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(7, 56),  -- BAR_EVENTS_MANAGE
(7, 57),  -- BAR_EVENTS_READ
(7, 58),  -- MENU_READ
(7, 59);  -- MENU_MANAGE

-- HR (2) — grant BAR_EVENTS_READ (57) and MENU_READ (58) if not already present
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(2, 57),  -- BAR_EVENTS_READ
(2, 58);  -- MENU_READ

-- STAFF (5) — already has BAR_EVENTS_READ (57), MENU_READ (58), POS permissions
-- Ensure POS permissions are granted
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(5, 57),  -- BAR_EVENTS_READ
(5, 58),  -- MENU_READ
(5, 65),  -- POS_ACCESS
(5, 66),  -- POS_CREATE_ORDER
(5, 67);  -- POS_VIEW_ORDERS

-- CASHIER (8) — ensure POS permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(8, 65),  -- POS_ACCESS
(8, 66),  -- POS_CREATE_ORDER
(8, 67),  -- POS_VIEW_ORDERS
(8, 58);  -- MENU_READ

-- SUPER_ADMIN (6) — should have all permissions, add any missing
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(6, 34),  -- RESERVATION_READ
(6, 35),  -- RESERVATION_MANAGE
(6, 40),  -- DSS_READ
(6, 41),  -- INVENTORY_READ
(6, 42),  -- INVENTORY_MANAGE
(6, 43),  -- AUDIT_READ
(6, 56),  -- BAR_EVENTS_MANAGE
(6, 57),  -- BAR_EVENTS_READ
(6, 58),  -- MENU_READ
(6, 59),  -- MENU_MANAGE
(6, 65),  -- POS_ACCESS
(6, 66),  -- POS_CREATE_ORDER
(6, 67),  -- POS_VIEW_ORDERS
(6, 68);  -- POS_VOID_ORDER

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
-- ============================================================================
