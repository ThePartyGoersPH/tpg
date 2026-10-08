const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const pool = require('../config/database');
const requireAuth = require('../middlewares/requireAuth');
const requirePermission = require('../middlewares/requirePermission');
const paymongoService = require('../services/paymongoService');
const { deductInventoryForOrder } = require('./payments');

const router = express.Router();

let _paymentTransactionsPaymentMethodColumnType = null;
let _posOrdersPaymentMethodColumnType = null;

async function getColumnType(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows[0]?.COLUMN_TYPE || null;
}

function enumTypeHasValue(columnType, value) {
  const normalizedType = String(columnType || '').toLowerCase();
  const normalizedValue = String(value || '').toLowerCase();
  if (!normalizedType || !normalizedValue) return false;
  return normalizedType.includes(`'${normalizedValue}'`);
}

async function getPaymentTransactionsPaymentMethodColumnType(conn) {
  if (_paymentTransactionsPaymentMethodColumnType !== null) return _paymentTransactionsPaymentMethodColumnType;
  _paymentTransactionsPaymentMethodColumnType = await getColumnType(conn, 'payment_transactions', 'payment_method');
  return _paymentTransactionsPaymentMethodColumnType;
}

async function getPosOrdersPaymentMethodColumnType(conn) {
  if (_posOrdersPaymentMethodColumnType !== null) return _posOrdersPaymentMethodColumnType;
  _posOrdersPaymentMethodColumnType = await getColumnType(conn, 'pos_orders', 'payment_method');
  return _posOrdersPaymentMethodColumnType;
}

async function normalizePaymentMethodForPaymentTransactions(conn, paymentMethod) {
  const normalized = String(paymentMethod || '').toLowerCase().trim();
  if (!normalized) return null;

  const columnType = await getPaymentTransactionsPaymentMethodColumnType(conn);
  if (!columnType) return normalized;
  if (!String(columnType).toLowerCase().startsWith('enum(')) return normalized;
  if (enumTypeHasValue(columnType, normalized)) return normalized;
  if (enumTypeHasValue(columnType, 'online')) return 'online';
  if (enumTypeHasValue(columnType, 'digital')) return 'digital';
  if (enumTypeHasValue(columnType, 'other')) return 'other';
  if (enumTypeHasValue(columnType, 'gcash')) return 'gcash';
  if (enumTypeHasValue(columnType, 'cash')) return 'cash';
  return null;
}

async function normalizePaymentMethodForPosOrders(conn, paymentMethod) {
  const normalized = String(paymentMethod || '').toLowerCase().trim();
  if (!normalized) return null;

  const columnType = await getPosOrdersPaymentMethodColumnType(conn);
  if (!columnType) return normalized;
  if (!String(columnType).toLowerCase().startsWith('enum(')) return normalized;
  if (enumTypeHasValue(columnType, normalized)) return normalized;
  if (enumTypeHasValue(columnType, 'digital')) return 'digital';
  if (enumTypeHasValue(columnType, 'online')) return 'online';
  if (enumTypeHasValue(columnType, 'other')) return 'other';
  if (enumTypeHasValue(columnType, 'cash')) return 'cash';
  return null;
}

function toCents(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

function parseWebhookSignature(headerValue) {
  return String(headerValue || '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .reduce((acc, token) => {
      const idx = token.indexOf('=');
      if (idx <= 0) return acc;
      acc[token.slice(0, idx)] = token.slice(idx + 1);
      return acc;
    }, {});
}

function buildPaymentUrls(referenceId) {
  const base = String(process.env.PAYMENT_REDIRECT_BASE_URL || process.env.BACKEND_PUBLIC_URL || 'https://api.thepartygoers.fun').replace(/\/$/, '');
  return {
    successUrl: `${base}/payment/success?ref=${encodeURIComponent(referenceId)}`,
    cancelUrl: `${base}/payment/failed?ref=${encodeURIComponent(referenceId)}`,
  };
}

function formatLineItems(rows = []) {
  return rows
    .map((item) => {
      const quantity = Number(item.quantity || 1);
      const unitPrice = Number(item.unit_price || 0);
      if (quantity <= 0 || unitPrice <= 0) return null;
      return {
        name: item.item_name || 'POS Item',
        quantity,
        amount: toCents(unitPrice),
        currency: 'PHP',
      };
    })
    .filter(Boolean);
}

