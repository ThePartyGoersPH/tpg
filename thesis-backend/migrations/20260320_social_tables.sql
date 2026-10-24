-- ==========================================================================
-- Social Feed Tables Migration
-- Date: 2026-03-20
-- Features: Bar posts, likes, comments for unified social feed
-- ==========================================================================

-- Bar posts table (for bar owners to create posts)
CREATE TABLE IF NOT EXISTS bar_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bar_id INT NOT NULL,
  user_id INT NULL,
  content TEXT NOT NULL,
  image_path VARCHAR(255) DEFAULT NULL,
  status ENUM('active', 'deleted', 'hidden') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bar_id) REFERENCES bars(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_bar_posts_bar (bar_id),
  INDEX idx_bar_posts_status (status),
  INDEX idx_bar_posts_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bar post likes table
CREATE TABLE IF NOT EXISTS bar_post_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES bar_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_post_like (post_id, user_id),
  INDEX idx_post_likes_post (post_id),
  INDEX idx_post_likes_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bar post comments table
CREATE TABLE IF NOT EXISTS bar_post_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  parent_comment_id INT DEFAULT NULL,
  status ENUM('active', 'deleted', 'hidden') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES bar_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_comment_id) REFERENCES bar_post_comments(id) ON DELETE CASCADE,
  INDEX idx_post_comments_post (post_id),
  INDEX idx_post_comments_user (user_id),
  INDEX idx_post_comments_parent (parent_comment_id),
  INDEX idx_post_comments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bar comment reactions table (for emoji reactions on comments)
CREATE TABLE IF NOT EXISTS bar_comment_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comment_id INT NOT NULL,
  user_id INT NOT NULL,
  reaction VARCHAR(20) NOT NULL DEFAULT 'like',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES bar_post_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_comment_reaction (comment_id, user_id, reaction),
  INDEX idx_comment_reactions_comment (comment_id),
  INDEX idx_comment_reactions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bar comment replies table
CREATE TABLE IF NOT EXISTS bar_comment_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  comment_id INT NOT NULL,
  user_id INT NOT NULL,
  reply TEXT NOT NULL,
  parent_reply_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES bar_post_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_reply_id) REFERENCES bar_comment_replies(id) ON DELETE CASCADE,
  INDEX idx_comment_replies_comment (comment_id),
  INDEX idx_comment_replies_user (user_id),
  INDEX idx_comment_replies_parent (parent_reply_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bar reply reactions table
CREATE TABLE IF NOT EXISTS bar_reply_reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reply_id INT NOT NULL,
  user_id INT NOT NULL,
  reaction VARCHAR(20) NOT NULL DEFAULT 'like',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reply_id) REFERENCES bar_comment_replies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_reply_reaction (reply_id, user_id),
  INDEX idx_reply_reactions_reply (reply_id),
  INDEX idx_reply_reactions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
