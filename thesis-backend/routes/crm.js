const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");

// Aggregated customer list for the bar (customers = users who interacted with this bar)
async function getCustomers(barId) {
  const [rows] = await pool.query(
    `SELECT u.id,
            CONCAT(u.first_name, ' ', u.last_name) AS name,
            u.email, u.phone_number AS phone,
            COALESCE(SUM(CASE WHEN po.status IN ('completed','paid') THEN po.total_amount ELSE 0 END), 0) AS total_spent,
            COUNT(DISTINCT po.id) AS order_count,
            COUNT(DISTINCT r.id) AS reservation_count,
            MAX(GREATEST(COALESCE(r.reservation_date, 0), COALESCE(po.created_at, 0))) AS last_interaction,
            (SELECT COUNT(*) FROM bar_followers bf WHERE bf.user_id = u.id AND bf.bar_id = ?) AS is_follower,
            COALESCE((SELECT AVG(rv.rating) FROM reviews rv WHERE rv.customer_id = u.id AND rv.bar_id = ?), 0) AS avg_rating
     FROM users u
     LEFT JOIN pos_orders po ON po.customer_user_id = u.id AND po.bar_id = ?
     LEFT JOIN reservations r ON r.customer_user_id = u.id AND r.bar_id = ?
     WHERE u.role = 'customer'
       AND (
         EXISTS (SELECT 1 FROM pos_orders po2 WHERE po2.customer_user_id = u.id AND po2.bar_id = ?)
         OR EXISTS (SELECT 1 FROM reservations r2 WHERE r2.customer_user_id = u.id AND r2.bar_id = ?)
         OR EXISTS (SELECT 1 FROM bar_followers bf2 WHERE bf2.user_id = u.id AND bf2.bar_id = ?)
       )
     GROUP BY u.id
     ORDER BY total_spent DESC
     LIMIT 200`,
    [barId, barId, barId, barId, barId, barId, barId]
  );
  return rows.map((c) => ({
    ...c,
    total_spent: Number(c.total_spent),
    order_count: Number(c.order_count),
    reservation_count: Number(c.reservation_count),
    avg_rating: Number(c.avg_rating),
    is_follower: Number(c.is_follower) > 0,
  }));
}

// ─── Customers list ──────────────────────────────────────────────────
router.get("/customers", requireAuth, requirePermission("crm_view"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    const customers = await getCustomers(barId);
    return res.json({ success: true, data: customers });
  } catch (err) {
    console.error("CRM CUSTOMERS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Segmentation (by lifetime spend) ────────────────────────────────
router.get("/segments", requireAuth, requirePermission("crm_view"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    const customers = await getCustomers(barId);
    const segments = {
      vip: customers.filter((c) => c.total_spent >= 5000).length,
      regular: customers.filter((c) => c.total_spent >= 1000 && c.total_spent < 5000).length,
      new: customers.filter((c) => c.total_spent < 1000).length,
    };
    return res.json({ success: true, data: { total: customers.length, ...segments } });
  } catch (err) {
    console.error("CRM SEGMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Loyalty tiers summary ───────────────────────────────────────────
router.get("/loyalty", requireAuth, requirePermission("crm_view"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    const customers = await getCustomers(barId);
    const tiers = [
      { tier: "VIP", threshold: 5000, count: customers.filter((c) => c.total_spent >= 5000).length },
      { tier: "Regular", threshold: 1000, count: customers.filter((c) => c.total_spent >= 1000 && c.total_spent < 5000).length },
      { tier: "New", threshold: 0, count: customers.filter((c) => c.total_spent < 1000).length },
    ];
    const [[reach]] = await pool.query(
      "SELECT COUNT(*) AS followers FROM bar_followers WHERE bar_id = ?",
      [barId]
    );
    return res.json({
      success: true,
      data: {
        total_customers: customers.length,
        reachable: Number(reach.followers),
        tiers,
      },
    });
  } catch (err) {
    console.error("CRM LOYALTY ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── Customer detail ─────────────────────────────────────────────────
router.get("/customers/:id", requireAuth, requirePermission("crm_view"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    const customerId = Number(req.params.id);
    const [cust] = await pool.query(
      `SELECT u.id, CONCAT(u.first_name, ' ', u.last_name) AS name, u.email, u.phone_number AS phone,
              COALESCE(SUM(CASE WHEN po.status IN ('completed','paid') THEN po.total_amount ELSE 0 END), 0) AS total_spent,
              COUNT(DISTINCT po.id) AS order_count,
              COUNT(DISTINCT r.id) AS reservation_count,
              COALESCE((SELECT AVG(rv.rating) FROM reviews rv WHERE rv.customer_id = u.id AND rv.bar_id = ?), 0) AS avg_rating
       FROM users u
       LEFT JOIN pos_orders po ON po.customer_user_id = u.id AND po.bar_id = ?
       LEFT JOIN reservations r ON r.customer_user_id = u.id AND r.bar_id = ?
       WHERE u.id = ? AND u.role = 'customer'
       GROUP BY u.id`,
      [barId, barId, barId, customerId]
    );
    if (!cust.length) return res.status(404).json({ success: false, message: "Customer not found" });
    const [reservations] = await pool.query(
      `SELECT id, transaction_number, reservation_date, reservation_time, party_size, status
       FROM reservations WHERE bar_id = ? AND customer_user_id = ? ORDER BY reservation_date DESC LIMIT 10`,
      [barId, customerId]
    );
    const [orders] = await pool.query(
      `SELECT id, order_number, total_amount, status, created_at
       FROM pos_orders WHERE bar_id = ? AND customer_user_id = ? ORDER BY created_at DESC LIMIT 10`,
      [barId, customerId]
    );
    const [reviews] = await pool.query(
      `SELECT id, rating, comment, created_at FROM reviews WHERE bar_id = ? AND customer_id = ? ORDER BY created_at DESC LIMIT 5`,
      [barId, customerId]
    );
    return res.json({
      success: true,
      data: { ...cust[0], total_spent: Number(cust[0].total_spent), avg_rating: Number(cust[0].avg_rating), reservations, orders, reviews },
    });
  } catch (err) {
    console.error("CRM CUSTOMER DETAIL ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
