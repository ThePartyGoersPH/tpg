const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { assertBarId } = require("../utils/barScope");
const { logAudit } = require("../utils/audit");
const { createNotification } = require("../utils/notificationService");
const { sendPurchaseOrderEmail } = require("../utils/emailService");

// ─── Suppliers ───────────────────────────────────────────────────────────────
router.get("/suppliers", requireAuth, requirePermission("procurement_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [rows] = await pool.query(
      "SELECT id, name, contact_person, email, facebook_link, phone, address, is_active, created_at FROM suppliers WHERE bar_id = ? ORDER BY name",
      [barId]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

router.post("/suppliers", requireAuth, requirePermission("procurement_create"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const { name, contact_person, email, facebook_link, phone, address } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Supplier name required" });
    const [r] = await pool.query(
      "INSERT INTO suppliers (bar_id, name, contact_person, email, facebook_link, phone, address) VALUES (?,?,?,?,?,?,?)",
      [barId, name, contact_person || null, email || null, facebook_link || null, phone || null, address || null]
    );
    await logAudit(pool, { bar_id: barId, user_id: req.user.id, action: "procurement_create_supplier", entity: "suppliers", entity_id: r.insertId, details: { name } });
    res.json({ success: true, data: { id: r.insertId } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

router.put("/suppliers/:id", requireAuth, requirePermission("procurement_create"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const { name, contact_person, email, facebook_link, phone, address, is_active } = req.body;
    const [existing] = await pool.query("SELECT id FROM suppliers WHERE id = ? AND bar_id = ?", [req.params.id, barId]);
    if (!existing.length) return res.status(404).json({ success: false, message: "Supplier not found" });
    await pool.query(
      "UPDATE suppliers SET name = COALESCE(?, name), contact_person = ?, email = ?, facebook_link = ?, phone = ?, address = ?, is_active = COALESCE(?, is_active), updated_at = NOW() WHERE id = ? AND bar_id = ?",
      [name || null, contact_person || null, email || null, facebook_link || null, phone || null, address || null, (is_active === undefined ? null : is_active ? 1 : 0), req.params.id, barId]
    );
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

router.delete("/suppliers/:id", requireAuth, requirePermission("procurement_create"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    await pool.query("UPDATE suppliers SET is_active = 0, updated_at = NOW() WHERE id = ? AND bar_id = ?", [req.params.id, barId]);
    res.json({ success: true, data: { id: Number(req.params.id) } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// ─── Approval settings ────────────────────────────────────────────────────────
// Per-bar finance approval threshold for purchase orders.
router.get("/settings", requireAuth, requirePermission("procurement_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [rows] = await pool.query(
      "SELECT po_finance_approval_threshold FROM bars WHERE id = ? LIMIT 1",
      [barId]
    );
    res.json({ success: true, data: { po_finance_approval_threshold: Number(rows[0]?.po_finance_approval_threshold || 0) } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

router.put("/settings", requireAuth, requirePermission("procurement_finance_approve"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const threshold = Number(req.body?.po_finance_approval_threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100000000) {
      return res.status(400).json({ success: false, message: "Threshold must be a number of 0 or more" });
    }
    await pool.query("UPDATE bars SET po_finance_approval_threshold = ?, updated_at = NOW() WHERE id = ?", [threshold, barId]);
    await logAudit(pool, { bar_id: barId, user_id: req.user.id, action: "procurement_update_settings", entity: "bars", entity_id: barId, details: { po_finance_approval_threshold: threshold } });
    res.json({ success: true, data: { po_finance_approval_threshold: threshold } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// ─── Source inventory requests (for the "Add to Procurement" pre-fill) ────────
// GET /procurement/requests?ids=10,11 — returns the given requests for this bar
// so the New Purchase Order form can be pre-filled. Read-only; conversion itself
// is validated again atomically inside POST /purchase-orders.
router.get("/requests", requireAuth, requirePermission("procurement_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const ids = [...new Set(
      String(req.query.ids || "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isSafeInteger(n) && n > 0)
    )].slice(0, 100);
    if (!ids.length) return res.status(400).json({ success: false, message: "ids required" });
    const [rows] = await pool.query(
      `SELECT ir.id, ir.item_name, ir.quantity_needed, ir.unit, ir.cost_price, ir.status,
              ir.purchase_order_id, ir.last_purchase_order_id, po.status AS linked_po_status
       FROM inventory_requests ir
       LEFT JOIN purchase_orders po ON po.id = COALESCE(ir.purchase_order_id, ir.last_purchase_order_id)
       WHERE ir.bar_id = ? AND ir.id IN (?)
       ORDER BY ir.id`,
      [barId, ids]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// ─── Purchase Orders ───────────────────────────────────────────────────────────
router.get("/purchase-orders", requireAuth, requirePermission("procurement_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [rows] = await pool.query(
      `SELECT po.id, po.supplier_id, COALESCE(s.name, po.supplier_name) AS supplier_name, po.status,
              po.order_date, po.expected_delivery, po.total_amount, po.created_at,
              (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.po_id = po.id) AS item_count
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.bar_id = ? ORDER BY po.created_at DESC`,
      [barId]
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

router.post("/purchase-orders", requireAuth, requirePermission("procurement_create"), async (req, res) => {
  const conn = await pool.getConnection();
  let transactionStarted = false;
  try {
    const barId = assertBarId(req);
    const { supplier_id, order_date, expected_delivery, notes, items } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ success: false, message: "items required" });
    const supplierId = supplier_id === null || supplier_id === undefined || supplier_id === ""
      ? null
      : Number(supplier_id);
    if (supplierId !== null && (!Number.isSafeInteger(supplierId) || supplierId <= 0)) {
      return res.status(400).json({ success: false, message: "Invalid supplier" });
    }
    let supplierName = "Walk-in";
    if (supplierId !== null) {
      const [supplierRows] = await conn.query(
        "SELECT id, name FROM suppliers WHERE id = ? AND bar_id = ? AND is_active = 1 LIMIT 1",
        [supplierId, barId]
      );
      if (!supplierRows.length) return res.status(400).json({ success: false, message: "Supplier is not active for this bar" });
      supplierName = supplierRows[0].name;
    }
    const linkedInventoryIds = [...new Set(items
      .map((item) => item?.inventory_item_id)
      .filter((id) => id !== null && id !== undefined && id !== "")
      .map((id) => Number(id)))];
    if (linkedInventoryIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      return res.status(400).json({ success: false, message: "Invalid inventory item" });
    }
    if (linkedInventoryIds.length) {
      const [inventoryRows] = await conn.query(
        "SELECT id FROM inventory_items WHERE bar_id = ? AND is_active = 1 AND id IN (?)",
        [barId, linkedInventoryIds]
      );
      if (inventoryRows.length !== linkedInventoryIds.length) {
        return res.status(400).json({ success: false, message: "One or more inventory items are not active for this bar" });
      }
    }
    const cleanItems = items.map((it) => {
      const itemName = String(it?.item_name || "").trim();
      const quantity = Number(it?.quantity_ordered);
      const unitCost = Number(it?.unit_cost);
      if (!itemName || itemName.length > 150) {
        throw Object.assign(new Error("Each item must have a name of 1 to 150 characters"), { statusCode: 400 });
      }
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw Object.assign(new Error("Ordered quantities must be positive whole numbers"), { statusCode: 400 });
      }
      if (!Number.isFinite(unitCost) || unitCost < 0) {
        throw Object.assign(new Error("Unit costs must be finite and non-negative"), { statusCode: 400 });
      }
      const unit = it.unit == null || it.unit === "" ? null : String(it.unit).trim().slice(0, 50);
      const requestId = it.request_id === null || it.request_id === undefined || it.request_id === ""
        ? null
        : Number(it.request_id);
      if (requestId !== null && (!Number.isSafeInteger(requestId) || requestId <= 0)) {
        throw Object.assign(new Error("Invalid inventory request id"), { statusCode: 400 });
      }
      return {
        inventory_item_id: it.inventory_item_id === null || it.inventory_item_id === undefined || it.inventory_item_id === ""
          ? null
          : Number(it.inventory_item_id),
        item_name: itemName,
        quantity_ordered: quantity,
        unit_cost: unitCost,
        unit,
        request_id: requestId,
      };
    });
    // Source inventory requests for this PO (deduped, defensive validation
    // happens inside the transaction below so conversion stays atomic).
    const requestIds = [...new Set(cleanItems.map((it) => it.request_id).filter((id) => id !== null))];
    if (requestIds.length !== cleanItems.filter((it) => it.request_id !== null).length) {
      return res.status(400).json({ success: false, message: "An inventory request cannot be added to the same purchase order twice" });
    }
    const total = cleanItems.reduce((s, it) => s + it.quantity_ordered * it.unit_cost, 0);
    if (!Number.isFinite(total) || total < 0) {
      return res.status(400).json({ success: false, message: "Purchase order total is invalid" });
    }

    // Finance approval threshold (per bar). 0 = every PO must be approved in the
    // Finance Approvals queue; otherwise POs at/above the threshold are routed
    // there and smaller ones are auto-approved at creation.
    const [[bar]] = await conn.query(
      "SELECT po_finance_approval_threshold FROM bars WHERE id = ? LIMIT 1",
      [barId]
    );
    const threshold = Number(bar?.po_finance_approval_threshold || 0);
    const requiresFinance = !(threshold > 0) || total >= threshold;
    const status = requiresFinance ? "pending_approval" : "approved";

    await conn.beginTransaction();
    transactionStarted = true;

    // Lock + validate the source inventory requests first: each must be
    // approved and not already covered by a live (non-rejected/cancelled) PO.
    if (requestIds.length) {
      const [reqRows] = await conn.query(
        `SELECT ir.id, ir.status, ir.purchase_order_id, po.status AS po_status
         FROM inventory_requests ir
         LEFT JOIN purchase_orders po ON po.id = ir.purchase_order_id
         WHERE ir.id IN (?) AND ir.bar_id = ?
         FOR UPDATE`,
        [requestIds, barId]
      );
      if (reqRows.length !== requestIds.length) {
        throw Object.assign(new Error("One or more inventory requests were not found"), { statusCode: 400 });
      }
      for (const r of reqRows) {
        if (r.status !== "approved") {
          throw Object.assign(new Error(`Inventory request #${r.id} is not approved and cannot be converted`), { statusCode: 409 });
        }
        if (r.purchase_order_id !== null && !["rejected", "cancelled"].includes(String(r.po_status))) {
          throw Object.assign(
            new Error(`Inventory request #${r.id} was already sent to Procurement (PO #${r.purchase_order_id})`),
            { statusCode: 409 }
          );
        }
      }
    }

    const [po] = await conn.query(
      `INSERT INTO purchase_orders (bar_id, supplier_id, supplier_name, created_by, status, order_date, expected_delivery, total_amount, notes, approved_at)
       VALUES (?,?,?,?,?,?,?,?,?, ${requiresFinance ? "NULL" : "NOW()"})`,
      [barId, supplierId, supplierName, req.user.id, status, order_date || null, expected_delivery || null, total, notes || null]
    );
    for (const it of cleanItems) {
      await conn.query(
        "INSERT INTO purchase_order_items (po_id, inventory_item_id, item_name, unit, quantity_ordered, unit_cost) VALUES (?,?,?,?,?,?)",
        [po.insertId, it.inventory_item_id, it.item_name, it.unit, it.quantity_ordered, it.unit_cost]
      );
    }

    // Link the source requests to the new PO in the SAME transaction — either
    // everything is written or nothing is (never a half-converted request).
    if (requestIds.length) {
      const [linked] = await conn.query(
        `UPDATE inventory_requests
            SET purchase_order_id = ?, last_purchase_order_id = ?, updated_at = NOW()
          WHERE id IN (?) AND bar_id = ?`,
        [po.insertId, po.insertId, requestIds, barId]
      );
      if (linked.affectedRows !== requestIds.length) {
        throw Object.assign(new Error("Could not link inventory requests to the purchase order"), { statusCode: 409 });
      }
    }

    await conn.commit();
    transactionStarted = false;
    await logAudit(conn, { bar_id: barId, user_id: req.user.id, action: "procurement_create_po", entity: "purchase_orders", entity_id: po.insertId, details: { total, items: cleanItems.length, status, supplier_name: supplierName, threshold, request_ids: requestIds } });
    res.json({ success: true, data: { id: po.insertId, status, total_amount: total, threshold, requires_finance_approval: requiresFinance, linked_request_ids: requestIds } });

    // Notify the bar team of the new purchase order (except the creator)
    try {
      if (requiresFinance) {
        await createNotification({
          barId,
          type: "purchase_order_created",
          title: "New Purchase Order — Finance Approval Needed",
          message: `Purchase order #${po.insertId} created (₱${total.toFixed(2)}) and routed to Finance Approvals.`,
          referenceType: "purchase_order",
          referenceId: po.insertId,
          category: "procurement",
          action: "navigate",
          targetRoute: "/payroll-finance",
          excludeUserId: req.user.id,
        });
      } else {
        await createNotification({
          barId,
          type: "purchase_order_approved",
          title: "Purchase Order Auto-Approved",
          message: `Purchase order #${po.insertId} created (₱${total.toFixed(2)}) — below the ₱${threshold.toFixed(2)} threshold, so it was auto-approved.`,
          referenceType: "purchase_order",
          referenceId: po.insertId,
          category: "procurement",
          action: "navigate",
          targetRoute: "/procurement",
          excludeUserId: req.user.id,
        });
      }
    } catch (e) {
      console.error("purchase_order_created notification failed:", e.message);
    }
  } catch (e) {
    if (transactionStarted) await conn.rollback();
    res.status(e.statusCode || 500).json({ success: false, message: e.message });
  } finally { conn.release(); }
});

router.get("/purchase-orders/:id", requireAuth, requirePermission("procurement_view"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const [po] = await pool.query(
      `SELECT po.*, COALESCE(s.name, po.supplier_name) AS supplier_name,
              s.facebook_link AS supplier_facebook_link,
              CONCAT(u.first_name, ' ', u.last_name) AS requested_by_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN users u ON u.id = po.created_by
       WHERE po.id = ? AND po.bar_id = ?`,
      [req.params.id, barId]
    );
    if (!po.length) return res.status(404).json({ success: false, message: "Purchase order not found" });
    const [items] = await pool.query("SELECT * FROM purchase_order_items WHERE po_id = ?", [req.params.id]);
    res.json({ success: true, data: { ...po[0], items } });
  } catch (e) { res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
});

// ─── Finance approval (single source of truth) ────────────────────────────────
// Approve/reject lives behind `procurement_finance_approve` and is only exposed
// through the Finance Approvals queue UI — the Procurement page shows state only.
function normalizedRole(req) {
  return String(req.user?.role_name || req.user?.role || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

// Separation of duties: whoever raised the PO cannot give final finance
// approval, unless they are the Bar Owner / Super Admin (explicitly allowed).
function assertSeparationOfDuties(req, po) {
  const isCreator = Number(po.created_by) === Number(req.user.id);
  if (!isCreator) return;
  const role = normalizedRole(req);
  if (role === "BAR_OWNER" || role === "SUPER_ADMIN") return;
  throw Object.assign(
    new Error("Separation of duties: the requester cannot approve their own purchase order — ask Finance or a manager to review it."),
    { statusCode: 403 }
  );
}

router.post("/purchase-orders/:id/approve", requireAuth, requirePermission("procurement_finance_approve"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const barId = assertBarId(req);
    await conn.beginTransaction();
    const [po] = await conn.query("SELECT id, status, created_by, total_amount FROM purchase_orders WHERE id = ? AND bar_id = ? FOR UPDATE", [req.params.id, barId]);
    if (!po.length) throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
    if (po[0].status !== "pending_approval") throw Object.assign(new Error(`Cannot approve order in '${po[0].status}' state`), { statusCode: 400 });
    assertSeparationOfDuties(req, po[0]);
    const [updated] = await conn.query(
      "UPDATE purchase_orders SET status = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ? AND bar_id = ? AND status = 'pending_approval'",
      [req.user.id, req.params.id, barId]
    );
    if (!updated.affectedRows) throw Object.assign(new Error("Purchase order was already processed"), { statusCode: 409 });
    await logAudit(conn, { bar_id: barId, user_id: req.user.id, action: "procurement_approve_po", entity: "purchase_orders", entity_id: Number(req.params.id) });
    await conn.commit();
    res.json({ success: true, data: { id: Number(req.params.id), status: "approved" } });

    try {
      await createNotification({
        barId,
        type: "purchase_order_approved",
        title: "Purchase Order Approved",
        message: `Purchase order #${req.params.id} was approved.`,
        referenceType: "purchase_order",
        referenceId: Number(req.params.id),
        category: "procurement",
        action: "navigate",
        targetRoute: "/procurement",
        excludeUserId: req.user.id,
      });
    } catch (e) {
      console.error("purchase_order_approved notification failed:", e.message);
    }
  } catch (e) { await conn.rollback(); res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
  finally { conn.release(); }
});

router.post("/purchase-orders/:id/reject", requireAuth, requirePermission("procurement_finance_approve"), async (req, res) => {  const conn = await pool.getConnection();
  try {
    const barId = assertBarId(req);
    const { reason } = req.body || {};
    await conn.beginTransaction();
    const [po] = await conn.query("SELECT id, status, created_by, total_amount FROM purchase_orders WHERE id = ? AND bar_id = ? FOR UPDATE", [req.params.id, barId]);
    if (!po.length) throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });
    if (po[0].status !== "pending_approval") throw Object.assign(new Error(`Cannot reject order in '${po[0].status}' state`), { statusCode: 400 });
    assertSeparationOfDuties(req, po[0]);
    const [updated] = await conn.query(
      "UPDATE purchase_orders SET status = 'rejected', notes = CONCAT(COALESCE(notes,''), '\n[rejected] ', ?), updated_at = NOW() WHERE id = ? AND bar_id = ? AND status = 'pending_approval'",
      [reason || "", req.params.id, barId]
    );
    if (!updated.affectedRows) throw Object.assign(new Error("Purchase order was already processed"), { statusCode: 409 });

    // Release any inventory requests that were converted into this PO so they
    // become convertible again. last_purchase_order_id is kept for the card's
    // "Procurement order was rejected — re-add to procurement?" note.
    await conn.query(
      `UPDATE inventory_requests
          SET last_purchase_order_id = COALESCE(purchase_order_id, last_purchase_order_id),
              purchase_order_id = NULL,
              updated_at = NOW()
        WHERE purchase_order_id = ?`,
      [Number(req.params.id)]
    );

    await logAudit(conn, { bar_id: barId, user_id: req.user.id, action: "procurement_reject_po", entity: "purchase_orders", entity_id: Number(req.params.id) });
    await conn.commit();
    res.json({ success: true, data: { id: Number(req.params.id), status: "rejected" } });

    try {
      // The requester is the one who must hear back about a rejection.
      await createNotification({
        userIds: [po[0].created_by],
        type: "purchase_order_rejected",
        title: "Purchase Order Rejected",
        message: `Purchase order #${req.params.id} was rejected.${reason ? ` Reason: ${reason}` : ""}`,
        referenceType: "purchase_order",
        referenceId: Number(req.params.id),
        category: "procurement",
        action: "navigate",
        targetRoute: "/procurement",
        excludeUserId: req.user.id,
      });
    } catch (e) {
      console.error("purchase_order_rejected notification failed:", e.message);
    }
  } catch (e) { await conn.rollback(); res.status(e.statusCode || 500).json({ success: false, message: e.message }); }
  finally { conn.release(); }
});

// ─── Notify supplier (Email) ─────────────────────────────────────────────────
// POST /purchase-orders/:id/notify — sends the branded PO email.
// Facebook is a plain contact link on the supplier (no automation).
// Safe to retry.
router.post("/purchase-orders/:id/notify", requireAuth, requirePermission("procurement_create"), async (req, res) => {
  try {
    const barId = assertBarId(req);
    const poId = Number(req.params.id);
    if (!poId) return res.status(400).json({ success: false, message: "Invalid PO id" });

    const [[po]] = await pool.query(
      `SELECT po.*, s.name AS supplier_name, s.contact_person AS supplier_contact,
              s.email AS supplier_email
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.bar_id = po.bar_id
       WHERE po.id = ? AND po.bar_id = ? LIMIT 1`,
      [poId, barId]
    );
    if (!po) return res.status(404).json({ success: false, message: "Purchase order not found" });
    if (['rejected', 'cancelled'].includes(String(po.status))) {
      return res.status(400).json({ success: false, message: `Cannot notify supplier for a ${po.status} order` });
    }
    if (!po.supplier_id) {
      return res.status(400).json({ success: false, message: "This is a Walk-in order with no supplier contact — assign a supplier first" });
    }

    const [items] = await pool.query(
      "SELECT item_name, quantity_ordered, unit_cost FROM purchase_order_items WHERE po_id = ? ORDER BY id",
      [poId]
    );
    const [[bar]] = await pool.query(
      "SELECT id, name, logo_path, image_path, phone, address, email FROM bars WHERE id = ? LIMIT 1",
      [barId]
    );

    const results = { email: { sent: false } };

    if (po.supplier_email) {
      try {
        await sendPurchaseOrderEmail(po.supplier_email, {
          bar: {
            name: bar?.name, logo_path: bar?.logo_path || bar?.image_path,
            phone: bar?.phone, address: bar?.address, email: bar?.email,
          },
          supplier: { name: po.supplier_name, contact_person: po.supplier_contact },
          po: {
            id: po.id, items,
            expected_delivery: po.expected_delivery
              ? String(po.expected_delivery).slice(0, 10) : null,
            notes: po.notes, total_amount: po.total_amount,
          },
        });
        results.email = { sent: true, to: po.supplier_email };
        await pool.query("UPDATE purchase_orders SET email_sent_at = NOW(), last_notify_error = NULL WHERE id = ?", [poId]);
      } catch (e) {
        results.email = { sent: false, error: e.message };
        await pool.query("UPDATE purchase_orders SET last_notify_error = ? WHERE id = ?", [String(e.message).slice(0, 500), poId]);
      }
    } else {
      results.email = { sent: false, error: "Supplier has no email address" };
      await pool.query("UPDATE purchase_orders SET last_notify_error = ? WHERE id = ?", ["Supplier has no email address", poId]);
    }

    await logAudit(pool, { bar_id: barId, user_id: req.user.id, action: "procurement_notify_supplier", entity: "purchase_orders", entity_id: poId, details: results });

    if (!results.email.sent) {
      return res.status(502).json({ success: false, message: results.email.error, data: { po_id: poId, ...results } });
    }
    return res.json({ success: true, message: "Supplier notified", data: { po_id: poId, ...results } });
  } catch (e) {
    console.error("PO NOTIFY ERROR:", e);
    return res.status(e.statusCode || 500).json({ success: false, message: e.message });
  }
});

module.exports = router;
