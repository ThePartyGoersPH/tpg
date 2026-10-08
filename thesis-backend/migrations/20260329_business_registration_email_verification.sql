ALTER TABLE `business_registrations`
  ADD COLUMN IF NOT EXISTS `email_verification_token` VARCHAR(255) DEFAULT NULL AFTER `owner_password`,
  ADD COLUMN IF NOT EXISTS `email_verification_expires` DATETIME DEFAULT NULL AFTER `email_verification_token`,
  ADD COLUMN IF NOT EXISTS `email_verified_at` DATETIME DEFAULT NULL AFTER `email_verification_expires`;

ALTER TABLE `business_registrations`
  ADD INDEX IF NOT EXISTS `idx_br_email_verification_token` (`email_verification_token`);

ALTER TABLE `business_registrations`
  MODIFY COLUMN `status` ENUM('pending','pending_email_verification','pending_admin_approval','approved','rejected') NOT NULL DEFAULT 'pending_email_verification';
