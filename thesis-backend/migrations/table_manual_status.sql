-- Add manual status control for bar tables
-- Status options: available, reserved, unavailable

SET @has_manual_status := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bar_tables'
    AND COLUMN_NAME = 'manual_status'
);

SET @sql := IF(
  @has_manual_status = 0,
  "ALTER TABLE bar_tables ADD COLUMN manual_status ENUM('available','reserved','unavailable') NOT NULL DEFAULT 'available' AFTER is_active",
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Normalize existing rows to available where needed
UPDATE bar_tables
SET manual_status = 'available'
WHERE manual_status IS NULL OR manual_status = '';
