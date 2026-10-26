SET @cx4201 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'owner_middle_name');
SET @sx4201 := IF(@cx4201 = 0, 'ALTER TABLE business_registrations ADD COLUMN owner_middle_name VARCHAR(80) DEFAULT NULL AFTER `owner_first_name`', 'SELECT 1');
PREPARE stx4201 FROM @sx4201;
EXECUTE stx4201;
DEALLOCATE PREPARE stx4201;
SET @cx2020 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'middle_name');
SET @sx2020 := IF(@cx2020 = 0, 'ALTER TABLE users ADD COLUMN middle_name VARCHAR(50) DEFAULT NULL AFTER `first_name`', 'SELECT 1');
PREPARE stx2020 FROM @sx2020;
EXECUTE stx2020;
DEALLOCATE PREPARE stx2020;
SET @cx4202 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'business_barangay');
SET @sx4202 := IF(@cx4202 = 0, 'ALTER TABLE business_registrations ADD COLUMN business_barangay VARCHAR(100) DEFAULT NULL AFTER `business_city`', 'SELECT 1');
PREPARE stx4202 FROM @sx4202;
EXECUTE stx4202;
DEALLOCATE PREPARE stx4202;
SET @cx4203 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'bar_types');
SET @sx4203 := IF(@cx4203 = 0, 'ALTER TABLE business_registrations ADD COLUMN bar_types TEXT DEFAULT NULL AFTER `business_description`', 'SELECT 1');
PREPARE stx4203 FROM @sx4203;
EXECUTE stx4203;
DEALLOCATE PREPARE stx4203;
SET @cx4204 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'selfie_with_id');
SET @sx4204 := IF(@cx4204 = 0, 'ALTER TABLE business_registrations ADD COLUMN selfie_with_id VARCHAR(500) DEFAULT NULL AFTER `business_permit`', 'SELECT 1');
PREPARE stx4204 FROM @sx4204;
EXECUTE stx4204;
DEALLOCATE PREPARE stx4204;
SET @cx4205 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'email_verification_token');
SET @sx4205 := IF(@cx4205 = 0, 'ALTER TABLE business_registrations ADD COLUMN email_verification_token VARCHAR(255) DEFAULT NULL AFTER `owner_password`', 'SELECT 1');
PREPARE stx4205 FROM @sx4205;
EXECUTE stx4205;
DEALLOCATE PREPARE stx4205;
SET @cx4206 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'email_verification_expires');
SET @sx4206 := IF(@cx4206 = 0, 'ALTER TABLE business_registrations ADD COLUMN email_verification_expires DATETIME DEFAULT NULL AFTER `email_verification_token`', 'SELECT 1');
PREPARE stx4206 FROM @sx4206;
EXECUTE stx4206;
DEALLOCATE PREPARE stx4206;
SET @cx4207 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND COLUMN_NAME = 'email_verified_at');
SET @sx4207 := IF(@cx4207 = 0, 'ALTER TABLE business_registrations ADD COLUMN email_verified_at DATETIME DEFAULT NULL AFTER `email_verification_expires`', 'SELECT 1');
PREPARE stx4207 FROM @sx4207;
EXECUTE stx4207;
DEALLOCATE PREPARE stx4207;
SET @cx2021 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'business_registrations' AND INDEX_NAME = 'idx_br_email_verification_token');
SET @sx2021 := IF(@cx2021 = 0, 'ALTER TABLE business_registrations ADD INDEX idx_br_email_verification_token (`email_verification_token`)', 'SELECT 1');
PREPARE stx2021 FROM @sx2021;
EXECUTE stx2021;
DEALLOCATE PREPARE stx2021;
ALTER TABLE business_registrations MODIFY COLUMN `status` ENUM('pending','pending_email_verification','pending_admin_approval','approved','rejected') NOT NULL DEFAULT 'pending_email_verification';
SET @cx4208 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'bar_types');
SET @sx4208 := IF(@cx4208 = 0, 'ALTER TABLE bars ADD COLUMN bar_types TEXT DEFAULT NULL AFTER `category`', 'SELECT 1');
PREPARE stx4208 FROM @sx4208;
EXECUTE stx4208;
DEALLOCATE PREPARE stx4208;
SET @cx4209 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'reservation_time_limit_mode');
SET @sx4209 := IF(@cx4209 = 0, 'ALTER TABLE bars ADD COLUMN reservation_time_limit_mode ENUM(''restobar'',''club'',''event'',''custom'') DEFAULT NULL AFTER `bar_types`', 'SELECT 1');
PREPARE stx4209 FROM @sx4209;
EXECUTE stx4209;
DEALLOCATE PREPARE stx4209;
SET @cx4210 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'reservation_time_limit_minutes');
SET @sx4210 := IF(@cx4210 = 0, 'ALTER TABLE bars ADD COLUMN reservation_time_limit_minutes INT DEFAULT NULL AFTER `reservation_time_limit_mode`', 'SELECT 1');
PREPARE stx4210 FROM @sx4210;
EXECUTE stx4210;
DEALLOCATE PREPARE stx4210;
SET @cx4211 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'staff_types');
SET @sx4211 := IF(@cx4211 = 0, 'ALTER TABLE bars ADD COLUMN staff_types JSON DEFAULT NULL COMMENT ''Array of staff types present at the bar'' AFTER `bar_types`', 'SELECT 1');
PREPARE stx4211 FROM @sx4211;
EXECUTE stx4211;
DEALLOCATE PREPARE stx4211;
SET @cx4212 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_expiry_date');
SET @sx4212 := IF(@cx4212 = 0, 'ALTER TABLE bars ADD COLUMN permit_expiry_date DATE DEFAULT NULL COMMENT ''Business permit expiry date''', 'SELECT 1');
PREPARE stx4212 FROM @sx4212;
EXECUTE stx4212;
DEALLOCATE PREPARE stx4212;
SET @cx4213 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_status');
SET @sx4213 := IF(@cx4213 = 0, 'ALTER TABLE bars ADD COLUMN permit_status ENUM(''valid'', ''expiring_soon'', ''expired'') DEFAULT ''valid'' COMMENT ''Permit status: valid, expiring_soon (30 days), expired''', 'SELECT 1');
PREPARE stx4213 FROM @sx4213;
EXECUTE stx4213;
DEALLOCATE PREPARE stx4213;
SET @cx4214 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_expiry_notified_at');
SET @sx4214 := IF(@cx4214 = 0, 'ALTER TABLE bars ADD COLUMN permit_expiry_notified_at TIMESTAMP NULL DEFAULT NULL COMMENT ''Last time expiry notification was sent''', 'SELECT 1');
PREPARE stx4214 FROM @sx4214;
EXECUTE stx4214;
DEALLOCATE PREPARE stx4214;
SET @cx4215 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'permit_expired_flagged_at');
SET @sx4215 := IF(@cx4215 = 0, 'ALTER TABLE bars ADD COLUMN permit_expired_flagged_at TIMESTAMP NULL DEFAULT NULL COMMENT ''When permit was flagged as expired''', 'SELECT 1');
PREPARE stx4215 FROM @sx4215;
EXECUTE stx4215;
DEALLOCATE PREPARE stx4215;
SET @cx3004 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND INDEX_NAME = 'idx_permit_expiry_date');
SET @sx3004 := IF(@cx3004 = 0, 'CREATE INDEX `idx_permit_expiry_date` ON `bars` (`permit_expiry_date`)', 'SELECT 1');
PREPARE stx3004 FROM @sx3004;
EXECUTE stx3004;
DEALLOCATE PREPARE stx3004;
SET @cx3005 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND INDEX_NAME = 'idx_permit_status');
SET @sx3005 := IF(@cx3005 = 0, 'CREATE INDEX `idx_permit_status` ON `bars` (`permit_status`)', 'SELECT 1');
PREPARE stx3005 FROM @sx3005;
EXECUTE stx3005;
DEALLOCATE PREPARE stx3005;
SET @cx4216 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'reserved_until');
SET @sx4216 := IF(@cx4216 = 0, 'ALTER TABLE reservations ADD COLUMN reserved_until DATETIME DEFAULT NULL AFTER `reservation_time`', 'SELECT 1');
PREPARE stx4216 FROM @sx4216;
EXECUTE stx4216;
DEALLOCATE PREPARE stx4216;
SET @cx2022 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_reserved_until');
SET @sx2022 := IF(@cx2022 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_reserved_until (`reserved_until`)', 'SELECT 1');
PREPARE stx2022 FROM @sx2022;
EXECUTE stx2022;
DEALLOCATE PREPARE stx2022;
SET @cx4217 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'checked_in_at');
SET @sx4217 := IF(@cx4217 = 0, 'ALTER TABLE reservations ADD COLUMN checked_in_at DATETIME DEFAULT NULL AFTER `paid_at`', 'SELECT 1');
PREPARE stx4217 FROM @sx4217;
EXECUTE stx4217;
DEALLOCATE PREPARE stx4217;
SET @cx4218 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'no_show_at');
SET @sx4218 := IF(@cx4218 = 0, 'ALTER TABLE reservations ADD COLUMN no_show_at DATETIME DEFAULT NULL AFTER `checked_in_at`', 'SELECT 1');
PREPARE stx4218 FROM @sx4218;
EXECUTE stx4218;
DEALLOCATE PREPARE stx4218;
SET @cx2023 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_checked_in_at');
SET @sx2023 := IF(@cx2023 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_checked_in_at (`checked_in_at`)', 'SELECT 1');
PREPARE stx2023 FROM @sx2023;
EXECUTE stx2023;
DEALLOCATE PREPARE stx2023;
SET @cx2024 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_no_show_at');
SET @sx2024 := IF(@cx2024 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_no_show_at (`no_show_at`)', 'SELECT 1');
PREPARE stx2024 FROM @sx2024;
EXECUTE stx2024;
DEALLOCATE PREPARE stx2024;
ALTER TABLE reservations MODIFY COLUMN `status` ENUM('pending','approved','rejected','cancelled','confirmed','paid','checked_in','completed','no_show') NOT NULL DEFAULT 'pending';
SET @cx4219 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND COLUMN_NAME = 'floor_assignment');
SET @sx4219 := IF(@cx4219 = 0, 'ALTER TABLE bar_tables ADD COLUMN floor_assignment VARCHAR(50) DEFAULT NULL AFTER `table_number`', 'SELECT 1');
PREPARE stx4219 FROM @sx4219;
EXECUTE stx4219;
DEALLOCATE PREPARE stx4219;
SET @cx4220 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND COLUMN_NAME = 'table_size');
SET @sx4220 := IF(@cx4220 = 0, 'ALTER TABLE bar_tables ADD COLUMN table_size ENUM(''Small'',''Medium'',''Large'') DEFAULT NULL AFTER `capacity`', 'SELECT 1');
PREPARE stx4220 FROM @sx4220;
EXECUTE stx4220;
DEALLOCATE PREPARE stx4220;
SET @cx4221 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND COLUMN_NAME = 'deleted_at');
SET @sx4221 := IF(@cx4221 = 0, 'ALTER TABLE bar_tables ADD COLUMN deleted_at DATETIME DEFAULT NULL AFTER `created_at`', 'SELECT 1');
PREPARE stx4221 FROM @sx4221;
EXECUTE stx4221;
DEALLOCATE PREPARE stx4221;
SET @cx2025 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_tables' AND INDEX_NAME = 'idx_bar_tables_deleted_at');
SET @sx2025 := IF(@cx2025 = 0, 'ALTER TABLE bar_tables ADD INDEX idx_bar_tables_deleted_at (`deleted_at`)', 'SELECT 1');
PREPARE stx2025 FROM @sx2025;
EXECUTE stx2025;
DEALLOCATE PREPARE stx2025;
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
SET @cx4222 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_events' AND COLUMN_NAME = 'event_type');
SET @sx4222 := IF(@cx4222 = 0, 'ALTER TABLE bar_events ADD COLUMN event_type VARCHAR(100) DEFAULT NULL COMMENT ''Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom'' AFTER `title`', 'SELECT 1');
PREPARE stx4222 FROM @sx4222;
EXECUTE stx4222;
DEALLOCATE PREPARE stx4222;
SET @cx4223 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_events' AND INDEX_NAME = 'idx_event_type');
SET @sx4223 := IF(@cx4223 = 0, 'ALTER TABLE bar_events ADD INDEX idx_event_type (`event_type`)', 'SELECT 1');
PREPARE stx4223 FROM @sx4223;
EXECUTE stx4223;
DEALLOCATE PREPARE stx4223;
SET @cx4224 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_events_archive' AND COLUMN_NAME = 'event_type');
SET @sx4224 := IF(@cx4224 = 0, 'ALTER TABLE bar_events_archive ADD COLUMN event_type VARCHAR(100) DEFAULT NULL COMMENT ''Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom'' AFTER `title`', 'SELECT 1');
PREPARE stx4224 FROM @sx4224;
EXECUTE stx4224;
DEALLOCATE PREPARE stx4224;
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
SET @cx3006 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_settings' AND INDEX_NAME = 'idx_payroll_settings_bar');
SET @sx3006 := IF(@cx3006 = 0, 'CREATE INDEX `idx_payroll_settings_bar` ON `payroll_settings` (`bar_id`)', 'SELECT 1');
PREPARE stx3006 FROM @sx3006;
EXECUTE stx3006;
DEALLOCATE PREPARE stx3006;
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
