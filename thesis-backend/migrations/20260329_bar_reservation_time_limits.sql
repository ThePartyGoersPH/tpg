-- Migration: Bar reservation time limit configuration + reservation reserved_until

ALTER TABLE `bars`
  ADD COLUMN IF NOT EXISTS `bar_types` TEXT DEFAULT NULL AFTER `category`,
  ADD COLUMN IF NOT EXISTS `reservation_time_limit_mode` ENUM('restobar','club','event','custom') DEFAULT NULL AFTER `bar_types`,
  ADD COLUMN IF NOT EXISTS `reservation_time_limit_minutes` INT DEFAULT NULL AFTER `reservation_time_limit_mode`;

ALTER TABLE `reservations`
  ADD COLUMN IF NOT EXISTS `reserved_until` DATETIME DEFAULT NULL AFTER `reservation_time`;

ALTER TABLE `reservations`
  ADD INDEX IF NOT EXISTS `idx_reservations_reserved_until` (`reserved_until`);
