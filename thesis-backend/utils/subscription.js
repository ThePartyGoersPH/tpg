const pool = require("../config/database");

// ── Grace period (configurable) ──
// Days after expiry before an active subscription is auto-downgraded.
// Override via env SUBSCRIPTION_GRACE_PERIOD_DAYS (e.g. 3, 7). Default: 0 (immediate).
const RAW_GRACE_DAYS = parseInt(process.env.SUBSCRIPTION_GRACE_PERIOD_DAYS, 10);
const GRACE_PERIOD_DAYS = Number.isFinite(RAW_GRACE_DAYS) ? RAW_GRACE_DAYS : 0;
const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

function getGracePeriodDays() {
  return GRACE_PERIOD_DAYS;
}

// Returns the active subscription row for an owner (joined with plan limits), or null.
async function getActiveSubscription(ownerId) {
  const [rows] = await pool.query(
    `SELECT s.*, sp.name AS plan_name, sp.display_name, sp.max_bars, sp.max_events, sp.max_promotions, sp.price, sp.billing_period
     FROM subscriptions s
     JOIN subscription_plans sp ON s.plan_id = sp.id
     WHERE s.bar_owner_id = ? AND s.status = 'active'
     ORDER BY s.created_at DESC LIMIT 1`,
    [ownerId]
  );
  return rows[0] || null;
}

// True if the subscription is expired beyond the grace period.
function isExpired(sub, now = Date.now()) {
  if (!sub || !sub.expires_at) return false;
  const expires = new Date(sub.expires_at).getTime();
  if (Number.isNaN(expires)) return false;
  return now > expires + GRACE_PERIOD_MS;
}

// Enforce expiry for an owner: if the active subscription is past its grace period,
// mark it 'expired', downgrade the owner to the free tier, and lock bars beyond the
// free limit. Idempotent: once marked expired, no further writes occur.
// Returns { subscription, tier, expired, expired_plan_name, downgraded }.
async function enforceExpiry(ownerId) {
  const sub = await getActiveSubscription(ownerId);
  if (!sub) {
    return { subscription: null, tier: "free", expired: false, expired_plan_name: null, downgraded: false };
  }
  if (!isExpired(sub)) {
    return { subscription: sub, tier: sub.plan_name, expired: false, expired_plan_name: null, downgraded: false };
  }

  const expiredPlanName = sub.plan_name;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "UPDATE subscriptions SET status = 'expired', cancelled_at = NOW() WHERE id = ?",
      [sub.id]
    );
    await conn.query(
      "UPDATE bar_owners SET subscription_tier = 'free', subscription_expires_at = NULL WHERE id = ?",
      [ownerId]
    );
    // Lock bars beyond the free limit (1) so expired accounts cannot keep using them.
    const [bars] = await conn.query(
      "SELECT id FROM bars WHERE owner_id = ? ORDER BY created_at ASC",
      [ownerId]
    );
    for (let i = 0; i < bars.length; i++) {
      const locked = i >= 1 ? 1 : 0;
      await conn.query("UPDATE bars SET is_locked = ? WHERE id = ?", [locked, bars[i].id]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { subscription: null, tier: "free", expired: true, expired_plan_name: expiredPlanName, downgraded: true };
}

// Effective subscription after expiry enforcement.
async function getEffectiveSubscription(ownerId) {
  const enforced = await enforceExpiry(ownerId);

  // Even after a downgrade has persisted (active row gone), surface the
  // "expired" display state from the most recent subscription row so the UI
  // can show "Plan Expired" + Renew rather than a free-plan current card.
  let expired = enforced.expired;
  let expiredPlanName = enforced.expired_plan_name;
  if (!enforced.subscription) {
    const [latest] = await pool.query(
      `SELECT s.status, sp.name AS plan_name
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.bar_owner_id = ?
       ORDER BY s.created_at DESC LIMIT 1`,
      [ownerId]
    );
    if (latest.length && latest[0].status === "expired") {
      expired = true;
      expiredPlanName = latest[0].plan_name;
    }
  }

  return {
    subscription: enforced.subscription,
    tier: enforced.tier,
    expired,
    expired_plan_name: expiredPlanName,
    downgraded: enforced.downgraded,
    grace_period_days: getGracePeriodDays(),
  };
}

// Check whether the owner has hit a plan limit for a given resource type.
// resourceType: 'events' | 'promotions' | 'bars' | 'photos'
// Returns { allowed, current, max, planName } where max=null means unlimited.
async function checkPlanLimit(ownerId, resourceType) {
  const eff = await getEffectiveSubscription(ownerId);
  const limitColumn = { events: 'max_events', promotions: 'max_promotions', bars: 'max_bars', photos: 'max_photos' }[resourceType];
  const table = { events: 'bar_events', promotions: 'promotions', bars: 'bars', photos: 'bar_videos' }[resourceType];

  let max = null;
  if (eff.subscription) {
    max = eff.subscription[limitColumn];
  } else {
    const [[freePlan]] = await pool.query(
      `SELECT ${limitColumn} AS val FROM subscription_plans WHERE name = 'free' LIMIT 1`
    );
    max = freePlan ? freePlan.val : null;
  }

  // NULL means unlimited
  if (max === null || max === undefined) {
    return { allowed: true, current: 0, max: null, planName: eff.subscription?.plan_name || 'free' };
  }

  const countFilter = resourceType === 'photos' ? " AND media_type = 'photo'" : '';
  const [[{ cnt }]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM ${table} WHERE bar_id IN (SELECT id FROM bars WHERE owner_id = (SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1))${countFilter}`,
    [ownerId]
  );

  return {
    allowed: cnt < max,
    current: cnt,
    max,
    planName: eff.subscription?.plan_name || 'free',
  };
}

module.exports = {
  GRACE_PERIOD_DAYS,
  getGracePeriodDays,
  getActiveSubscription,
  isExpired,
  enforceExpiry,
  getEffectiveSubscription,
  checkPlanLimit,
};
