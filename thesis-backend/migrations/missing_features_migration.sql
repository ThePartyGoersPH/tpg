CREATE TABLE IF NOT EXISTS `bar_followers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bar_user` (`bar_id`, `user_id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `fk_bf_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bf_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `bar_posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'author (bar owner or staff)',
  `content` text DEFAULT NULL,
  `image_path` varchar(500) DEFAULT NULL,
  `status` enum('active','archived','deleted') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_bp_bar` (`bar_id`),
  CONSTRAINT `fk_bp_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `post_likes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_post_user` (`post_id`, `user_id`),
  CONSTRAINT `fk_pl_post` FOREIGN KEY (`post_id`) REFERENCES `bar_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `post_comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `comment` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_pc_post` (`post_id`),
  CONSTRAINT `fk_pc_post` FOREIGN KEY (`post_id`) REFERENCES `bar_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `comment_replies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reply` text NOT NULL,
  `parent_reply_id` int(11) DEFAULT NULL COMMENT 'for nested replies',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cr_comment` (`comment_id`),
  CONSTRAINT `fk_cr_comment` FOREIGN KEY (`comment_id`) REFERENCES `post_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `comment_reactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reaction` varchar(20) NOT NULL DEFAULT 'like',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_comment_user` (`comment_id`, `user_id`),
  CONSTRAINT `fk_cre_comment` FOREIGN KEY (`comment_id`) REFERENCES `post_comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cre_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `reply_reactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reply_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reaction` varchar(20) NOT NULL DEFAULT 'like',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reply_user` (`reply_id`, `user_id`),
  CONSTRAINT `fk_rre_reply` FOREIGN KEY (`reply_id`) REFERENCES `comment_replies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rre_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL COMMENT 'follow, like, comment, reply, promotion, reservation, system',
  `title` varchar(255) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `link` varchar(500) DEFAULT NULL COMMENT 'URL to navigate to on click',
  `reference_id` int(11) DEFAULT NULL COMMENT 'related entity ID',
  `reference_type` varchar(50) DEFAULT NULL COMMENT 'post, comment, bar, reservation, etc.',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`user_id`, `is_read`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `promotions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `discount_type` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
  `discount_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `valid_from` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `image_path` varchar(500) DEFAULT NULL,
  `status` enum('active','inactive','expired') DEFAULT 'active',
  `redeemed_count` int(11) NOT NULL DEFAULT 0,
  `max_redemptions` int(11) DEFAULT NULL COMMENT 'NULL = unlimited',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_promo_bar` (`bar_id`),
  CONSTRAINT `fk_promo_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL COMMENT 'free, basic, premium, enterprise',
  `display_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `billing_period` enum('monthly','yearly','lifetime') DEFAULT 'monthly',
  `max_bars` int(11) NOT NULL DEFAULT 1 COMMENT 'max bars allowed under this plan',
  `max_events` int(11) DEFAULT NULL COMMENT 'NULL = unlimited',
  `max_promotions` int(11) DEFAULT NULL COMMENT 'NULL = unlimited',
  `features` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON array of feature flags',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_plan_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
INSERT IGNORE INTO `subscription_plans` (`name`, `display_name`, `description`, `price`, `billing_period`, `max_bars`, `max_events`, `max_promotions`, `sort_order`) VALUES
('free',       'Free',       'Basic listing with 1 bar',                       0.00,    'monthly', 1,  2,    1,    0),
('basic',      'Basic',      'Up to 3 bars with more events and promotions',  499.00,   'monthly', 3,  10,   5,    1),
('premium',    'Premium',    'Up to 10 bars with unlimited events',          1499.00,   'monthly', 10, NULL, NULL,  2),
('enterprise', 'Enterprise', 'Unlimited bars and all features',              4999.00,   'monthly', 999, NULL, NULL, 3);
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_owner_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `status` enum('active','cancelled','expired','past_due') NOT NULL DEFAULT 'active',
  `starts_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL COMMENT 'gcash, maya, card, manual',
  `payment_reference` varchar(255) DEFAULT NULL,
  `amount_paid` decimal(10,2) DEFAULT 0.00,
  `auto_renew` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sub_owner` (`bar_owner_id`),
  KEY `idx_sub_plan` (`plan_id`),
  CONSTRAINT `fk_sub_owner` FOREIGN KEY (`bar_owner_id`) REFERENCES `bar_owners` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_plan` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
CREATE TABLE IF NOT EXISTS `review_responses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `review_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'bar owner / manager who responded',
  `response` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_rr_review` (`review_id`),
  CONSTRAINT `fk_rr_review` FOREIGN KEY (`review_id`) REFERENCES `bar_reviews` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
SET @cx182 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_owners' AND COLUMN_NAME = 'subscription_tier');
SET @sx182 := IF(@cx182 = 0, 'ALTER TABLE bar_owners ADD COLUMN `subscription_tier` varchar(30) DEFAULT ''free'' AFTER `permit_document`', 'SELECT 1');
PREPARE stx182 FROM @sx182;
EXECUTE stx182;
DEALLOCATE PREPARE stx182;
SET @cx183 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_owners' AND COLUMN_NAME = 'subscription_expires_at');
SET @sx183 := IF(@cx183 = 0, 'ALTER TABLE bar_owners ADD COLUMN `subscription_expires_at` datetime DEFAULT NULL AFTER `subscription_tier`', 'SELECT 1');
PREPARE stx183 FROM @sx183;
EXECUTE stx183;
DEALLOCATE PREPARE stx183;
SET @cx184 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'is_locked');
SET @sx184 := IF(@cx184 = 0, 'ALTER TABLE bars ADD COLUMN `is_locked` tinyint(1) NOT NULL DEFAULT 0 COMMENT ''locked by subscription limits'' AFTER `status`', 'SELECT 1');
PREPARE stx184 FROM @sx184;
EXECUTE stx184;
DEALLOCATE PREPARE stx184;
SET @cx185 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_posts' AND COLUMN_NAME = 'like_count');
SET @sx185 := IF(@cx185 = 0, 'ALTER TABLE bar_posts ADD COLUMN `like_count` int(11) NOT NULL DEFAULT 0 AFTER `status`', 'SELECT 1');
PREPARE stx185 FROM @sx185;
EXECUTE stx185;
DEALLOCATE PREPARE stx185;
SET @cx186 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bar_posts' AND COLUMN_NAME = 'comment_count');
SET @sx186 := IF(@cx186 = 0, 'ALTER TABLE bar_posts ADD COLUMN `comment_count` int(11) NOT NULL DEFAULT 0 AFTER `like_count`', 'SELECT 1');
PREPARE stx186 FROM @sx186;
EXECUTE stx186;
DEALLOCATE PREPARE stx186;
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
  (7, 6),   -- ATTENDANCE_CREATE
  (7, 8),   -- LEAVE_APPLY
  (7, 11);
