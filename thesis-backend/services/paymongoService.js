const axios = require('axios');
const pool = require('../config/database');

class PayMongoService {
  constructor() {
    this.baseUrl = 'https://api.paymongo.com/v1';
    // Per-mode key cache: test keys vs live keys. Live mode NEVER falls back
    // to test keys (fail closed) â€” real money must never touch test rails.
    this.keysCache = { test: null, live: null };
  }

  async loadKeys(mode = 'test') {
    const m = mode === 'live' ? 'live' : 'test';
    if (this.keysCache[m]) return this.keysCache[m];

    let secretKey = null;
    let publicKey = null;
    if (m === 'live') {
      try {
        const [rows] = await pool.query(
          "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('paymongo_live_secret_key', 'paymongo_live_public_key')"
        );
        rows.forEach(row => {
          if (row.setting_key === 'paymongo_live_secret_key' && row.setting_value) secretKey = row.setting_value;
          if (row.setting_key === 'paymongo_live_public_key' && row.setting_value) publicKey = row.setting_value;
        });
      } catch (err) {
        console.error('Failed to load PayMongo live keys:', err.message);
      }
      if (!secretKey) secretKey = process.env.PAYMONGO_LIVE_SECRET_KEY || null;
      if (!publicKey) publicKey = process.env.PAYMONGO_LIVE_PUBLIC_KEY || null;
      if (!secretKey) throw new Error('PayMongo live keys not configured');
    } else {
      try {
        const [rows] = await pool.query(
          "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('paymongo_secret_key', 'paymongo_public_key')"
        );
        rows.forEach(row => {
          if (row.setting_key === 'paymongo_secret_key' && row.setting_value) {
            secretKey = row.setting_value;
          }
          if (row.setting_key === 'paymongo_public_key' && row.setting_value) {
            publicKey = row.setting_value;
          }
        });
      } catch (err) {
        console.error('Failed to load PayMongo keys from database:', err.message);
      }

      // Fallback to environment variables if not loaded from database
      if (!secretKey) {
        secretKey = process.env.PAYMONGO_SECRET_KEY;
      }
      if (!publicKey) {
        publicKey = process.env.PAYMONGO_PUBLIC_KEY;
      }
    }

    this.keysCache[m] = { secretKey, publicKey };
    if (secretKey || publicKey) {
      console.log(`PayMongo ${m} keys loaded:`, {
        secretKey: secretKey ? 'configured' : 'missing',
        publicKey: publicKey ? 'configured' : 'missing',
      });
    }
    return this.keysCache[m];
  }

  /**
   * Load the platform keys for a call, unless the caller supplied the bar's own
   * key. A bar live-key rail must work even when the platform has no live keys
   * configured at all â€” requiring them there broke owner-key payments outright.
   */
  async loadKeysForCall(mode = 'test', explicitSecret = null) {
    if (explicitSecret) return null;
    return this.loadKeys(mode);
  }

  getAuthHeader(mode = 'test', explicitSecret = null) {
    if (explicitSecret) {
      return {
        Authorization: `Basic ${Buffer.from(explicitSecret).toString('base64')}`,
        'Content-Type': 'application/json',
      };
    }
    const m = mode === 'live' ? 'live' : 'test';
    const keys = this.keysCache[m];
    const secretKey = keys?.secretKey;
    if (!secretKey) throw new Error(`PayMongo ${m} secret key not configured`);
    return {
      Authorization: `Basic ${Buffer.from(secretKey).toString('base64')}`,
      'Content-Type': 'application/json',
    };
  }

  // Backward compat: legacy callers read .secretKey/.publicKey after loadKeys()
  // (test-mode keys, same as the old behavior).
  get secretKey() { return this.keysCache.test?.secretKey || null; }
  get publicKey() { return this.keysCache.test?.publicKey || null; }

