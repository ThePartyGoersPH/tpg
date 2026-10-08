-- 3-tier staff account status: active | archived | fully_deactivated.
-- `is_active` is kept in sync (1 for active, 0 otherwise) so legacy checks
-- keep working; `status` is the source of truth for the Staff Management tiers.
-- Run: node -e "mysql2 script" (no npm run migrate in this repo).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status ENUM('active','archived','fully_deactivated') NOT NULL DEFAULT 'active';

-- Backfill from the legacy flag: anything currently inactive becomes archived.
UPDATE users SET status = 'archived' WHERE is_active = 0 AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_users_bar_status ON users (bar_id, status);
