/**
 * Bar activation gate: `pending` -> `active`.
 *
 * A bar enters the world as `status = 'pending'` when a super admin approves a
 * business registration (or creates one manually). In that state it can be
 * managed and configured by its owner, but it is not publicly visible, cannot
 * take orders or reservations (every public query filters `status = 'active'`),
 * and its owner can still log in (login only blocks `inactive` / `suspended`).
 *
 * It becomes `active` only once the payment setup is genuinely usable:
 *   - test mode verified against PayMongo with the owner's own test key, OR
 *   - live mode complete: owner live key stored AND a per-bar webhook signing
 *     secret stored (without the signing secret every live delivery would be
 *     rejected, so "live" would be a lie).
 *
 * (a) "super admin approved the documents" is implied by the bar existing:
 *     both creation paths only run after that approval, and `pending` is the
 *     only status either of them writes.
 */

let lifecycleColumnCache = null;

async function hasLifecycleColumn(queryable) {
  if (lifecycleColumnCache !== null) return lifecycleColumnCache;
  try {
    const [rows] = await queryable.query(
      "SHOW COLUMNS FROM bars LIKE 'lifecycle_status'"
    );
    lifecycleColumnCache = rows.length > 0;
  } catch (_) {
    lifecycleColumnCache = false;
  }
  return lifecycleColumnCache;
}

function nonEmpty(v) {
  return v !== null && v !== undefined && String(v).length > 0;
}

const SELECT_STATE = `
  SELECT status, lifecycle_status, paymongo_mode, paymongo_test_connected,
         paymongo_webhook_secret, paymongo_live_secret_key
  FROM bars WHERE id = ? LIMIT 1`;

/**
 * Read-only answer to "may this bar go active yet?".
 * Returns { exists, status, ready, reason }.
 */
async function evaluateBarActivation(queryable, barId) {
  const [[bar]] = await queryable.query(SELECT_STATE, [barId]);
  if (!bar) return { exists: false, status: null, ready: false, reason: "bar_not_found" };

  const status = String(bar.status || "").toLowerCase();
  const mode = String(bar.paymongo_mode || "").toLowerCase();

  if (status === "active") {
    return { exists: true, status, ready: true, reason: "already_active" };
  }
  if (status !== "pending") {
    // `inactive` is a deliberate suspension — never auto-promote out of it.
    return { exists: true, status, ready: false, reason: "not_pending" };
  }

  if (Number(bar.paymongo_test_connected) === 1) {
    return { exists: true, status, ready: true, reason: "ready_test" };
  }

  if (mode === "live" && nonEmpty(bar.paymongo_webhook_secret) && nonEmpty(bar.paymongo_live_secret_key)) {
    return { exists: true, status, ready: true, reason: "ready_live" };
  }

  if (mode === "live") {
    return { exists: true, status, ready: false, reason: "pending_live_setup" };
  }
  return { exists: true, status, ready: false, reason: "pending_paymongo_setup" };
}

/**
 * Promote a pending bar to active when the payment setup is complete.
 * Idempotent and safe to call after any payment-setup write.
 *
 * Returns { activated, ready, reason, status }.
 */
async function promoteBarIfReady(queryable, barId) {
  const state = await evaluateBarActivation(queryable, barId);
  if (!state.exists || !state.ready || state.status !== "pending") {
    return { activated: false, ...state };
  }

  const hasLifecycle = await hasLifecycleColumn(queryable);
  const sets = ["status = 'active'", "updated_at = NOW()"];
  if (hasLifecycle) sets.push("lifecycle_status = 'active'");

  const [result] = await queryable.query(
    `UPDATE bars SET ${sets.join(", ")} WHERE id = ? AND status = 'pending'`,
    [barId]
  );

  if (result.affectedRows) {
    console.log(`BAR_ACTIVATED: bar ${barId} promoted pending -> active (${state.reason})`);
    return { activated: true, ...state, status: "active" };
  }
  return { activated: false, ...state };
}

module.exports = {
  evaluateBarActivation,
  promoteBarIfReady,
};
