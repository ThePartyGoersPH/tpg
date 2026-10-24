const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { logAudit, auditContext } = require("../utils/audit");
const inventorySpoilageController = require("../controllers/inventorySpoilageController");
const { createNotification } = require("../utils/notificationService");

// Backward-compatibility for deployments that don't yet have the
// inventory_requests.cost_price and inventory_requests.reorder_level columns.
let hasInventoryRequestExtraColumnsCache = null;
let hasInventoryRequestExtraColumnsCheckedAt = 0;
const INVENTORY_REQUEST_COLUMNS_CACHE_TTL_MS = 5 * 60 * 1000;
let hasInventoryPerishableColumnsCache = null;
let hasInventoryPerishableColumnsCheckedAt = 0;
const INVENTORY_PERISHABLE_COLUMNS_CACHE_TTL_MS = 5 * 60 * 1000;

async function hasInventoryRequestExtraColumns() {
  const now = Date.now();
  if (
    hasInventoryRequestExtraColumnsCache !== null &&
    now - hasInventoryRequestExtraColumnsCheckedAt < INVENTORY_REQUEST_COLUMNS_CACHE_TTL_MS
  ) {
    return hasInventoryRequestExtraColumnsCache;
  }

  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'inventory_requests'
         AND COLUMN_NAME IN ('cost_price', 'reorder_level')`
    );

    hasInventoryRequestExtraColumnsCache = rows.length === 2;
  } catch (err) {
    // Fail open to legacy schema if metadata query is unavailable.
    hasInventoryRequestExtraColumnsCache = false;
  }

  hasInventoryRequestExtraColumnsCheckedAt = now;
  return hasInventoryRequestExtraColumnsCache;
}

async function hasInventoryPerishableColumns() {
  const now = Date.now();
  if (
    hasInventoryPerishableColumnsCache !== null &&
    now - hasInventoryPerishableColumnsCheckedAt < INVENTORY_PERISHABLE_COLUMNS_CACHE_TTL_MS
  ) {
    return hasInventoryPerishableColumnsCache;
  }

  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'inventory_items'
         AND COLUMN_NAME IN ('is_perishable', 'expiry_date', 'shelf_life_days', 'date_added', 'status')`
    );

    hasInventoryPerishableColumnsCache = rows.length === 5;
  } catch (err) {
    // Fail open to legacy schema when metadata query is unavailable.
    hasInventoryPerishableColumnsCache = false;
  }

  hasInventoryPerishableColumnsCheckedAt = now;
  return hasInventoryPerishableColumnsCache;
}

function parsePerishableFlag(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return 0;
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : value;
  if (normalized === true || normalized === 1 || normalized === "1" || normalized === "true") return 1;
  if (normalized === false || normalized === 0 || normalized === "0" || normalized === "false") return 0;
  throw new Error("is_perishable must be boolean-like (true/false, 1/0)");
}

function parseOptionalDateOnly(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const dateStr = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
  }
  return dateStr;
}

