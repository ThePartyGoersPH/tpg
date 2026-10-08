const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const paymongoService = require("../services/paymongoService");
const { logAudit, auditContext } = require("../utils/audit");

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PAYMENT ENDPOINTS (Bar Owner Subscription with PayMongo)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /subscription-payments/subscribe — Create/upgrade subscription with PayMongo payment
 * Body: { plan_id, payment_method }
 */
router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    const { plan_id, payment_method } = req.body;
    const userId = req.user.id;

    if (!plan_id) {
      return res.status(400).json({ success: false, message: "Plan ID required" });
    }
    if (!payment_method || !['gcash', 'paymaya', 'card'].includes(payment_method)) {
      return res.status(400).json({ success: false, message: "Invalid payment_method. Use 'gcash', 'paymaya', or 'card'." });
    }

    // Get plan details
    const [plans] = await pool.query(
      "SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1",
      [plan_id]
    );
    if (!plans.length) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }
    const plan = plans[0];

    // Get bar owner
    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) {
      return res.status(404).json({ success: false, message: "Bar owner not found" });
    }
    const ownerId = owners[0].id;

    // Cancel any existing pending subscription (replace with new request)
    await pool.query(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE bar_owner_id = ? AND status = 'pending'",
      [ownerId]
    );

    // Generate reference ID
    const referenceId = paymongoService.generateReferenceId('SUB');

    // Create PayMongo source/payment for subscription
    let checkoutUrl = null;
    let paymongoSourceId = null;
    let paymongoPaymentIntentId = null;

    try {
      if (payment_method === 'gcash' || payment_method === 'paymaya') {
        // PayMongo uses 'grab_pay' for PayMaya
        const sourceType = payment_method === 'paymaya' ? 'grab_pay' : payment_method;
        const source = await paymongoService.createSource(plan.price, sourceType, {
          description: `${plan.display_name} Subscription - ${plan.billing_period}`,
          success_url: `${process.env.BAR_OWNER_APP_URL || 'https://baroperations.thepartygoers.fun'}/subscription/success?ref=${referenceId}`,
          failed_url: `${process.env.BAR_OWNER_APP_URL || 'https://baroperations.thepartygoers.fun'}/subscription/failed?ref=${referenceId}`,
        });
        checkoutUrl = source.attributes.redirect.checkout_url;
        paymongoSourceId = source.id;
      } else if (payment_method === 'card') {
        const intent = await paymongoService.createPaymentIntent(plan.price, {
          description: `${plan.display_name} Subscription - ${plan.billing_period}`,
        });
        paymongoPaymentIntentId = intent.id;
        checkoutUrl = intent.attributes.next_action?.redirect?.url || null;
      }
    } catch (err) {
      console.error('PayMongo Subscription Payment Error:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }

    // Create subscription with status = 'pending' (awaits payment confirmation)
    const [subResult] = await pool.query(
      `INSERT INTO subscriptions 
       (bar_owner_id, plan_id, status, starts_at, expires_at, payment_method, payment_reference, 
        amount_paid, paymongo_payment_id, paymongo_source_id, checkout_url)
       VALUES (?, ?, 'pending', NOW(), NULL, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        plan_id,
        payment_method,
        referenceId,
        plan.price,
        paymongoPaymentIntentId,
        paymongoSourceId,
        checkoutUrl,
      ]
    );

    const subscriptionId = subResult.insertId;

    // Create payment transaction
    const [paymentResult] = await pool.query(
      `INSERT INTO payment_transactions 
       (reference_id, payment_type, related_id, user_id, amount, status, payment_method, 
        paymongo_payment_intent_id, paymongo_source_id, checkout_url, metadata)
       VALUES (?, 'subscription', ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        referenceId,
        subscriptionId,
        userId,
        plan.price,
        payment_method,
        paymongoPaymentIntentId,
        paymongoSourceId,
        checkoutUrl,
        JSON.stringify({ plan_name: plan.name, plan_display_name: plan.display_name }),
      ]
    );

    const paymentTransactionId = paymentResult.insertId;

    // Create subscription payment record
    await pool.query(
      `INSERT INTO subscription_payments 
       (subscription_id, payment_transaction_id, amount, status, paymongo_payment_id)
       VALUES (?, ?, ?, 'pending', ?)`,
      [subscriptionId, paymentTransactionId, plan.price, paymongoSourceId || paymongoPaymentIntentId]
    );

    logAudit(null, {
      bar_id: null,
      user_id: userId,
      action: "CREATE_SUBSCRIPTION_PAYMENT",
      entity: "subscriptions",
      entity_id: subscriptionId,
      details: { plan_id, plan_name: plan.name, amount: plan.price, payment_method },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: `${plan.display_name} subscription created! Please complete the payment.`,
      data: {
        subscription_id: subscriptionId,
        payment_reference: referenceId,
        checkout_url: checkoutUrl,
        plan: plan.name,
        amount: plan.price,
        status: "pending",
      },
    });
  } catch (err) {
    console.error("SUBSCRIPTION PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /subscription-payments/renew — Renew existing subscription with PayMongo
 */
router.post("/renew", requireAuth, async (req, res) => {
  try {
    const { payment_method } = req.body;
    const userId = req.user.id;

    if (!payment_method || !['gcash', 'paymaya', 'card'].includes(payment_method)) {
      return res.status(400).json({ success: false, message: "Invalid payment_method" });
    }

    // Get bar owner
    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) {
      return res.status(404).json({ success: false, message: "Bar owner not found" });
    }
    const ownerId = owners[0].id;

    // Get current active or expired subscription
    const [subs] = await pool.query(
      `SELECT s.*, sp.name AS plan_name, sp.display_name, sp.price, sp.billing_period, sp.max_bars
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.bar_owner_id = ? AND s.status IN ('active', 'expired')
       ORDER BY s.created_at DESC LIMIT 1`,
      [ownerId]
    );

    if (!subs.length) {
      return res.status(404).json({ success: false, message: "No subscription found to renew" });
    }

    const currentSub = subs[0];
    const plan_id = currentSub.plan_id;
    const amount = currentSub.price;

    // Create new subscription with same plan
    const referenceId = paymongoService.generateReferenceId('RENEW');

    let checkoutUrl = null;
    let paymongoSourceId = null;
    let paymongoPaymentIntentId = null;

    try {
      if (payment_method === 'gcash' || payment_method === 'paymaya') {
        const source = await paymongoService.createSource(amount, payment_method, {
          description: `Renew ${currentSub.display_name} Subscription`,
          success_url: `${process.env.BAR_OWNER_APP_URL || 'https://baroperations.thepartygoers.fun'}/subscription/success?ref=${referenceId}`,
          failed_url: `${process.env.BAR_OWNER_APP_URL || 'https://baroperations.thepartygoers.fun'}/subscription/failed?ref=${referenceId}`,
        });
        checkoutUrl = source.attributes.redirect.checkout_url;
        paymongoSourceId = source.id;
      } else if (payment_method === 'card') {
        const intent = await paymongoService.createPaymentIntent(amount, {
          description: `Renew ${currentSub.display_name} Subscription`,
        });
        paymongoPaymentIntentId = intent.id;
        checkoutUrl = intent.attributes.next_action?.redirect?.url || null;
      }
    } catch (err) {
      console.error('PayMongo Renewal Payment Error:', err.message);
      return res.status(500).json({ success: false, message: err.message });
    }

    // Create new subscription record for renewal
    const [subResult] = await pool.query(
      `INSERT INTO subscriptions 
       (bar_owner_id, plan_id, status, starts_at, expires_at, payment_method, payment_reference, 
        amount_paid, paymongo_payment_id, paymongo_source_id, checkout_url)
       VALUES (?, ?, 'pending', NOW(), NULL, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        plan_id,
        payment_method,
        referenceId,
        amount,
        paymongoPaymentIntentId,
        paymongoSourceId,
        checkoutUrl,
      ]
    );

    const subscriptionId = subResult.insertId;

    // Create payment transaction
    const [paymentResult] = await pool.query(
      `INSERT INTO payment_transactions 
       (reference_id, payment_type, related_id, user_id, amount, status, payment_method, 
        paymongo_payment_intent_id, paymongo_source_id, checkout_url, metadata)
       VALUES (?, 'subscription', ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [
        referenceId,
        subscriptionId,
        userId,
        amount,
        payment_method,
        paymongoPaymentIntentId,
        paymongoSourceId,
        checkoutUrl,
        JSON.stringify({ action: 'renew', plan_name: currentSub.plan_name }),
      ]
    );

    const paymentTransactionId = paymentResult.insertId;

    // Create subscription payment record
    await pool.query(
      `INSERT INTO subscription_payments 
       (subscription_id, payment_transaction_id, amount, status, paymongo_payment_id)
       VALUES (?, ?, ?, 'pending', ?)`,
      [subscriptionId, paymentTransactionId, amount, paymongoSourceId || paymongoPaymentIntentId]
    );

    return res.json({
      success: true,
      message: "Subscription renewal initiated. Please complete the payment.",
      data: {
        subscription_id: subscriptionId,
        payment_reference: referenceId,
        checkout_url: checkoutUrl,
        amount,
      },
    });
  } catch (err) {
    console.error("RENEW SUBSCRIPTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /subscription-payments/status/:reference — Check subscription payment status
 */
router.get("/status/:reference", requireAuth, async (req, res) => {
  try {
    const { reference } = req.params;
    const userId = req.user.id;

    const [payments] = await pool.query(
      `SELECT pt.id, pt.reference_id, pt.status, pt.amount, pt.paid_at, pt.checkout_url,
              s.id AS subscription_id, s.status AS subscription_status,
              sp.name AS plan_name, sp.display_name
       FROM payment_transactions pt
       JOIN subscriptions s ON pt.related_id = s.id AND pt.payment_type = 'subscription'
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE pt.reference_id = ? AND pt.user_id = ?
       LIMIT 1`,
      [reference, userId]
    );

    if (!payments.length) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    return res.json({ success: true, data: payments[0] });
  } catch (err) {
    console.error("GET SUBSCRIPTION PAYMENT STATUS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
