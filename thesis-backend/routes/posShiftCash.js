const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { logAudit, auditContext } = require("../utils/audit");

let _hasShiftsTable = null;
let _hasCashTransactionsTable = null;
let _hasPosOrdersShiftIdColumn = null;

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function hasShiftsTable(conn) {
  if (_hasShiftsTable !== null) return _hasShiftsTable;
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'shifts'
     LIMIT 1`
  );
  _hasShiftsTable = rows.length > 0;
  return _hasShiftsTable;
}

async function hasCashTransactionsTable(conn) {
  if (_hasCashTransactionsTable !== null) return _hasCashTransactionsTable;
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'cash_transactions'
     LIMIT 1`
  );
  _hasCashTransactionsTable = rows.length > 0;
  return _hasCashTransactionsTable;
}

async function hasPosOrdersShiftIdColumn(conn) {
  if (_hasPosOrdersShiftIdColumn !== null) return _hasPosOrdersShiftIdColumn;
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'pos_orders'
       AND COLUMN_NAME = 'shift_id'
     LIMIT 1`
  );
  _hasPosOrdersShiftIdColumn = rows.length > 0;
  return _hasPosOrdersShiftIdColumn;
}

async function ensureShiftSchema(conn) {
  const [hasShifts, hasCashTx, hasOrderShift] = await Promise.all([
    hasShiftsTable(conn),
    hasCashTransactionsTable(conn),
    hasPosOrdersShiftIdColumn(conn),
  ]);

  return {
    ok: hasShifts && hasCashTx && hasOrderShift,
    hasShifts,
    hasCashTx,
    hasOrderShift,
  };
}

async function getOpenShift(conn, cashierId, barId, forUpdate = false) {
  const lockClause = forUpdate ? " FOR UPDATE" : "";
  const [rows] = await conn.query(
    `SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) AS cashier_name, u.email AS cashier_email
     FROM shifts s
     LEFT JOIN users u ON u.id = s.cashier_id
     WHERE s.cashier_id = ?
       AND s.bar_id = ?
       AND s.status = 'OPEN'
     ORDER BY s.id DESC
     LIMIT 1${lockClause}`,
    [cashierId, barId]
  );
  return rows[0] || null;
}

async function computeShiftBreakdown(conn, shiftId) {
  const [shiftRows] = await conn.query(
    `SELECT s.*, CONCAT(u.first_name, ' ', u.last_name) AS cashier_name, u.email AS cashier_email
     FROM shifts s
     LEFT JOIN users u ON u.id = s.cashier_id
     WHERE s.id = ?
     LIMIT 1`,
    [shiftId]
  );
  const shift = shiftRows[0] || null;
  if (!shift) return null;

  const [salesRows] = await conn.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS cash_sales,
            COUNT(*) AS cash_order_count
     FROM pos_orders
     WHERE shift_id = ?
       AND status = 'completed'
       AND LOWER(COALESCE(payment_method, '')) = 'cash'`,
    [shiftId]
  );

  const [txnRows] = await conn.query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'CASH_IN' THEN amount ELSE 0 END), 0) AS cash_in,
       COALESCE(SUM(CASE WHEN type = 'CASH_OUT' THEN amount ELSE 0 END), 0) AS cash_out,
       COUNT(*) AS transaction_count
     FROM cash_transactions
     WHERE shift_id = ?`,
    [shiftId]
  );

  const openingCash = toMoney(shift.opening_cash);
  const cashSales = toMoney(salesRows[0]?.cash_sales);
  const cashIn = toMoney(txnRows[0]?.cash_in);
  const cashOut = toMoney(txnRows[0]?.cash_out);
  const expectedCash = toMoney(openingCash + cashSales + cashIn - cashOut);

  return {
    shift,
    breakdown: {
      opening_cash: openingCash,
      cash_sales: cashSales,
      cash_in: cashIn,
      cash_out: cashOut,
      expected_cash: expectedCash,
      cash_order_count: Number(salesRows[0]?.cash_order_count || 0),
      transaction_count: Number(txnRows[0]?.transaction_count || 0),
    },
  };
}

async function updateExpectedCash(conn, shiftId) {
  const data = await computeShiftBreakdown(conn, shiftId);
  if (!data) return null;

  await conn.query(
    `UPDATE shifts
     SET expected_cash = ?
     WHERE id = ?`,
    [data.breakdown.expected_cash, shiftId]
  );

  return data;
}

router.post("/shifts/start", requireAuth, requirePermission("reservation_manage"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const cashierId = req.user.id;
    const barId = req.user.bar_id;
    const openingCash = toMoney(req.body?.opening_cash);

    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      return res.status(400).json({ success: false, message: "opening_cash must be a non-negative number" });
    }

    const schema = await ensureShiftSchema(conn);
    if (!schema.ok) {
      return res.status(500).json({
        success: false,
        message: "Cash shift schema is not ready. Please run shift migration first.",
      });
    }

    await conn.beginTransaction();

    const existingOpen = await getOpenShift(conn, cashierId, barId, true);
    if (existingOpen) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "You already have an open shift." });
    }

    const [insertResult] = await conn.query(
      `INSERT INTO shifts
       (cashier_id, bar_id, opening_cash, expected_cash, status, open_marker, created_at)
       VALUES (?, ?, ?, ?, 'OPEN', 1, NOW())`,
      [cashierId, barId, openingCash, openingCash]
    );

    const shiftId = insertResult.insertId;
    await conn.commit();

    logAudit(null, {
      bar_id: barId,
      user_id: cashierId,
      action: "POS_SHIFT_START",
      entity: "shifts",
      entity_id: shiftId,
      details: { opening_cash: openingCash },
      ...auditContext(req),
    });

    return res.status(201).json({
      success: true,
      message: "Shift started.",
      data: {
        shift: {
          id: shiftId,
          cashier_id: cashierId,
          bar_id: barId,
          opening_cash: openingCash,
          expected_cash: openingCash,
          status: "OPEN",
        },
      },
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // no-op
    }
    console.error("SHIFT START ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

router.get("/shifts/current", requireAuth, requirePermission("reservation_manage"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const cashierId = req.user.id;
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const schema = await ensureShiftSchema(conn);
    if (!schema.ok) {
      return res.status(500).json({
        success: false,
        message: "Cash shift schema is not ready. Please run shift migration first.",
      });
    }

    const openShift = await getOpenShift(conn, cashierId, barId, false);
    if (!openShift) {
      return res.json({ success: true, data: null });
    }

    const data = await updateExpectedCash(conn, openShift.id);

    const [recentTx] = await conn.query(
      `SELECT id, type, amount, reason, created_at
       FROM cash_transactions
       WHERE shift_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [openShift.id]
    );

    return res.json({
      success: true,
      data: {
        ...data,
        recent_transactions: recentTx,
      },
    });
  } catch (err) {
    console.error("SHIFT CURRENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

async function createCashMovement(req, res, type) {
  const conn = await pool.getConnection();
  try {
    const cashierId = req.user.id;
    const barId = req.user.bar_id;
    const amount = toMoney(req.body?.amount);
    const reason = String(req.body?.reason || "").trim();

    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "amount must be greater than 0" });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: "reason is required" });
    }

    const schema = await ensureShiftSchema(conn);
    if (!schema.ok) {
      return res.status(500).json({
        success: false,
        message: "Cash shift schema is not ready. Please run shift migration first.",
      });
    }

    await conn.beginTransaction();

    const openShift = await getOpenShift(conn, cashierId, barId, true);
    if (!openShift) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "No open shift. Start shift first." });
    }

    const [txResult] = await conn.query(
      `INSERT INTO cash_transactions (shift_id, type, amount, reason, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [openShift.id, type, amount, reason]
    );

    const summary = await updateExpectedCash(conn, openShift.id);

    await conn.commit();

    logAudit(null, {
      bar_id: barId,
      user_id: cashierId,
      action: type === "CASH_IN" ? "POS_CASH_IN" : "POS_CASH_OUT",
      entity: "cash_transactions",
      entity_id: txResult.insertId,
      details: { shift_id: openShift.id, amount, reason },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: `${type === "CASH_IN" ? "Cash in" : "Cash out"} recorded.`,
      data: {
        transaction: {
          id: txResult.insertId,
          shift_id: openShift.id,
          type,
          amount,
          reason,
        },
        ...summary,
      },
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // no-op
    }
    console.error("CASH MOVEMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
}

router.post("/cash/in", requireAuth, requirePermission("reservation_manage"), async (req, res) => {
  return createCashMovement(req, res, "CASH_IN");
});

router.post("/cash/out", requireAuth, requirePermission("reservation_manage"), async (req, res) => {
  return createCashMovement(req, res, "CASH_OUT");
});

router.post("/shifts/end", requireAuth, requirePermission("reservation_manage"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const cashierId = req.user.id;
    const barId = req.user.bar_id;
    const actualCash = toMoney(req.body?.actual_cash);

    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    if (!Number.isFinite(actualCash) || actualCash < 0) {
      return res.status(400).json({ success: false, message: "actual_cash must be a non-negative number" });
    }

    const schema = await ensureShiftSchema(conn);
    if (!schema.ok) {
      return res.status(500).json({
        success: false,
        message: "Cash shift schema is not ready. Please run shift migration first.",
      });
    }

    await conn.beginTransaction();

    const openShift = await getOpenShift(conn, cashierId, barId, true);
    if (!openShift) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "No open shift found." });
    }

    const summary = await updateExpectedCash(conn, openShift.id);
    const expectedCash = toMoney(summary.breakdown.expected_cash);
    const difference = toMoney(actualCash - expectedCash);

    const closeStatus = difference === 0 ? "BALANCED" : difference < 0 ? "SHORT" : "OVER";
    const threshold = Number(process.env.SHIFT_DISCREPANCY_THRESHOLD || 100);
    const alertFlag = Number.isFinite(threshold) && Math.abs(difference) > threshold ? 1 : 0;

    await conn.query(
      `UPDATE shifts
       SET expected_cash = ?,
           actual_cash = ?,
           difference = ?,
           status = 'CLOSED',
           close_status = ?,
           alert_flag = ?,
           open_marker = NULL,
           closed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [expectedCash, actualCash, difference, closeStatus, alertFlag, openShift.id]
    );

    await conn.commit();

    logAudit(null, {
      bar_id: barId,
      user_id: cashierId,
      action: "POS_SHIFT_END",
      entity: "shifts",
      entity_id: openShift.id,
      details: { expected_cash: expectedCash, actual_cash: actualCash, difference, close_status: closeStatus, alert_flag: alertFlag },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: "Shift closed.",
      data: {
        shift_id: openShift.id,
        close_status: closeStatus,
        difference,
        alert_flag: alertFlag,
        breakdown: {
          ...summary.breakdown,
          expected_cash: expectedCash,
          actual_cash: actualCash,
          difference,
        },
      },
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // no-op
    }
    console.error("SHIFT END ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

router.get("/shifts/report", requireAuth, requirePermission("reservation_view"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const schema = await ensureShiftSchema(conn);
    if (!schema.ok) {
      return res.status(500).json({
        success: false,
        message: "Cash shift schema is not ready. Please run shift migration first.",
      });
    }

    const { from, to, cashier_id, date, shift_id } = req.query;
    const where = ["s.bar_id = ?"]; 
    const params = [barId];

    if (date) {
      where.push("DATE(s.created_at) = ?");
      params.push(date);
    }

    if (from) {
      where.push("DATE(s.created_at) >= ?");
      params.push(from);
    }
    if (to) {
      where.push("DATE(s.created_at) <= ?");
      params.push(to);
    }
    if (cashier_id) {
      where.push("s.cashier_id = ?");
      params.push(Number(cashier_id));
    }
    if (shift_id) {
      where.push("s.id = ?");
      params.push(Number(shift_id));
    }

    const [rows] = await conn.query(
      `SELECT s.id, s.cashier_id, CONCAT(u.first_name, ' ', u.last_name) AS cashier_name,
              s.opening_cash, s.expected_cash, s.actual_cash, s.difference,
              s.status, s.close_status, s.alert_flag,
              s.created_at, s.closed_at
       FROM shifts s
       LEFT JOIN users u ON u.id = s.cashier_id
       WHERE ${where.join(" AND ")}
       ORDER BY s.id DESC
       LIMIT 300`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SHIFT REPORT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

module.exports = router;
