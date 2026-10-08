-- Fix Juan Bar minimum_reservation_deposit value
-- Current value: 10000.00 (displays as 10000%)
-- Correct value: 10.00 (displays as 10%)

UPDATE bars 
SET minimum_reservation_deposit = 10.00 
WHERE id = 11 AND name = 'Juan Bar';

-- Verify the update
SELECT id, name, minimum_reservation_deposit 
FROM bars 
WHERE id = 11;
