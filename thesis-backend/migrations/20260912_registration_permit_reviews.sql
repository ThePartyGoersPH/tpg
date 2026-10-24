-- Per-document automatic and manual review state for bar registrations.
CREATE TABLE IF NOT EXISTS business_registration_document_reviews (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  registration_id INT NOT NULL,
  document_type VARCHAR(60) NOT NULL,
  status ENUM('pending','approved','rejected','manual_review') NOT NULL DEFAULT 'pending',
  check_method ENUM('automatic','manual') NULL,
  notes TEXT NULL,
  checked_by INT NULL,
  checked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_registration_document_review (registration_id, document_type),
  KEY idx_registration_document_reviews_registration (registration_id)
);
