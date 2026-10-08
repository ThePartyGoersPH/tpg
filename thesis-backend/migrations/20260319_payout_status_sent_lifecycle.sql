-- ==========================================================================
-- Payout status lifecycle alignment: pending -> sent -> completed
-- Date: 2026-03-19
-- Non-destructive migration
-- ==========================================================================

-- Add 'sent' status while keeping existing statuses for backward compatibility
ALTER TABLE payouts
  MODIFY COLUMN status ENUM('pending','processing','sent','completed','failed','cancelled')
  NOT NULL DEFAULT 'pending';

-- Add bar_owner_id column to link payouts to bar owners
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS bar_owner_id INT NULL AFTER bar_id,
  ADD INDEX IF NOT EXISTS idx_payouts_bar_owner (bar_owner_id);

-- Add FK only if missing
SET @fk_exists_payout_owner := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'payouts'
    AND CONSTRAINT_NAME = 'fk_payouts_bar_owner'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_fk_payout_owner := IF(
  @fk_exists_payout_owner = 0,
  'ALTER TABLE payouts ADD CONSTRAINT fk_payouts_bar_owner FOREIGN KEY (bar_owner_id) REFERENCES bar_owners(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk_payout_owner FROM @sql_fk_payout_owner;
EXECUTE stmt_fk_payout_owner;
DEALLOCATE PREPARE stmt_fk_payout_owner;

-- Optional normalization: convert legacy 'processing' into 'sent' for clearer lifecycle
UPDATE payouts
SET status = 'sent'
WHERE status = 'processing';
