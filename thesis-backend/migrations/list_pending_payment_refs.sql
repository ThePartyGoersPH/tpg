SELECT id, reference_id, payment_type, related_id, status, paymongo_source_id, paymongo_payment_id, payment_method, amount
FROM payment_transactions
WHERE payment_type = 'reservation' AND status = 'pending'
ORDER BY id DESC
LIMIT 12;