function parseOptionalDateTime(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid datetime value`);
  }
  return parsed;
}

function parseOptionalPositiveInteger(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalSpoilageStatus(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (!["normal", "near_expiry", "spoiled"].includes(normalized)) {
    throw new Error("status must be one of: normal, near_expiry, spoiled");
  }
  return normalized;
}

// OWNER - list inventory
router.get("/owner/inventory", requireAuth, requirePermission("menu_view"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

    const supportsPerishableColumns = await hasInventoryPerishableColumns();
    const perishableSelect = supportsPerishableColumns
      ? ", is_perishable, expiry_date, shelf_life_days, date_added, status"
      : "";

    const [rows] = await pool.query(
      `SELECT id, name, unit, stock_qty, reorder_level, cost_price, is_active,
              pack_unit, base_unit, units_per_pack,
              CASE
                WHEN COALESCE(stock_qty, 0) <= 0 THEN 'critical'
                WHEN COALESCE(stock_qty, 0) < COALESCE(reorder_level, 0) THEN 'low'
                ELSE 'normal'
              END AS stock_status,
              image_path, created_at${perishableSelect}
       FROM inventory_items
       WHERE bar_id=? AND is_active=1
       ORDER BY name ASC`,
      [barId]
    );

    return res.json({ success:true, data: rows });
  } catch (err) {
    console.error("INVENTORY LIST ERROR:", err);
    return res.status(500).json({ success:false, message:"Server error" });
  }
});

// OWNER - create inventory item
router.post("/owner/inventory", requireAuth, requirePermission("menu_create"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

    const {
      name,
      unit,
      stock_qty,
      reorder_level,
      cost_price,
      is_perishable,
      expiry_date,
      shelf_life_days,
      date_added,
      status: spoilageStatusInput,
      pack_unit,
      base_unit,
      units_per_pack,
    } = req.body || {};
    if (!name) return res.status(400).json({ success:false, message:"name required" });

    // Non-owners must have an approved request matching the item name
    const userRole = String(req.user.role || req.user.role_name || '').toLowerCase();
    if (userRole !== 'bar_owner') {
      const [approved] = await pool.query(
        `SELECT id FROM inventory_requests WHERE requester_id = ? AND bar_id = ? AND status = 'approved' AND LOWER(item_name) = LOWER(?) LIMIT 1`,
        [req.user.id, barId, String(name).trim()]
      );
      if (!approved.length) {
        return res.status(403).json({ success: false, message: "You need an approved inventory request for this item before creating it." });
      }
    }

    const newStock = stock_qty !== undefined ? Number(stock_qty) : 0;
    const newReorder = reorder_level !== undefined ? Number(reorder_level) : 0;
    // Optional bulk packaging: 1 pack = N base units (stock is stored atomic).
    let parsedRatio = 1;
    if (units_per_pack !== undefined) {
      parsedRatio = Number(units_per_pack);
      if (!Number.isFinite(parsedRatio) || parsedRatio <= 0) {
        return res.status(400).json({ success:false, message:"units_per_pack must be a number greater than 0" });
      }
    }
    const parsedPackUnit = pack_unit ? String(pack_unit).trim().slice(0, 30) : null;
    const parsedBaseUnit = base_unit ? String(base_unit).trim().slice(0, 30) : (unit ? String(unit).trim() : null);
    let status = "normal";
    if (newStock <= 0) {
      status = "critical";
    } else if (newStock < newReorder) {
      status = "low";
    }

    const supportsPerishableColumns = await hasInventoryPerishableColumns();

    let perishablePayload = null;
    if (supportsPerishableColumns) {
      try {
        const parsedIsPerishable = parsePerishableFlag(is_perishable);
        let parsedExpiryDate = parseOptionalDateOnly(expiry_date, "expiry_date");
        let parsedShelfLifeDays = parseOptionalPositiveInteger(shelf_life_days, "shelf_life_days");
        const parsedDateAdded = parseOptionalDateTime(date_added, "date_added");
        const parsedSpoilageStatus = parseOptionalSpoilageStatus(spoilageStatusInput);

        const isPerishableFlag = parsedIsPerishable !== undefined ? parsedIsPerishable : 0;
        if (isPerishableFlag === 0) {
          parsedExpiryDate = null;
          parsedShelfLifeDays = null;
        }

        perishablePayload = {
          is_perishable: isPerishableFlag,
          expiry_date: parsedExpiryDate !== undefined ? parsedExpiryDate : null,
          shelf_life_days: parsedShelfLifeDays !== undefined ? parsedShelfLifeDays : null,
          date_added: parsedDateAdded !== undefined ? parsedDateAdded : new Date(),
          status: parsedSpoilageStatus || "normal",
        };

        if (perishablePayload.is_perishable === 0) {
          perishablePayload.status = "normal";
        }
      } catch (validationError) {
        return res.status(400).json({ success: false, message: validationError.message });
      }
    }

    const insertSql = supportsPerishableColumns
      ? `INSERT INTO inventory_items
           (bar_id, name, unit, stock_qty, reorder_level, cost_price, stock_status, is_active,
            pack_unit, base_unit, units_per_pack,
            is_perishable, expiry_date, shelf_life_days, date_added, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO inventory_items
           (bar_id, name, unit, stock_qty, reorder_level, cost_price, stock_status, is_active,
            pack_unit, base_unit, units_per_pack)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`;

    const insertParams = supportsPerishableColumns
      ? [
          barId,
          String(name).trim(),
          unit ? String(unit).trim() : null,
          newStock,
          newReorder,
          cost_price !== undefined ? Number(cost_price) : null,
          status,
          parsedPackUnit,
          parsedBaseUnit,
          parsedRatio,
          perishablePayload.is_perishable,
          perishablePayload.expiry_date,
          perishablePayload.shelf_life_days,
          perishablePayload.date_added,
          perishablePayload.status,
        ]
      : [
          barId,
          String(name).trim(),
          unit ? String(unit).trim() : null,
          newStock,
          newReorder,
          cost_price !== undefined ? Number(cost_price) : null,
          status,
          parsedPackUnit,
          parsedBaseUnit,
          parsedRatio,
        ];

    const [result] = await pool.query(insertSql, insertParams);

    return res.status(201).json({ success:true, message:"Item created", data:{ id: result.insertId }});
  } catch (err) {
    console.error("INVENTORY CREATE ERROR:", err);
    return res.status(500).json({ success:false, message: err.sqlMessage || err.message || "Server error" });
  }
});

// OWNER - update item details / thresholds (WITH AUTO STOCK STATUS)
// NOTE: stock_qty is READ-ONLY here — stock moves only through receiving,
// sales, or waste logs. Send a different endpoint for stock movements.
router.patch("/owner/inventory/:id",
  requireAuth,
  requirePermission("menu_update"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const id = Number(req.params.id);

      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });
      if (!id) return res.status(400).json({ success:false, message:"Invalid id" });

      const {
        name,
        unit,
        reorder_level,
        cost_price,
        is_active,
        is_perishable,
        expiry_date,
        shelf_life_days,
        date_added,
        status: spoilageStatusInput,
        pack_unit,
        base_unit,
        units_per_pack,
      } = req.body || {};

      if (req.body?.stock_qty !== undefined) {
        return res.status(400).json({ success:false, message:"Stock quantity is locked — stock updates only through receiving, sales, or waste logs" });
      }

      // Prevent negative price values
      if (cost_price !== undefined && Number(cost_price) < 0) {
        return res.status(400).json({ success: false, message: "cost_price cannot be negative" });
      }

      // Validate conversion ratio (1 pack = N base units)
      let parsedRatio;
      if (units_per_pack !== undefined) {
        parsedRatio = Number(units_per_pack);
        if (!Number.isFinite(parsedRatio) || parsedRatio <= 0) {
          return res.status(400).json({ success: false, message: "units_per_pack must be a number greater than 0" });
        }
      }

      // Get current item first (to compute correct stock_status)
      const [existingRows] = await pool.query(
        "SELECT name, stock_qty, reorder_level, cost_price, units_per_pack FROM inventory_items WHERE id=? AND bar_id=? LIMIT 1",
        [id, barId]
      );

      if (!existingRows.length) {
        return res.status(404).json({ success:false, message:"Item not found" });
      }

      // Non-owners must have an approved request matching the item name
      const userRole = String(req.user.role || req.user.role_name || '').toLowerCase();
      if (userRole !== 'bar_owner') {
        const itemName = name || existingRows[0].name;
        const [approved] = await pool.query(
          `SELECT id FROM inventory_requests WHERE requester_id = ? AND bar_id = ? AND status = 'approved' AND LOWER(item_name) = LOWER(?) LIMIT 1`,
          [req.user.id, barId, String(itemName).trim()]
        );
        if (!approved.length) {
          return res.status(403).json({ success: false, message: "You need an approved inventory request for this item before updating it." });
        }
      }

      const current = existingRows[0];

      // Atomic stock is never written directly here. When the conversion
      // ratio itself changes, rescale the stored base-unit stock so the
      // physical quantity stays identical (old/ratio_old*ratio_new).
      let newStock = Number(current.stock_qty);
      const currentRatio = Number(current.units_per_pack) > 0 ? Number(current.units_per_pack) : 1;
      if (parsedRatio !== undefined && parsedRatio !== currentRatio) {
        newStock = Math.round((Number(current.stock_qty) / currentRatio * parsedRatio) * 100) / 100;
      }

      const newReorder =
        reorder_level !== undefined ? Number(reorder_level) : Number(current.reorder_level);

      // AUTO STOCK STATUS LOGIC
      let status = "normal";

      if (newStock <= 0) {
        status = "critical";
      } else if (newStock < newReorder) {
        status = "low";
      }

      // Notify the bar team when stock transitions INTO a low/critical state
      const oldStatus =
        Number(current.stock_qty) <= 0
          ? "critical"
          : Number(current.stock_qty) < Number(current.reorder_level)
          ? "low"
          : "normal";
      const enteredLowState =
        (status === "low" || status === "critical") &&
        !(oldStatus === "low" || oldStatus === "critical");

      if (enteredLowState) {
        try {
          await createNotification({
            barId,
            type: "low_stock",
            title: status === "critical" ? "Out of Stock" : "Low Stock Alert",
            message: `${current.name} is ${status} (${newStock} left, reorder at ${newReorder}).`,
            referenceType: "inventory_item",
            referenceId: id,
            category: "inventory",
            action: "navigate",
            targetRoute: `/inventory?item=${id}`,
          });
        } catch (e) {
          console.error("low_stock notification failed:", e.message);
        }
      }

      const supportsPerishableColumns = await hasInventoryPerishableColumns();
      let perishableUpdateValues = [];
      if (supportsPerishableColumns) {
        try {
          const parsedIsPerishable = parsePerishableFlag(is_perishable);
          let parsedExpiryDate = parseOptionalDateOnly(expiry_date, "expiry_date");
          let parsedShelfLifeDays = parseOptionalPositiveInteger(shelf_life_days, "shelf_life_days");
          const parsedDateAdded = parseOptionalDateTime(date_added, "date_added");
          let parsedSpoilageStatus = parseOptionalSpoilageStatus(spoilageStatusInput);

          // When explicitly switching an item to non-perishable, clear shelf-life fields.
          if (parsedIsPerishable === 0) {
            parsedExpiryDate = null;
            parsedShelfLifeDays = null;
            parsedSpoilageStatus = "normal";
          }

          const shouldUpdateIsPerishable = parsedIsPerishable !== undefined;
          const shouldUpdateExpiryDate = parsedExpiryDate !== undefined;
          const shouldUpdateShelfLifeDays = parsedShelfLifeDays !== undefined;
          const shouldUpdateDateAdded = parsedDateAdded !== undefined;
          const shouldUpdateSpoilageStatus = parsedSpoilageStatus !== undefined;

          perishableUpdateValues = [
            shouldUpdateIsPerishable ? 1 : 0,
            shouldUpdateIsPerishable ? parsedIsPerishable : null,
            shouldUpdateExpiryDate ? 1 : 0,
            shouldUpdateExpiryDate ? parsedExpiryDate : null,
            shouldUpdateShelfLifeDays ? 1 : 0,
            shouldUpdateShelfLifeDays ? parsedShelfLifeDays : null,
            shouldUpdateDateAdded ? 1 : 0,
            shouldUpdateDateAdded ? parsedDateAdded : null,
            shouldUpdateSpoilageStatus ? 1 : 0,
            shouldUpdateSpoilageStatus ? parsedSpoilageStatus : null,
          ];
        } catch (validationError) {
          return res.status(400).json({ success: false, message: validationError.message });
        }
      }

      const perishableUpdateSql = supportsPerishableColumns
        ? `is_perishable = CASE WHEN ? = 1 THEN ? ELSE is_perishable END,
           expiry_date = CASE WHEN ? = 1 THEN ? ELSE expiry_date END,
           shelf_life_days = CASE WHEN ? = 1 THEN ? ELSE shelf_life_days END,
           date_added = CASE WHEN ? = 1 THEN ? ELSE date_added END,
           status = CASE WHEN ? = 1 THEN ? ELSE status END,`
        : "";

      const [result] = await pool.query(
        `UPDATE inventory_items
         SET
           name = COALESCE(?, name),
           unit = COALESCE(?, unit),
           stock_qty = ?,
           reorder_level = COALESCE(?, reorder_level),
           cost_price = COALESCE(?, cost_price),
           is_active = COALESCE(?, is_active),
           pack_unit = COALESCE(?, pack_unit),
           base_unit = COALESCE(?, base_unit),
           units_per_pack = COALESCE(?, units_per_pack),
           ${perishableUpdateSql}
           stock_status = ?
         WHERE id=? AND bar_id=?`,
        [
          name !== undefined ? String(name).trim() : null,
          unit !== undefined ? (unit ? String(unit).trim() : null) : null,
          newStock,
          reorder_level !== undefined ? Number(reorder_level) : null,
          cost_price !== undefined ? Number(cost_price) : null,
          is_active !== undefined ? Number(is_active) : null,
          pack_unit !== undefined ? (pack_unit ? String(pack_unit).trim().slice(0, 30) : null) : null,
          base_unit !== undefined ? (base_unit ? String(base_unit).trim().slice(0, 30) : null) : null,
          parsedRatio !== undefined ? parsedRatio : null,
          ...perishableUpdateValues,
          status,
          id,
          barId
        ]
      );

      if (result.affectedRows === 0)
        return res.status(404).json({ success:false, message:"Item not found" });

      // Non-blocking audit log for inventory updates (especially price changes, name changes, ratio changes)
      if (cost_price !== undefined || name !== undefined || parsedRatio !== undefined) {
        logAudit(null, {
          bar_id: barId,
          user_id: req.user.id,
          action: "UPDATE_INVENTORY",
          entity: "inventory_items",
          entity_id: id,
          details: {
            ...(cost_price !== undefined ? { cost_price: Number(cost_price), old_cost_price: Number(current.cost_price || 0) } : {}),
            ...(name !== undefined ? { name: String(name).trim() } : {}),
            ...(parsedRatio !== undefined ? { units_per_pack: parsedRatio, rescaled_stock: newStock } : {}),
          },
          stock_status: status,
          ...auditContext(req)
        });
      }

      return res.json({
        success:true,
        message:"Item updated",
        stock_status: status
      });

    } catch (err) {
      console.error("INVENTORY UPDATE ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

router.post(
  "/owner/sales",
  requireAuth,
  requirePermission("menu_update"),
  async (req, res) => {

    const conn = await pool.getConnection();

    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

      const { item_id, quantity } = req.body;

      if (!item_id || !quantity || Number(quantity) <= 0) {
        return res.status(400).json({ success:false, message:"item_id and valid quantity required" });
      }

      await conn.beginTransaction();

      // Get inventory item
      const [itemRows] = await conn.query(
        "SELECT stock_qty, reorder_level, cost_price FROM inventory_items WHERE id=? AND bar_id=? LIMIT 1",
        [item_id, barId]
      );

      if (!itemRows.length) {
        await conn.rollback();
        return res.status(404).json({ success:false, message:"Item not found" });
      }

      const item = itemRows[0];
      const newStock = Number(item.stock_qty) - Number(quantity);

      if (newStock < 0) {
        await conn.rollback();
        return res.status(400).json({ success:false, message:"Not enough stock" });
      }

      // AUTO STATUS CALCULATION
      let status = "normal";
      if (newStock <= 0) {
        status = "critical";
      } else if (newStock < Number(item.reorder_level)) {
        status = "low";
      }

      // Update stock
      await conn.query(
        "UPDATE inventory_items SET stock_qty=?, stock_status=? WHERE id=?",
        [newStock, status, item_id]
      );

      // Insert sales record
      await conn.query(
        "INSERT INTO sales (bar_id, item_id, quantity, total_amount, sale_date) VALUES (?, ?, ?, ?, NOW())",
        [barId, item_id, quantity, Number(item.cost_price || 0) * Number(quantity)]
      );

      await conn.commit();

      // Non-blocking audit log for sale
      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "RECORD_SALE",
        entity: "sales",
        entity_id: item_id,
        details: { item_id, quantity: Number(quantity), total: Number(item.cost_price || 0) * Number(quantity), new_stock: newStock },
        ...auditContext(req)
      });

      return res.json({
        success:true,
        message:"Sale recorded",
        new_stock: newStock,
        stock_status: status
      });

    } catch (err) {
      await conn.rollback();
      console.error("SALES ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    } finally {
      conn.release();
    }
  }
);

// ─── SALES LIST (with date filter) ───
router.get(
  "/owner/sales",
  requireAuth,
  requirePermission(["menu_view", "financials_view"]),
  async (req, res) => {

    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

      const { from, to } = req.query;
      let dateFilter = "";
      const params = [barId];

      if (from && to) {
        dateFilter = " AND DATE(s.sale_date) BETWEEN ? AND ? ";
        params.push(from, to);
      }

      const [rows] = await pool.query(
        `SELECT s.id, s.item_id, i.name AS item_name, s.quantity, s.total_amount,
                s.sale_date
         FROM sales s
         JOIN inventory_items i ON i.id = s.item_id
         WHERE s.bar_id = ? ${dateFilter}
         ORDER BY s.sale_date DESC
         LIMIT 500`,
        params
      );

      return res.json({ success:true, data: rows });
    } catch (err) {
      console.error("SALES LIST ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// ─── SALES SUMMARY (dashboard cards) ───
router.get(
  "/owner/sales/summary",
  requireAuth,
  requirePermission(["menu_view", "financials_view"]),
  async (req, res) => {

    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

      // Today
      const [todayRows] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS count
         FROM sales WHERE bar_id = ? AND DATE(sale_date) = CURDATE()`,
        [barId]
      );

      // This week (Monday to now)
      const [weekRows] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS count
         FROM sales WHERE bar_id = ? AND YEARWEEK(sale_date, 1) = YEARWEEK(CURDATE(), 1)`,
        [barId]
      );

      // This month
      const [monthRows] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS count
         FROM sales WHERE bar_id = ? AND YEAR(sale_date) = YEAR(CURDATE()) AND MONTH(sale_date) = MONTH(CURDATE())`,
        [barId]
      );

      // Best-selling item (last 30 days)
      const [bestRows] = await pool.query(
        `SELECT i.name, SUM(s.quantity) AS total_qty
         FROM sales s JOIN inventory_items i ON i.id = s.item_id
         WHERE s.bar_id = ? AND s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY s.item_id ORDER BY total_qty DESC LIMIT 1`,
        [barId]
      );

      return res.json({
        success:true,
        data: {
          today: todayRows[0],
          week: weekRows[0],
          month: monthRows[0],
          best_seller: bestRows[0] || null
        }
      });
    } catch (err) {
      console.error("SALES SUMMARY ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// ─── INVENTORY IMAGE UPLOAD ───
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const inventoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/inventory";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `item_${req.params.id}_${Date.now()}${ext}`);
  }
});
const inventoryUpload = multer({ storage: inventoryStorage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post(
  "/owner/inventory/:id/image",
  requireAuth,
  requirePermission("menu_update"),
  inventoryUpload.single("image"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const id = Number(req.params.id);
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id" });
      if (!req.file) return res.status(400).json({ success:false, message:"No file uploaded" });

      const filePath = req.file.path.replace(/\\/g, "/");
      const [result] = await pool.query(
        "UPDATE inventory_items SET image_path = ? WHERE id = ? AND bar_id = ?",
        [filePath, id, barId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success:false, message:"Item not found" });
      }

      return res.json({ success:true, message:"Image uploaded", data: { image_path: filePath } });
    } catch (err) {
      console.error("INVENTORY IMAGE ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);
// MENU ITEMS — Inventory-to-Menu Integration
// ═══════════════════════════════════════════════════

// GET /owner/menu — list menu items for this bar
router.get(
  "/owner/menu",
  requireAuth,
  requirePermission("menu_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

      const [rows] = await pool.query(
        `SELECT m.id, m.inventory_item_id, m.menu_name, m.menu_description,
                m.selling_price, m.category, m.is_available, m.sort_order,
                m.sell_unit_type, m.units_per_sale,
                m.created_at, m.updated_at,
                i.name AS inventory_name, i.stock_qty, i.unit, i.cost_price,
                i.pack_unit, i.base_unit, i.units_per_pack,
                i.image_path AS inventory_image,
                CASE
                  WHEN COALESCE(i.stock_qty, 0) <= 0 THEN 'critical'
                  WHEN COALESCE(i.stock_qty, 0) < COALESCE(i.reorder_level, 0) THEN 'low'
                  ELSE 'normal'
                END AS stock_status
         FROM menu_items m
         JOIN inventory_items i ON i.id = m.inventory_item_id
         WHERE m.bar_id = ?
         ORDER BY m.sort_order ASC, m.menu_name ASC`,
        [barId]
      );

      return res.json({ success:true, data: rows });
    } catch (err) {
      console.error("MENU LIST ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// POST /owner/menu — add an inventory item to the menu
router.post(
  "/owner/menu",
  requireAuth,
  requirePermission("menu_create"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

      const { inventory_item_id, menu_name, menu_description, selling_price, category, sell_unit_type, units_per_sale } = req.body || {};

      if (!inventory_item_id) {
        return res.status(400).json({ success:false, message:"inventory_item_id is required" });
      }

      // Verify inventory item belongs to this bar
      const [itemRows] = await pool.query(
        "SELECT id, name, units_per_pack FROM inventory_items WHERE id = ? AND bar_id = ? AND is_active = 1 LIMIT 1",
        [inventory_item_id, barId]
      );
      if (!itemRows.length) {
        return res.status(404).json({ success:false, message:"Inventory item not found" });
      }

      const name = menu_name || itemRows[0].name;
      const price = selling_price !== undefined ? Number(selling_price) : 0;

      if (price < 0) {
        return res.status(400).json({ success:false, message:"selling_price cannot be negative" });
      }

      // Sell-unit breakdown: 'single' deducts `units_per_sale` base units per
      // order; 'pack' deducts a full pack (defaults to the inventory ratio).
      const sellType = String(sell_unit_type || 'single').trim().toLowerCase();
      if (!['single', 'pack'].includes(sellType)) {
        return res.status(400).json({ success:false, message:"sell_unit_type must be 'single' or 'pack'" });
      }
      const invRatio = Number(itemRows[0].units_per_pack) > 0 ? Number(itemRows[0].units_per_pack) : 1;
      let perSale = units_per_sale !== undefined ? Number(units_per_sale) : (sellType === 'pack' ? invRatio : 1);
      if (!Number.isFinite(perSale) || perSale <= 0) {
        return res.status(400).json({ success:false, message:"units_per_sale must be a number greater than 0" });
      }

      const [result] = await pool.query(
        `INSERT INTO menu_items (bar_id, inventory_item_id, menu_name, menu_description, selling_price, category, sell_unit_type, units_per_sale)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [barId, inventory_item_id, String(name).trim(), menu_description || null, price, category || null, sellType, perSale]
      );

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "ADD_TO_MENU",
        entity: "menu_items",
        entity_id: result.insertId,
        details: { inventory_item_id, menu_name: name, selling_price: price },
        ...auditContext(req)
      });

      return res.status(201).json({ success:true, message:"Item added to menu", data:{ id: result.insertId } });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ success:false, message:"This inventory item is already on the menu" });
      }
      console.error("MENU CREATE ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// PATCH /owner/menu/:id — update a menu item (price, name, availability, etc.)
router.patch(
  "/owner/menu/:id",
  requireAuth,
  requirePermission("menu_update"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const id = Number(req.params.id);
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });
      if (!id) return res.status(400).json({ success:false, message:"Invalid id" });

      const allowed = ["menu_name", "menu_description", "selling_price", "category", "is_available", "sort_order", "sell_unit_type", "units_per_sale"];
      const updates = [];
      const params = [];

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          if (key === "selling_price" && Number(req.body[key]) < 0) {
            return res.status(400).json({ success:false, message:"selling_price cannot be negative" });
          }
          if (key === "sell_unit_type" && !["single", "pack"].includes(String(req.body[key]).trim().toLowerCase())) {
            return res.status(400).json({ success:false, message:"sell_unit_type must be 'single' or 'pack'" });
          }
          if (key === "units_per_sale" && (!Number.isFinite(Number(req.body[key])) || Number(req.body[key]) <= 0)) {
            return res.status(400).json({ success:false, message:"units_per_sale must be a number greater than 0" });
          }
          updates.push(`${key} = ?`);
          params.push(key === "sell_unit_type" ? String(req.body[key]).trim().toLowerCase() : req.body[key]);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({ success:false, message:"No fields to update" });
      }

      params.push(id, barId);

      const [result] = await pool.query(
        `UPDATE menu_items SET ${updates.join(", ")} WHERE id = ? AND bar_id = ?`,
        params
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success:false, message:"Menu item not found" });
      }

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "UPDATE_MENU_ITEM",
        entity: "menu_items",
        entity_id: id,
        details: { fields_updated: Object.keys(req.body).filter(k => allowed.includes(k)) },
        ...auditContext(req)
      });

      return res.json({ success:true, message:"Menu item updated" });
    } catch (err) {
      console.error("MENU UPDATE ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// DELETE /owner/menu/:id — remove an item from the menu
router.delete(
  "/owner/menu/:id",
  requireAuth,
  requirePermission("menu_delete"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const id = Number(req.params.id);
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });
      if (!id) return res.status(400).json({ success:false, message:"Invalid id" });

      const [result] = await pool.query(
        "DELETE FROM menu_items WHERE id = ? AND bar_id = ?",
        [id, barId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success:false, message:"Menu item not found" });
      }

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "REMOVE_FROM_MENU",
        entity: "menu_items",
        entity_id: id,
        details: {},
        ...auditContext(req)
      });

      return res.json({ success:true, message:"Item removed from menu" });
    } catch (err) {
      console.error("MENU DELETE ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// ─── SAFE INVENTORY DEACTIVATION (prevents deactivating items used in sales) ───
router.delete(
  "/owner/inventory/:id",
  requireAuth,
  requirePermission("menu_delete"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const id = Number(req.params.id);
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });
      if (!id) return res.status(400).json({ success:false, message:"Invalid id" });

      // Check if item has sales records
      const [salesRows] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM sales WHERE item_id = ? AND bar_id = ?",
        [id, barId]
      );

      if (salesRows[0].cnt > 0) {
        return res.status(409).json({
          success: false,
          message: "Cannot delete this inventory item because it has sales records. You can deactivate it instead."
        });
      }

      // Check if item is on a menu
      const [menuRows] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM menu_items WHERE inventory_item_id = ? AND bar_id = ?",
        [id, barId]
      );

      if (menuRows[0].cnt > 0) {
        return res.status(409).json({
          success: false,
          message: "Cannot delete this inventory item because it is linked to the menu. Remove it from the menu first."
        });
      }

      // Soft-delete (deactivate)
      const [result] = await pool.query(
        "UPDATE inventory_items SET is_active = 0 WHERE id = ? AND bar_id = ?",
        [id, barId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "Item not found" });
      }

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "DEACTIVATE_INVENTORY",
        entity: "inventory_items",
        entity_id: id,
        details: {},
        ...auditContext(req)
      });

      return res.json({ success: true, message: "Item deactivated" });
    } catch (err) {
      console.error("INVENTORY DELETE ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// INVENTORY REQUEST WORKFLOW
// ═══════════════════════════════════════════════════

// STAFF - Submit inventory request
router.post(
  "/owner/inventory/requests",
  requireAuth,
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const userId = req.user.id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { item_name, quantity_needed, unit, reason, cost_price, reorder_level } = req.body || {};
      if (!item_name || !quantity_needed) {
        return res.status(400).json({ success: false, message: "item_name and quantity_needed are required" });
      }

      const supportsExtraColumns = await hasInventoryRequestExtraColumns();
      const parsedCostPrice = cost_price !== undefined && cost_price !== null && cost_price !== ""
        ? Number(cost_price)
        : null;
      const parsedReorderLevel = reorder_level !== undefined && reorder_level !== null && reorder_level !== ""
        ? Number(reorder_level)
        : null;

      const [result] = supportsExtraColumns
        ? await pool.query(
            `INSERT INTO inventory_requests (bar_id, requester_id, item_name, quantity_needed, unit, reason, cost_price, reorder_level, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [barId, userId, item_name, Number(quantity_needed), unit || 'Piece', reason || null, parsedCostPrice, parsedReorderLevel]
          )
        : await pool.query(
            `INSERT INTO inventory_requests (bar_id, requester_id, item_name, quantity_needed, unit, reason, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [barId, userId, item_name, Number(quantity_needed), unit || 'Piece', reason || null]
          );

      logAudit(null, {
        bar_id: barId,
        user_id: userId,
        action: "SUBMIT_INVENTORY_REQUEST",
        entity: "inventory_requests",
        entity_id: result.insertId,
        details: { item_name, quantity_needed, unit },
        ...auditContext(req)
      });

      return res.status(201).json({ success: true, message: "Inventory request submitted", data: { id: result.insertId } });
    } catch (err) {
      console.error("SUBMIT INVENTORY REQUEST ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// STAFF - Get own inventory requests
router.get(
  "/owner/inventory/requests/my",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [rows] = await pool.query(
        `SELECT ir.id, ir.item_name, ir.quantity_needed, ir.unit, ir.reason, ir.status,
                ir.rejection_note, ir.created_at, ir.reviewed_at,
                ir.purchase_order_id, ir.last_purchase_order_id,
                po.status AS linked_po_status,
                u.first_name AS reviewer_first_name, u.last_name AS reviewer_last_name
         FROM inventory_requests ir
         LEFT JOIN purchase_orders po
           ON po.id = COALESCE(ir.purchase_order_id, ir.last_purchase_order_id)
         LEFT JOIN users u ON ir.reviewed_by = u.id
         WHERE ir.requester_id = ? AND ir.bar_id = ?
         ORDER BY ir.created_at DESC`,
        [userId, barId]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("GET MY INVENTORY REQUESTS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// OWNER - Get all inventory requests (with filter by status)
router.get(
  "/owner/inventory/requests",
  requireAuth,
  requirePermission("menu_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const status = req.query.status; // optional filter: pending, approved, rejected
      let query = `
        SELECT ir.id, ir.item_name, ir.quantity_needed, ir.unit, ir.reason, ir.status,
               ir.rejection_note, ir.created_at, ir.reviewed_at,
               ir.purchase_order_id, ir.last_purchase_order_id,
               po.status AS linked_po_status,
               u.first_name AS requester_first_name, u.last_name AS requester_last_name,
               reviewer.first_name AS reviewer_first_name, reviewer.last_name AS reviewer_last_name
        FROM inventory_requests ir
        JOIN users u ON ir.requester_id = u.id
        LEFT JOIN purchase_orders po
          ON po.id = COALESCE(ir.purchase_order_id, ir.last_purchase_order_id)
        LEFT JOIN users reviewer ON ir.reviewed_by = reviewer.id
        WHERE ir.bar_id = ?`;
      
      const params = [barId];
      if (status && ['pending', 'approved', 'rejected'].includes(status)) {
        query += ` AND ir.status = ?`;
        params.push(status);
      }
      
      query += ` ORDER BY 
        CASE ir.status 
          WHEN 'pending' THEN 1 
          WHEN 'approved' THEN 2 
          WHEN 'rejected' THEN 3 
        END, ir.created_at DESC`;

      const [rows] = await pool.query(query, params);

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("GET INVENTORY REQUESTS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// OWNER - Approve inventory request
router.post(
  "/owner/inventory/requests/:id/approve",
  requireAuth,
  requirePermission("menu_update"),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = req.user.bar_id;
      const userId = req.user.id;
      const requestId = Number(req.params.id);
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      await conn.beginTransaction();

      const supportsExtraColumns = await hasInventoryRequestExtraColumns();

      // Verify request belongs to this bar and is pending
      const [existing] = supportsExtraColumns
        ? await conn.query(
            "SELECT id, item_name, quantity_needed, unit, cost_price, reorder_level FROM inventory_requests WHERE id = ? AND bar_id = ? AND status = 'pending' LIMIT 1 FOR UPDATE",
            [requestId, barId]
          )
        : await conn.query(
            "SELECT id, item_name, quantity_needed, unit FROM inventory_requests WHERE id = ? AND bar_id = ? AND status = 'pending' LIMIT 1 FOR UPDATE",
            [requestId, barId]
          );
      if (!existing.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Request not found or already processed" });
      }

      const requestRow = existing[0];
      const normalizedName = String(requestRow.item_name || "").trim();
      const normalizedUnit = String(requestRow.unit || "Piece").trim() || "Piece";

      const requestedQty = Number(requestRow.quantity_needed || 0);
      if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Approved quantity must be greater than 0" });
      }

      const hasRequestedReorder = supportsExtraColumns
        && requestRow.reorder_level !== undefined
        && requestRow.reorder_level !== null
        && requestRow.reorder_level !== "";
      const hasRequestedCost = supportsExtraColumns
        && requestRow.cost_price !== undefined
        && requestRow.cost_price !== null
        && requestRow.cost_price !== "";

      const requestedReorderLevel = hasRequestedReorder ? Math.max(0, Number(requestRow.reorder_level)) : null;
      const requestedCostPrice = hasRequestedCost ? Math.max(0, Number(requestRow.cost_price)) : null;

      const computeStockStatus = (stockQty, reorderLevel) => {
        const qty = Number(stockQty || 0);
        const reorder = Number(reorderLevel || 0);
        if (qty <= 0) return "critical";
        if (qty < reorder) return "low";
        return "normal";
      };

      let inventoryAction = "created_new";
      let inventoryItemId = null;
      let resultingStock = requestedQty;
      let resultingStatus = "normal";

      // Prefer exact name+unit match to restock existing items instead of creating duplicates.
      let [matchedItems] = await conn.query(
        `SELECT ii.id, ii.stock_qty, ii.reorder_level, ii.cost_price, ii.is_active,
                CASE
                  WHEN EXISTS (
                    SELECT 1
                    FROM menu_items mi
                    WHERE mi.bar_id = ii.bar_id AND mi.inventory_item_id = ii.id
                  ) THEN 1
                  ELSE 0
                END AS on_menu
         FROM inventory_items ii
         WHERE ii.bar_id = ?
           AND LOWER(TRIM(ii.name)) = LOWER(TRIM(?))
           AND LOWER(TRIM(COALESCE(ii.unit, ''))) = LOWER(TRIM(COALESCE(?, '')))
         ORDER BY ii.is_active DESC, on_menu DESC, ii.id ASC
         LIMIT 1
         FOR UPDATE`,
        [barId, normalizedName, normalizedUnit]
      );

      // Fallback to name-only match for legacy rows with inconsistent unit values.
      if (!matchedItems.length) {
        [matchedItems] = await conn.query(
          `SELECT ii.id, ii.stock_qty, ii.reorder_level, ii.cost_price, ii.is_active,
                  CASE
                    WHEN EXISTS (
                      SELECT 1
                      FROM menu_items mi
                      WHERE mi.bar_id = ii.bar_id AND mi.inventory_item_id = ii.id
                    ) THEN 1
                    ELSE 0
                  END AS on_menu
           FROM inventory_items ii
           WHERE ii.bar_id = ?
             AND LOWER(TRIM(ii.name)) = LOWER(TRIM(?))
           ORDER BY ii.is_active DESC, on_menu DESC, ii.id ASC
           LIMIT 1
           FOR UPDATE`,
          [barId, normalizedName]
        );
      }

      if (matchedItems.length) {
        const currentItem = matchedItems[0];
        const mergedStockQty = Number(currentItem.stock_qty || 0) + requestedQty;
        const mergedReorderLevel = hasRequestedReorder
          ? requestedReorderLevel
          : Number(currentItem.reorder_level || 0);
        const mergedCostPrice = hasRequestedCost
          ? requestedCostPrice
          : (currentItem.cost_price === null || currentItem.cost_price === undefined
            ? null
            : Number(currentItem.cost_price));
        const mergedStatus = computeStockStatus(mergedStockQty, mergedReorderLevel);

        await conn.query(
          `UPDATE inventory_items
           SET unit = ?,
               stock_qty = ?,
               reorder_level = ?,
               cost_price = ?,
               stock_status = ?,
               is_active = 1
           WHERE id = ? AND bar_id = ?`,
          [
            normalizedUnit,
            mergedStockQty,
            mergedReorderLevel,
            mergedCostPrice,
            mergedStatus,
            currentItem.id,
            barId,
          ]
        );

        inventoryAction = "restocked_existing";
        inventoryItemId = currentItem.id;
        resultingStock = mergedStockQty;
        resultingStatus = mergedStatus;
      } else {
        const createReorderLevel = hasRequestedReorder ? requestedReorderLevel : 0;
        const createStatus = computeStockStatus(requestedQty, createReorderLevel);

        const [insertResult] = await conn.query(
          `INSERT INTO inventory_items (bar_id, name, unit, stock_qty, reorder_level, cost_price, stock_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            barId,
            normalizedName,
            normalizedUnit,
            requestedQty,
            createReorderLevel,
            requestedCostPrice,
            createStatus,
          ]
        );

        inventoryItemId = insertResult.insertId;
        resultingStatus = createStatus;
      }

      // Update request status
      await conn.query(
        "UPDATE inventory_requests SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
        [userId, requestId]
      );

      await conn.commit();

      logAudit(null, {
        bar_id: barId,
        user_id: userId,
        action: "APPROVE_INVENTORY_REQUEST",
        entity: "inventory_requests",
        entity_id: requestId,
        details: {
          item_name: requestRow.item_name,
          quantity_needed: requestRow.quantity_needed,
          inventory_action: inventoryAction,
          inventory_item_id: inventoryItemId,
          resulting_stock: resultingStock,
          stock_status: resultingStatus,
        },
        ...auditContext(req)
      });

      return res.json({
        success: true,
        message: inventoryAction === "restocked_existing"
          ? "Request approved and stock updated"
          : "Request approved and item created",
        data: {
          inventory_item_id: inventoryItemId,
          inventory_action: inventoryAction,
          stock_qty: resultingStock,
          stock_status: resultingStatus,
        },
      });
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      console.error("APPROVE INVENTORY REQUEST ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  }
);

// OWNER - Reject inventory request
router.post(
  "/owner/inventory/requests/:id/reject",
  requireAuth,
  requirePermission("menu_update"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const userId = req.user.id;
      const requestId = Number(req.params.id);
      const { rejection_note } = req.body || {};
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      // Verify request belongs to this bar and is pending
      const [existing] = await pool.query(
        "SELECT id, item_name FROM inventory_requests WHERE id = ? AND bar_id = ? AND status = 'pending' LIMIT 1",
        [requestId, barId]
      );
      if (!existing.length) {
        return res.status(404).json({ success: false, message: "Request not found or already processed" });
      }

      // Update request status
      await pool.query(
        "UPDATE inventory_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_note = ? WHERE id = ?",
        [userId, rejection_note || null, requestId]
      );

      logAudit(null, {
        bar_id: barId,
        user_id: userId,
        action: "REJECT_INVENTORY_REQUEST",
        entity: "inventory_requests",
        entity_id: requestId,
        details: { item_name: existing[0].item_name, rejection_note },
        ...auditContext(req)
      });

      return res.json({ success: true, message: "Request rejected" });
    } catch (err) {
      console.error("REJECT INVENTORY REQUEST ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// SPOILAGE/WASTAGE - log wasted quantity for an item
router.post(
  "/inventory/mark-wasted",
  requireAuth,
  requirePermission("menu_update"),
  inventorySpoilageController.markWasted
);

// SPOILAGE/WASTAGE - list perishable items that are near expiry
router.get(
  "/inventory/near-expiry",
  requireAuth,
  requirePermission("menu_view"),
  inventorySpoilageController.getNearExpiry
);

// SPOILAGE/WASTAGE - list perishable items that are spoiled
router.get(
  "/inventory/spoiled",
  requireAuth,
  requirePermission("menu_view"),
  inventorySpoilageController.getSpoiled
);

// SPOILAGE/WASTAGE - weekly/monthly totals and top wasted items
router.get(
  "/inventory/wastage-summary",
  requireAuth,
  requirePermission(["menu_view", "analytics_bar_view", "financials_view"]),
  inventorySpoilageController.getWastageSummary
);

module.exports = router;