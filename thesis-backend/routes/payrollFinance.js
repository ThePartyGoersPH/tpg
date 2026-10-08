const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { assertBarId } = require("../utils/barScope");
const { logAudit } = require("../utils/audit");

// Finance view of payroll runs (HR has already created/finalized; Finance releases)
router.get("/runs", requireAuth, requirePermission("finance_payroll_approve"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [rows] = await pool.query(
      `SELECT pr.id, pr.period_start, pr.period_end, pr.status, pr.finalized_at, pr.finance_approved_at,
              pr.finance_notes, CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
              COUNT(pi.id) AS item_count,
              COALESCE(SUM(pi.net_pay),0) AS net_total
       FROM payroll_runs pr
       LEFT JOIN payroll_items pi ON pi.payroll_run_id = pr.id
       LEFT JOIN users u ON u.id = pr.created_by
       WHERE pr.bar_id = ? GROUP BY pr.id ORDER BY pr.created_at DESC`,
      [barId]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

router.get("/runs/:id", requireAuth, requirePermission("finance_payroll_approve"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [pr] = await pool.query(
      `SELECT pr.*, CONCAT(u.first_name, ' ', u.last_name) AS created_by_name FROM payroll_runs pr
       LEFT JOIN users u ON u.id = pr.created_by WHERE pr.id = ? AND pr.bar_id = ?`,
      [req.params.id, barId]
    );
    if (!pr.length) return res.status(404).json({ success: false, message: "Payroll run not found" });
    const [items] = await pool.query(
      `SELECT pi.*, CONCAT(u.first_name, ' ', u.last_name) AS employee_name FROM payroll_items pi
       LEFT JOIN users u ON u.id = pi.user_id WHERE pi.payroll_run_id = ?`,
      [req.params.id]
    );
    const net = items.reduce((s, it) => s + Number(it.net_pay || 0), 0);
    res.json({ success: true, data: { ...pr[0], items, net_total: net } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// Finance approves/releases a finalized payroll run -> posts it as a committed expense
router.post("/runs/:id/approve", requireAuth, requirePermission("finance_payroll_approve"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const barId = assertBarId(req);
    const [pr] = await conn.query("SELECT id, status, period_start, period_end FROM payroll_runs WHERE id = ? AND bar_id = ?", [req.params.id, barId]);
    if (!pr.length) return res.status(404).json({ success: false, message: "Payroll run not found" });
    if (pr[0].status !== "finalized") return res.status(400).json({ success: false, message: `Cannot release payroll in '${pr[0].status}' state (must be finalized by HR first)` });

    const [items] = await conn.query("SELECT COALESCE(SUM(net_pay),0) AS net FROM payroll_items WHERE payroll_run_id = ?", [req.params.id]);
    const netTotal = Number(items[0].net || 0);

    await conn.beginTransaction();
    await conn.query(
      "UPDATE payroll_runs SET status = 'approved', finance_approved_by = ?, finance_approved_at = NOW() WHERE id = ? AND bar_id = ?",
      [req.user.id, req.params.id, barId]
    );
    await conn.query(
      "INSERT INTO payroll_expenses (bar_id, payroll_run_id, amount, period_start, period_end) VALUES (?,?,?,?,?)",
      [barId, req.params.id, netTotal, pr[0].period_start, pr[0].period_end]
    );
    await conn.commit();
    await logAudit(conn, { bar_id: barId, user_id: req.user.id, action: "finance_approve_payroll", entity: "payroll_runs", entity_id: Number(req.params.id), details: { net_total: netTotal } });
    res.json({ success: true, data: { id: Number(req.params.id), status: "approved", net_total: netTotal } });
  } catch (e) {
    await conn.rollback();
    res.status(e.statusCode || 500).json({ success: false, message: e.message });
  } finally { conn.release(); }
});

router.post("/runs/:id/reject", requireAuth, requirePermission("finance_payroll_approve"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const { notes } = req.body || {};
    const [pr] = await pool.query("SELECT id, status FROM payroll_runs WHERE id = ? AND bar_id = ?", [req.params.id, barId]);
    if (!pr.length) return res.status(404).json({ success: false, message: "Payroll run not found" });
    if (pr[0].status !== "finalized") return res.status(400).json({ success: false, message: `Cannot reject payroll in '${pr[0].status}' state` });
    await pool.query(
      "UPDATE payroll_runs SET status = 'rejected', finance_notes = ? WHERE id = ? AND bar_id = ?",
      [notes || "", req.params.id, barId]
    );
    await logAudit(pool, { bar_id: barId, user_id: req.user.id, action: "finance_reject_payroll", entity: "payroll_runs", entity_id: Number(req.params.id) });
    res.json({ success: true, data: { id: Number(req.params.id), status: "rejected" } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// Bridge summary: posted (approved) payroll vs pending finance approval
router.get("/bridge-summary", requireAuth, requirePermission("finance_payroll_approve"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const { from, to } = req.query;
    const where = ["pr.bar_id = ?"];
    const params = [barId];
    if (from && to) { where.push("DATE(pr.finalized_at) BETWEEN ? AND ?"); params.push(from, to); }
    const [r] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN pr.status = 'approved' THEN pi.net_pay END),0) AS posted_total,
         COALESCE(SUM(CASE WHEN pr.status = 'finalized' THEN pi.net_pay END),0) AS pending_total,
         COUNT(DISTINCT CASE WHEN pr.status = 'approved' THEN pr.id END) AS approved_count,
         COUNT(DISTINCT CASE WHEN pr.status = 'finalized' THEN pr.id END) AS pending_count
       FROM payroll_runs pr
       LEFT JOIN payroll_items pi ON pi.payroll_run_id = pr.id
       WHERE ${where.join(" AND ")}`,
      params
    );
    const [ledger] = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS posted_from_ledger FROM payroll_expenses WHERE bar_id = ?", [barId]
    );
    res.json({
      success: true,
      data: {
        posted_total: r[0].posted_total,
        pending_total: r[0].pending_total,
        approved_count: r[0].approved_count,
        pending_count: r[0].pending_count,
        ledger_total: ledger[0].posted_from_ledger,
      },
    });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// ─── Purchase orders awaiting finance approval ────────────────────────────────
// Single source of truth for PO decisions: the Procurement page is read-only,
// every pending purchase order is reviewed here (Finance Approvals queue).
router.get(
  "/purchase-orders",
  requireAuth,
  requirePermission(["finance_payroll_approve", "procurement_finance_approve"]),
  async (req, res) => {
    try {
      const barId = assertBarId(req);
      const [rows] = await pool.query(
        `SELECT po.id, po.status, po.total_amount, po.expected_delivery, po.created_at,
                po.supplier_id, po.created_by,
                COALESCE(s.name, po.supplier_name) AS supplier_name,
                CONCAT(u.first_name, ' ', u.last_name) AS requested_by_name
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id
         LEFT JOIN users u ON u.id = po.created_by
         WHERE po.bar_id = ? AND po.status = 'pending_approval'
         ORDER BY po.created_at ASC`,
        [barId]
      );
      const [[bar]] = await pool.query(
        "SELECT po_finance_approval_threshold FROM bars WHERE id = ? LIMIT 1",
        [barId]
      );
      const threshold = Number(bar?.po_finance_approval_threshold || 0);
      res.json({
        success: true,
        data: {
          threshold,
          purchase_orders: rows.map((r) => ({
            ...r,
            above_threshold: !(threshold > 0) || Number(r.total_amount) >= threshold,
          })),
        },
      });
    } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
  }
);

module.exports = router;
