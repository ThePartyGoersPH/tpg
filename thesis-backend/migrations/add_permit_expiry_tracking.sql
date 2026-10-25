-- Migration: Add permit expiry tracking to bars table
-- Date: 2026-03-30
-- Purpose: Track business permit expiry dates and status (PROMPT 6.2)

-- Add permit expiry date and status columns
ALTER TABLE `bars` 
ADD COLUMN `permit_expiry_date` DATE DEFAULT NULL COMMENT 'Business permit expiry date',
ADD COLUMN `permit_status` ENUM('valid', 'expiring_soon', 'expired') DEFAULT 'valid' COMMENT 'Permit status: valid, expiring_soon (30 days), expired',
ADD COLUMN `permit_expiry_notified_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Last time expiry notification was sent',
ADD COLUMN `permit_expired_flagged_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When permit was flagged as expired';
-- Add indexes for efficient querying
SET @cx2013 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND INDEX_NAME = 'idx_permit_expiry_date');
SET @sx2013 := IF(@cx2013 = 0, 'CREATE INDEX `idx_permit_expiry_date` ON `bars` (`permit_expiry_date`)', 'SELECT 1');
PREPARE stx2013 FROM @sx2013;
EXECUTE stx2013;
DEALLOCATE PREPARE stx2013;
SET @cx2014 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND INDEX_NAME = 'idx_permit_status');
SET @sx2014 := IF(@cx2014 = 0, 'CREATE INDEX `idx_permit_status` ON `bars` (`permit_status`)', 'SELECT 1');
PREPARE stx2014 FROM @sx2014;
EXECUTE stx2014;
DEALLOCATE PREPARE stx2014;
-- Create permit expiry notifications log table
CREATE TABLE IF NOT EXISTS `permit_expiry_notifications` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `bar_id` INT(11) NOT NULL,
  `notification_type` ENUM('30_day_warning', 'expired_flag') NOT NULL COMMENT 'Type of notification sent',
  `permit_expiry_date` DATE NOT NULL COMMENT 'The expiry date at time of notification',
  `email_sent` TINYINT(1) DEFAULT 0 COMMENT 'Whether email was successfully sent',
  `email_sent_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When email was sent',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_id` (`bar_id`),
  KEY `idx_notification_type` (`notification_type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_permit_notifications_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Log of permit expiry notifications sent to bar owners';
