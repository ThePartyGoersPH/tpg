-- ============================================================
-- RBAC SYSTEM REBUILD — PART 2: Update User Roles
-- Run this AFTER rbac_rebuild_safe.sql completes successfully
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Migrate existing users to correct roles
-- Map old role names to new role IDs
-- ────────────────────────────────────────────────────────────

-- Fix users with old roles: staff/hr/cashier → employee
UPDATE users SET role_id = 3, role = 'employee' 
WHERE LOWER(role) IN ('staff', 'hr', 'cashier') 
AND (role_id IS NULL OR role_id IN (1, 2, 5, 8));

-- Ensure bar_owner users have correct role_id
UPDATE users SET role_id = 7 
WHERE LOWER(role) = 'bar_owner' 
AND (role_id IS NULL OR role_id != 7);

-- Ensure manager users have correct role_id
UPDATE users SET role_id = 9 
WHERE LOWER(role) = 'manager' 
AND (role_id IS NULL OR role_id != 9);

-- Ensure employee users have correct role_id
UPDATE users SET role_id = 3 
WHERE LOWER(role) = 'employee' 
AND (role_id IS NULL OR role_id != 3);

-- Ensure customer users have correct role_id
UPDATE users SET role_id = 4 
WHERE LOWER(role) = 'customer' 
AND (role_id IS NULL OR role_id != 4);

-- Ensure super_admin users have correct role_id
UPDATE users SET role_id = 6 
WHERE LOWER(role) = 'super_admin' 
AND (role_id IS NULL OR role_id != 6);

-- Populate user_roles from users.role_id for all non-null role_id
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT id, role_id FROM users WHERE role_id IS NOT NULL;

-- ============================================================
-- MIGRATION COMPLETE
-- Backend and frontend have been updated to use new permission names.
-- Test the system to verify RBAC is working correctly.
-- ============================================================
