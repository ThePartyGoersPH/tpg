-- ============================================================
-- RBAC SYSTEM REBUILD — Safe Migration
-- Platform Bar System (Bar Manager / Bar Owner App)
-- ============================================================
-- SAFE: Does NOT drop users, orders, payroll, reservations, or any operational table.
-- Only rebuilds: permissions, role_permissions, user_permissions
-- Updates roles table to match new structure.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ────────────────────────────────────────────────────────────
-- STEP 1: Drop dependent tables first to avoid FK constraint errors
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS role_permissions;

-- ────────────────────────────────────────────────────────────
-- STEP 2: Rebuild permissions table with new codes
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS permissions;

CREATE TABLE `permissions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_permission_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `permissions` (`name`, `module`, `action`, `description`) VALUES
-- ── MENU (module: menu) ──
('menu_view',           'menu',         'view',     'View all menu items'),
('menu_create',         'menu',         'create',   'Add new menu items'),
('menu_update',         'menu',         'update',   'Edit existing menu items'),
('menu_delete',         'menu',         'delete',   'Delete menu items'),
('menu_publish',        'menu',         'publish',  'Publish menu item to Customer Platform and POS App'),

-- ── BAR DETAILS (module: bar_details) ──
('bar_details_view',    'bar_details',  'view',     'View branch info, GCash details, open/close hours'),
('bar_details_update',  'bar_details',  'update',   'Edit branch info, GCash details, open/close hours'),

-- ── TABLE MANAGEMENT (module: table) ──
('table_view',          'table',        'view',     'View all tables and their status'),
('table_update',        'table',        'update',   'Change table status (unavailable, maintenance, etc.)'),
('table_reserve',       'table',        'reserve',  'Create/manage reservations tied to a table'),

-- ── RESERVATIONS (module: reservation) ──
('reservation_view',    'reservation',  'view',     'View all reservations with detailed modal info'),
('reservation_manage',  'reservation',  'manage',   'Update or manage reservation statuses'),

-- ── EVENTS & POSTS (module: events) ──
('events_view',             'events', 'view',           'View all events and posts'),
('events_create',           'events', 'create',         'Create new events/posts'),
('events_update',           'events', 'update',         'Edit existing events/posts'),
('events_delete',           'events', 'delete',         'Delete events/posts'),
('events_comment_reply',    'events', 'comment_reply',  'Reply to comments on posts and events'),
('events_comment_manage',   'events', 'comment_manage', 'Delete or moderate comments'),

-- ── STAFF MANAGEMENT (module: staff) ──
('staff_view',              'staff', 'view',             'View list of staff accounts'),
('staff_reset_password',    'staff', 'reset_password',   'Reset any employee password'),
('staff_edit_permissions',  'staff', 'edit_permissions', 'Edit another staff member permission set'),
('staff_deactivate',        'staff', 'deactivate',       'Deactivate a staff account'),
('staff_delete',            'staff', 'delete',           'Permanently delete a staff account'),

-- ── ATTENDANCE & LEAVES (module: attendance, leave) ──
('attendance_view_own',  'attendance', 'view_own',  'View and manage own time in/time out'),
('attendance_view_all',  'attendance', 'view_all',  'View attendance records of all staff'),
('leave_view_own',       'leave',      'view_own',  'View own leave applications and status'),
('leave_apply',          'leave',      'apply',     'Submit a leave request'),
('leave_view_all',       'leave',      'view_all',  'See all leave applications'),
('leave_approve',        'leave',      'approve',   'Approve or decline leave requests'),

-- ── PAYROLL (module: payroll) ──
('payroll_view_own',  'payroll', 'view_own',  'View only own finalized payroll'),
('payroll_view_all',  'payroll', 'view_all',  'View payroll summary of all employees'),
('payroll_create',    'payroll', 'create',    'Create payroll entries or drafts'),
('payroll_update',    'payroll', 'update',    'Edit existing payroll drafts'),
('payroll_finalize',  'payroll', 'finalize',  'Finalize and lock a payroll period'),
('payroll_delete',    'payroll', 'delete',    'Delete unfinalized payroll entries'),

-- ── DOCUMENTS (module: documents) ──
('documents_view_own',  'documents', 'view_own',  'View documents assigned/sent to self only'),
('documents_view_all',  'documents', 'view_all',  'View all documents under the bar/branch'),
('documents_send',      'documents', 'send',      'Send documents to specific employees or all staff'),
('documents_manage',    'documents', 'manage',    'Edit, delete, or organize document records'),

-- ── CUSTOMER BANNING (module: ban) ──
('ban_view',      'ban', 'view',     'View list of banned customers'),
('ban_branch',    'ban', 'branch',   'Ban a customer from specific branch'),
('ban_platform',  'ban', 'platform', 'Ban a customer platform-wide (escalated)'),
('ban_lift',      'ban', 'lift',     'Lift/remove an existing ban'),

-- ── REVIEWS (module: reviews) ──
('reviews_view',    'reviews', 'view',   'View all customer reviews'),
('reviews_reply',   'reviews', 'reply',  'Reply to customer reviews'),
('reviews_delete',  'reviews', 'delete', 'Delete inappropriate reviews'),
('reviews_manage',  'reviews', 'manage', 'Full review management: view, reply, delete'),

-- ── ANALYTICS (module: analytics) ──
('analytics_bar_view',   'analytics', 'bar_view',  'View bar-level analytics: revenue, reservations, menu, peak hours'),
('analytics_user_view',  'analytics', 'user_view', 'View personal analytics: attendance, salary, leave, performance'),

-- ── FINANCIALS (module: financials) ──
('financials_view',    'financials', 'view',   'View revenue summary, payout history, subscription billing'),
('financials_manage',  'financials', 'manage', 'Manage payouts, subscription upgrades/downgrades'),

-- ── LOGS (module: logs) ──
('logs_view', 'logs', 'view', 'View system activity logs'),

-- ── BRANCH MANAGEMENT (module: branch) ──
('branch_view',     'branch', 'view',    'View own branch details and info'),
('branch_create',   'branch', 'create',  'Create a new branch (subscription-aware)'),
('branch_update',   'branch', 'update',  'Update branch details or settings'),
('branch_suspend',  'branch', 'suspend', 'Suspend a branch temporarily'),
('branch_delete',   'branch', 'delete',  'Remove/deactivate a branch permanently'),

-- ── SUBSCRIPTION (module: subscription) ──
('subscription_view',    'subscription', 'view',   'View current plan, billing cycle, and feature limits'),
('subscription_manage',  'subscription', 'manage', 'Upgrade, downgrade, or cancel subscription plans');


-- ────────────────────────────────────────────────────────────
-- STEP 3: Rebuild roles table
-- ────────────────────────────────────────────────────────────
-- Keep existing role IDs where possible to minimize user_roles disruption
-- We keep: EMPLOYEE(3), MANAGER(9), BAR_OWNER(7), SUPER_ADMIN(6), CUSTOMER(4)
-- We retire (but don't delete): ADMIN(1), HR(2), STAFF(5), CASHIER(8)

UPDATE roles SET description = 'Basic staff. Personal data only.' WHERE id = 3 AND name = 'EMPLOYEE';
UPDATE roles SET description = 'Supervises staff. Team-level data depending on permissions.' WHERE id = 9 AND name = 'MANAGER';
UPDATE roles SET description = 'Full control of their bar/branch. All modules.' WHERE id = 7 AND name = 'BAR_OWNER';
UPDATE roles SET description = 'Platform-wide control (future).' WHERE id = 6 AND name = 'SUPER_ADMIN';
UPDATE roles SET description = 'Customer user for public app.' WHERE id = 4 AND name = 'CUSTOMER';


-- ────────────────────────────────────────────────────────────
-- STEP 4: Rebuild role_permissions table structure
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS role_permissions;

CREATE TABLE `role_permissions` (
  `role_id` INT(11) NOT NULL,
  `permission_id` INT(11) NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ────────────────────────────────────────────────────────────
-- STEP 5: Seed role-permission defaults
-- ────────────────────────────────────────────────────────────

-- ── EMPLOYEE (role_id = 3) defaults ──
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name IN (
  'attendance_view_own',
  'leave_view_own',
  'leave_apply',
  'payroll_view_own',
  'documents_view_own',
  'analytics_user_view'
);

-- ── MANAGER (role_id = 9) defaults ──
-- All Employee permissions + management permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 9, id FROM permissions WHERE name IN (
  -- Employee base
  'attendance_view_own',
  'leave_view_own',
  'leave_apply',
  'payroll_view_own',
  'documents_view_own',
  'analytics_user_view',
  -- Manager additions
  'attendance_view_all',
  'leave_view_all',
  'leave_approve',
  'payroll_view_all',
  'payroll_create',
  'payroll_update',
  'payroll_finalize',
  'documents_view_all',
  'documents_send',
  'staff_view',
  'staff_reset_password',
  'reservation_view',
  'table_view',
  'table_update',
  'reviews_view',
  'reviews_reply',
  'analytics_bar_view',
  'menu_view',
  'menu_create',
  'menu_update',
  'events_view',
  'events_create',
  'events_update',
  'events_comment_reply'
);

-- ── BAR_OWNER (role_id = 7) defaults ──
-- All Manager permissions + owner-level permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 7, id FROM permissions WHERE name IN (
  -- Employee base
  'attendance_view_own',
  'leave_view_own',
  'leave_apply',
  'payroll_view_own',
  'documents_view_own',
  'analytics_user_view',
  -- Manager additions
  'attendance_view_all',
  'leave_view_all',
  'leave_approve',
  'payroll_view_all',
  'payroll_create',
  'payroll_update',
  'payroll_finalize',
  'documents_view_all',
  'documents_send',
  'staff_view',
  'staff_reset_password',
  'reservation_view',
  'table_view',
  'table_update',
  'reviews_view',
  'reviews_reply',
  'analytics_bar_view',
  'menu_view',
  'menu_create',
  'menu_update',
  'events_view',
  'events_create',
  'events_update',
  'events_comment_reply',
  -- Bar Owner additions
  'menu_delete',
  'menu_publish',
  'bar_details_view',
  'bar_details_update',
  'staff_edit_permissions',
  'staff_deactivate',
  'staff_delete',
  'payroll_delete',
  'documents_manage',
  'ban_view',
  'ban_branch',
  'ban_platform',
  'ban_lift',
  'reviews_delete',
  'reviews_manage',
  'financials_view',
  'financials_manage',
  'logs_view',
  'branch_view',
  'branch_create',
  'branch_update',
  'branch_suspend',
  'branch_delete',
  'subscription_view',
  'subscription_manage',
  'events_delete',
  'events_comment_manage',
  'table_reserve',
  'reservation_manage'
);

-- ── SUPER_ADMIN (role_id = 6) — gets ALL permissions ──
INSERT INTO role_permissions (role_id, permission_id)
SELECT 6, id FROM permissions;


-- ────────────────────────────────────────────────────────────
-- STEP 6: Rebuild user_permissions table with granted column
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS user_permissions;

CREATE TABLE `user_permissions` (
  `user_id` INT(11) NOT NULL,
  `permission_id` INT(11) NOT NULL,
  `granted` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = granted, 0 = explicitly revoked',
  `granted_by` INT(11) DEFAULT NULL COMMENT 'user_id of who assigned this',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `permission_id`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_up_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ────────────────────────────────────────────────────────────
-- STEP 7: Create user_roles table (if not exists)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` INT(11) NOT NULL,
  `role_id` INT(11) NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- ────────────────────────────────────────────────────────────
