-- ============================================================
-- Drop old RBAC trigger that's causing #1422 errors
-- This trigger is from the old RBAC system and is no longer needed
-- ============================================================

-- Drop the trigger that calls AssignRolePermissions
DROP TRIGGER IF EXISTS after_user_role_update;

-- Also drop the stored procedure if it exists
DROP PROCEDURE IF EXISTS AssignRolePermissions;

SELECT 'Old RBAC trigger and procedure removed successfully!' AS status;
