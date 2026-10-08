-- Migration: Add event_type to bar_events table
-- Date: 2026-03-30
-- Purpose: Support event type categorization (PROMPT 4.5)

-- Add event_type column to bar_events table
ALTER TABLE `bar_events` 
ADD COLUMN `event_type` VARCHAR(100) DEFAULT NULL COMMENT 'Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom' AFTER `title`;

-- Add index for filtering by event type
ALTER TABLE `bar_events`
ADD INDEX `idx_event_type` (`event_type`);

-- Also add to archive table for consistency
ALTER TABLE `bar_events_archive` 
ADD COLUMN `event_type` VARCHAR(100) DEFAULT NULL COMMENT 'Event type: Stand-up Comedy, Open Mic, Live Band, DJ Night, Ladies Night, Custom' AFTER `title`;
