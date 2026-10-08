-- ==========================================================
-- Platform Bar System: Event Comment Replies
-- Date: 2026-03-13
-- Notes:
--   - Additive migration only
--   - Enables owner/staff replies to event comments
-- ==========================================================

CREATE TABLE IF NOT EXISTS event_comment_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_comment_id INT NOT NULL,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  reply TEXT NOT NULL,
  status ENUM('active','deleted') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_event_comment_replies_comment_status (event_comment_id, status),
  KEY idx_event_comment_replies_event_status (event_id, status),
  KEY idx_event_comment_replies_user (user_id),
  CONSTRAINT fk_event_comment_replies_comment
    FOREIGN KEY (event_comment_id) REFERENCES event_comments(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_event_comment_replies_event
    FOREIGN KEY (event_id) REFERENCES bar_events(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_event_comment_replies_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
