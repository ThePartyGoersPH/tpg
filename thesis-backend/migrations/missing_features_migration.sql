-- ============================================================
-- Migration: Missing Features
-- Description: Creates tables and columns for features that
--              exist in the frontend UI but lack DB support.
-- Date: 2026-03-06
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. bar_followers — users following bars
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 2. bar_posts — posts / announcements by bars
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 3. post_likes — likes on bar posts
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 4. post_comments — comments on bar posts
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 5. comment_replies — replies to comments
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 6. comment_reactions — reactions on comments
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 7. reply_reactions — reactions on replies
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 8. notifications — user notifications
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 9. promotions — bar promotions / deals
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 10. subscription_plans — available plans
-- ──────────────────────────────────────────────
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

-- Insert default plans
INSERT INTO `subscription_plans` (`name`, `display_name`, `description`, `price`, `billing_period`, `max_bars`, `max_events`, `max_promotions`, `sort_order`) VALUES
('free',       'Free',       'Basic listing with 1 bar',                       0.00,    'monthly', 1,  2,    1,    0),
('basic',      'Basic',      'Up to 3 bars with more events and promotions',  499.00,   'monthly', 3,  10,   5,    1),
('premium',    'Premium',    'Up to 10 bars with unlimited events',          1499.00,   'monthly', 10, NULL, NULL,  2),
('enterprise', 'Enterprise', 'Unlimited bars and all features',              4999.00,   'monthly', 999, NULL, NULL, 3);

-- ──────────────────────────────────────────────
-- 11. subscriptions — owner subscriptions
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 12. review_responses — owner replies to reviews
-- ──────────────────────────────────────────────
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

-- ──────────────────────────────────────────────
-- 13. Add missing columns to existing tables
-- ──────────────────────────────────────────────

-- bar_owners: subscription columns
ALTER TABLE `bar_owners`
  ADD COLUMN IF NOT EXISTS `subscription_tier` varchar(30) DEFAULT 'free' AFTER `permit_document`,
  ADD COLUMN IF NOT EXISTS `subscription_expires_at` datetime DEFAULT NULL AFTER `subscription_tier`;

-- bars: is_locked column for subscription enforcement
ALTER TABLE `bars`
  ADD COLUMN IF NOT EXISTS `is_locked` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'locked by subscription limits' AFTER `status`;

-- bar_posts: like_count and comment_count for quick lookups
ALTER TABLE `bar_posts`
  ADD COLUMN IF NOT EXISTS `like_count` int(11) NOT NULL DEFAULT 0 AFTER `status`,
  ADD COLUMN IF NOT EXISTS `comment_count` int(11) NOT NULL DEFAULT 0 AFTER `like_count`;

-- ──────────────────────────────────────────────
-- RBAC: Add missing permissions for BAR_OWNER role
-- BAR_OWNER (role_id=7) needs: ATTENDANCE_CREATE(6), LEAVE_APPLY(8), DOC_UPLOAD(11)
-- ──────────────────────────────────────────────
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`) VALUES
  (7, 6),   -- ATTENDANCE_CREATE
  (7, 8),   -- LEAVE_APPLY
  (7, 11);  -- DOC_UPLOAD

-- Ensure bar_owner users have role_id=7 (BAR_OWNER) if not already set
UPDATE `users` u
  JOIN `bar_owners` bo ON bo.user_id = u.id
  SET u.role_id = 7
  WHERE u.role_id IS NULL OR u.role_id = 0;

-- Ensure bar_owner users have bar_id set from their first bar
UPDATE `users` u
  JOIN `bar_owners` bo ON bo.user_id = u.id
  JOIN `bars` b ON b.owner_id = bo.id
  SET u.bar_id = b.id
  WHERE u.bar_id IS NULL AND b.id IS NOT NULL;

-- ──────────────────────────────────────────────
-- bars: Add logo_path and video_path columns (referenced by edit-bar.php and bars.php)
-- ──────────────────────────────────────────────
ALTER TABLE `bars`
  ADD COLUMN IF NOT EXISTS `logo_path` varchar(500) DEFAULT NULL AFTER `image_path`,
  ADD COLUMN IF NOT EXISTS `video_path` varchar(500) DEFAULT NULL AFTER `logo_path`;

-- ──────────────────────────────────────────────
-- bar_reviews: Add created_at alias column for compatibility
-- The table uses review_date but some code references created_at
-- ──────────────────────────────────────────────
-- (No change needed — reviews.php query now aliases review_date AS created_at)

-- reservations: guest columns for non-authenticated reservations
ALTER TABLE `reservations`
  MODIFY COLUMN `table_id` int(11) DEFAULT NULL,
  MODIFY COLUMN `customer_user_id` int(11) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `guest_name` varchar(255) DEFAULT NULL AFTER `customer_user_id`,
  ADD COLUMN IF NOT EXISTS `guest_email` varchar(255) DEFAULT NULL AFTER `guest_name`,
  ADD COLUMN IF NOT EXISTS `guest_phone` varchar(50) DEFAULT NULL AFTER `guest_email`,
  ADD COLUMN IF NOT EXISTS `occasion` varchar(100) DEFAULT NULL AFTER `party_size`;
