SET @bars_staff_types_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'staff_types'
);

SET @bars_staff_types_sql := IF(
  @bars_staff_types_exists = 0,
  'ALTER TABLE `bars` ADD COLUMN `staff_types` JSON DEFAULT NULL',
  'SELECT 1'
);

PREPARE bars_staff_types_stmt FROM @bars_staff_types_sql;
EXECUTE bars_staff_types_stmt;
DEALLOCATE PREPARE bars_staff_types_stmt;

SET @users_staff_type_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'staff_type'
);

SET @users_staff_type_sql := IF(
  @users_staff_type_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `staff_type` VARCHAR(100) DEFAULT NULL AFTER `role`',
  'SELECT 1'
);

PREPARE users_staff_type_stmt FROM @users_staff_type_sql;
EXECUTE users_staff_type_stmt;
DEALLOCATE PREPARE users_staff_type_stmt;
