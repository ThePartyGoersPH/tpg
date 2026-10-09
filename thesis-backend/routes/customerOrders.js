const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const { requireBarOrderAccess } = require("../middlewares/requireBarOrder");
const { logAudit, auditContext } = require("../utils/audit");
const { createNotification } = require("../utils/notificationService");
const { SELECT_PAYMENT_READY_SQL, paymentsNotReadyResponse } = require("../services/paymentReadiness");

// ─── Tax Computation (mirrors frontend logic exactly) ───────────────────────
function computeTax(rawSubtotal, bar) {
  const taxType = (bar.tax_type || "NON_VAT").toUpperCase();
  const taxRate = Number(bar.tax_rate || 0);
  const taxMode = (bar.tax_mode || "EXCLUSIVE").toUpperCase();

  const s = Number(rawSubtotal);

  if (taxType === "NON_VAT" || taxRate === 0) {
    return {
      net_subtotal: parseFloat(s.toFixed(2)),
      tax_amount: 0.0,
      total_amount: parseFloat(s.toFixed(2)),
    };
  }

  if (taxMode === "EXCLUSIVE") {
    const tax = parseFloat((s * (taxRate / 100)).toFixed(2));
    return {
      net_subtotal: parseFloat(s.toFixed(2)),
      tax_amount: tax,
      total_amount: parseFloat((s + tax).toFixed(2)),
    };
  } else {
    // INCLUSIVE: tax is already embedded in the price
    const tax = parseFloat((s - s / (1 + taxRate / 100)).toFixed(2));
    return {
      net_subtotal: parseFloat((s - tax).toFixed(2)),
      tax_amount: tax,
      total_amount: parseFloat(s.toFixed(2)),
    };
  }
}

// ─── OR Number Generator ─────────────────────────────────────────────────────
// Format: BARID-YYYYMMDD-XXXX (sequential per bar per day, no duplicates)
async function generateORNumber(conn, barId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateKey = `${y}${m}${d}`;

  // Atomic upsert: increment sequence for this bar+date
  await conn.query(
    `INSERT INTO or_number_sequences (bar_id, date_key, last_seq)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    [barId, dateKey]
  );

  const [[row]] = await conn.query(
    `SELECT last_seq FROM or_number_sequences WHERE bar_id = ? AND date_key = ?`,
    [barId, dateKey]
  );

  const seq = String(row.last_seq).padStart(4, "0");
  return `${barId}-${dateKey}-${seq}`;
}

// ─── Guard: check or_number_sequences table exists ───────────────────────────
let _orTableReady = null;
async function ensureORTable() {
  if (_orTableReady) return true;
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'or_number_sequences' LIMIT 1`
  );
  _orTableReady = rows.length > 0;
  return _orTableReady;
}

