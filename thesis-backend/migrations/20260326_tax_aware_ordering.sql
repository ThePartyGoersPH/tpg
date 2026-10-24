-- ============================================================
-- Migration: Tax-Aware Customer Web Ordering System
-- Date: 2026-03-26
-- Safe to run multiple times (idempotent)
-- Does NOT break existing POS/reservation functionality
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- STEP 1: Add tax configuration fields to bars table
-- ──────────────────────────────────────────────────────────

-- tin (BIR Tax Identification Number)
SET @has_tin := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'tin'
);
SET @sql_tin := IF(@has_tin = 0,
  'ALTER TABLE bars ADD COLUMN tin VARCHAR(20) DEFAULT NULL COMMENT ''BIR TIN number'' AFTER minimum_reservation_deposit',
  'SELECT 1'
);
PREPARE stmt_tin FROM @sql_tin; EXECUTE stmt_tin; DEALLOCATE PREPARE stmt_tin;

-- is_bir_registered
SET @has_bir := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'is_bir_registered'
);
SET @sql_bir := IF(@has_bir = 0,
  'ALTER TABLE bars ADD COLUMN is_bir_registered TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1 if registered with BIR''',
  'SELECT 1'
);
PREPARE stmt_bir FROM @sql_bir; EXECUTE stmt_bir; DEALLOCATE PREPARE stmt_bir;

-- tax_type (VAT or NON_VAT)
SET @has_tax_type := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'tax_type'
);
SET @sql_tax_type := IF(@has_tax_type = 0,
  'ALTER TABLE bars ADD COLUMN tax_type ENUM(''VAT'',''NON_VAT'') NOT NULL DEFAULT ''NON_VAT'' COMMENT ''Tax classification''',
  'SELECT 1'
);
PREPARE stmt_tax_type FROM @sql_tax_type; EXECUTE stmt_tax_type; DEALLOCATE PREPARE stmt_tax_type;

-- tax_rate (e.g. 12.00 for 12% VAT)
SET @has_tax_rate := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'tax_rate'
);
SET @sql_tax_rate := IF(@has_tax_rate = 0,
  'ALTER TABLE bars ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT ''Tax rate percentage e.g. 12.00''',
  'SELECT 1'
);
PREPARE stmt_tax_rate FROM @sql_tax_rate; EXECUTE stmt_tax_rate; DEALLOCATE PREPARE stmt_tax_rate;

-- tax_mode (EXCLUSIVE = add on top, INCLUSIVE = already in price)
SET @has_tax_mode := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'tax_mode'
);
SET @sql_tax_mode := IF(@has_tax_mode = 0,
  'ALTER TABLE bars ADD COLUMN tax_mode ENUM(''EXCLUSIVE'',''INCLUSIVE'') NOT NULL DEFAULT ''EXCLUSIVE'' COMMENT ''EXCLUSIVE: tax added on top; INCLUSIVE: tax already in price''',
  'SELECT 1'
);
PREPARE stmt_tax_mode FROM @sql_tax_mode; EXECUTE stmt_tax_mode; DEALLOCATE PREPARE stmt_tax_mode;

-- ──────────────────────────────────────────────────────────
-- STEP 2: Extend pos_orders for customer web orders
-- ──────────────────────────────────────────────────────────

-- Make staff_user_id nullable (customer web orders have no staff)
SET @staff_nullable := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders'
  AND COLUMN_NAME = 'staff_user_id' AND IS_NULLABLE = 'YES'
);
SET @sql_staff := IF(@staff_nullable = 0,
  'ALTER TABLE pos_orders MODIFY COLUMN staff_user_id INT(11) DEFAULT NULL COMMENT ''NULL for web customer orders''',
  'SELECT 1'
);
PREPARE stmt_staff FROM @sql_staff; EXECUTE stmt_staff; DEALLOCATE PREPARE stmt_staff;

