-- Migration: Clean up duplicate reservations and add indexes for conflict detection
-- Note: MySQL doesn't support partial unique indexes, so we rely on application-level
-- duplicate prevention (already implemented in routes/reservations.js)

-- Step 1: Identify and cancel duplicate reservations (keep the earliest one per slot)
-- Only cancel duplicates where both reservations are in active states
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

-- Step 2: Add composite index to speed up duplicate detection queries
-- This helps the backend conflict check run faster
ALTER TABLE reservations
  ADD INDEX idx_reservation_slot (table_id, reservation_date, reservation_time, status);

-- Note: Duplicate prevention is enforced at the application level in POST /reservations
-- via the 1-hour conflict check query. A database-level unique constraint cannot be used
-- because cancelled reservations need to allow duplicates (they're inactive slots).
