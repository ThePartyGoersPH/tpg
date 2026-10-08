const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const paymongoService = require("../services/paymongoService");
const stripeService = require("../services/stripeService");
const { logAudit, auditContext } = require("../utils/audit");
const { encryptField } = require("../services/fieldEncryption");
const { promoteBarIfReady, evaluateBarActivation } = require("../services/barActivation");
const { loadPaymentReadiness } = require("../services/paymentReadiness");

/**
 * Existence-only read of the per-bar signing secret. Deliberately returns a
 * boolean so the secret can never end up on a response object by accident —
 * both ciphertext and legacy plaintext are truthy, so no decryption needed.
 */
async function hasStoredWebhookSecret(barId) {
  try {
    const [[row]] = await pool.query(
      "SELECT paymongo_webhook_secret FROM bars WHERE id = ? LIMIT 1",
      [barId]
    );
    return Boolean(row?.paymongo_webhook_secret);
  } catch (err) {
    console.error("WEBHOOK SECRET LOOKUP ERROR:", err.message);
    return false;
  }
}

async function getOwnBar(req) {
  const barId = req.user.bar_id;
  if (!barId) return { error: "No bar_id on account" };
  const [[bar]] = await pool.query(
    `SELECT b.id, b.name, b.owner_id, b.paymongo_child_merchant_id, b.paymongo_onboarding_status,
            b.paymongo_onboarding_ref, b.paymongo_onboarding_updated_at,
            b.paymongo_mode, b.paymongo_test_connected, b.paymongo_test_connected_at,
            b.stripe_account_id, b.stripe_onboarding_status, b.stripe_onboarding_updated_at,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS owner_name
     FROM bars b
     LEFT JOIN bar_owners bo ON bo.id = b.owner_id
     LEFT JOIN users u ON u.id = bo.user_id
     WHERE b.id = ? LIMIT 1`,
    [barId]
  );
  if (!bar) return { error: "Bar not found" };
  return { bar };
}

function sellGate({ paymongo, stripe, mode, testConnected }) {
  // Sellable when: Stripe-Connect-active, OR live-mode PayMongo-verified,
  // OR test-mode test-connected. Legacy (no enforcement flags) stays sellable.
  const stripeOk = stripe.testMode && stripe.status === 'active';
  const liveOk = paymongo.enabled && mode === 'live' && paymongo.status === 'verified';
  const testOk = mode === 'test' && Boolean(testConnected);
  const anyEnforcement = paymongo.enabled || stripe.testMode;
  return { can_sell: !anyEnforcement || stripeOk || liveOk || testOk, stripeOk, liveOk, testOk };
}

