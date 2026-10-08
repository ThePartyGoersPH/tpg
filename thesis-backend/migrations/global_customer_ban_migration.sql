-- ============================================================
-- Migration: Global Customer Ban Support
-- Description: Adds platform-wide ban columns to users table
--              for SUPER_ADMIN global banning.
-- Date: 2026-03-13
-- ============================================================

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'is_banned'
);

SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `is_banned` tinyint(1) NOT NULL DEFAULT 0 AFTER `is_active`',
  'SELECT 1'
);

PREPARE stmt FROM @col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'banned_at'
);

SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `banned_at` datetime DEFAULT NULL AFTER `is_banned`',
  'SELECT 1'
);

PREPARE stmt FROM @col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'banned_by'
);

SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `banned_by` int(11) DEFAULT NULL AFTER `banned_at`',
  'SELECT 1'
);

PREPARE stmt FROM @col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_is_banned'
);

SET @idx_sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `users` ADD INDEX `idx_users_is_banned` (`is_banned`)',
  'SELECT 1'
);

PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND INDEX_NAME = 'idx_users_banned_by'
);

SET @idx_sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `users` ADD INDEX `idx_users_banned_by` (`banned_by`)',
  'SELECT 1'
);

PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_users_banned_by'
);

SET @fk_sql := IF(
  @fk_exists = 0,
  'ALTER TABLE `users` ADD CONSTRAINT `fk_users_banned_by` FOREIGN KEY (`banned_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);

PREPARE stmt FROM @fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
