const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { logAudit } = require("../utils/audit");
const { calculateAllDeductions } = require("../utils/deductionCalculator");
const payrollAdditions = require("../services/payrollAdditionsService");
const attendanceRoute = require("./attendance");

let payrollSchemaMetaPromise = null;
const recomputeAttendanceForLog = attendanceRoute.recomputeAttendanceForLog;

async function recomputeAttendanceMetricsForPeriod(conn, { barId, periodStart, periodEnd }) {
  if (typeof recomputeAttendanceForLog !== "function") return 0;

  const [rows] = await conn.query(
    `SELECT id, bar_id, employee_user_id, work_date, time_in, time_out
     FROM attendance_logs
     WHERE bar_id=?
       AND work_date BETWEEN ? AND ?
       AND time_in IS NOT NULL`,
    [barId, periodStart, periodEnd]
  );

  for (const row of rows) {
    await recomputeAttendanceForLog(conn, row);
  }

  return rows.length;
}

/**
 * GET PAYROLL SETTINGS
 * GET /hr/payroll/settings
 */
router.get(
  "/settings",
  requireAuth,
  requirePermission("payroll_view_all"),
  async (req, res) => {
    try {
      const barId = getBarIdOr403(req, res);
      if (!barId) return;

      const schemaMeta = await getPayrollSchemaMeta();
      const extraCols = [];
      if (schemaMeta.payrollSettings.has("standard_work_minutes")) extraCols.push("standard_work_minutes");
      if (schemaMeta.payrollSettings.has("default_break_minutes")) extraCols.push("default_break_minutes");
      if (schemaMeta.payrollSettings.has("half_day_threshold_minutes")) extraCols.push("half_day_threshold_minutes");
      if (schemaMeta.payrollSettings.has("overtime_multiplier")) extraCols.push("overtime_multiplier");
      if (schemaMeta.payrollSettings.has("undertime_penalty_multiplier")) extraCols.push("undertime_penalty_multiplier");

      const [rows] = await pool.query(
        `SELECT id, bar_id, sss_rate, philhealth_rate, pagibig_rate, 
                withholding_tax_rate, minimum_wage${extraCols.length ? `, ${extraCols.join(", ")}` : ""}, updated_at
         FROM payroll_settings
         WHERE bar_id = ?
         LIMIT 1`,
        [barId]
      );

      if (rows.length === 0) {
        // Return default values if no settings exist yet
        return res.json({
          success: true,
          data: {
            bar_id: barId,
            sss_rate: 4.50,
            philhealth_rate: 3.00,
            pagibig_rate: 2.00,
            withholding_tax_rate: 0.00,
            minimum_wage: 610.00,
            standard_work_minutes: 480,
            default_break_minutes: 60,
            half_day_threshold_minutes: 240,
            overtime_multiplier: 1.25,
            undertime_penalty_multiplier: 1.00,
            updated_at: null
          }
        });
      }

      return res.json({ success: true, data: rows[0] });
    } catch (err) {
      console.error("GET PAYROLL SETTINGS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * UPDATE PAYROLL SETTINGS
 * PUT /hr/payroll/settings
 */
router.put(
  "/settings",
  requireAuth,
  requirePermission("payroll_create"),
  async (req, res) => {
    try {
      const barId = getBarIdOr403(req, res);
      if (!barId) return;

      const {
        sss_rate,
        philhealth_rate,
        pagibig_rate,
        withholding_tax_rate,
        minimum_wage,
        standard_work_minutes,
        default_break_minutes,
        half_day_threshold_minutes,
        overtime_multiplier,
        undertime_penalty_multiplier,
      } = req.body;

      const schemaMeta = await getPayrollSchemaMeta();

      // Validate rates
      if (
        sss_rate == null ||
        philhealth_rate == null ||
        pagibig_rate == null ||
        withholding_tax_rate == null ||
        minimum_wage == null
      ) {
        return res.status(400).json({
          success: false,
          message: "All fields are required"
        });
      }

      // Check if settings exist
      const [existing] = await pool.query(
        "SELECT id FROM payroll_settings WHERE bar_id = ?",
        [barId]
      );

      if (existing.length > 0) {
        const updates = [
          "sss_rate = ?",
          "philhealth_rate = ?",
          "pagibig_rate = ?",
          "withholding_tax_rate = ?",
          "minimum_wage = ?",
        ];
        const params = [sss_rate, philhealth_rate, pagibig_rate, withholding_tax_rate, minimum_wage];

        if (schemaMeta.payrollSettings.has("standard_work_minutes") && standard_work_minutes !== undefined) {
          updates.push("standard_work_minutes = ?");
          params.push(Math.max(1, Number(standard_work_minutes || 480)));
        }
        if (schemaMeta.payrollSettings.has("default_break_minutes") && default_break_minutes !== undefined) {
          updates.push("default_break_minutes = ?");
          params.push(Math.max(0, Number(default_break_minutes || 60)));
        }
        if (schemaMeta.payrollSettings.has("half_day_threshold_minutes") && half_day_threshold_minutes !== undefined) {
          updates.push("half_day_threshold_minutes = ?");
          params.push(Math.max(1, Number(half_day_threshold_minutes || 240)));
        }
        if (schemaMeta.payrollSettings.has("overtime_multiplier") && overtime_multiplier !== undefined) {
          updates.push("overtime_multiplier = ?");
          params.push(Math.max(1, Number(overtime_multiplier || 1.25)));
        }
        if (schemaMeta.payrollSettings.has("undertime_penalty_multiplier") && undertime_penalty_multiplier !== undefined) {
          updates.push("undertime_penalty_multiplier = ?");
          params.push(Math.max(0, Number(undertime_penalty_multiplier || 1.0)));
        }

        updates.push("updated_at = NOW()");
        params.push(barId);

        await pool.query(
          `UPDATE payroll_settings SET ${updates.join(", ")} WHERE bar_id = ?`,
          params
        );
      } else {
        const insertCols = [
          "bar_id",
          "sss_rate",
          "philhealth_rate",
          "pagibig_rate",
          "withholding_tax_rate",
          "minimum_wage",
        ];
        const insertVals = [barId, sss_rate, philhealth_rate, pagibig_rate, withholding_tax_rate, minimum_wage];

        if (schemaMeta.payrollSettings.has("standard_work_minutes")) {
          insertCols.push("standard_work_minutes");
          insertVals.push(Math.max(1, Number(standard_work_minutes || 480)));
        }
        if (schemaMeta.payrollSettings.has("default_break_minutes")) {
          insertCols.push("default_break_minutes");
          insertVals.push(Math.max(0, Number(default_break_minutes || 60)));
        }
        if (schemaMeta.payrollSettings.has("half_day_threshold_minutes")) {
          insertCols.push("half_day_threshold_minutes");
          insertVals.push(Math.max(1, Number(half_day_threshold_minutes || 240)));
        }
        if (schemaMeta.payrollSettings.has("overtime_multiplier")) {
          insertCols.push("overtime_multiplier");
          insertVals.push(Math.max(1, Number(overtime_multiplier || 1.25)));
        }
        if (schemaMeta.payrollSettings.has("undertime_penalty_multiplier")) {
          insertCols.push("undertime_penalty_multiplier");
          insertVals.push(Math.max(0, Number(undertime_penalty_multiplier || 1.0)));
        }

        await pool.query(
          `INSERT INTO payroll_settings (${insertCols.join(", ")})
           VALUES (${insertCols.map(() => "?").join(", ")})`,
          insertVals
        );
      }

      // Log audit
      await logAudit(
        barId,
        req.user.id,
        "UPDATE_PAYROLL_SETTINGS",
        "payroll_settings",
        existing.length > 0 ? existing[0].id : null,
        {
          sss_rate,
          philhealth_rate,
          pagibig_rate,
          withholding_tax_rate,
          minimum_wage,
          standard_work_minutes,
          default_break_minutes,
          half_day_threshold_minutes,
          overtime_multiplier,
          undertime_penalty_multiplier,
        }
      );

      return res.json({
        success: true,
        message: "Payroll settings updated successfully"
      });
    } catch (err) {
      console.error("UPDATE PAYROLL SETTINGS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * Helpers
 */
function getBarIdOr403(req, res) {
  const barId = req.user?.bar_id;
  if (barId === null || barId === undefined) {
    res.status(403).json({ success: false, message: "No bar_id on account" });
    return null;
  }
  return barId;
}

function isValidYMD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toUTCts(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function roundMoney(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function formatYMD(d) {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }
  return String(d).slice(0, 10);
}

async function getPayrollSchemaMeta(conn = pool) {
  if (payrollSchemaMetaPromise) return payrollSchemaMetaPromise;

  payrollSchemaMetaPromise = (async () => {
    const [attendanceCols] = await conn.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_logs'`
    );

    const [payrollItemCols] = await conn.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_items'`
    );

    const [payrollSettingsCols] = await conn.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_settings'`
    );

    return {
      attendance: new Set(attendanceCols.map((r) => r.COLUMN_NAME)),
      payrollItems: new Set(payrollItemCols.map((r) => r.COLUMN_NAME)),
      payrollSettings: new Set(payrollSettingsCols.map((r) => r.COLUMN_NAME)),
    };
  })();

  return payrollSchemaMetaPromise;
}

async function getPayrollComputationSettings(barId, conn, schemaMeta) {
  const settings = {
    standard_work_minutes: 480,
    default_break_minutes: 60,
    half_day_threshold_minutes: 240,
    overtime_multiplier: 1.25,
    undertime_penalty_multiplier: 1.0,
  };

  const selectable = [];
  if (schemaMeta.payrollSettings.has("standard_work_minutes")) selectable.push("standard_work_minutes");
  if (schemaMeta.payrollSettings.has("default_break_minutes")) selectable.push("default_break_minutes");
  if (schemaMeta.payrollSettings.has("half_day_threshold_minutes")) selectable.push("half_day_threshold_minutes");
  if (schemaMeta.payrollSettings.has("overtime_multiplier")) selectable.push("overtime_multiplier");
  if (schemaMeta.payrollSettings.has("undertime_penalty_multiplier")) selectable.push("undertime_penalty_multiplier");

  if (!selectable.length) return settings;

  try {
    const [rows] = await conn.query(
      `SELECT ${selectable.join(", ")} FROM payroll_settings WHERE bar_id=? LIMIT 1`,
      [barId]
    );
    const row = rows[0] || {};

    settings.standard_work_minutes = Math.max(1, Number(row.standard_work_minutes || settings.standard_work_minutes));
    settings.default_break_minutes = Math.max(0, Number(row.default_break_minutes || settings.default_break_minutes));
    settings.half_day_threshold_minutes = Math.max(1, Number(row.half_day_threshold_minutes || settings.half_day_threshold_minutes));
    settings.overtime_multiplier = Math.max(1, Number(row.overtime_multiplier || settings.overtime_multiplier));
    settings.undertime_penalty_multiplier = Math.max(0, Number(row.undertime_penalty_multiplier || settings.undertime_penalty_multiplier));
  } catch (_) {
    // Keep defaults if custom settings are unavailable.
  }

  return settings;
}

function computeAdjustedPayroll({
  dailyRate,
  daysPresent,
  totalWorkMinutes,
  totalUndertimeMinutes,
  totalOvertimeMinutes,
  settings,
}) {
  const rate = Number(dailyRate || 0);
  const days = Number(daysPresent || 0);
  const worked = Math.max(0, Number(totalWorkMinutes || 0));
  const overtimeMinutes = Math.max(0, Number(totalOvertimeMinutes || 0));
  const undertimeMinutes = Math.max(0, Number(totalUndertimeMinutes || 0));

  const standardMinutes = Math.max(1, Number(settings.standard_work_minutes || 480));
  const minuteRate = rate / standardMinutes;

  // Keep a minimum half-day equivalent when there is attendance but computed minutes are missing.
  const hasAttendanceButNoMinutes = days > 0 && worked === 0;
  const fallbackWorked = hasAttendanceButNoMinutes
    ? days * Math.min(standardMinutes, Number(settings.half_day_threshold_minutes || 240))
    : worked;

  const baseWorkedMinutes = Math.max(0, fallbackWorked - overtimeMinutes);
  const basePay = roundMoney(baseWorkedMinutes * minuteRate);
  const overtimePay = roundMoney(overtimeMinutes * minuteRate * Number(settings.overtime_multiplier || 1.25));
  // `totalWorkMinutes` (the basis for basePay) already excludes undertime, so the
  // employee is simply not paid for those minutes. The penalty multiplier therefore
  // applies ONLY as an extra disciplinary deduction beyond the lost wages
  // (multiplier 1.0 = no additional penalty; >1.0 docks extra).
  const undertimePenaltyMultiplier = Math.max(0, Number(settings.undertime_penalty_multiplier || 1.0) - 1);
  const undertimeDeduction = roundMoney(undertimeMinutes * minuteRate * undertimePenaltyMultiplier);
  const adjustedGrossPay = roundMoney(Math.max(0, basePay + overtimePay - undertimeDeduction));

  return {
    basePay,
    overtimePay,
    undertimeDeduction,
    adjustedGrossPay,
    minuteRate,
  };
}

/**
 * (Optional) Payroll Preview
 * GET /hr/payroll/payroll?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Not required by runner, but kept from your original logic.
 */
router.get(
  "/payroll",
  requireAuth,
  requirePermission("payroll_view_all"),
  async (req, res) => {
    try {
      const barId = getBarIdOr403(req, res);
      if (barId === null) return;
      const schemaMeta = await getPayrollSchemaMeta();
      const settings = await getPayrollComputationSettings(barId, pool, schemaMeta);

      const { from, to } = req.query;
      if (!isValidYMD(from) || !isValidYMD(to)) {
        return res.status(400).json({
          success: false,
          message: "from and to required (YYYY-MM-DD)"
        });
      }

      const workMinutesExpr = schemaMeta.attendance.has("total_work_minutes")
        ? "COALESCE(SUM(a.total_work_minutes), 0)"
        : "COALESCE(SUM(CASE WHEN a.time_in IS NOT NULL AND a.time_out IS NOT NULL THEN GREATEST(TIMESTAMPDIFF(MINUTE, a.time_in, a.time_out), 0) ELSE 0 END), 0)";
      const lateExpr = schemaMeta.attendance.has("minutes_late")
        ? "COALESCE(SUM(a.minutes_late), 0)"
        : (schemaMeta.attendance.has("late_minutes") ? "COALESCE(SUM(a.late_minutes), 0)" : "0");
      const undertimeExpr = schemaMeta.attendance.has("minutes_undertime")
        ? "COALESCE(SUM(a.minutes_undertime), 0)"
        : "0";
      const overtimeExpr = schemaMeta.attendance.has("minutes_overtime")
        ? "COALESCE(SUM(a.minutes_overtime), 0)"
        : "0";

      const [rows] = await pool.query(
        `SELECT 
            u.id AS employee_user_id,
            u.first_name,
            u.last_name,
            CONCAT(u.first_name, ' ', u.last_name) AS name,
            COALESCE(ep.daily_rate, 0) AS daily_rate,
            SUM(CASE WHEN a.time_in IS NOT NULL THEN 1 ELSE 0 END) AS days_present,
            ${workMinutesExpr} AS total_work_minutes,
            ${lateExpr} AS total_late_minutes,
            ${undertimeExpr} AS total_undertime_minutes,
            ${overtimeExpr} AS total_overtime_minutes
         FROM users u
         LEFT JOIN employee_profiles ep ON ep.user_id = u.id
         LEFT JOIN attendance_logs a 
            ON a.employee_user_id = u.id
           AND a.bar_id = u.bar_id
           AND a.work_date BETWEEN ? AND ?
         WHERE u.bar_id = ? AND LOWER(u.role) = 'staff' AND u.is_active = 1
         GROUP BY u.id, ep.daily_rate, u.first_name, u.last_name
         ORDER BY u.last_name ASC, u.first_name ASC`,
        [from, to, barId]
      );

      const enriched = rows.map((row) => {
        const breakdown = computeAdjustedPayroll({
          dailyRate: row.daily_rate,
          daysPresent: row.days_present,
          totalWorkMinutes: row.total_work_minutes,
          totalUndertimeMinutes: row.total_undertime_minutes,
          totalOvertimeMinutes: row.total_overtime_minutes,
          settings,
        });

        return {
          ...row,
          base_pay: breakdown.basePay,
          overtime_pay: breakdown.overtimePay,
          undertime_deduction: breakdown.undertimeDeduction,
          gross_pay: breakdown.adjustedGrossPay,
          adjusted_gross_pay: breakdown.adjustedGrossPay,
        };
      });

      return res.json({ success: true, data: enriched });
    } catch (err) {
      console.error("PAYROLL PREVIEW ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * CREATE PAYROLL RUN (DRAFT)
 * POST /hr/payroll/run
 * body: { period_start: 'YYYY-MM-DD', period_end: 'YYYY-MM-DD' }
 *
 * payroll_runs columns:
 * id, bar_id, period_start, period_end, status, created_by, created_at, finalized_at
 */
router.post(
  "/run",
  requireAuth,
  requirePermission("payroll_create"),
  async (req, res) => {
    try {
      const barId = getBarIdOr403(req, res);
      if (barId === null) return;

      const createdBy = req.user.id;
      const { period_start, period_end } = req.body || {};

      if (!isValidYMD(period_start) || !isValidYMD(period_end)) {
        return res.status(400).json({
          success: false,
          message: "period_start and period_end required (YYYY-MM-DD)"
        });
      }

      const startTs = toUTCts(period_start);
      const endTs = toUTCts(period_end);

      if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
        return res.status(400).json({ success: false, message: "Invalid date values" });
      }
      if (endTs < startTs) {
        return res.status(400).json({
          success: false,
          message: "Invalid period: period_end must be on/after period_start"
        });
      }

      const [result] = await pool.query(
        `INSERT INTO payroll_runs (bar_id, period_start, period_end, status, created_by)
         VALUES (?, ?, ?, 'draft', ?)`,
        [barId, period_start, period_end, createdBy]
      );

      // Runner expects data.id
      return res.status(201).json({
        success: true,
        data: { id: result.insertId }
      });
    } catch (err) {
      console.error("CREATE PAYROLL RUN ERROR:", err);

      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          success: false,
          message: "Duplicate payroll run for this period (same bar_id, period_start, period_end)."
        });
      }

      return res.status(500).json({
        success: false,
        message: err.sqlMessage || err.message || "Server error"
      });
    }
  }
);

/**
 * LIST PAYROLL RUNS
 * GET /hr/payroll/runs
 */
router.get(
  "/runs",
  requireAuth,
  requirePermission("payroll_view_all"),
  async (req, res) => {
    try {
      const barId = getBarIdOr403(req, res);
      if (barId === null) return;

      const { status, from, to } = req.query;

      const where = ["bar_id = ?"];
      const params = [barId];

      if (status) {
        where.push("status = ?");
        params.push(status); // draft|finalized
      }

      if (from && to) {
        where.push("period_start >= ? AND period_end <= ?");
        params.push(from, to);
      }

      const [rows] = await pool.query(
        `SELECT id, bar_id, period_start, period_end, status, created_by, created_at, finalized_at
         FROM payroll_runs
         WHERE ${where.join(" AND ")}
         ORDER BY id DESC
         LIMIT 200`,
        params
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("LIST PAYROLL RUNS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * GENERATE PAYROLL ITEMS FROM ATTENDANCE
 * POST /hr/payroll/runs/:id/generate
 *
 * Uses:
 * - users (role='staff')
 * - employee_profiles.daily_rate
 * - attendance_logs (days present)
 *
 * payroll_items expected columns (common):
 * payroll_run_id, bar_id, user_id, daily_rate, days_present, gross_pay, deductions, net_pay
 */
router.post(
  "/runs/:id/generate",
  requireAuth,
  requirePermission("payroll_create"),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = req.user?.bar_id;
      if (barId === null || barId === undefined) {
        return res.status(403).json({ success: false, message: "No bar_id on account" });
      }

      const runId = Number(req.params.id);
      if (!Number.isInteger(runId) || runId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid run id" });
      }

      await conn.beginTransaction();

      const [runs] = await conn.query(
        `SELECT id, bar_id, period_start, period_end, status
         FROM payroll_runs
         WHERE id=? AND bar_id=? LIMIT 1`,
        [runId, barId]
      );

      if (!runs.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Payroll run not found" });
      }

      const run = runs[0];
      const schemaMeta = await getPayrollSchemaMeta(conn);
      const payrollComputationSettings = await getPayrollComputationSettings(barId, conn, schemaMeta);

      if (run.status !== "draft") {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Only draft payroll can be generated" });
      }

      const periodStart = formatYMD(run.period_start);
      const periodEnd = formatYMD(run.period_end);

      if (!periodStart || !periodEnd || periodEnd < periodStart) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Invalid payroll period dates" });
      }

      const recomputedAttendanceCount = await recomputeAttendanceMetricsForPeriod(conn, {
        barId,
        periodStart,
        periodEnd,
      });

      // delete existing items (safe regenerate) — conversions linked to the old
      // items return to "waiting for payroll" so they are re-applied exactly once
      await payrollAdditions.releaseForRun(conn, runId);
      await conn.query(
        "DELETE FROM payroll_items WHERE payroll_run_id=? AND bar_id=?",
        [runId, barId]
      );

      // staff source (NO staff table)
      const [staff] = await conn.query(
        `SELECT 
            u.id AS user_id,
            COALESCE(ep.daily_rate, 0) AS daily_rate
         FROM users u
         LEFT JOIN employee_profiles ep ON ep.user_id = u.id AND ep.bar_id = u.bar_id
          WHERE u.bar_id = ?
            AND LOWER(u.role) = 'staff'
            AND u.is_active = 1`,
        [barId]
      );

      const generated = [];

      const workMinutesExpr = schemaMeta.attendance.has("total_work_minutes")
        ? "COALESCE(SUM(total_work_minutes), 0)"
        : "COALESCE(SUM(CASE WHEN time_in IS NOT NULL AND time_out IS NOT NULL THEN GREATEST(TIMESTAMPDIFF(MINUTE, time_in, time_out), 0) ELSE 0 END), 0)";
      const lateExpr = schemaMeta.attendance.has("minutes_late")
        ? "COALESCE(SUM(minutes_late), 0)"
        : (schemaMeta.attendance.has("late_minutes") ? "COALESCE(SUM(late_minutes), 0)" : "0");
      const undertimeExpr = schemaMeta.attendance.has("minutes_undertime")
        ? "COALESCE(SUM(minutes_undertime), 0)"
        : "0";
      const overtimeExpr = schemaMeta.attendance.has("minutes_overtime")
        ? "COALESCE(SUM(minutes_overtime), 0)"
        : "0";

      for (const s of staff) {
        const [att] = await conn.query(
          `SELECT COUNT(DISTINCT work_date) AS days_present,
                  ${workMinutesExpr} AS total_work_minutes,
                  ${lateExpr} AS total_late_minutes,
                  ${undertimeExpr} AS total_undertime_minutes,
                  ${overtimeExpr} AS total_overtime_minutes
           FROM attendance_logs
           WHERE bar_id=?
             AND employee_user_id=?
             AND work_date BETWEEN ? AND ?
             AND time_in IS NOT NULL`,
          [barId, s.user_id, periodStart, periodEnd]
        );

        const days = Number(att[0]?.days_present || 0);
        const rate = Number(s.daily_rate || 0);
        const totalWorkMinutes = Number(att[0]?.total_work_minutes || 0);
        const totalLateMinutes = Number(att[0]?.total_late_minutes || 0);
        const totalUndertimeMinutes = Number(att[0]?.total_undertime_minutes || 0);
        const totalOvertimeMinutes = Number(att[0]?.total_overtime_minutes || 0);

        const breakdown = computeAdjustedPayroll({
          dailyRate: rate,
          daysPresent: days,
          totalWorkMinutes,
          totalUndertimeMinutes,
          totalOvertimeMinutes,
          settings: payrollComputationSettings,
        });

        const gross = breakdown.adjustedGrossPay;

        // Skip deduction calculation if employee has 0 days present
        let deductionResult;
        let totalDeductions = 0;
        
        if (days > 0) {
          // Calculate all deductions for this employee
          deductionResult = await calculateAllDeductions({
            barId,
            userId: s.user_id,
            grossPay: gross,
            dailyRate: rate,
            periodStart,
            periodEnd,
            standardWorkMinutes: payrollComputationSettings.standard_work_minutes
          });
          totalDeductions = deductionResult.total;
        } else {
          // No deductions for 0 days present
          deductionResult = {
            bir: { enabled: false, amount: 0, computation: 'No work days' },
            sss: { enabled: false, amount: 0, computation: 'No work days' },
            philhealth: { enabled: false, amount: 0, computation: 'No work days' },
            late: { enabled: false, amount: 0, computation: 'No work days' },
            total: 0
          };
        }

        const net = Math.max(0, gross - totalDeductions);

        const insertColumns = [
          "payroll_run_id",
          "bar_id",
          "user_id",
          "daily_rate",
          "days_present",
          "gross_pay",
          "bir_deduction",
          "sss_deduction",
          "philhealth_deduction",
          "late_deduction",
          "total_deductions",
          "deductions",
          "net_pay",
        ];
        const insertValues = [
          runId,
          barId,
          s.user_id,
          rate,
          days,
          gross,
          deductionResult.bir.amount,
          deductionResult.sss.amount,
          deductionResult.philhealth.amount,
          deductionResult.late.amount,
          totalDeductions,
          totalDeductions,
          net,
        ];

        const addOptional = (columnName, value) => {
          if (schemaMeta.payrollItems.has(columnName)) {
            insertColumns.push(columnName);
            insertValues.push(value);
          }
        };

        addOptional("total_work_minutes", totalWorkMinutes);
        addOptional("total_late_minutes", totalLateMinutes);
        addOptional("total_undertime_minutes", totalUndertimeMinutes);
        addOptional("total_overtime_minutes", totalOvertimeMinutes);
        addOptional("base_pay", breakdown.basePay);
        addOptional("overtime_pay", breakdown.overtimePay);
        addOptional("undertime_deduction", breakdown.undertimeDeduction);
        addOptional("adjusted_gross_pay", breakdown.adjustedGrossPay);

        const [insertResult] = await conn.query(
          `INSERT INTO payroll_items (${insertColumns.join(", ")})
           VALUES (${insertColumns.map(() => "?").join(", ")})`,
          insertValues
        );

        const payrollItemId = insertResult.insertId;

        // Insert itemized deduction records for audit trail
        if (deductionResult.bir.enabled && deductionResult.bir.amount > 0) {
          await conn.query(
            `INSERT INTO payroll_deduction_items 
              (payroll_item_id, deduction_type, deduction_label, amount, is_enabled, computation_basis)
             VALUES (?, 'bir', 'BIR Withholding Tax', ?, 1, ?)`,
            [payrollItemId, deductionResult.bir.amount, deductionResult.bir.computation]
          );
        }

        if (deductionResult.sss.enabled && deductionResult.sss.amount > 0) {
          await conn.query(
            `INSERT INTO payroll_deduction_items 
              (payroll_item_id, deduction_type, deduction_label, amount, is_enabled, computation_basis)
             VALUES (?, 'sss', 'SSS Contribution', ?, 1, ?)`,
            [payrollItemId, deductionResult.sss.amount, deductionResult.sss.computation]
          );
        }

        if (deductionResult.philhealth.enabled && deductionResult.philhealth.amount > 0) {
          await conn.query(
            `INSERT INTO payroll_deduction_items 
              (payroll_item_id, deduction_type, deduction_label, amount, is_enabled, computation_basis)
             VALUES (?, 'philhealth', 'PhilHealth Contribution', ?, 1, ?)`,
            [payrollItemId, deductionResult.philhealth.amount, deductionResult.philhealth.computation]
          );
        }

        if (deductionResult.late.enabled && deductionResult.late.amount > 0) {
          await conn.query(
            `INSERT INTO payroll_deduction_items 
              (payroll_item_id, deduction_type, deduction_label, amount, is_enabled, computation_basis)
             VALUES (?, 'late', 'Late Deduction', ?, 1, ?)`,
            [payrollItemId, deductionResult.late.amount, deductionResult.late.computation]
          );
        }

        generated.push({ 
          user_id: s.user_id, 
          days_present: days, 
          total_work_minutes: totalWorkMinutes,
          total_late_minutes: totalLateMinutes,
          total_undertime_minutes: totalUndertimeMinutes,
          total_overtime_minutes: totalOvertimeMinutes,
          base_pay: breakdown.basePay,
          overtime_pay: breakdown.overtimePay,
          undertime_deduction: breakdown.undertimeDeduction,
          adjusted_gross_pay: breakdown.adjustedGrossPay,
          gross_pay: gross,
          deductions: {
            bir: deductionResult.bir.amount,
            sss: deductionResult.sss.amount,
            philhealth: deductionResult.philhealth.amount,
            late: deductionResult.late.amount,
            total: totalDeductions
          },
          net_pay: net
        });
      }

      const appliedAdditions = await payrollAdditions.applyPendingForRun(conn, {
        barId,
        runId,
        periodStart,
        periodEnd,
      });

      await conn.commit();
      return res.json({
        success: true,
        message: "Payroll generated",
        recomputed_attendance_count: recomputedAttendanceCount,
        applied_conversions: appliedAdditions.length,
        generated,
      });
    } catch (err) {
      await conn.rollback();
      console.error("GENERATE PAYROLL ERROR:", err);
      return res.status(500).json({ success: false, message: err.sqlMessage || err.message || "Server error" });
    } finally {
      conn.release();
    }
  }
);

/**
 * VIEW PAYROLL ITEMS
 * GET /hr/payroll/runs/:id/items
 */
router.get(
  "/runs/:id/items",
  requireAuth,
  requirePermission("payroll_view_all"),
  async (req, res) => {
    try {
      const barId = getBarIdOr403(req, res);
      if (barId === null) return;
      const schemaMeta = await getPayrollSchemaMeta();

      const runId = Number(req.params.id);
      if (!Number.isInteger(runId) || runId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid run id" });
      }

      const optionalSelects = [];
      if (schemaMeta.payrollItems.has("total_work_minutes")) optionalSelects.push("pi.total_work_minutes");
      if (schemaMeta.payrollItems.has("total_late_minutes")) optionalSelects.push("pi.total_late_minutes");
      if (schemaMeta.payrollItems.has("total_undertime_minutes")) optionalSelects.push("pi.total_undertime_minutes");
      if (schemaMeta.payrollItems.has("total_overtime_minutes")) optionalSelects.push("pi.total_overtime_minutes");
      if (schemaMeta.payrollItems.has("base_pay")) optionalSelects.push("pi.base_pay");
      if (schemaMeta.payrollItems.has("overtime_pay")) optionalSelects.push("pi.overtime_pay");
      if (schemaMeta.payrollItems.has("undertime_deduction")) optionalSelects.push("pi.undertime_deduction");
      if (schemaMeta.payrollItems.has("adjusted_gross_pay")) optionalSelects.push("pi.adjusted_gross_pay");
      if (schemaMeta.payrollItems.has("additions")) optionalSelects.push("pi.additions");

      const [runs] = await pool.query(
        `SELECT id, period_start, period_end, status, created_at, finalized_at
         FROM payroll_runs
         WHERE id=? AND bar_id=?
         LIMIT 1`,
        [runId, barId]
      );

      if (!runs.length) return res.status(404).json({ success: false, message: "Payroll run not found" });

      const [items] = await pool.query(
        `SELECT 
            pi.id,
            pi.user_id,
            u.first_name,
            u.last_name,
            u.email,
            pi.daily_rate,
            pi.days_present,
            pi.gross_pay,
            pi.bir_deduction,
            pi.sss_deduction,
            pi.philhealth_deduction,
            pi.late_deduction,
            pi.other_deductions,
            pi.total_deductions,
            pi.deductions,
            pi.net_pay
            ${optionalSelects.length ? `, ${optionalSelects.join(",\n            ")}` : ""}
         FROM payroll_items pi
         JOIN users u ON u.id = pi.user_id
         WHERE pi.payroll_run_id=? AND pi.bar_id=?
         ORDER BY u.last_name ASC, u.first_name ASC`,
        [runId, barId]
      );

      // Get itemized deductions for each payroll item
      for (let item of items) {
        if (item.total_work_minutes === undefined) item.total_work_minutes = 0;
        if (item.total_late_minutes === undefined) item.total_late_minutes = 0;
        if (item.total_undertime_minutes === undefined) item.total_undertime_minutes = 0;
        if (item.total_overtime_minutes === undefined) item.total_overtime_minutes = 0;
        if (item.base_pay === undefined) item.base_pay = Number(item.gross_pay || 0);
        if (item.overtime_pay === undefined) item.overtime_pay = 0;
        if (item.undertime_deduction === undefined) item.undertime_deduction = 0;
        if (item.adjusted_gross_pay === undefined) item.adjusted_gross_pay = Number(item.gross_pay || 0);

        const [deductionItems] = await pool.query(
          `SELECT deduction_type, deduction_label, amount, computation_basis
           FROM payroll_deduction_items
           WHERE payroll_item_id = ? AND is_enabled = 1
           ORDER BY deduction_type`,
          [item.id]
        );
        item.deduction_items = deductionItems;
      }
      await payrollAdditions.attachAdditionItems(pool, items);

      return res.json({ success: true, run: runs[0], items });
    } catch (err) {
      console.error("PAYROLL ITEMS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

router.get(
  "/runs/:id/report",
  requireAuth,
  requirePermission("payroll_view_all"),
  async (req, res) => {
    try {
      const barId = getBarIdOr403(req, res);
      if (barId === null) return;

      const runId = Number(req.params.id);
      if (!Number.isInteger(runId) || runId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid run id" });
      }

      const [runRows] = await pool.query(
        `SELECT id, period_start, period_end, status, created_at, finalized_at
         FROM payroll_runs
         WHERE id=? AND bar_id=?
         LIMIT 1`,
        [runId, barId]
      );
      if (!runRows.length) {
        return res.status(404).json({ success: false, message: "Payroll run not found" });
      }

      const [summaryRows] = await pool.query(
        `SELECT
            COUNT(*) AS employee_count,
            COALESCE(SUM(days_present), 0) AS total_days_present,
            COALESCE(SUM(total_work_minutes), 0) AS total_work_minutes,
            COALESCE(SUM(total_late_minutes), 0) AS total_late_minutes,
            COALESCE(SUM(total_undertime_minutes), 0) AS total_undertime_minutes,
            COALESCE(SUM(total_overtime_minutes), 0) AS total_overtime_minutes,
            COALESCE(SUM(base_pay), 0) AS total_base_pay,
            COALESCE(SUM(overtime_pay), 0) AS total_overtime_pay,
            COALESCE(SUM(undertime_deduction), 0) AS total_undertime_deduction,
            COALESCE(SUM(adjusted_gross_pay), 0) AS total_adjusted_gross_pay,
            COALESCE(SUM(additions), 0) AS total_additions,
            COALESCE(SUM(gross_pay), 0) AS total_gross_pay,
            COALESCE(SUM(total_deductions), 0) AS total_deductions,
            COALESCE(SUM(net_pay), 0) AS total_net_pay
         FROM payroll_items
         WHERE payroll_run_id=? AND bar_id=?`,
        [runId, barId]
      );

      return res.json({
        success: true,
        run: runRows[0],
        summary: summaryRows[0] || {},
      });
    } catch (err) {
      // Fallback for databases that do not yet have additive columns.
      if (err && err.code === "ER_BAD_FIELD_ERROR") {
        try {
          const barId = getBarIdOr403(req, res);
          if (barId === null) return;

          const runId = Number(req.params.id);
          const [runRows] = await pool.query(
            `SELECT id, period_start, period_end, status, created_at, finalized_at
             FROM payroll_runs
             WHERE id=? AND bar_id=?
             LIMIT 1`,
            [runId, barId]
          );
          if (!runRows.length) {
            return res.status(404).json({ success: false, message: "Payroll run not found" });
          }

          const [summaryRows] = await pool.query(
            `SELECT
                COUNT(*) AS employee_count,
                COALESCE(SUM(days_present), 0) AS total_days_present,
                COALESCE(SUM(gross_pay), 0) AS total_gross_pay,
                COALESCE(SUM(total_deductions), 0) AS total_deductions,
                COALESCE(SUM(net_pay), 0) AS total_net_pay
             FROM payroll_items
             WHERE payroll_run_id=? AND bar_id=?`,
            [runId, barId]
          );

          return res.json({
            success: true,
            run: runRows[0],
            summary: {
              ...summaryRows[0],
              total_work_minutes: 0,
              total_late_minutes: 0,
              total_undertime_minutes: 0,
              total_overtime_minutes: 0,
              total_base_pay: Number(summaryRows[0]?.total_gross_pay || 0),
              total_overtime_pay: 0,
              total_undertime_deduction: 0,
              total_adjusted_gross_pay: Number(summaryRows[0]?.total_gross_pay || 0),
            },
          });
        } catch (fallbackErr) {
          console.error("PAYROLL REPORT FALLBACK ERROR:", fallbackErr);
          return res.status(500).json({ success: false, message: "Server error" });
        }
      }

      console.error("PAYROLL REPORT ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * FINALIZE PAYROLL RUN
 * PATCH /hr/payroll/runs/:id/finalize
 */
router.patch(
  "/runs/:id/finalize",
  requireAuth,
  requirePermission("payroll_create"),
  async (req, res) => {
    try {
      const barId = getBarIdOr403(req, res);
      if (barId === null) return;

      const runId = Number(req.params.id);
      if (!Number.isInteger(runId) || runId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid run id" });
      }

      const [runs] = await pool.query(
        "SELECT id, status FROM payroll_runs WHERE id=? AND bar_id=? LIMIT 1",
        [runId, barId]
      );

      if (!runs.length) return res.status(404).json({ success: false, message: "Payroll run not found" });

      if (runs[0].status !== "draft") {
        return res.status(400).json({ success: false, message: "Already finalized" });
      }

      await pool.query(
        "UPDATE payroll_runs SET status='finalized', finalized_at=NOW() WHERE id=? AND bar_id=?",
        [runId, barId]
      );

      return res.json({ success: true, message: "Payroll finalized" });
    } catch (err) {
      console.error("FINALIZE PAYROLL ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * CANCEL PAYROLL RUN (delete draft run)
 * DELETE /hr/payroll/runs/:id
 */
router.delete(
  "/runs/:id",
  requireAuth,
  requirePermission("payroll_create"),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = getBarIdOr403(req, res);
      if (barId === null) return;

      const runId = Number(req.params.id);
      if (!Number.isInteger(runId) || runId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid run id" });
      }

      await conn.beginTransaction();

      const [runs] = await conn.query(
        "SELECT id, status FROM payroll_runs WHERE id=? AND bar_id=? LIMIT 1",
        [runId, barId]
      );

      if (!runs.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Payroll run not found" });
      }

      if (runs[0].status !== "draft") {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Only draft payroll can be cancelled" });
      }

      await payrollAdditions.releaseForRun(conn, runId);
      await conn.query("DELETE FROM payroll_items WHERE payroll_run_id=? AND bar_id=?", [runId, barId]);
      await conn.query("DELETE FROM payroll_runs WHERE id=? AND bar_id=?", [runId, barId]);

      await conn.commit();
      return res.json({ success: true, message: "Payroll run cancelled" });
    } catch (err) {
      await conn.rollback();
      console.error("CANCEL PAYROLL RUN ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  }
);

/**
 * EMPLOYEE: VIEW OWN PAYROLL
 * GET /hr/payroll/my-payroll
 */
router.get(
  "/my-payroll",
  requireAuth,
  requirePermission("payroll_view_own"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const userId = req.user.id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const schemaMeta = await getPayrollSchemaMeta();
      const optionalSelects = [];
      if (schemaMeta.payrollItems.has("total_work_minutes")) optionalSelects.push("pi.total_work_minutes");
      if (schemaMeta.payrollItems.has("total_late_minutes")) optionalSelects.push("pi.total_late_minutes");
      if (schemaMeta.payrollItems.has("total_undertime_minutes")) optionalSelects.push("pi.total_undertime_minutes");
      if (schemaMeta.payrollItems.has("total_overtime_minutes")) optionalSelects.push("pi.total_overtime_minutes");
      if (schemaMeta.payrollItems.has("base_pay")) optionalSelects.push("pi.base_pay");
      if (schemaMeta.payrollItems.has("overtime_pay")) optionalSelects.push("pi.overtime_pay");
      if (schemaMeta.payrollItems.has("undertime_deduction")) optionalSelects.push("pi.undertime_deduction");
      if (schemaMeta.payrollItems.has("adjusted_gross_pay")) optionalSelects.push("pi.adjusted_gross_pay");
      if (schemaMeta.payrollItems.has("additions")) optionalSelects.push("pi.additions");

      const [items] = await pool.query(
        `SELECT pi.id, pi.payroll_run_id, pi.user_id, pi.days_present, 
                pi.daily_rate, pi.gross_pay, 
                pi.bir_deduction, pi.sss_deduction, pi.philhealth_deduction, 
                pi.late_deduction, pi.other_deductions, pi.total_deductions,
                pi.deductions, pi.net_pay,
                ${optionalSelects.length ? `${optionalSelects.join(",\n                ")},` : ""}
                pr.period_start, pr.period_end, pr.status AS run_status, pr.created_at
         FROM payroll_items pi
         JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
         WHERE pi.bar_id = ?
           AND pi.user_id = ?
           AND pr.status = 'finalized'
         ORDER BY pr.period_end DESC`,
        [barId, userId]
      );

      // Get itemized deductions for each payroll item
      for (let item of items) {
        if (item.total_work_minutes === undefined) item.total_work_minutes = 0;
        if (item.total_late_minutes === undefined) item.total_late_minutes = 0;
        if (item.total_undertime_minutes === undefined) item.total_undertime_minutes = 0;
        if (item.total_overtime_minutes === undefined) item.total_overtime_minutes = 0;
        if (item.base_pay === undefined) item.base_pay = Number(item.gross_pay || 0);
        if (item.overtime_pay === undefined) item.overtime_pay = 0;
        if (item.undertime_deduction === undefined) item.undertime_deduction = 0;
        if (item.adjusted_gross_pay === undefined) item.adjusted_gross_pay = Number(item.gross_pay || 0);

        const [deductionItems] = await pool.query(
          `SELECT deduction_type, deduction_label, amount, computation_basis
           FROM payroll_deduction_items
           WHERE payroll_item_id = ? AND is_enabled = 1
           ORDER BY deduction_type`,
          [item.id]
        );
        item.deduction_items = deductionItems;
      }
      await payrollAdditions.attachAdditionItems(pool, items);

      return res.json({ success: true, items });
    } catch (err) {
      console.error("MY PAYROLL ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
