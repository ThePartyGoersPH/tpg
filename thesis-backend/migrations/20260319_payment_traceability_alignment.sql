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
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'payment_transaction_id'
);
SET @sql_add_col := IF(@col_exists = 0,
  'ALTER TABLE reservations ADD COLUMN payment_transaction_id INT NULL AFTER payment_reference',
  'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'idx_reservations_payment_tx'
);
SET @sql_add_idx := IF(@idx_exists = 0,
  'ALTER TABLE reservations ADD INDEX idx_reservations_payment_tx (payment_transaction_id)',
  'SELECT 1'
);
PREPARE stmt_add_idx FROM @sql_add_idx;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;

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
SET @pocol_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'payment_transaction_id'
);
SET @sql_add_pocol := IF(@pocol_exists = 0,
  'ALTER TABLE pos_orders ADD COLUMN payment_transaction_id INT NULL AFTER total_amount',
  'SELECT 1'
);
PREPARE stmt_add_pocol FROM @sql_add_pocol;
EXECUTE stmt_add_pocol;
DEALLOCATE PREPARE stmt_add_pocol;

SET @pops_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'payment_status'
);
SET @sql_add_pops := IF(@pops_exists = 0,
  'ALTER TABLE pos_orders ADD COLUMN payment_status ENUM(''pending'',''paid'',''failed'',''refunded'') NULL DEFAULT ''pending'' AFTER payment_transaction_id',
  'SELECT 1'
);
PREPARE stmt_add_pops FROM @sql_add_pops;
EXECUTE stmt_add_pops;
DEALLOCATE PREPARE stmt_add_pops;

SET @poidx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND INDEX_NAME = 'idx_pos_orders_payment_tx'
);
SET @sql_add_poidx := IF(@poidx_exists = 0,
  'ALTER TABLE pos_orders ADD INDEX idx_pos_orders_payment_tx (payment_transaction_id)',
  'SELECT 1'
);
PREPARE stmt_add_poidx FROM @sql_add_poidx;
EXECUTE stmt_add_poidx;
DEALLOCATE PREPARE stmt_add_poidx;

SET @popsidx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND INDEX_NAME = 'idx_pos_orders_payment_status'
);
SET @sql_add_popsidx := IF(@popsidx_exists = 0,
  'ALTER TABLE pos_orders ADD INDEX idx_pos_orders_payment_status (payment_status)',
  'SELECT 1'
);
PREPARE stmt_add_popsidx FROM @sql_add_popsidx;
EXECUTE stmt_add_popsidx;
DEALLOCATE PREPARE stmt_add_popsidx;

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
