-- Additive migration: owner operational analytics support
-- 1) Reservation mode setting per bar (auto_accept/manual)
-- 2) Optional event_id linkage on reservations for event performance analytics

ALTER TABLE bars
  ADD COLUMN IF NOT EXISTS reservation_mode ENUM('manual_approval', 'auto_accept')
    NOT NULL DEFAULT 'manual_approval'
    AFTER minimum_reservation_deposit;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS event_id INT NULL AFTER table_id,
  ADD INDEX IF NOT EXISTS idx_reservations_event_id (event_id);

ALTER TABLE reservations
  ADD CONSTRAINT fk_reservations_event
  FOREIGN KEY (event_id) REFERENCES bar_events(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
