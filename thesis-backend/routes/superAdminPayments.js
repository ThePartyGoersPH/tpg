const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const platformSettings = require("../services/platformSettingsService");
const { logAudit, auditContext } = require("../utils/audit");
const { createNotification } = require("../utils/notificationService");

// ═══════════════════════════════════════════════════════════════════════════
// SUPER ADMIN PAYMENT CONTROL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

async function ensureSuperAdmin(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT r.name AS role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );
    if (String(rows[0]?.role_name || '').trim().toUpperCase() !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access required" });
    }
    req.user.role_name = rows[0].role_name;
    return next();
  } catch (err) {
    console.error("SUPER_ADMIN CHECK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

router.use(requireAuth, ensureSuperAdmin);

/**
 * Money that settled straight to the bar owner (Stripe Connect / bar live keys)
 * never passes through the platform, so it is not platform revenue. The
 * settlement columns are optional so this route still works before the migration
 * has been applied.
 */
let settlementColumnSupport = null;
async function directSettlementFilter() {
  if (settlementColumnSupport === null) {
    try {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_transactions'
           AND COLUMN_NAME = 'settled_directly'`
      );
      settlementColumnSupport = cols.length > 0;
    } catch (_) {
      settlementColumnSupport = false;
    }
  }
  return settlementColumnSupport ? "AND COALESCE(pt.settled_directly, 0) = 0" : "";
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. GLOBAL PAYMENT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /super-admin-payments/dashboard
 * Returns: Total platform revenue, transactions, payouts, platform earnings
 */
router.get("/dashboard", async (req, res) => {
  try {
    const { from, to } = req.query;
    let txDateFilter = "";
    let payoutDateFilter = "";
    const params = [];

    if (from && to) {
      txDateFilter = "AND pt.created_at BETWEEN ? AND ?";
      payoutDateFilter = "AND p.created_at BETWEEN ? AND ?";
      params.push(from, to);
    }

    // Revenue split. total_revenue counts settled payments only — summing every
    // row also counted pending/cancelled attempts as revenue. Payments that
    // settled directly to the bar owner are excluded because the platform never
    // received that money.
    const directFilter = await directSettlementFilter();
    const [revenueData] = await pool.query(
      `SELECT 
         COUNT(*) AS total_transactions,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_revenue,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_revenue,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_revenue,
         COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0) AS failed_revenue,
         COALESCE(SUM(CASE WHEN status = 'cancelled' THEN amount ELSE 0 END), 0) AS cancelled_revenue
       FROM payment_transactions pt
       WHERE 1=1 ${directFilter} ${txDateFilter}`,
      params
    );

    // Total Payouts
    const [payoutData] = await pool.query(
      `SELECT 
         COUNT(*) AS total_payouts,
         COALESCE(SUM(gross_amount), 0) AS total_gross_amount,
         COALESCE(SUM(platform_fee_amount), 0) AS total_platform_fees,
         COALESCE(SUM(net_amount), 0) AS total_net_amount,
         COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.net_amount ELSE 0 END), 0) AS pending_payouts,
         COALESCE(SUM(CASE WHEN p.status = 'sent' THEN p.net_amount ELSE 0 END), 0) AS sent_payouts,
         COALESCE(SUM(CASE WHEN p.status IN ('sent', 'completed') THEN p.net_amount ELSE 0 END), 0) AS completed_payouts,
         COALESCE(SUM(CASE WHEN p.status = 'processing' THEN p.net_amount ELSE 0 END), 0) AS processing_payouts
         FROM payouts p
         LEFT JOIN payment_transactions pt ON pt.id = p.payment_transaction_id
         WHERE 1=1 ${directFilter} ${payoutDateFilter}`,
      params
    );

    // Payment Methods Breakdown
    const [paymentMethods] = await pool.query(
      `SELECT 
         payment_method,
         COUNT(*) AS count,
         COALESCE(SUM(amount), 0) AS total_amount
         FROM payment_transactions pt
         WHERE status = 'paid' ${directFilter} ${txDateFilter}
         GROUP BY payment_method`,
      params
    );

    // Subscription Revenue
    const [subscriptionRevenue] = await pool.query(
      `SELECT 
         COUNT(*) AS total_subscriptions,
         COALESCE(SUM(s.amount_paid), 0) AS total_subscription_revenue,
         COALESCE(SUM(CASE WHEN s.status = 'active' THEN s.amount_paid ELSE 0 END), 0) AS active_subscription_revenue,
         COALESCE(SUM(CASE WHEN s.status = 'pending' THEN s.amount_paid ELSE 0 END), 0) AS pending_subscription_revenue
       FROM subscriptions s
       WHERE s.created_at IS NOT NULL ${from && to ? 'AND s.created_at BETWEEN ? AND ?' : ''}`,
      from && to ? [from, to] : []
    );

    // Get platform fee percentage from settings
    const platformFeePercentage = await platformSettings.getPlatformFeePercentage(pool);

    return res.json({
      success: true,
      data: {
        revenue: revenueData[0],
        payouts: payoutData[0],
        platform_earnings: payoutData[0].total_platform_fees,
        platform_fee_percentage: platformFeePercentage,
        payment_methods: paymentMethods,
        subscription_revenue: subscriptionRevenue[0],
      },
    });
  } catch (err) {
    console.error("PAYMENT DASHBOARD ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /super-admin-payments/payouts/:id/complete
 * Finalize payout after it has been sent to bar owner
 */
router.post("/payouts/:id/complete", async (req, res) => {
  try {
    const payoutId = parseInt(req.params.id);

    const [payouts] = await pool.query(
      "SELECT * FROM payouts WHERE id = ? LIMIT 1",
      [payoutId]
    );

    if (!payouts.length) {
      return res.status(404).json({ success: false, message: "Payout not found" });
    }

    const payout = payouts[0];
    if (payout.status === 'completed') {
      return res.status(400).json({ success: false, message: "Payout already completed" });
    }
    if (payout.status !== 'sent') {
      return res.status(400).json({ success: false, message: "Payout must be marked as sent before it can be completed" });
    }
    if (!String(payout.payout_reference || '').trim()) {
      return res.status(400).json({ success: false, message: "Payout reference is required before completion" });
    }

    const [updated] = await pool.query(
      `UPDATE payouts 
       SET status = 'completed', processed_at = NOW()
       WHERE id = ? AND status = 'sent' AND payout_reference IS NOT NULL AND TRIM(payout_reference) <> ''`,
      [payoutId]
    );
    if (!updated.affectedRows) {
      return res.status(409).json({ success: false, message: "Payout was already processed or is no longer eligible" });
    }

    // Notify bar owner
    try {
      const [ownerRows] = await pool.query(
        `SELECT bo.user_id FROM bar_owners bo WHERE bo.id = ? LIMIT 1`,
        [payout.bar_owner_id]
      );
      if (ownerRows.length) {
        const netFormatted = Number(payout.net_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read)
           VALUES (?, 'payout', 'Payout Completed', ?, ?, 'payout', 0)`,
          [
            ownerRows[0].user_id,
            `Your payout of ₱${netFormatted} has been completed and confirmed.`,
            payoutId,
          ]
        );
      }
    } catch (_) {}

    logAudit(null, {
      bar_id: payout.bar_id,
      user_id: req.user.id,
      action: "COMPLETE_PAYOUT",
      entity: "payouts",
      entity_id: payoutId,
      details: { net_amount: payout.net_amount },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Payout completed successfully" });
  } catch (err) {
    console.error("COMPLETE PAYOUT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. PAYOUT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /super-admin-payments/payouts
 * Query: status, bar_id, from, to, search, limit
 */
router.get("/payouts", async (req, res) => {
  try {
    const { status, bar_id, from, to, search, limit = 100 } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (status) {
      where += " AND p.status = ?";
      params.push(status);
    }
    if (bar_id) {
      where += " AND p.bar_id = ?";
      params.push(parseInt(bar_id));
    }
    if (from && to) {
      where += " AND p.created_at BETWEEN ? AND ?";
      params.push(from, to);
    }
    if (search) {
      where += " AND (b.name LIKE ? OR p.gcash_number LIKE ? OR p.payout_reference LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const [payouts] = await pool.query(
      `SELECT 
         p.*, 
         b.name AS bar_name,
         b.gcash_number AS bar_gcash_number,
         b.gcash_account_name AS bar_gcash_account_name,
         pt.reference_id AS payment_reference,
         pt.payment_type,
         CONCAT(u.first_name, ' ', u.last_name) AS owner_name,
         u.email AS owner_email
       FROM payouts p
       LEFT JOIN bars b ON p.bar_id = b.id
       LEFT JOIN payment_transactions pt ON p.payment_transaction_id = pt.id
       LEFT JOIN bar_owners bo ON b.owner_id = bo.id
       LEFT JOIN users u ON bo.user_id = u.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    // Summary for current filter
    const [summary] = await pool.query(
      `SELECT 
         COUNT(*) AS total_count,
         COALESCE(SUM(p.gross_amount), 0) AS total_gross,
         COALESCE(SUM(p.platform_fee_amount), 0) AS total_fees,
         COALESCE(SUM(p.net_amount), 0) AS total_net,
         COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.net_amount ELSE 0 END), 0) AS pending_amount,
         COALESCE(SUM(CASE WHEN p.status = 'sent' THEN p.net_amount ELSE 0 END), 0) AS sent_amount,
         COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.net_amount ELSE 0 END), 0) AS completed_amount
       FROM payouts p
       LEFT JOIN bars b ON p.bar_id = b.id
       ${where}`,
      params
    );

    return res.json({
      success: true,
      data: {
        payouts,
        summary: summary[0],
      },
    });
  } catch (err) {
    console.error("GET PAYOUTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /super-admin-payments/payouts/:id/mark-sent
 * Mark payout as sent
 */
router.post("/payouts/:id/mark-sent", async (req, res) => {
  try {
    const payoutId = parseInt(req.params.id);
    const { payout_reference, notes } = req.body;

    const [payouts] = await pool.query(
      "SELECT * FROM payouts WHERE id = ? LIMIT 1",
      [payoutId]
    );

    if (!payouts.length) {
      return res.status(404).json({ success: false, message: "Payout not found" });
    }

    const payout = payouts[0];

    if (payout.status === 'sent') {
      return res.status(400).json({ success: false, message: "Payout already marked as sent" });
    }

    if (payout.status === 'completed') {
      return res.status(400).json({ success: false, message: "Payout already marked as sent" });
    }

    if (payout.status === 'cancelled') {
      return res.status(400).json({ success: false, message: "Cannot process cancelled payout" });
    }
    if (!['pending', 'processing'].includes(String(payout.status || '').toLowerCase())) {
      return res.status(400).json({ success: false, message: "Payout cannot be marked as sent from current status" });
    }
    if (!String(payout_reference || '').trim()) {
      return res.status(400).json({ success: false, message: "Payout reference is required" });
    }

    const [updated] = await pool.query(
      `UPDATE payouts 
       SET status = 'sent', payout_reference = ?, notes = ?, processed_at = NOW()
       WHERE id = ? AND status IN ('pending', 'processing')`,
      [String(payout_reference).trim(), notes || null, payoutId]
    );
    if (!updated.affectedRows) {
      return res.status(409).json({ success: false, message: "Payout was already processed or is no longer eligible" });
    }

    // Notify bar owner
    try {
      const [ownerRows] = await pool.query(
        `SELECT bo.user_id FROM bar_owners bo WHERE bo.id = ? LIMIT 1`,
        [payout.bar_owner_id]
      );
      if (ownerRows.length) {
        const netFormatted = Number(payout.net_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 });
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read)
           VALUES (?, 'payout', 'Payout Sent', ?, ?, 'payout', 0)`,
          [
            ownerRows[0].user_id,
            `Your payout of ₱${netFormatted} has been sent via ${payout.payout_method || 'GCash'}${payout_reference ? ` (Ref: ${payout_reference})` : ''}.`,
            payoutId,
          ]
        );
      }
    } catch (_) {}

    logAudit(null, {
      bar_id: payout.bar_id,
      user_id: req.user.id,
      action: "MARK_PAYOUT_SENT",
      entity: "payouts",
      entity_id: payoutId,
      details: { net_amount: payout.net_amount, payout_reference },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: "Payout marked as sent successfully",
    });
  } catch (err) {
    console.error("MARK PAYOUT SENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /super-admin-payments/payouts/bulk-mark-sent
 * Mark multiple payouts as sent
 */
router.post("/payouts/bulk-mark-sent", async (req, res) => {
  try {
    const { payout_ids, payout_reference, notes } = req.body;

    if (!payout_ids || !Array.isArray(payout_ids) || !payout_ids.length) {
      return res.status(400).json({ success: false, message: "payout_ids array required" });
    }
    if (!String(payout_reference || '').trim()) {
      return res.status(400).json({ success: false, message: "Payout reference is required" });
    }

    const placeholders = payout_ids.map(() => '?').join(',');
    const [result] = await pool.query(
      `UPDATE payouts 
       SET status = 'sent', payout_reference = ?, notes = ?, processed_at = NOW()
       WHERE id IN (${placeholders}) AND status IN ('pending', 'processing')`,
      [String(payout_reference).trim(), notes || null, ...payout_ids]
    );

    return res.json({
      success: true,
      message: `Processed ${result.affectedRows} payouts`,
      data: { processed_count: result.affectedRows },
    });
  } catch (err) {
    console.error("BULK MARK SENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /super-admin-payments/payouts/bulk-complete
 * Complete multiple payouts at once
 */
router.post("/payouts/bulk-complete", async (req, res) => {
  try {
    const { payout_ids } = req.body;

    if (!payout_ids || !Array.isArray(payout_ids) || !payout_ids.length) {
      return res.status(400).json({ success: false, message: "payout_ids array required" });
    }

    const placeholders = payout_ids.map(() => '?').join(',');
    
    // Get payouts to notify bar owners
    const [payouts] = await pool.query(
      `SELECT p.id, p.bar_owner_id, p.net_amount, bo.user_id
       FROM payouts p
       LEFT JOIN bar_owners bo ON p.bar_owner_id = bo.id
      WHERE p.id IN (${placeholders}) AND p.status = 'sent' AND p.payout_reference IS NOT NULL AND TRIM(p.payout_reference) <> ''`,
      payout_ids
    );

    // Update payouts to completed
    const [result] = await pool.query(
      `UPDATE payouts 
       SET status = 'completed', processed_at = NOW()
      WHERE id IN (${placeholders}) AND status = 'sent' AND payout_reference IS NOT NULL AND TRIM(payout_reference) <> ''`,
      payout_ids
    );

    // Group payouts by bar owner to send one notification per owner
    const ownerPayouts = {};
    for (const payout of payouts) {
      if (payout.user_id) {
        if (!ownerPayouts[payout.user_id]) {
          ownerPayouts[payout.user_id] = {
            user_id: payout.user_id,
            total_amount: 0,
            payout_count: 0,
            payout_ids: []
          };
        }
        ownerPayouts[payout.user_id].total_amount += Number(payout.net_amount || 0);
        ownerPayouts[payout.user_id].payout_count += 1;
        ownerPayouts[payout.user_id].payout_ids.push(payout.id);
      }
    }

    // Send one notification per bar owner with total amount
    for (const userId in ownerPayouts) {
      const ownerData = ownerPayouts[userId];
      try {
        const totalFormatted = ownerData.total_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 });
        const message = ownerData.payout_count === 1
          ? `Your payout of ₱${totalFormatted} has been completed and confirmed.`
          : `Your ${ownerData.payout_count} payouts totaling ₱${totalFormatted} have been completed and confirmed.`;
        
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read)
           VALUES (?, 'payout', 'Payout Completed', ?, ?, 'payout', 0)`,
          [
            userId,
            message,
            ownerData.payout_ids[0], // Reference first payout ID
          ]
        );
      } catch (_) {
        // Non-fatal notification error
      }
    }

    return res.json({
      success: true,
      message: `Completed ${result.affectedRows} payouts`,
      data: { processed_count: result.affectedRows },
    });
  } catch (err) {
    console.error("BULK COMPLETE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. BAR PAYMENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /super-admin-payments/bar-configs
 * Get all bars with their payout configurations
 */
router.get("/bar-configs", async (req, res) => {
  try {
    const { search, status, limit = 100 } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (search) {
      where += " AND (b.name LIKE ? OR b.gcash_number LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (status) {
      where += " AND b.status = ?";
      params.push(status);
    }

    const [bars] = await pool.query(
      `SELECT 
         b.id, b.name, b.gcash_number, b.gcash_account_name, b.status,
         b.payout_enabled,
         CONCAT(u.first_name, ' ', u.last_name) AS owner_name,
         u.email AS owner_email, u.phone_number AS owner_phone,
         (SELECT COUNT(*) FROM payouts WHERE bar_id = b.id AND status = 'pending') AS pending_payouts,
         (SELECT COALESCE(SUM(net_amount), 0) FROM payouts WHERE bar_id = b.id AND status = 'pending') AS pending_amount,
         (SELECT COALESCE(SUM(net_amount), 0) FROM payouts WHERE bar_id = b.id AND status IN ('sent', 'completed')) AS total_paid_out
       FROM bars b
       LEFT JOIN bar_owners bo ON b.owner_id = bo.id
       LEFT JOIN users u ON bo.user_id = u.id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    return res.json({ success: true, data: bars });
  } catch (err) {
    console.error("GET BAR CONFIGS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PUT /super-admin-payments/bar-configs/:barId
 * Update bar payout configuration
 */
router.put("/bar-configs/:barId", async (req, res) => {
  try {
    const barId = parseInt(req.params.barId);
    const { gcash_number, gcash_account_name, payout_enabled } = req.body;

    const [bars] = await pool.query("SELECT id FROM bars WHERE id = ? LIMIT 1", [barId]);
    if (!bars.length) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }

    const updates = [];
    const params = [];

    if (gcash_number !== undefined) {
      updates.push("gcash_number = ?");
      params.push(gcash_number);
    }
    if (gcash_account_name !== undefined) {
      updates.push("gcash_account_name = ?");
      params.push(gcash_account_name);
    }
    if (payout_enabled !== undefined) {
      updates.push("payout_enabled = ?");
      params.push(payout_enabled ? 1 : 0);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    params.push(barId);
    await pool.query(
      `UPDATE bars SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    logAudit(null, {
      bar_id: barId,
      user_id: req.user.id,
      action: "UPDATE_BAR_PAYOUT_CONFIG",
      entity: "bars",
      entity_id: barId,
      details: req.body,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Bar payout configuration updated" });
  } catch (err) {
    console.error("UPDATE BAR CONFIG ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * POST /super-admin-payments/bar-configs/:barId/disable-payout
 * Disable payout for a suspicious bar
 */
router.post("/bar-configs/:barId/disable-payout", async (req, res) => {
  try {
    const barId = parseInt(req.params.barId);
    const { reason } = req.body;

    const [bars] = await pool.query("SELECT id, name FROM bars WHERE id = ? LIMIT 1", [barId]);
    if (!bars.length) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }

    await pool.query(
      "UPDATE bars SET payout_enabled = 0 WHERE id = ?",
      [barId]
    );

    logAudit(null, {
      bar_id: barId,
      user_id: req.user.id,
      action: "DISABLE_BAR_PAYOUT",
      entity: "bars",
      entity_id: barId,
      details: { reason: reason || 'Suspicious activity' },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Payout disabled for this bar" });
  } catch (err) {
    console.error("DISABLE PAYOUT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. SYSTEM SETTINGS (Platform Fee, Payment Control)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /super-admin-payments/settings
 * Get all payment-related system settings
 */
router.get("/settings", async (req, res) => {
  try {
    const [settings] = await pool.query(
      `SELECT setting_key, setting_value, description, updated_at 
       FROM platform_settings 
       WHERE setting_key IN ('platform_fee_percentage', 'payments_enabled', 'paymongo_public_key', 'paymongo_webhook_secret')
       ORDER BY setting_key`
    );

    // Secrets never leave this endpoint — not to the super admin panel, not to
    // anyone who can reach the API. Only presence (and the key type prefix) is
    // reported, so the UI can still show "configured / not configured".
    const SECRET_KEYS = new Set([
      'paymongo_webhook_secret',
      'paymongo_secret_key',
      'paymongo_live_secret_key',
    ]);

    const settingsMap = {};
    settings.forEach(s => {
      if (SECRET_KEYS.has(s.setting_key)) {
        settingsMap[s.setting_key] = {
          value: null,
          configured: Boolean(s.setting_value),
          // First 5 chars only: enough to show the key kind (whsk_/sk_), never
          // enough to reconstruct or use it.
          key_type: s.setting_value ? String(s.setting_value).slice(0, 5) : null,
          description: s.description,
          updated_at: s.updated_at,
        };
        return;
      }
      settingsMap[s.setting_key] = {
        value: s.setting_value,
        description: s.description,
        updated_at: s.updated_at,
      };
    });

    return res.json({ success: true, data: settingsMap });
  } catch (err) {
    console.error("GET SETTINGS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PUT /super-admin-payments/settings
 * Update payment system settings
 */
router.put("/settings", async (req, res) => {
  try {
    const { platform_fee_percentage, payments_enabled } = req.body;

    if (platform_fee_percentage !== undefined) {
      const fee = parseFloat(platform_fee_percentage);
      if (isNaN(fee) || fee < 0 || fee > 100) {
        return res.status(400).json({ success: false, message: "Platform fee must be between 0 and 100" });
      }

      await pool.query(
        `INSERT INTO platform_settings (setting_key, setting_value, description, updated_by)
         VALUES ('platform_fee_percentage', ?, 'Platform fee percentage for customer payments', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [fee.toFixed(2), req.user.id]
      );

      // Mirror to the Stripe test-mode display key so bar payout sections stay consistent.
      await pool.query(
        `INSERT INTO platform_settings (setting_key, setting_value, description, updated_by)
         VALUES ('stripe_platform_fee_percentage', ?, 'Mirror of global marketplace fee for display', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [fee.toFixed(2), req.user.id]
      );

      logAudit(null, {
        user_id: req.user.id,
        action: "UPDATE_PLATFORM_FEE",
        entity: "platform_settings",
        details: { platform_fee_percentage: fee },
        ...auditContext(req),
      });
    }

    if (payments_enabled !== undefined) {
      const enabled = payments_enabled ? '1' : '0';

      await pool.query(
        `INSERT INTO platform_settings (setting_key, setting_value, description, updated_by)
         VALUES ('payments_enabled', ?, 'Enable/disable global payment processing', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
        [enabled, req.user.id]
      );

      logAudit(null, {
        user_id: req.user.id,
        action: payments_enabled ? "ENABLE_PAYMENTS" : "DISABLE_PAYMENTS",
        entity: "platform_settings",
        details: { payments_enabled },
        ...auditContext(req),
      });
    }

    return res.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    console.error("UPDATE SETTINGS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