// GET /marketplace/bar/payments-onboarding — status + requirements
router.get(
  "/bar/payments-onboarding",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });

      const platform = await paymongoService.loadPlatformSettings();
      const stripeCfg = await stripeService.loadSettings();
      let requirements = null;
      if (bar.paymongo_child_merchant_id) {
        try {
          requirements = await paymongoService.getChildMerchantRequirements(bar.paymongo_child_merchant_id);
        } catch (e) {
          requirements = { error: e.message };
        }
      }

      const gate = sellGate({
        paymongo: { enabled: platform.enabled, status: bar.paymongo_onboarding_status },
        stripe: { testMode: stripeCfg.testMode, status: bar.stripe_onboarding_status },
        mode: bar.paymongo_mode || 'test',
        testConnected: bar.paymongo_test_connected,
      });

      // Drives the "pending — finish payment setup" indicator in the manager
      // portal. Purely informational: it never promotes the bar by itself.
      const activation = await evaluateBarActivation(pool, bar.id);

      return res.json({
        success: true,
        data: {
          bar_id: bar.id,
          owner_name: bar.owner_name || null,
          paymongo_mode: bar.paymongo_mode || 'test',
          paymongo_test_connected: Boolean(bar.paymongo_test_connected),
          paymongo_test_connected_at: bar.paymongo_test_connected_at,
          child_merchant_id: bar.paymongo_child_merchant_id,
          onboarding_status: bar.paymongo_onboarding_status || 'not_started',
          onboarding_ref: bar.paymongo_onboarding_ref,
          updated_at: bar.paymongo_onboarding_updated_at,
          requirements,
          platforms_enabled: platform.enabled,
          platform_fee_percentage: platform.feePercentage,
          webhook_secret_stored: await hasStoredWebhookSecret(bar.id),
          activation: {
            status: activation.status,
            ready: activation.ready,
            reason: activation.reason,
            needs_payment_setup: activation.status === 'pending' && !activation.ready,
          },
          stripe: {
            test_mode: stripeCfg.testMode,
            account_id: bar.stripe_account_id,
            onboarding_status: bar.stripe_onboarding_status || 'incomplete',
            updated_at: bar.stripe_onboarding_updated_at,
            fee_percentage: stripeCfg.feePercentage,
            publishable_key: stripeCfg.publishableKey || null,
          },
          can_sell: gate.can_sell,
          // Presence-only: drives the owner-facing "your menu is hidden"
          // banner. Never carries a key, only a boolean.
          payments_ready: await loadPaymentReadiness(bar.id),
        },
      });
    } catch (err) {
      console.error("MARKETPLACE STATUS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /marketplace/bar/payments-onboarding — start child merchant onboarding
// Body: { business_type?: 'individual'|'sole_proprietor'|'partnership'|'corporation' }
router.post(
  "/bar/payments-onboarding",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });

      if (bar.paymongo_onboarding_status === 'verified') {
        return res.json({ success: true, message: "Already verified", data: { child_merchant_id: bar.paymongo_child_merchant_id } });
      }

      // Retry-safe: an in-flight verification reuses the existing child
      // merchant instead of creating a duplicate on every attempt.
      if (bar.paymongo_child_merchant_id && bar.paymongo_onboarding_status === 'pending') {
        return res.json({
          success: true, already_started: true,
          message: "Verification already in progress for this business. Complete it in your PayMongo dashboard — we'll notify you once approved.",
          data: { child_merchant_id: bar.paymongo_child_merchant_id, onboarding_status: 'pending' },
        });
      }

      const businessType = String(req.body?.business_type || 'sole_proprietor');
      if (!['individual', 'sole_proprietor', 'partnership', 'corporation'].includes(businessType)) {
        return res.status(400).json({ success: false, message: "Invalid business_type" });
      }

      let child;
      try {
        child = await paymongoService.createChildMerchant({
          tradeName: bar.name,
          businessType,
          features: ['payment_gateway'],
          acceptedTerms: true,
        });
      } catch (e) {
        // Our platform isn't approved for Platforms/Payment Splitting yet
        // (manual PayMongo support activation) or live keys are missing — so
        // ANY child-create failure means the same thing to the bar owner.
        // Friendlier one-time message; technical detail preserved for support.
        console.error('MARKETPLACE CHILD-CREATE FAILED:', {
          bar_id: bar.id, detail: e.message,
        });
        return res.status(502).json({
          success: false,
          code: 'PLATFORM_NOT_ACTIVATED',
          message: "Live payouts aren't available yet — our platform is finishing setup with PayMongo. We'll notify you once this is ready.",
          detail: e.message,
        });
      }

      const childId = child?.id || null;
      await pool.query(
        `UPDATE bars
         SET paymongo_child_merchant_id = ?, paymongo_onboarding_status = 'pending',
             paymongo_onboarding_ref = ?, paymongo_onboarding_updated_at = NOW()
         WHERE id = ?`,
        [childId, childId, bar.id]
      );

      logAudit(null, {
        bar_id: bar.id,
        user_id: req.user.id,
        action: "MARKETPLACE_ONBOARDING_STARTED",
        entity: "bars",
        entity_id: bar.id,
        details: { child_merchant_id: childId, business_type: businessType },
        ...auditContext(req),
      });

      return res.status(201).json({
        success: true,
        message: "Onboarding started. Complete identity verification with PayMongo to get verified.",
        data: { child_merchant_id: childId, onboarding_status: 'pending' },
      });
    } catch (err) {
      console.error("MARKETPLACE ONBOARD ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /marketplace/bar/payments-onboarding/invite — email-invite path
// Body: { email }
router.post(
  "/bar/payments-onboarding/invite",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });

      const email = String(req.body?.email || '').trim();
      if (!email) return res.status(400).json({ success: false, message: "Email is required" });

      let invite;
      try {
        invite = await paymongoService.inviteChildMerchant(email);
      } catch (e) {
        return res.status(502).json({ success: false, message: "Invite failed", detail: e.message });
      }

      await pool.query(
        `UPDATE bars
         SET paymongo_onboarding_status = 'pending', paymongo_onboarding_ref = ?,
             paymongo_onboarding_updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(invite)?.slice(0, 128), bar.id]
      );

      return res.status(201).json({ success: true, message: "Invite sent. The owner completes signup via PayMongo.", data: invite });
    } catch (err) {
      console.error("MARKETPLACE INVITE ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /marketplace/bar/stripe-onboarding — create Express account + hosted link
// Body: { email? } (defaults to the owner's account email)
router.post(
  "/bar/stripe-onboarding",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });

      if (bar.stripe_onboarding_status === 'active' && bar.stripe_account_id) {
        const link = await stripeService.createAccountLink({ accountId: bar.stripe_account_id }).catch(() => null);
        return res.json({
          success: true, message: "Already active",
          data: { account_id: bar.stripe_account_id, onboarding_status: 'active', login_link: link?.url || null },
        });
      }

      let email = String(req.body?.email || '').trim();
      if (!email) {
        const [[u]] = await pool.query("SELECT email FROM users WHERE id = ? LIMIT 1", [req.user.id]);
        email = String(u?.email || '').trim();
      }

      let accountId = bar.stripe_account_id;
      if (!accountId) {
        let account;
        try {
          account = await stripeService.createExpressAccount({ email: email || undefined, businessName: bar.name });
        } catch (e) {
          return res.status(502).json({
            success: false,
            message: "Stripe onboarding failed. Check STRIPE_SECRET_KEY (test key, sk_test_...).",
            detail: e.message,
          });
        }
        accountId = account.id;
        await pool.query(
          `UPDATE bars SET stripe_account_id = ?, stripe_onboarding_status = 'incomplete',
                  stripe_onboarding_updated_at = NOW() WHERE id = ?`,
          [accountId, bar.id]
        );
      }

      let link;
      try {
        link = await stripeService.createAccountLink({ accountId });
      } catch (e) {
        return res.status(502).json({ success: false, message: "Could not create onboarding link", detail: e.message });
      }

      logAudit(null, {
        bar_id: bar.id, user_id: req.user.id,
        action: "STRIPE_ONBOARDING_STARTED", entity: "bars", entity_id: bar.id,
        details: { account_id: accountId }, ...auditContext(req),
      });

      return res.status(201).json({
        success: true,
        message: "Opening Stripe's test onboarding — no real documents needed.",
        data: { account_id: accountId, onboarding_status: 'incomplete', onboarding_url: link.url },
      });
    } catch (err) {
      console.error("STRIPE ONBOARD ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /marketplace/bar/stripe-onboarding/refresh — pull live readiness
router.post(
  "/bar/stripe-onboarding/refresh",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });
      if (!bar.stripe_account_id) {
        return res.status(400).json({ success: false, message: "No Stripe account yet — start onboarding first." });
      }
      let status;
      try {
        status = await stripeService.getAccountStatus(bar.stripe_account_id);
      } catch (e) {
        return res.status(502).json({ success: false, message: "Could not reach Stripe", detail: e.message });
      }
      await pool.query(
        `UPDATE bars SET stripe_onboarding_status = ?, stripe_onboarding_updated_at = NOW() WHERE id = ?`,
        [status.status, bar.id]
      );
      return res.json({
        success: true,
        data: {
          account_id: bar.stripe_account_id,
          onboarding_status: status.status,
          charges_enabled: status.charges_enabled,
          payouts_enabled: status.payouts_enabled,
          details_submitted: status.details_submitted,
          can_sell: status.status === 'active',
        },
      });
    } catch (err) {
      console.error("STRIPE REFRESH ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /marketplace/bar/payments-mode — switch Test <-> Live
// Body: { mode: 'test' | 'live' }
// Live requires a verified child merchant (else 403 Verification Pending) AND a
// stored per-bar webhook signing secret (else 422): without it every delivery
// from the bar's own PayMongo account fails signature verification, so
// switching would produce a live mode that cannot confirm a single payment.
router.post(
  "/bar/payments-mode",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });

      const mode = String(req.body?.mode || '').toLowerCase();
      if (!['test', 'live'].includes(mode)) {
        return res.status(400).json({ success: false, message: "mode must be 'test' or 'live'" });
      }
      if (mode === 'live') {
        const verified = bar.paymongo_child_merchant_id && bar.paymongo_onboarding_status === 'verified';
        if (!verified) {
          return res.status(403).json({
            success: false, code: 'LIVE_VERIFICATION_PENDING',
            message: "Live Mode — Verification Pending. Complete PayMongo child-merchant verification first.",
          });
        }
        if (!(await hasStoredWebhookSecret(bar.id))) {
          console.error(
            `PAYMONGO_LIVE_BLOCKED_NO_WEBHOOK_SECRET: bar ${bar.id} tried to enter live mode without a stored signing secret`
          );
          return res.status(422).json({
            success: false, code: 'LIVE_WEBHOOK_SECRET_REQUIRED',
            message:
              "Live Mode needs a webhook signing secret (whsk_…) for this bar, otherwise every payment " +
              "notification will be rejected. Use Payments → Connect Live to register the endpoint, or paste " +
              "the signing secret from your PayMongo Dashboard.",
          });
        }
      }

      await pool.query("UPDATE bars SET paymongo_mode = ? WHERE id = ?", [mode, bar.id]);
      logAudit(null, {
        bar_id: bar.id, user_id: req.user.id,
        action: "PAYMENTS_MODE_SWITCHED", entity: "bars", entity_id: bar.id,
        details: { from: bar.paymongo_mode, to: mode }, ...auditContext(req),
      });
      const activation = await promoteBarIfReady(pool, bar.id);
      return res.json({
        success: true,
        message: mode === 'live' ? "Live Mode active." : "Test Mode active.",
        data: { paymongo_mode: mode, activation },
      });
    } catch (err) {
      console.error("PAYMENTS MODE ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /marketplace/bar/payments-test-connect — real test-mode handshake.
// Body: { test_secret_key: 'sk_test_…' }
// Runs the same harmless create+cancel round-trip as the live connection
// against the OWNER's own test credentials. The flag is only set when PayMongo
// itself accepted the key; on failure nothing is written.
// The key is validated and then discarded — test charges keep using the
// platform's test keys, so this changes nothing about where money goes.
router.post(
  "/bar/payments-test-connect",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });

      const testSecret = String(req.body?.test_secret_key || '').trim();
      if (!testSecret) {
        return res.status(400).json({
          success: false,
          message: "Paste your PayMongo test secret key (sk_test_…) to verify the connection.",
        });
      }

      try {
        await paymongoService.validateOwnerKeys(testSecret, 'test');
      } catch (e) {
        return res.status(422).json({
          success: false,
          message: "We couldn't verify these PayMongo test credentials. Please check and try again.",
          detail: e.message,
        });
      }

      await pool.query(
        `UPDATE bars SET paymongo_test_connected = 1, paymongo_test_connected_at = NOW() WHERE id = ?`,
        [bar.id]
      );
      logAudit(null, {
        bar_id: bar.id, user_id: req.user.id,
        action: "PAYMENTS_TEST_CONNECTED", entity: "bars", entity_id: bar.id,
        // The key itself is never stored, so it can never leak through audit.
        details: { key_validated: true, key_kind: 'sk_test' }, ...auditContext(req),
      });
      const activation = await promoteBarIfReady(pool, bar.id);
      return res.json({
        success: true,
        message: "Test Mode connected. Transactions will use PayMongo test keys (no real money).",
        data: {
          paymongo_mode: bar.paymongo_mode || 'test',
          paymongo_test_connected: true,
          key_validated: true,
          activation,
        },
      });
    } catch (err) {
      console.error("TEST CONNECT ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /marketplace/bar/payments-test-connect-auto — 1-click test mode activation.
// Uses platform's configured test keys (PAYMONGO_SECRET_KEY / PAYMONGO_PUBLIC_KEY).
// No user-provided key required. Validates platform keys, then marks bar as
// test-connected. Simplifies onboarding for bars that just want to simulate.
router.post(
  "/bar/payments-test-connect-auto",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });

      // Load platform test keys (from DB or env)
      try {
        await paymongoService.loadKeys('test');
      } catch (e) {
        return res.status(422).json({
          success: false,
          message: "Platform test keys are not configured. Please contact support.",
          detail: e.message,
        });
      }

      // Validate platform keys work
      const { secretKey } = paymongoService.keysCache.test || {};
      if (!secretKey) {
        return res.status(422).json({
          success: false,
          message: "Platform test secret key is missing.",
        });
      }
      try {
        await paymongoService.validateOwnerKeys(secretKey, 'test');
      } catch (e) {
        return res.status(422).json({
          success: false,
          message: "Platform test credentials are invalid. Please contact support.",
          detail: e.message,
        });
      }

      await pool.query(
        `UPDATE bars SET paymongo_test_connected = 1, paymongo_test_connected_at = NOW() WHERE id = ?`,
        [bar.id]
      );
      logAudit(null, {
        bar_id: bar.id, user_id: req.user.id,
        action: "PAYMENTS_TEST_CONNECTED_AUTO", entity: "bars", entity_id: bar.id,
        details: { key_validated: true, key_kind: 'platform_sk_test' }, ...auditContext(req),
      });
      const activation = await promoteBarIfReady(pool, bar.id);
      return res.json({
        success: true,
        message: "Test Mode enabled. Transactions will use platform sandbox credentials (no real money).",
        data: {
          paymongo_mode: bar.paymongo_mode || 'test',
          paymongo_test_connected: true,
          key_validated: true,
          activation,
        },
      });
    } catch (err) {
      console.error("TEST CONNECT AUTO ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /marketplace/bar/payments-test-disconnect — disable test mode for this bar
router.post(
  "/bar/payments-test-disconnect",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });

      await pool.query(
        `UPDATE bars SET paymongo_test_connected = 0, paymongo_test_connected_at = NULL WHERE id = ?`,
        [bar.id]
      );
      logAudit(null, {
        bar_id: bar.id, user_id: req.user.id,
        action: "PAYMENTS_TEST_DISCONNECTED", entity: "bars", entity_id: bar.id,
        details: {}, ...auditContext(req),
      });
      const activation = await promoteBarIfReady(pool, bar.id);
      return res.json({
        success: true,
        message: "Test Mode disconnected.",
        data: {
          paymongo_mode: bar.paymongo_mode || 'test',
          paymongo_test_connected: false,
          activation,
        },
      });
    } catch (err) {
      console.error("TEST DISCONNECT ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /marketplace/bar/payments-connect-live — self-serve Live connection.
// Body: { live_secret_key, live_public_key?, webhook_signing_key? }
// Validates the owner's own keys directly against PayMongo (harmless
// create+cancel round-trip, no money moves). On success the bar goes
// verified + Live Mode immediately — no admin step. Secrets are stored
// ENCRYPTED (services/fieldEncryption.js) and NEVER returned by any endpoint.
// Requires a webhook signing secret: without one the request is refused with
// 422 and nothing is written.
router.post(
  "/bar/payments-connect-live",
  requireAuth,
  async (req, res) => {
    try {
      const { bar, error } = await getOwnBar(req);
      if (error) return res.status(400).json({ success: false, message: error });

      const liveSecret = String(req.body?.live_secret_key || '').trim();
      const livePublic = String(req.body?.live_public_key || '').trim() || null;
      if (!liveSecret) {
        return res.status(400).json({ success: false, message: "Paste your PayMongo live secret key (sk_live_…)." });
      }

      try {
        await paymongoService.validateOwnerKeys(liveSecret);
      } catch (e) {
        return res.status(422).json({
          success: false,
          message: "We couldn't verify these PayMongo credentials. Please check and try again.",
          detail: e.message,
        });
      }

      // PayMongo signs every delivery with a secret IT generates for the
      // endpoint (whsk_…). We cannot invent one — registering the endpoint on
      // the bar's own account is the only way to obtain it, so this is where
      // the per-bar secret gets stored alongside the live key.
      //
      // Registration is best-effort: the API keys above already validated, so a
      // failure must not discard them. It is surfaced instead, because until a
      // signing secret exists every delivery from this account is rejected.
      const baseUrl = String(process.env.APP_URL || '').replace(/\/+$/, '');
      const webhookUrl = baseUrl ? `${baseUrl}/webhook/paymongo/${bar.id}` : null;
      let webhookSigningKey = String(req.body?.webhook_signing_key || '').trim() || null;
      let webhookWarning = null;

      if (!webhookSigningKey && !(await hasStoredWebhookSecret(bar.id))) {
        try {
          if (!webhookUrl) throw new Error('APP_URL is not configured');
          webhookSigningKey = await paymongoService.registerWebhookEndpoint(webhookUrl, liveSecret);
          if (!webhookSigningKey) throw new Error('PayMongo returned no signing secret');
        } catch (err) {
          console.warn('PAYMONGO_WEBHOOK_REGISTER_FAILED:', err.message);
          webhookWarning =
            `Webhook endpoint ${webhookUrl || '(APP_URL not set)'} could not be registered automatically: ${err.message}. ` +
            'PayMongo notifications would be rejected until a signing secret (whsk_…) is saved for this bar.';
        }
      }

      // Live mode without a signing secret is a state we refuse to create:
      // the bar would look connected while every webhook was failing.
      if (!(webhookSigningKey || (await hasStoredWebhookSecret(bar.id)))) {
        console.error(
          `PAYMONGO_LIVE_BLOCKED_NO_WEBHOOK_SECRET: bar ${bar.id} has no signing secret — refusing to enter live mode`
        );
        return res.status(422).json({
          success: false,
          code: 'LIVE_WEBHOOK_SECRET_REQUIRED',
          message:
            "We verified your API key, but no webhook signing secret (whsk_…) could be obtained for this bar, " +
            "so Live Mode was not enabled and nothing was saved.",
          detail: [
            webhookWarning,
            "Fix: paste the signing secret from PayMongo Dashboard → Developers → Webhooks as 'webhook_signing_key', " +
            "or set APP_URL so the endpoint can be registered automatically.",
          ].filter(Boolean).join(' '),
        });
      }

      // Encrypt at the write boundary only; the plaintext is needed above for
      // the PayMongo round-trip and is never read back out of the DB early.
      await pool.query(
        `UPDATE bars
         SET paymongo_live_secret_key = ?, paymongo_live_public_key = ?,
             paymongo_webhook_secret = COALESCE(?, paymongo_webhook_secret),
             paymongo_onboarding_status = 'verified', paymongo_mode = 'live',
             paymongo_onboarding_updated_at = NOW()
         WHERE id = ?`,
        [encryptField(liveSecret), livePublic, webhookSigningKey ? encryptField(webhookSigningKey) : null, bar.id]
      );

      try {
        const { createNotification } = require("../utils/notificationService");
        await createNotification({
          barId: bar.id,
          type: 'payout_account_verified',
          title: 'Live Mode activated',
          message: `${bar.name} connected its PayMongo account — Live Mode is now active and real payments can be accepted.`,
          referenceType: 'bar',
          referenceId: bar.id,
          category: 'payout',
          action: 'navigate',
          targetRoute: '/packages',
        });
      } catch (_) {}

      logAudit(null, {
        bar_id: bar.id, user_id: req.user.id,
        action: "PAYMENTS_LIVE_CONNECTED", entity: "bars", entity_id: bar.id,
        details: {
          live_public_key_set: Boolean(livePublic),
          // Never the secret itself — only whether one is now stored. The
          // guard above guarantees one is (or the request was rejected).
          webhook_secret_stored: true,
        }, ...auditContext(req),
      });

      const activation = await promoteBarIfReady(pool, bar.id);
      return res.json({
        success: true, message: "PayMongo account verified — Live Mode is now active.",
        data: {
          paymongo_mode: 'live',
          onboarding_status: 'verified',
          webhook_secret_stored: true,
          webhook_url: webhookUrl,
          activation,
          ...(webhookWarning ? { webhook_warning: webhookWarning } : {}),
        },
      });
    } catch (err) {
      console.error("CONNECT LIVE ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
