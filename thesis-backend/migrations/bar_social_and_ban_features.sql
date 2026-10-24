-- ==========================================================
-- Platform Bar System: bans + event social interactions
-- Date: 2026-03-13
-- Notes:
--   - Backward compatible (no destructive changes)
--   - Keeps existing bar_followers table in place
-- ==========================================================

-- 1) Customer bans per bar
CREATE TABLE IF NOT EXISTS customer_bar_bans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bar_id INT NOT NULL,
  customer_id INT NOT NULL,
  banned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_customer_bar_bans_bar_customer (bar_id, customer_id),
  KEY idx_customer_bar_bans_customer (customer_id),
  CONSTRAINT fk_customer_bar_bans_bar
    FOREIGN KEY (bar_id) REFERENCES bars(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_customer_bar_bans_customer
    FOREIGN KEY (customer_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2) Event likes
CREATE TABLE IF NOT EXISTS event_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  liked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_event_likes_event_user (event_id, user_id),
  KEY idx_event_likes_user (user_id),
  CONSTRAINT fk_event_likes_event
    FOREIGN KEY (event_id) REFERENCES bar_events(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_event_likes_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3) Event comments
CREATE TABLE IF NOT EXISTS event_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  status ENUM('active','deleted') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_event_comments_event_status (event_id, status),
  KEY idx_event_comments_user (user_id),
  CONSTRAINT fk_event_comments_event
    FOREIGN KEY (event_id) REFERENCES bar_events(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_event_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
