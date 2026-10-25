CREATE TABLE IF NOT EXISTS platform_feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  category VARCHAR(50) DEFAULT 'general',
  status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_platform_feedback_user (user_id),
  INDEX idx_platform_feedback_status (status),
  INDEX idx_platform_feedback_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE OR REPLACE VIEW menu_best_sellers AS
SELECT 
  m.id AS menu_item_id,
  m.bar_id,
  m.menu_name,
  m.category,
  m.selling_price,
  COUNT(pli.id) AS total_orders,
  SUM(pli.quantity) AS total_quantity_sold,
  SUM(pli.line_total) AS total_revenue,
  RANK() OVER (PARTITION BY m.bar_id ORDER BY SUM(pli.quantity) DESC) AS sales_rank
FROM menu_items m
LEFT JOIN payment_line_items pli ON pli.item_type = 'menu' AND LOWER(pli.item_name) = LOWER(m.menu_name) AND pli.metadata LIKE CONCAT('%"bar_id":', m.bar_id, '%')
WHERE m.is_available = 1
GROUP BY m.id, m.bar_id, m.menu_name, m.category, m.selling_price
HAVING total_orders > 0;
SET @cx103 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items' AND COLUMN_NAME = 'is_best_seller');
SET @sx103 := IF(@cx103 = 0, 'ALTER TABLE menu_items ADD COLUMN is_best_seller BOOLEAN DEFAULT FALSE', 'SELECT 1');
PREPARE stx103 FROM @sx103;
EXECUTE stx103;
DEALLOCATE PREPARE stx103;
SET @cx104 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items' AND INDEX_NAME = 'idx_menu_best_seller');
SET @sx104 := IF(@cx104 = 0, 'ALTER TABLE menu_items ADD INDEX idx_menu_best_seller (is_best_seller)', 'SELECT 1');
PREPARE stx104 FROM @sx104;
EXECUTE stx104;
DEALLOCATE PREPARE stx104;
UPDATE menu_items m
LEFT JOIN menu_best_sellers mbs ON m.id = mbs.menu_item_id
SET m.is_best_seller = CASE 
  WHEN mbs.sales_rank <= 3 THEN TRUE 
  ELSE FALSE 
END;
