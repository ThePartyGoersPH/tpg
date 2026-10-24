-- Migration: Takeout master switch for bars
-- Date: 2026-10-06
-- Purpose: Takeout / Food Order is only offered when the venue is a
-- restobar AND the owner explicitly enables takeout (plus at least one of
-- store pickup / delivery). Opt-in: defaults to OFF.
ALTER TABLE `bars`
  ADD COLUMN IF NOT EXISTS `is_takeout_enabled` tinyint(1) NOT NULL DEFAULT 0;
