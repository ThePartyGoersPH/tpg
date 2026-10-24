-- Fix reservation_items and payment_line_items with zero prices
-- This script updates items that have 0 or NULL unit_price with correct prices from menu_items

-- Step 1: Update reservation_items with zero prices
UPDATE reservation_items ri
JOIN menu_items m ON m.id = ri.menu_item_id
SET ri.unit_price = m.selling_price
WHERE (ri.unit_price = 0 OR ri.unit_price IS NULL)
  AND m.selling_price > 0;

-- Step 2: Update payment_line_items with zero prices by matching menu item names
UPDATE payment_line_items pli
JOIN menu_items m ON LOWER(TRIM(pli.item_name)) = LOWER(TRIM(m.menu_name))
SET 
  pli.unit_price = m.selling_price,
  pli.line_total = m.selling_price * pli.quantity
WHERE pli.item_type = 'menu'
  AND (pli.unit_price = 0 OR pli.unit_price IS NULL)
  AND m.selling_price > 0;

-- Step 3: Show affected records
SELECT 'Updated reservation_items:' as info;
SELECT ri.id, ri.reservation_id, m.menu_name, ri.quantity, ri.unit_price as new_price
FROM reservation_items ri
JOIN menu_items m ON m.id = ri.menu_item_id
WHERE ri.unit_price > 0
ORDER BY ri.id DESC
LIMIT 20;

SELECT 'Updated payment_line_items:' as info;
SELECT pli.id, pli.payment_transaction_id, pli.item_name, pli.quantity, pli.unit_price as new_price, pli.line_total
FROM payment_line_items pli
WHERE pli.item_type = 'menu' AND pli.unit_price > 0
ORDER BY pli.id DESC
LIMIT 20;
