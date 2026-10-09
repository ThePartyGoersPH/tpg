-- ==========================================================
-- Schema sync: tables + columns present locally but missing on
-- fresh VPS installs (created locally outside migrations).
-- Date: 2026-10-08
-- Notes:
--   - Fully idempotent: CREATE TABLE IF NOT EXISTS + guarded ADDs.
--   - Collation matches existing VPS convention (utf8mb4_general_ci).
--   - Adds NO data; existing rows untouched.
-- ==========================================================

-- ── 1. Missing tables ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS `bar_registration_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `registration_id` int(11) NOT NULL,
  `bar_id` int(11) DEFAULT NULL,
  `document_type` varchar(60) NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `verification_method` enum('automated','manual') DEFAULT NULL,
  `verification_status` enum('pending','checking','approved','rejected','manual_review') NOT NULL DEFAULT 'pending',
  `ai_confidence_score` decimal(5,2) DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `notes` text NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `registration_id` (`registration_id`),
  KEY `bar_id` (`bar_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `bar_verification_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `auto_approve_threshold` decimal(5,2) NOT NULL DEFAULT 0.70,
  `require_all_documents` tinyint(1) NOT NULL DEFAULT 1,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `leave_cash_conversions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_id` int(11) NOT NULL,
  `employee_user_id` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  `leave_type_id` int(11) NOT NULL,
  `days` decimal(6,2) NOT NULL,
  `daily_rate` decimal(10,2) NOT NULL DEFAULT 0.00,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `note` varchar(255) DEFAULT NULL,
  `requested_by` int(11) NOT NULL,
  `decided_by` int(11) DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  `payroll_run_id` int(11) DEFAULT NULL,
  `payroll_item_id` int(11) DEFAULT NULL,
  `applied_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_lcc_bar_status` (`bar_id`,`status`),
  KEY `idx_lcc_employee` (`bar_id`,`employee_user_id`,`year`),
  KEY `fk_lcc_leave_type` (`leave_type_id`),
  CONSTRAINT `fk_lcc_leave_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `leave_conversion_settings` (
  `bar_id` int(11) NOT NULL,
  `frequency` varchar(20) NOT NULL DEFAULT 'yearly',
  `months` varchar(64) NOT NULL DEFAULT '12',
  `open_day` int(11) NOT NULL DEFAULT 1,
  `close_day` int(11) NOT NULL DEFAULT 31,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`bar_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `media_comment_likes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_comment_user` (`comment_id`,`user_id`),
  KEY `idx_comment_id` (`comment_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `payroll_addition_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `payroll_item_id` int(11) NOT NULL,
  `leave_conversion_id` int(11) NOT NULL,
  `label` varchar(100) NOT NULL,
  `days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `hours` decimal(8,2) NOT NULL DEFAULT 0.00,
  `daily_rate` decimal(10,2) NOT NULL DEFAULT 0.00,
  `hourly_rate` decimal(10,2) NOT NULL DEFAULT 0.00,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `computation_basis` varchar(255) DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payroll_addition_conversion` (`leave_conversion_id`),
  KEY `idx_payroll_addition_item` (`payroll_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `payroll_expenses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_id` int(11) NOT NULL,
  `payroll_run_id` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `period_start` date DEFAULT NULL,
  `period_end` date DEFAULT NULL,
  `posted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `bar_id` (`bar_id`),
  KEY `payroll_run_id` (`payroll_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `reservation_reviews` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reservation_id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `rating` tinyint(1) NOT NULL,
  `comment` text NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reservation_reviews_reservation` (`reservation_id`),
  KEY `idx_reservation_reviews_customer` (`customer_id`),
  KEY `idx_reservation_reviews_bar` (`bar_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── 2. Missing columns (guarded; skipped when present) ──────

SET @cx5001 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_packages' AND COLUMN_NAME = 'requires_table');
SET @sx5001 := IF(@cx5001 = 0, 'ALTER TABLE bar_packages ADD COLUMN requires_table tinyint(1) NOT NULL DEFAULT 1', 'SELECT 1');
PREPARE stx5001 FROM @sx5001;
EXECUTE stx5001;
DEALLOCATE PREPARE stx5001;

SET @cx5002 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'approval_banner_dismissed');
SET @sx5002 := IF(@cx5002 = 0, 'ALTER TABLE bars ADD COLUMN approval_banner_dismissed tinyint(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stx5002 FROM @sx5002;
EXECUTE stx5002;
DEALLOCATE PREPARE stx5002;

SET @cx5003 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'auto_verification_status');
SET @sx5003 := IF(@cx5003 = 0, 'ALTER TABLE business_registrations ADD COLUMN auto_verification_status enum(''pending'',''checking'',''passed'',''failed'',''manual_review'') NOT NULL DEFAULT ''pending''', 'SELECT 1');
PREPARE stx5003 FROM @sx5003;
EXECUTE stx5003;
DEALLOCATE PREPARE stx5003;

SET @cx5004 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'bar_contact_number');
SET @sx5004 := IF(@cx5004 = 0, 'ALTER TABLE business_registrations ADD COLUMN bar_contact_number varchar(30) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5004 FROM @sx5004;
EXECUTE stx5004;
DEALLOCATE PREPARE stx5004;

SET @cx5005 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'classification');
SET @sx5005 := IF(@cx5005 = 0, 'ALTER TABLE business_registrations ADD COLUMN classification varchar(100) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5005 FROM @sx5005;
EXECUTE stx5005;
DEALLOCATE PREPARE stx5005;

SET @cx5006 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'verification_notes');
SET @sx5006 := IF(@cx5006 = 0, 'ALTER TABLE business_registrations ADD COLUMN verification_notes text NULL', 'SELECT 1');
PREPARE stx5006 FROM @sx5006;
EXECUTE stx5006;
DEALLOCATE PREPARE stx5006;

