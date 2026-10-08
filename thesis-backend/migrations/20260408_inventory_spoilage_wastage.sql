-- Migration: Inventory spoilage detection and wastage tracking
-- Date: 2026-04-08
-- Purpose:
-- 1) Add perishable tracking columns to inventory_items
-- 2) Create wastage_logs table for inventory wastage audit and analytics

SET @db_name = DATABASE();

-- Add inventory_items.is_perishable
SET @has_is_perishable = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_items'
    AND COLUMN_NAME = 'is_perishable'
);

SET @sql_is_perishable = IF(
  @has_is_perishable = 0,
  'ALTER TABLE inventory_items ADD COLUMN is_perishable TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active',
  'SELECT "inventory_items.is_perishable already exists" AS info'
);

PREPARE stmt_is_perishable FROM @sql_is_perishable;
EXECUTE stmt_is_perishable;
DEALLOCATE PREPARE stmt_is_perishable;

-- Add inventory_items.expiry_date
SET @has_expiry_date = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_items'
    AND COLUMN_NAME = 'expiry_date'
);

SET @sql_expiry_date = IF(
  @has_expiry_date = 0,
  'ALTER TABLE inventory_items ADD COLUMN expiry_date DATE NULL AFTER is_perishable',
  'SELECT "inventory_items.expiry_date already exists" AS info'
);

PREPARE stmt_expiry_date FROM @sql_expiry_date;
EXECUTE stmt_expiry_date;
DEALLOCATE PREPARE stmt_expiry_date;

-- Add inventory_items.shelf_life_days
SET @has_shelf_life_days = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_items'
    AND COLUMN_NAME = 'shelf_life_days'
);

SET @sql_shelf_life_days = IF(
  @has_shelf_life_days = 0,
  'ALTER TABLE inventory_items ADD COLUMN shelf_life_days INT NULL AFTER expiry_date',
  'SELECT "inventory_items.shelf_life_days already exists" AS info'
);

PREPARE stmt_shelf_life_days FROM @sql_shelf_life_days;
EXECUTE stmt_shelf_life_days;
DEALLOCATE PREPARE stmt_shelf_life_days;

-- Add inventory_items.date_added
SET @has_date_added = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_items'
    AND COLUMN_NAME = 'date_added'
);

SET @sql_date_added = IF(
  @has_date_added = 0,
  'ALTER TABLE inventory_items ADD COLUMN date_added DATETIME NULL AFTER created_at',
  'SELECT "inventory_items.date_added already exists" AS info'
);

PREPARE stmt_date_added FROM @sql_date_added;
EXECUTE stmt_date_added;
DEALLOCATE PREPARE stmt_date_added;

-- Add inventory_items.status (perishability status)
SET @has_status = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_items'
    AND COLUMN_NAME = 'status'
);

SET @sql_status = IF(
  @has_status = 0,
  'ALTER TABLE inventory_items ADD COLUMN status ENUM(\'normal\',\'near_expiry\',\'spoiled\') NOT NULL DEFAULT \'normal\' AFTER date_added',
  'SELECT "inventory_items.status already exists" AS info'
);

PREPARE stmt_status FROM @sql_status;
EXECUTE stmt_status;
DEALLOCATE PREPARE stmt_status;

-- Backfill date_added for existing rows
SET @has_date_added_after = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_items'
    AND COLUMN_NAME = 'date_added'
);

SET @sql_backfill_date_added = IF(
  @has_date_added_after = 1,
  'UPDATE inventory_items SET date_added = COALESCE(date_added, created_at, NOW()) WHERE date_added IS NULL',
  'SELECT "inventory_items.date_added missing, skip backfill" AS info'
);

PREPARE stmt_backfill_date_added FROM @sql_backfill_date_added;
EXECUTE stmt_backfill_date_added;
DEALLOCATE PREPARE stmt_backfill_date_added;

-- Create wastage_logs table
CREATE TABLE IF NOT EXISTS wastage_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_id INT NOT NULL,
  quantity_wasted INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  date_logged DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logged_by INT NOT NULL,
  CONSTRAINT fk_wastage_logs_item
    FOREIGN KEY (item_id) REFERENCES inventory_items(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_wastage_logs_user
    FOREIGN KEY (logged_by) REFERENCES users(id)
    ON DELETE RESTRICT
);

-- Indexes for near-expiry and spoilage/wastage analytics
SET @has_idx_inventory_perishable = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_items'
    AND INDEX_NAME = 'idx_inventory_items_perishable_status'
);

SET @sql_idx_inventory_perishable = IF(
  @has_idx_inventory_perishable = 0,
  'CREATE INDEX idx_inventory_items_perishable_status ON inventory_items (bar_id, is_perishable, status, expiry_date)',
  'SELECT "idx_inventory_items_perishable_status already exists" AS info'
);

PREPARE stmt_idx_inventory_perishable FROM @sql_idx_inventory_perishable;
EXECUTE stmt_idx_inventory_perishable;
DEALLOCATE PREPARE stmt_idx_inventory_perishable;

SET @has_idx_wastage_item_date = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'wastage_logs'
    AND INDEX_NAME = 'idx_wastage_logs_item_date'
);

SET @sql_idx_wastage_item_date = IF(
  @has_idx_wastage_item_date = 0,
  'CREATE INDEX idx_wastage_logs_item_date ON wastage_logs (item_id, date_logged)',
  'SELECT "idx_wastage_logs_item_date already exists" AS info'
);

PREPARE stmt_idx_wastage_item_date FROM @sql_idx_wastage_item_date;
EXECUTE stmt_idx_wastage_item_date;
DEALLOCATE PREPARE stmt_idx_wastage_item_date;

SET @has_idx_wastage_logged_by = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'wastage_logs'
    AND INDEX_NAME = 'idx_wastage_logs_logged_by'
);

SET @sql_idx_wastage_logged_by = IF(
  @has_idx_wastage_logged_by = 0,
  'CREATE INDEX idx_wastage_logs_logged_by ON wastage_logs (logged_by)',
  'SELECT "idx_wastage_logs_logged_by already exists" AS info'
);

PREPARE stmt_idx_wastage_logged_by FROM @sql_idx_wastage_logged_by;
EXECUTE stmt_idx_wastage_logged_by;
DEALLOCATE PREPARE stmt_idx_wastage_logged_by;
