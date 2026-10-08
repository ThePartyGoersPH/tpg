-- ==========================================================================
-- DEBUG: Find why reservation is still pending
-- Run these queries one by one to diagnose the issue
-- ==========================================================================

-- 1. Find the Juan Bar reservation
SELECT 
  id,
  bar_id,
  customer_id,
  status,
  payment_status,
  reservation_date,
  created_at,
  paid_at
FROM reservations
WHERE bar_id = (SELECT id FROM bars WHERE name LIKE '%Juan%' LIMIT 1)
ORDER BY created_at DESC
LIMIT 5;

-- 2. Find payment for this reservation
SELECT 
  pt.id,
  pt.reference_id,
  pt.payment_type,
  pt.related_id,
  pt.status,
  pt.amount,
  pt.paid_at,
  pt.created_at
FROM payment_transactions pt
WHERE pt.payment_type = 'reservation'
ORDER BY pt.created_at DESC
LIMIT 5;

-- 3. Check if payment and reservation are linked
SELECT 
  r.id AS reservation_id,
  r.status AS reservation_status,
  r.payment_status AS reservation_payment_status,
  pt.id AS payment_id,
  pt.reference_id,
  pt.status AS payment_status,
  pt.related_id
FROM reservations r
LEFT JOIN payment_transactions pt ON pt.related_id = r.id AND pt.payment_type = 'reservation'
WHERE r.bar_id = (SELECT id FROM bars WHERE name LIKE '%Juan%' LIMIT 1)
ORDER BY r.created_at DESC
LIMIT 5;

-- 4. Check if there's a payment_transaction_id column in reservations
SHOW COLUMNS FROM reservations LIKE '%payment%';

-- 5. Direct fix - Update by reservation ID (replace X with actual ID from query 1)
-- UPDATE reservations 
-- SET status = 'paid', payment_status = 'paid', paid_at = NOW() 
-- WHERE id = X;
