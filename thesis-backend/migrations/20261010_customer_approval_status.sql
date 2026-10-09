-- ==========================================================
-- Customer approval workflow (super admin reviews new sign-ups)
-- Date: 2026-10-10
-- Notes:
--   - Additive + idempotent; safe to re-run.
--   - DEFAULT 'approved' backfills every existing row, so no current
--     user (customer, staff, owner, admin) is ever locked out by this.
--   - New customer sign-ups must set approval_status='pending'
--     EXPLICITLY in the registration code (register + Google sign-up);
--     the column default is only a backfill safety net, never the flow.
--   - Staff/owner/admin rows are untouched by application logic, which
--     only ever reads/writes approval_status for role='customer'.
-- ==========================================================

SET @cx1 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_status');
SET @sx1 := IF(@cx1 = 0, 'ALTER TABLE users ADD COLUMN approval_status ENUM(''pending'',''approved'',''rejected'') NOT NULL DEFAULT ''approved''', 'SELECT 1');
PREPARE stx1 FROM @sx1;
EXECUTE stx1;
DEALLOCATE PREPARE stx1;

SET @cx2 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_reviewed_by');
SET @sx2 := IF(@cx2 = 0, 'ALTER TABLE users ADD COLUMN approval_reviewed_by INT NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx2 FROM @sx2;
EXECUTE stx2;
DEALLOCATE PREPARE stx2;

SET @cx3 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_reviewed_at');
SET @sx3 := IF(@cx3 = 0, 'ALTER TABLE users ADD COLUMN approval_reviewed_at DATETIME NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx3 FROM @sx3;
EXECUTE stx3;
DEALLOCATE PREPARE stx3;

SET @cx4 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'approval_rejection_reason');
SET @sx4 := IF(@cx4 = 0, 'ALTER TABLE users ADD COLUMN approval_rejection_reason VARCHAR(500) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx4 FROM @sx4;
EXECUTE stx4;
DEALLOCATE PREPARE stx4;

SET @cx5 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_role_approval');
SET @sx5 := IF(@cx5 = 0, 'CREATE INDEX idx_users_role_approval ON users (role, approval_status)', 'SELECT 1');
PREPARE stx5 FROM @sx5;
EXECUTE stx5;
DEALLOCATE PREPARE stx5;
