const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const svc = require("../services/leaveBalanceService");
const additions = require("../services/payrollAdditionsService");

const round2 = (n) => Math.round(Number(n) * 100) / 100;

function parseYear(raw) {
  const year = raw ? Number(raw) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return year;
}

// Own balance needs leave_view_own; someone else's needs leave_view_all.
const summaryAccess = (req, res, next) => {
  const other = Number(req.query.user_id);
  const permission = other && other !== req.user.id ? "leave_view_all" : "leave_view_own";
  return requirePermission(permission)(req, res, next);
};

const conversionListAccess = (req, res, next) => {
  const permission = req.query.scope === "all" ? "leave_view_all" : "leave_view_own";
  return requirePermission(permission)(req, res, next);
};

// Converting for yourself needs leave_apply; filing on behalf of another
// employee (HR / manager view) needs leave_view_all instead.
const conversionCreateAccess = (req, res, next) => {
  const other = Number(req.body?.employee_user_id);
  const permission = other && other !== req.user.id ? "leave_view_all" : "leave_apply";
  return requirePermission(permission)(req, res, next);
};

// ── Balance summary (days + hours + conversion window) ──────────────────────
router.get("/", requireAuth, summaryAccess, async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const userId = Number(req.query.user_id) || req.user.id;
    const year = parseYear(req.query.year);
    if (!year) return res.status(400).json({ success: false, message: "Invalid year" });

    const conn = await pool.getConnection();
    try {
      const [[emp]] = await conn.query(
        "SELECT id, first_name, last_name, role FROM users WHERE id = ? AND bar_id = ? LIMIT 1",
        [userId, barId]
      );
      if (!emp) return res.status(404).json({ success: false, message: "Employee not found" });

      const employment = await svc.getEmployment(conn, barId, userId);
      const balances = await svc.getBalances(conn, barId, userId, year, employment);
      const dailyRate = await svc.getDailyRate(conn, barId, userId);
      const perDay = await svc.hoursPerDay(conn, barId);
      const window = await svc.conversionWindowFor(conn, barId);

      return res.json({
        success: true,
        data: {
          year,
          employee: emp,
          daily_rate: dailyRate,
          hourly_rate: dailyRate > 0 ? round2(dailyRate / perDay) : 0,
          hours_per_day: perDay,
          conversion_window: window,
          // Accrual basis: vacation + sick build up 1 day per month employed.
          employment,
          balances,
        },
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("LEAVE BALANCE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── Employee picker for the HR / owner view ─────────────────────────────────
router.get("/employees", requireAuth, requirePermission("leave_view_all"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, role
       FROM users
       WHERE bar_id = ? AND is_active = 1 AND role NOT IN ('bar_owner', 'super_admin', 'customer')
       ORDER BY first_name, last_name`,
      [barId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("LEAVE BALANCE EMPLOYEES ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── Conversion requests (own, or all in the bar with scope=all) ─────────────
router.get("/conversions", requireAuth, conversionListAccess, async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const where = ["c.bar_id = ?"];
    const params = [barId];
    if (req.query.status) {
      where.push("c.status = ?");
      params.push(req.query.status);
    }
    if (req.query.scope !== "all") {
      where.push("c.employee_user_id = ?");
      params.push(req.user.id);
    } else if (Number(req.query.user_id)) {
      where.push("c.employee_user_id = ?");
      params.push(Number(req.query.user_id));
    }

    const perDay = await svc.hoursPerDay(pool, barId);
    const [rows] = await pool.query(
      `SELECT c.id, c.employee_user_id, c.year, c.leave_type_id, c.days, c.daily_rate, c.amount,
              c.status, c.note, c.requested_by, c.decided_by, c.decided_at, c.created_at,
              c.payroll_run_id, c.payroll_item_id, c.applied_at,
              u.first_name, u.last_name, lt.code, lt.name AS leave_type_name,
              d.first_name AS decided_by_first, d.last_name AS decided_by_last
       FROM leave_cash_conversions c
       JOIN users u ON u.id = c.employee_user_id
       JOIN leave_types lt ON lt.id = c.leave_type_id
       LEFT JOIN users d ON d.id = c.decided_by
       WHERE ${where.join(" AND ")}
       ORDER BY c.id DESC
       LIMIT 200`,
      params
    );
    for (const row of rows) {
      row.hours = round2(Number(row.days) * perDay);
      row.hourly_rate = Number(row.daily_rate) > 0 ? round2(Number(row.daily_rate) / perDay) : 0;
      row.approved_by_name = row.decided_by_first
        ? `${row.decided_by_first} ${row.decided_by_last}`.trim()
        : null;
    }
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("LEAVE CONVERSION LIST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── Submit a conversion request (sick leave only, year-end window) ──────────
router.post("/conversions", requireAuth, conversionCreateAccess, async (req, res) => {
  // Only unused SICK leave is convertible to cash. Checked before the window
  // so a non-sick request is rejected the same way all year round.
  const requestedType = String(req.body?.leave_type || "").trim().toLowerCase();
  if (requestedType !== "sick") {
    return res.status(400).json({
      success: false,
      code: "CONVERSION_TYPE_NOT_SUPPORTED",
      message: "Only unused sick leave can be converted to cash. Vacation, emergency, maternity, paternity and special leave are not convertible.",
    });
  }

  const body = req.body || {};
  const leaveType = requestedType; // normalised above: only "sick" gets this far
  const days = round2(body.days);
  if (!(days > 0)) return res.status(400).json({ success: false, message: "days must be greater than 0" });

  const conn = await pool.getConnection();
  try {
    const barId = req.user.bar_id;
    if (!barId) {
      return res.status(400).json({ success: false, message: "No bar_id on account" });
    }

    // Configurable window (per bar): closed outside the stored month/day range.
    const window = await svc.conversionWindowFor(conn, barId);
    if (!window.open) {
      return res.status(403).json({
        success: false,
        code: "CONVERSION_WINDOW_CLOSED",
        message: `Leave-to-cash conversion is only available during a conversion window. Next window: ${window.next_label} (opens ${window.opens}).`,
        data: { conversion_window: window },
      });
    }

    await conn.beginTransaction();

    const targetUserId = Number(req.body.employee_user_id) || req.user.id;
    const [[targetUser]] = await conn.query(
      "SELECT id FROM users WHERE id = ? AND bar_id = ? LIMIT 1",
      [targetUserId, barId]
    );
    if (!targetUser) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const balances = await svc.getBalances(conn, barId, targetUserId, window.year);
    const balance = balances.find((b) => b.leave_type === leaveType);
    if (!balance) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Unknown leave type" });
    }
    if (days > balance.remaining_days) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Only ${balance.remaining_days} day(s) of ${balance.name} remain.`,
      });
    }

    const [dupes] = await conn.query(
      `SELECT id FROM leave_cash_conversions
       WHERE bar_id = ? AND employee_user_id = ? AND year = ? AND leave_type_id = ? AND status = 'pending'
       LIMIT 1`,
      [barId, targetUserId, window.year, balance.leave_type_id]
    );
    if (dupes.length) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "You already have a pending conversion request for this leave type.",
      });
    }

    const dailyRate = await svc.getDailyRate(conn, barId, targetUserId);
    if (!(dailyRate > 0)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "No daily rate is on file for this employee." });
    }

    const amount = round2(days * dailyRate);
    const [ins] = await conn.query(
      `INSERT INTO leave_cash_conversions
         (bar_id, employee_user_id, year, leave_type_id, days, daily_rate, amount, status, note, requested_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [barId, targetUserId, window.year, balance.leave_type_id, days, dailyRate, amount,
        body.note ? String(body.note).slice(0, 255) : null, req.user.id]
    );
    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Conversion request submitted for approval",
      data: {
        id: ins.insertId,
        leave_type: leaveType,
        days,
        daily_rate: dailyRate,
        amount,
        status: "pending",
      },
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error("LEAVE CONVERSION CREATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

// ── Approve / reject a conversion (HR, manager, owner) ──────────────────────
router.patch(
  "/conversions/:id/decision",
  requireAuth,
  requirePermission("leave_approve"),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = req.user.bar_id;
      if (!barId) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "No bar_id on account" });
      }

      const id = Number(req.params.id);
      const { action } = req.body || {};
      if (!id) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Invalid id" });
      }
      if (!action || !["approve", "reject"].includes(action)) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "action must be approve or reject" });
      }

      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT id, employee_user_id, year, leave_type_id, days, daily_rate, amount, status
         FROM leave_cash_conversions
         WHERE id = ? AND bar_id = ? LIMIT 1 FOR UPDATE`,
        [id, barId]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Conversion request not found" });
      }
      const request = rows[0];
      if (request.status !== "pending") {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Only pending requests can be decided" });
      }

      // Defense in depth: only sick-leave conversions may exist, so a row for
      // any other leave type is invalid regardless of how it got there.
      const [[typeRow]] = await conn.query("SELECT code FROM leave_types WHERE id = ? LIMIT 1", [request.leave_type_id]);
      if (svc.requestTypeForCode(typeRow?.code) !== "sick") {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          code: "CONVERSION_TYPE_NOT_SUPPORTED",
          message: "Only unused sick leave can be converted to cash.",
        });
      }

      if (action === "approve") {
        await svc.ensureBalances(conn, barId, request.employee_user_id, request.year);
        const [balRows] = await conn.query(
          `SELECT allocated_days, carryover_days, used_days
           FROM leave_balances
           WHERE bar_id = ? AND employee_user_id = ? AND leave_type_id = ? AND year = ?
           LIMIT 1 FOR UPDATE`,
          [barId, request.employee_user_id, request.leave_type_id, request.year]
        );
        const b = balRows[0] || { allocated_days: 0, carryover_days: 0, used_days: 0 };
        const remaining =
          Number(b.allocated_days) + Number(b.carryover_days) - Number(b.used_days);
        if (Number(request.days) > remaining) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: `Balance changed — only ${round2(remaining)} day(s) remain.`,
          });
        }
        await conn.query(
          `UPDATE leave_balances
           SET used_days = used_days + ?
           WHERE bar_id = ? AND employee_user_id = ? AND leave_type_id = ? AND year = ?`,
          [request.days, barId, request.employee_user_id, request.leave_type_id, request.year]
        );
      }

      const newStatus = action === "approve" ? "approved" : "rejected";
      await conn.query(
        "UPDATE leave_cash_conversions SET status = ?, decided_by = ?, decided_at = NOW() WHERE id = ?",
        [newStatus, req.user.id, id]
      );

      let payroll = { applied: false };
      let hours = 0;
      if (action === "approve") {
        const perDay = await svc.hoursPerDay(conn, barId);
        hours = round2(Number(request.days) * perDay);
        const [[decided]] = await conn.query(
          "SELECT id, employee_user_id, days, daily_rate, amount, decided_by, decided_at FROM leave_cash_conversions WHERE id = ? LIMIT 1",
          [id]
        );
        payroll = await additions.applyToDraftRun(conn, { barId, userId: request.employee_user_id, conversion: decided });
        payroll.applied = Boolean(payroll.applied);
        payroll.amount = round2(payroll.amount ?? Number(decided.amount));
        payroll.hours = hours;
        payroll.message = payroll.applied
          ? `Added to payroll run #${payroll.run_id}`
          : "Will be added to the payroll run covering this date";
      }

      let approvedByName = null;
      if (action === "approve") {
        const [[approver]] = await conn.query(
          "SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1",
          [req.user.id]
        );
        approvedByName = approver ? `${approver.first_name} ${approver.last_name}`.trim() : null;
      }
      await conn.commit();

      return res.json({
        success: true,
        message: `Conversion request ${action}d`,
        data: {
          id,
          status: newStatus,
          hours,
          amount: Number(request.amount || 0),
          decided_by: req.user.id,
          approved_by_name: approvedByName,
          payroll,
        },
      });
    } catch (err) {
      await conn.rollback().catch(() => {});
      console.error("LEAVE CONVERSION DECISION ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  }
);

// ── Conversion window settings (company-wide, per bar) ─────────────────────
router.get("/settings", requireAuth, requirePermission(["payroll_view_all", "leave_view_all"]), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    const conn = await pool.getConnection();
    try {
      const settings = await svc.getConversionSettings(conn, barId);
      const window = svc.conversionWindow(new Date(), settings);
      return res.json({
        success: true,
        data: {
          ...settings,
          windows: window.windows,
          active_label: window.active_label,
          next_label: window.next_label,
          open: window.open,
        },
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("CONVERSION SETTINGS GET ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/settings", requireAuth, requirePermission(["payroll_create", "leave_approve"]), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    const conn = await pool.getConnection();
    try {
      const saved = await svc.saveConversionSettings(conn, barId, req.body || {}, req.user.id);
      if (!saved.ok) return res.status(400).json({ success: false, message: saved.message });
      const window = await svc.conversionWindowFor(conn, barId);
      return res.json({
        success: true,
        message: "Conversion window updated",
        data: { ...saved.settings, windows: window.windows, open: window.open, next_label: window.next_label },
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("CONVERSION SETTINGS PUT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
