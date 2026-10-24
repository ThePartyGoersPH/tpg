-- ============================================================
-- Migration: 3-day compliance grace period + auto-hide status
-- Description:
--   * grace_period_start  — when the owner's (re)submission opened a window
--   * temp_visible_until  — grace_period_start + 3 days; while in the future
--                           the bar is temporarily visible to customers even
--                           though compliance_status is not 'approved' yet
--   * compliance_status   — new value 'hidden_incomplete' used by the auto-hide
--                           job when the window lapses without approval
-- Date: 2026-10-04
-- Idempotent: safe to re-run (column probes + enum type probe).
-- ============================================================

SET @col_start := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'grace_period_start'
);

SET @sql := IF(
  @col_start = 0,
  'ALTER TABLE `bars` ADD COLUMN `grace_period_start` DATETIME DEFAULT NULL AFTER `compliance_reviewed_at`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_until := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'temp_visible_until'
);

SET @sql := IF(
  @col_until = 0,
  'ALTER TABLE `bars` ADD COLUMN `temp_visible_until` DATETIME DEFAULT NULL AFTER `grace_period_start`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Extend the status enum with 'hidden_incomplete' (existing values preserved).
SET @has_hidden := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'compliance_status'
    AND COLUMN_TYPE LIKE '%hidden_incomplete%'
);

SET @sql := IF(
  @has_hidden = 0,
  'ALTER TABLE `bars` MODIFY COLUMN `compliance_status` ENUM(''incomplete'',''pending_review'',''approved'',''rejected'',''hidden_incomplete'') NOT NULL DEFAULT ''incomplete''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
