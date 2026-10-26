-- Migration: Add decision_note, id_authenticity_status, and reviewed_by_label columns to users table for customer approval workflow
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS decision_note VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS id_authenticity_status ENUM('verified', 'pending_review', 'failed') NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS id_type VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS id_number VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS id_front_path VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS id_back_path VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS id_selfie_path VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by_label VARCHAR(100) NULL;

-- Add index for faster lookups
ALTER TABLE users
  ADD INDEX IF NOT EXISTS idx_users_decision_note (decision_note),
  ADD INDEX IF NOT EXISTS idx_users_id_authenticity (id_authenticity_status);