function getCheckoutSessionResource(eventBody) {
  return eventBody?.data?.attributes?.data || eventBody?.data || null;
}

function getCheckoutReference(eventBody) {
  const resource = getCheckoutSessionResource(eventBody);
  const attrs = resource?.attributes || {};
  return (
    attrs.reference_number
    || attrs.metadata?.reference_number
    || attrs.metadata?.reference_id
    || null
  );
}

function getCheckoutSessionId(eventBody) {
  const resource = getCheckoutSessionResource(eventBody);
  return resource?.id || null;
}

function getPaymentMethodFromCheckout(eventBody) {
  const resource = getCheckoutSessionResource(eventBody);
  const payments = resource?.attributes?.payments || [];
  const firstPayment = Array.isArray(payments) ? payments[0] : null;
  const attrs = firstPayment?.attributes || {};
  const sourceType = attrs.source?.type || attrs.payment_method_used || '';
  const normalized = String(sourceType).toLowerCase();
  if (normalized.includes('paymaya')) return 'paymaya';
  if (normalized.includes('gcash')) return 'gcash';
  return 'online';
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function getPaymentMethodFromCheckoutSession(sessionData) {
  const payments = sessionData?.attributes?.payments || [];
  const firstPayment = Array.isArray(payments) ? payments[0] : null;
  const attrs = firstPayment?.attributes || {};
  const sourceType = attrs.source?.type || attrs.payment_method_used || attrs.type || '';
  const normalized = String(sourceType).toLowerCase();
  if (normalized.includes('paymaya')) return 'paymaya';
  if (normalized.includes('gcash')) return 'gcash';
  return 'online';
}

function checkoutSessionIsPaid(sessionData) {
  const sessionStatus = String(sessionData?.attributes?.status || '').toLowerCase();
  if (sessionStatus === 'paid') return true;

  const payments = Array.isArray(sessionData?.attributes?.payments) ? sessionData.attributes.payments : [];
  if (payments.some((p) => String(p?.attributes?.status || '').toLowerCase() === 'paid')) {
    return true;
  }

  const paymentIntentStatus = String(sessionData?.attributes?.payment_intent?.attributes?.status || '').toLowerCase();
  return paymentIntentStatus === 'succeeded' || paymentIntentStatus === 'paid';
}

function getCheckoutSessionIdFromTransaction(tx) {
  const metadata = safeParseJson(tx?.metadata) || {};
  return metadata.checkout_session_id || null;
}

async function findOrderAndItems(conn, barId, orderId) {
  const [orderRows] = await conn.query(
    `SELECT id, bar_id, order_number, total_amount, status, payment_status
     FROM pos_orders
     WHERE id = ? AND bar_id = ?
     LIMIT 1`,
    [orderId, barId]
  );
  const order = orderRows[0] || null;

  if (!order) {
    return { order: null, items: [] };
  }

  const [itemRows] = await conn.query(
    `SELECT item_name, quantity, unit_price, subtotal
     FROM pos_order_items
     WHERE order_id = ?`,
    [orderId]
  );

  return {
    order,
    items: itemRows || [],
  };
}

async function upsertWebhookEvent(conn, eventId, eventType, payload) {
  if (!eventId) return { alreadyProcessed: false, webhookEventId: null };

  const [existingRows] = await conn.query(
    'SELECT id, processed FROM webhook_events WHERE event_id = ? LIMIT 1',
    [eventId]
  );

  if (existingRows.length) {
    return {
      alreadyProcessed: Boolean(existingRows[0].processed),
      webhookEventId: existingRows[0].id,
    };
  }

  const [insertResult] = await conn.query(
    `INSERT INTO webhook_events (event_id, event_type, payload, processed)
     VALUES (?, ?, ?, 0)`,
    [eventId, eventType || 'checkout_session.unknown', JSON.stringify(payload || {})]
  );

  return { alreadyProcessed: false, webhookEventId: insertResult.insertId };
}

async function markWebhookProcessed(conn, webhookEventId, error = null) {
  if (!webhookEventId) return;

  await conn.query(
    `UPDATE webhook_events
     SET processed = ?, processed_at = NOW(), error_message = ?
     WHERE id = ?`,
    [error ? 0 : 1, error || null, webhookEventId]
  );
}

function isPaymentMethodTruncationError(err) {
  const message = String(err?.sqlMessage || err?.message || '').toLowerCase();
  return (
    String(err?.code || '') === 'WARN_DATA_TRUNCATED'
    && message.includes("payment_method")
  );
}

async function updatePosOrderPending(conn, orderId, paymentTransactionId, storedOrderMethod) {
  if (storedOrderMethod) {
    try {
      await conn.query(
        `UPDATE pos_orders
         SET payment_status = 'pending',
             payment_method = ?,
             payment_transaction_id = ?
         WHERE id = ?`,
        [storedOrderMethod, paymentTransactionId, orderId]
      );
      return;
    } catch (err) {
      if (!isPaymentMethodTruncationError(err)) throw err;
    }
  }

  await conn.query(
    `UPDATE pos_orders
     SET payment_status = 'pending',
         payment_transaction_id = ?
     WHERE id = ?`,
    [paymentTransactionId, orderId]
  );
}

async function updatePosOrderPaid(conn, orderId, paymentTransactionId, storedOrderMethod) {
  const [orderRows] = await conn.query(
    `SELECT table_id, bar_id
     FROM pos_orders
     WHERE id = ?
     LIMIT 1`,
    [orderId]
  );
  const orderMeta = orderRows[0] || null;

  if (storedOrderMethod) {
    try {
      await conn.query(
        `UPDATE pos_orders
         SET status = 'completed',
             payment_status = 'paid',
             payment_method = ?,
             completed_at = COALESCE(completed_at, NOW()),
             payment_transaction_id = ?
         WHERE id = ?`,
        [storedOrderMethod, paymentTransactionId, orderId]
      );
      return;
    } catch (err) {
      if (!isPaymentMethodTruncationError(err)) throw err;
    }
  }

  await conn.query(
    `UPDATE pos_orders
     SET status = 'completed',
         payment_status = 'paid',
         completed_at = COALESCE(completed_at, NOW()),
         payment_transaction_id = ?
     WHERE id = ?`,
    [paymentTransactionId, orderId]
  );

  if (orderMeta?.table_id && orderMeta?.bar_id) {
    await conn.query(
      `UPDATE bar_tables
       SET manual_status = 'reserved',
           is_active = 1
       WHERE id = ? AND bar_id = ? AND deleted_at IS NULL`,
      [orderMeta.table_id, orderMeta.bar_id]
    );
  }
}

async function settlePosOrderTransaction(conn, tx, paymentMethod, eventLabel) {
  const storedTxMethod = await normalizePaymentMethodForPaymentTransactions(conn, paymentMethod);
  const storedOrderMethod = await normalizePaymentMethodForPosOrders(conn, paymentMethod);

  await conn.query(
    `UPDATE payment_transactions
     SET status = 'paid',
         payment_method = ?,
         paid_at = COALESCE(paid_at, NOW()),
         metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.last_webhook_event', ?)
     WHERE id = ?`,
    [storedTxMethod || paymentMethod, eventLabel || 'checkout_session.payment.paid', tx.id]
  );

  const [orderRows] = await conn.query(
    `SELECT id, payment_status
     FROM pos_orders
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [tx.related_id]
  );

  const order = orderRows[0] || null;
  if (order && String(order.payment_status || '').toLowerCase() !== 'paid') {
    await updatePosOrderPaid(conn, order.id, tx.id, storedOrderMethod);
    await deductInventoryForOrder(conn, order.id);
  }

  return {
    order_id: tx.related_id,
    bar_id: tx.bar_id,
    payment_method: paymentMethod,
    reference_id: tx.reference_id,
  };
}

async function reconcileByReference(referenceId, app, triggerSource = 'redirect') {
  if (!referenceId) return { success: false, status: 'missing_reference' };

  const conn = await pool.getConnection();
  try {
    const [txRows] = await conn.query(
      `SELECT *
       FROM payment_transactions
       WHERE reference_id = ?
         AND payment_type = 'order'
       ORDER BY id DESC
       LIMIT 1`,
      [referenceId]
    );

    const tx = txRows[0] || null;
    if (!tx) return { success: false, status: 'not_found' };

    if (String(tx.status || '').toLowerCase() === 'paid') {
      return { success: true, status: 'paid', order_id: tx.related_id, bar_id: tx.bar_id, reference_id: tx.reference_id };
    }

    const checkoutSessionId = getCheckoutSessionIdFromTransaction(tx);
    if (!checkoutSessionId) {
      return { success: false, status: 'missing_checkout_session' };
    }

    const sessionData = await paymongoService.getCheckoutSession(checkoutSessionId);
    if (!sessionData || !checkoutSessionIsPaid(sessionData)) {
      return { success: true, status: 'pending', order_id: tx.related_id, bar_id: tx.bar_id, reference_id: tx.reference_id };
    }

    const paymentMethod = getPaymentMethodFromCheckoutSession(sessionData);

    await conn.beginTransaction();

    const [lockedTxRows] = await conn.query(
      `SELECT *
       FROM payment_transactions
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [tx.id]
    );
    const lockedTx = lockedTxRows[0] || null;
    if (!lockedTx) {
      await conn.rollback();
      return { success: false, status: 'not_found' };
    }

    let settleResult;
    if (String(lockedTx.status || '').toLowerCase() === 'paid') {
      settleResult = {
        order_id: lockedTx.related_id,
        bar_id: lockedTx.bar_id,
        payment_method: lockedTx.payment_method || paymentMethod,
        reference_id: lockedTx.reference_id,
      };
    } else {
      settleResult = await settlePosOrderTransaction(conn, lockedTx, paymentMethod, `manual_reconcile.${triggerSource}`);
    }

    await conn.commit();

    const io = app?.get?.('io');
    if (io && settleResult.bar_id) {
      io.to(`bar:${settleResult.bar_id}`).emit('orderPaid', {
        ...settleResult,
        at: new Date().toISOString(),
        source: triggerSource,
      });
    }

    return { success: true, status: 'paid', ...settleResult };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // no-op
    }
    console.error('POS payment reconciliation error:', err);
    return { success: false, status: 'error', message: err.message || 'Failed to reconcile payment.' };
  } finally {
    conn.release();
  }
}

