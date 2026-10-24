const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const { logAudit, auditContext } = require("../utils/audit");

// ═══════════════════════════════════════════════════════════════════════════
// PAYOUT MANAGEMENT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /payouts/my — Get bar owner's payout history
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, bar_id } = req.query;

    // Get owner's bars
    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) {
      return res.status(404).json({ success: false, message: "Bar owner not found" });
    }
    const ownerId = owners[0].id;

    const [bars] = await pool.query(
      "SELECT id FROM bars WHERE owner_id = ?",
      [ownerId]
    );
    const barIds = bars.map(b => b.id);

    if (!barIds.length) {
      return res.json({ success: true, data: [] });
    }

    let where = `WHERE p.bar_id IN (${barIds.map(() => '?').join(',')})`;
    const params = [...barIds];

    if (status) {
      where += " AND p.status = ?";
      params.push(status);
    }
    if (bar_id) {
      where += " AND p.bar_id = ?";
      params.push(bar_id);
    }

    const [payouts] = await pool.query(
      `SELECT p.*, b.name AS bar_name,
              pt.reference_id AS payment_reference,
              pt.payment_type
       FROM payouts p
       JOIN bars b ON p.bar_id = b.id
       LEFT JOIN payment_transactions pt ON p.payment_transaction_id = pt.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT 100`,
      params
    );

    return res.json({ success: true, data: payouts });
  } catch (err) {
    console.error("GET MY PAYOUTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * SUPER ADMIN: POST /payouts/admin/complete/:id — Finalize payout as completed
 */
router.post("/admin/complete/:id", requireAuth, async (req, res) => {
  try {
    const [userRoles] = await pool.query(
      "SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? LIMIT 1",
      [req.user.id]
    );
    if (!userRoles.length || userRoles[0].name !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const payoutId = parseInt(req.params.id);
    const [payouts] = await pool.query(
      "SELECT * FROM payouts WHERE id = ? LIMIT 1",
      [payoutId]
    );
    if (!payouts.length) {
      return res.status(404).json({ success: false, message: "Payout not found" });
    }

    const payout = payouts[0];
    if (!['sent', 'processing', 'pending'].includes(String(payout.status || '').toLowerCase())) {
      return res.status(400).json({ success: false, message: "Payout is not eligible for completion" });
    }

    await pool.query(
      "UPDATE payouts SET status = 'completed', processed_at = NOW() WHERE id = ?",
      [payoutId]
    );

    logAudit(null, {
      bar_id: payout.bar_id,
      user_id: req.user.id,
      action: "COMPLETE_PAYOUT",
      entity: "payouts",
      entity_id: payoutId,
      details: { net_amount: payout.net_amount },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Payout marked as completed", data: { id: payoutId, status: 'completed' } });
  } catch (err) {
    console.error("COMPLETE PAYOUT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /payouts/my/summary — Get payout summary statistics
 */
router.get("/my/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) {
      return res.status(404).json({ success: false, message: "Bar owner not found" });
    }
    const ownerId = owners[0].id;

    const [bars] = await pool.query(
      "SELECT id FROM bars WHERE owner_id = ?",
      [ownerId]
    );
    const barIds = bars.map(b => b.id);

    if (!barIds.length) {
      return res.json({ success: true, data: { total: 0, pending: 0, sent: 0, completed: 0, processing: 0 } });
    }

    const [summary] = await pool.query(
      `SELECT 
         SUM(net_amount) AS total_net_amount,
         SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END) AS pending_amount,
         SUM(CASE WHEN status = 'sent' THEN net_amount ELSE 0 END) AS sent_amount,
         SUM(CASE WHEN status = 'completed' THEN net_amount ELSE 0 END) AS completed_amount,
         SUM(CASE WHEN status = 'processing' THEN net_amount ELSE 0 END) AS processing_amount,
         COUNT(*) AS total_count,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
         COUNT(CASE WHEN status = 'sent' THEN 1 END) AS sent_count,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_count,
         COUNT(CASE WHEN status = 'processing' THEN 1 END) AS processing_count
       FROM payouts
       WHERE bar_id IN (${barIds.map(() => '?').join(',')})`,
      barIds
    );

    return res.json({ success: true, data: summary[0] });
  } catch (err) {
    console.error("GET PAYOUT SUMMARY ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * SUPER ADMIN: GET /payouts/admin/all — Get all payouts
 */
router.get("/admin/all", requireAuth, async (req, res) => {
  try {
    // Verify super admin
    const [userRoles] = await pool.query(
      "SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? LIMIT 1",
      [req.user.id]
    );
    if (!userRoles.length || userRoles[0].name !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { status, bar_id, limit = 100 } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (status) {
      where += " AND p.status = ?";
      params.push(status);
    }
    if (bar_id) {
      where += " AND p.bar_id = ?";
      params.push(bar_id);
    }

    const [payouts] = await pool.query(
      `SELECT p.*, b.name AS bar_name, b.gcash_number, b.gcash_account_name,
              pt.reference_id AS payment_reference,
              pt.payment_type,
              u.first_name AS owner_first_name,
              u.last_name AS owner_last_name,
              u.email AS owner_email
       FROM payouts p
       JOIN bars b ON p.bar_id = b.id
       LEFT JOIN payment_transactions pt ON p.payment_transaction_id = pt.id
       LEFT JOIN bar_owners bo ON b.owner_id = bo.id
       LEFT JOIN users u ON bo.user_id = u.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    return res.json({ success: true, data: payouts });
  } catch (err) {
    console.error("ADMIN GET PAYOUTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * SUPER ADMIN: POST /payouts/admin/process/:id — Process payout
 */
router.post("/admin/process/:id", requireAuth, async (req, res) => {
  try {
    // Verify super admin
    const [userRoles] = await pool.query(
      "SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? LIMIT 1",
      [req.user.id]
    );
    if (!userRoles.length || userRoles[0].name !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

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

    if (!['pending', 'processing', 'sent'].includes(String(payout.status || '').toLowerCase())) {
      return res.status(400).json({ success: false, message: "Payout already processed or cancelled" });
    }

    await pool.query(
      `UPDATE payouts 
       SET status = 'sent', payout_reference = ?, notes = ?, processed_at = NOW()
       WHERE id = ?`,
      [payout_reference || null, notes || null, payoutId]
    );

    logAudit(null, {
      bar_id: payout.bar_id,
      user_id: req.user.id,
      action: "PROCESS_PAYOUT",
      entity: "payouts",
      entity_id: payoutId,
      details: { net_amount: payout.net_amount, payout_reference },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: "Payout marked as sent successfully",
      data: { id: payoutId, status: 'sent' },
    });
  } catch (err) {
    console.error("PROCESS PAYOUT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * SUPER ADMIN: POST /payouts/admin/bulk-process — Process multiple payouts
 */
router.post("/admin/bulk-process", requireAuth, async (req, res) => {
  try {
    // Verify super admin
    const [userRoles] = await pool.query(
      "SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? LIMIT 1",
      [req.user.id]
    );
    if (!userRoles.length || userRoles[0].name !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { payout_ids, payout_reference, notes } = req.body;

    if (!payout_ids || !Array.isArray(payout_ids) || !payout_ids.length) {
      return res.status(400).json({ success: false, message: "payout_ids array required" });
    }

    const placeholders = payout_ids.map(() => '?').join(',');
    await pool.query(
      `UPDATE payouts 
       SET status = 'sent', payout_reference = ?, notes = ?, processed_at = NOW()
       WHERE id IN (${placeholders}) AND status IN ('pending', 'processing', 'sent')`,
      [payout_reference || null, notes || null, ...payout_ids]
    );

    return res.json({
      success: true,
      message: `Processed ${payout_ids.length} payouts`,
      data: { processed_count: payout_ids.length },
    });
  } catch (err) {
    console.error("BULK PROCESS PAYOUTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
