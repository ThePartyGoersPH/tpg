SET @cx172 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'order_type');
SET @sx172 := IF(@cx172 = 0, 'ALTER TABLE reservations ADD COLUMN `order_type` varchar(20) NOT NULL DEFAULT ''table_booking''', 'SELECT 1');
PREPARE stx172 FROM @sx172;
EXECUTE stx172;
DEALLOCATE PREPARE stx172;
UPDATE `reservations` r
  SET r.order_type = CASE
    WHEN r.table_id IS NOT NULL THEN 'table_booking'
    WHEN EXISTS (SELECT 1 FROM `reservation_tables` rt WHERE rt.reservation_id = r.id) THEN 'table_booking'
    ELSE 'dine_in'
  END
WHERE r.order_type = 'table_booking';