// ─── Guard: check tax columns exist on bars/pos_orders ───────────────────────
let _taxColsReady = null;
async function ensureTaxCols() {
  if (_taxColsReady !== null) return _taxColsReady;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders'
     AND COLUMN_NAME IN ('customer_user_id','order_source','tax_amount','or_number')`
  );
  _taxColsReady = Number(rows[0].cnt) >= 4;
  return _taxColsReady;
}

// ═══════════════════════════════════════════════════════════
// PUBLIC: Get bar tax configuration
// GET /customer-orders/bars/:barId/tax-config
// ═══════════════════════════════════════════════════════════
router.get("/bars/:barId/tax-config", async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar ID" });

    const [rows] = await pool.query(
      `SELECT id, name, tin, is_bir_registered, tax_type, tax_rate, tax_mode
       FROM bars WHERE id = ? AND status = 'active' LIMIT 1`,
      [barId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Bar not found" });

    const bar = rows[0];
    return res.json({
      success: true,
      data: {
        id: bar.id,
        name: bar.name,
        tin: bar.tin || null,
        is_bir_registered: Boolean(bar.is_bir_registered),
        tax_type: bar.tax_type || "NON_VAT",
        tax_rate: Number(bar.tax_rate || 0),
        tax_mode: bar.tax_mode || "EXCLUSIVE",
      },
    });
  } catch (err) {
    console.error("TAX CONFIG ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUBLIC: Preview tax computation for a given subtotal
// GET /customer-orders/bars/:barId/tax-preview?subtotal=500
// ═══════════════════════════════════════════════════════════
router.get("/bars/:barId/tax-preview", async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    const subtotal = Number(req.query.subtotal || 0);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar ID" });
    if (subtotal < 0) return res.status(400).json({ success: false, message: "subtotal must be >= 0" });

    const [rows] = await pool.query(
      `SELECT tax_type, tax_rate, tax_mode FROM bars WHERE id = ? AND status = 'active' LIMIT 1`,
      [barId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Bar not found" });

    const result = computeTax(subtotal, rows[0]);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("TAX PREVIEW ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// CUSTOMER: Create order (tax-aware)
// POST /customer-orders
// Body: { bar_id, items: [{ menu_item_id, quantity }], notes? }
// ═══════════════════════════════════════════════════════════
router.post(
  "/",
  requireAuth,
  requireBarOrderAccess({ getBarId: (req) => req.body?.bar_id }),
  async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const customerId = req.user.id;
    const { bar_id, items, notes } = req.body || {};
    const barId = Number(bar_id);

    if (!barId) return res.status(400).json({ success: false, message: "bar_id is required" });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "items[] must be a non-empty array" });
    }

    // Ensure migration has been run
    const colsReady = await ensureTaxCols();
    if (!colsReady) {
      return res.status(503).json({
        success: false,
        message: "Tax ordering system not yet initialized. Please run the migration: 20260326_tax_aware_ordering.sql",
      });
    }

    await conn.beginTransaction();

    // Get bar with tax config
    const [barRows] = await conn.query(
      `SELECT id, name, tin, is_bir_registered, tax_type, tax_rate, tax_mode,
              accept_gcash, accept_online_payment, status,
              ${SELECT_PAYMENT_READY_SQL("bars")}
       FROM bars WHERE id = ? LIMIT 1`,
      [barId]
    );
    if (!barRows.length || barRows[0].status !== "active") {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Bar not found or inactive" });
    }
    const bar = barRows[0];

    // No working payment setup -> the bar cannot accept orders at all.
    if (!bar.payments_ready) {
      await conn.rollback();
      return paymentsNotReadyResponse(res);
    }

    // Check customer ban
    const [banRows] = await conn.query(
      "SELECT 1 FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ? LIMIT 1",
      [barId, customerId]
    );
    if (banRows.length) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: "You are banned from this bar" });
    }

    // Validate and price items
    let rawSubtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      const menuId = Number(item.menu_item_id);
      if (!menuId || !qty || qty <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Each item needs menu_item_id and quantity > 0" });
      }

      const [menuRows] = await conn.query(
        `SELECT m.id, m.menu_name, m.selling_price, m.inventory_item_id, m.is_available,
                COALESCE(m.units_per_sale, 1) AS units_per_sale,
                i.stock_qty, i.base_unit, i.unit
         FROM menu_items m
         JOIN inventory_items i ON i.id = m.inventory_item_id
         WHERE m.id = ? AND m.bar_id = ? LIMIT 1`,
        [menuId, barId]
      );
      if (!menuRows.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: `Menu item ${menuId} not found` });
      }
      const mi = menuRows[0];
      if (!mi.is_available) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `${mi.menu_name} is currently unavailable` });
      }
      const perSale = Number(mi.units_per_sale) > 0 ? Number(mi.units_per_sale) : 1;
      const needBaseUnits = qty * perSale;
      if (Number(mi.stock_qty) < needBaseUnits) {
        await conn.rollback();
        const unitLabel = String(mi.base_unit || mi.unit || 'units');
        const unitText = Number(mi.stock_qty) === 1 ? unitLabel : `${unitLabel}s`;
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${mi.menu_name}. Available: ${mi.stock_qty} ${unitText}`,
        });
      }

      const lineTotal = Number(mi.selling_price) * qty;
      rawSubtotal += lineTotal;

      orderItems.push({
        menu_item_id: mi.id,
        inventory_item_id: mi.inventory_item_id,
        item_name: mi.menu_name,
        unit_price: Number(mi.selling_price),
        quantity: qty,
        subtotal: parseFloat(lineTotal.toFixed(2)),
      });
    }

    // Compute tax
    const { net_subtotal, tax_amount, total_amount } = computeTax(rawSubtotal, bar);

    // Generate OR number (requires or_number_sequences table)
    let orNumber = null;
    const orTableReady = await ensureORTable();
    if (orTableReady) {
      orNumber = await generateORNumber(conn, barId);
    }

    // Generate web order number: WEB-YYYYMMDD-NNN
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM pos_orders
       WHERE bar_id = ? AND order_source = 'web' AND DATE(created_at) = CURDATE()`,
      [barId]
    );
    const seq = String((Number(countRows[0].cnt) || 0) + 1).padStart(3, "0");
    const orderNumber = `WEB-${dateStr}-${seq}`;

    // Insert into pos_orders (extended with customer + tax fields)
    const [ins] = await conn.query(
      `INSERT INTO pos_orders
       (bar_id, table_id, staff_user_id, customer_user_id, order_number, order_source,
        status, subtotal, discount_amount, total_amount,
        tax_amount, tax_type_snapshot, tax_rate_snapshot, or_number,
        payment_status, notes, created_at)
       VALUES (?, NULL, NULL, ?, ?, 'web', 'pending', ?, 0.00, ?,
               ?, ?, ?, ?,
               'pending', ?, NOW())`,
      [
        barId,
        customerId,
        orderNumber,
        parseFloat(net_subtotal.toFixed(2)),
        parseFloat(total_amount.toFixed(2)),
        parseFloat(tax_amount.toFixed(2)),
        bar.tax_type || "NON_VAT",
        Number(bar.tax_rate || 0),
        orNumber,
        notes || null,
      ]
    );
    const orderId = ins.insertId;

    // Insert order items
    for (const oi of orderItems) {
      await conn.query(
        `INSERT INTO pos_order_items
         (order_id, menu_item_id, inventory_item_id, item_name, unit_price, quantity, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, oi.menu_item_id, oi.inventory_item_id, oi.item_name, oi.unit_price, oi.quantity, oi.subtotal]
      );
    }

    await conn.commit();

    logAudit(null, {
      bar_id: barId,
      user_id: customerId,
      action: "CUSTOMER_CREATE_ORDER",
      entity: "pos_orders",
      entity_id: orderId,
      details: {
        order_number: orderNumber,
        or_number: orNumber,
        item_count: orderItems.length,
        net_subtotal,
        tax_amount,
        total_amount,
        tax_type: bar.tax_type,
        tax_rate: bar.tax_rate,
        tax_mode: bar.tax_mode,
      },
      ...auditContext(req),
    });

    // Send notification to customer
    try {
      await pool.query(
        `INSERT INTO notifications
         (user_id, type, title, message, reference_id, reference_type, is_read, created_at)
         VALUES (?, 'order_placed', 'Order Placed', ?, ?, 'order', 0, NOW())`,
        [
          customerId,
          `Your order #${orderNumber} at ${bar.name} has been placed. Total: ₱${total_amount.toFixed(2)}`,
          orderId,
        ]
      );
    } catch (_) {}

    // Notify the bar team (owner/staff) of the new order
    try {
      await createNotification({
        barId,
        type: "order_placed",
        title: "New Order Placed",
        message: `Order #${orderNumber} at ${bar.name} — Total: ₱${total_amount.toFixed(2)}`,
        referenceType: "order",
        referenceId: orderId,
        category: "order",
        action: "navigate",
        targetRoute: "/transactions",
        excludeUserId: customerId,
      });
    } catch (e) {
      console.error("order_placed bar-team notification failed:", e.message);
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        id: orderId,
        order_number: orderNumber,
        or_number: orNumber,
        bar_name: bar.name,
        bar_tin: bar.tin || null,
        is_bir_registered: Boolean(bar.is_bir_registered),
        tax_type: bar.tax_type || "NON_VAT",
        tax_rate: Number(bar.tax_rate || 0),
        tax_mode: bar.tax_mode || "EXCLUSIVE",
        net_subtotal: parseFloat(net_subtotal.toFixed(2)),
        tax_amount: parseFloat(tax_amount.toFixed(2)),
        total_amount: parseFloat(total_amount.toFixed(2)),
        item_count: orderItems.length,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("CREATE CUSTOMER ORDER ERROR:", err);
    return res.status(500).json({ success: false, message: err.sqlMessage || err.message || "Server error" });
  } finally {
    conn.release();
  }
});

