SET @cx173 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'payout_enabled');
SET @sx173 := IF(@cx173 = 0, 'ALTER TABLE bars ADD COLUMN `payout_enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''Enable/disable payouts for this bar'' AFTER `gcash_account_name`', 'SELECT 1');
PREPARE stx173 FROM @sx173;
EXECUTE stx173;
DEALLOCATE PREPARE stx173;
INSERT INTO `platform_settings` (`setting_key`, `setting_value`, `description`)
VALUES ('payments_enabled', '1', 'Enable/disable global payment processing system')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