SET @cx5007 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_comments' AND COLUMN_NAME = 'is_hidden');
SET @sx5007 := IF(@cx5007 = 0, 'ALTER TABLE media_comments ADD COLUMN is_hidden tinyint(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stx5007 FROM @sx5007;
EXECUTE stx5007;
DEALLOCATE PREPARE stx5007;

SET @cx5008 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_comments' AND COLUMN_NAME = 'mentioned_user_id');
SET @sx5008 := IF(@cx5008 = 0, 'ALTER TABLE media_comments ADD COLUMN mentioned_user_id int unsigned NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5008 FROM @sx5008;
EXECUTE stx5008;
DEALLOCATE PREPARE stx5008;

SET @cx5009 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_comments' AND COLUMN_NAME = 'mentioned_user_name');
SET @sx5009 := IF(@cx5009 = 0, 'ALTER TABLE media_comments ADD COLUMN mentioned_user_name varchar(150) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5009 FROM @sx5009;
EXECUTE stx5009;
DEALLOCATE PREPARE stx5009;

SET @cx5010 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'media_comments' AND COLUMN_NAME = 'reported');
SET @sx5010 := IF(@cx5010 = 0, 'ALTER TABLE media_comments ADD COLUMN reported tinyint(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stx5010 FROM @sx5010;
EXECUTE stx5010;
DEALLOCATE PREPARE stx5010;

SET @cx5011 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'action');
SET @sx5011 := IF(@cx5011 = 0, 'ALTER TABLE notifications ADD COLUMN action varchar(30) NULL DEFAULT ''navigate''', 'SELECT 1');
PREPARE stx5011 FROM @sx5011;
EXECUTE stx5011;
DEALLOCATE PREPARE stx5011;

SET @cx5012 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'category');
SET @sx5012 := IF(@cx5012 = 0, 'ALTER TABLE notifications ADD COLUMN category varchar(40) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5012 FROM @sx5012;
EXECUTE stx5012;
DEALLOCATE PREPARE stx5012;

SET @cx5013 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'metadata');
SET @sx5013 := IF(@cx5013 = 0, 'ALTER TABLE notifications ADD COLUMN metadata longtext NULL', 'SELECT 1');
PREPARE stx5013 FROM @sx5013;
EXECUTE stx5013;
DEALLOCATE PREPARE stx5013;

SET @cx5014 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'target_route');
SET @sx5014 := IF(@cx5014 = 0, 'ALTER TABLE notifications ADD COLUMN target_route varchar(500) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5014 FROM @sx5014;
EXECUTE stx5014;
DEALLOCATE PREPARE stx5014;

SET @cx5015 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_items' AND COLUMN_NAME = 'additions');
SET @sx5015 := IF(@cx5015 = 0, 'ALTER TABLE payroll_items ADD COLUMN additions decimal(12,2) NOT NULL DEFAULT 0.00', 'SELECT 1');
PREPARE stx5015 FROM @sx5015;
EXECUTE stx5015;
DEALLOCATE PREPARE stx5015;

SET @cx5016 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_runs' AND COLUMN_NAME = 'finance_approved_at');
SET @sx5016 := IF(@cx5016 = 0, 'ALTER TABLE payroll_runs ADD COLUMN finance_approved_at datetime NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5016 FROM @sx5016;
EXECUTE stx5016;
DEALLOCATE PREPARE stx5016;

SET @cx5017 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_runs' AND COLUMN_NAME = 'finance_approved_by');
SET @sx5017 := IF(@cx5017 = 0, 'ALTER TABLE payroll_runs ADD COLUMN finance_approved_by int NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5017 FROM @sx5017;
EXECUTE stx5017;
DEALLOCATE PREPARE stx5017;

SET @cx5018 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_runs' AND COLUMN_NAME = 'finance_notes');
SET @sx5018 := IF(@cx5018 = 0, 'ALTER TABLE payroll_runs ADD COLUMN finance_notes text NULL', 'SELECT 1');
PREPARE stx5018 FROM @sx5018;
EXECUTE stx5018;
DEALLOCATE PREPARE stx5018;

SET @cx5019 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'transaction_name');
SET @sx5019 := IF(@cx5019 = 0, 'ALTER TABLE pos_orders ADD COLUMN transaction_name varchar(150) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5019 FROM @sx5019;
EXECUTE stx5019;
DEALLOCATE PREPARE stx5019;

SET @cx5020 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'email_sent_at');
SET @sx5020 := IF(@cx5020 = 0, 'ALTER TABLE purchase_orders ADD COLUMN email_sent_at datetime NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5020 FROM @sx5020;
EXECUTE stx5020;
DEALLOCATE PREPARE stx5020;

SET @cx5021 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'last_notify_error');
SET @sx5021 := IF(@cx5021 = 0, 'ALTER TABLE purchase_orders ADD COLUMN last_notify_error text NULL', 'SELECT 1');
PREPARE stx5021 FROM @sx5021;
EXECUTE stx5021;
DEALLOCATE PREPARE stx5021;

SET @cx5022 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'suppliers' AND COLUMN_NAME = 'facebook_link');
SET @sx5022 := IF(@cx5022 = 0, 'ALTER TABLE suppliers ADD COLUMN facebook_link varchar(255) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5022 FROM @sx5022;
EXECUTE stx5022;
DEALLOCATE PREPARE stx5022;

SET @cx5023 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'staff_id_number');
SET @sx5023 := IF(@cx5023 = 0, 'ALTER TABLE users ADD COLUMN staff_id_number varchar(20) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx5023 FROM @sx5023;
EXECUTE stx5023;
DEALLOCATE PREPARE stx5023;
