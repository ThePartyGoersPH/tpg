-- ==========================================================================
-- Migration: New Features (Report Comments, Event Reservations, Entrance Fee, Reply Notifications)
-- Date: 2026-03-24
-- ==========================================================================

-- ──────────────────────────────────────────────
-- FEATURE 1: Comment Reports
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comment_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  comment_id INT NOT NULL,
  comment_type ENUM('post_comment','event_comment','post_reply','event_reply') NOT NULL DEFAULT 'post_comment',
  reporter_id INT NOT NULL,
  reason VARCHAR(100) NOT NULL,
  details TEXT,
  status ENUM('pending', 'reviewed', 'dismissed') DEFAULT 'pending',
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY one_report_per_user (comment_id, comment_type, reporter_id),
  INDEX idx_comment_reports_status (status),
  INDEX idx_comment_reports_comment (comment_id, comment_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────
-- FEATURE 2: Reservation linked to Event (event_id on reservations)
-- Only add if not already present
-- ──────────────────────────────────────────────
SET @has_event_id := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reservations'
    AND COLUMN_NAME = 'event_id'
);

SET @sql_add_event_id := IF(
  @has_event_id = 0,
  'ALTER TABLE reservations ADD COLUMN event_id INT DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt_event_id FROM @sql_add_event_id;
EXECUTE stmt_event_id;
DEALLOCATE PREPARE stmt_event_id;

-- ──────────────────────────────────────────────
-- FEATURE 3: Entrance Fee on Events
-- bar_events already has entry_price column — reuse it
-- (no schema change needed)
-- ──────────────────────────────────────────────

-- ──────────────────────────────────────────────
-- FEATURE 4: Notifications table already exists
-- (created in missing_features_migration.sql)
-- No schema change needed — just ensure endpoints work
-- ──────────────────────────────────────────────
