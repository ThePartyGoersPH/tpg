-- ============================================================
-- RBAC SYSTEM REBUILD — Safe Migration (Transaction-Safe Version)
-- Platform Bar System (Bar Manager / Bar Owner App)
-- ============================================================
-- Run this in phpMyAdmin SQL tab or MySQL command line
-- ============================================================

-- Disable autocommit and foreign key checks
SET autocommit = 0;
SET FOREIGN_KEY_CHECKS = 0;

-- ────────────────────────────────────────────────────────────
-- STEP 1: Drop dependent tables first to avoid FK constraint errors
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- STEP 2: Rebuild permissions table with new codes
-- ────────────────────────────────────────────────────────────
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

COMMIT;

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
('reservation_create',  'reservation',  'create',   'Create new reservations'),

-- ── EVENTS & POSTS (module: events) ──
('events_view',             'events', 'view',           'View all events and posts'),
('events_create',           'events', 'create',         'Create new events/posts'),
('events_update',           'events', 'update',         'Edit existing events/posts'),
('events_delete',           'events', 'delete',         'Delete events/posts'),
('events_comment_reply',    'events', 'comment_reply',  'Reply to comments on posts and events'),
('events_comment_manage',   'events', 'comment_manage', 'Delete or moderate comments'),

-- ── STAFF MANAGEMENT (module: staff) ──
('staff_view',              'staff', 'view',             'View list of staff accounts'),
('staff_create',            'staff', 'create',           'Create new staff accounts'),
('staff_update',            'staff', 'update',           'Edit staff profiles and details'),
('staff_reset_password',    'staff', 'reset_password',   'Reset any employee password'),
('staff_edit_permissions',  'staff', 'edit_permissions', 'Edit another staff member permission set'),
('staff_deactivate',        'staff', 'deactivate',       'Deactivate a staff account'),
('staff_delete',            'staff', 'delete',           'Permanently delete a staff account'),

-- ── ATTENDANCE & LEAVES (module: attendance, leave) ──
('attendance_view_own',  'attendance', 'view_own',  'View and manage own time in/time out'),
('attendance_view_all',  'attendance', 'view_all',  'View attendance records of all staff'),
('attendance_create',    'attendance', 'create',    'Create attendance entries for staff'),
('leave_view_own',       'leave',      'view_own',  'View own leave applications and status'),
('leave_apply',          'leave',      'apply',     'Submit a leave request'),
('leave_view_all',       'leave',      'view_all',  'See all leave applications'),
('leave_approve',        'leave',      'approve',   'Approve or decline leave requests'),

-- ── PAYROLL (module: payroll) ──
('payroll_view_own',  'payroll', 'view_own',  'View own payroll records'),
('payroll_view_all',  'payroll', 'view_all',  'View all payroll records'),
('payroll_create',    'payroll', 'create',    'Run payroll processing'),

-- ── DOCUMENTS (module: documents) ──
('documents_view_own',  'documents', 'view_own',  'View own documents'),
('documents_view_all',  'documents', 'view_all',  'View all documents'),
('documents_send',      'documents', 'send',      'Upload and send documents'),
('documents_manage',    'documents', 'manage',    'Approve and manage documents'),

-- ── FINANCIALS (module: financials) ──
('financials_view',  'financials', 'view',  'View financial reports and cashflow'),

-- ── ANALYTICS / DSS (module: analytics) ──
('analytics_bar_view',  'analytics', 'bar_view',  'View analytics and DSS insights'),

-- ── REVIEWS (module: reviews) ──
('reviews_view',   'reviews', 'view',   'View customer reviews'),
('reviews_reply',  'reviews', 'reply',  'Reply to customer reviews'),

-- ── BANS (module: ban) ──
('ban_view',    'ban', 'view',    'View customer ban list'),
('ban_branch',  'ban', 'branch',  'Ban customers from this bar'),
('ban_lift',    'ban', 'lift',    'Lift customer bans'),

-- ── LOGS (module: logs) ──
('logs_view',  'logs', 'view',  'View audit logs and activity history');

COMMIT;

-- ────────────────────────────────────────────────────────────
-- STEP 3: Rebuild role_permissions table
-- ────────────────────────────────────────────────────────────
CREATE TABLE `role_permissions` (
  `role_id` INT(11) NOT NULL,
  `permission_id` INT(11) NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- STEP 4: Seed role_permissions (default permissions per role)
-- ────────────────────────────────────────────────────────────

-- EMPLOYEE (role_id = 3): Basic staff permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name IN (
  'attendance_view_own', 'attendance_create',
  'leave_apply', 'leave_view_own',
  'documents_view_own', 'documents_send',
  'payroll_view_own',
  'reservation_view', 'reservation_create',
  'menu_view', 'table_view', 'events_view'
);

-- MANAGER (role_id = 9): Full operational permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 9, id FROM permissions WHERE name IN (
  'staff_view', 'staff_create', 'staff_update', 'staff_deactivate', 'staff_reset_password',
  'attendance_view_own', 'attendance_view_all', 'attendance_create',
  'leave_apply', 'leave_view_own', 'leave_view_all', 'leave_approve',
  'payroll_view_own', 'payroll_view_all', 'payroll_create',
  'documents_view_own', 'documents_view_all', 'documents_send', 'documents_manage',
  'menu_view', 'menu_create', 'menu_update', 'menu_delete',
  'reservation_view', 'reservation_manage', 'reservation_create',
  'events_view', 'events_create', 'events_update', 'events_delete',
  'events_comment_manage', 'events_comment_reply',
  'table_view', 'table_update',
  'financials_view', 'analytics_bar_view',
  'reviews_view', 'reviews_reply',
  'ban_view', 'ban_branch', 'ban_lift',
  'logs_view', 'bar_details_view'
);

-- BAR_OWNER (role_id = 7): All permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 7, id FROM permissions;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- STEP 5: Rebuild user_permissions table with granted column
-- ────────────────────────────────────────────────────────────
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

COMMIT;

-- ────────────────────────────────────────────────────────────
-- STEP 6: Create user_roles table (if not exists)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` INT(11) NOT NULL,
  `role_id` INT(11) NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;

-- Re-enable foreign key checks and autocommit
SET FOREIGN_KEY_CHECKS = 1;
SET autocommit = 1;

-- ============================================================
-- MIGRATION COMPLETE - PART 1
-- Now run the second part to update user roles
-- ============================================================
