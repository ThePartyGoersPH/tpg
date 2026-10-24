-- Create a new Super Admin account
-- This SQL creates a super admin user with full system access

-- Password: SuperAdmin123! (bcrypt hashed)
-- Email: superadmin@system.com
-- You can change the email, name, and password hash as needed

INSERT INTO `users` (
  `first_name`, 
  `last_name`, 
  `email`, 
  `password`, 
  `phone_number`, 
  `phone_verified`, 
  `profile_picture`, 
  `date_of_birth`, 
  `role`, 
  `role_id`, 
  `is_verified`, 
  `newsletter`, 
  `is_active`, 
  `bar_id`
) VALUES (
  'System',                                                                    -- first_name
  'Administrator',                                                             -- last_name
  'superadmin@system.com',                                                     -- email (CHANGE THIS if needed)
  '$2b$10$YQ7x08tM6t9Hf4.7LNUHu1e/SyYNPtMMIULcfIljCkEs1SyO/n89bq',          -- password hash for: SuperAdmin123!
  NULL,                                                                        -- phone_number (optional)
  0,                                                                           -- phone_verified
  NULL,                                                                        -- profile_picture (optional)
  NULL,                                                                        -- date_of_birth (optional)
  'super_admin',                                                               -- role (must match role name)
  6,                                                                           -- role_id (6 = SUPER_ADMIN)
  1,                                                                           -- is_verified (1 = verified)
  0,                                                                           -- newsletter
  1,                                                                           -- is_active (1 = active)
  NULL                                                                         -- bar_id (NULL for super admin - has access to all bars)
);

-- Verify the user was created
SELECT id, first_name, last_name, email, role, role_id, is_active 
FROM users 
WHERE email = 'superadmin@system.com';

-- ============================================
-- IMPORTANT NOTES:
-- ============================================
-- 1. Default credentials:
--    Email: superadmin@system.com
--    Password: SuperAdmin123!
--
-- 2. CHANGE THE PASSWORD IMMEDIATELY after first login!
--    You can do this through the app's settings or by updating the password hash.
--
-- 3. To generate a new password hash, you can use bcrypt:
--    Node.js: const bcrypt = require('bcrypt'); bcrypt.hashSync('YourNewPassword', 10);
--    Online: https://bcrypt-generator.com/ (use 10 rounds)
--
-- 4. Super Admin has access to:
--    - All bars in the system
--    - All platform management features
--    - All permissions (bypasses permission checks)
--    - User management across all bars
--    - System-wide audit logs
--    - Platform safety and maintenance features
--
-- 5. The role_id 6 corresponds to SUPER_ADMIN role which has:
--    - Global access (no bar_id restriction)
--    - Bypass for all permission checks
--    - Access to super admin routes (/superadmin/*)
