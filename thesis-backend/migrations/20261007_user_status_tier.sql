-- 3-tier staff account status: active | archived | fully_deactivated.
-- `is_active` is kept in sync (1 for active, 0 otherwise) so legacy checks
-- keep working;
`status` is the source of truth for the Staff Management tiers.
-- Run: node -e "mysql2 script" (no npm run migrate in this repo).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status ENUM('active','archived','fully_deactivated') NOT NULL DEFAULT 'active';
-- Backfill from the legacy flag: anything currently inactive becomes archived.
UPDATE users SET status = 'archived' WHERE is_active = 0 AND status = 'active';
SET @cx3003 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_bar_status');
SET @sx3003 := IF(@cx3003 = 0, 'CREATE INDEX idx_users_bar_status ON users (bar_id, status)', 'SELECT 1');
PREPARE stx3003 FROM @sx3003;
EXECUTE stx3003;
DEALLOCATE PREPARE stx3003;
