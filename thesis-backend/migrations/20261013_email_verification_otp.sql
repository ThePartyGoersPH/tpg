-- ==========================================================
-- Email verification OTP (6-digit code alongside the emailed link)
-- Date: 2026-10-13
-- Notes:
--   - Additive + idempotent; safe to re-run.
--   - No backfill: codes are only minted when a customer asks for
--     verification, so both columns start NULL for existing users.
--   - Written by routes/auth.js issueEmailVerification(); cleared by
--     markCustomerVerified() once the account flips to verified.
--   - Kept separate from email_verification_token so the link flow and the
--     OTP flow can expire and be revoked independently of each other.
-- ==========================================================

SET @cx1 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verification_otp');
SET @sx1 := IF(@cx1 = 0, 'ALTER TABLE users ADD COLUMN email_verification_otp VARCHAR(6) NULL DEFAULT NULL AFTER email_verification_token', 'SELECT 1');
PREPARE stx1 FROM @sx1;
EXECUTE stx1;
DEALLOCATE PREPARE stx1;

SET @cx2 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_otp_expires');
SET @sx2 := IF(@cx2 = 0, 'ALTER TABLE users ADD COLUMN email_otp_expires DATETIME NULL DEFAULT NULL AFTER email_verification_expires', 'SELECT 1');
PREPARE stx2 FROM @sx2;
EXECUTE stx2;
DEALLOCATE PREPARE stx2;