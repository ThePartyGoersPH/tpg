-- ==========================================================
-- Migration: customer approval index (local parity with live)
-- Idempotent: safe to run multiple times on MariaDB 10.4.
-- ==========================================================

SET @cx := (SELECT COUNT(*) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND INDEX_NAME = 'idx_users_role_approval');
SET @sx := IF(@cx = 0,
  'CREATE INDEX idx_users_role_approval ON users (role, approval_status)',
  'SELECT 1');
PREPARE stx FROM @sx;
EXECUTE stx;
DEALLOCATE PREPARE stx;
