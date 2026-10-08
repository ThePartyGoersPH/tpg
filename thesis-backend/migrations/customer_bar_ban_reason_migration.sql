-- Add optional reason for per-bar customer bans shown at login
SET @has_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customer_bar_bans'
    AND COLUMN_NAME = 'ban_reason'
);

SET @ddl := IF(
  @has_col = 0,
  'ALTER TABLE customer_bar_bans ADD COLUMN ban_reason VARCHAR(500) NULL AFTER customer_id',
  'SELECT "customer_bar_bans.ban_reason already exists"'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
