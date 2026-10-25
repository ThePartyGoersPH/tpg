-- Migration: Create package_tables join table
-- Date: 2026-10-06
-- Purpose: Allow Table Required packages to be assigned specific bar tables
-- (e.g. VIP Pegasus Night Package -> VIP Table 1), so the customer booking
-- flow can auto-bind the assigned table instead of forcing a manual pick.

CREATE TABLE IF NOT EXISTS `package_tables` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `package_id` int(11) NOT NULL,
  `table_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_package_table` (`package_id`, `table_id`),
  KEY `idx_package_tables_package` (`package_id`),
  KEY `idx_package_tables_table` (`table_id`),
  CONSTRAINT `fk_package_tables_package` FOREIGN KEY (`package_id`) REFERENCES `bar_packages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_package_tables_table` FOREIGN KEY (`table_id`) REFERENCES `bar_tables` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
