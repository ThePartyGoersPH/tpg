const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { logAudit, auditContext } = require("../utils/audit");

const PH_TODAY_SQL = "DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))";

let _hasReservationTablesCache = null;
let _hasShiftsTableCache = null;
let _hasPosOrdersShiftIdColumnCache = null;
let _hasReservationPaidAtColumnCache = null;
let _hasReservationPaymentTransactionIdColumnCache = null;

async function hasReservationTables() {
  if (_hasReservationTablesCache !== null) return _hasReservationTablesCache;
  try {
    const [rows] = await pool.query("SHOW TABLES LIKE 'reservation_tables'");
    _hasReservationTablesCache = rows.length > 0;
  } catch (_) {
    _hasReservationTablesCache = false;
  }
  return _hasReservationTablesCache;
}

async function hasShiftsTable(conn) {
  if (_hasShiftsTableCache !== null) return _hasShiftsTableCache;
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'shifts'
     LIMIT 1`
  );
  _hasShiftsTableCache = rows.length > 0;
  return _hasShiftsTableCache;
}

async function hasPosOrdersShiftIdColumn(conn) {
  if (_hasPosOrdersShiftIdColumnCache !== null) return _hasPosOrdersShiftIdColumnCache;
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'pos_orders'
       AND COLUMN_NAME = 'shift_id'
     LIMIT 1`
  );
  _hasPosOrdersShiftIdColumnCache = rows.length > 0;
  return _hasPosOrdersShiftIdColumnCache;
}

async function hasReservationPaidAtColumn(conn) {
  if (_hasReservationPaidAtColumnCache !== null) return _hasReservationPaidAtColumnCache;
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'reservations'
       AND COLUMN_NAME = 'paid_at'
     LIMIT 1`
  );
  _hasReservationPaidAtColumnCache = rows.length > 0;
  return _hasReservationPaidAtColumnCache;
}

async function hasReservationPaymentTransactionIdColumn(conn) {
  if (_hasReservationPaymentTransactionIdColumnCache !== null) return _hasReservationPaymentTransactionIdColumnCache;
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'reservations'
       AND COLUMN_NAME = 'payment_transaction_id'
     LIMIT 1`
  );
  _hasReservationPaymentTransactionIdColumnCache = rows.length > 0;
  return _hasReservationPaymentTransactionIdColumnCache;
}

async function getOpenShiftForCashier(conn, cashierId, barId) {
  const [rows] = await conn.query(
    `SELECT id
     FROM shifts
     WHERE cashier_id = ?
       AND bar_id = ?
       AND status = 'OPEN'
     ORDER BY id DESC
     LIMIT 1`,
    [cashierId, barId]
  );
  return rows[0] || null;
}

async function getReservationTables(conn, reservationId, fallbackTableId = null) {
  const supportsBridge = await hasReservationTables();

  if (supportsBridge) {
    const [rows] = await conn.query(
      `SELECT bt.id AS table_id, bt.table_number, bt.capacity, COALESCE(bt.price, 0) AS price
       FROM reservation_tables rt
       JOIN bar_tables bt ON bt.id = rt.table_id
       WHERE rt.reservation_id = ?
       ORDER BY bt.table_number ASC`,
      [reservationId]
    );

    if (rows.length) return rows;
  }

  if (!fallbackTableId) return [];

  const [fallbackRows] = await conn.query(
    `SELECT bt.id AS table_id, bt.table_number, bt.capacity, COALESCE(bt.price, 0) AS price
     FROM bar_tables bt
     WHERE bt.id = ?
     LIMIT 1`,
    [fallbackTableId]
  );

  return fallbackRows;
}

async function getReservationItems(conn, reservationId) {
  const [rows] = await conn.query(
    `SELECT ri.id, ri.menu_item_id, ri.quantity, ri.unit_price,
            COALESCE(mi.menu_name, CONCAT('Item #', ri.menu_item_id)) AS item_name
     FROM reservation_items ri
     LEFT JOIN menu_items mi ON mi.id = ri.menu_item_id
     WHERE ri.reservation_id = ?
     ORDER BY ri.id ASC`,
    [reservationId]
  );
  return rows;
}

