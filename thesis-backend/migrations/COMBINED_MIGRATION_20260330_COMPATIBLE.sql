-- ============================================================================
-- COMBINED MIGRATION FILE (MySQL 5.7/8.0 Compatible)
-- Date: March 30, 2026
-- Purpose: Consolidate all recent migrations - Compatible with older MySQL
-- ============================================================================
-- This version removes IF NOT EXISTS from ALTER TABLE ADD COLUMN statements
-- for compatibility with MySQL versions < 8.0.29
-- ============================================================================

-- ============================================================================
-- SECTION 1: USER AND REGISTRATION ENHANCEMENTS
-- ============================================================================

-- 1.1 Add middle name support for users and business registrations
ALTER TABLE `business_registrations`
  ADD COLUMN `owner_middle_name` VARCHAR(80) DEFAULT NULL AFTER `owner_first_name`;

ALTER TABLE `users`
  ADD COLUMN `middle_name` VARCHAR(50) DEFAULT NULL AFTER `first_name`;

-- 1.2 Extend business_registrations for city/barangay, bar types, and selfie-with-ID
ALTER TABLE `business_registrations`
  ADD COLUMN `business_barangay` VARCHAR(100) DEFAULT NULL AFTER `business_city`,
  ADD COLUMN `bar_types` TEXT DEFAULT NULL AFTER `business_description`,
  ADD COLUMN `selfie_with_id` VARCHAR(500) DEFAULT NULL AFTER `business_permit`;

-- 1.3 Business registration email verification
ALTER TABLE `business_registrations`
  ADD COLUMN `email_verification_token` VARCHAR(255) DEFAULT NULL AFTER `owner_password`,
  ADD COLUMN `email_verification_expires` DATETIME DEFAULT NULL AFTER `email_verification_token`,
  ADD COLUMN `email_verified_at` DATETIME DEFAULT NULL AFTER `email_verification_expires`;

ALTER TABLE `business_registrations`
  ADD INDEX `idx_br_email_verification_token` (`email_verification_token`);

ALTER TABLE `business_registrations`
  MODIFY COLUMN `status` ENUM('pending','pending_email_verification','pending_admin_approval','approved','rejected') NOT NULL DEFAULT 'pending_email_verification';

-- ============================================================================
-- SECTION 2: BAR CONFIGURATION ENHANCEMENTS
-- ============================================================================

-- 2.1 Bar reservation time limits and bar types
ALTER TABLE `bars`
  ADD COLUMN `bar_types` TEXT DEFAULT NULL AFTER `category`,
  ADD COLUMN `reservation_time_limit_mode` ENUM('restobar','club','event','custom') DEFAULT NULL AFTER `bar_types`,
  ADD COLUMN `reservation_time_limit_minutes` INT DEFAULT NULL AFTER `reservation_time_limit_mode`;

-- 2.2 Add staff types to bars table
ALTER TABLE `bars` 
ADD COLUMN `staff_types` JSON DEFAULT NULL COMMENT 'Array of staff types present at the bar' AFTER `bar_types`;

-- 2.3 Add permit expiry tracking to bars table
ALTER TABLE `bars` 
ADD COLUMN `permit_expiry_date` DATE DEFAULT NULL COMMENT 'Business permit expiry date',
ADD COLUMN `permit_status` ENUM('valid', 'expiring_soon', 'expired') DEFAULT 'valid' COMMENT 'Permit status: valid, expiring_soon (30 days), expired',
ADD COLUMN `permit_expiry_notified_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Last time expiry notification was sent',
ADD COLUMN `permit_expired_flagged_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When permit was flagged as expired';

-- Add indexes for efficient querying
CREATE INDEX `idx_permit_expiry_date` ON `bars` (`permit_expiry_date`);
CREATE INDEX `idx_permit_status` ON `bars` (`permit_status`);

-- ============================================================================
-- SECTION 3: RESERVATION ENHANCEMENTS
-- ============================================================================

-- 3.1 Add reserved_until column for time-limited reservations
ALTER TABLE `reservations`
  ADD COLUMN `reserved_until` DATETIME DEFAULT NULL AFTER `reservation_time`;

ALTER TABLE `reservations`
  ADD INDEX `idx_reservations_reserved_until` (`reserved_until`);

-- 3.2 Reservation grace period tracking and no-show support
ALTER TABLE `reservations`
  ADD COLUMN `checked_in_at` DATETIME DEFAULT NULL AFTER `paid_at`,
  ADD COLUMN `no_show_at` DATETIME DEFAULT NULL AFTER `checked_in_at`;

ALTER TABLE `reservations`
  ADD INDEX `idx_reservations_checked_in_at` (`checked_in_at`),
  ADD INDEX `idx_reservations_no_show_at` (`no_show_at`);

ALTER TABLE `reservations`
  MODIFY COLUMN `status` ENUM('pending','approved','rejected','cancelled','confirmed','paid','checked_in','completed','no_show') NOT NULL DEFAULT 'pending';

-- ============================================================================
-- SECTION 4: TABLE MANAGEMENT ENHANCEMENTS
-- ============================================================================

