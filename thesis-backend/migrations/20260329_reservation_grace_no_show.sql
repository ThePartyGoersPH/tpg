-- Migration: Reservation grace period tracking + no-show support

ALTER TABLE `reservations`
  ADD COLUMN IF NOT EXISTS `checked_in_at` DATETIME DEFAULT NULL AFTER `paid_at`,
  ADD COLUMN IF NOT EXISTS `no_show_at` DATETIME DEFAULT NULL AFTER `checked_in_at`;

ALTER TABLE `reservations`
  ADD INDEX IF NOT EXISTS `idx_reservations_checked_in_at` (`checked_in_at`),
  ADD INDEX IF NOT EXISTS `idx_reservations_no_show_at` (`no_show_at`);

ALTER TABLE `reservations`
  MODIFY COLUMN `status` ENUM('pending','approved','rejected','cancelled','confirmed','paid','checked_in','completed','no_show') NOT NULL DEFAULT 'pending';
