-- ============================================================
-- Migration: ID Verification for customers
-- Idempotent: safe to run multiple times.
-- NEVER touches super_admin, bar owner, or staff accounts.
-- ============================================================

-- 1. Add ID verification columns to users (customer accounts only)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id_verification_status VARCHAR(30) DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS id_submitted_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS id_reviewed_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS id_reviewed_by INT NULL,
  ADD COLUMN IF NOT EXISTS id_rejection_reason VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS id_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS id_last4 VARCHAR(4) NULL,
  ADD COLUMN IF NOT EXISTS id_hash VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS id_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS id_ocr_result TEXT NULL,
  ADD COLUMN IF NOT EXISTS id_ocr_status VARCHAR(20) DEFAULT 'pending';

-- 2. ID submissions table
CREATE TABLE IF NOT EXISTS id_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  id_type VARCHAR(50) NOT NULL,
  id_number_last4 VARCHAR(4),
  id_number_hash VARCHAR(64),
  front_image_path VARCHAR(500) NOT NULL,
  back_image_path VARCHAR(500),
  selfie_image_path VARCHAR(500) NOT NULL,
  ocr_result TEXT,
  ocr_status VARCHAR(20) DEFAULT 'pending',
  status VARCHAR(30) DEFAULT 'pending_review',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  rejection_reason VARCHAR(500) NULL,
  attempt_number INT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- 3. OCR monthly counter
CREATE TABLE IF NOT EXISTS ocr_monthly_counter (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `year_month` VARCHAR(7) NOT NULL UNIQUE,
  `count` INT DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Audit log for ID verification actions
CREATE TABLE IF NOT EXISTS id_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  admin_id INT,
  action VARCHAR(50) NOT NULL,
  details TEXT,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_admin_id (admin_id),
  INDEX idx_created_at (created_at)
);

-- 5. Backfill: existing customers stay approved
UPDATE users
SET id_verification_status = 'approved'
WHERE role = 'customer'
  AND (id_verification_status IS NULL OR id_verification_status = 'not_submitted' OR id_verification_status = '');