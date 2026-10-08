-- ============================================================================
-- DOWNPAYMENT FEATURE MIGRATION
-- Date: March 30, 2026
-- Purpose: Add downpayment support for reservations
-- ============================================================================

-- 1. Add downpayment settings to bars table
ALTER TABLE `bars`
  ADD COLUMN `downpayment_enabled` TINYINT(1) DEFAULT 0 COMMENT 'Whether downpayment is enabled for this bar',
  ADD COLUMN `downpayment_type` ENUM('percentage', 'fixed') DEFAULT 'percentage' COMMENT 'Type of downpayment: percentage or fixed amount',
  ADD COLUMN `downpayment_value` DECIMAL(10,2) DEFAULT 50.00 COMMENT 'Downpayment value (percentage 0-100 or fixed amount)',
  ADD COLUMN `downpayment_description` TEXT DEFAULT NULL COMMENT 'Optional description/terms for downpayment';

-- 2. Add downpayment tracking to reservations table
ALTER TABLE `reservations`
  ADD COLUMN `payment_option` ENUM('full', 'downpayment') DEFAULT 'full' COMMENT 'Payment option chosen by customer',
  ADD COLUMN `total_price` DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Total reservation price',
  ADD COLUMN `downpayment_amount` DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Downpayment amount if applicable',
  ADD COLUMN `remaining_balance` DECIMAL(10,2) DEFAULT 0.00 COMMENT 'Remaining balance after downpayment',
  ADD COLUMN `balance_paid` TINYINT(1) DEFAULT 0 COMMENT 'Whether remaining balance has been paid',
  ADD COLUMN `balance_paid_at` DATETIME DEFAULT NULL COMMENT 'When remaining balance was paid';

-- 3. Add indexes for performance
CREATE INDEX `idx_bars_downpayment` ON `bars` (`downpayment_enabled`);
CREATE INDEX `idx_reservations_payment_option` ON `reservations` (`payment_option`);
CREATE INDEX `idx_reservations_balance_paid` ON `reservations` (`balance_paid`);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
