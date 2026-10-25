SET @cx501 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'transaction_number');
SET @sx501 := IF(@cx501 = 0, 'ALTER TABLE reservations ADD COLUMN transaction_number varchar(30) DEFAULT NULL COMMENT ''Human-readable transaction number for bar owner lookup''
  AFTER `id`', 'SELECT 1');
PREPARE stx501 FROM @sx501;
EXECUTE stx501;
DEALLOCATE PREPARE stx501;
SET @cx502 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'uq_reservation_txn');
SET @sx502 := IF(@cx502 = 0, 'ALTER TABLE reservations ADD UNIQUE KEY uq_reservation_txn (`transaction_number`)', 'SELECT 1');
PREPARE stx502 FROM @sx502;
EXECUTE stx502;
DEALLOCATE PREPARE stx502;
