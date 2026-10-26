-- ==========================================================
-- Brute-force protection: login attempt + IP rate-limit tables
-- Date: 2026-10-14
-- Notes:
--   - Additive + idempotent; safe to re-run. No backfill: every account
--     starts with a clean slate, so nobody is locked out by this migration.
--   - login_attempts holds two row flavours distinguished by identifier:
--       * account rows: identifier = lowercased email, app = login portal,
--         ip = latest offending IP. Carry failed_count, lock_level and
--         locked_until for the escalating 5 -> 60 minute lock ladder.
--       * IP rows: identifier = 'ip', app = '', ip = the address. Carry a
--         short fixed cooldown so one attacker can't sweep many accounts.
--   - ip_rate_limits is the generic per-route bucket (forgot-password,
--     register): (route, ip) pairs inside a sliding window.
--   - Written only by utils/loginAttempts.js; read on every password login
--     BEFORE the password is verified.
-- ==========================================================

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  identifier VARCHAR(191) NOT NULL,
  app VARCHAR(32) NOT NULL DEFAULT '',
  ip VARCHAR(45) NOT NULL DEFAULT '',
  user_id INT NULL DEFAULT NULL,
  failed_count INT NOT NULL DEFAULT 0,
  lock_level INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL DEFAULT NULL,
  first_attempt_at DATETIME NULL DEFAULT NULL,
  last_failed_at DATETIME NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_login_attempts_scope (identifier, app, ip),
  KEY idx_login_attempts_locked_until (locked_until),
  KEY idx_login_attempts_last_failed (last_failed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ip_rate_limits (
  route VARCHAR(64) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  window_start DATETIME NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (route, ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;