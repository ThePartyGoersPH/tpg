-- Migration: Add photo support to bar_videos and photo limits to subscription_plans
-- Date: 2026-09-04

-- 1. Add media_type and caption columns to bar_videos
ALTER TABLE bar_videos
  ADD COLUMN IF NOT EXISTS media_type ENUM('video','photo') NOT NULL DEFAULT 'video' AFTER label,
  ADD COLUMN IF NOT EXISTS caption VARCHAR(200) DEFAULT NULL AFTER media_type;

-- 2. Add max_photos column to subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS max_photos INT DEFAULT NULL COMMENT 'NULL = unlimited' AFTER max_promotions;

-- 3. Set photo limits per tier
UPDATE subscription_plans SET max_photos = 5   WHERE name = 'free';
UPDATE subscription_plans SET max_photos = 20  WHERE name = 'basic';
UPDATE subscription_plans SET max_photos = NULL WHERE name = 'premium';
UPDATE subscription_plans SET max_photos = NULL WHERE name = 'enterprise';
