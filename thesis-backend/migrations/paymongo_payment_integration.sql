CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `reference_id` VARCHAR(100) NOT NULL COMMENT 'Internal reference ID',
  `payment_type` ENUM('order', 'reservation', 'subscription') NOT NULL,
  `related_id` INT(11) NOT NULL COMMENT 'ID from orders/reservations/subscriptions',
  `bar_id` INT(11) NULL COMMENT 'Related bar (NULL for subscription payments)',
  `user_id` INT(11) NOT NULL COMMENT 'Paying user',
  `amount` DECIMAL(10,2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL DEFAULT 'PHP',
  `status` ENUM('pending', 'processing', 'paid', 'failed', 'refunded', 'expired') NOT NULL DEFAULT 'pending',
  `payment_method` VARCHAR(50) NULL COMMENT 'gcash, paymaya, card',
  `paymongo_payment_intent_id` VARCHAR(255) NULL,
  `paymongo_payment_id` VARCHAR(255) NULL,
  `paymongo_source_id` VARCHAR(255) NULL,
  `checkout_url` TEXT NULL COMMENT 'PayMongo checkout URL for customer',
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  `failed_reason` TEXT NULL,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_payment_reference` (`reference_id`),
  KEY `idx_payment_type_related` (`payment_type`, `related_id`),
  KEY `idx_payment_user` (`user_id`),
  KEY `idx_payment_status` (`status`),
  KEY `idx_paymongo_intent` (`paymongo_payment_intent_id`),
  KEY `idx_paymongo_source` (`paymongo_source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `subscription_payments` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `subscription_id` INT(11) NOT NULL,
  `payment_transaction_id` INT(11) NULL,
  `amount` DECIMAL(10,2) NOT NULL,
  `status` ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  `paymongo_payment_id` VARCHAR(255) NULL,
  `paid_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_subpay_subscription` (`subscription_id`),
  KEY `idx_subpay_transaction` (`payment_transaction_id`),
  CONSTRAINT `fk_subpay_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_subpay_transaction` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `payouts` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `payment_transaction_id` INT(11) NULL,
  `order_id` INT(11) NULL COMMENT 'Related order if applicable',
  `reservation_id` INT(11) NULL COMMENT 'Related reservation if applicable',
  `gross_amount` DECIMAL(10,2) NOT NULL COMMENT 'Total payment amount',
  `platform_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Platform fee percentage',
  `platform_fee_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `net_amount` DECIMAL(10,2) NOT NULL COMMENT 'Amount to payout to bar',
  `status` ENUM('pending', 'processing', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  `payout_method` VARCHAR(50) NULL COMMENT 'gcash, bank_transfer',
  `payout_reference` VARCHAR(255) NULL,
  `gcash_number` VARCHAR(20) NULL,
  `gcash_account_name` VARCHAR(255) NULL,
  `processed_at` TIMESTAMP NULL DEFAULT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payout_bar` (`bar_id`),
  KEY `idx_payout_transaction` (`payment_transaction_id`),
  KEY `idx_payout_status` (`status`),
  CONSTRAINT `fk_payout_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payout_transaction` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `webhook_events` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `event_id` VARCHAR(255) NOT NULL COMMENT 'PayMongo event ID',
  `event_type` VARCHAR(100) NOT NULL COMMENT 'payment.paid, payment.failed, etc',
  `resource_type` VARCHAR(50) NOT NULL,
  `resource_id` VARCHAR(255) NOT NULL,
  `payload` JSON NOT NULL,
  `processed` TINYINT(1) NOT NULL DEFAULT 0,
  `processed_at` TIMESTAMP NULL DEFAULT NULL,
  `error_message` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_event_id` (`event_id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_processed` (`processed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
ALTER TABLE subscriptions MODIFY COLUMN `status` ENUM('pending', 'active', 'cancelled', 'expired', 'past_due', 'rejected') NOT NULL DEFAULT 'pending';
SET @cx196 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'paymongo_payment_id');
SET @sx196 := IF(@cx196 = 0, 'ALTER TABLE subscriptions ADD COLUMN `paymongo_payment_id` VARCHAR(255) NULL AFTER `payment_reference`', 'SELECT 1');
PREPARE stx196 FROM @sx196;
EXECUTE stx196;
DEALLOCATE PREPARE stx196;
SET @cx197 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'paymongo_source_id');
SET @sx197 := IF(@cx197 = 0, 'ALTER TABLE subscriptions ADD COLUMN `paymongo_source_id` VARCHAR(255) NULL AFTER `paymongo_payment_id`', 'SELECT 1');
PREPARE stx197 FROM @sx197;
EXECUTE stx197;
DEALLOCATE PREPARE stx197;
SET @cx198 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'checkout_url');
SET @sx198 := IF(@cx198 = 0, 'ALTER TABLE subscriptions ADD COLUMN `checkout_url` TEXT NULL AFTER `paymongo_source_id`', 'SELECT 1');
PREPARE stx198 FROM @sx198;
EXECUTE stx198;
DEALLOCATE PREPARE stx198;
SET @cx199 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'gcash_number');
SET @sx199 := IF(@cx199 = 0, 'ALTER TABLE bars ADD COLUMN `gcash_number` VARCHAR(20) NULL COMMENT ''GCash mobile number for payouts'' AFTER `accept_gcash`', 'SELECT 1');
PREPARE stx199 FROM @sx199;
EXECUTE stx199;
DEALLOCATE PREPARE stx199;
SET @cx200 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'gcash_account_name');
SET @sx200 := IF(@cx200 = 0, 'ALTER TABLE bars ADD COLUMN `gcash_account_name` VARCHAR(255) NULL COMMENT ''Registered GCash account name'' AFTER `gcash_number`', 'SELECT 1');
PREPARE stx200 FROM @sx200;
EXECUTE stx200;
DEALLOCATE PREPARE stx200;
SET @cx201 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'payment_transaction_id');
SET @sx201 := IF(@cx201 = 0, 'ALTER TABLE pos_orders ADD COLUMN `payment_transaction_id` INT(11) NULL AFTER `total_amount`', 'SELECT 1');
PREPARE stx201 FROM @sx201;
EXECUTE stx201;
DEALLOCATE PREPARE stx201;
SET @cx202 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'payment_status');
SET @sx202 := IF(@cx202 = 0, 'ALTER TABLE pos_orders ADD COLUMN `payment_status` ENUM(''pending'', ''paid'', ''refunded'', ''failed'') NULL DEFAULT ''pending'' AFTER `payment_transaction_id`', 'SELECT 1');
PREPARE stx202 FROM @sx202;
EXECUTE stx202;
DEALLOCATE PREPARE stx202;
SET @cx203 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND INDEX_NAME = 'idx_pos_payment_transaction');
SET @sx203 := IF(@cx203 = 0, 'ALTER TABLE pos_orders ADD KEY `idx_pos_payment_transaction` (`payment_transaction_id`)', 'SELECT 1');
PREPARE stx203 FROM @sx203;
EXECUTE stx203;
DEALLOCATE PREPARE stx203;
DROP TABLE IF EXISTS `platform_settings`;
CREATE TABLE `platform_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `setting_key` VARCHAR(100) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `description` TEXT NULL,
  `updated_by` INT(11) NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT INTO `platform_settings` (`setting_key`, `setting_value`, `description`)
VALUES 
  ('platform_fee_percentage', '5.00', 'Platform fee percentage for customer payments'),
  ('paymongo_public_key', '', 'PayMongo public API key'),
  ('paymongo_secret_key', '', 'PayMongo secret API key'),
  ('paymongo_webhook_secret', '', 'PayMongo webhook signing secret');
SET @cx204 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transactions' AND INDEX_NAME = 'idx_created_at');
SET @sx204 := IF(@cx204 = 0, 'ALTER TABLE payment_transactions ADD INDEX `idx_created_at` (`created_at`)', 'SELECT 1');
PREPARE stx204 FROM @sx204;
EXECUTE stx204;
DEALLOCATE PREPARE stx204;
SET @cx205 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transactions' AND INDEX_NAME = 'idx_paid_at');
SET @sx205 := IF(@cx205 = 0, 'ALTER TABLE payment_transactions ADD INDEX `idx_paid_at` (`paid_at`)', 'SELECT 1');
PREPARE stx205 FROM @sx205;
EXECUTE stx205;
DEALLOCATE PREPARE stx205;
SET @cx21 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payouts' AND INDEX_NAME = 'idx_created_at');
SET @sx21 := IF(@cx21 = 0, 'ALTER TABLE payouts ADD INDEX `idx_created_at` (`created_at`)', 'SELECT 1');
PREPARE stx21 FROM @sx21;
EXECUTE stx21;
DEALLOCATE PREPARE stx21;
SET @cx22 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payouts' AND INDEX_NAME = 'idx_processed_at');
SET @sx22 := IF(@cx22 = 0, 'ALTER TABLE payouts ADD INDEX `idx_processed_at` (`processed_at`)', 'SELECT 1');
PREPARE stx22 FROM @sx22;
EXECUTE stx22;
DEALLOCATE PREPARE stx22;
