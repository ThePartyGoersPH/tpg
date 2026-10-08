-- Media engagement: likes and comments on bar photos/trailers
-- Run this migration to enable social interaction on the Vibe Check gallery

CREATE TABLE IF NOT EXISTS media_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  media_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_media_like (media_id, user_id),
  KEY idx_media_likes_media (media_id),
  KEY idx_media_likes_user (user_id),
  CONSTRAINT fk_medialikes_media FOREIGN KEY (media_id) REFERENCES bar_videos(id) ON DELETE CASCADE,
  CONSTRAINT fk_medialikes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS media_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  media_id INT NOT NULL,
  user_id INT NOT NULL,
  parent_comment_id INT DEFAULT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_media_comments_media (media_id),
  KEY idx_media_comments_user (user_id),
  KEY idx_media_comments_parent (parent_comment_id),
  CONSTRAINT fk_mediacomment_media FOREIGN KEY (media_id) REFERENCES bar_videos(id) ON DELETE CASCADE,
  CONSTRAINT fk_mediacomment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_mediacomment_parent FOREIGN KEY (parent_comment_id) REFERENCES media_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
