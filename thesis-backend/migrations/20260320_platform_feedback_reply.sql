-- Migration: Add admin reply support to platform_feedback
-- Allows Super Admin to reply to customer platform feedback.
-- Safe: only adds 3 new nullable columns; does not alter any existing column.

ALTER TABLE `platform_feedback`
  ADD COLUMN `admin_reply`  TEXT          DEFAULT NULL            COMMENT 'Super admin reply to this feedback'         AFTER `comment`,
  ADD COLUMN `replied_at`   TIMESTAMP     NULL      DEFAULT NULL  COMMENT 'When the admin replied'                    AFTER `admin_reply`,
  ADD COLUMN `replied_by`   INT(11)       DEFAULT NULL            COMMENT 'FK to users.id of the admin who replied'   AFTER `replied_at`;
