const pool = require("../config/database");

/**
 * Single source of truth for "does this bar have a working payment setup?".
 *
 * A bar is ready when EITHER
 *   1. Test Mode is connected       -> paymongo_test_connected = 1, OR
 *   2. Live Mode is fully connected -> paymongo_mode = 'live' AND both the owner's
 *      live secret key and the per-bar webhook signing secret are stored.
 *
 * Both secrets are encrypted at rest (services/fieldEncryption.js); this module
 * only ever tests for PRESENCE, so no decryption happens and no key can reach a
 * response. Readiness is reported strictly as a boolean.
 *
 * Readiness gates the customer-facing menu, ordering and reservation flows, and
 * drives the owner-facing "your menu is hidden" banner.
 */

const PAYMENT_READY_SQL = (alias = "b") =>
  `(${alias}.paymongo_test_connected = 1
     OR (${alias}.paymongo_mode = 'live'
         AND ${alias}.paymongo_live_secret_key IS NOT NULL AND ${alias}.paymongo_live_secret_key <> ''
         AND ${alias}.paymongo_webhook_secret IS NOT NULL AND ${alias}.paymongo_webhook_secret <> ''))`;

const SELECT_PAYMENT_READY_SQL = (alias = "b", as = "payments_ready") =>
  `${PAYMENT_READY_SQL(alias)} AS ${as}`;

function isPaymentReady(row) {
  if (!row) return false;
  if (Number(row.paymongo_test_connected) === 1) return true;
  const isLive = String(row.paymongo_mode || "").toLowerCase() === "live";
  return isLive && Boolean(row.paymongo_live_secret_key) && Boolean(row.paymongo_webhook_secret);
}

async function loadPaymentReadiness(barId, conn = pool) {
  const [[row]] = await conn.query(
    `SELECT paymongo_mode, paymongo_test_connected,
            paymongo_live_secret_key, paymongo_webhook_secret
     FROM bars
     WHERE id = ?
     LIMIT 1`,
    [barId]
  );
  return isPaymentReady(row);
}

/**
 * Every gated write answers identically. The message is deliberately customer
 * friendly and free of internal vocabulary (no processor names, no key state).
 */
function paymentsNotReadyResponse(res, message) {
  return res.status(403).json({
    success: false,
    code: "PAYMENTS_NOT_READY",
    message: message || "This venue isn't taking orders right now. Please check back soon.",
  });
}

module.exports = {
  PAYMENT_READY_SQL,
  SELECT_PAYMENT_READY_SQL,
  isPaymentReady,
  loadPaymentReadiness,
  paymentsNotReadyResponse,
};
