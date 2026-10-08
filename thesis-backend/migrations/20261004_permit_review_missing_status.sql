-- Permit review statuses: add 'missing'.
-- A permit with no file on record must be able to be stored as "missing" so it
-- can never be read (or accidentally left) as "approved".
-- Idempotent: only runs the ALTER when the enum does not already contain it.

SET @status_type := (
  SELECT COLUMN_TYPE
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'business_registration_document_reviews'
     AND COLUMN_NAME = 'status'
);

SET @sql := IF(
  @status_type IS NOT NULL AND @status_type NOT LIKE '%missing%',
  "ALTER TABLE business_registration_document_reviews
     MODIFY status ENUM('pending','approved','rejected','manual_review','missing')
     NOT NULL DEFAULT 'pending'",
  "SELECT 'business_registration_document_reviews.status already allows missing' AS note"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
