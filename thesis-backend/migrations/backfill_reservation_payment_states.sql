UPDATE reservations r
JOIN payment_transactions pt
  ON pt.payment_type = 'reservation' AND pt.related_id = r.id
LEFT JOIN (
  SELECT payment_transaction_id, SUM(line_total) AS pli_total
  FROM payment_line_items
  GROUP BY payment_transaction_id
) pli ON pli.payment_transaction_id = pt.id
LEFT JOIN (
  SELECT reservation_id, SUM(quantity * unit_price) AS items_total
  FROM reservation_items
  GROUP BY reservation_id
) ri ON ri.reservation_id = r.id
LEFT JOIN bar_tables bt ON bt.id = r.table_id
SET
  r.status = CASE
    WHEN pt.status = 'paid' THEN 'confirmed'
    WHEN pt.status IN ('cancelled','failed') AND r.status IN ('pending','approved') THEN 'cancelled'
    ELSE r.status
  END,
  r.payment_status = CASE
    WHEN pt.status = 'paid' THEN CASE
      WHEN pt.amount < GREATEST(COALESCE(bt.price, 0) + COALESCE(ri.items_total, 0), COALESCE(pli.pli_total, 0), COALESCE(r.deposit_amount, 0)) THEN 'partial'
      ELSE 'paid'
    END
    WHEN pt.status IN ('cancelled','failed') AND r.status IN ('pending','approved') THEN 'cancelled'
    ELSE r.payment_status
  END,
  r.paid_at = CASE
    WHEN pt.status = 'paid' THEN COALESCE(pt.paid_at, NOW())
    ELSE r.paid_at
  END
WHERE
  (pt.status = 'paid' AND COALESCE(r.payment_status, 'pending') IN ('pending','failed'))
  OR
  (pt.status IN ('cancelled','failed') AND COALESCE(r.payment_status, 'pending') = 'pending' AND r.status IN ('pending','approved'));
