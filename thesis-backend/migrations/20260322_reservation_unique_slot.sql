UPDATE reservations r
INNER JOIN (
  SELECT table_id, reservation_date, reservation_time, MIN(id) AS keep_id
  FROM reservations
  WHERE status IN ('pending', 'approved', 'paid', 'confirmed')
  GROUP BY table_id, reservation_date, reservation_time
  HAVING COUNT(*) > 1
) dups ON r.table_id = dups.table_id
       AND r.reservation_date = dups.reservation_date
       AND r.reservation_time = dups.reservation_time
       AND r.id != dups.keep_id
SET r.status = 'cancelled',
    r.notes = CONCAT(COALESCE(r.notes, ''), ' [auto-cancelled: duplicate slot detected during migration]')
WHERE r.status IN ('pending', 'approved', 'paid', 'confirmed');
SET @cx503 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservation_slot');
SET @sx503 := IF(@cx503 = 0, 'ALTER TABLE reservations ADD INDEX idx_reservation_slot (table_id, reservation_date, reservation_time, status)', 'SELECT 1');
PREPARE stx503 FROM @sx503;
EXECUTE stx503;
DEALLOCATE PREPARE stx503;
