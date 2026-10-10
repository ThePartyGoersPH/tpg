-- ==========================================================
-- Remove the customer-approval workflow (registration is auto-approved)
-- Date: 2026-10-14
-- Notes:
--   - Step 1: every row is set to approval_status='approved' so nobody is
--     left pending/rejected by the retired flow. is_active / status are NOT
--     touched here: legitimate bans and deactivations must stay in force.
--   - Step 2: the approval columns + index are dropped. All application code
--     referencing them was removed in the same change, so nothing reads or
--     writes these columns after this migration.
--   - Idempotent; safe to re-run. Older migration 20261010 created these
--     columns and stays in history untouched.
-- ==========================================================

-- Guarded: on a re-run the column is already gone, and an unguarded UPDATE
-- would fail the whole migration batch.
SET @ux := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_status');
SET @usql := IF(@ux > 0, 'UPDATE users SET approval_status = ''approved'' WHERE approval_status <> ''approved''', 'SELECT 1');
PREPARE stux FROM @usql;
EXECUTE stux;
DEALLOCATE PREPARE stux;

SET @dx1 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_role_approval');
SET @dsx1 := IF(@dx1 > 0, 'DROP INDEX idx_users_role_approval ON users', 'SELECT 1');
PREPARE stdx1 FROM @dsx1;
EXECUTE stdx1;
DEALLOCATE PREPARE stdx1;

SET @cx1 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_rejection_reason');
SET @sx1 := IF(@cx1 > 0, 'ALTER TABLE users DROP COLUMN approval_rejection_reason', 'SELECT 1');
PREPARE stx1 FROM @sx1;
EXECUTE stx1;
DEALLOCATE PREPARE stx1;

SET @cx2 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_reviewed_at');
SET @sx2 := IF(@cx2 > 0, 'ALTER TABLE users DROP COLUMN approval_reviewed_at', 'SELECT 1');
PREPARE stx2 FROM @sx2;
EXECUTE stx2;
DEALLOCATE PREPARE stx2;

SET @cx3 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_reviewed_by');
SET @sx3 := IF(@cx3 > 0, 'ALTER TABLE users DROP COLUMN approval_reviewed_by', 'SELECT 1');
PREPARE stx3 FROM @sx3;
EXECUTE stx3;
DEALLOCATE PREPARE stx3;

SET @cx4 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_status');
SET @sx4 := IF(@cx4 > 0, 'ALTER TABLE users DROP COLUMN approval_status', 'SELECT 1');
PREPARE stx4 FROM @sx4;
EXECUTE stx4;
DEALLOCATE PREPARE stx4;