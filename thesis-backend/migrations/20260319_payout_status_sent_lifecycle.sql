ALTER TABLE payouts MODIFY COLUMN status ENUM('pending','processing','sent','completed','failed','cancelled')
  NOT NULL DEFAULT 'pending';
SET @cx101 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payouts' AND COLUMN_NAME = 'bar_owner_id');
SET @sx101 := IF(@cx101 = 0, 'ALTER TABLE payouts ADD COLUMN bar_owner_id INT NULL AFTER bar_id', 'SELECT 1');
PREPARE stx101 FROM @sx101;
EXECUTE stx101;
DEALLOCATE PREPARE stx101;
SET @cx102 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payouts' AND INDEX_NAME = 'idx_payouts_bar_owner');
SET @sx102 := IF(@cx102 = 0, 'ALTER TABLE payouts ADD INDEX idx_payouts_bar_owner (bar_owner_id)', 'SELECT 1');
PREPARE stx102 FROM @sx102;
EXECUTE stx102;
DEALLOCATE PREPARE stx102;
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
UPDATE payouts
SET status = 'sent'
WHERE status = 'processing';
