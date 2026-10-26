SET @cx4001 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'owner_middle_name');
SET @sx4001 := IF(@cx4001 = 0, 'ALTER TABLE business_registrations ADD COLUMN owner_middle_name VARCHAR(80) DEFAULT NULL AFTER `owner_first_name`', 'SELECT 1');
PREPARE stx4001 FROM @sx4001;
EXECUTE stx4001;
DEALLOCATE PREPARE stx4001;
SET @cx4002 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'middle_name');
SET @sx4002 := IF(@cx4002 = 0, 'ALTER TABLE users ADD COLUMN middle_name VARCHAR(50) DEFAULT NULL AFTER `first_name`', 'SELECT 1');
PREPARE stx4002 FROM @sx4002;
EXECUTE stx4002;
DEALLOCATE PREPARE stx4002;
SET @cx4003 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'business_barangay');
SET @sx4003 := IF(@cx4003 = 0, 'ALTER TABLE business_registrations ADD COLUMN business_barangay VARCHAR(100) DEFAULT NULL AFTER `business_city`', 'SELECT 1');
PREPARE stx4003 FROM @sx4003;
EXECUTE stx4003;
DEALLOCATE PREPARE stx4003;
SET @cx4004 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'bar_types');
SET @sx4004 := IF(@cx4004 = 0, 'ALTER TABLE business_registrations ADD COLUMN bar_types TEXT DEFAULT NULL AFTER `business_description`', 'SELECT 1');
PREPARE stx4004 FROM @sx4004;
EXECUTE stx4004;
DEALLOCATE PREPARE stx4004;
SET @cx4005 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'selfie_with_id');
SET @sx4005 := IF(@cx4005 = 0, 'ALTER TABLE business_registrations ADD COLUMN selfie_with_id VARCHAR(500) DEFAULT NULL AFTER `business_permit`', 'SELECT 1');
PREPARE stx4005 FROM @sx4005;
EXECUTE stx4005;
DEALLOCATE PREPARE stx4005;
SET @cx4006 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'email_verification_token');
SET @sx4006 := IF(@cx4006 = 0, 'ALTER TABLE business_registrations ADD COLUMN email_verification_token VARCHAR(255) DEFAULT NULL AFTER `owner_password`', 'SELECT 1');
PREPARE stx4006 FROM @sx4006;
EXECUTE stx4006;
DEALLOCATE PREPARE stx4006;
SET @cx4007 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'email_verification_expires');
SET @sx4007 := IF(@cx4007 = 0, 'ALTER TABLE business_registrations ADD COLUMN email_verification_expires DATETIME DEFAULT NULL AFTER `email_verification_token`', 'SELECT 1');
PREPARE stx4007 FROM @sx4007;
EXECUTE stx4007;
DEALLOCATE PREPARE stx4007;
SET @cx4008 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'email_verified_at');
SET @sx4008 := IF(@cx4008 = 0, 'ALTER TABLE business_registrations ADD COLUMN email_verified_at DATETIME DEFAULT NULL AFTER `email_verification_expires`', 'SELECT 1');
PREPARE stx4008 FROM @sx4008;
EXECUTE stx4008;
DEALLOCATE PREPARE stx4008;
SET @cx4009 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND INDEX_NAME = 'idx_br_email_verification_token');
SET @sx4009 := IF(@cx4009 = 0, 'ALTER TABLE business_registrations ADD INDEX idx_br_email_verification_token (`email_verification_token`)', 'SELECT 1');
PREPARE stx4009 FROM @sx4009;
EXECUTE stx4009;
DEALLOCATE PREPARE stx4009;
ALTER TABLE business_registrations MODIFY COLUMN `status` ENUM('pending','pending_email_verification','pending_admin_approval','approved','rejected') NOT NULL DEFAULT 'pending_email_verification';
SET @cx4010 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'bar_types');
SET @sx4010 := IF(@cx4010 = 0, 'ALTER TABLE bars ADD COLUMN bar_types TEXT DEFAULT NULL AFTER `category`', 'SELECT 1');
PREPARE stx4010 FROM @sx4010;
EXECUTE stx4010;
DEALLOCATE PREPARE stx4010;
SET @cx4011 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'reservation_time_limit_mode');
SET @sx4011 := IF(@cx4011 = 0, 'ALTER TABLE bars ADD COLUMN reservation_time_limit_mode ENUM(''restobar'',''club'',''event'',''custom'') DEFAULT NULL AFTER `bar_types`', 'SELECT 1');
PREPARE stx4011 FROM @sx4011;
EXECUTE stx4011;
DEALLOCATE PREPARE stx4011;
SET @cx4012 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'reservation_time_limit_minutes');
SET @sx4012 := IF(@cx4012 = 0, 'ALTER TABLE bars ADD COLUMN reservation_time_limit_minutes INT DEFAULT NULL AFTER `reservation_time_limit_mode`', 'SELECT 1');
PREPARE stx4012 FROM @sx4012;
EXECUTE stx4012;
DEALLOCATE PREPARE stx4012;
SET @cx4013 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'staff_types');
SET @sx4013 := IF(@cx4013 = 0, 'ALTER TABLE bars ADD COLUMN staff_types JSON DEFAULT NULL COMMENT ''Array of staff types present at the bar'' AFTER `bar_types`', 'SELECT 1');
PREPARE stx4013 FROM @sx4013;
EXECUTE stx4013;
DEALLOCATE PREPARE stx4013;
SET @cx4014 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_expiry_date');
SET @sx4014 := IF(@cx4014 = 0, 'ALTER TABLE bars ADD COLUMN permit_expiry_date DATE DEFAULT NULL COMMENT ''Business permit expiry date''', 'SELECT 1');
PREPARE stx4014 FROM @sx4014;
EXECUTE stx4014;
DEALLOCATE PREPARE stx4014;
SET @cx4015 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_status');
SET @sx4015 := IF(@cx4015 = 0, 'ALTER TABLE bars ADD COLUMN permit_status ENUM(''valid'', ''expiring_soon'', ''expired'') DEFAULT ''valid'' COMMENT ''Permit status: valid, expiring_soon (30 days), expired''', 'SELECT 1');
PREPARE stx4015 FROM @sx4015;
EXECUTE stx4015;
DEALLOCATE PREPARE stx4015;
SET @cx4016 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_expiry_notified_at');
SET @sx4016 := IF(@cx4016 = 0, 'ALTER TABLE bars ADD COLUMN permit_expiry_notified_at TIMESTAMP NULL DEFAULT NULL COMMENT ''Last time expiry notification was sent''', 'SELECT 1');
PREPARE stx4016 FROM @sx4016;
EXECUTE stx4016;
DEALLOCATE PREPARE stx4016;
SET @cx4017 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_expired_flagged_at');
SET @sx4017 := IF(@cx4017 = 0, 'ALTER TABLE bars ADD COLUMN permit_expired_flagged_at TIMESTAMP NULL DEFAULT NULL COMMENT ''When permit was flagged as expired''', 'SELECT 1');
PREPARE stx4017 FROM @sx4017;
EXECUTE stx4017;
DEALLOCATE PREPARE stx4017;
SET @cx4018 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND INDEX_NAME = 'idx_permit_expiry_date');
SET @sx4018 := IF(@cx4018 = 0, 'CREATE INDEX `idx_permit_expiry_date` ON `bars` (`permit_expiry_date`)', 'SELECT 1');
PREPARE stx4018 FROM @sx4018;
EXECUTE stx4018;
DEALLOCATE PREPARE stx4018;
SET @cx4019 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND INDEX_NAME = 'idx_permit_status');
SET @sx4019 := IF(@cx4019 = 0, 'CREATE INDEX `idx_permit_status` ON `bars` (`permit_status`)', 'SELECT 1');
PREPARE stx4019 FROM @sx4019;
EXECUTE stx4019;
DEALLOCATE PREPARE stx4019;
SET @cx4020 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'reserved_until');
SET @sx4020 := IF(@cx4020 = 0, 'ALTER TABLE reservations ADD COLUMN reserved_until DATETIME DEFAULT NULL AFTER `reservation_time`', 'SELECT 1');
PREPARE stx4020 FROM @sx4020;
EXECUTE stx4020;
DEALLOCATE PREPARE stx4020;
SET @cx4021 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_reserved_until');
SET @sx4021 := IF(@cx4021 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_reserved_until (`reserved_until`)', 'SELECT 1');
PREPARE stx4021 FROM @sx4021;
EXECUTE stx4021;
DEALLOCATE PREPARE stx4021;
SET @cx4022 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'checked_in_at');
SET @sx4022 := IF(@cx4022 = 0, 'ALTER TABLE reservations ADD COLUMN checked_in_at DATETIME DEFAULT NULL AFTER `paid_at`', 'SELECT 1');
PREPARE stx4022 FROM @sx4022;
EXECUTE stx4022;
DEALLOCATE PREPARE stx4022;
SET @cx4023 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'no_show_at');
SET @sx4023 := IF(@cx4023 = 0, 'ALTER TABLE reservations ADD COLUMN no_show_at DATETIME DEFAULT NULL AFTER `checked_in_at`', 'SELECT 1');
PREPARE stx4023 FROM @sx4023;
EXECUTE stx4023;
DEALLOCATE PREPARE stx4023;
SET @cx4024 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_checked_in_at');
SET @sx4024 := IF(@cx4024 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_checked_in_at (`checked_in_at`)', 'SELECT 1');
PREPARE stx4024 FROM @sx4024;
EXECUTE stx4024;
DEALLOCATE PREPARE stx4024;
SET @cx4025 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_no_show_at');
SET @sx4025 := IF(@cx4025 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_no_show_at (`no_show_at`)', 'SELECT 1');
PREPARE stx4025 FROM @sx4025;
EXECUTE stx4025;
DEALLOCATE PREPARE stx4025;
ALTER TABLE reservations MODIFY COLUMN `status` ENUM('pending','approved','rejected','cancelled','confirmed','paid','checked_in','completed','no_show') NOT NULL DEFAULT 'pending';
SET @cx4026 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND COLUMN_NAME = 'floor_assignment');
SET @sx4026 := IF(@cx4026 = 0, 'ALTER TABLE bar_tables ADD COLUMN floor_assignment VARCHAR(50) DEFAULT NULL AFTER `table_number`', 'SELECT 1');
PREPARE stx4026 FROM @sx4026;
EXECUTE stx4026;
DEALLOCATE PREPARE stx4026;
SET @cx4027 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND COLUMN_NAME = 'table_size');
SET @sx4027 := IF(@cx4027 = 0, 'ALTER TABLE bar_tables ADD COLUMN table_size ENUM(''Small'',''Medium'',''Large'') DEFAULT NULL AFTER `capacity`', 'SELECT 1');
PREPARE stx4027 FROM @sx4027;
EXECUTE stx4027;
DEALLOCATE PREPARE stx4027;
SET @cx4028 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND COLUMN_NAME = 'deleted_at');
SET @sx4028 := IF(@cx4028 = 0, 'ALTER TABLE bar_tables ADD COLUMN deleted_at DATETIME DEFAULT NULL AFTER `created_at`', 'SELECT 1');
PREPARE stx4028 FROM @sx4028;
EXECUTE stx4028;
DEALLOCATE PREPARE stx4028;
SET @cx4029 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND INDEX_NAME = 'idx_bar_tables_deleted_at');
SET @sx4029 := IF(@cx4029 = 0, 'ALTER TABLE bar_tables ADD INDEX idx_bar_tables_deleted_at (`deleted_at`)', 'SELECT 1');
PREPARE stx4029 FROM @sx4029;
EXECUTE stx4029;
DEALLOCATE PREPARE stx4029;
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
ALTER TABLE inventory_items MODIFY COLUMN `unit` ENUM('Bottle', 'Bucket', 'Case (12 bottles)', 'Glass', 'Liter', 'Kilogram', 'Piece') DEFAULT 'Piece' COMMENT 'Unit of measurement for inventory item';
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
SET @cx4030 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_events' AND COLUMN_NAME = 'event_type');
SET @sx4030 := IF(@cx4030 = 0, 'ALTER TABLE bar_events ADD COLUMN event_type VARCHAR(100) DEFAULT NULL COMMENT ''Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom'' AFTER `title`', 'SELECT 1');
PREPARE stx4030 FROM @sx4030;
EXECUTE stx4030;
DEALLOCATE PREPARE stx4030;
SET @cx4031 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_events' AND INDEX_NAME = 'idx_event_type');
SET @sx4031 := IF(@cx4031 = 0, 'ALTER TABLE bar_events ADD INDEX idx_event_type (`event_type`)', 'SELECT 1');
PREPARE stx4031 FROM @sx4031;
EXECUTE stx4031;
DEALLOCATE PREPARE stx4031;
SET @cx4032 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_events_archive' AND COLUMN_NAME = 'event_type');
SET @sx4032 := IF(@cx4032 = 0, 'ALTER TABLE bar_events_archive ADD COLUMN event_type VARCHAR(100) DEFAULT NULL COMMENT ''Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom'' AFTER `title`', 'SELECT 1');
PREPARE stx4032 FROM @sx4032;
EXECUTE stx4032;
DEALLOCATE PREPARE stx4032;
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
SET @cx4033 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_settings' AND INDEX_NAME = 'idx_payroll_settings_bar');
SET @sx4033 := IF(@cx4033 = 0, 'CREATE INDEX `idx_payroll_settings_bar` ON `payroll_settings` (`bar_id`)', 'SELECT 1');
PREPARE stx4033 FROM @sx4033;
EXECUTE stx4033;
DEALLOCATE PREPARE stx4033;
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
