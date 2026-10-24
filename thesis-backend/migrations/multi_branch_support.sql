-- ═══════════════════════════════════════════════════════════════
-- Multi-Branch Support Migration
-- Enables bar owners to manage multiple branches
-- ═══════════════════════════════════════════════════════════════

-- No schema changes needed for core tables:
-- bars.owner_id already supports multiple bars per owner
-- All operational tables already have bar_id columns:
--   attendance_logs, audit_logs, bar_events, bar_tables, documents,
--   employee_documents, employee_profiles, inventory_items, leave_balances,
--   leave_requests, leave_types, menu_items, payroll_items, payroll_runs,
--   pos_orders, promotions, reservations, reviews, sales, bar_posts,
--   bar_followers, bar_reviews, customer_bar_bans

-- subscription_plans.max_bars already exists and controls branch limits

-- Add 'pending' and 'rejected' to subscriptions.status enum for admin approval flow
ALTER TABLE `subscriptions`
  MODIFY COLUMN `status` enum('pending','active','cancelled','expired','past_due','rejected') NOT NULL DEFAULT 'pending';

-- Add BRANCH_MANAGE permission if not exists
INSERT IGNORE INTO `permissions` (`code`, `description`, `created_at`)
VALUES ('BRANCH_MANAGE', 'Create and manage bar branches', NOW());

-- Add the permission to role_permissions for bar_owner role (role_id = 7)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 7, id FROM permissions WHERE code = 'BRANCH_MANAGE';

COMMIT;