async function tableHasBookedReservationToday(barId, tableId) {
  const supportsBridge = await hasReservationTables();

  let rows = [];
  if (supportsBridge) {
    [rows] = await pool.query(
      `SELECT 1
       FROM (
         SELECT r.id
         FROM reservations r
         WHERE r.bar_id = ?
           AND r.reservation_date = ${PH_TODAY_SQL}
           AND r.status IN ('pending','approved','paid','confirmed','checked_in')
           AND r.table_id = ?
         UNION
         SELECT r.id
         FROM reservations r
         JOIN reservation_tables rt ON rt.reservation_id = r.id
         WHERE r.bar_id = ?
           AND r.reservation_date = ${PH_TODAY_SQL}
           AND r.status IN ('pending','approved','paid','confirmed','checked_in')
           AND rt.table_id = ?
       ) t
       LIMIT 1`,
      [barId, tableId, barId, tableId]
    );
  } else {
    [rows] = await pool.query(
      `SELECT 1
       FROM reservations r
       WHERE r.bar_id = ?
         AND r.reservation_date = ${PH_TODAY_SQL}
         AND r.status IN ('pending','approved','paid','confirmed','checked_in')
         AND r.table_id = ?
       LIMIT 1`,
      [barId, tableId]
    );
  }

  return rows.length > 0;
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function resolveMenuEntryForInclusion(db, barId, itemName) {
  const [rows] = await db.query(
    `SELECT m.id, m.menu_name, m.selling_price, m.inventory_item_id, m.is_available,
            i.name AS inventory_name, i.stock_qty, i.is_active
     FROM menu_items m
     JOIN inventory_items i ON i.id = m.inventory_item_id
     WHERE m.bar_id = ?
       AND (
         LOWER(TRIM(COALESCE(m.menu_name, ''))) = LOWER(TRIM(?))
         OR LOWER(TRIM(COALESCE(i.name, ''))) = LOWER(TRIM(?))
       )
     ORDER BY CASE WHEN LOWER(TRIM(COALESCE(m.menu_name, ''))) = LOWER(TRIM(?)) THEN 0 ELSE 1 END, m.id DESC
     LIMIT 1`,
    [barId, itemName, itemName, itemName]
  );

  return rows[0] || null;
}

function allocatePackageLineAmounts(lines, packageTotal) {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const targetTotal = roundMoney(packageTotal);
  if (targetTotal <= 0) {
    return lines.map((line) => ({
      ...line,
      line_subtotal: 0,
      unit_price: 0,
    }));
  }

  const weighted = lines.map((line) => ({
    ...line,
    raw_total: Number(line.quantity || 0) * Number(line.selling_price || 0),
  }));

  const rawTotal = weighted.reduce((sum, line) => sum + Number(line.raw_total || 0), 0);
  const qtyTotal = weighted.reduce((sum, line) => sum + Number(line.quantity || 0), 0);

  let remaining = targetTotal;
  return weighted.map((line, index) => {
    const isLast = index === weighted.length - 1;
    let lineSubtotal = remaining;

    if (!isLast) {
      let ratio = 0;
      if (rawTotal > 0) {
        ratio = Number(line.raw_total || 0) / rawTotal;
      } else if (qtyTotal > 0) {
        ratio = Number(line.quantity || 0) / qtyTotal;
      }

      lineSubtotal = roundMoney(targetTotal * ratio);
      if (lineSubtotal > remaining) lineSubtotal = remaining;
      if (lineSubtotal < 0) lineSubtotal = 0;
    }

    remaining = roundMoney(remaining - lineSubtotal);
    const qty = Math.max(1, Number(line.quantity || 1));

    return {
      ...line,
      line_subtotal: lineSubtotal,
      unit_price: roundMoney(lineSubtotal / qty),
    };
  });
}

async function buildReservationBalanceData(conn, reservationRow) {
  const tables = await getReservationTables(conn, reservationRow.id, reservationRow.table_id);
  const items = await getReservationItems(conn, reservationRow.id);

  const [paymentRows] = await conn.query(
    `SELECT id, reference_id, amount, status, payment_method, paid_at, created_at
     FROM payment_transactions
     WHERE payment_type = 'reservation' AND related_id = ?
     ORDER BY created_at DESC`,
    [reservationRow.id]
  );

  const tableTotal = tables.reduce((sum, table) => sum + Number(table.price || 0), 0);
  const itemsTotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
  const totalAmount = Number((tableTotal + itemsTotal).toFixed(2));
  const depositAmount = Number(reservationRow.deposit_amount || 0);
  const paidFromHistory = paymentRows
    .filter((payment) => String(payment.status || '').toLowerCase() === 'paid')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidAmount = Number(Math.max(depositAmount, paidFromHistory).toFixed(2));
  const balanceDue = Math.max(0, Number((totalAmount - paidAmount).toFixed(2)));
  const effectivePaymentStatus = balanceDue <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'pending');

  return {
    ...reservationRow,
    tables,
    items,
    payments: paymentRows,
    table_amount: Number(tableTotal.toFixed(2)),
    items_amount: Number(itemsTotal.toFixed(2)),
    total_amount: totalAmount,
    deposit_amount: depositAmount,
    paid_amount: paidAmount,
    effective_payment_status: effectivePaymentStatus,
    balance_due: balanceDue,
  };
}

// ═══════════════════════════════════════════════════
// POS MENU — fetch menu items for POS display
// ═══════════════════════════════════════════════════

