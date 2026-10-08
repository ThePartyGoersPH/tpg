-- Migration: Support multiple tables per reservation
-- This allows customers to reserve multiple tables for larger parties

-- Create junction table for reservation-table relationships
CREATE TABLE IF NOT EXISTS `reservation_tables` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `reservation_id` INT NOT NULL,
  `table_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`table_id`) REFERENCES `bar_tables`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_reservation_table` (`reservation_id`, `table_id`),
  INDEX `idx_reservation_tables_reservation` (`reservation_id`),
  INDEX `idx_reservation_tables_table` (`table_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing single-table reservations to junction table
INSERT INTO `reservation_tables` (`reservation_id`, `table_id`)
SELECT `id`, `table_id` 
FROM `reservations` 
WHERE `table_id` IS NOT NULL
ON DUPLICATE KEY UPDATE `table_id` = VALUES(`table_id`);

-- Note: We keep the table_id column in reservations for backward compatibility
-- but new multi-table reservations will use the reservation_tables junction table