// ═══════════════════════════════════════════════════════════
// CUSTOMER: My orders
// GET /customer-orders/my
// ═══════════════════════════════════════════════════════════
router.get("/my", requireAuth, async (req, res) => {
  try {
    const customerId = req.user.id;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
    const offset = Math.max(0, Number(req.query.offset || 0));

    const colsReady = await ensureTaxCols();
    if (!colsReady) return res.json({ success: true, data: [] });

    const [rows] = await pool.query(
      `SELECT o.id, o.order_number, o.or_number, o.status, o.subtotal,
              o.tax_amount, o.total_amount, o.tax_type_snapshot, o.tax_rate_snapshot,
              o.payment_status, o.payment_method, o.created_at, o.completed_at,
              b.name AS bar_name, b.address AS bar_address
       FROM pos_orders o
       JOIN bars b ON b.id = o.bar_id
       WHERE o.customer_user_id = ? AND o.order_source = 'web'
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [customerId, limit, offset]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("MY ORDERS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// CUSTOMER: Get order receipt
// GET /customer-orders/:id/receipt
// ═══════════════════════════════════════════════════════════
router.get("/:id/receipt", requireAuth, async (req, res) => {
  try {
    const customerId = req.user.id;
    const orderId = Number(req.params.id);
    if (!orderId) return res.status(400).json({ success: false, message: "Invalid order ID" });

    const colsReady = await ensureTaxCols();
    if (!colsReady) return res.status(404).json({ success: false, message: "Order not found" });

    const [orderRows] = await pool.query(
      `SELECT o.id, o.order_number, o.or_number, o.status,
              o.subtotal, o.tax_amount, o.total_amount,
              o.tax_type_snapshot, o.tax_rate_snapshot,
              o.payment_status, o.payment_method, o.created_at, o.completed_at,
              b.name AS bar_name, b.address AS bar_address,
              b.contact_number AS bar_phone, b.email AS bar_email,
              b.tin AS bar_tin, b.is_bir_registered,
              b.tax_type, b.tax_mode
       FROM pos_orders o
       JOIN bars b ON b.id = o.bar_id
       WHERE o.id = ? AND o.customer_user_id = ? AND o.order_source = 'web'
       LIMIT 1`,
      [orderId, customerId]
    );
    if (!orderRows.length) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const order = orderRows[0];

    const [items] = await pool.query(
      `SELECT item_name, unit_price, quantity, subtotal
       FROM pos_order_items WHERE order_id = ? ORDER BY id ASC`,
      [orderId]
    );

    return res.json({ success: true, data: { ...order, items } });
  } catch (err) {
    console.error("RECEIPT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// OWNER / BAR: Sales report (for bar owner dashboard)
// GET /customer-orders/reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD
// ═══════════════════════════════════════════════════════════
router.get("/reports/sales", requireAuth, async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const today = new Date().toISOString().slice(0, 10);
    const from = req.query.from || today;
    const to = req.query.to || from;

    const colsReady = await ensureTaxCols();
    if (!colsReady) {
      return res.json({ success: true, data: { total_orders: 0, net_sales: 0, total_tax_collected: 0, total_sales: 0 } });
    }

    const [[summary]] = await pool.query(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(CASE WHEN tax_type_snapshot = 'VAT' THEN subtotal ELSE total_amount END), 0) AS net_sales,
         COALESCE(SUM(tax_amount), 0) AS total_tax_collected,
         COALESCE(SUM(total_amount), 0) AS total_sales
       FROM pos_orders
       WHERE bar_id = ? AND order_source = 'web'
         AND status NOT IN ('cancelled')
         AND DATE(created_at) BETWEEN ? AND ?`,
      [barId, from, to]
    );

    const [daily] = await pool.query(
      `SELECT DATE(created_at) AS date,
              COUNT(*) AS orders,
              COALESCE(SUM(total_amount), 0) AS revenue,
              COALESCE(SUM(tax_amount), 0) AS tax_collected
       FROM pos_orders
       WHERE bar_id = ? AND order_source = 'web'
         AND status NOT IN ('cancelled')
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at) ORDER BY date ASC`,
      [barId, from, to]
    );

    return res.json({ success: true, data: { ...summary, daily } });
  } catch (err) {
    console.error("SALES REPORT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
