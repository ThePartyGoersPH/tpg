-- Migration: Add email verification token columns to users table
-- Run this once against your tpg database

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `email_verification_token` VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `email_verification_expires` DATETIME DEFAULT NULL;

ALTER TABLE `users`
  ADD INDEX IF NOT EXISTS `idx_email_verification_token` (`email_verification_token`);
