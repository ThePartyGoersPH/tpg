-- Migration: Add optional pricing columns to inventory_requests
-- Date: 2026-04-01
-- Purpose: Prevent server errors when newer inventory request API writes
--          cost_price and reorder_level on deployments created from older schema.

SET @db_name = DATABASE();

SET @has_cost_price = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_requests'
    AND COLUMN_NAME = 'cost_price'
);

SET @sql_cost_price = IF(
  @has_cost_price = 0,
  'ALTER TABLE inventory_requests ADD COLUMN cost_price DECIMAL(10,2) NULL AFTER reason',
  'SELECT "inventory_requests.cost_price already exists" AS info'
);

PREPARE stmt_cost_price FROM @sql_cost_price;
EXECUTE stmt_cost_price;
DEALLOCATE PREPARE stmt_cost_price;

SET @has_reorder_level = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'inventory_requests'
    AND COLUMN_NAME = 'reorder_level'
);

SET @sql_reorder_level = IF(
  @has_reorder_level = 0,
  'ALTER TABLE inventory_requests ADD COLUMN reorder_level INT NULL AFTER cost_price',
  'SELECT "inventory_requests.reorder_level already exists" AS info'
);

PREPARE stmt_reorder_level FROM @sql_reorder_level;
EXECUTE stmt_reorder_level;
DEALLOCATE PREPARE stmt_reorder_level;
