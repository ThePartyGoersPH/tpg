const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const paymongoService = require("../services/paymongoService");
const platformSettings = require("../services/platformSettingsService");
const { createNotification } = require("../utils/notificationService");
const { decryptField } = require("../services/fieldEncryption");
const { promoteBarIfReady } = require("../services/barActivation");
const {
  deductInventoryForReservation,
  normalizeReservationPaymentStatusForStorage,
  isSettledDirectly,
  resolvePaymentKeyContext,
} = require("./payments");

// ═══════════════════════════════════════════════════════════════════════════
// PAYMONGO WEBHOOK HANDLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /paymongo-webhook — Handle PayMongo webhook events
 * This endpoint receives notifications from PayMongo when payment status changes
 */
// Express 5 / path-to-regexp v8 dropped the `:param?` optional syntax, so the
// optional bar id is registered as a second explicit route below instead.
const rawWebhookParser = express.raw({ type: 'application/json', limit: '1mb' });

const handlePayMongoWebhook = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const signature = req.headers['paymongo-signature'];

    // Best-effort parse BEFORE verification, used only to route this delivery
    // to the signing secret PayMongo would have used for it. It is strictly
    // read-only: nothing is written and nothing is dispatched until the
    // signature check below has passed. A malformed body therefore falls
    // through to the platform secret rather than short-circuiting the check.
    let event = null;
    let parseFailed = false;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch (_) {
      parseFailed = true;
    }

    // Resolve which secret is allowed. An optional `:barId` path segment (used
    // when we register the endpoint ourselves) identifies the bar without
    // touching the payload at all; otherwise the payment reference inside the
    // event is looked up locally.
    const routing = await resolveSignatureRouting(pool, req.params.barId, event);

    // A delivery we cannot verify must never be processed. Two ways to land
    // here, both misconfiguration on our side, so answer 503 (PayMongo will
    // retry once fixed) instead of a 401, which would look like a bad key:
    //   1. routing.reject     — this bar is live but stores no signing secret
    //   2. !secretConfigured  — no secret anywhere, not even the platform's
    //
    // This replaces a fail-OPEN branch that skipped verification entirely when
    // no secret was configured: anyone could then have posted a forged
    // payment.paid and had it processed.
    if (routing.reject) {
      console.error(
        `PAYMONGO_WEBHOOK_MISCONFIGURED: ${routing.reason}` +
          (routing.barId ? ` (bar ${routing.barId})` : '') +
          ' — delivery rejected until a signing secret is stored for this bar'
      );
      return res.status(503).json({
        success: false,
        code: 'WEBHOOK_MISCONFIGURED',
        message: 'Webhook signing secret not configured for this bar. Deliveries are paused until it is set.',
      });
    }
    if (!routing.secretConfigured) {
      console.error(
        'PAYMONGO_WEBHOOK_MISCONFIGURED: no webhook signing secret configured — ' +
        'rejecting delivery rather than processing an unverified event'
      );
      return res.status(503).json({
        success: false,
        code: 'WEBHOOK_MISCONFIGURED',
        message: 'Webhook signing secret not configured. Deliveries are paused until it is set.',
      });
    }

    // Verify the PayMongo signature. Without this, anyone who learns a src_/pay_
    // id (they are exposed through checkout_url and the history endpoints) can
    // forge a payment.paid event and get a reservation for free.
    const isValid = await paymongoService.verifyWebhookSignature(rawBody, signature, {
      secrets: routing.secrets,
      allowPlatform: false,
    });
    if (!isValid) {
      console.warn(
        `PAYMONGO_WEBHOOK_REJECTED: invalid signature (routed via ${routing.source}${routing.barId ? ` bar=${routing.barId}` : ''})`
      );
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }

    if (parseFailed) {
      console.error('Invalid webhook payload');
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    const eventId = event.data?.id;
    const eventType = event.data?.attributes?.type;
    
    if (!eventId || !eventType) {
      console.error('Missing event ID or type');
      return res.status(400).json({ success: false, message: 'Missing event data' });
    }

    // Check if event already processed
    const [existingEvents] = await pool.query(
      "SELECT id, processed FROM webhook_events WHERE event_id = ? LIMIT 1",
      [eventId]
    );

    if (existingEvents.length && existingEvents[0].processed) {
      console.log(`Webhook event ${eventId} already processed. Skipping.`);
      return res.json({ success: true, message: 'Event already processed' });
    }

    // Save webhook event
    const resourceType = event.data?.attributes?.data?.attributes?.type || 'unknown';
    const resourceId = event.data?.attributes?.data?.id || 'unknown';

    await pool.query(
      `INSERT INTO webhook_events (event_id, event_type, resource_type, resource_id, payload, processed)
       VALUES (?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE payload = VALUES(payload)`,
      [eventId, eventType, resourceType, resourceId, JSON.stringify(event)]
    );

    // Process based on event type
    let processingResult = { success: true, message: 'Webhook received' };

    switch (eventType) {
      case 'source.chargeable':
        processingResult = await handleSourceChargeable(event);
        break;
      
      case 'payment.paid':
        processingResult = await handlePaymentPaid(event);
        break;

      case 'checkout_session.payment.paid':
        processingResult = await handleCheckoutSessionPaid(event);
        break;

      case 'account.activated':
        processingResult = await handleChildAccountActivated(event);
        break;
      
      case 'payment.failed':
        processingResult = await handlePaymentFailed(event);
        break;
      
      default:
        console.log(`Unhandled event type: ${eventType}`);
        processingResult = { success: true, message: `Event type ${eventType} not handled` };
    }

    // Mark event as processed
    await pool.query(
      "UPDATE webhook_events SET processed = 1, processed_at = NOW(), error_message = ? WHERE event_id = ?",
      [processingResult.success ? null : processingResult.message, eventId]
    );

    return res.json({ success: true, message: 'Webhook processed', result: processingResult });
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Shared endpoint (legacy webhooks already registered with this URL) …
router.post("/", rawWebhookParser, handlePayMongoWebhook);
// … and the per-bar path we register ourselves, which identifies the owning
// bar before a single byte of the payload is looked at.
router.post("/:barId", rawWebhookParser, handlePayMongoWebhook);

/**
 * Collect the resource identifiers carried by an event so the local payment
 * row (and therefore the owning bar) can be found. Read-only.
 */
function collectResourceIds(event) {
  const ids = new Set();
  const push = (value) => {
    if (typeof value === 'string' && value) ids.add(value);
  };
  const data = event?.data?.attributes?.data;
  push(data?.id);
  push(data?.attributes?.source?.id);
  push(data?.attributes?.payment_intent?.id);
  push(data?.attributes?.checkout_session?.id);
  push(data?.attributes?.parent?.id);
  return [...ids].slice(0, 12);
}

/**
 * Which bar owns the payment this delivery refers to? Returns null when the
 * event cannot be tied to a local transaction (see resolveSignatureRouting).
 *
 * The ID set here is a SUPERSET of what every handler later queries
 * (source.chargeable → paymongo_source_id, payment.paid/failed →
 * paymongo_payment_id + source, checkout_session → paymongo_checkout_session_id),
 * so "no row found here" also means every handler would find no row. That is
 * what makes the fallback below safe: an event that cannot be routed cannot
 * act on anyone's payment.
 */
async function findDeliveringBarId(conn, event) {
  const ids = collectResourceIds(event);
  if (!ids.length) return null;
  try {
    const [rows] = await conn.query(
      `SELECT DISTINCT bar_id FROM payment_transactions
       WHERE bar_id IS NOT NULL AND (
         paymongo_source_id IN (?) OR paymongo_payment_id IN (?)
         OR paymongo_checkout_session_id IN (?) OR paymongo_payment_intent_id IN (?)
       )
       LIMIT 1`,
      [ids, ids, ids, ids]
    );
    return rows?.[0]?.bar_id || null;
  } catch (err) {
    console.error('WEBHOOK BAR ROUTING ERROR:', err.message);
    return null;
  }
}

/**
 * Decide which signing secrets are ACCEPTABLE for this delivery.
 *
 * This is the security boundary of the multi-tenant setup: the secret is
 * chosen from the payment's bar, never from "any secret we know". Accepting
 * every known secret would let a bar owner who knows their own whsk_ sign
 * payment.paid events for another bar's payments.
 *
 *  - routed to a bar with a stored secret → that secret ONLY (live/direct rail)
 *  - routed to a bar in test mode without one → platform secret (test rail)
 *  - routed to a LIVE bar without one        → REJECT. Falling back to the
 *    platform secret would turn it into a universal bypass: any delivery
 *    signed with it would be accepted for any live bar, and the bar's own
 *    real deliveries would be rejected anyway. Loud failure, not a quiet one.
 *  - not routable → platform secret; PayMongo retries deliveries, so once the
 *    local row exists the event routes correctly.
 */
async function resolveSignatureRouting(conn, barIdParam, event) {
  let barId = null;
  const fromPath = Number(barIdParam);
  if (Number.isInteger(fromPath) && fromPath > 0) {
    barId = fromPath;
  }
  if (!barId && event) {
    barId = await findDeliveringBarId(conn, event);
  }

  const platformSecret = await paymongoService.getWebhookSecret();

  if (barId) {
    try {
      const [[bar]] = await conn.query(
        'SELECT paymongo_webhook_secret, paymongo_mode FROM bars WHERE id = ? LIMIT 1',
        [barId]
      );
      if (bar?.paymongo_webhook_secret) {
        // Decrypted at the one moment it is needed — never stored in memory
        // beyond this request and never written to a log.
        const barSecret = decryptField(bar.paymongo_webhook_secret);
        if (barSecret) {
          return {
            barId,
            source: 'bar',
            secrets: [barSecret],
            secretConfigured: true,
          };
        }
        // Present but unreadable (wrong/missing PAYMONGO_FIELD_ENCRYPTION_KEY).
        // Reject rather than quietly dropping to the platform secret.
        console.error(
          `PAYMONGO_WEBHOOK_SECRET_UNREADABLE: bar=${barId} has a stored signing secret that could not be decrypted — ` +
          'check PAYMONGO_FIELD_ENCRYPTION_KEY'
        );
        return {
          barId,
          source: 'misconfigured',
          secrets: [],
          secretConfigured: true,
          reject: true,
          reason: 'bar_signing_secret_undecryptable',
        };
      }
      if (String(bar?.paymongo_mode || '').toLowerCase() === 'live') {
        // Explicit refusal + alert, exactly as required for a live bar with no
        // signing secret. No platform-secret fallback.
        return {
          barId,
          source: 'misconfigured',
          secrets: [],
          secretConfigured: true,
          reject: true,
          reason: 'bar_is_live_without_signing_secret',
        };
      }
    } catch (err) {
      console.error('WEBHOOK BAR SECRET LOOKUP ERROR:', err.message);
    }
  }

  return {
    barId,
    source: 'platform',
    secrets: platformSecret ? [platformSecret] : [],
    secretConfigured: Boolean(platformSecret),
  };
}

/**
 * Handle source.chargeable event (GCash/PayMaya payment approved)
 */
async function handleSourceChargeable(event) {
  try {
    const sourceId = event.data?.attributes?.data?.id;
    if (!sourceId) return { success: false, message: 'Missing source ID' };

    // Find payment transaction by source ID
    const [payments] = await pool.query(
      "SELECT * FROM payment_transactions WHERE paymongo_source_id = ? LIMIT 1",
      [sourceId]
    );

    if (!payments.length) {
      console.log(`No payment found for source ${sourceId}`);
      return { success: false, message: 'Payment not found' };
    }

    const payment = payments[0];

    // Create actual payment from source, using the same credentials the source
    // was created with (live owner-key rails must not fall back to test keys).
    const keyContext = await resolvePaymentKeyContext(pool, payment);
    const paymongoPayment = await paymongoService.attachSourceToPayment(sourceId, {
      amount: Math.round(Number(payment.amount || 0) * 100),
      description: `Payment for ${payment.payment_type} #${payment.related_id}`,
    }, keyContext.keyMode, keyContext.keyOverride);

    // Update payment transaction
    await pool.query(
      `UPDATE payment_transactions 
       SET paymongo_payment_id = ?, status = 'processing' 
       WHERE id = ?`,
      [paymongoPayment.id, payment.id]
    );

    return { success: true, message: 'Source attached to payment' };
  } catch (err) {
    console.error('Handle Source Chargeable Error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Handle checkout_session.payment.paid — marketplace split checkout (v1 sessions).
 * Maps the session back to our transaction, then runs the standard paid flow.
 */
async function handleCheckoutSessionPaid(event) {
  try {
    const session = event.data?.attributes?.data;
    const sessionId = session?.id;
    if (!sessionId) return { success: false, message: 'Missing checkout session ID' };

    const [payments] = await pool.query(
      "SELECT * FROM payment_transactions WHERE paymongo_checkout_session_id = ? LIMIT 1",
      [sessionId]
    );
    if (!payments.length) {
      console.log(`No payment found for checkout session ${sessionId}`);
      return { success: false, message: 'Payment not found' };
    }
    const payment = payments[0];

    await pool.query(
      `UPDATE payment_transactions SET status = 'paid', paid_at = NOW() WHERE id = ? AND status <> 'paid'`,
      [payment.id]
    );

    if (payment.payment_type === 'order') {
      await handleOrderPaymentPaid(payment);
    } else if (payment.payment_type === 'reservation') {
      await handleReservationPaymentPaid(payment);
    } else if (payment.payment_type === 'subscription') {
      await handleSubscriptionPaymentPaid(payment);
    }
    return { success: true, message: `Checkout session ${sessionId} marked as paid` };
  } catch (err) {
    console.error('Handle Checkout Session Paid Error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Handle account.activated — PayMongo Platforms child merchant went live.
 * Flips the linked bar to verified so it can publish/sell packages.
 *
 * This is the ONE place that reaches `paymongo_mode = 'live'` without a bar
 * owner in the loop, so it carries the same live-mode guard as the HTTP
 * endpoints. A webhook cannot answer 400/422 (PayMongo would retry forever),
 * therefore the misconfigured state is never entered at all: the bar is marked
 * verified, an alert is logged, the owner is notified to save a signing
 * secret, and the response still succeeds so PayMongo stops retrying.
 */
async function handleChildAccountActivated(event) {
  try {
    const data = event.data?.attributes?.data || {};
    const accountId = data.id || event.data?.attributes?.id || null;
    if (!accountId) return { success: false, message: 'Missing account ID' };

    const [[bar]] = await pool.query(
      `SELECT id, name, paymongo_webhook_secret, paymongo_live_secret_key
       FROM bars WHERE paymongo_child_merchant_id = ? LIMIT 1`,
      [String(accountId)]
    );
    if (!bar) {
      console.log(`account.activated for unknown child ${accountId}`);
      return { success: true, message: 'No linked bar' };
    }

    const hasSigningSecret = Boolean(bar.paymongo_webhook_secret);
    if (!hasSigningSecret) {
      console.error(
        `PAYMONGO_LIVE_BLOCKED_NO_WEBHOOK_SECRET: bar ${bar.id} (child ${accountId}) is verified by PayMongo but has ` +
        'no signing secret — verified without entering live mode'
      );
    }

    const [res] = await pool.query(
      `UPDATE bars
       SET paymongo_onboarding_status = 'verified', paymongo_onboarding_updated_at = NOW()
           ${hasSigningSecret ? ", paymongo_mode = 'live'" : ''}
       WHERE id = ?`,
      [bar.id]
    );
    if (!res.affectedRows) {
      console.log(`account.activated for unknown child ${accountId}`);
      return { success: true, message: 'No linked bar' };
    }

    const activation = await promoteBarIfReady(pool, bar.id);

    try {
      await createNotification({
        barId: bar.id,
        type: 'payout_account_verified',
        title: hasSigningSecret ? 'Live Mode activated' : 'PayMongo account verified',
        message: hasSigningSecret
          ? `${bar.name} is verified — Live Mode is now active and real payments can be accepted. Test labels have been removed from your packages.`
          : `${bar.name} is verified, but Live Mode is not on yet: save a webhook signing secret (whsk_…) in your payment settings to start accepting live payments.`,
        referenceType: 'bar',
        referenceId: bar.id,
        category: 'payout',
        action: 'navigate',
        targetRoute: '/packages',
      });
    } catch (_) {}
    return {
      success: true,
      message: hasSigningSecret
        ? `Bar ${bar.id} marked verified + live`
        : `Bar ${bar.id} marked verified; live mode withheld — no signing secret`,
      activation,
    };
  } catch (err) {
    console.error('Handle Child Activated Error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Handle payment.paid event (Payment successfully completed)
 */
async function handlePaymentPaid(event) {
  try {
    const paymentData = event.data?.attributes?.data;
    const paymongoPaymentId = paymentData?.id;
    const paymongoSourceId = paymentData?.attributes?.source?.id;

    if (!paymongoPaymentId && !paymongoSourceId) {
      return { success: false, message: 'Missing payment/source ID' };
    }

    // Find payment transaction
    const [payments] = await pool.query(
      `SELECT * FROM payment_transactions 
       WHERE paymongo_payment_id = ? OR paymongo_source_id = ?
       LIMIT 1`,
      [paymongoPaymentId, paymongoSourceId]
    );

    if (!payments.length) {
      console.log(`No payment found for PayMongo payment ${paymongoPaymentId}`);
      return { success: false, message: 'Payment not found' };
    }

    const payment = payments[0];

    // Update payment status to paid
    await pool.query(
      `UPDATE payment_transactions 
       SET status = 'paid', paid_at = NOW(), paymongo_payment_id = ?
       WHERE id = ? AND status <> 'paid'`,
      [paymongoPaymentId || payment.paymongo_payment_id, payment.id]
    );

    // Process based on payment type
    if (payment.payment_type === 'order') {
      await handleOrderPaymentPaid(payment);
    } else if (payment.payment_type === 'reservation') {
      await handleReservationPaymentPaid(payment);
    } else if (payment.payment_type === 'subscription') {
      await handleSubscriptionPaymentPaid(payment);
    }

    return { success: true, message: `Payment ${payment.reference_id} marked as paid` };
  } catch (err) {
    console.error('Handle Payment Paid Error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Handle payment.failed event — treated as 'cancelled' (user clicked Fail/Expire in test mode)
 */
async function handlePaymentFailed(event) {
  try {
    const paymentData = event.data?.attributes?.data;
    const paymongoPaymentId = paymentData?.id;
    const failedReason = paymentData?.attributes?.last_payment_error?.failed_message || 'Payment cancelled';

    const [payments] = await pool.query(
      "SELECT * FROM payment_transactions WHERE paymongo_payment_id = ? LIMIT 1",
      [paymongoPaymentId]
    );

    if (!payments.length) {
      return { success: false, message: 'Payment not found' };
    }

    const payment = payments[0];

    // Update payment status to cancelled
    await pool.query(
      "UPDATE payment_transactions SET status = 'cancelled', failed_reason = ? WHERE id = ?",
      [failedReason, payment.id]
    );

    // Update related records
    if (payment.payment_type === 'order') {
      await pool.query("UPDATE pos_orders SET payment_status = 'cancelled' WHERE id = ?", [payment.related_id]);
    } else if (payment.payment_type === 'reservation') {
      // Marketplace flow: keep the reservation open as Pending Payment so the
      // customer can retry — never auto-cancel the booking on payment failure.
      await pool.query(
        "UPDATE reservations SET payment_status = 'pending' WHERE id = ? AND status NOT IN ('confirmed','cancelled','completed','checked_in')",
        [payment.related_id]
      );
      try {
        const [[resv]] = await pool.query(
          "SELECT customer_user_id, bar_id FROM reservations WHERE id = ? LIMIT 1",
          [payment.related_id]
        );
        if (resv?.customer_user_id) {
          await createNotification({
            userIds: [resv.customer_user_id],
            type: 'reservation_payment_failed',
            title: 'Payment failed',
            message: `Your payment of ₱${Number(payment.amount || 0).toLocaleString()} didn't go through. Your reservation is kept as Pending Payment — please try again.`,
            referenceType: 'reservation',
            referenceId: payment.related_id,
            category: 'reservation',
            action: 'navigate',
            targetRoute: '/reservations',
          });
        }
      } catch (_) {}
    } else if (payment.payment_type === 'subscription') {
      await pool.query("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?", [payment.related_id]);
      await pool.query("UPDATE subscription_payments SET status = 'cancelled' WHERE subscription_id = ?", [payment.related_id]);
    }

    return { success: true, message: 'Payment marked as cancelled' };
  } catch (err) {
    console.error('Handle Payment Failed Error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Process paid order
 */
async function handleOrderPaymentPaid(payment) {
  await pool.query(
    "UPDATE pos_orders SET payment_status = 'paid', status = 'paid', completed_at = NOW() WHERE id = ?",
    [payment.related_id]
  );

  // Create payout record
  await createPayout(payment);
}

/**
 * Process paid reservation
 */
async function handleReservationPaymentPaid(payment) {
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

    let computedTotal = tableTotal + itemsTotal;

    try {
      const [[pliSumRow]] = await pool.query(
        `SELECT COALESCE(SUM(line_total), 0) AS pli_total
         FROM payment_line_items
         WHERE payment_transaction_id = ?`,
        [payment.id]
      );
      computedTotal = Math.max(computedTotal, Number(pliSumRow?.pli_total || 0));
    } catch (_) {}

    let depositAmount = 0;
    try {
      const [[resRow]] = await pool.query(
        `SELECT deposit_amount FROM reservations WHERE id = ? LIMIT 1`,
        [payment.related_id]
      );
      depositAmount = Number(resRow?.deposit_amount || 0);
    } catch (_) {}

    const targetTotal = computedTotal > 0 ? computedTotal : depositAmount;
    newPaymentStatus = targetTotal > 0 && paidAmount < targetTotal ? 'partial' : 'paid';
  } catch (err) {
    console.error('HANDLE_RESERVATION_PAYMENT_PAID_ERR:', err.message);
  }

  const storedPaymentStatus = await normalizeReservationPaymentStatusForStorage(pool, newPaymentStatus);

  await pool.query(
    "UPDATE reservations SET payment_status = ?, status = 'confirmed', paid_at = NOW() WHERE id = ?",
    [storedPaymentStatus, payment.related_id]
  );

  if (shouldDeductInventory) {
    await deductInventoryForReservation(pool, payment.related_id, payment.id);
  }

  // Notify customer + bar team ( Paid / Down Payment Received )
  try {
    const [[resv]] = await pool.query(
      `SELECT r.customer_user_id, r.bar_id, b.name AS bar_name
       FROM reservations r LEFT JOIN bars b ON b.id = r.bar_id
       WHERE r.id = ? LIMIT 1`,
      [payment.related_id]
    );
    const label = newPaymentStatus === 'partial' ? 'Down Payment Received' : 'Paid';
    if (resv?.customer_user_id) {
      await createNotification({
        userIds: [resv.customer_user_id],
        type: 'reservation_payment_paid',
        title: `Reservation ${label}`,
        message: `Your payment of ₱${paidAmount.toLocaleString()} for ${resv.bar_name || 'your reservation'} is confirmed (${label}).`,
        referenceType: 'reservation',
        referenceId: payment.related_id,
        category: 'reservation',
        action: 'navigate',
        targetRoute: '/reservations',
      });
    }
    if (resv?.bar_id) {
      await createNotification({
        barId: resv.bar_id,
        type: 'reservation_payment_received',
        title: `Payment received (${label})`,
        message: isSettledDirectly(payment)
          ? `₱${paidAmount.toLocaleString()} confirmed for reservation #${payment.related_id}. Funds settle directly to your account — no platform payout is queued.`
          : `₱${paidAmount.toLocaleString()} confirmed for reservation #${payment.related_id}. Payout will be released by the platform.`,
        referenceType: 'reservation',
        referenceId: payment.related_id,
        category: 'reservation',
        action: 'navigate',
        targetRoute: '/reservations',
        excludeUserId: resv.customer_user_id,
      });
    }
  } catch (_) {}

  // Create payout record
  await createPayout(payment);
}

/**
 * Process paid subscription - activate it
 */
async function handleSubscriptionPaymentPaid(payment) {
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

  console.log(`Subscription ${sub.id} activated for owner ${sub.bar_owner_id}`);
}

/**
 * Create payout record for bar owner.
 *
 * Only for payments the platform actually collected. On direct rails (the
 * bar's own PayMongo keys, a PayMongo child-merchant split, or a Stripe
 * Connect destination charge) the provider already paid the bar owner, so a
 * payout row would pay them twice.
 */
async function createPayout(payment) {
  if (!payment.bar_id) return;
  if (isSettledDirectly(payment)) return;

  const [existingPayout] = await pool.query(
    "SELECT id FROM payouts WHERE payment_transaction_id = ? LIMIT 1",
    [payment.id]
  );
  if (existingPayout.length) return;

  // Get bar GCash details + payout kill switch
  const [bars] = await pool.query(
    "SELECT gcash_number, gcash_account_name, payout_enabled FROM bars WHERE id = ? LIMIT 1",
    [payment.bar_id]
  );
  if (!bars.length) return;
  if (Number(bars[0].payout_enabled || 0) !== 1) {
    console.warn(`PAYOUT_SKIPPED bar=${payment.bar_id} payment=${payment.id}: payouts disabled for this bar`);
    return;
  }

  const feePercentage = await platformSettings.getPlatformFeePercentage(pool);

  const grossAmount = parseFloat(payment.amount);
  const platformFeeAmount = (grossAmount * feePercentage) / 100;
  const netAmount = grossAmount - platformFeeAmount;

  const gcashNumber = bars[0].gcash_number;
  const gcashAccountName = bars[0].gcash_account_name;

  const [ownerRows] = await pool.query(
    `SELECT bo.id AS owner_id
     FROM bars b
     LEFT JOIN bar_owners bo ON bo.id = b.owner_id
     WHERE b.id = ?
     LIMIT 1`,
    [payment.bar_id]
  );

  try {
    await pool.query(
      `INSERT INTO payouts 
       (bar_id, bar_owner_id, payment_transaction_id, order_id, reservation_id, gross_amount, 
        platform_fee, platform_fee_amount, net_amount, status, payout_method, 
        gcash_number, gcash_account_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'gcash', ?, ?)`,
      [
        payment.bar_id,
        ownerRows[0]?.owner_id || null,
        payment.id,
        payment.payment_type === 'order' ? payment.related_id : null,
        payment.payment_type === 'reservation' ? payment.related_id : null,
        grossAmount,
        feePercentage,
        platformFeeAmount,
        netAmount,
        gcashNumber,
        gcashAccountName,
      ]
    );
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return;
    throw err;
  }
}

module.exports = router;
// Reused by the Stripe Connect webhook (same reservation/order/subscription
// settlement + notifications, different provider rail).
module.exports.handleOrderPaymentPaid = handleOrderPaymentPaid;
module.exports.handleReservationPaymentPaid = handleReservationPaymentPaid;
module.exports.handleSubscriptionPaymentPaid = handleSubscriptionPaymentPaid;
