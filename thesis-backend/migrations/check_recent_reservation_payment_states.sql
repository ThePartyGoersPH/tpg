SELECT r.id, r.transaction_number, r.status, r.payment_status, r.payment_method, r.deposit_amount, pt.status AS tx_status, pt.payment_method AS tx_method, pt.amount AS tx_amount
FROM reservations r
LEFT JOIN payment_transactions pt ON pt.id = r.payment_transaction_id
ORDER BY r.id DESC
LIMIT 12;
