-- MariaDB 10.4 compatible migration: customer approval workflow columns
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS approval_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS approval_reviewed_by INT NULL,
  ADD COLUMN IF NOT EXISTS approval_reviewed_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS approval_rejection_reason VARCHAR(500) NULL;

ALTER TABLE users
  ADD INDEX IF NOT EXISTS idx_users_approval_status (approval_status);
