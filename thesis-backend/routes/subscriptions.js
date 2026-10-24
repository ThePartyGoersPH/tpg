const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const { getEffectiveSubscription, getGracePeriodDays } = require("../utils/subscription");

// Super-admin role gate (same pattern as superAdmin.js)
async function ensureSuperAdmin(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );
    if (String(rows[0]?.role_name || '').trim().toUpperCase() !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    req.user.role_name = rows[0].role_name;
    return next();
  } catch (err) {
    console.error("SUPER_ADMIN CHECK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * Resolve the bar_owners record for the logged-in user.
 * Priority:
 *   1. Direct link: bar_owners.user_id = user.id
 *   2. Bar ownership chain: users.bar_id -> bars.owner_id -> bar_owners
 *      (handles accounts where the bar_owners.user_id back-link is missing/broken)
 * Returns the bar_owners row (with id, subscription_tier, subscription_expires_at)
 * or null when the user genuinely has no bar owner profile.
 */
async function resolveBarOwner(req) {
  const userId = req.user.id;
  const barId = req.user.bar_id;

  const [direct] = await pool.query(
    `SELECT id, user_id, subscription_tier, subscription_expires_at
     FROM bar_owners WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  if (direct.length) return direct[0];

  if (barId) {
    const [bars] = await pool.query(
      `SELECT owner_id FROM bars WHERE id = ? AND status != 'deleted' LIMIT 1`,
      [barId]
    );
    if (bars.length && bars[0].owner_id) {
      const [viaBar] = await pool.query(
        `SELECT id, user_id, subscription_tier, subscription_expires_at
         FROM bar_owners WHERE id = ? LIMIT 1`,
        [bars[0].owner_id]
      );
      if (viaBar.length) return viaBar[0];
    }
  }
  return null;
}

// ═══════════════════════════════════════════
// GET /subscriptions/plans — list available plans
// ═══════════════════════════════════════════
router.get("/plans", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sp.*,
              (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = sp.id AND s.status = 'active') AS active_subscriptions
       FROM subscription_plans sp
       WHERE sp.is_active = 1
       ORDER BY sp.sort_order ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET PLANS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /subscriptions/my — get current user's subscription
// ═══════════════════════════════════════════
router.get("/my", requireAuth, async (req, res) => {
  try {
    const owner = await resolveBarOwner(req);

    // Genuine first-time / no profile: return a friendly empty state (NOT an error).
    if (!owner) {
      return res.json({
        success: true,
        data: {
          subscription: null,
          pending_subscription: null,
          tier: "free",
          expires_at: null,
          usage: { bars: 0, events: 0, promotions: 0, photos: 0 },
          is_first_time: true,
        },
      });
    }

    // Enforce expiry server-side: expired active subs are marked 'expired',
    // the owner is downgraded to free, and bars beyond the free limit are locked.
    const eff = await getEffectiveSubscription(owner.id);
    const activeSub = eff.subscription; // null when expired/downgraded

    // Also check for a pending subscription
    const [pendingSubs] = await pool.query(
      `SELECT s.*, sp.name AS plan_name, sp.display_name, sp.max_bars, sp.max_events, sp.max_promotions, sp.price, sp.billing_period
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.bar_owner_id = ? AND s.status = 'pending'
       ORDER BY s.created_at DESC LIMIT 1`,
      [owner.id]
    );
    const pendingSub = pendingSubs.length ? pendingSubs[0] : null;

    // Count current usage
    const [barCount] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM bars WHERE owner_id = ? AND status != 'deleted'",
      [owner.id]
    );
    const [eventCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bar_events be
       JOIN bars b ON be.bar_id = b.id
       WHERE b.owner_id = ? AND be.status = 'active'`,
      [owner.id]
    );
    const [promoCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM promotions p
       JOIN bars b ON p.bar_id = b.id
       WHERE b.owner_id = ? AND p.status = 'active'`,
      [owner.id]
    );
    const [photoCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bar_videos bv
       JOIN bars b ON bv.bar_id = b.id
       WHERE b.owner_id = ? AND bv.media_type = 'photo'`,
      [owner.id]
    );

    return res.json({
      success: true,
      data: {
        subscription: activeSub,
        pending_subscription: pendingSub,
        tier: eff.tier,
        expires_at: activeSub?.expires_at || owner.subscription_expires_at || null,
        expired: eff.expired,
        expired_plan_name: eff.expired_plan_name || null,
        grace_period_days: getGracePeriodDays(),
        usage: {
          bars: barCount[0].cnt,
          events: eventCount[0].cnt,
          promotions: promoCount[0].cnt,
          photos: photoCount[0].cnt,
        },
      },
    });
  } catch (err) {
    console.error("GET MY SUBSCRIPTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// POST /subscriptions/subscribe — create/upgrade subscription
// ═══════════════════════════════════════════
router.post("/subscribe", requireAuth, async (req, res) => {
  try {
    const { plan_id, payment_method, payment_reference } = req.body;
    if (!plan_id) return res.status(400).json({ success: false, message: "Plan ID required" });

    const [plans] = await pool.query("SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1", [plan_id]);
    if (!plans.length) return res.status(404).json({ success: false, message: "Plan not found" });
    const plan = plans[0];

    const owner = await resolveBarOwner(req);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "No bar owner profile is linked to your account. Complete your business registration to manage subscriptions.",
      });
    }
    const ownerId = owner.id;

    // Cancel any existing pending subscription (replace with new request)
    await pool.query(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE bar_owner_id = ? AND status = 'pending'",
      [ownerId]
    );

    if (!payment_method) return res.status(400).json({ success: false, message: "Payment method required" });
    if (!payment_reference || !payment_reference.trim()) return res.status(400).json({ success: false, message: "Payment reference / transaction number required" });

    // Create subscription with status = 'pending' (awaits super admin approval)
    const [result] = await pool.query(
      `INSERT INTO subscriptions (bar_owner_id, plan_id, status, starts_at, expires_at, payment_method, payment_reference, amount_paid)
       VALUES (?, ?, 'pending', NOW(), NULL, ?, ?, ?)`,
      [ownerId, plan_id, payment_method, payment_reference.trim(), plan.price]
    );

    return res.json({
      success: true,
      message: `Payment submitted! Your ${plan.display_name} plan upgrade is pending admin approval.`,
      data: { subscription_id: result.insertId, plan: plan.name, status: "pending" },
    });
  } catch (err) {
    console.error("SUBSCRIBE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// POST /subscriptions/cancel — cancel subscription
// ═══════════════════════════════════════════
router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const owner = await resolveBarOwner(req);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: "No bar owner profile is linked to your account. Complete your business registration to manage subscriptions.",
      });
    }
    const ownerId = owner.id;

    // Cancel both active and pending subscriptions
    await pool.query(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE bar_owner_id = ? AND status IN ('active', 'pending')",
      [ownerId]
    );

    // Revert to free tier
    await pool.query(
      "UPDATE bar_owners SET subscription_tier = 'free', subscription_expires_at = NULL WHERE id = ?",
      [ownerId]
    );

    // Lock all bars except the first one
    const [allBars] = await pool.query(
      "SELECT id FROM bars WHERE owner_id = ? ORDER BY created_at ASC",
      [ownerId]
    );
    for (let i = 0; i < allBars.length; i++) {
      const locked = i >= 1 ? 1 : 0;
      await pool.query("UPDATE bars SET is_locked = ? WHERE id = ?", [locked, allBars[i].id]);
    }

    return res.json({
      success: true,
      message: "Subscription cancelled. Reverted to Free plan.",
    });
  } catch (err) {
    console.error("CANCEL SUBSCRIPTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// SUPER ADMIN: PUT /subscriptions/admin/plans/:id — update plan price
// ═══════════════════════════════════════════
router.put("/admin/plans/:id", requireAuth, ensureSuperAdmin, async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const { price } = req.body;

    if (price === undefined || price === null) {
      return res.status(400).json({ success: false, message: "Price is required" });
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ success: false, message: "Invalid price value" });
    }

    const [plans] = await pool.query("SELECT * FROM subscription_plans WHERE id = ? LIMIT 1", [planId]);
    if (!plans.length) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    await pool.query(
      "UPDATE subscription_plans SET price = ?, updated_at = NOW() WHERE id = ?",
      [priceNum, planId]
    );

    return res.json({
      success: true,
      message: `Updated ${plans[0].display_name} price to ${priceNum}`,
      data: { plan_id: planId, new_price: priceNum }
    });
  } catch (err) {
    console.error("UPDATE PLAN PRICE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// SUPER ADMIN: GET /subscriptions/admin/pending — list all pending subscriptions
// ═══════════════════════════════════════════
router.get("/admin/pending", requireAuth, ensureSuperAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.bar_owner_id, s.plan_id, s.status, s.payment_method, s.payment_reference,
              s.amount_paid, s.created_at,
              sp.name AS plan_name, sp.display_name AS plan_display_name, sp.price AS plan_price,
              sp.max_bars, sp.billing_period,
              u.first_name, u.last_name, u.email,
              bo.id AS owner_record_id
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       JOIN bar_owners bo ON s.bar_owner_id = bo.id
       JOIN users u ON bo.user_id = u.id
       WHERE s.status = 'pending'
       ORDER BY s.created_at ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET PENDING SUBSCRIPTIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// SUPER ADMIN: GET /subscriptions/admin/all — list all subscriptions (history)
// ═══════════════════════════════════════════
router.get("/admin/all", requireAuth, ensureSuperAdmin, async (req, res) => {
  try {
    const status = req.query.status; // optional filter
    let whereClause = "";
    const params = [];
    if (status) {
      whereClause = "WHERE s.status = ?";
      params.push(status);
    }
    const [rows] = await pool.query(
      `SELECT s.id, s.bar_owner_id, s.plan_id, s.status, s.payment_method, s.payment_reference,
              s.amount_paid, s.starts_at, s.expires_at, s.cancelled_at, s.created_at,
              sp.name AS plan_name, sp.display_name AS plan_display_name, sp.price AS plan_price,
              sp.max_bars, sp.billing_period,
              u.first_name, u.last_name, u.email
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       JOIN bar_owners bo ON s.bar_owner_id = bo.id
       JOIN users u ON bo.user_id = u.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT 100`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET ALL SUBSCRIPTIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// SUPER ADMIN: POST /subscriptions/admin/approve/:id — approve a pending subscription
// ═══════════════════════════════════════════
router.post("/admin/approve/:id", requireAuth, ensureSuperAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  let transactionStarted = false;
  try {
    const subId = parseInt(req.params.id, 10);
    const { start_date } = req.body || {};
    if (!Number.isSafeInteger(subId) || subId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid subscription id" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start_date || ""))) {
      return res.status(400).json({ success: false, message: "A valid start_date (YYYY-MM-DD) is required" });
    }
    const startDate = new Date(`${start_date}T00:00:00Z`);
    if (Number.isNaN(startDate.getTime()) || startDate.toISOString().slice(0, 10) !== start_date) {
      return res.status(400).json({ success: false, message: "Invalid start_date" });
    }

    // Fetch the pending subscription
    await conn.beginTransaction();
    transactionStarted = true;
    const [subs] = await conn.query(
      `SELECT s.*, sp.name AS plan_name, sp.display_name, sp.max_bars, sp.billing_period
       FROM subscriptions s
       JOIN subscription_plans sp ON s.plan_id = sp.id
       WHERE s.id = ? AND s.status = 'pending' LIMIT 1`,
      [subId]
    );
    if (!subs.length) {
      throw Object.assign(new Error("Pending subscription not found"), { statusCode: 404 });
    }
    const sub = subs[0];

    // Calculate expiry from the date selected by the Super Admin.
    let expiresAt = null;
    if (sub.billing_period === "monthly") {
      expiresAt = new Date(startDate);
      expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
    } else if (sub.billing_period === "yearly") {
      expiresAt = new Date(startDate);
      expiresAt.setUTCDate(expiresAt.getUTCDate() + 365);
    }

    // Cancel any existing active subscription for this owner
    await conn.query(
      "UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE bar_owner_id = ? AND status = 'active'",
      [sub.bar_owner_id]
    );

    // Activate the pending subscription
    const [activated] = await conn.query(
      "UPDATE subscriptions SET status = 'active', starts_at = ?, expires_at = ? WHERE id = ?",
      [startDate, expiresAt, subId]
    );
    if (!activated.affectedRows) throw Object.assign(new Error("Subscription could not be activated"), { statusCode: 409 });

    // Update bar_owners tier
    await conn.query(
      "UPDATE bar_owners SET subscription_tier = ?, subscription_expires_at = ? WHERE id = ?",
      [sub.plan_name, expiresAt, sub.bar_owner_id]
    );

    // Unlock bars up to plan limit
    const [allBars] = await conn.query(
      "SELECT id FROM bars WHERE owner_id = ? ORDER BY created_at ASC",
      [sub.bar_owner_id]
    );
    for (let i = 0; i < allBars.length; i++) {
      const locked = i >= sub.max_bars ? 1 : 0;
      await conn.query("UPDATE bars SET is_locked = ? WHERE id = ?", [locked, allBars[i].id]);
    }

    await conn.commit();
    transactionStarted = false;

    return res.json({
      success: true,
      message: `Approved ${sub.display_name} plan for owner #${sub.bar_owner_id}`,
      data: { subscription_id: subId, plan: sub.plan_name, expires_at: expiresAt },
    });
  } catch (err) {
    if (transactionStarted) await conn.rollback();
    console.error("APPROVE SUBSCRIPTION ERROR:", err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.statusCode ? err.message : "Server error" });
  } finally {
    conn.release();
  }
});

// ═══════════════════════════════════════════
// SUPER ADMIN: POST /subscriptions/admin/reject/:id — reject a pending subscription
// ═══════════════════════════════════════════
router.post("/admin/reject/:id", requireAuth, ensureSuperAdmin, async (req, res) => {
  try {
    const subId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    const [subs] = await pool.query(
      "SELECT id, bar_owner_id FROM subscriptions WHERE id = ? AND status = 'pending' LIMIT 1",
      [subId]
    );
    if (!subs.length) {
      return res.status(404).json({ success: false, message: "Pending subscription not found" });
    }

    await pool.query(
      "UPDATE subscriptions SET status = 'rejected', cancelled_at = NOW() WHERE id = ?",
      [subId]
    );

    return res.json({
      success: true,
      message: "Subscription request rejected.",
      data: { subscription_id: subId, reason: reason || null },
    });
  } catch (err) {
    console.error("REJECT SUBSCRIPTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
