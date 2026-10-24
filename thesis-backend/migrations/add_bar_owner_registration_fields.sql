-- Migration: Extend business_registrations for bar owner registration flow
-- Run this once against the database

ALTER TABLE `business_registrations`
  ADD COLUMN IF NOT EXISTS `business_description` TEXT DEFAULT NULL COMMENT 'Bar description from registration form' AFTER `business_category`,
  ADD COLUMN IF NOT EXISTS `opening_time` VARCHAR(30) DEFAULT NULL COMMENT 'Bar opening time e.g. 6:00 PM' AFTER `business_description`,
  ADD COLUMN IF NOT EXISTS `closing_time` VARCHAR(30) DEFAULT NULL COMMENT 'Bar closing time e.g. 2:00 AM' AFTER `opening_time`,
  ADD COLUMN IF NOT EXISTS `gcash_number` VARCHAR(30) DEFAULT NULL COMMENT 'GCash mobile number' AFTER `closing_time`,
  ADD COLUMN IF NOT EXISTS `gcash_name` VARCHAR(255) DEFAULT NULL COMMENT 'Registered GCash account name' AFTER `gcash_number`,
  ADD COLUMN IF NOT EXISTS `bir_certificate` VARCHAR(500) DEFAULT NULL COMMENT 'File path: BIR certificate upload' AFTER `supporting_docs`,
  ADD COLUMN IF NOT EXISTS `business_permit` VARCHAR(500) DEFAULT NULL COMMENT 'File path: business permit upload' AFTER `bir_certificate`;
