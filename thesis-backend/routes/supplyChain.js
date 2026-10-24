const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { assertBarId } = require("../utils/barScope");
const { logAudit } = require("../utils/audit");

// ─── Purchase Orders available to receive ─────────────────────────────────────
router.get("/purchase-orders", requireAuth, requirePermission("supply_chain_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [rows] = await pool.query(
      `SELECT po.id, po.supplier_id, s.name AS supplier_name, po.status, po.order_date, po.expected_delivery, po.total_amount,
              (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.id) AS item_count
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.bar_id = ? AND po.status IN ('approved','partially_received') ORDER BY po.created_at DESC`,
      [barId]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

router.get("/purchase-orders/:id", requireAuth, requirePermission("supply_chain_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [po] = await pool.query(
      `SELECT po.*, s.name AS supplier_name FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ? AND po.bar_id = ?`,
      [req.params.id, barId]
    );
    if (!po.length) return res.status(404).json({ success: false, message: "Purchase order not found" });
    const [items] = await pool.query("SELECT * FROM purchase_order_items WHERE po_id = ?", [req.params.id]);
    res.json({ success: true, data: { ...po[0], items } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// ─── Receive goods (creates GRN + reconciles inventory) ───────────────────────
router.post("/purchase-orders/:id/receive", requireAuth, requirePermission("supply_chain_receive"), async (req, res) => {
  const conn = await pool.getConnection();
  let transactionStarted = false;
  try {
    const barId = assertBarId(req);
    const { notes, items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ success: false, message: "items required" });
    const poId = Number(req.params.id);
    if (!Number.isSafeInteger(poId) || poId <= 0) return res.status(400).json({ success: false, message: "Invalid purchase order id" });
    const rejectAfterBegin = (statusCode, message) => {
      const error = new Error(message);
      error.statusCode = statusCode;
      throw error;
    };

    const seenItemIds = new Set();
    for (const item of items) {
      const poItemId = Number(item?.po_item_id);
      const quantity = Number(item?.quantity_received);
      if (!Number.isSafeInteger(poItemId) || poItemId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid purchase order item id" });
      }
      if (seenItemIds.has(poItemId)) {
        return res.status(400).json({ success: false, message: `Duplicate purchase order item ${poItemId}` });
      }
      seenItemIds.add(poItemId);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: "Received quantities must be positive whole numbers" });
      }
    }

    // Lock the PO for the complete validation and update sequence.
    await conn.beginTransaction();
    transactionStarted = true;

    const [po] = await conn.query("SELECT id, status FROM purchase_orders WHERE id = ? AND bar_id = ? FOR UPDATE", [poId, barId]);
    if (!po.length) rejectAfterBegin(404, "Purchase order not found");
    if (!["approved", "partially_received"].includes(po[0].status)) {
      rejectAfterBegin(400, `Cannot receive order in '${po[0].status}' state`);
    }

    // Validate each receive line against current PO items
    const [poItems] = await conn.query("SELECT * FROM purchase_order_items WHERE po_id = ? FOR UPDATE", [poId]);
    const poMap = new Map(poItems.map((i) => [String(i.id), i]));
    let totalReceivedNow = 0;
    const lines = [];
    for (const it of items) {
      const poi = poMap.get(String(it.po_item_id));
      if (!poi) rejectAfterBegin(400, `Unknown PO item ${it.po_item_id}`);
      const qty = Number(it.quantity_received);
      if (poi.quantity_received + qty > poi.quantity_ordered) {
        rejectAfterBegin(400, `Over-receiving '${poi.item_name}' (ordered ${poi.quantity_ordered}, already ${poi.quantity_received})`);
      }
      totalReceivedNow += qty;
      lines.push({ poi, qty });
    }
    if (!totalReceivedNow) rejectAfterBegin(400, "No valid quantity to receive");

    const [grn] = await conn.query(
      "INSERT INTO goods_received_notes (bar_id, po_id, received_by, notes) VALUES (?,?,?,?)",
      [barId, poId, req.user.id, notes || null]
    );

    for (const { poi, qty } of lines) {
      await conn.query("INSERT INTO goods_received_items (grn_id, po_item_id, quantity_received) VALUES (?,?,?)", [grn.insertId, poi.id, qty]);
      await conn.query("UPDATE purchase_order_items SET quantity_received = quantity_received + ? WHERE id = ?", [qty, poi.id]);
      // Received quantities arrive in PACKS: convert to atomic base units
      // (stock_qty is stored in base units: totalUnits = packs × ratio).
      let inventoryItemId = poi.inventory_item_id || null;
      if (!inventoryItemId) {
        // Auto-create the inventory record so receiving never dead-ends on
        // unmapped PO lines, and link the PO item for next time.
        const { mapPoUnitToEnum, inferPackRatio } = require("../services/inventoryUnits");
        const mappedUnit = mapPoUnitToEnum(poi.unit);
        const inferred = inferPackRatio(poi.item_name, poi.unit);
        const [created] = await conn.query(
          `INSERT INTO inventory_items
            (bar_id, name, unit, stock_qty, reorder_level, cost_price, is_active, pack_unit, base_unit, units_per_pack)
           VALUES (?, ?, ?, 0, 0, ?, 1, ?, ?, ?)`,
          [
            barId,
            String(poi.item_name || 'Unnamed item').slice(0, 120),
            mappedUnit,
            Number(poi.unit_cost) || 0,
            inferred ? inferred.packUnit : null,
            inferred ? inferred.baseUnit : mappedUnit,
            inferred ? inferred.ratio : 1,
          ]
        );
        inventoryItemId = created.insertId;
        await conn.query("UPDATE purchase_order_items SET inventory_item_id = ? WHERE id = ?", [inventoryItemId, poi.id]);
      }
      {
        const [inventoryRows] = await conn.query(
          "SELECT stock_qty, reorder_level, units_per_pack FROM inventory_items WHERE id = ? AND bar_id = ? FOR UPDATE",
          [inventoryItemId, barId]
        );
        if (!inventoryRows.length) {
          const error = new Error(`Inventory item for '${poi.item_name}' was not found in this bar`);
          error.statusCode = 409;
          throw error;
        }
        const inventoryItem = inventoryRows[0];
        const ratio = Number(inventoryItem.units_per_pack) > 0 ? Number(inventoryItem.units_per_pack) : 1;
        const addBaseUnits = qty * ratio;
        const newStock = Number(inventoryItem.stock_qty || 0) + addBaseUnits;
        const stockStatus = newStock <= 0
          ? "critical"
          : newStock < Number(inventoryItem.reorder_level || 0) ? "low" : "normal";
        // Keep valuation consistent: stock is atomic, so persist per-base-unit
        // cost (identical to today when ratio = 1).
        const perBaseCost = ratio > 1 ? Number(poi.unit_cost || 0) / ratio : Number(poi.unit_cost || 0);
        await conn.query(
          "UPDATE inventory_items SET stock_qty = ?, cost_price = ?, stock_status = ? WHERE id = ? AND bar_id = ?",
          [newStock, perBaseCost, stockStatus, inventoryItemId, barId]
        );
      }
    }

    // Recompute PO status
    const [remaining] = await conn.query(
      "SELECT COALESCE(SUM(GREATEST(quantity_ordered - quantity_received, 0)),0) AS outstanding FROM purchase_order_items WHERE po_id = ?",
      [poId]
    );
    const newStatus = remaining[0].outstanding > 0 ? "partially_received" : "received";
    await conn.query("UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ? AND bar_id = ?", [newStatus, poId, barId]);

    // Audit logging is non-fatal, but it must happen before commit so a thrown
    // business error cannot leave stock changes half-completed.
    await logAudit(conn, { bar_id: barId, user_id: req.user.id, action: "supply_chain_receive", entity: "goods_received_notes", entity_id: grn.insertId, details: { po_id: Number(req.params.id), qty: totalReceivedNow, status: newStatus } });
    await conn.commit();
    transactionStarted = false;
    res.json({ success: true, data: { grn_id: grn.insertId, po_status: newStatus } });
  } catch (e) {
    if (transactionStarted) await conn.rollback();
    res.status(e.statusCode || 500).json({ success: false, message: e.message });
  } finally { conn.release(); }
});

// ─── Goods Received history ────────────────────────────────────────────────────
router.get("/goods-received", requireAuth, requirePermission("supply_chain_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [rows] = await pool.query(
      `SELECT g.id, g.po_id, po.status AS po_status, g.received_at, g.notes, s.name AS supplier_name,
              (SELECT COUNT(*) FROM goods_received_items gri WHERE gri.grn_id = g.id) AS line_count
       FROM goods_received_notes g
       LEFT JOIN purchase_orders po ON po.id = g.po_id
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       WHERE g.bar_id = ? ORDER BY g.received_at DESC`,
      [barId]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

router.get("/goods-received/:id", requireAuth, requirePermission("supply_chain_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [grn] = await pool.query("SELECT * FROM goods_received_notes WHERE id = ? AND bar_id = ?", [req.params.id, barId]);
    if (!grn.length) return res.status(404).json({ success: false, message: "GRN not found" });
    const [items] = await pool.query(
      `SELECT gri.*, poi.item_name, poi.unit_cost FROM goods_received_items gri
       JOIN purchase_order_items poi ON poi.id = gri.po_item_id WHERE gri.grn_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...grn[0], items } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

module.exports = router;
