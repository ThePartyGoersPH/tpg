-- ============================================================================
-- PAYMENT CONFIGURATION MIGRATION
-- Date: 2026-03-09
-- ============================================================================
-- This migration adds payment configuration fields for online reservation payments

-- ─── 1. Add payment configuration fields to bars table ────────────────────────

ALTER TABLE bars 
ADD COLUMN accept_cash_payment TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Accept cash payments for reservations',
ADD COLUMN accept_online_payment TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Accept online payments for reservations',
ADD COLUMN accept_gcash TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Accept GCash payments',
ADD COLUMN minimum_reservation_deposit DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Minimum deposit required for reservations';

-- ─── 2. Add payment fields to reservations table ───────────────────────────────

ALTER TABLE reservations 
ADD COLUMN payment_status ENUM('pending', 'paid', 'refunded', 'failed') NULL DEFAULT NULL COMMENT 'Payment status for reservation',
ADD COLUMN payment_method ENUM('cash', 'gcash', 'other') NULL DEFAULT NULL COMMENT 'Payment method used',
ADD COLUMN deposit_amount DECIMAL(10,2) NULL DEFAULT NULL COMMENT 'Deposit amount paid',
ADD COLUMN payment_reference VARCHAR(255) NULL DEFAULT NULL COMMENT 'Payment reference/transaction ID',
ADD COLUMN paid_at TIMESTAMP NULL DEFAULT NULL COMMENT 'When payment was completed';

-- ─── 3. Add indexes for performance ─────────────────────────────────────────────

CREATE INDEX idx_reservations_payment_status ON reservations(payment_status);
CREATE INDEX idx_reservations_payment_method ON reservations(payment_method);
CREATE INDEX idx_reservations_bar_payment ON reservations(bar_id, payment_status);

-- ─── 4. Update existing bars with default payment settings ───────────────────────

UPDATE bars SET 
    accept_cash_payment = 1,
    accept_online_payment = 0,
    accept_gcash = 0,
    minimum_reservation_deposit = 0.00
WHERE accept_cash_payment IS NULL OR accept_online_payment IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check bars table structure:
-- DESCRIBE bars;

-- Check reservations table structure:
-- DESCRIBE reservations;

-- Verify default values:
-- SELECT id, name, accept_cash_payment, accept_online_payment, accept_gcash, minimum_reservation_deposit 
-- FROM bars LIMIT 5;

-- ============================================================================
-- SUMMARY OF CHANGES:
-- ============================================================================
-- 1. bars table: Added 4 payment configuration columns
--    - accept_cash_payment (default: 1)
--    - accept_online_payment (default: 0) 
--    - accept_gcash (default: 0)
--    - minimum_reservation_deposit (default: 0.00)
--
-- 2. reservations table: Added 5 payment tracking columns
--    - payment_status (pending/paid/refunded/failed)
--    - payment_method (cash/gcash/other)
--    - deposit_amount
--    - payment_reference
--    - paid_at
--
-- 3. Added performance indexes for payment-related queries
--
-- 4. Set sensible defaults for existing bars
-- ============================================================================
