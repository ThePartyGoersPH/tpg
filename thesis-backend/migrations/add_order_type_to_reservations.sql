-- Migration: Add order_type to reservations
-- Date: 2026-10-06
-- Purpose: Distinguish table bookings from table-less food orders so the
-- customer drawer (Table Booking / Dine-In / Takeout) and the admin
-- reservations table can render each kind correctly.
-- Values: 'table_booking' | 'dine_in' | 'takeout'

ALTER TABLE `reservations`
  ADD COLUMN IF NOT EXISTS `order_type` varchar(20) NOT NULL DEFAULT 'table_booking';

-- Backfill: rows with an assigned table (legacy column or junction table)
-- are table bookings; table-less rows become dine-in food orders.
UPDATE `reservations` r
  SET r.order_type = CASE
    WHEN r.table_id IS NOT NULL THEN 'table_booking'
    WHEN EXISTS (SELECT 1 FROM `reservation_tables` rt WHERE rt.reservation_id = r.id) THEN 'table_booking'
    ELSE 'dine_in'
  END
WHERE r.order_type = 'table_booking';
