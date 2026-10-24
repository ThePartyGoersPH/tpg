-- ============================================================
-- Migration: Ban and Suspension Login Messages
-- Description: Adds message columns used for login-facing ban/suspension responses.
-- Date: 2026-03-20
-- ============================================================

-- users.ban_reason
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'ban_reason'
);

SET @col_sql := IF(
  @col_exists = 0,
  "ALTER TABLE `users` ADD COLUMN `ban_reason` varchar(500) DEFAULT NULL AFTER `banned_by`",
  'SELECT 1'
);

PREPARE stmt FROM @col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- bars.suspension_message
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'suspension_message'
);

SET @col_sql := IF(
  @col_exists = 0,
  "ALTER TABLE `bars` ADD COLUMN `suspension_message` text DEFAULT NULL AFTER `lifecycle_status`",
  'SELECT 1'
);

PREPARE stmt FROM @col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