-- DOC_UPLOAD

UPDATE `users` u
  JOIN `bar_owners` bo ON bo.user_id = u.id
  SET u.role_id = 7
  WHERE u.role_id IS NULL OR u.role_id = 0;
UPDATE `users` u
  JOIN `bar_owners` bo ON bo.user_id = u.id
  JOIN `bars` b ON b.owner_id = bo.id
  SET u.bar_id = b.id
  WHERE u.bar_id IS NULL AND b.id IS NOT NULL;
SET @cx187 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'logo_path');
SET @sx187 := IF(@cx187 = 0, 'ALTER TABLE bars ADD COLUMN `logo_path` varchar(500) DEFAULT NULL AFTER `image_path`', 'SELECT 1');
PREPARE stx187 FROM @sx187;
EXECUTE stx187;
DEALLOCATE PREPARE stx187;
SET @cx188 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'video_path');
SET @sx188 := IF(@cx188 = 0, 'ALTER TABLE bars ADD COLUMN `video_path` varchar(500) DEFAULT NULL AFTER `logo_path`', 'SELECT 1');
PREPARE stx188 FROM @sx188;
EXECUTE stx188;
DEALLOCATE PREPARE stx188;
ALTER TABLE reservations MODIFY COLUMN `table_id` int(11) DEFAULT NULL;
ALTER TABLE reservations MODIFY COLUMN `customer_user_id` int(11) DEFAULT NULL;
SET @cx189 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'guest_name');
SET @sx189 := IF(@cx189 = 0, 'ALTER TABLE reservations ADD COLUMN `guest_name` varchar(255) DEFAULT NULL AFTER `customer_user_id`', 'SELECT 1');
PREPARE stx189 FROM @sx189;
EXECUTE stx189;
DEALLOCATE PREPARE stx189;
SET @cx190 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'guest_email');
SET @sx190 := IF(@cx190 = 0, 'ALTER TABLE reservations ADD COLUMN `guest_email` varchar(255) DEFAULT NULL AFTER `guest_name`', 'SELECT 1');
PREPARE stx190 FROM @sx190;
EXECUTE stx190;
DEALLOCATE PREPARE stx190;
SET @cx191 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'guest_phone');
SET @sx191 := IF(@cx191 = 0, 'ALTER TABLE reservations ADD COLUMN `guest_phone` varchar(50) DEFAULT NULL AFTER `guest_email`', 'SELECT 1');
PREPARE stx191 FROM @sx191;
EXECUTE stx191;
DEALLOCATE PREPARE stx191;
SET @cx192 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'occasion');
SET @sx192 := IF(@cx192 = 0, 'ALTER TABLE reservations ADD COLUMN `occasion` varchar(100) DEFAULT NULL AFTER `party_size`', 'SELECT 1');
PREPARE stx192 FROM @sx192;
EXECUTE stx192;
DEALLOCATE PREPARE stx192;
