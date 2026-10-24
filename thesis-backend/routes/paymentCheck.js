const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const pool = require("../config/database");
const paymongoService = require("../services/paymongoService");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
const { USER_ROLES } = require("../config/constants");
const { deductInventoryForReservation, normalizeReservationPaymentStatusForStorage, createPayoutForPayment } = require("./payments");

const VERIFY_ALLOWED_ROLES = [
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.BAR_OWNER,
  USER_ROLES.MANAGER,
];

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.PAYMENT_CHECK_VERIFY_MAX_PER_MINUTE || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many payment verification attempts. Please try again shortly." },
});

function secureCompare(value, expected) {
  const a = Buffer.from(String(value || ""));
  const b = Buffer.from(String(expected || ""));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function transitionLog(stage, payment, meta = {}) {
  const payload = {
    stage,
    payment_id: payment?.id || null,
    reference_id: payment?.reference_id || null,
    payment_type: payment?.payment_type || null,
    related_id: payment?.related_id || null,
    at: new Date().toISOString(),
    ...meta,
  };
  console.log("[PAYMENT_CHECK_AUDIT]", JSON.stringify(payload));
}

function verifyRoleGuard(req, res, next) {
  return requireRole(VERIFY_ALLOWED_ROLES)(req, res, next);
}

function verifyAuthorization(req, res, next) {
  const configuredSecret = String(process.env.PAYMENT_CHECK_INTERNAL_SECRET || "").trim();
  const providedSecret = String(req.headers["x-payment-check-secret"] || "").trim();

  if (configuredSecret && providedSecret) {
    if (secureCompare(providedSecret, configuredSecret)) {
      return next();
    }
    return res.status(403).json({ success: false, message: "Invalid payment verification secret" });
  }

  return requireAuth(req, res, () => verifyRoleGuard(req, res, next));
}

// ═══════════════════════════════════════════════════════════════════════════
// MANUAL PAYMENT CHECK (FOR DEVELOPMENT/TESTING)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /payment-check/verify/:reference_id
 * Manually check payment status from PayMongo and update database
 * USE THIS FOR LOCAL DEVELOPMENT when webhooks can't reach localhost
 */
router.post("/verify/:reference_id", verifyLimiter, verifyAuthorization, async (req, res) => {
  try {
    const referenceId = req.params.reference_id;

    // Get payment transaction
    const [payments] = await pool.query(
      "SELECT * FROM payment_transactions WHERE reference_id = ? LIMIT 1",
      [referenceId]
    );

    if (!payments.length) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const payment = payments[0];

    if (payment.status === 'paid') {
      transitionLog("idempotent-already-paid", payment, { reason: "payment_transactions.status already paid" });
      return res.json({ success: true, message: "Payment already confirmed", data: payment });
    }

    // Check PayMongo for payment status
    await paymongoService.loadKeys();
    let paymongoPayment = null;

    try {
      // Try to get payment by source ID (GCash/PayMaya)
      if (payment.paymongo_source_id) {
        const axios = require('axios');
        const response = await axios.get(
          `https://api.paymongo.com/v1/sources/${payment.paymongo_source_id}`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(paymongoService.secretKey).toString('base64')}`,
            },
          }
        );
        paymongoPayment = response.data.data;

        // Check if source is already paid/consumed or can be attached now
        if (['chargeable', 'paid', 'consumed'].includes(paymongoPayment.attributes.status)) {
          console.log(`Source ${payment.paymongo_source_id} is ${paymongoPayment.attributes.status}. Updating payment...`);
          
          // Update payment status
          const [markPaidResult] = await pool.query(
            "UPDATE payment_transactions SET status = 'paid', paid_at = NOW() WHERE id = ? AND status <> 'paid'",
            [payment.id]
          );

          if (markPaidResult.affectedRows === 0) {
            transitionLog("idempotent-concurrent-paid", payment, {
              source_status: paymongoPayment.attributes.status,
            });
            return res.json({
              success: true,
              message: "Payment already confirmed",
              data: {
                reference_id: referenceId,
                status: 'paid',
                payment_type: payment.payment_type,
              },
            });
          }

          transitionLog("marked-paid", payment, {
            source_status: paymongoPayment.attributes.status,
            trigger: "source",
          });

          // Process based on payment type
          if (payment.payment_type === 'subscription') {
            await activateSubscription(payment);
          } else if (payment.payment_type === 'order') {
            await updateOrder(payment);
          } else if (payment.payment_type === 'reservation') {
            await updateReservation(payment);
          }

          return res.json({
            success: true,
            message: "Payment confirmed and processed!",
            data: {
              reference_id: referenceId,
              status: 'paid',
              payment_type: payment.payment_type,
            },
          });
        } else if (paymongoPayment.attributes.status === 'failed' || paymongoPayment.attributes.status === 'expired' || paymongoPayment.attributes.status === 'inactive') {
          await pool.query(
            "UPDATE payment_transactions SET status = 'cancelled', failed_reason = 'Payment cancelled' WHERE id = ? AND status <> 'paid'",
            [payment.id]
          );
          transitionLog("marked-cancelled", payment, {
            source_status: paymongoPayment.attributes.status,
            trigger: "source",
          });
          if (payment.payment_type === 'order') {
            await pool.query("UPDATE pos_orders SET payment_status = 'cancelled' WHERE id = ?", [payment.related_id]);
          } else if (payment.payment_type === 'reservation') {
            await pool.query("UPDATE reservations SET payment_status = 'cancelled', status = 'cancelled' WHERE id = ?", [payment.related_id]);
          }
          return res.json({
            success: false,
            message: 'Payment cancelled',
            data: { status: 'cancelled' },
          });
        } else {
          return res.json({
            success: false,
            message: `Payment status: ${paymongoPayment.attributes.status}. Please complete payment.`,
            data: { status: paymongoPayment.attributes.status },
          });
        }
      }

      // Try payment intent (cards)
      if (payment.paymongo_payment_intent_id) {
        const axios = require('axios');
        const response = await axios.get(
          `https://api.paymongo.com/v1/payment_intents/${payment.paymongo_payment_intent_id}`,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(paymongoService.secretKey).toString('base64')}`,
            },
          }
        );
        paymongoPayment = response.data.data;

        if (paymongoPayment.attributes.status === 'succeeded') {
          console.log(`Payment intent ${payment.paymongo_payment_intent_id} succeeded. Updating...`);
          
          const [markPaidResult] = await pool.query(
            "UPDATE payment_transactions SET status = 'paid', paid_at = NOW() WHERE id = ? AND status <> 'paid'",
            [payment.id]
          );

          if (markPaidResult.affectedRows === 0) {
            transitionLog("idempotent-concurrent-paid", payment, {
              intent_status: paymongoPayment.attributes.status,
            });
            return res.json({
              success: true,
              message: "Payment already confirmed",
              data: {
                reference_id: referenceId,
                status: 'paid',
                payment_type: payment.payment_type,
              },
            });
          }

          transitionLog("marked-paid", payment, {
            intent_status: paymongoPayment.attributes.status,
            trigger: "payment_intent",
          });

          if (payment.payment_type === 'subscription') {
            await activateSubscription(payment);
          } else if (payment.payment_type === 'order') {
            await updateOrder(payment);
          } else if (payment.payment_type === 'reservation') {
            await updateReservation(payment);
          }

          return res.json({
            success: true,
            message: "Payment confirmed and processed!",
            data: {
              reference_id: referenceId,
              status: 'paid',
              payment_type: payment.payment_type,
            },
          });
        } else {
          if (paymongoPayment.attributes.status === 'awaiting_payment_method' || paymongoPayment.attributes.status === 'awaiting_next_action') {
            await pool.query("UPDATE payment_transactions SET status = 'pending' WHERE id = ? AND status <> 'paid'", [payment.id]);
            transitionLog("marked-pending", payment, {
              intent_status: paymongoPayment.attributes.status,
              trigger: "payment_intent",
            });
          }
          return res.json({
            success: false,
            message: `Payment status: ${paymongoPayment.attributes.status}`,
            data: { status: paymongoPayment.attributes.status },
          });
        }
      }

      return res.status(400).json({
        success: false,
        message: "No PayMongo payment ID found for this transaction",
      });
    } catch (err) {
      console.error("PayMongo Check Error:", err.response?.data || err.message);
      return res.status(500).json({
        success: false,
        message: err.response?.data?.errors?.[0]?.detail || "Failed to check payment status",
      });
    }
  } catch (err) {
    console.error("PAYMENT CHECK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Activate subscription after payment confirmed
 */
async function activateSubscription(payment) {
  const [subs] = await pool.query(
    `SELECT s.*, sp.name AS plan_name, sp.max_bars, sp.billing_period
     FROM subscriptions s
     JOIN subscription_plans sp ON s.plan_id = sp.id
     WHERE s.id = ? LIMIT 1`,
    [payment.related_id]
  );

  if (!subs.length) {
    console.error(`Subscription ${payment.related_id} not found`);
    return;
  }

  const sub = subs[0];

  // Calculate expiry
  let expiresAt = null;
  if (sub.billing_period === 'monthly') {
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  } else if (sub.billing_period === 'yearly') {
    expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }

  // Cancel any existing active subscription
  await pool.query(
    "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE bar_owner_id = ? AND status = 'active' AND id != ?",
    [sub.bar_owner_id, sub.id]
  );

  // Activate this subscription
  await pool.query(
    "UPDATE subscriptions SET status = 'active', starts_at = NOW(), expires_at = ? WHERE id = ?",
    [expiresAt, sub.id]
  );

  // Update subscription payment
  await pool.query(
    "UPDATE subscription_payments SET status = 'paid', paid_at = NOW() WHERE subscription_id = ?",
    [sub.id]
  );

  // Update bar_owners tier
  await pool.query(
    "UPDATE bar_owners SET subscription_tier = ?, subscription_expires_at = ? WHERE id = ?",
    [sub.plan_name, expiresAt, sub.bar_owner_id]
  );

  // Unlock bars up to plan limit
  const [allBars] = await pool.query(
    "SELECT id FROM bars WHERE owner_id = ? ORDER BY created_at ASC",
    [sub.bar_owner_id]
  );
  for (let i = 0; i < allBars.length; i++) {
    const locked = i >= sub.max_bars ? 1 : 0;
    await pool.query("UPDATE bars SET is_locked = ? WHERE id = ?", [locked, allBars[i].id]);
  }

  console.log(`✅ Subscription ${sub.id} ACTIVATED for owner ${sub.bar_owner_id}`);
}

/**
 * Update order status
 */
async function updateOrder(payment) {
  await pool.query(
    "UPDATE pos_orders SET payment_status = 'paid', status = 'paid', completed_at = NOW() WHERE id = ? AND payment_status <> 'paid'",
    [payment.related_id]
  );
  await createPayout(payment);
  transitionLog("order-paid", payment);
  console.log(`✅ Order ${payment.related_id} marked as PAID`);
}

/**
 * Update reservation status
 */
async function updateReservation(payment) {
  const paidAmount = Number(payment.amount || 0);
  let newPaymentStatus = 'paid';
  let shouldDeductInventory = true;
  try {
    const [[existingReservation]] = await pool.query(
      `SELECT payment_status
       FROM reservations
       WHERE id = ?
       LIMIT 1`,
      [payment.related_id]
    );
    shouldDeductInventory = !['partial', 'paid'].includes(String(existingReservation?.payment_status || '').toLowerCase());
  } catch (_) {}
  try {
    let tableTotal = 0;
    try {
      const [[tableSumRow]] = await pool.query(
        `SELECT COALESCE(SUM(bt.price), 0) AS table_total
         FROM reservation_tables rt
         JOIN bar_tables bt ON bt.id = rt.table_id
         WHERE rt.reservation_id = ?`,
        [payment.related_id]
      );
      tableTotal = Number(tableSumRow?.table_total || 0);
    } catch (_) {}

    let itemsTotal = 0;
    try {
      const [[itemSumRow]] = await pool.query(
        `SELECT COALESCE(SUM(ri.quantity * ri.unit_price), 0) AS items_total
         FROM reservation_items ri
         WHERE ri.reservation_id = ?`,
        [payment.related_id]
      );
      itemsTotal = Number(itemSumRow?.items_total || 0);
    } catch (_) {}

    let totalAmount = tableTotal + itemsTotal;

    try {
      const [[pliSumRow]] = await pool.query(
        `SELECT COALESCE(SUM(line_total), 0) AS pli_total
         FROM payment_line_items
         WHERE payment_transaction_id = ?`,
        [payment.id]
      );
      totalAmount = Math.max(totalAmount, Number(pliSumRow?.pli_total || 0));
    } catch (_) {}

    newPaymentStatus = totalAmount > 0 && paidAmount < totalAmount ? 'partial' : 'paid';
  } catch (err) {
    console.error('PAYMENT_CHECK_UPDATE_RESERVATION_ERR:', err.message);
  }
  const storedPaymentStatus = await normalizeReservationPaymentStatusForStorage(pool, newPaymentStatus);
  await pool.query("UPDATE reservations SET payment_status = ?, status = 'confirmed', paid_at = NOW() WHERE id = ?", [storedPaymentStatus, payment.related_id]);
  if (shouldDeductInventory) {
    await deductInventoryForReservation(pool, payment.related_id, payment.id);
  }
  await createPayoutForPayment(pool, payment);
  transitionLog("reservation-confirmed", payment, { reservation_payment_status: newPaymentStatus });
  console.log(`✅ Reservation ${payment.related_id} marked as CONFIRMED (payment ${newPaymentStatus})`);
}

module.exports = router;
