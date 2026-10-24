-- Migration: Add middle name support for bar owner registration and approved users

ALTER TABLE `business_registrations`
  ADD COLUMN IF NOT EXISTS `owner_middle_name` VARCHAR(80) DEFAULT NULL AFTER `owner_first_name`;

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `middle_name` VARCHAR(50) DEFAULT NULL AFTER `first_name`;
