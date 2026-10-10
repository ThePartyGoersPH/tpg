-- ==========================================================
-- Hashed email-verification codes (10-minute OTP)
-- Date: 2026-10-14
-- Notes:
--   - Additive + idempotent; safe to re-run.
--   - email_verification_otp widens from VARCHAR(6) to VARCHAR(64) so it can
--     hold a SHA-256 hex digest instead of the plaintext code. Only the hash
--     is ever stored; the plaintext code exists transiently in the request
--     that mints it (emailed / console-logged once) and is never persisted.
--   - email_otp_attempts caps wrong guesses at 5 per code; minting a fresh
--     code resets it. email_otp_expires is now a 10-minute window.
--   - Any legacy plaintext 6-digit values already in the column can never
--     match a 64-char hex digest comparison, so they are inert. They are left
--     in place and expire naturally; no backfill needed or wanted.
-- ==========================================================

SET @cx1 := (SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_verification_otp');
SET @sx1 := IF(@cx1 IS NOT NULL AND @cx1 < 64, 'ALTER TABLE users MODIFY COLUMN email_verification_otp VARCHAR(64) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx1 FROM @sx1;
EXECUTE stx1;
DEALLOCATE PREPARE stx1;

SET @cx2 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_otp_attempts');
SET @sx2 := IF(@cx2 = 0, 'ALTER TABLE users ADD COLUMN email_otp_attempts INT NOT NULL DEFAULT 0 AFTER email_otp_expires', 'SELECT 1');
PREPARE stx2 FROM @sx2;
EXECUTE stx2;
DEALLOCATE PREPARE stx2;