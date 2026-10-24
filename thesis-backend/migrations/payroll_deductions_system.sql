-- ============================================================================
-- PAYROLL DEDUCTIONS SYSTEM MIGRATION
-- ============================================================================
-- This migration adds optional deductions support to the payroll system.
-- Deductions include: BIR (withholding tax), SSS, PhilHealth, and Late deductions.
-- All deductions are optional and toggleable per employee or per payroll run.
--
-- SAFE MIGRATION: Uses IF NOT EXISTS and checks before altering tables
-- ============================================================================

-- ============================================================================
-- 1. CREATE PAYROLL DEDUCTION ITEMS TABLE
-- ============================================================================
-- This table stores itemized deductions for each payroll item
CREATE TABLE IF NOT EXISTS `payroll_deduction_items` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `payroll_item_id` INT(11) NOT NULL COMMENT 'FK to payroll_items',
  `deduction_type` ENUM('bir', 'sss', 'philhealth', 'late', 'other') NOT NULL,
  `deduction_label` VARCHAR(100) NOT NULL COMMENT 'Display label for the deduction',
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `is_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Whether this deduction is applied',
  `computation_basis` TEXT DEFAULT NULL COMMENT 'JSON or text explaining how this was computed',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payroll_item` (`payroll_item_id`),
  KEY `idx_deduction_type` (`deduction_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Itemized deductions for each payroll item';

-- ============================================================================
-- 2. CREATE EMPLOYEE DEDUCTION SETTINGS TABLE
-- ============================================================================
-- This table stores per-employee deduction settings (which deductions to apply)
CREATE TABLE IF NOT EXISTS `employee_deduction_settings` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `user_id` INT(11) NOT NULL COMMENT 'Employee user_id',
  `bir_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Enable BIR withholding tax',
  `bir_exemption_status` VARCHAR(20) DEFAULT 'S' COMMENT 'Tax exemption: S, ME, S1, S2, S3, S4, ME1, ME2, ME3, ME4',
  `sss_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Enable SSS deduction',
  `sss_number` VARCHAR(50) DEFAULT NULL,
  `philhealth_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Enable PhilHealth deduction',
  `philhealth_number` VARCHAR(50) DEFAULT NULL,
  `late_deduction_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Enable late deduction',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_deduction` (`bar_id`, `user_id`),
  KEY `idx_bar_user` (`bar_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Per-employee deduction settings and tax information';

-- ============================================================================
-- 3. ADD COLUMNS TO PAYROLL_ITEMS (IF NOT EXISTS)
-- ============================================================================
-- Add detailed deduction breakdown columns to payroll_items table

-- Check and add bir_deduction column
SET @dbname = DATABASE();
SET @tablename = 'payroll_items';
SET @columnname = 'bir_deduction';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''BIR withholding tax deduction'' AFTER gross_pay')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add sss_deduction column
SET @columnname = 'sss_deduction';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''SSS contribution deduction'' AFTER bir_deduction')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add philhealth_deduction column
SET @columnname = 'philhealth_deduction';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''PhilHealth contribution deduction'' AFTER sss_deduction')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add late_deduction column
SET @columnname = 'late_deduction';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''Late deduction based on tardiness'' AFTER philhealth_deduction')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add other_deductions column
SET @columnname = 'other_deductions';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''Other miscellaneous deductions'' AFTER late_deduction')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add total_deductions column (computed field for clarity)
SET @columnname = 'total_deductions';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''Sum of all deductions'' AFTER other_deductions')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================================
-- 4. ADD LATE TRACKING COLUMNS TO ATTENDANCE_LOGS (IF NOT EXISTS)
-- ============================================================================
-- Add columns to track late minutes for late deduction calculation

SET @tablename = 'attendance_logs';

-- Check and add late_minutes column
SET @columnname = 'late_minutes';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT(11) NOT NULL DEFAULT 0 COMMENT ''Minutes late for this attendance'' AFTER time_out')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check and add expected_time_in column
SET @columnname = 'expected_time_in';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname
     AND TABLE_NAME = @tablename
     AND COLUMN_NAME = @columnname) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' TIME DEFAULT NULL COMMENT ''Expected clock-in time for late calculation'' AFTER late_minutes')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================================================
-- 5. CREATE BIR TAX TABLE (2024 Philippine Tax Brackets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `bir_tax_brackets` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `min_income` DECIMAL(12,2) NOT NULL COMMENT 'Minimum annual taxable income for this bracket',
  `max_income` DECIMAL(12,2) DEFAULT NULL COMMENT 'Maximum annual taxable income (NULL for highest bracket)',
  `base_tax` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Base tax amount',
  `excess_rate` DECIMAL(5,4) NOT NULL DEFAULT 0.0000 COMMENT 'Tax rate on excess (e.g., 0.20 for 20%)',
  `year` INT(4) NOT NULL DEFAULT 2024 COMMENT 'Tax year this bracket applies to',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_year_active` (`year`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='BIR tax brackets for withholding tax calculation';

-- Insert 2024 Philippine tax brackets (if not exists)
INSERT IGNORE INTO `bir_tax_brackets` (`min_income`, `max_income`, `base_tax`, `excess_rate`, `year`, `is_active`) VALUES
(0.00, 250000.00, 0.00, 0.0000, 2024, 1),           -- 0% for up to 250k
(250000.01, 400000.00, 0.00, 0.1500, 2024, 1),      -- 15% on excess over 250k
(400000.01, 800000.00, 22500.00, 0.2000, 2024, 1),  -- 20% on excess over 400k
(800000.01, 2000000.00, 102500.00, 0.2500, 2024, 1),-- 25% on excess over 800k
(2000000.01, 8000000.00, 402500.00, 0.3000, 2024, 1),-- 30% on excess over 2M
(8000000.01, NULL, 2202500.00, 0.3500, 2024, 1);    -- 35% on excess over 8M

-- ============================================================================
-- 6. CREATE SSS CONTRIBUTION TABLE (2024 rates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `sss_contribution_table` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `min_salary` DECIMAL(10,2) NOT NULL COMMENT 'Minimum monthly salary for this bracket',
  `max_salary` DECIMAL(10,2) DEFAULT NULL COMMENT 'Maximum monthly salary (NULL for highest bracket)',
  `employee_share` DECIMAL(10,2) NOT NULL COMMENT 'Employee contribution amount',
  `employer_share` DECIMAL(10,2) NOT NULL COMMENT 'Employer contribution amount',
  `total_contribution` DECIMAL(10,2) NOT NULL COMMENT 'Total SSS contribution',
  `year` INT(4) NOT NULL DEFAULT 2024,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_year_active` (`year`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='SSS contribution table based on monthly salary';

-- Insert sample SSS brackets (2024 - simplified version, adjust as needed)
INSERT IGNORE INTO `sss_contribution_table` (`min_salary`, `max_salary`, `employee_share`, `employer_share`, `total_contribution`, `year`, `is_active`) VALUES
(0.00, 4249.99, 180.00, 380.00, 560.00, 2024, 1),
(4250.00, 4749.99, 202.50, 427.50, 630.00, 2024, 1),
(4750.00, 5249.99, 225.00, 475.00, 700.00, 2024, 1),
(5250.00, 5749.99, 247.50, 522.50, 770.00, 2024, 1),
(5750.00, 6249.99, 270.00, 570.00, 840.00, 2024, 1),
(6250.00, 6749.99, 292.50, 617.50, 910.00, 2024, 1),
(6750.00, 7249.99, 315.00, 665.00, 980.00, 2024, 1),
(7250.00, 7749.99, 337.50, 712.50, 1050.00, 2024, 1),
(7750.00, 8249.99, 360.00, 760.00, 1120.00, 2024, 1),
(8250.00, 8749.99, 382.50, 807.50, 1190.00, 2024, 1),
(8750.00, 9249.99, 405.00, 855.00, 1260.00, 2024, 1),
(9250.00, 9749.99, 427.50, 902.50, 1330.00, 2024, 1),
(9750.00, 10249.99, 450.00, 950.00, 1400.00, 2024, 1),
(10250.00, 10749.99, 472.50, 997.50, 1470.00, 2024, 1),
(10750.00, 11249.99, 495.00, 1045.00, 1540.00, 2024, 1),
(11250.00, 11749.99, 517.50, 1092.50, 1610.00, 2024, 1),
(11750.00, 12249.99, 540.00, 1140.00, 1680.00, 2024, 1),
(12250.00, 12749.99, 562.50, 1187.50, 1750.00, 2024, 1),
(12750.00, 13249.99, 585.00, 1235.00, 1820.00, 2024, 1),
(13250.00, 13749.99, 607.50, 1282.50, 1890.00, 2024, 1),
(13750.00, 14249.99, 630.00, 1330.00, 1960.00, 2024, 1),
(14250.00, 14749.99, 652.50, 1377.50, 2030.00, 2024, 1),
(14750.00, 15249.99, 675.00, 1425.00, 2100.00, 2024, 1),
(15250.00, 15749.99, 697.50, 1472.50, 2170.00, 2024, 1),
(15750.00, 16249.99, 720.00, 1520.00, 2240.00, 2024, 1),
(16250.00, 16749.99, 742.50, 1567.50, 2310.00, 2024, 1),
(16750.00, 17249.99, 765.00, 1615.00, 2380.00, 2024, 1),
(17250.00, 17749.99, 787.50, 1662.50, 2450.00, 2024, 1),
(17750.00, 18249.99, 810.00, 1710.00, 2520.00, 2024, 1),
(18250.00, 18749.99, 832.50, 1757.50, 2590.00, 2024, 1),
(18750.00, 19249.99, 855.00, 1805.00, 2660.00, 2024, 1),
(19250.00, 19749.99, 877.50, 1852.50, 2730.00, 2024, 1),
(19750.00, 29999.99, 900.00, 1900.00, 2800.00, 2024, 1),
(30000.00, NULL, 1125.00, 2375.00, 3500.00, 2024, 1);

-- ============================================================================
-- 7. CREATE PHILHEALTH CONTRIBUTION TABLE (2024 rates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `philhealth_contribution_table` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `min_salary` DECIMAL(10,2) NOT NULL COMMENT 'Minimum monthly basic salary',
  `max_salary` DECIMAL(10,2) DEFAULT NULL COMMENT 'Maximum monthly basic salary',
  `premium_rate` DECIMAL(5,4) NOT NULL COMMENT 'Premium rate (e.g., 0.05 for 5%)',
  `employee_share_rate` DECIMAL(5,4) NOT NULL COMMENT 'Employee share rate (usually 50%)',
  `min_contribution` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `max_contribution` DECIMAL(10,2) DEFAULT NULL,
  `year` INT(4) NOT NULL DEFAULT 2024,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_year_active` (`year`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='PhilHealth contribution rates based on monthly basic salary';

-- Insert 2024 PhilHealth rates (5% premium, employee pays 2.5%)
INSERT IGNORE INTO `philhealth_contribution_table` (`min_salary`, `max_salary`, `premium_rate`, `employee_share_rate`, `min_contribution`, `max_contribution`, `year`, `is_active`) VALUES
(0.00, 10000.00, 0.0500, 0.5000, 500.00, 500.00, 2024, 1),      -- Minimum: 500 (employee: 250)
(10000.01, 100000.00, 0.0500, 0.5000, 0.00, 5000.00, 2024, 1),  -- 5% of basic salary (employee: 2.5%)
(100000.01, NULL, 0.0500, 0.5000, 5000.00, 5000.00, 2024, 1);   -- Maximum: 5000 (employee: 2500)

-- ============================================================================
-- 8. CREATE AUDIT LOG FOR DEDUCTION CHANGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS `payroll_deduction_audit` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `user_id` INT(11) NOT NULL COMMENT 'Employee whose deductions were modified',
  `changed_by` INT(11) NOT NULL COMMENT 'User who made the change',
  `action` VARCHAR(50) NOT NULL COMMENT 'enable, disable, update',
  `deduction_type` VARCHAR(50) DEFAULT NULL,
  `old_value` TEXT DEFAULT NULL,
  `new_value` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_user` (`bar_id`, `user_id`),
  KEY `idx_changed_by` (`changed_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
COMMENT='Audit trail for deduction setting changes';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Summary:
-- ✓ Created payroll_deduction_items table for itemized deductions
-- ✓ Created employee_deduction_settings table for per-employee toggles
-- ✓ Added deduction breakdown columns to payroll_items (safe ALTER)
-- ✓ Added late tracking columns to attendance_logs (safe ALTER)
-- ✓ Created BIR tax brackets table with 2024 rates
-- ✓ Created SSS contribution table with 2024 rates
-- ✓ Created PhilHealth contribution table with 2024 rates
-- ✓ Created audit log for deduction changes
-- ============================================================================
