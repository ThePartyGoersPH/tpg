-- ============================================================
-- Migration: Per-bar PayMongo webhook signing secret
-- Description: Each bar's own PayMongo account signs its webhook
--              deliveries with a per-endpoint secret (whsk_...),
--              which differs from the platform-level secret. Without
--              this column every live-mode bar's webhook events were
--              rejected as "invalid signature" by the shared check.
-- Date: 2026-09-26
-- Idempotent: safe to re-run.
--
-- SECURITY NOTE: this column stores the signing secret in plaintext.
--                The codebase has no encryption-at-rest layer (no
--                createCipheriv/decrypt anywhere), so this matches how
--                bars.paymongo_live_secret_key is already stored. Flagged
--                for follow-up rather than blocking this fix.
-- ============================================================

SET @exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'paymongo_webhook_secret'
);

-- The secret is read on every webhook delivery, so the lookup stays on the
-- bars primary key — no extra index needed.
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `bars` ADD COLUMN `paymongo_webhook_secret` varchar(255) DEFAULT NULL',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