-- STEP 8: Migrate existing users to correct roles
-- Map old role names to new role IDs
-- ────────────────────────────────────────────────────────────

-- Fix users with old roles: staff/hr/cashier → employee, admin → bar_owner
-- Update role_id to EMPLOYEE (3) for staff, hr, cashier
UPDATE users SET role_id = 3, role = 'employee' WHERE LOWER(role) IN ('staff', 'hr', 'cashier') AND role_id IN (1, 2, 5, 8);

-- Ensure bar_owner users have correct role_id
UPDATE users SET role_id = 7 WHERE LOWER(role) = 'bar_owner' AND (role_id IS NULL OR role_id != 7);

-- Ensure manager users have correct role_id
UPDATE users SET role_id = 9 WHERE LOWER(role) = 'manager' AND (role_id IS NULL OR role_id != 9);

-- Ensure employee users have correct role_id
UPDATE users SET role_id = 3 WHERE LOWER(role) = 'employee' AND (role_id IS NULL OR role_id != 3);

-- Ensure customer users have correct role_id
UPDATE users SET role_id = 4 WHERE LOWER(role) = 'customer' AND (role_id IS NULL OR role_id != 4);

-- Ensure super_admin users have correct role_id
UPDATE users SET role_id = 6 WHERE LOWER(role) = 'super_admin' AND (role_id IS NULL OR role_id != 6);

-- Populate user_roles from users.role_id for all non-null role_id
INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT id, role_id FROM users WHERE role_id IS NOT NULL;


SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- MIGRATION COMPLETE
-- Old permission codes are replaced. Backend routes and
-- frontend must be updated to use new permission names.
-- ============================================================
