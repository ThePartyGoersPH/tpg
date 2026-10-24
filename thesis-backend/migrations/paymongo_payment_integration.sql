-- ═══════════════════════════════════════════════════════════════════════════
-- PAYMONGO PAYMENT INTEGRATION MIGRATION
-- Purpose: Add payment processing for customer orders/reservations and subscriptions
-- ═══════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────
-- 1. payment_transactions — unified payment tracking
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 2. subscription_payments — dedicated subscription payment tracking
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 3. payouts — platform fee and bar owner payouts
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 4. webhook_events — PayMongo webhook event log
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 5. Update subscriptions table for PayMongo integration
-- ──────────────────────────────────────────────
ALTER TABLE `subscriptions`
  MODIFY COLUMN `status` ENUM('pending', 'active', 'cancelled', 'expired', 'past_due', 'rejected') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS `paymongo_payment_id` VARCHAR(255) NULL AFTER `payment_reference`,
  ADD COLUMN IF NOT EXISTS `paymongo_source_id` VARCHAR(255) NULL AFTER `paymongo_payment_id`,
  ADD COLUMN IF NOT EXISTS `checkout_url` TEXT NULL AFTER `paymongo_source_id`;

-- ──────────────────────────────────────────────
-- 6. Update bars table for GCash payout details
-- ──────────────────────────────────────────────
ALTER TABLE `bars`
  ADD COLUMN IF NOT EXISTS `gcash_number` VARCHAR(20) NULL COMMENT 'GCash mobile number for payouts' AFTER `accept_gcash`,
  ADD COLUMN IF NOT EXISTS `gcash_account_name` VARCHAR(255) NULL COMMENT 'Registered GCash account name' AFTER `gcash_number`;

-- ──────────────────────────────────────────────
-- 7. Add payment tracking to POS orders (if table exists)
-- ──────────────────────────────────────────────
ALTER TABLE `pos_orders`
  ADD COLUMN IF NOT EXISTS `payment_transaction_id` INT(11) NULL AFTER `total_amount`,
  ADD COLUMN IF NOT EXISTS `payment_status` ENUM('pending', 'paid', 'refunded', 'failed') NULL DEFAULT 'pending' AFTER `payment_transaction_id`,
  ADD KEY IF NOT EXISTS `idx_pos_payment_transaction` (`payment_transaction_id`);

-- ──────────────────────────────────────────────
-- 8. Create platform settings table for fee configuration
-- ──────────────────────────────────────────────

-- Check if table exists and drop if needed (only if schema is different)
-- If you have existing data, backup first!
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

-- Insert default platform settings
INSERT INTO `platform_settings` (`setting_key`, `setting_value`, `description`)
VALUES 
  ('platform_fee_percentage', '5.00', 'Platform fee percentage for customer payments'),
  ('paymongo_public_key', '', 'PayMongo public API key'),
  ('paymongo_secret_key', '', 'PayMongo secret API key'),
  ('paymongo_webhook_secret', '', 'PayMongo webhook signing secret');

-- ──────────────────────────────────────────────
-- 9. Add indexes for performance
-- ──────────────────────────────────────────────
ALTER TABLE `payment_transactions`
  ADD INDEX IF NOT EXISTS `idx_created_at` (`created_at`),
  ADD INDEX IF NOT EXISTS `idx_paid_at` (`paid_at`);

ALTER TABLE `payouts`
  ADD INDEX IF NOT EXISTS `idx_created_at` (`created_at`),
  ADD INDEX IF NOT EXISTS `idx_processed_at` (`processed_at`);

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════
