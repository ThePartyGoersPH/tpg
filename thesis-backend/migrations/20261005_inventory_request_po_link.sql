-- Inventory Request -> Purchase Order linking
-- 1) Live link: which PO currently covers this request (NULL when unconverted).
ALTER TABLE inventory_requests
  ADD COLUMN IF NOT EXISTS purchase_order_id INT NULL AFTER reorder_level;

-- 2) Memory of the last PO that covered this request. The live link is reset to
--    NULL when that PO is rejected/cancelled so the request becomes convertible
--    again — this keeps the id so the card can explain why ("re-add to procurement?").
ALTER TABLE inventory_requests
  ADD COLUMN IF NOT EXISTS last_purchase_order_id INT NULL AFTER purchase_order_id;

-- 3) Purchase order items carry the requested unit (Bottle, Liter, Case, ...).
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS unit VARCHAR(50) NULL AFTER item_name;

-- Reverse lookups: "which requests point at this PO?"
CREATE INDEX IF NOT EXISTS idx_inventory_requests_purchase_order
  ON inventory_requests (purchase_order_id);