router.get(
  "/menu",
  requireAuth,
  requirePermission("menu_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [rows] = await pool.query(
        `SELECT m.id, m.inventory_item_id, m.menu_name, m.menu_description,
                m.selling_price, m.category, m.is_available, m.sort_order,
                m.sell_unit_type, m.units_per_sale,
                i.name AS inventory_name, i.stock_qty, i.unit, i.cost_price,
                i.pack_unit, i.base_unit, i.units_per_pack,
                i.image_path, i.stock_status
         FROM menu_items m
         JOIN inventory_items i ON i.id = m.inventory_item_id
         WHERE m.bar_id = ? AND m.is_available = 1 AND i.is_active = 1
         ORDER BY m.category ASC, m.sort_order ASC, m.menu_name ASC`,
        [barId]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("POS MENU ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// POS PACKAGES — fetch bar packages for POS display
// ═══════════════════════════════════════════════════

router.get(
  "/packages",
  requireAuth,
  requirePermission("menu_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [packages] = await pool.query(
        `SELECT id, name, description, price, is_active, created_at
         FROM bar_packages
         WHERE bar_id = ? AND is_active = 1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [barId]
      );

      for (const pkg of packages) {
        const [inclusions] = await pool.query(
          `SELECT id, item_name, quantity
           FROM package_inclusions
           WHERE package_id = ?
           ORDER BY id ASC`,
          [pkg.id]
        );

        pkg.inclusions = inclusions;
        pkg.is_available = true;
        pkg.unavailable_reason = null;
        let maxPackageQty = null;

        if (!inclusions.length) {
          pkg.is_available = false;
          pkg.unavailable_reason = 'No package inclusions configured';
          pkg.stock_qty = 0;
          continue;
        }

        for (const inclusion of inclusions) {
          const resolved = await resolveMenuEntryForInclusion(pool, barId, inclusion.item_name);
          if (!resolved) {
            pkg.is_available = false;
            pkg.unavailable_reason = `${inclusion.item_name} is not mapped to an active menu item`;
            break;
          }

          if (!Number(resolved.is_available) || !Number(resolved.is_active)) {
            pkg.is_available = false;
            pkg.unavailable_reason = `${resolved.menu_name} is not available`;
            break;
          }

          const neededPerPackage = Math.max(1, Number(inclusion.quantity || 1));
          const availableUnits = Math.floor(Number(resolved.stock_qty || 0) / neededPerPackage);
          maxPackageQty = maxPackageQty === null ? availableUnits : Math.min(maxPackageQty, availableUnits);

          if (availableUnits <= 0) {
            pkg.is_available = false;
            pkg.unavailable_reason = `${resolved.menu_name} is currently out of stock`;
            break;
          }
        }

        pkg.stock_qty = Math.max(0, Number(maxPackageQty ?? 0));
        if (pkg.is_available && pkg.stock_qty <= 0) {
          pkg.is_available = false;
          pkg.unavailable_reason = 'Package is currently out of stock';
        }
      }

      return res.json({ success: true, data: packages });
    } catch (err) {
      console.error("POS PACKAGES ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// POS TABLES — fetch tables for order assignment
// ═══════════════════════════════════════════════════

router.get(
  "/tables",
  requireAuth,
  requirePermission("menu_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [tables] = await pool.query(
        `SELECT id, table_number, capacity, is_active, image_path, price, manual_status
         FROM bar_tables
         WHERE bar_id = ? AND deleted_at IS NULL
         ORDER BY table_number ASC`,
        [barId]
      );

      // Check which tables have active (pending) POS orders
      const [activeOrders] = await pool.query(
        `SELECT table_id, id AS order_id, order_number
         FROM pos_orders
         WHERE bar_id = ? AND status = 'pending' AND table_id IS NOT NULL`,
        [barId]
      );

      const activeMap = {};
      for (const o of activeOrders) {
        activeMap[o.table_id] = { order_id: o.order_id, order_number: o.order_number };
      }

      // Check which tables have active reservations today (primary and linked tables).
      const hasBridgeTable = await hasReservationTables();
      let reservations = [];
      if (hasBridgeTable) {
        [reservations] = await pool.query(
          `SELECT DISTINCT t.table_id
           FROM (
             SELECT r.table_id
             FROM reservations r
             WHERE r.bar_id = ?
               AND r.reservation_date = ${PH_TODAY_SQL}
               AND r.status IN ('pending','approved','paid','confirmed','checked_in')
               AND r.table_id IS NOT NULL
             UNION
             SELECT rt.table_id
             FROM reservations r
             JOIN reservation_tables rt ON rt.reservation_id = r.id
             WHERE r.bar_id = ?
               AND r.reservation_date = ${PH_TODAY_SQL}
               AND r.status IN ('pending','approved','paid','confirmed','checked_in')
           ) t`,
          [barId, barId]
        );
      } else {
        [reservations] = await pool.query(
          `SELECT DISTINCT r.table_id
           FROM reservations r
           WHERE r.bar_id = ?
             AND r.reservation_date = ${PH_TODAY_SQL}
             AND r.status IN ('pending','approved','paid','confirmed','checked_in')
             AND r.table_id IS NOT NULL`,
          [barId]
        );
      }

      const reservedSet = new Set(reservations.map((r) => Number(r.table_id)).filter(Boolean));

      const data = tables.map((t) => {
        const manualStatus = String(t.manual_status || "available").toLowerCase();
        const isUnavailable = Number(t.is_active) === 0 || manualStatus === "unavailable";
        const hasBookedReservation = reservedSet.has(Number(t.id));
        const isManualReserved = manualStatus === "reserved";
        const reservedSource = hasBookedReservation ? "booked" : (isManualReserved ? "manual" : null);

        return {
          ...t,
          status: isUnavailable ? "unavailable" : activeMap[t.id] ? "occupied" : reservedSource ? "reserved" : "available",
          reservation_source: reservedSource,
          active_order: activeMap[t.id] || null,
        };
      });

      return res.json({ success: true, data });
    } catch (err) {
      console.error("POS TABLES ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

router.patch(
  "/tables/:id/status",
  requireAuth,
  requirePermission("menu_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const tableId = Number(req.params.id);
      const nextStatus = String(req.body?.status || "").trim().toLowerCase();
      const allowedStatuses = new Set(["available", "reserved", "unavailable"]);

      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
      if (!tableId) return res.status(400).json({ success: false, message: "Invalid table id" });
      if (!allowedStatuses.has(nextStatus)) {
        return res.status(400).json({ success: false, message: "status must be available, reserved, or unavailable" });
      }

      const [tableRows] = await pool.query(
        `SELECT id, table_number, is_active, manual_status
         FROM bar_tables
         WHERE id = ? AND bar_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [tableId, barId]
      );

      if (!tableRows.length) {
        return res.status(404).json({ success: false, message: "Table not found" });
      }

      const table = tableRows[0];
      if (Number(table.is_active) === 0 && nextStatus !== "unavailable") {
        return res.status(400).json({
          success: false,
          message: "This table is inactive in back-office settings. Ask a manager to reactivate it first.",
        });
      }

      const [activeOrderRows] = await pool.query(
        `SELECT id, order_number
         FROM pos_orders
         WHERE bar_id = ? AND table_id = ? AND status = 'pending'
         ORDER BY id DESC
         LIMIT 1`,
        [barId, tableId]
      );

      if (activeOrderRows.length) {
        return res.status(409).json({
          success: false,
          message: "Table has an active POS order. Complete or cancel the order first.",
        });
      }

      const hasBookedReservation = await tableHasBookedReservationToday(barId, tableId);
      if (hasBookedReservation) {
        return res.status(409).json({
          success: false,
          message: "Table is reserved by a customer booking for today and cannot be changed from POS.",
        });
      }

      await pool.query(
        `UPDATE bar_tables
         SET manual_status = ?
         WHERE id = ? AND bar_id = ? AND deleted_at IS NULL`,
        [nextStatus, tableId, barId]
      );

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "POS_UPDATE_TABLE_STATUS",
        entity: "bar_tables",
        entity_id: tableId,
        details: {
          table_number: table.table_number,
          previous_status: String(table.manual_status || "available").toLowerCase(),
          next_status: nextStatus,
        },
        ...auditContext(req),
      });

      return res.json({
        success: true,
        message: `Table ${String(table.table_number || tableId).padStart(2, "0")} marked as ${nextStatus}.`,
        data: {
          id: tableId,
          manual_status: nextStatus,
        },
      });
    } catch (err) {
      console.error("POS UPDATE TABLE STATUS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// POS CREATE ORDER
// ═══════════════════════════════════════════════════

router.post(
  "/orders",
  requireAuth,
  requirePermission("reservation_manage"),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = req.user.bar_id;
      const staffId = req.user.id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { table_id, items, packages, notes, order_timestamp } = req.body || {};

      const itemRequests = Array.isArray(items) ? items : [];
      const packageRequests = Array.isArray(packages) ? packages : [];
      if (!itemRequests.length && !packageRequests.length) {
        return res.status(400).json({ success: false, message: "Select at least one menu item or package" });
      }

      await conn.beginTransaction();

      const canTrackShifts = (await hasShiftsTable(conn)) && (await hasPosOrdersShiftIdColumn(conn));
      let activeShift = null;
      if (canTrackShifts) {
        activeShift = await getOpenShiftForCashier(conn, staffId, barId);
        if (!activeShift) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: "Start shift first before creating orders." });
        }
      }

      // Validate table if provided
      let selectedTablePrice = 0;
      if (table_id) {
        const [tableRows] = await conn.query(
          "SELECT id, is_active, manual_status, price FROM bar_tables WHERE id = ? AND bar_id = ? AND deleted_at IS NULL LIMIT 1",
          [table_id, barId]
        );
        if (!tableRows.length) {
          await conn.rollback();
          return res.status(404).json({ success: false, message: "Table not found" });
        }
        if (!tableRows[0].is_active) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: "Table is inactive" });
        }
        if (String(tableRows[0].manual_status || "").toLowerCase() === "unavailable") {
          await conn.rollback();
          return res.status(400).json({ success: false, message: "Table is unavailable" });
        }

        const [pendingOrders] = await conn.query(
          `SELECT id FROM pos_orders
           WHERE bar_id = ? AND table_id = ? AND status = 'pending'
           LIMIT 1`,
          [barId, table_id]
        );
        if (pendingOrders.length) {
          await conn.rollback();
          return res.status(409).json({ success: false, message: "Table is occupied by an active POS order" });
        }

        selectedTablePrice = Number(tableRows[0].price || 0);

      }

      // Use client timestamp if provided (device time), otherwise server time (now in Asia/Manila)
      const orderDate = order_timestamp ? new Date(order_timestamp) : new Date();
      
      // Generate order number: POS-YYYYMMDD-NNN (based on order date)
      const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, "");
      const [countRows] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM pos_orders WHERE bar_id = ? AND DATE(created_at) = ?",
        [barId, orderDate.toISOString().slice(0, 10)]
      );
      const seq = String((countRows[0].cnt || 0) + 1).padStart(3, "0");
      const orderNumber = `POS-${dateStr}-${seq}`;

      const orderItems = [];
      const inventoryDemand = new Map();

      const trackDemand = (inventoryItemId, qty, itemName, stockQty) => {
        const key = Number(inventoryItemId);
        const existing = inventoryDemand.get(key);
        if (existing) {
          existing.required_qty += Number(qty || 0);
          return;
        }
        inventoryDemand.set(key, {
          inventory_item_id: key,
          item_name: itemName,
          required_qty: Number(qty || 0),
          stock_qty: Number(stockQty || 0),
        });
      };

      for (const item of itemRequests) {
        const qty = Number(item?.quantity || 0);
        if (!item?.menu_item_id || !qty || qty <= 0) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: "Each menu item needs menu_item_id and quantity > 0" });
        }

        const [menuRows] = await conn.query(
          `SELECT m.id, m.menu_name, m.selling_price, m.inventory_item_id, m.is_available,
                  i.stock_qty, i.is_active
           FROM menu_items m
           JOIN inventory_items i ON i.id = m.inventory_item_id
           WHERE m.id = ? AND m.bar_id = ? LIMIT 1`,
          [item.menu_item_id, barId]
        );

        if (!menuRows.length) {
          await conn.rollback();
          return res.status(404).json({ success: false, message: `Menu item ${item.menu_item_id} not found` });
        }

        const mi = menuRows[0];
        if (!Number(mi.is_available) || !Number(mi.is_active)) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: `${mi.menu_name} is not available` });
        }

        const lineSubtotal = roundMoney(Number(mi.selling_price || 0) * qty);
        orderItems.push({
          menu_item_id: mi.id,
          inventory_item_id: mi.inventory_item_id,
          item_name: mi.menu_name,
          unit_price: roundMoney(mi.selling_price),
          quantity: qty,
          subtotal: lineSubtotal,
        });

        trackDemand(mi.inventory_item_id, qty, mi.menu_name, mi.stock_qty);
      }

      for (const pkg of packageRequests) {
        const packageId = Number(pkg?.package_id || 0);
        const packageQty = Number(pkg?.quantity || 0);

        if (!packageId || !packageQty || packageQty <= 0) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: "Each package needs package_id and quantity > 0" });
        }

        const [packageRows] = await conn.query(
          `SELECT id, name, price, is_active
           FROM bar_packages
           WHERE id = ? AND bar_id = ? AND deleted_at IS NULL
           LIMIT 1`,
          [packageId, barId]
        );

        if (!packageRows.length || !Number(packageRows[0].is_active)) {
          await conn.rollback();
          return res.status(404).json({ success: false, message: `Package ${packageId} is not available` });
        }

        const packageInfo = packageRows[0];
        const [inclusions] = await conn.query(
          `SELECT item_name, quantity
           FROM package_inclusions
           WHERE package_id = ?
           ORDER BY id ASC`,
          [packageId]
        );

        if (!inclusions.length) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: `Package ${packageInfo.name} has no inclusions configured` });
        }

        const packageLines = [];
        for (const inclusion of inclusions) {
          const inclusionName = String(inclusion.item_name || '').trim();
          const inclusionQty = Math.max(1, Number(inclusion.quantity || 1));
          const neededQty = inclusionQty * packageQty;

          const resolved = await resolveMenuEntryForInclusion(conn, barId, inclusionName);
          if (!resolved) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: `Package ${packageInfo.name}: ${inclusionName} is not mapped to an active menu item` });
          }

          if (!Number(resolved.is_available) || !Number(resolved.is_active)) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: `Package ${packageInfo.name}: ${resolved.menu_name} is not available` });
          }

          packageLines.push({
            menu_item_id: Number(resolved.id),
            inventory_item_id: Number(resolved.inventory_item_id),
            menu_name: resolved.menu_name,
            selling_price: Number(resolved.selling_price || 0),
            quantity: neededQty,
            stock_qty: Number(resolved.stock_qty || 0),
          });

          trackDemand(resolved.inventory_item_id, neededQty, resolved.menu_name, resolved.stock_qty);
        }

        const packageTotal = roundMoney(Number(packageInfo.price || 0) * packageQty);
        const allocatedLines = allocatePackageLineAmounts(packageLines, packageTotal);

        for (const line of allocatedLines) {
          orderItems.push({
            menu_item_id: line.menu_item_id,
            inventory_item_id: line.inventory_item_id,
            item_name: `${line.menu_name} (Pkg: ${packageInfo.name})`,
            unit_price: roundMoney(line.unit_price),
            quantity: Number(line.quantity),
            subtotal: roundMoney(line.line_subtotal),
          });
        }
      }

      for (const demand of inventoryDemand.values()) {
        if (Number(demand.required_qty) > Number(demand.stock_qty)) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${demand.item_name}. Required: ${demand.required_qty}, Available: ${demand.stock_qty}`,
          });
        }
      }

      const subtotal = roundMoney(orderItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0));

      const tableAmount = Number(table_id ? selectedTablePrice : 0);
      const totalAmount = roundMoney(subtotal + tableAmount);

      // Insert order with client timestamp
      const [orderResult] = canTrackShifts
        ? await conn.query(
            `INSERT INTO pos_orders (bar_id, table_id, staff_user_id, shift_id, order_number, status, subtotal, total_amount, notes, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
            [barId, table_id || null, staffId, activeShift.id, orderNumber, subtotal, totalAmount, notes || null, orderDate]
          )
        : await conn.query(
            `INSERT INTO pos_orders (bar_id, table_id, staff_user_id, order_number, status, subtotal, total_amount, notes, created_at)
             VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
            [barId, table_id || null, staffId, orderNumber, subtotal, totalAmount, notes || null, orderDate]
          );
      const orderId = orderResult.insertId;

      // Insert order items
      for (const oi of orderItems) {
        await conn.query(
          `INSERT INTO pos_order_items (order_id, menu_item_id, inventory_item_id, item_name, unit_price, quantity, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, oi.menu_item_id, oi.inventory_item_id, oi.item_name, oi.unit_price, oi.quantity, oi.subtotal]
        );
      }

      await conn.commit();

      logAudit(null, {
        bar_id: barId,
        user_id: staffId,
        action: "POS_CREATE_ORDER",
        entity: "pos_orders",
        entity_id: orderId,
        details: { order_number: orderNumber, table_id, table_amount: tableAmount, shift_id: activeShift?.id || null, item_count: orderItems.length, subtotal, total: totalAmount },
        ...auditContext(req)
      });

      return res.status(201).json({
        success: true,
        message: "Order created",
        data: { id: orderId, order_number: orderNumber, shift_id: activeShift?.id || null, total_amount: totalAmount }
      });
    } catch (err) {
      await conn.rollback();
      console.error("POS CREATE ORDER ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  }
);

// ═══════════════════════════════════════════════════
// POS COMPLETE ORDER (Payment)
// ═══════════════════════════════════════════════════

router.post(
  "/orders/:id/pay",
  requireAuth,
  requirePermission("reservation_manage"),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = req.user.bar_id;
      const orderId = Number(req.params.id);
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
      if (!orderId) return res.status(400).json({ success: false, message: "Invalid order id" });

      const { payment_method, amount_received, discount_amount } = req.body || {};

      const normalizedMethod = String(payment_method || "").toLowerCase();
      if (!normalizedMethod || !["cash", "digital", "gcash", "paymaya"].includes(normalizedMethod)) {
        return res.status(400).json({ success: false, message: "payment_method must be cash, gcash, or paymaya" });
      }

      await conn.beginTransaction();

      // Get order
      const [orderRows] = await conn.query(
        "SELECT * FROM pos_orders WHERE id = ? AND bar_id = ? LIMIT 1",
        [orderId, barId]
      );
      if (!orderRows.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      const order = orderRows[0];
      if (order.status !== "pending") {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `Order is already ${order.status}` });
      }

      const discount = Number(discount_amount || 0);
      const baseTotal = Number(order.total_amount || order.subtotal || 0);
      const finalTotal = baseTotal - discount;
      const receivedInput = Number(amount_received || 0);
      const received = normalizedMethod === "cash" ? finalTotal : finalTotal;
      const change = 0;

      if (normalizedMethod === "cash" && receivedInput && receivedInput < finalTotal) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Insufficient payment amount" });
      }

      // Get order items for inventory deduction
      const [orderItems] = await conn.query(
        "SELECT * FROM pos_order_items WHERE order_id = ?",
        [orderId]
      );

      // Deduct inventory + record sales (base-unit aware: menu portion × qty)
      for (const oi of orderItems) {
        // Get current stock + the menu portion size for this order line
        const [invRows] = await conn.query(
          `SELECT i.stock_qty, i.reorder_level, i.cost_price,
                  COALESCE(m.units_per_sale, 1) AS units_per_sale
           FROM inventory_items i
           LEFT JOIN menu_items m ON m.id = ? AND m.bar_id = ?
           WHERE i.id = ? LIMIT 1`,
          [oi.menu_item_id, barId, oi.inventory_item_id]
        );
        if (!invRows.length) continue;

        const inv = invRows[0];
        const perSale = Number(inv.units_per_sale) > 0 ? Number(inv.units_per_sale) : 1;
        const newStock = Number(inv.stock_qty) - oi.quantity * perSale;
        let stockStatus = "normal";
        if (newStock <= 0) stockStatus = "critical";
        else if (newStock < Number(inv.reorder_level)) stockStatus = "low";

        // Update inventory stock
        await conn.query(
          "UPDATE inventory_items SET stock_qty = ?, stock_status = ? WHERE id = ?",
          [Math.max(0, newStock), stockStatus, oi.inventory_item_id]
        );

        // Insert sales record (compatible with existing sales analytics)
        await conn.query(
          "INSERT INTO sales (bar_id, item_id, quantity, total_amount, sale_date) VALUES (?, ?, ?, ?, NOW())",
          [barId, oi.inventory_item_id, oi.quantity, Number(inv.cost_price || 0) * oi.quantity]
        );
      }

      // Update order
      await conn.query(
        `UPDATE pos_orders SET
           status = 'completed',
           payment_method = ?,
           discount_amount = ?,
           total_amount = ?,
           amount_received = ?,
           change_amount = ?,
           completed_at = NOW(),
           updated_at = NOW()
         WHERE id = ?`,
        [normalizedMethod, discount, finalTotal, received, Math.max(0, change), orderId]
      );

      if (order.table_id) {
        await conn.query(
          `UPDATE bar_tables
           SET manual_status = 'reserved', is_active = 1
           WHERE id = ? AND bar_id = ? AND deleted_at IS NULL`,
          [order.table_id, barId]
        );
      }

      await conn.commit();

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "POS_COMPLETE_ORDER",
        entity: "pos_orders",
        entity_id: orderId,
        details: { payment_method: normalizedMethod, total: finalTotal, received, change: Math.max(0, change) },
        ...auditContext(req)
      });

      return res.json({
        success: true,
        message: "Payment processed",
        data: {
          order_id: orderId,
          total_amount: finalTotal,
          amount_received: received,
          change_amount: Math.max(0, change),
          payment_method: normalizedMethod
        }
      });
    } catch (err) {
      await conn.rollback();
      console.error("POS PAY ORDER ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  }
);

// ═══════════════════════════════════════════════════
// POS CANCEL ORDER
// ═══════════════════════════════════════════════════

router.post(
  "/orders/:id/cancel",
  requireAuth,
  requirePermission("reservation_manage"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const orderId = Number(req.params.id);
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [orderRows] = await pool.query(
        "SELECT id, status FROM pos_orders WHERE id = ? AND bar_id = ? LIMIT 1",
        [orderId, barId]
      );
      if (!orderRows.length) return res.status(404).json({ success: false, message: "Order not found" });
      if (orderRows[0].status !== "pending") {
        return res.status(400).json({ success: false, message: `Cannot cancel a ${orderRows[0].status} order` });
      }

      await pool.query(
        "UPDATE pos_orders SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = ?",
        [orderId]
      );

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "POS_CANCEL_ORDER",
        entity: "pos_orders",
        entity_id: orderId,
        details: {},
        ...auditContext(req)
      });

      return res.json({ success: true, message: "Order cancelled" });
    } catch (err) {
      console.error("POS CANCEL ORDER ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// POS RESERVATION LOOKUP BY TRANSACTION NUMBER
// ═══════════════════════════════════════════════════

router.get(
  "/reservations/by-transaction/:transactionNumber",
  requireAuth,
  requirePermission("reservation_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const transactionNumber = String(req.params.transactionNumber || '').trim();
      const normalizedTxn = transactionNumber.replace(/^#/, '').trim();
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
      if (!normalizedTxn) {
        return res.status(400).json({ success: false, message: "Transaction number is required" });
      }

      const [rows] = await pool.query(
        `SELECT r.id, r.transaction_number, r.table_id, r.customer_user_id,
                r.reservation_date, r.reservation_time, r.party_size,
                r.status, r.payment_status, r.deposit_amount,
                r.guest_name, r.guest_email, r.guest_phone,
                r.notes, r.created_at,
                COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), NULLIF(TRIM(r.guest_name), ''), 'Guest') AS customer_name,
                COALESCE(NULLIF(TRIM(cu.email), ''), NULLIF(TRIM(r.guest_email), ''), '-') AS customer_email,
                COALESCE(NULLIF(TRIM(cu.phone_number), ''), NULLIF(TRIM(r.guest_phone), ''), '-') AS customer_phone
         FROM reservations r
         LEFT JOIN users cu ON cu.id = r.customer_user_id
         WHERE r.bar_id = ?
           AND (
             UPPER(TRIM(COALESCE(r.transaction_number, ''))) = UPPER(?)
             OR UPPER(TRIM(COALESCE(r.transaction_number, ''))) = UPPER(CONCAT('#', ?))
             OR EXISTS (
               SELECT 1
               FROM payment_transactions pt
               WHERE pt.payment_type = 'reservation'
                 AND pt.related_id = r.id
                 AND UPPER(TRIM(COALESCE(pt.reference_id, ''))) = UPPER(?)
             )
           )
         ORDER BY r.id DESC
         LIMIT 1`,
        [barId, normalizedTxn, normalizedTxn, normalizedTxn]
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, message: "Reservation not found for this transaction number" });
      }

      const data = await buildReservationBalanceData(pool, rows[0]);
      return res.json({ success: true, data });
    } catch (err) {
      console.error("POS LOOKUP RESERVATION ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// POS COLLECT RESERVATION BALANCE (CASH / ONLINE)
// ═══════════════════════════════════════════════════

router.patch(
  "/reservations/:id/pay-balance",
  requireAuth,
  requirePermission("reservation_manage"),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = req.user.bar_id;
      const reservationId = Number(req.params.id);
      const paymentMethodRaw = String(req.body?.payment_method || 'cash').toLowerCase().trim();
      const paymentMethod = paymentMethodRaw === 'online' ? 'gcash' : paymentMethodRaw;
      const allowedMethods = new Set(['cash', 'gcash', 'paymaya']);
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
      if (!reservationId) return res.status(400).json({ success: false, message: "Invalid reservation id" });
      if (!allowedMethods.has(paymentMethod)) {
        return res.status(400).json({ success: false, message: "payment_method must be cash, gcash, or paymaya" });
      }

      await conn.beginTransaction();

      const [rows] = await conn.query(
        `SELECT r.id, r.transaction_number, r.table_id,
                r.status, r.payment_status, r.deposit_amount,
                r.guest_name, r.guest_email, r.guest_phone,
                r.notes, r.created_at,
                COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), NULLIF(TRIM(r.guest_name), ''), 'Guest') AS customer_name,
                COALESCE(NULLIF(TRIM(cu.email), ''), NULLIF(TRIM(r.guest_email), ''), '-') AS customer_email,
                COALESCE(NULLIF(TRIM(cu.phone_number), ''), NULLIF(TRIM(r.guest_phone), ''), '-') AS customer_phone
         FROM reservations r
         LEFT JOIN users cu ON cu.id = r.customer_user_id
         WHERE r.id = ? AND r.bar_id = ?
         LIMIT 1
         FOR UPDATE`,
        [reservationId, barId]
      );

      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Reservation not found" });
      }

      const current = rows[0];
      const allowedStatuses = ["approved", "confirmed", "paid", "checked_in"];
      if (!allowedStatuses.includes(String(current.status || '').toLowerCase())) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Cannot mark balance paid for this reservation status" });
      }

      if (String(current.payment_status || '').toLowerCase() === 'paid') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Balance is already fully paid" });
      }

      const details = await buildReservationBalanceData(conn, current);
      const balanceDue = Number(details.balance_due || 0);
      if (balanceDue <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "No remaining balance to collect" });
      }

      const referenceId = `RES-BAL-${reservationId}-${Date.now()}`;
      const note = `Balance ₱${balanceDue.toFixed(2)} collected in person (${paymentMethod}) via POS`;
      const includePaidAt = await hasReservationPaidAtColumn(conn);
      const includePaymentTxId = await hasReservationPaymentTransactionIdColumn(conn);

      const [paymentInsert] = await conn.query(
        `INSERT INTO payment_transactions
         (reference_id, payment_type, related_id, bar_id, user_id, amount, status, payment_method, paid_at, metadata)
         VALUES (?, 'reservation', ?, ?, ?, ?, 'paid', ?, NOW(), ?)`,
        [
          referenceId,
          reservationId,
          barId,
          req.user.id,
          balanceDue,
          paymentMethod,
          JSON.stringify({
            source: 'pos_balance_collection',
            collected_by: req.user.id,
          }),
        ]
      );

      const paymentTransactionId = paymentInsert.insertId;

      if (includePaidAt) {
        if (includePaymentTxId) {
          await conn.query(
            `UPDATE reservations
             SET payment_status = 'paid',
                 payment_method = ?,
                 payment_reference = ?,
                 payment_transaction_id = ?,
                 paid_at = NOW(),
                 notes = CONCAT(COALESCE(notes, ''), IF(notes IS NOT NULL AND notes != '', ' | ', ''), ?)
             WHERE id = ?`,
            [paymentMethod, referenceId, paymentTransactionId, note, reservationId]
          );
        } else {
          await conn.query(
            `UPDATE reservations
             SET payment_status = 'paid',
                 payment_method = ?,
                 payment_reference = ?,
                 paid_at = NOW(),
                 notes = CONCAT(COALESCE(notes, ''), IF(notes IS NOT NULL AND notes != '', ' | ', ''), ?)
             WHERE id = ?`,
            [paymentMethod, referenceId, note, reservationId]
          );
        }
      } else {
        if (includePaymentTxId) {
          await conn.query(
            `UPDATE reservations
             SET payment_status = 'paid',
                 payment_method = ?,
                 payment_reference = ?,
                 payment_transaction_id = ?,
                 notes = CONCAT(COALESCE(notes, ''), IF(notes IS NOT NULL AND notes != '', ' | ', ''), ?)
             WHERE id = ?`,
            [paymentMethod, referenceId, paymentTransactionId, note, reservationId]
          );
        } else {
          await conn.query(
            `UPDATE reservations
             SET payment_status = 'paid',
                 payment_method = ?,
                 payment_reference = ?,
                 notes = CONCAT(COALESCE(notes, ''), IF(notes IS NOT NULL AND notes != '', ' | ', ''), ?)
             WHERE id = ?`,
            [paymentMethod, referenceId, note, reservationId]
          );
        }
      }

      await conn.commit();

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "POS_MARK_RESERVATION_BALANCE_PAID",
        entity: "reservations",
        entity_id: reservationId,
        details: {
          transaction_number: current.transaction_number,
          balance_due: balanceDue,
          payment_method: paymentMethod,
          payment_reference: referenceId,
          payment_transaction_id: paymentTransactionId,
        },
        ...auditContext(req),
      });

      return res.json({
        success: true,
        message: `Balance of ₱${balanceDue.toFixed(2)} marked as paid via ${paymentMethod.toUpperCase()}.`,
      });
    } catch (err) {
      try {
        await conn.rollback();
      } catch (_) {
        // no-op
      }
      console.error("POS MARK RESERVATION BALANCE PAID ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  }
);

// ═══════════════════════════════════════════════════
// POS ORDER LIST (history) — merges pos_orders + legacy sales
// ═══════════════════════════════════════════════════

router.get(
  "/orders",
  requireAuth,
  requirePermission("reservation_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { status, from, to, limit: lim } = req.query;
      const rowLimit = Math.min(Number(lim) || 100, 500);

      // --- 1) POS orders ---
      const posWhere = ["o.bar_id = ?"];
      const posParams = [barId];
      if (status) { posWhere.push("o.status = ?"); posParams.push(status); }
      if (from) { posWhere.push("DATE(o.created_at) >= ?"); posParams.push(from); }
      if (to) { posWhere.push("DATE(o.created_at) <= ?"); posParams.push(to); }

      const [posOrders] = await pool.query(
        `SELECT o.id, o.order_number, o.table_id, t.table_number,
                COALESCE(t.price, 0) AS table_price,
                o.staff_user_id, CONCAT(u.first_name, ' ', u.last_name) AS staff_name,
                o.status, o.subtotal, o.discount_amount, o.total_amount,
                o.payment_method, o.amount_received, o.change_amount,
                o.notes, o.completed_at, o.cancelled_at, o.created_at
         FROM pos_orders o
         LEFT JOIN bar_tables t ON t.id = o.table_id
         LEFT JOIN users u ON u.id = o.staff_user_id
         WHERE ${posWhere.join(" AND ")}
         ORDER BY o.created_at DESC
         LIMIT ?`,
        [...posParams, rowLimit]
      );

      // --- 2) Legacy sales (from sales table, grouped by sale_date) ---
      // Only include sales from dates that have NO POS orders (to avoid double-counting)
      let legacySales = [];
      if (!status || status === "completed") {
        const legWhere = ["s.bar_id = ?"];
        const legParams = [barId];
        if (from) { legWhere.push("DATE(s.sale_date) >= ?"); legParams.push(from); }
        if (to) { legWhere.push("DATE(s.sale_date) <= ?"); legParams.push(to); }
        
        // Exclude dates that already have POS orders
        legWhere.push(`NOT EXISTS (
          SELECT 1 FROM pos_orders po 
          WHERE po.bar_id = s.bar_id 
          AND DATE(po.created_at) = DATE(s.sale_date)
        )`);

        const [rows] = await pool.query(
          `SELECT
             MIN(s.id) AS id,
             CONCAT('SALE-', DATE(MIN(s.sale_date))) AS order_number,
             NULL AS table_id, NULL AS table_number,
             NULL AS staff_user_id, 'Web / Manual' AS staff_name,
             'completed' AS status,
             COALESCE(SUM(COALESCE(m.selling_price * s.quantity, s.total_amount)), 0) AS subtotal,
             0 AS discount_amount,
             COALESCE(SUM(COALESCE(m.selling_price * s.quantity, s.total_amount)), 0) AS total_amount,
             'legacy' AS payment_method,
             0 AS amount_received, 0 AS change_amount,
             NULL AS notes,
             MAX(s.sale_date) AS completed_at,
             NULL AS cancelled_at,
             MAX(s.sale_date) AS created_at
           FROM sales s
           LEFT JOIN menu_items m ON m.inventory_item_id = s.item_id AND m.bar_id = s.bar_id
           WHERE ${legWhere.join(" AND ")}
           GROUP BY DATE(s.sale_date)
           ORDER BY DATE(s.sale_date) DESC
           LIMIT ?`,
          [...legParams, rowLimit]
        );
        legacySales = rows;
      }

      // --- 3) Merge & sort by date descending ---
      const all = [...posOrders, ...legacySales];
      all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return res.json({ success: true, data: all.slice(0, rowLimit) });
    } catch (err) {
      console.error("POS ORDERS LIST ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// POS ORDER DETAIL (with items)
// ═══════════════════════════════════════════════════

router.get(
  "/orders/:id",
  requireAuth,
  requirePermission("reservation_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const orderId = Number(req.params.id);
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [orderRows] = await pool.query(
        `SELECT o.*, t.table_number, COALESCE(t.price, 0) AS table_price,
          CONCAT(u.first_name, ' ', u.last_name) AS staff_name
         FROM pos_orders o
         LEFT JOIN bar_tables t ON t.id = o.table_id
         LEFT JOIN users u ON u.id = o.staff_user_id
         WHERE o.id = ? AND o.bar_id = ? LIMIT 1`,
        [orderId, barId]
      );
      if (!orderRows.length) return res.status(404).json({ success: false, message: "Order not found" });

      const [items] = await pool.query(
        `SELECT oi.*, i.image_path
         FROM pos_order_items oi
         LEFT JOIN inventory_items i ON i.id = oi.inventory_item_id
         WHERE oi.order_id = ?`,
        [orderId]
      );

      return res.json({ success: true, data: { ...orderRows[0], items } });
    } catch (err) {
      console.error("POS ORDER DETAIL ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// POS DASHBOARD SUMMARY — uses POS orders as source of truth
// ═══════════════════════════════════════════════════

router.get(
  "/dashboard",
  requireAuth,
  requirePermission("menu_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const PAID_STATUSES = "('completed','paid')";
      const completedDateExpr = "DATE(DATE_ADD(COALESCE(o.completed_at, o.updated_at, o.created_at), INTERVAL 8 HOUR))";
      const createdDateExpr = "DATE(DATE_ADD(o.created_at, INTERVAL 8 HOUR))";

      // Today's POS totals (all completed/paid POS orders, including online QR payments)
      const [todayOrders] = await pool.query(
        `SELECT
           COUNT(*) AS completed_count,
           COALESCE(SUM(o.total_amount), 0) AS revenue
         FROM pos_orders o
         WHERE o.bar_id = ?
           AND o.status IN ${PAID_STATUSES}
           AND ${completedDateExpr} = ${PH_TODAY_SQL}`,
        [barId]
      );

      // Pending POS orders count
      const [pendingRows] = await pool.query(
        `SELECT
           SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_count,
           SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled_count
         FROM pos_orders o
         WHERE o.bar_id = ?
           AND ${createdDateExpr} = ${PH_TODAY_SQL}`,
        [barId]
      );

      // Weekly POS totals (PH-local week)
      const [weekOrders] = await pool.query(
        `SELECT
           COALESCE(SUM(o.total_amount), 0) AS revenue,
           COUNT(*) AS order_count
         FROM pos_orders o
         WHERE o.bar_id = ?
           AND o.status IN ${PAID_STATUSES}
           AND YEARWEEK(${completedDateExpr}, 1) = YEARWEEK(${PH_TODAY_SQL}, 1)`,
        [barId]
      );

      // Top selling POS items today from completed orders
      const [topItems] = await pool.query(
        `SELECT
            COALESCE(NULLIF(TRIM(poi.item_name), ''), 'Unknown Item') AS item_name,
            COALESCE(SUM(poi.quantity), 0) AS total_qty,
            COALESCE(SUM(poi.subtotal), 0) AS total_revenue
         FROM pos_order_items poi
         JOIN pos_orders o ON o.id = poi.order_id
         WHERE o.bar_id = ?
           AND o.status IN ${PAID_STATUSES}
           AND ${completedDateExpr} = ${PH_TODAY_SQL}
         GROUP BY COALESCE(NULLIF(TRIM(poi.item_name), ''), 'Unknown Item')
         ORDER BY total_qty DESC
         LIMIT 5`,
        [barId]
      );

      // Low stock alerts
      const [lowStock] = await pool.query(
        `SELECT id, name, stock_qty, reorder_level, stock_status, unit,
                pack_unit, base_unit, units_per_pack
         FROM inventory_items
         WHERE bar_id = ? AND is_active = 1 AND stock_status IN ('low','critical')
         ORDER BY stock_qty ASC
         LIMIT 10`,
        [barId]
      );

      return res.json({
        success: true,
        data: {
          today: {
            revenue: todayOrders[0].revenue,
            completed_count: todayOrders[0].completed_count,
            pending_count: pendingRows[0].pending_count || 0,
            cancelled_count: pendingRows[0].cancelled_count || 0,
          },
          week: weekOrders[0],
          top_items: topItems,
          low_stock: lowStock,
        }
      });
    } catch (err) {
      console.error("POS DASHBOARD ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
