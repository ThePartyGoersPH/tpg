-- ==========================================================
-- Super-admin customer approval also marks the account verified
-- Date: 2026-10-11
-- Notes:
--   - Additive + idempotent; safe to re-run.
--   - No backfill: users.email_verified_at stays NULL until an account is
--     actually verified, so the column is an honest audit timestamp rather
--     than a copy of created_at.
--   - users had a verification FLAG (is_verified) but no verification
--     TIMESTAMP, unlike business_registrations.email_verified_at. This
--     migration adds the timestamp so approving a customer can record
--     when verification happened.
--   - Written by superAdmin.js applyCustomerDecision() on approval.
-- ==========================================================

SET @cx1 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verified_at');
SET @sx1 := IF(@cx1 = 0, 'ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL DEFAULT NULL AFTER is_verified', 'SELECT 1');
PREPARE stx1 FROM @sx1;
EXECUTE stx1;
DEALLOCATE PREPARE stx1;