-- ============================================================
-- Migration: Payment provider columns
-- Description: The live database has these columns (they were applied
--              out-of-band), but they are missing from sql_dump.txt and every
--              migration, so a fresh deploy crashed with ER_BAD_FIELD_ERROR on
--              the direct-settlement rails. Committed here so the schema is
--              reproducible.
-- Date: 2026-09-26
-- Idempotent: safe to re-run.
-- ============================================================

-- ── bars: PayMongo / Stripe onboarding state ────────────────────────────────
SET @cols := (
  SELECT GROUP_CONCAT(col ORDER BY seq SEPARATOR ', ')
  FROM (
    SELECT 'ADD COLUMN `paymongo_child_merchant_id` varchar(255) DEFAULT NULL' AS col, 1 AS seq
    UNION ALL SELECT 'ADD COLUMN `paymongo_onboarding_status` varchar(50) DEFAULT ''not_started''', 2
    UNION ALL SELECT 'ADD COLUMN `paymongo_onboarding_ref` varchar(255) DEFAULT NULL', 3
    UNION ALL SELECT 'ADD COLUMN `paymongo_onboarding_updated_at` datetime DEFAULT NULL', 4
    UNION ALL SELECT 'ADD COLUMN `paymongo_mode` varchar(20) NOT NULL DEFAULT ''test''', 5
    UNION ALL SELECT 'ADD COLUMN `paymongo_test_connected` tinyint(1) NOT NULL DEFAULT 0', 6
    UNION ALL SELECT 'ADD COLUMN `paymongo_test_connected_at` datetime DEFAULT NULL', 7
    UNION ALL SELECT 'ADD COLUMN `paymongo_live_secret_key` varchar(255) DEFAULT NULL', 8
    UNION ALL SELECT 'ADD COLUMN `paymongo_live_public_key` varchar(255) DEFAULT NULL', 9
    UNION ALL SELECT 'ADD COLUMN `stripe_account_id` varchar(255) DEFAULT NULL', 10
    UNION ALL SELECT 'ADD COLUMN `stripe_onboarding_status` varchar(50) DEFAULT ''incomplete''', 11
    UNION ALL SELECT 'ADD COLUMN `stripe_onboarding_updated_at` datetime DEFAULT NULL', 12
  ) AS candidates
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS c
    WHERE c.TABLE_SCHEMA = DATABASE()
      AND c.TABLE_NAME = 'bars'
      AND c.COLUMN_NAME = SUBSTRING_INDEX(SUBSTRING_INDEX(candidates.col, '`', 2), '`', -1)
  )
);

SET @sql := IF(
  @cols IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `bars` ', @cols)
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── payment_transactions: provider + settlement references ─────────────────
SET @cols := (
  SELECT GROUP_CONCAT(col ORDER BY seq SEPARATOR ', ')
  FROM (
    SELECT 'ADD COLUMN `paymongo_checkout_session_id` varchar(255) DEFAULT NULL' AS col, 1 AS seq
    UNION ALL SELECT 'ADD COLUMN `paymongo_child_merchant_id` varchar(255) DEFAULT NULL', 2
    UNION ALL SELECT 'ADD COLUMN `split_json` text', 3
    UNION ALL SELECT 'ADD COLUMN `stripe_payment_intent_id` varchar(255) DEFAULT NULL', 4
    UNION ALL SELECT 'ADD COLUMN `stripe_transfer_id` varchar(255) DEFAULT NULL', 5
    UNION ALL SELECT 'ADD COLUMN `payment_provider` varchar(30) DEFAULT ''paymongo''', 6
  ) AS candidates
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS c
    WHERE c.TABLE_SCHEMA = DATABASE()
      AND c.TABLE_NAME = 'payment_transactions'
      AND c.COLUMN_NAME = SUBSTRING_INDEX(SUBSTRING_INDEX(candidates.col, '`', 2), '`', -1)
  )
);

SET @sql := IF(
  @cols IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `payment_transactions` ', @cols)
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── indexes for the provider lookups ───────────────────────────────────────
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_transactions'
    AND INDEX_NAME = 'idx_payment_transactions_source'
);

SET @idx_sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `payment_transactions` ADD INDEX `idx_payment_transactions_source` (`paymongo_source_id`)',
  'SELECT 1'
);

PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payment_transactions'
    AND INDEX_NAME = 'idx_payment_transactions_session'
);

SET @idx_sql := IF(
  @idx_exists = 0,
  'ALTER TABLE `payment_transactions` ADD INDEX `idx_payment_transactions_session` (`paymongo_checkout_session_id`)',
  'SELECT 1'
);

PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
