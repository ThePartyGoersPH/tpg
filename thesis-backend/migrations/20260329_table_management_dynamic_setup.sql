-- Migration: Dynamic table setup fields + soft delete for bar tables

ALTER TABLE `bar_tables`
  ADD COLUMN IF NOT EXISTS `floor_assignment` VARCHAR(50) DEFAULT NULL AFTER `table_number`,
  ADD COLUMN IF NOT EXISTS `table_size` ENUM('Small','Medium','Large') DEFAULT NULL AFTER `capacity`,
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME DEFAULT NULL AFTER `created_at`;

ALTER TABLE `bar_tables`
  ADD INDEX IF NOT EXISTS `idx_bar_tables_deleted_at` (`deleted_at`);
