const pool = require('../config/database');

let Stripe = null;
try {
  Stripe = require('stripe');
} catch (err) {
  console.error('Stripe SDK not installed. Run: npm install stripe');
}

class StripeService {
  constructor() {
    this.client = null;
    this.settingsCache = null;
  }

  async loadSettings(force = false) {
    if (this.settingsCache && !force) return this.settingsCache;
    let map = {};
    try {
      const [rows] = await pool.query(
        "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('stripe_test_mode','stripe_secret_key','stripe_publishable_key','stripe_webhook_secret','stripe_platform_fee_percentage')"
      );
      rows.forEach((r) => { map[r.setting_key] = r.setting_value; });
    } catch (err) {
      console.error('Failed to load Stripe settings:', err.message);
    }
    const settings = {
      testMode: String(map.stripe_test_mode ?? '1') === '1',
      secretKey: map.stripe_secret_key || process.env.STRIPE_SECRET_KEY || '',
      publishableKey: map.stripe_publishable_key || process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: map.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || '',
      feePercentage: Number.isFinite(Number(map.stripe_platform_fee_percentage))
        ? Number(map.stripe_platform_fee_percentage) : 0,
    };
    this.settingsCache = settings;
    return settings;
  }

  async getClient() {
    if (!Stripe) throw new Error('Stripe SDK not installed');
    const { secretKey } = await this.loadSettings();
    if (!secretKey) throw new Error('Stripe secret key not configured');
    if (!this.client || this.client._key !== secretKey) {
      // eslint-disable-next-line new-cap
      this.client = Stripe(secretKey);
      this.client._key = secretKey;
    }
    return this.client;
  }

  managerBaseUrl() {
    return (process.env.MANAGER_URL || 'http://localhost:5174').replace(/\/$/, '');
  }

  /**
   * Create an Express connected account for a bar owner (test mode: no real docs).
   */
  async createExpressAccount({ email, businessName }) {
    const stripe = await this.getClient();
    return stripe.accounts.create({
      type: 'express',
      email: email || undefined,
      business_profile: businessName ? { name: businessName } : undefined,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { platform: 'the_party_goers' },
    });
  }

  /**
   * Hosted onboarding link (Account Links). Owner completes Stripe's test
   * onboarding (test data, no real documents) and returns to the portal.
   */
  async createAccountLink({ accountId }) {
    const stripe = await this.getClient();
    const base = this.managerBaseUrl();
    return stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/packages?stripe=refresh`,
      return_url: `${base}/packages?stripe=return`,
      type: 'account_onboarding',
    });
  }

  /**
   * Readiness: fully set up only when BOTH flags are true.
   */
  async getAccountStatus(accountId) {
    const stripe = await this.getClient();
    const acct = await stripe.accounts.retrieve(accountId);
    const active = Boolean(acct.charges_enabled && acct.payouts_enabled);
    return {
      accountId: acct.id,
      charges_enabled: Boolean(acct.charges_enabled),
      payouts_enabled: Boolean(acct.payouts_enabled),
      details_submitted: Boolean(acct.details_submitted),
      status: active ? 'active' : (acct.details_submitted ? 'pending' : 'incomplete'),
      raw: acct,
    };
  }

  /**
   * Destination-charge Checkout Session: bar owner's share transfers directly
   * to their connected account; platform fee (possibly 0) stays with us.
   * Amount in PHP pesos (converted to centavos); fee in pesos too.
   */
  async createSplitCheckout({ amount, connectedAccountId, feeAmount = 0, reference, successUrl, cancelUrl, description, metadata = {} }) {
    const stripe = await this.getClient();
    const amountCents = Math.round(Number(amount) * 100);
    const feeCents = Math.max(0, Math.round(Number(feeAmount || 0) * 100));
    if (!connectedAccountId) throw new Error('Connected account is required for split checkout');
    if (!Number.isFinite(amountCents) || amountCents < 50) throw new Error('Invalid checkout amount');
    return stripe.checkout.sessions.create({
      mode: 'payment',
      currency: 'php',
      line_items: [{
        price_data: {
          currency: 'php',
          unit_amount: amountCents,
          product_data: { name: (description || 'Bar reservation payment').slice(0, 120) },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_intent_data: {
        transfer_data: { destination: connectedAccountId },
        application_fee_amount: feeCents,
        description: (description || `Payment ${reference || ''}`).slice(0, 200),
        metadata: { ...metadata, reference: reference || '' },
      },
      metadata: { ...metadata, reference: reference || '' },
    });
  }

  async getPaymentIntent(paymentIntentId) {
    const stripe = await this.getClient();
    return stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['charges.data.balance_transaction'] });
  }

  /**
   * Verify + parse a Stripe webhook event from the RAW body.
   */
  async constructEvent(rawBody, signature) {
    const { webhookSecret } = await this.loadSettings();
    if (!Stripe) throw new Error('Stripe SDK not installed');
    if (!webhookSecret) throw new Error('Stripe webhook secret not configured');
    if (!signature) throw new Error('Missing Stripe signature');
    const stripe = await this.getClient();
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}

module.exports = new StripeService();
