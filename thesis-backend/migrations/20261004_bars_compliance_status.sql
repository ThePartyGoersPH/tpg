-- ============================================================
-- Migration: Bar compliance gating (Super Admin approval)
-- Description: Adds bars.compliance_status so a bar only becomes
--              visible to customers after the Super Admin approves
--              its registration + government permit documents.
--              Values: incomplete | pending_review | approved | rejected
-- Date: 2026-10-04
-- Idempotent: safe to re-run (column probes + guarded backfill).
-- ============================================================

SET @col_status := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'compliance_status'
);

-- ── 1. compliance_status ─────────────────────────────────────
SET @sql := IF(
  @col_status = 0,
  'ALTER TABLE `bars` ADD COLUMN `compliance_status` ENUM(''incomplete'',''pending_review'',''approved'',''rejected'') NOT NULL DEFAULT ''incomplete''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── 2. rejection reason (shown to the bar owner) ─────────────
SET @col_reason := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'compliance_rejection_reason'
);
SET @sql := IF(
  @col_reason = 0,
  'ALTER TABLE `bars` ADD COLUMN `compliance_rejection_reason` TEXT DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── 3. submission timestamp (drives the approval queue order) ─
SET @col_submitted := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'compliance_submitted_at'
);
SET @sql := IF(
  @col_submitted = 0,
  'ALTER TABLE `bars` ADD COLUMN `compliance_submitted_at` DATETIME DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── 4/5. reviewer bookkeeping (mirrors reviewed_by/reviewed_at) ─
SET @col_reviewer := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'bars'
    AND COLUMN_NAME = 'compliance_reviewed_by'
);
SET @sql := IF(
  @col_reviewer = 0,
  'ALTER TABLE `bars` ADD COLUMN `compliance_reviewed_by` INT DEFAULT NULL, ADD COLUMN `compliance_reviewed_at` DATETIME DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ── Backfill ─────────────────────────────────────────────────
-- Runs only on the first execution (when compliance_status was just
-- created). Bars that already existed were published before this gate
-- existed, so keep them visible; the DEFAULT 'incomplete' applies to
-- every bar registered from now on.
SET @backfill := IF(
  @col_status = 0,
  'UPDATE `bars` SET `compliance_status` = ''approved''',
  'SELECT 1'
);
PREPARE stmt FROM @backfill;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