router.post('/create-checkout', requireAuth, requirePermission('reservation_manage'), express.json(), async (req, res) => {
  const userId = req.user?.id;
  const barId = req.user?.bar_id;
  const { order_id: orderId, payment_method: paymentMethod } = req.body || {};

  const allowedMethods = new Set(['gcash', 'paymaya']);
  const normalizedMethod = String(paymentMethod || '').toLowerCase();

  if (!orderId) {
    return res.status(400).json({ success: false, message: 'order_id is required.' });
  }

  if (!allowedMethods.has(normalizedMethod)) {
    return res.status(400).json({ success: false, message: 'payment_method must be gcash or paymaya.' });
  }

  const conn = await pool.getConnection();
  try {
    const storedTxMethod = await normalizePaymentMethodForPaymentTransactions(conn, normalizedMethod);
    const storedOrderMethod = await normalizePaymentMethodForPosOrders(conn, normalizedMethod);

    const { order, items } = await findOrderAndItems(conn, barId, orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    if (String(order.status).toLowerCase() === 'completed' || String(order.payment_status).toLowerCase() === 'paid') {
      return res.status(409).json({ success: false, message: 'Order is already paid.' });
    }

    const [existingRows] = await conn.query(
      `SELECT id, reference_id, checkout_url, status
       FROM payment_transactions
       WHERE payment_type = 'order'
         AND related_id = ?
         AND bar_id = ?
         AND payment_method = ?
         AND status IN ('pending', 'processing')
         AND checkout_url IS NOT NULL
       ORDER BY id DESC
       LIMIT 1`,
      [orderId, barId, storedTxMethod || normalizedMethod]
    );

    if (existingRows.length) {
      const existing = existingRows[0];
      const qrCode = await QRCode.toDataURL(existing.checkout_url, { margin: 1, width: 320 });
      return res.json({
        success: true,
        data: {
          order_id: Number(orderId),
          payment_transaction_id: existing.id,
          reference_id: existing.reference_id,
          checkout_url: existing.checkout_url,
          qr_code: qrCode,
          re_used: true,
        },
      });
    }

    const lineItems = formatLineItems(items);
    if (!lineItems.length) {
      lineItems.push({
        name: order.order_number ? `Order ${order.order_number}` : `Order #${order.id}`,
        quantity: 1,
        amount: toCents(order.total_amount),
        currency: 'PHP',
      });
    }

    const referenceId = `POS-${order.id}-${Date.now()}`;
    const { successUrl, cancelUrl } = buildPaymentUrls(referenceId);

    const checkoutSession = await paymongoService.createCheckoutSession({
      line_items: lineItems,
      payment_method_types: [normalizedMethod],
      reference_number: referenceId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      description: order.order_number ? `POS payment for ${order.order_number}` : `POS payment for order #${order.id}`,
      metadata: {
        source: 'pos',
        order_id: Number(order.id),
        bar_id: Number(barId),
        user_id: Number(userId || 0),
        payment_method: normalizedMethod,
        reference_number: referenceId,
      },
    });

    const checkoutUrl = checkoutSession?.attributes?.checkout_url;
    const checkoutSessionId = checkoutSession?.id;

    if (!checkoutUrl || !checkoutSessionId) {
      return res.status(502).json({ success: false, message: 'Unable to get checkout URL from PayMongo.' });
    }

    await conn.beginTransaction();

    const transactionMetadata = {
      source: 'pos_checkout',
      checkout_session_id: checkoutSessionId,
      payment_method: normalizedMethod,
      order_id: Number(order.id),
    };

    const [insertTx] = await conn.query(
      `INSERT INTO payment_transactions
       (reference_id, payment_type, related_id, bar_id, user_id, amount, status, payment_method, checkout_url, metadata, created_at)
       VALUES (?, 'order', ?, ?, ?, ?, 'pending', ?, ?, ?, NOW())`,
      [
        referenceId,
        order.id,
        barId,
        userId || null,
        Number(order.total_amount || 0),
        storedTxMethod,
        checkoutUrl,
        JSON.stringify({
          ...transactionMetadata,
          requested_payment_method: normalizedMethod,
          stored_payment_method: storedTxMethod,
        }),
      ]
    );

    const paymentTransactionId = insertTx.insertId;

    for (const item of lineItems) {
      await conn.query(
        `INSERT INTO payment_line_items
         (payment_transaction_id, item_type, item_name, quantity, unit_price, line_total, metadata)
         VALUES (?, 'menu', ?, ?, ?, ?, ?)` ,
        [
          paymentTransactionId,
          item.name,
          Number(item.quantity || 1),
          Number(item.amount || 0) / 100,
          (Number(item.amount || 0) / 100) * Number(item.quantity || 1),
          JSON.stringify({ source: 'pos_checkout' }),
        ]
      );
    }

    await updatePosOrderPending(conn, order.id, paymentTransactionId, storedOrderMethod);

    await conn.commit();

    const qrCode = await QRCode.toDataURL(checkoutUrl, { margin: 1, width: 320 });

    return res.json({
      success: true,
      data: {
        order_id: Number(order.id),
        payment_transaction_id: paymentTransactionId,
        reference_id: referenceId,
        checkout_url: checkoutUrl,
        checkout_session_id: checkoutSessionId,
        qr_code: qrCode,
      },
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // no-op
    }
    console.error('POS checkout creation error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to create checkout.' });
  } finally {
    conn.release();
  }
});

router.post('/reconcile-order', requireAuth, requirePermission('reservation_manage'), express.json(), async (req, res) => {
  const barId = req.user?.bar_id;
  const { order_id: orderId } = req.body || {};

  if (!orderId) {
    return res.status(400).json({ success: false, message: 'order_id is required.' });
  }

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT reference_id
       FROM payment_transactions
       WHERE payment_type = 'order'
         AND related_id = ?
         AND bar_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [orderId, barId]
    );

    const referenceId = rows[0]?.reference_id || null;
    if (!referenceId) {
      return res.status(404).json({ success: false, message: 'No payment transaction found for this order.' });
    }

    const result = await reconcileByReference(referenceId, req.app, 'poll');
    return res.json({ success: Boolean(result.success), data: result });
  } catch (err) {
    console.error('POS reconcile-order error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to reconcile order payment.' });
  } finally {
    conn.release();
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  const signatureHeader = req.headers['paymongo-signature'];

  const isValid = await paymongoService.verifyWebhookSignature(rawBody, signatureHeader);
  if (!isValid) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (_) {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload.' });
  }

  const signatureParts = parseWebhookSignature(signatureHeader);
  const eventType = payload?.data?.attributes?.type || 'checkout_session.unknown';
  const eventId = payload?.data?.id
    || payload?.id
    || signatureParts.ev
    || crypto.createHash('sha256').update(rawBody).digest('hex');

  const conn = await pool.getConnection();
  let webhookEventId = null;
  try {
    await conn.beginTransaction();

    const webhookState = await upsertWebhookEvent(conn, eventId, eventType, payload);
    webhookEventId = webhookState.webhookEventId;

    if (webhookState.alreadyProcessed) {
      await conn.commit();
      return res.json({ success: true, duplicate: true });
    }

    const referenceId = getCheckoutReference(payload);
    const checkoutSessionId = getCheckoutSessionId(payload);

    if (!referenceId && !checkoutSessionId) {
      await markWebhookProcessed(conn, webhookEventId, 'Missing checkout reference/session id');
      await conn.commit();
      return res.json({ success: true, ignored: true });
    }

    const [txRows] = await conn.query(
      `SELECT *
       FROM payment_transactions
       WHERE reference_id = ?
          OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.checkout_session_id')) = ?
       ORDER BY id DESC
       LIMIT 1`,
      [referenceId || '', checkoutSessionId || '']
    );

    const tx = txRows[0] || null;
    if (!tx) {
      await markWebhookProcessed(conn, webhookEventId, 'Payment transaction not found');
      await conn.commit();
      return res.json({ success: true, ignored: true });
    }

    const normalizedType = String(eventType || '').toLowerCase();

    if (normalizedType === 'checkout_session.payment.paid') {
      const paymentMethod = getPaymentMethodFromCheckout(payload);
      const storedTxMethod = await normalizePaymentMethodForPaymentTransactions(conn, paymentMethod);
      const storedOrderMethod = await normalizePaymentMethodForPosOrders(conn, paymentMethod);

      const [orderRows] = await conn.query(
        `SELECT id, status, payment_status
         FROM pos_orders
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [tx.related_id]
      );

      const order = orderRows[0] || null;

      await conn.query(
        `UPDATE payment_transactions
         SET status = 'paid',
             payment_method = ?,
             paid_at = NOW(),
             metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.last_webhook_event', ?, '$.checkout_session_id', ?)
         WHERE id = ?`,
        [storedTxMethod || paymentMethod, eventType, checkoutSessionId || null, tx.id]
      );

      if (order && String(order.payment_status || '').toLowerCase() !== 'paid') {
        await updatePosOrderPaid(conn, order.id, tx.id, storedOrderMethod);

        await deductInventoryForOrder(conn, order.id);
      }

      await markWebhookProcessed(conn, webhookEventId, null);
      await conn.commit();

      const io = req.app.get('io');
      if (io && tx.bar_id) {
        io.to(`bar:${tx.bar_id}`).emit('orderPaid', {
          order_id: tx.related_id,
          bar_id: tx.bar_id,
          reference_id: tx.reference_id,
          payment_method: paymentMethod,
          at: new Date().toISOString(),
        });
      }

      return res.json({ success: true, status: 'paid' });
    }

    if (normalizedType === 'checkout_session.payment.failed' || normalizedType === 'checkout_session.expired') {
      await conn.query(
        `UPDATE payment_transactions
         SET status = 'failed',
             metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.last_webhook_event', ?)
         WHERE id = ?`,
        [eventType, tx.id]
      );

      await markWebhookProcessed(conn, webhookEventId, null);
      await conn.commit();

      const io = req.app.get('io');
      if (io && tx.bar_id) {
        io.to(`bar:${tx.bar_id}`).emit('orderPaymentFailed', {
          order_id: tx.related_id,
          bar_id: tx.bar_id,
          reference_id: tx.reference_id,
          event_type: eventType,
          at: new Date().toISOString(),
        });
      }

      return res.json({ success: true, status: 'failed' });
    }

    await markWebhookProcessed(conn, webhookEventId, null);
    await conn.commit();
    return res.json({ success: true, ignored: true });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // no-op
    }

    if (webhookEventId) {
      try {
        await conn.query(
          `UPDATE webhook_events
           SET processed = 0,
               processed_at = NOW(),
               error_message = ?
           WHERE id = ?`,
          [err.message || 'Webhook processing failed', webhookEventId]
        );
      } catch (_) {
        // no-op
      }
    }

    console.error('POS payment webhook error:', err);
    return res.status(500).json({ success: false, message: 'Webhook processing failed.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
module.exports.reconcileByReference = reconcileByReference;
