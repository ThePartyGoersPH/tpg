-- Migration: Extend business_registrations for city/barangay, bar types, and selfie-with-ID

ALTER TABLE `business_registrations`
  ADD COLUMN IF NOT EXISTS `business_barangay` VARCHAR(100) DEFAULT NULL AFTER `business_city`,
  ADD COLUMN IF NOT EXISTS `bar_types` TEXT DEFAULT NULL AFTER `business_description`,
  ADD COLUMN IF NOT EXISTS `selfie_with_id` VARCHAR(500) DEFAULT NULL AFTER `business_permit`;
