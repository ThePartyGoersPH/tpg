-- Migration: Tax snapshot on reservations
-- Date: 2026-10-06
-- Purpose: Store the VAT calculation applied at checkout (rate, mode,
-- amount, net subtotal) so digital receipts and admin logs show the exact
-- tax breakdown even if the bar later changes its tax configuration.
ALTER TABLE `reservations`
  ADD COLUMN IF NOT EXISTS `tax_rate` decimal(5,2) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `tax_mode` varchar(20) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `tax_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `net_subtotal` decimal(10,2) NULL DEFAULT NULL;
