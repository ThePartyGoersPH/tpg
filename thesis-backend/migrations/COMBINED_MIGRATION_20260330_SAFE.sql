SET @cx4101 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'owner_middle_name');
SET @sx4101 := IF(@cx4101 = 0, 'ALTER TABLE business_registrations ADD COLUMN owner_middle_name VARCHAR(80) DEFAULT NULL AFTER `owner_first_name`', 'SELECT 1');
PREPARE stx4101 FROM @sx4101;
EXECUTE stx4101;
DEALLOCATE PREPARE stx4101;
SET @cx4102 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'middle_name');
SET @sx4102 := IF(@cx4102 = 0, 'ALTER TABLE users ADD COLUMN middle_name VARCHAR(50) DEFAULT NULL AFTER `first_name`', 'SELECT 1');
PREPARE stx4102 FROM @sx4102;
EXECUTE stx4102;
DEALLOCATE PREPARE stx4102;
SET @cx4103 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'business_barangay');
SET @sx4103 := IF(@cx4103 = 0, 'ALTER TABLE business_registrations ADD COLUMN business_barangay VARCHAR(100) DEFAULT NULL AFTER `business_city`', 'SELECT 1');
PREPARE stx4103 FROM @sx4103;
EXECUTE stx4103;
DEALLOCATE PREPARE stx4103;
SET @cx4104 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'bar_types');
SET @sx4104 := IF(@cx4104 = 0, 'ALTER TABLE business_registrations ADD COLUMN bar_types TEXT DEFAULT NULL AFTER `business_description`', 'SELECT 1');
PREPARE stx4104 FROM @sx4104;
EXECUTE stx4104;
DEALLOCATE PREPARE stx4104;
SET @cx4105 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'selfie_with_id');
SET @sx4105 := IF(@cx4105 = 0, 'ALTER TABLE business_registrations ADD COLUMN selfie_with_id VARCHAR(500) DEFAULT NULL AFTER `business_permit`', 'SELECT 1');
PREPARE stx4105 FROM @sx4105;
EXECUTE stx4105;
DEALLOCATE PREPARE stx4105;
SET @cx4106 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'email_verification_token');
SET @sx4106 := IF(@cx4106 = 0, 'ALTER TABLE business_registrations ADD COLUMN email_verification_token VARCHAR(255) DEFAULT NULL AFTER `owner_password`', 'SELECT 1');
PREPARE stx4106 FROM @sx4106;
EXECUTE stx4106;
DEALLOCATE PREPARE stx4106;
SET @cx4107 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'email_verification_expires');
SET @sx4107 := IF(@cx4107 = 0, 'ALTER TABLE business_registrations ADD COLUMN email_verification_expires DATETIME DEFAULT NULL AFTER `email_verification_token`', 'SELECT 1');
PREPARE stx4107 FROM @sx4107;
EXECUTE stx4107;
DEALLOCATE PREPARE stx4107;
SET @cx4108 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'email_verified_at');
SET @sx4108 := IF(@cx4108 = 0, 'ALTER TABLE business_registrations ADD COLUMN email_verified_at DATETIME DEFAULT NULL AFTER `email_verification_expires`', 'SELECT 1');
PREPARE stx4108 FROM @sx4108;
EXECUTE stx4108;
DEALLOCATE PREPARE stx4108;
SET @cx4109 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND INDEX_NAME = 'idx_br_email_verification_token');
SET @sx4109 := IF(@cx4109 = 0, 'ALTER TABLE business_registrations ADD INDEX idx_br_email_verification_token (`email_verification_token`)', 'SELECT 1');
PREPARE stx4109 FROM @sx4109;
EXECUTE stx4109;
DEALLOCATE PREPARE stx4109;
ALTER TABLE business_registrations MODIFY COLUMN `status` ENUM('pending','pending_email_verification','pending_admin_approval','approved','rejected') NOT NULL DEFAULT 'pending_email_verification';
SET @cx4110 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'bar_types');
SET @sx4110 := IF(@cx4110 = 0, 'ALTER TABLE bars ADD COLUMN bar_types TEXT DEFAULT NULL AFTER `category`', 'SELECT 1');
PREPARE stx4110 FROM @sx4110;
EXECUTE stx4110;
DEALLOCATE PREPARE stx4110;
SET @cx4111 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'reservation_time_limit_mode');
SET @sx4111 := IF(@cx4111 = 0, 'ALTER TABLE bars ADD COLUMN reservation_time_limit_mode ENUM(''restobar'',''club'',''event'',''custom'') DEFAULT NULL AFTER `bar_types`', 'SELECT 1');
PREPARE stx4111 FROM @sx4111;
EXECUTE stx4111;
DEALLOCATE PREPARE stx4111;
SET @cx4112 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'reservation_time_limit_minutes');
SET @sx4112 := IF(@cx4112 = 0, 'ALTER TABLE bars ADD COLUMN reservation_time_limit_minutes INT DEFAULT NULL AFTER `reservation_time_limit_mode`', 'SELECT 1');
PREPARE stx4112 FROM @sx4112;
EXECUTE stx4112;
DEALLOCATE PREPARE stx4112;
SET @cx4113 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'staff_types');
SET @sx4113 := IF(@cx4113 = 0, 'ALTER TABLE bars ADD COLUMN staff_types JSON DEFAULT NULL COMMENT ''Array of staff types present at the bar'' AFTER `bar_types`', 'SELECT 1');
PREPARE stx4113 FROM @sx4113;
EXECUTE stx4113;
DEALLOCATE PREPARE stx4113;
SET @cx4114 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_expiry_date');
SET @sx4114 := IF(@cx4114 = 0, 'ALTER TABLE bars ADD COLUMN permit_expiry_date DATE DEFAULT NULL COMMENT ''Business permit expiry date''', 'SELECT 1');
PREPARE stx4114 FROM @sx4114;
EXECUTE stx4114;
DEALLOCATE PREPARE stx4114;
SET @cx4115 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_status');
SET @sx4115 := IF(@cx4115 = 0, 'ALTER TABLE bars ADD COLUMN permit_status ENUM(''valid'', ''expiring_soon'', ''expired'') DEFAULT ''valid'' COMMENT ''Permit status: valid, expiring_soon (30 days), expired''', 'SELECT 1');
PREPARE stx4115 FROM @sx4115;
EXECUTE stx4115;
DEALLOCATE PREPARE stx4115;
SET @cx4116 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_expiry_notified_at');
SET @sx4116 := IF(@cx4116 = 0, 'ALTER TABLE bars ADD COLUMN permit_expiry_notified_at TIMESTAMP NULL DEFAULT NULL COMMENT ''Last time expiry notification was sent''', 'SELECT 1');
PREPARE stx4116 FROM @sx4116;
EXECUTE stx4116;
DEALLOCATE PREPARE stx4116;
SET @cx4117 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_expired_flagged_at');
SET @sx4117 := IF(@cx4117 = 0, 'ALTER TABLE bars ADD COLUMN permit_expired_flagged_at TIMESTAMP NULL DEFAULT NULL COMMENT ''When permit was flagged as expired''', 'SELECT 1');
PREPARE stx4117 FROM @sx4117;
EXECUTE stx4117;
DEALLOCATE PREPARE stx4117;
SET @cx4118 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND INDEX_NAME = 'idx_permit_expiry_date');
SET @sx4118 := IF(@cx4118 = 0, 'CREATE INDEX `idx_permit_expiry_date` ON `bars` (`permit_expiry_date`)', 'SELECT 1');
PREPARE stx4118 FROM @sx4118;
EXECUTE stx4118;
DEALLOCATE PREPARE stx4118;
SET @cx4119 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND INDEX_NAME = 'idx_permit_status');
SET @sx4119 := IF(@cx4119 = 0, 'CREATE INDEX `idx_permit_status` ON `bars` (`permit_status`)', 'SELECT 1');
PREPARE stx4119 FROM @sx4119;
EXECUTE stx4119;
DEALLOCATE PREPARE stx4119;
SET @cx4120 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'reserved_until');
SET @sx4120 := IF(@cx4120 = 0, 'ALTER TABLE reservations ADD COLUMN reserved_until DATETIME DEFAULT NULL AFTER `reservation_time`', 'SELECT 1');
PREPARE stx4120 FROM @sx4120;
EXECUTE stx4120;
DEALLOCATE PREPARE stx4120;
SET @cx4121 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_reserved_until');
SET @sx4121 := IF(@cx4121 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_reserved_until (`reserved_until`)', 'SELECT 1');
PREPARE stx4121 FROM @sx4121;
EXECUTE stx4121;
DEALLOCATE PREPARE stx4121;
SET @cx4122 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'checked_in_at');
SET @sx4122 := IF(@cx4122 = 0, 'ALTER TABLE reservations ADD COLUMN checked_in_at DATETIME DEFAULT NULL AFTER `paid_at`', 'SELECT 1');
PREPARE stx4122 FROM @sx4122;
EXECUTE stx4122;
DEALLOCATE PREPARE stx4122;
SET @cx4123 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'no_show_at');
SET @sx4123 := IF(@cx4123 = 0, 'ALTER TABLE reservations ADD COLUMN no_show_at DATETIME DEFAULT NULL AFTER `checked_in_at`', 'SELECT 1');
PREPARE stx4123 FROM @sx4123;
EXECUTE stx4123;
DEALLOCATE PREPARE stx4123;
SET @cx4124 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_checked_in_at');
SET @sx4124 := IF(@cx4124 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_checked_in_at (`checked_in_at`)', 'SELECT 1');
PREPARE stx4124 FROM @sx4124;
EXECUTE stx4124;
DEALLOCATE PREPARE stx4124;
SET @cx4125 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_no_show_at');
SET @sx4125 := IF(@cx4125 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_no_show_at (`no_show_at`)', 'SELECT 1');
PREPARE stx4125 FROM @sx4125;
EXECUTE stx4125;
DEALLOCATE PREPARE stx4125;
ALTER TABLE reservations MODIFY COLUMN `status` ENUM('pending','approved','rejected','cancelled','confirmed','paid','checked_in','completed','no_show') NOT NULL DEFAULT 'pending';
SET @cx4126 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND COLUMN_NAME = 'floor_assignment');
SET @sx4126 := IF(@cx4126 = 0, 'ALTER TABLE bar_tables ADD COLUMN floor_assignment VARCHAR(50) DEFAULT NULL AFTER `table_number`', 'SELECT 1');
PREPARE stx4126 FROM @sx4126;
EXECUTE stx4126;
DEALLOCATE PREPARE stx4126;
SET @cx4127 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND COLUMN_NAME = 'table_size');
SET @sx4127 := IF(@cx4127 = 0, 'ALTER TABLE bar_tables ADD COLUMN table_size ENUM(''Small'',''Medium'',''Large'') DEFAULT NULL AFTER `capacity`', 'SELECT 1');
PREPARE stx4127 FROM @sx4127;
EXECUTE stx4127;
DEALLOCATE PREPARE stx4127;
SET @cx4128 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND COLUMN_NAME = 'deleted_at');
SET @sx4128 := IF(@cx4128 = 0, 'ALTER TABLE bar_tables ADD COLUMN deleted_at DATETIME DEFAULT NULL AFTER `created_at`', 'SELECT 1');
PREPARE stx4128 FROM @sx4128;
EXECUTE stx4128;
DEALLOCATE PREPARE stx4128;
SET @cx4129 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND INDEX_NAME = 'idx_bar_tables_deleted_at');
SET @sx4129 := IF(@cx4129 = 0, 'ALTER TABLE bar_tables ADD INDEX idx_bar_tables_deleted_at (`deleted_at`)', 'SELECT 1');
PREPARE stx4129 FROM @sx4129;
EXECUTE stx4129;
DEALLOCATE PREPARE stx4129;
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
CREATE TABLE IF NOT EXISTS `inventory_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_id` int(11) NOT NULL,
  `requester_id` int(11) NOT NULL COMMENT 'User ID of staff who submitted request',
  `item_name` varchar(255) NOT NULL,
  `quantity_needed` int(11) NOT NULL,
  `unit` VARCHAR(50) DEFAULT 'Piece' COMMENT 'Unit of measurement',
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
SET @cx4130 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_events' AND COLUMN_NAME = 'event_type');
SET @sx4130 := IF(@cx4130 = 0, 'ALTER TABLE bar_events ADD COLUMN event_type VARCHAR(100) DEFAULT NULL COMMENT ''Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom'' AFTER `title`', 'SELECT 1');
PREPARE stx4130 FROM @sx4130;
EXECUTE stx4130;
DEALLOCATE PREPARE stx4130;
SET @cx4131 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_events' AND INDEX_NAME = 'idx_event_type');
SET @sx4131 := IF(@cx4131 = 0, 'ALTER TABLE bar_events ADD INDEX idx_event_type (`event_type`)', 'SELECT 1');
PREPARE stx4131 FROM @sx4131;
EXECUTE stx4131;
DEALLOCATE PREPARE stx4131;
SET @cx4132 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_events_archive' AND COLUMN_NAME = 'event_type');
SET @sx4132 := IF(@cx4132 = 0, 'ALTER TABLE bar_events_archive ADD COLUMN event_type VARCHAR(100) DEFAULT NULL COMMENT ''Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom'' AFTER `title`', 'SELECT 1');
PREPARE stx4132 FROM @sx4132;
EXECUTE stx4132;
DEALLOCATE PREPARE stx4132;
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
SET @cx4133 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_settings' AND INDEX_NAME = 'idx_payroll_settings_bar');
SET @sx4133 := IF(@cx4133 = 0, 'CREATE INDEX `idx_payroll_settings_bar` ON `payroll_settings` (`bar_id`)', 'SELECT 1');
PREPARE stx4133 FROM @sx4133;
EXECUTE stx4133;
DEALLOCATE PREPARE stx4133;
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
