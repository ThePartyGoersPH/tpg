-- ==========================================================
-- Backfill verification for customers approved before the flag existed
-- Date: 2026-10-12
-- Notes:
--   - 20261011 made approval set is_verified, but only for approvals that
--     happen from now on. Accounts approved earlier kept is_verified = 0,
--     so the admin page showed "APPROVED" next to "UNVERIFIED".
--   - Approval is the final gate, so approved customers are verified.
--     This restores that invariant for the existing backlog.
--   - Idempotent: the WHERE clause matches nothing once the backlog is
--     repaired, so re-running is a no-op.
--   - Scoped to role='customer'; staff/owner/admin rows are never touched.
--   - COALESCE keeps an earlier real verification timestamp intact.
--   - Must run after 20261011 (depends on users.email_verified_at).
-- ==========================================================

UPDATE users
   SET is_verified = 1,
       email_verified_at = COALESCE(email_verified_at, NOW()),
       email_verification_token = NULL,
       email_verification_expires = NULL
 WHERE LOWER(COALESCE(role, '')) = 'customer'
   AND approval_status = 'approved'
   AND COALESCE(is_verified, 0) <> 1;