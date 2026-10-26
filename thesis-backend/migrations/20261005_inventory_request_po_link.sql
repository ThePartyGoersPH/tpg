-- Inventory Request -> Purchase Order linking
-- 1) Live link: which PO currently covers this request (NULL when unconverted).
SET @cx2001 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_requests' AND COLUMN_NAME = 'purchase_order_id');
SET @sx2001 := IF(@cx2001 = 0, 'ALTER TABLE inventory_requests ADD COLUMN purchase_order_id INT NULL AFTER reorder_level', 'SELECT 1');
PREPARE stx2001 FROM @sx2001;
EXECUTE stx2001;
DEALLOCATE PREPARE stx2001;

-- 2) Memory of the last PO that covered this request. The live link is reset to
--    NULL when that PO is rejected/cancelled so the request becomes convertible
--    again — this keeps the id so the card can explain why ("re-add to procurement?").
SET @cx2002 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_requests' AND COLUMN_NAME = 'last_purchase_order_id');
SET @sx2002 := IF(@cx2002 = 0, 'ALTER TABLE inventory_requests ADD COLUMN last_purchase_order_id INT NULL AFTER purchase_order_id', 'SELECT 1');
PREPARE stx2002 FROM @sx2002;
EXECUTE stx2002;
DEALLOCATE PREPARE stx2002;

-- 3) Purchase order items carry the requested unit (Bottle, Liter, Case, ...).
SET @cx2003 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_order_items' AND COLUMN_NAME = 'unit');
SET @sx2003 := IF(@cx2003 = 0, 'ALTER TABLE purchase_order_items ADD COLUMN unit VARCHAR(50) NULL AFTER item_name', 'SELECT 1');
PREPARE stx2003 FROM @sx2003;
EXECUTE stx2003;
DEALLOCATE PREPARE stx2003;

-- Reverse lookups: "which requests point at this PO?"
SET @cx2004 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_requests' AND INDEX_NAME = 'idx_inventory_requests_purchase_order');
SET @sx2004 := IF(@cx2004 = 0, 'CREATE INDEX idx_inventory_requests_purchase_order ON inventory_requests (purchase_order_id)', 'SELECT 1');
PREPARE stx2004 FROM @sx2004;
EXECUTE stx2004;
DEALLOCATE PREPARE stx2004;
