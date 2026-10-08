-- ==========================================================
-- Event comments: allow 'flagged' status for moderation queue
-- Date: 2026-10-07
-- Notes:
--   - Additive only: extends the status enum, no data rewritten
--   - The Super Admin "flag" action (PATCH .../social/event-comments/:id
--     with { status: 'flagged' }) previously 500'd with
--     WARN_DATA_TRUNCATED because the enum only allowed
--     ('active','deleted')
-- ==========================================================

ALTER TABLE event_comments
  MODIFY COLUMN status ENUM('active','flagged','deleted') NOT NULL DEFAULT 'active';
