-- ============================================================
-- Migration: Add reviews table for Customer App rating system
-- Safe: Uses IF NOT EXISTS, no destructive operations
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bar_id INT NOT NULL,
  customer_id INT NOT NULL,
  rating TINYINT UNSIGNED NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- One review per customer per bar
  UNIQUE KEY uq_customer_bar (customer_id, bar_id),

  -- Foreign keys
  CONSTRAINT fk_reviews_bar FOREIGN KEY (bar_id) REFERENCES bars(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Indexes for common queries
  INDEX idx_reviews_bar (bar_id),
  INDEX idx_reviews_customer (customer_id),
  INDEX idx_reviews_rating (bar_id, rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
