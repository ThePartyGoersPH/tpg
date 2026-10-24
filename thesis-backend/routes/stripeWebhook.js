const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const stripeService = require("../services/stripeService");
const { createNotification } = require("../utils/notificationService");
const {
  handleOrderPaymentPaid,
  handleReservationPaymentPaid,
  handleSubscriptionPaymentPaid,
} = require("./paymongoWebhook");

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE CONNECT WEBHOOK (test mode)
// Mount BEFORE express.json() with express.raw() — Stripe verifies the signature
// against the exact raw bytes.
// Events: payment_intent.succeeded / payment_intent.payment_failed
// ═══════════════════════════════════════════════════════════════════════════

router.post("/", express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = await stripeService.constructEvent(req.body, req.headers['stripe-signature']);
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message);
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const eventId = event.id;
  const eventType = event.type;
  if (!eventId || !eventType) {
    return res.status(400).json({ success: false, message: 'Missing event data' });
  }

  try {
    const [existing] = await pool.query(
      "SELECT id, processed FROM webhook_events WHERE event_id = ? LIMIT 1",
      [eventId]
    );
    if (existing.length && existing[0].processed) {
      return res.json({ success: true, message: 'Event already processed' });
    }
    await pool.query(
      `INSERT INTO webhook_events (event_id, event_type, resource_type, resource_id, payload, processed)
       VALUES (?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,
      [eventId, eventType, event.data?.object?.object || 'unknown', event.data?.object?.id || 'unknown', JSON.stringify({ id: event.id, type: event.type })]
    );

    let result = { success: true, message: 'Webhook received' };
    if (eventType === 'payment_intent.succeeded') {
      result = await handleSucceeded(event.data.object);
    } else if (eventType === 'payment_intent.payment_failed') {
      result = await handleFailed(event.data.object);
    } else {
      console.log(`Unhandled Stripe event: ${eventType}`);
    }

    await pool.query(
      "UPDATE webhook_events SET processed = 1, processed_at = NOW(), error_message = ? WHERE event_id = ?",
      [result.success ? null : result.message, eventId]
    );
    return res.json({ success: true, message: 'Webhook processed', result });
  } catch (err) {
    console.error("STRIPE WEBHOOK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

async function findTxByIntent(pi) {
  const reference = pi?.metadata?.reference || null;
  if (reference) {
    const [rows] = await pool.query(
      "SELECT * FROM payment_transactions WHERE reference_id = ? LIMIT 1",
      [reference]
    );
    if (rows.length) return rows[0];
  }
  if (pi?.id) {
    const [rows] = await pool.query(
      "SELECT * FROM payment_transactions WHERE stripe_payment_intent_id = ? LIMIT 1",
      [pi.id]
    );
    if (rows.length) return rows[0];
  }
  return null;
}

async function handleSucceeded(pi) {
  try {
    const payment = await findTxByIntent(pi);
    if (!payment) {
      console.log(`No payment found for Stripe intent ${pi?.id}`);
      return { success: false, message: 'Payment not found' };
    }

    // Capture the transfer id for reporting (best effort).
    let transferId = null;
    try {
      const full = await stripeService.getPaymentIntent(pi.id);
      transferId = full?.charges?.data?.[0]?.transfer || null;
    } catch (_) {}

    await pool.query(
      `UPDATE payment_transactions
       SET status = 'paid', paid_at = NOW(), stripe_payment_intent_id = ?,
           stripe_transfer_id = COALESCE(?, stripe_transfer_id)
       WHERE id = ? AND status <> 'paid'`,
      [pi.id, transferId, payment.id]
    );

    if (payment.payment_type === 'order') {
      await handleOrderPaymentPaid(payment);
    } else if (payment.payment_type === 'reservation') {
      await handleReservationPaymentPaid(payment);
    } else if (payment.payment_type === 'subscription') {
      await handleSubscriptionPaymentPaid(payment);
    }
    return { success: true, message: `Stripe payment ${payment.reference_id} marked as paid` };
  } catch (err) {
    console.error('Stripe Succeeded Error:', err);
    return { success: false, message: err.message };
  }
}

async function handleFailed(pi) {
  try {
    const payment = await findTxByIntent(pi);
    if (!payment) return { success: false, message: 'Payment not found' };

    await pool.query(
      "UPDATE payment_transactions SET status = 'failed', failed_reason = ? WHERE id = ?",
      [pi?.last_payment_error?.message || 'Payment failed', payment.id]
    );

    if (payment.payment_type === 'reservation') {
      // Keep the booking open as Pending Payment so the customer can retry.
      await pool.query(
        "UPDATE reservations SET payment_status = 'pending' WHERE id = ? AND status NOT IN ('confirmed','cancelled','completed','checked_in')",
        [payment.related_id]
      );
      try {
        const [[resv]] = await pool.query(
          "SELECT customer_user_id FROM reservations WHERE id = ? LIMIT 1",
          [payment.related_id]
        );
        if (resv?.customer_user_id) {
          await createNotification({
            userIds: [resv.customer_user_id],
            type: 'reservation_payment_failed',
            title: 'Payment failed',
            message: `Your card payment of ₱${Number(payment.amount || 0).toLocaleString()} didn't go through (test mode). Your reservation is kept as Pending Payment — please try again.`,
            referenceType: 'reservation',
            referenceId: payment.related_id,
            category: 'reservation',
            action: 'navigate',
            targetRoute: '/reservations',
          });
        }
      } catch (_) {}
    } else if (payment.payment_type === 'order') {
      await pool.query("UPDATE pos_orders SET payment_status = 'failed' WHERE id = ?", [payment.related_id]);
    }
    return { success: true, message: 'Stripe payment marked as failed' };
  } catch (err) {
    console.error('Stripe Failed Error:', err);
    return { success: false, message: err.message };
  }
}

module.exports = router;
