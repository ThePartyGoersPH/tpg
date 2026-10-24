-- ═══════════════════════════════════════════════════════════════════════════
-- ADD PAYMENT CONTROL FIELDS FOR SUPER ADMIN MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════

-- Add payout_enabled to bars table (allows super admin to disable payouts for suspicious bars)
ALTER TABLE `bars`
  ADD COLUMN IF NOT EXISTS `payout_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Enable/disable payouts for this bar' AFTER `gcash_account_name`;

-- Add payments_enabled to platform_settings (global payment system control)
INSERT INTO `platform_settings` (`setting_key`, `setting_value`, `description`)
VALUES ('payments_enabled', '1', 'Enable/disable global payment processing system')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════
