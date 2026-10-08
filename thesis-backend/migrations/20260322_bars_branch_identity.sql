-- Migration: Add branch identity columns to bars table
-- is_branch = 0 means main bar, 1 means branch
-- parent_bar_id = NULL means main bar, otherwise FK to the main bar's id

-- Check and add is_branch column if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'bars' 
                   AND COLUMN_NAME = 'is_branch');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `bars` ADD COLUMN `is_branch` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''0=main bar, 1=branch'' AFTER `payout_enabled`',
  'SELECT ''Column is_branch already exists'' AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add parent_bar_id column if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE() 
                   AND TABLE_NAME = 'bars' 
                   AND COLUMN_NAME = 'parent_bar_id');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `bars` ADD COLUMN `parent_bar_id` INT DEFAULT NULL COMMENT ''FK to bars.id of the main bar (NULL=main bar)'' AFTER `is_branch`',
  'SELECT ''Column parent_bar_id already exists'' AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check and add index if it doesn't exist
SET @index_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                     WHERE TABLE_SCHEMA = DATABASE() 
                     AND TABLE_NAME = 'bars' 
                     AND INDEX_NAME = 'idx_bars_parent_bar_id');

SET @sql = IF(@index_exists = 0,
  'ALTER TABLE `bars` ADD KEY `idx_bars_parent_bar_id` (`parent_bar_id`)',
  'SELECT ''Index idx_bars_parent_bar_id already exists'' AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: mark existing branches that were created via /branches/create
-- (owner_id that also owns another bar where that bar was created first)
-- This is a best-effort backfill; manual review recommended.
