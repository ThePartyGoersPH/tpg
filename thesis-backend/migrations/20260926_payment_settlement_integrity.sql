-- ============================================================
-- Migration: Payment settlement integrity
-- Description: Records which settlement rail a payment used so payouts
--              are only created for money the platform actually holds,
--              plus a uniqueness guarantee against duplicate payouts.
-- Date: 2026-09-26
-- Idempotent: safe to re-run.
-- ============================================================

-- 1. settlement rail columns on payment_transactions
SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_transactions'
    AND COLUMN_NAME = 'settled_directly'
);

SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE `payment_transactions` ADD COLUMN `settled_directly` tinyint(1) NOT NULL DEFAULT 0 AFTER `payment_provider`',
  'SELECT 1'
);

PREPARE stmt FROM @col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_transactions'
    AND COLUMN_NAME = 'settlement_rail'
);

SET @col_sql := IF(
  @col_exists = 0,
  'ALTER TABLE `payment_transactions` ADD COLUMN `settlement_rail` varchar(30) DEFAULT ''platform_collect'' AFTER `settled_directly`',
  'SELECT 1'
);

PREPARE stmt FROM @col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Backfill: payments that already settled straight to the bar owner must
--    never get a payout row. Detected from the metadata snapshot written at
--    payment creation (Stripe destination charge, owner live keys, split).
UPDATE payment_transactions
SET settled_directly = 1,
    settlement_rail = CASE
      WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.provider')) = 'stripe' THEN 'stripe_connect'
      WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.live_path')) = 'owner_keys_direct' THEN 'owner_keys_direct'
      WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.live_path')) = 'child_split' THEN 'child_split'
      ELSE 'stripe_connect'
    END
WHERE status = 'paid'
  AND (payment_provider = 'stripe'
       OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.stripe_split')) IS NOT NULL
       OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.live_path')) IN ('owner_keys_direct', 'child_split'));

-- 3. Drop payout rows that belong to direct-settled payments: those funds were
--    never held by the platform, so paying them out would double-pay the bar.
DELETE p
FROM payouts p
JOIN payment_transactions pt ON pt.id = p.payment_transaction_id
WHERE pt.settled_directly = 1
  AND p.status IN ('pending', 'processing');

-- 4. One payout per payment transaction, enforced by the database.
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payouts'
    AND INDEX_NAME = 'uq_payouts_payment_transaction_id'
);

SET @idx_sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `payouts` ADD UNIQUE INDEX `uq_payouts_payment_transaction_id` (`payment_transaction_id`)',
  'SELECT 1'
);

PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