-- customer_user_id (who placed the web order)
SET @has_cuid := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'customer_user_id'
);
SET @sql_cuid := IF(@has_cuid = 0,
  'ALTER TABLE pos_orders ADD COLUMN customer_user_id INT(11) DEFAULT NULL COMMENT ''Set for web customer orders''',
  'SELECT 1'
);
PREPARE stmt_cuid FROM @sql_cuid; EXECUTE stmt_cuid; DEALLOCATE PREPARE stmt_cuid;

-- order_source (pos = staff POS, web = customer web order)
SET @has_src := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'order_source'
);
SET @sql_src := IF(@has_src = 0,
  'ALTER TABLE pos_orders ADD COLUMN order_source ENUM(''pos'',''web'') NOT NULL DEFAULT ''pos'' COMMENT ''pos=staff POS; web=customer web order''',
  'SELECT 1'
);
PREPARE stmt_src FROM @sql_src; EXECUTE stmt_src; DEALLOCATE PREPARE stmt_src;

-- tax_amount
SET @has_tax_amt := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'tax_amount'
);
SET @sql_tax_amt := IF(@has_tax_amt = 0,
  'ALTER TABLE pos_orders ADD COLUMN tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''Computed tax amount''',
  'SELECT 1'
);
PREPARE stmt_tax_amt FROM @sql_tax_amt; EXECUTE stmt_tax_amt; DEALLOCATE PREPARE stmt_tax_amt;

-- tax_type_snapshot (snapshot of bar tax_type at time of order)
SET @has_tts := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'tax_type_snapshot'
);
SET @sql_tts := IF(@has_tts = 0,
  'ALTER TABLE pos_orders ADD COLUMN tax_type_snapshot VARCHAR(10) DEFAULT NULL COMMENT ''Bar tax_type at time of order''',
  'SELECT 1'
);
PREPARE stmt_tts FROM @sql_tts; EXECUTE stmt_tts; DEALLOCATE PREPARE stmt_tts;

-- tax_rate_snapshot (snapshot of bar tax_rate at time of order)
SET @has_trs := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'tax_rate_snapshot'
);
SET @sql_trs := IF(@has_trs = 0,
  'ALTER TABLE pos_orders ADD COLUMN tax_rate_snapshot DECIMAL(5,2) DEFAULT NULL COMMENT ''Bar tax_rate at time of order''',
  'SELECT 1'
);
PREPARE stmt_trs FROM @sql_trs; EXECUTE stmt_trs; DEALLOCATE PREPARE stmt_trs;

-- or_number (Official Receipt number)
SET @has_or := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'or_number'
);
SET @sql_or := IF(@has_or = 0,
  'ALTER TABLE pos_orders ADD COLUMN or_number VARCHAR(50) DEFAULT NULL UNIQUE COMMENT ''Official Receipt number: BARID-YYYYMMDD-XXXX''',
  'SELECT 1'
);
PREPARE stmt_or FROM @sql_or; EXECUTE stmt_or; DEALLOCATE PREPARE stmt_or;

-- ──────────────────────────────────────────────────────────
-- STEP 3: OR Number Sequences Table (sequential per bar per day)
-- ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS or_number_sequences (
  id         INT(11)     NOT NULL AUTO_INCREMENT,
  bar_id     INT(11)     NOT NULL,
  date_key   VARCHAR(8)  NOT NULL COMMENT 'YYYYMMDD',
  last_seq   INT(11)     NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY unique_bar_date (bar_id, date_key),
  INDEX idx_orseq_bar (bar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='Tracks sequential OR numbers per bar per day';

-- ──────────────────────────────────────────────────────────
-- STEP 4: Add index on pos_orders for customer queries
-- ──────────────────────────────────────────────────────────

SET @has_idx := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders'
  AND INDEX_NAME = 'idx_pos_orders_customer'
);
SET @sql_idx := IF(@has_idx = 0,
  'ALTER TABLE pos_orders ADD INDEX idx_pos_orders_customer (customer_user_id, order_source)',
  'SELECT 1'
);
PREPARE stmt_idx FROM @sql_idx; EXECUTE stmt_idx; DEALLOCATE PREPARE stmt_idx;
