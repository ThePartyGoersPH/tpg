-- Migration: Add transaction_number to reservations
-- Adds a unique human-readable transaction number (e.g. RES-20260320-A3F9K2)
-- Safe: only adds a new nullable column with a UNIQUE index.
-- Does NOT affect any existing POS app tables or columns.

ALTER TABLE `reservations`
  ADD COLUMN `transaction_number` varchar(30) DEFAULT NULL COMMENT 'Human-readable transaction number for bar owner lookup'
  AFTER `id`;

ALTER TABLE `reservations`
  ADD UNIQUE KEY `uq_reservation_txn` (`transaction_number`);
