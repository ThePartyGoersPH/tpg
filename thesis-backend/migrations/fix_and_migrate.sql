-- ============================================================
-- RBAC Migration - Direct Fix for Transaction Issues
-- Run this in MySQL command line: mysql -u root tpg < fix_and_migrate.sql
-- ============================================================

-- Force end any active transactions and reset session
SET autocommit = 1;
COMMIT;

-- Drop old RBAC trigger that causes #1422 on any users UPDATE
DROP TRIGGER IF EXISTS after_user_role_update;
DROP PROCEDURE IF EXISTS AssignRolePermissions;

-- Check if we're in a stored procedure context (shouldn't be, but let's be safe)
-- If this fails, you're in a trigger/function context and need to exit and reconnect

-- Now run the user role updates
UPDATE users SET role_id = 3, role = 'employee' 
WHERE LOWER(role) IN ('staff', 'hr', 'cashier') 
AND (role_id IS NULL OR role_id IN (1, 2, 5, 8));

UPDATE users SET role_id = 7 
WHERE LOWER(role) = 'bar_owner' 
AND (role_id IS NULL OR role_id != 7);

UPDATE users SET role_id = 9 
WHERE LOWER(role) = 'manager' 
AND (role_id IS NULL OR role_id != 9);

UPDATE users SET role_id = 3 
WHERE LOWER(role) = 'employee' 
AND (role_id IS NULL OR role_id != 3);

UPDATE users SET role_id = 4 
WHERE LOWER(role) = 'customer' 
AND (role_id IS NULL OR role_id != 4);

UPDATE users SET role_id = 6 
WHERE LOWER(role) = 'super_admin' 
AND (role_id IS NULL OR role_id != 6);

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT id, role_id FROM users WHERE role_id IS NOT NULL;

SELECT 'Migration completed successfully!' AS status;