  /**
   * Create Checkout Session (recommended for QR-based online payments)
   */
  async createCheckoutSession({ line_items, payment_method_types, reference_number, success_url, cancel_url, description, metadata = {}, keyMode = 'test', keyOverride = null }) {
    await this.loadKeysForCall(keyMode, keyOverride);

    const payload = {
      data: {
        attributes: {
          line_items,
          payment_method_types,
          reference_number,
          success_url,
          cancel_url,
          description: description || 'POS Order Payment',
          currency: 'PHP',
          metadata,
        },
      },
    };

    try {
      const response = await axios.post(`${this.baseUrl}/checkout_sessions`, payload, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Create Checkout Session Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to create checkout session');
    }
  }

  /**
   * Retrieve Checkout Session by ID
   */
  async getCheckoutSession(checkoutSessionId, keyMode = 'test', keyOverride = null) {
    await this.loadKeysForCall(keyMode, keyOverride);

    try {
      const response = await axios.get(`${this.baseUrl}/checkout_sessions/${checkoutSessionId}`, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Get Checkout Session Error:', err.response?.data || err.message);
      return null;
    }
  }

  /**
   * Create PayMongo Source (for GCash)
   * @param {number} amount - Amount in centavos (PHP 100.00 = 10000)
   * @param {string} type - 'gcash' or 'grab_pay'
   * @param {object} metadata - Additional data
   */
  async createSource(amount, type = 'gcash', metadata = {}, keyMode = 'test', keyOverride = null) {
    await this.loadKeysForCall(keyMode, keyOverride);
    
    const payload = {
      data: {
        attributes: {
          amount: Math.round(amount * 100), // Convert to centavos
          currency: 'PHP',
          type,
          redirect: {
            success: metadata.success_url || `${process.env.FRONTEND_URL || 'https://customer-website.com'}/payment/success`,
            failed: metadata.failed_url || `${process.env.FRONTEND_URL || 'https://customer-website.com'}/payment/failed`,
          },
          billing: metadata.billing || null,
          statement_descriptor: metadata.description || 'Platform Bar Payment',
        },
      },
    };

    try {
      const response = await axios.post(`${this.baseUrl}/sources`, payload, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Create Source Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to create payment source');
    }
  }

  /**
   * Create Payment Intent (for cards)
   */
  async createPaymentIntent(amount, metadata = {}, keyMode = 'test', keyOverride = null) {
    await this.loadKeysForCall(keyMode, keyOverride);
    
    const payload = {
      data: {
        attributes: {
          amount: Math.round(amount * 100),
          currency: 'PHP',
          payment_method_allowed: ['card', 'paymaya'],
          payment_method_options: {
            card: { request_three_d_secure: 'any' },
          },
          description: metadata.description || 'Platform Bar Payment',
          statement_descriptor: 'BAR PLATFORM',
          metadata: metadata.custom_data || {},
        },
      },
    };

    try {
      const response = await axios.post(`${this.baseUrl}/payment_intents`, payload, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Create Payment Intent Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to create payment intent');
    }
  }

  /**
   * Retrieve Payment by ID
   */
  async getPayment(paymentId, keyMode = 'test', keyOverride = null) {
    await this.loadKeysForCall(keyMode, keyOverride);
    
    try {
      const response = await axios.get(`${this.baseUrl}/payments/${paymentId}`, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Get Payment Error:', err.response?.data || err.message);
      return null;
    }
  }

  /**
   * Retrieve Source by ID
   */
  async getSource(sourceId, keyMode = 'test', keyOverride = null) {
    await this.loadKeysForCall(keyMode, keyOverride);
    
    try {
      const response = await axios.get(`${this.baseUrl}/sources/${sourceId}`, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Get Source Error:', err.response?.data || err.message);
      return null;
    }
  }

  /**
   * Create Payment from Source (attach source to create payment)
   */
  async attachSourceToPayment(sourceId, metadata = {}, keyMode = 'test', keyOverride = null) {
    await this.loadKeysForCall(keyMode, keyOverride);
    const amount = Number(metadata.amount);
    const hasAmount = Number.isFinite(amount) && amount > 0;
    
    const payload = {
      data: {
        attributes: {
          source: { id: sourceId, type: 'source' },
          amount: hasAmount ? Math.round(amount) : undefined,
          currency: 'PHP',
          description: metadata.description || 'Platform Bar Payment',
        },
      },
    };

    try {
      const response = await axios.post(`${this.baseUrl}/payments`, payload, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Attach Source Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to attach payment source');
    }
  }

  /**
   * Process refund
   * keyMode/keyOverride must match the rail the original payment was created
   * on, otherwise PayMongo rejects the refund against the wrong account.
   */
  async createRefund(paymentId, amount = null, reason = null, keyMode = 'test', keyOverride = null) {
    await this.loadKeysForCall(keyMode, keyOverride);
    
    const payload = {
      data: {
        attributes: {
          payment_id: paymentId,
          amount: amount ? Math.round(amount * 100) : undefined,
          reason: reason || 'requested_by_customer',
        },
      },
    };

    try {
      const response = await axios.post(`${this.baseUrl}/refunds`, payload, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Refund Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to process refund');
    }
  }

  /**
   * Retrieve Payment Intent by ID
   */
  async getPaymentIntent(paymentIntentId, keyMode = 'test', keyOverride = null) {
    await this.loadKeysForCall(keyMode, keyOverride);

    try {
      const response = await axios.get(`${this.baseUrl}/payment_intents/${paymentIntentId}`, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Get Payment Intent Error:', err.response?.data || err.message);
      return null;
    }
  }

  /**
   * Webhook verification secret, resolved the same way verifyWebhookSignature
   * does. Callers use this to fail closed only when a secret actually exists.
   */
  async getWebhookSecret() {
    try {
      const [rows] = await pool.query(
        "SELECT setting_value FROM platform_settings WHERE setting_key = 'paymongo_webhook_secret' LIMIT 1"
      );
      return rows?.[0]?.setting_value || process.env.PAYMONGO_WEBHOOK_SECRET || null;
    } catch (err) {
      console.error('Failed to load PayMongo webhook secret:', err.message);
      return process.env.PAYMONGO_WEBHOOK_SECRET || null;
    }
  }

  /**
   * Verify a PayMongo webhook signature against one or more candidate secrets.
   *
   * PayMongo signs every delivery with the secret of the webhook endpoint the
   * event was sent from, so in a multi-tenant setup (one shared URL, N bar
   * PayMongo accounts) the caller must decide WHICH secret may be used for a
   * given event. That decision is a security boundary, not a convenience:
   * accepting "any known secret" would let a bar owner who knows their own
   * whsk_ forge payment.paid events for another bar's payments.
   *
   * Header format is `t=<ts>,te=<test-digest>,li=<live-digest>` where both
   * digests are HMAC-SHA256 over `${t}.${rawBody}` with this endpoint's secret.
   * A plain `HMAC(rawBody)` fallback is retained so a legacy delivery that
   * omitted the timestamp still verifies.
   *
   * @param {Buffer|string|object} payloadOrRawBody raw bytes as received
   * @param {string} signatureHeader value of the `paymongo-signature` header
   * @param {object} [options]
   * @param {string[]} [options.secrets] per-bar secrets that may be accepted
   * @param {boolean} [options.allowPlatform=true] also accept the platform secret
   * @returns {Promise<boolean>}
   */
  async verifyWebhookSignature(payloadOrRawBody, signatureHeader, options = {}) {
    const { secrets = [], allowPlatform = true } = options || {};
    const platformSecret = allowPlatform ? await this.getWebhookSecret() : null;
    const secretsToTry = [...new Set(
      [platformSecret, ...(Array.isArray(secrets) ? secrets : [])].filter(Boolean)
    )];

    if (!secretsToTry.length || !signatureHeader) {
      console.warn('Webhook secret/signature missing');
      return false;
    }

    const crypto = require('crypto');
    const rawBody = Buffer.isBuffer(payloadOrRawBody)
      ? payloadOrRawBody.toString('utf8')
      : typeof payloadOrRawBody === 'string'
        ? payloadOrRawBody
        : JSON.stringify(payloadOrRawBody || {});

    const parts = String(signatureHeader)
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .reduce((acc, token) => {
        const idx = token.indexOf('=');
        if (idx <= 0) return acc;
        acc[token.slice(0, idx)] = token.slice(idx + 1);
        return acc;
      }, {});

    // PayMongo's own field names first, then tolerated aliases.
    const candidates = [parts.li, parts.te, parts.v1, parts.signature].filter(Boolean);
    const timestamp = parts.t;

    const safeEqual = (a, b) => {
      try {
        const left = Buffer.from(String(a));
        const right = Buffer.from(String(b));
        if (left.length !== right.length) return false;
        return crypto.timingSafeEqual(left, right);
      } catch (_) {
        return false;
      }
    };

    // Constant-ish work: every candidate secret is evaluated, so the response
    // time does not reveal which secret (if any) matched.
    let matched = false;
    for (const secret of secretsToTry) {
      const timestampDigest = timestamp
        ? crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
        : null;
      const plainDigest = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      const hit = candidates.some(
        (sig) => (timestampDigest && safeEqual(sig, timestampDigest)) || safeEqual(sig, plainDigest)
      );
      if (hit) matched = true;
    }
    return matched;
  }

  /**
   * Register a webhook endpoint on a PayMongo account using that account's own
   * API key, and return the endpoint's signing secret (`whsk_...`).
   *
   * PayMongo generates the signing secret; we only store it. Returns null when
   * PayMongo does not return a secret so callers can fall back to letting the
   * bar owner paste it from their Dashboard.
   */
  async registerWebhookEndpoint(url, barLiveSecretKey, events) {
    if (!url) throw new Error('Webhook URL is required');
    if (!barLiveSecretKey) throw new Error('A bar API key is required to register its webhook');
    const response = await axios.post(
      `${this.baseUrl}/webhooks`,
      {
        data: {
          attributes: {
            url,
            events: events || [
              'source.chargeable',
              'payment.paid',
              'payment.failed',
              'checkout_session.payment.paid',
            ],
          },
        },
      },
      { headers: this.getAuthHeader('test', String(barLiveSecretKey).trim()) }
    );
    return response?.data?.data?.attributes?.secret_key || null;
  }

  /**
   * Validate a bar owner's own API keys with a harmless round-trip: create a
   * tiny UNCONFIRMED payment intent (moves no money), then cancel it.
   * `mode` picks which key shape is expected: 'live' (sk_live_…) or
   * 'test' (sk_test_…). Returns { valid: true } or throws with PayMongo's
   * reason.
   */
  async validateOwnerKeys(secretKey, mode = 'live') {
    const isTest = mode === 'test';
    const expectedPrefix = isTest ? 'sk_test_' : 'sk_live_';
    const label = isTest ? 'test' : 'live';
    if (!secretKey || !String(secretKey).startsWith(expectedPrefix)) {
      throw new Error(
        `That does not look like a PayMongo ${label} secret key (expected ${expectedPrefix}…).`
      );
    }
    const headers = this.getAuthHeader('test', String(secretKey).trim());
    let intentId = null;
    try {
      const created = await axios.post(`${this.baseUrl}/payment_intents`, {
        data: {
          attributes: {
            amount: 100,
            currency: 'PHP',
            description: 'TPG key validation (auto-cancelled, no charge)',
            // Required by PayMongo's current API. Without it every validation
            // fails with "payment_method_allowed is required" even for a
            // perfectly valid key — which silently broke the whole connect
            // flow (live connect always 422'd).
            payment_method_allowed: ['card'],
            metadata: { purpose: 'key_validation' },
          },
        },
      }, { headers });
      intentId = created.data?.data?.id || null;
    } catch (err) {
      // Never log the credentials or anything shaped like them; PayMongo
      // already masks, this guards against it changing its mind.
      const redact = (s) => String(s).replace(/\b(?:sk|pk|whsk)_[A-Za-z0-9]+/g, (m) => `${m.slice(0, 8)}…`);
      console.error('PayMongo Owner-Key Validation Error:', {
        status: err.response?.status,
        body: redact(JSON.stringify(err.response?.data || err.message)),
      });
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'PayMongo rejected these credentials.');
    }
    // Best-effort cleanup: cancel the validation intent so nothing lingers.
    if (intentId) {
      try {
        await axios.post(`${this.baseUrl}/payment_intents/${intentId}/cancel`, { data: { attributes: {} } }, { headers });
      } catch (_) {}
    }
    return { valid: true, intentId };
  }

  /**
   * Generate payment reference ID
   */
  generateReferenceId(prefix = 'PAY') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PayMongo Platforms (parent â†” child merchants + split settlement)
  // Requires the PayMongo account to be activated for Platforms +
  // Payment Splitting by PayMongo support. All calls use the LIVE
  // secret key and affect live data.
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async loadPlatformSettings() {
    try {
      const [rows] = await pool.query(
        "SELECT setting_key, setting_value FROM platform_settings WHERE setting_key IN ('paymongo_platforms_enabled', 'paymongo_parent_merchant_id', 'platform_fee_percentage')"
      );
      const map = {};
      rows.forEach((r) => { map[r.setting_key] = r.setting_value; });
      return {
        enabled: String(map.paymongo_platforms_enabled || '0') === '1',
        parentMerchantId: String(map.paymongo_parent_merchant_id || '').trim(),
        feePercentage: Number.isFinite(Number(map.platform_fee_percentage)) ? Number(map.platform_fee_percentage) : 0,
      };
    } catch (err) {
      console.error('Failed to load platform settings:', err.message);
      return { enabled: false, parentMerchantId: '', feePercentage: 0 };
    }
  }

  /**
   * Build a split_payment object for Payment Intents / Checkout Sessions.
   * Bar owner (child) receives (100 - fee)% in basis points; the remainder
   * (platform fee, if any) settles to the parent via transfer_to.
   * With fee = 0 the child keeps 100% and the parent receives nothing.
   */
  buildSplit({ childMerchantId, feePercentage = 0, parentMerchantId = '' }) {
    if (!childMerchantId) return null;
    const feeBps = Math.max(0, Math.min(10000, Math.round(Number(feePercentage || 0) * 100)));
    return {
      transfer_to: parentMerchantId || undefined,
      recipients: [
        { merchant_id: childMerchantId, split_type: 'percentage_net', value: 10000 - feeBps },
      ],
    };
  }

  /**
   * POST /v1/merchants/children â€” start child merchant onboarding.
   */
  async createChildMerchant({ tradeName, businessType = 'sole_proprietor', features = ['payment_gateway'], acceptedTerms = true }) {
    await this.loadKeys('live');
    const payload = {
      data: {
        attributes: {
          accepted_terms_and_conditions: acceptedTerms,
          features,
          business: { trade_name: tradeName, type: businessType },
        },
      },
    };
    try {
      const response = await axios.post(`${this.baseUrl}/merchants/children`, payload, {
        headers: this.getAuthHeader('live'),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Create Child Merchant Error:', {
        status: err.response?.status,
        body: err.response?.data || err.message,
      });
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to start child merchant onboarding');
    }
  }

  /**
   * GET /v1/merchants/children/{id}/requirements â€” onboarding checklist.
   */
  async getChildMerchantRequirements(childMerchantId) {
    await this.loadKeys('live');
    try {
      const response = await axios.get(
        `${this.baseUrl}/merchants/children/${encodeURIComponent(childMerchantId)}/requirements`,
        { headers: this.getAuthHeader('live') }
      );
      return response.data.data ?? response.data;
    } catch (err) {
      console.error('PayMongo Child Requirements Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to fetch onboarding requirements');
    }
  }

  /**
   * POST /v2/linking-requests/invites â€” invite a bar owner by email (alternative
   * onboarding path: they sign up + verify via PayMongo-hosted flow).
   */
  async inviteChildMerchant(email) {
    await this.loadKeys('live');
    const payload = { data: { attributes: { invitees: [{ email, account_type: 'merchant' }] } } };
    try {
      const response = await axios.post('https://api.paymongo.com/v2/linking-requests/invites', payload, {
        headers: this.getAuthHeader('live'),
      });
      return response.data.data ?? response.data;
    } catch (err) {
      console.error('PayMongo Invite Child Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to send onboarding invite');
    }
  }

  /**
   * Create Payment Intent with optional split_payment (card + e-wallet intents).
   */
  async createSplitPaymentIntent(amount, metadata = {}, split = null, keyMode = 'test', keyOverride = null) {
    await this.loadKeysForCall(keyMode, keyOverride);
    const payload = {
      data: {
        attributes: {
          amount: Math.round(amount * 100),
          currency: 'PHP',
          payment_method_allowed: ['card', 'paymaya'],
          payment_method_options: {
            card: { request_three_d_secure: 'any' },
          },
          description: metadata.description || 'Platform Bar Payment',
          statement_descriptor: 'BAR PLATFORM',
          metadata: metadata.custom_data || {},
          ...(split ? { split_payment: split } : {}),
        },
      },
    };
    try {
      const response = await axios.post(`${this.baseUrl}/payment_intents`, payload, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Split Payment Intent Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to create split payment intent');
    }
  }

  /**
   * Create Checkout Session (v1) with optional split_payment.
   * Used for e-wallet (GCash/PayMaya) marketplace payments since Sources
   * do not support split instructions.
   */
  async createSplitCheckoutSession({ line_items, payment_method_types, reference_number, success_url, cancel_url, description, metadata = {}, split = null, keyMode = 'test', keyOverride = null }) {
    await this.loadKeysForCall(keyMode, keyOverride);
    const payload = {
      data: {
        attributes: {
          line_items,
          payment_method_types,
          reference_number,
          success_url,
          cancel_url,
          description: description || 'Platform Bar Payment',
          currency: 'PHP',
          metadata,
          ...(split ? { split_payment: split } : {}),
        },
      },
    };
    try {
      const response = await axios.post(`${this.baseUrl}/checkout_sessions`, payload, {
        headers: this.getAuthHeader(keyMode, keyOverride),
      });
      return response.data.data;
    } catch (err) {
      console.error('PayMongo Split Checkout Session Error:', err.response?.data || err.message);
      throw new Error(err.response?.data?.errors?.[0]?.detail || 'Failed to create split checkout session');
    }
  }

  async getCheckoutSessionById(checkoutSessionId, keyMode = 'test', keyOverride = null) {
    return this.getCheckoutSession(checkoutSessionId, keyMode, keyOverride);
  }
}

module.exports = new PayMongoService();
