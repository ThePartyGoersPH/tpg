-- Fix review_responses foreign key to reference reviews(id)
-- Root cause: existing FK points to bar_reviews(id), but owner response flow uses reviews(id)

SET @db := DATABASE();

-- 1) Ensure reviews table exists
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bar_id INT NOT NULL,
  customer_id INT NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2) Remove orphaned responses that do not map to reviews.id
DELETE rr
FROM review_responses rr
LEFT JOIN reviews r ON r.id = rr.review_id
WHERE r.id IS NULL;

-- 3) Drop old FK if it exists (commonly fk_rr_review -> bar_reviews)
SET @old_fk := (
  SELECT CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'review_responses'
    AND COLUMN_NAME = 'review_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);

SET @drop_fk_sql := IF(
  @old_fk IS NOT NULL,
  CONCAT('ALTER TABLE review_responses DROP FOREIGN KEY ', @old_fk),
  'SELECT 1'
);
PREPARE stmt_drop_fk FROM @drop_fk_sql;
EXECUTE stmt_drop_fk;
DEALLOCATE PREPARE stmt_drop_fk;

-- 4) Add FK to reviews(id) if not already present
SET @has_new_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'review_responses'
    AND COLUMN_NAME = 'review_id'
    AND REFERENCED_TABLE_NAME = 'reviews'
);

SET @add_fk_sql := IF(
  @has_new_fk = 0,
  'ALTER TABLE review_responses ADD CONSTRAINT fk_rr_review FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_add_fk FROM @add_fk_sql;
EXECUTE stmt_add_fk;
DEALLOCATE PREPARE stmt_add_fk;