-- 4.1 Dynamic table setup fields and soft delete for bar tables
ALTER TABLE `bar_tables`
  ADD COLUMN `floor_assignment` VARCHAR(50) DEFAULT NULL AFTER `table_number`,
  ADD COLUMN `table_size` ENUM('Small','Medium','Large') DEFAULT NULL AFTER `capacity`,
  ADD COLUMN `deleted_at` DATETIME DEFAULT NULL AFTER `created_at`;

ALTER TABLE `bar_tables`
  ADD INDEX `idx_bar_tables_deleted_at` (`deleted_at`);

-- ============================================================================
-- SECTION 5: PACKAGE MANAGEMENT
-- ============================================================================

-- 5.1 Create bar_packages table
CREATE TABLE IF NOT EXISTS `bar_packages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) DEFAULT 0.00,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bar_packages_bar` (`bar_id`, `is_active`, `deleted_at`),
  CONSTRAINT `fk_bar_packages_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5.2 Create package_inclusions table
CREATE TABLE IF NOT EXISTS `package_inclusions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_id` int(11) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `quantity` int(11) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_package_inclusions_package` (`package_id`),
  CONSTRAINT `fk_package_inclusions_package` FOREIGN KEY (`package_id`) REFERENCES `bar_packages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================================
-- SECTION 6: INVENTORY MANAGEMENT
-- ============================================================================

-- 6.1 Update inventory_items table to use ENUM for units
ALTER TABLE `inventory_items` 
MODIFY COLUMN `unit` ENUM('Bottle', 'Bucket', 'Case (12 bottles)', 'Glass', 'Liter', 'Kilogram', 'Piece') DEFAULT 'Piece' COMMENT 'Unit of measurement for inventory item';

-- 6.2 Create inventory_requests table
CREATE TABLE IF NOT EXISTS `inventory_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_id` int(11) NOT NULL,
  `requester_id` int(11) NOT NULL COMMENT 'User ID of staff who submitted request',
  `item_name` varchar(255) NOT NULL,
  `quantity_needed` int(11) NOT NULL,
  `unit` ENUM('Bottle', 'Bucket', 'Case (12 bottles)', 'Glass', 'Liter', 'Kilogram', 'Piece') DEFAULT 'Piece',
  `reason` text DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `reorder_level` int(11) DEFAULT NULL,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL COMMENT 'User ID of owner/manager who reviewed',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `rejection_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_requests_bar` (`bar_id`, `status`),
  KEY `idx_inventory_requests_requester` (`requester_id`),
  KEY `idx_inventory_requests_reviewed_by` (`reviewed_by`),
  CONSTRAINT `fk_inventory_requests_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventory_requests_requester` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventory_requests_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================================
-- SECTION 7: EVENT MANAGEMENT
-- ============================================================================

-- 7.1 Add event_type to bar_events table
ALTER TABLE `bar_events` 
ADD COLUMN `event_type` VARCHAR(100) DEFAULT NULL COMMENT 'Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom' AFTER `title`;

-- Add index for filtering by event type
ALTER TABLE `bar_events`
ADD INDEX `idx_event_type` (`event_type`);

-- 7.2 Also add to archive table for consistency
ALTER TABLE `bar_events_archive` 
ADD COLUMN `event_type` VARCHAR(100) DEFAULT NULL COMMENT 'Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom' AFTER `title`;

-- ============================================================================
-- SECTION 8: PAYROLL MANAGEMENT
-- ============================================================================

-- 8.1 Create payroll_settings table
CREATE TABLE IF NOT EXISTS `payroll_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `sss_rate` DECIMAL(5,2) NOT NULL DEFAULT 4.50 COMMENT 'SSS Contribution Rate (%)',
  `philhealth_rate` DECIMAL(5,2) NOT NULL DEFAULT 3.00 COMMENT 'PhilHealth Contribution Rate (%)',
  `pagibig_rate` DECIMAL(5,2) NOT NULL DEFAULT 2.00 COMMENT 'Pag-IBIG Contribution Rate (%)',
  `withholding_tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Withholding Tax Rate (%)',
  `minimum_wage` DECIMAL(10,2) NOT NULL DEFAULT 610.00 COMMENT 'Minimum Wage (₱ per day)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_bar_id` (`bar_id`),
  CONSTRAINT `fk_payroll_settings_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Configurable payroll rates per bar';

-- Create index for faster lookups
CREATE INDEX `idx_payroll_settings_bar` ON `payroll_settings` (`bar_id`);

-- ============================================================================
-- SECTION 9: PERMIT EXPIRY NOTIFICATIONS
-- ============================================================================

-- 9.1 Create permit expiry notifications log table
CREATE TABLE IF NOT EXISTS `permit_expiry_notifications` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `notification_type` ENUM('30_day_warning', 'expired_flag') NOT NULL COMMENT 'Type of notification sent',
  `permit_expiry_date` DATE NOT NULL COMMENT 'The expiry date at time of notification',
  `email_sent` TINYINT(1) DEFAULT 0 COMMENT 'Whether email was successfully sent',
  `email_sent_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When email was sent',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_id` (`bar_id`),
  KEY `idx_notification_type` (`notification_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_permit_notifications_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Log of permit expiry notifications sent to bar owners';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All migrations have been successfully combined and organized.
-- This version is compatible with MySQL 5.7 and MySQL 8.0 (all versions).
-- Note: If columns already exist, you may see "Duplicate column" errors.
-- This is expected and safe - the migration will continue.
-- ============================================================================
