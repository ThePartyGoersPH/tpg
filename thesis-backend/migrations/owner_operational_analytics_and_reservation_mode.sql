SET @cx193 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'reservation_mode');
SET @sx193 := IF(@cx193 = 0, 'ALTER TABLE bars ADD COLUMN reservation_mode ENUM(''manual_approval'', ''auto_accept'')
    NOT NULL DEFAULT ''manual_approval''
    AFTER minimum_reservation_deposit', 'SELECT 1');
PREPARE stx193 FROM @sx193;
EXECUTE stx193;
DEALLOCATE PREPARE stx193;
SET @cx194 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'event_id');
SET @sx194 := IF(@cx194 = 0, 'ALTER TABLE reservations ADD COLUMN event_id INT NULL AFTER table_id', 'SELECT 1');
PREPARE stx194 FROM @sx194;
EXECUTE stx194;
DEALLOCATE PREPARE stx194;
SET @cx195 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_event_id');
SET @sx195 := IF(@cx195 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservations_event_id (event_id)', 'SELECT 1');
PREPARE stx195 FROM @sx195;
EXECUTE stx195;
DEALLOCATE PREPARE stx195;
ALTER TABLE reservations ADD CONSTRAINT fk_reservations_event
  FOREIGN KEY (event_id) REFERENCES bar_events(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
