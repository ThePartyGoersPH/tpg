-- ==========================================================
-- Platform Bar System: Event Archive (No Hard Delete)
-- Date: 2026-03-13
-- Notes:
--   - Additive migration only
--   - Keeps existing /owner/bar/events endpoint contract
--   - Enables archive-based delete flow for events
-- ==========================================================

-- 1) Add archived marker column to active events table
SET @has_archived_at := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bar_events'
    AND COLUMN_NAME = 'archived_at'
);

SET @sql_add_archived_at := IF(
  @has_archived_at = 0,
  'ALTER TABLE bar_events ADD COLUMN archived_at DATETIME NULL AFTER updated_at',
  'SELECT 1'
);
PREPARE stmt_add_archived_at FROM @sql_add_archived_at;
EXECUTE stmt_add_archived_at;
DEALLOCATE PREPARE stmt_add_archived_at;

SET @has_idx_bar_archived := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bar_events'
    AND INDEX_NAME = 'idx_bar_events_bar_archived'
);

SET @sql_idx_bar_archived := IF(
  @has_idx_bar_archived = 0,
  'CREATE INDEX idx_bar_events_bar_archived ON bar_events (bar_id, archived_at)',
  'SELECT 1'
);
PREPARE stmt_idx_bar_archived FROM @sql_idx_bar_archived;
EXECUTE stmt_idx_bar_archived;
DEALLOCATE PREPARE stmt_idx_bar_archived;

SET @has_idx_archived_at := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bar_events'
    AND INDEX_NAME = 'idx_bar_events_archived_at'
);

SET @sql_idx_archived_at := IF(
  @has_idx_archived_at = 0,
  'CREATE INDEX idx_bar_events_archived_at ON bar_events (archived_at)',
  'SELECT 1'
);
PREPARE stmt_idx_archived_at FROM @sql_idx_archived_at;
EXECUTE stmt_idx_archived_at;
DEALLOCATE PREPARE stmt_idx_archived_at;

-- 2) Archive snapshot table
CREATE TABLE IF NOT EXISTS bar_events_archive (
  id INT AUTO_INCREMENT PRIMARY KEY,
  original_event_id INT NOT NULL,
  bar_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  event_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  entry_price DECIMAL(10,2) NULL,
  max_capacity INT NULL,
  current_bookings INT NULL,
  status ENUM('active','cancelled','completed') DEFAULT 'cancelled',
  image_url VARCHAR(500) NULL,
  image_path VARCHAR(500) NULL,
  original_created_at DATETIME NULL,
  original_updated_at DATETIME NULL,
  archived_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_by_user_id INT NULL,
  KEY idx_bar_events_archive_bar_archived (bar_id, archived_at),
  KEY idx_bar_events_archive_original_event (original_event_id),
  KEY idx_bar_events_archive_archived_by (archived_by_user_id),
  CONSTRAINT fk_bar_events_archive_bar
    FOREIGN KEY (bar_id) REFERENCES bars(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_bar_events_archive_user
    FOREIGN KEY (archived_by_user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
