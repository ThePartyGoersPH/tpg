-- Migration: Create payroll_settings table
-- Date: 2026-03-30
-- Purpose: Store configurable payroll rates per bar (PROMPT 5.2)

CREATE TABLE IF NOT EXISTS `payroll_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `sss_rate` DECIMAL(5,2) NOT NULL DEFAULT 4.50 COMMENT 'SSS Contribution Rate (%)',
  `philhealth_rate` DECIMAL(5,2) NOT NULL DEFAULT 3.00 COMMENT 'PhilHealth Contribution Rate (%)',
  `pagibig_rate` DECIMAL(5,2) NOT NULL DEFAULT 2.00 COMMENT 'Pag-IBIG Contribution Rate (%)',
  `withholding_tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Withholding Tax Rate (%)',
  `minimum_wage` DECIMAL(10,2) NOT NULL DEFAULT 610.00 COMMENT 'Minimum Wage (₱ per day)',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_bar_id` (`bar_id`),
  CONSTRAINT `fk_payroll_settings_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Configurable payroll rates per bar';

-- Create index for faster lookups
CREATE INDEX `idx_payroll_settings_bar` ON `payroll_settings` (`bar_id`);
