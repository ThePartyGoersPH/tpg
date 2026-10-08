-- POS Cash Shift Management Migration
-- Adds shift balancing, cash movement tracking, and order-to-shift linkage.

SET @db_name := DATABASE();

-- 1) shifts table
CREATE TABLE IF NOT EXISTS `shifts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cashier_id` INT NOT NULL,
  `bar_id` INT NOT NULL,
  `opening_cash` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `expected_cash` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `actual_cash` DECIMAL(12,2) NULL,
  `difference` DECIMAL(12,2) NULL,
  `status` ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  `close_status` ENUM('BALANCED','SHORT','OVER') NULL,
  `alert_flag` TINYINT(1) NOT NULL DEFAULT 0,
  `open_marker` TINYINT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `closed_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_shifts_cashier` (`cashier_id`),
  KEY `idx_shifts_bar` (`bar_id`),
  KEY `idx_shifts_status` (`status`),
  UNIQUE KEY `uniq_shift_open_per_cashier` (`cashier_id`, `open_marker`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) cash_transactions table
CREATE TABLE IF NOT EXISTS `cash_transactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `shift_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('CASH_IN','CASH_OUT') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cash_tx_shift` (`shift_id`),
  KEY `idx_cash_tx_type` (`type`),
  CONSTRAINT `fk_cash_transactions_shift`
    FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) pos_orders.shift_id column (if missing)
SET @has_pos_orders_shift_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'pos_orders'
    AND COLUMN_NAME = 'shift_id'
);

SET @sql_add_shift_id := IF(
  @has_pos_orders_shift_id = 0,
  'ALTER TABLE pos_orders ADD COLUMN shift_id BIGINT UNSIGNED NULL AFTER staff_user_id',
  'SELECT "pos_orders.shift_id already exists" AS info'
);

PREPARE stmt_add_shift_id FROM @sql_add_shift_id;
EXECUTE stmt_add_shift_id;
DEALLOCATE PREPARE stmt_add_shift_id;

-- 4) add index for shift_id if missing
SET @has_pos_orders_shift_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'pos_orders'
    AND INDEX_NAME = 'idx_pos_orders_shift_id'
);

SET @sql_add_shift_idx := IF(
  @has_pos_orders_shift_idx = 0,
  'ALTER TABLE pos_orders ADD INDEX idx_pos_orders_shift_id (shift_id)',
  'SELECT "idx_pos_orders_shift_id already exists" AS info'
);

PREPARE stmt_add_shift_idx FROM @sql_add_shift_idx;
EXECUTE stmt_add_shift_idx;
DEALLOCATE PREPARE stmt_add_shift_idx;

-- 5) add foreign key from pos_orders.shift_id to shifts.id when possible
SET @has_fk_pos_orders_shift := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'pos_orders'
    AND CONSTRAINT_NAME = 'fk_pos_orders_shift'
);

SET @sql_add_fk_shift := IF(
  @has_fk_pos_orders_shift = 0,
  'ALTER TABLE pos_orders ADD CONSTRAINT fk_pos_orders_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL',
  'SELECT "fk_pos_orders_shift already exists" AS info'
);

PREPARE stmt_add_fk_shift FROM @sql_add_fk_shift;
EXECUTE stmt_add_fk_shift;
DEALLOCATE PREPARE stmt_add_fk_shift;
