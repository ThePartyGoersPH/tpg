const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { assertBarId } = require("../utils/barScope");
const { logAudit } = require("../utils/audit");

// ─── List transactions (with amount paid) ────────────────────────────────────
router.get("/transactions", requireAuth, requirePermission("tps_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const { from, to, limit = 50 } = req.query;
    const where = ["o.bar_id = ?"];
    const params = [barId];
    if (from && to) { where.push("DATE(o.created_at) BETWEEN ? AND ?"); params.push(from, to); }
    const [rows] = await pool.query(
      `SELECT o.id, o.transaction_name, o.order_number, o.status, o.subtotal, o.discount_amount,
              o.total_amount, o.amount_received, o.change_amount, o.payment_method, o.payment_status,
              o.or_number, o.order_source, o.created_at,
              COUNT(oi.id) AS item_count
       FROM pos_orders o
       LEFT JOIN pos_order_items oi ON oi.order_id = o.id
       WHERE ${where.join(" AND ")}
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT ?`,
      [...params, Number(limit)]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// ─── Record a transaction (order naming + amount paid tracking) ───────────────
router.post("/transactions", requireAuth, requirePermission("tps_create"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const barId = assertBarId(req);
    const { transaction_name, items, payment_method = "cash", amount_paid, discount_amount = 0,
            tax_amount = 0, table_id = null, or_number = null, order_source = "pos" } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ success: false, message: "items required" });
    if (amount_paid == null) return res.status(400).json({ success: false, message: "amount_paid required" });

    const subtotal = items.reduce((s, it) => s + (Number(it.unit_price) * Number(it.quantity)), 0);
    const total = Math.max(0, subtotal - Number(discount_amount) + Number(tax_amount));
    const amountReceived = Number(amount_paid);
    const changeAmount = Math.max(0, amountReceived - total);
    const orderNumber = `TPS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await conn.beginTransaction();

    const [oIns] = await conn.query(
      `INSERT INTO pos_orders
        (bar_id, table_id, staff_user_id, order_number, transaction_name, status, subtotal, discount_amount,
         tax_amount, total_amount, payment_status, payment_method, amount_received, change_amount, or_number, order_source, completed_at)
       VALUES (?,?,?,?,?, 'paid', ?,?,?,?, 'paid', ?,?,?,?,?, NOW())`,
      [barId, table_id, req.user.id, orderNumber, transaction_name || null, subtotal, discount_amount,
       tax_amount, total, payment_method, amountReceived, changeAmount, or_number, order_source]
    );
    const orderId = oIns.insertId;

    for (const it of items) {
      const up = Number(it.unit_price), qty = Number(it.quantity);
      await conn.query(
        `INSERT INTO pos_order_items (order_id, menu_item_id, inventory_item_id, item_name, unit_price, quantity, subtotal)
         VALUES (?,?,?,?,?,?,?)`,
        [orderId, it.menu_item_id || null, it.inventory_item_id || null, it.item_name || "Item",
         up, qty, up * qty]
      );
    }

    const reference = `TPS-${orderId}-${Date.now()}`;
    const [ptIns] = await conn.query(
      `INSERT INTO payment_transactions (reference_id, payment_type, related_id, bar_id, user_id, amount, status, payment_method, metadata)
       VALUES (?, 'order', ?, ?, ?, ?, 'paid', ?, ?)`,
      [reference, orderId, barId, req.user.id, amountReceived, payment_method, JSON.stringify({ source: "tps", transaction_name: transaction_name || null })]
    );
    await conn.query("UPDATE pos_orders SET payment_transaction_id = ? WHERE id = ?", [ptIns.insertId, orderId]);

    await conn.commit();
    await logAudit(conn, { bar_id: barId, user_id: req.user.id, action: "tps_record_transaction", entity: "pos_orders", entity_id: orderId, details: { total, amount_paid: amountReceived, change: changeAmount, items: items.length } });
    res.json({ success: true, data: { order_id: orderId, order_number: orderNumber, total, amount_paid: amountReceived, change: changeAmount } });
  } catch (e) {
    await conn.rollback();
    res.status(e.statusCode || 500).json({ success: false, message: e.message });
  } finally { conn.release(); }
});

// ─── Wastage / shrinkage reconciliation ───────────────────────────────────────
router.get("/wastage", requireAuth, requirePermission("tps_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const { from, to } = req.query;
    const where = ["i.bar_id = ?"];
    const params = [barId];
    if (from && to) { where.push("DATE(w.date_logged) BETWEEN ? AND ?"); params.push(from, to); }
    const [rows] = await pool.query(
      `SELECT w.item_id, COALESCE(i.name, 'Unknown') AS item_name, i.cost_price,
              SUM(w.quantity_wasted) AS total_qty,
              SUM(w.quantity_wasted * COALESCE(i.cost_price, 0)) AS shrinkage_cost
       FROM wastage_logs w
       LEFT JOIN inventory_items i ON i.id = w.item_id
       WHERE ${where.join(" AND ")}
       GROUP BY w.item_id, i.name, i.cost_price
       ORDER BY shrinkage_cost DESC`,
      params
    );
    const [tot] = await pool.query(
      `SELECT COALESCE(SUM(w.quantity_wasted * COALESCE(i.cost_price, 0)), 0) AS total_shrinkage
       FROM wastage_logs w LEFT JOIN inventory_items i ON i.id = w.item_id
       WHERE ${where.join(" AND ")}`,
      params
    );
    res.json({ success: true, data: { items: rows, total_shrinkage: tot[0].total_shrinkage } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// ─── Record wastage / spillage / loss ────────────────────────────────────────
router.post("/wastage", requireAuth, requirePermission("tps_create"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const { item_id, quantity_wasted, reason } = req.body;
    if (!item_id || !quantity_wasted) return res.status(400).json({ success: false, message: "item_id and quantity_wasted required" });
    const [it] = await pool.query("SELECT id FROM inventory_items WHERE id = ? AND bar_id = ?", [item_id, barId]);
    if (!it.length) return res.status(404).json({ success: false, message: "Item not found in this bar" });
    const [r] = await pool.query(
      "INSERT INTO wastage_logs (item_id, quantity_wasted, reason, date_logged, logged_by) VALUES (?, ?, ?, NOW(), ?)",
      [item_id, quantity_wasted, reason || null, req.user.id]
    );
    await logAudit(pool, { bar_id: barId, user_id: req.user.id, action: "tps_record_wastage", entity: "wastage_logs", entity_id: r.insertId, details: { item_id, quantity_wasted, reason: reason || null } });
    res.json({ success: true, data: { id: r.insertId } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// ─── Summary (sales vs amount paid vs shrinkage) ──────────────────────────────
router.get("/summary", requireAuth, requirePermission("tps_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const { from, to } = req.query;
    const where = ["bar_id = ?"];
    const params = [barId];
    if (from && to) { where.push("DATE(created_at) BETWEEN ? AND ?"); params.push(from, to); }
    const [sales] = await pool.query(
      `SELECT COUNT(*) AS txn_count, COALESCE(SUM(total_amount),0) AS total_sales,
              COALESCE(SUM(amount_received),0) AS total_paid
       FROM pos_orders WHERE ${where.join(" AND ")}`,
      params
    );
    const [waste] = await pool.query(
      `SELECT COALESCE(SUM(w.quantity_wasted * COALESCE(i.cost_price,0)),0) AS total_shrinkage
       FROM wastage_logs w LEFT JOIN inventory_items i ON i.id = w.item_id
       WHERE i.bar_id = ?`,
      [barId]
    );
    res.json({
      success: true,
      data: {
        txn_count: sales[0].txn_count,
        total_sales: sales[0].total_sales,
        total_paid: sales[0].total_paid,
        total_shrinkage: waste[0].total_shrinkage,
      },
    });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

module.exports = router;
