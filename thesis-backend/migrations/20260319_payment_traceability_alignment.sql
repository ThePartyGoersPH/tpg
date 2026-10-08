-- ==========================================================================
-- Payment traceability + status alignment (non-destructive)
-- Date: 2026-03-19
-- Purpose:
--   1) Detailed payment history via payment_line_items
--   2) Link reservations/orders to payment_transactions
--   3) Align reservation/order statuses for paid/cancelled flows
-- ==========================================================================

-- 1) Ensure payment_line_items exists for itemized payment history
CREATE TABLE IF NOT EXISTS payment_line_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_transaction_id INT NOT NULL,
  item_type ENUM('table', 'menu', 'service', 'other') NOT NULL DEFAULT 'other',
  item_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payment_line_items_payment (payment_transaction_id),
  CONSTRAINT fk_payment_line_items_payment_tx
    FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2) Ensure reservations can link to payment transaction
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_transaction_id INT NULL AFTER payment_reference,
  ADD INDEX IF NOT EXISTS idx_reservations_payment_tx (payment_transaction_id);

-- Add FK only if missing
SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'reservations'
    AND CONSTRAINT_NAME = 'fk_reservations_payment_tx'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_fk_res := IF(
  @fk_exists = 0,
  'ALTER TABLE reservations ADD CONSTRAINT fk_reservations_payment_tx FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk_res FROM @sql_fk_res;
EXECUTE stmt_fk_res;
DEALLOCATE PREPARE stmt_fk_res;

-- 3) Ensure pos_orders has payment linkage columns used by backend
ALTER TABLE pos_orders
  ADD COLUMN IF NOT EXISTS payment_transaction_id INT NULL AFTER total_amount,
  ADD COLUMN IF NOT EXISTS payment_status ENUM('pending','paid','failed','refunded') NULL DEFAULT 'pending' AFTER payment_transaction_id,
  ADD INDEX IF NOT EXISTS idx_pos_orders_payment_tx (payment_transaction_id),
  ADD INDEX IF NOT EXISTS idx_pos_orders_payment_status (payment_status);

-- Add FK only if missing
SET @fk_exists2 := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pos_orders'
    AND CONSTRAINT_NAME = 'fk_pos_orders_payment_tx'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_fk_pos := IF(
  @fk_exists2 = 0,
  'ALTER TABLE pos_orders ADD CONSTRAINT fk_pos_orders_payment_tx FOREIGN KEY (payment_transaction_id) REFERENCES payment_transactions(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_fk_pos FROM @sql_fk_pos;
EXECUTE stmt_fk_pos;
DEALLOCATE PREPARE stmt_fk_pos;

-- 4) Expand status enums to support paid status (non-destructive)
-- Keep existing values for backward compatibility while enabling 'paid'
ALTER TABLE reservations
  MODIFY COLUMN status ENUM('pending','approved','confirmed','rejected','cancelled','paid') NOT NULL DEFAULT 'pending';

ALTER TABLE pos_orders
  MODIFY COLUMN status ENUM('pending','completed','cancelled','paid') NOT NULL DEFAULT 'pending';

-- 5) Backfill linkage from reservation payment_reference to payment_transactions.reference_id
UPDATE reservations r
JOIN payment_transactions pt
  ON pt.payment_type = 'reservation'
 AND pt.related_id = r.id
SET r.payment_transaction_id = pt.id
WHERE r.payment_transaction_id IS NULL;

-- 6) Optional consistency backfill for reservation/order status from paid payments
UPDATE reservations r
JOIN payment_transactions pt
  ON pt.payment_type = 'reservation'
 AND pt.related_id = r.id
SET r.payment_status = 'paid',
    r.status = 'paid',
    r.paid_at = COALESCE(r.paid_at, pt.paid_at, NOW())
WHERE pt.status = 'paid';

UPDATE pos_orders o
JOIN payment_transactions pt
  ON pt.payment_type = 'order'
 AND pt.related_id = o.id
SET o.payment_status = 'paid',
    o.status = 'paid',
    o.completed_at = COALESCE(o.completed_at, pt.paid_at, NOW())
WHERE pt.status = 'paid';
