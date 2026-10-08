const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { logAudit, auditContext } = require("../utils/audit");
const { createNotification } = require("../utils/notificationService");

let attendanceSchemaMetaPromise = null;

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toMySQLDateTimeUTC(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

function toWallClockUTC(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    )
  );
}

function parseDateTimeValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return toWallClockUTC(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
    const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
    const asUtc = new Date(`${withSeconds}Z`);
    if (!Number.isNaN(asUtc.getTime())) return asUtc;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateTimeInput(workDate, value) {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    return raw.includes("T") ? raw.replace("T", " ") : raw;
  }

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const withSeconds = raw.length === 5 ? `${raw}:00` : raw;
    return `${workDate} ${withSeconds}`;
  }

  return raw;
}

function normalizeWorkDateYMD(workDate) {
  if (!workDate) return null;

  if (workDate instanceof Date) {
    if (Number.isNaN(workDate.getTime())) return null;
    return `${workDate.getFullYear()}-${pad2(workDate.getMonth() + 1)}-${pad2(workDate.getDate())}`;
  }

  const raw = String(workDate).trim();
  if (!raw) return null;

  const directYmd = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directYmd) return directYmd[1];

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

function combineWorkDateAndTimeUTC(workDate, timeValue) {
  if (!workDate || !timeValue) return null;
  const workDateYmd = normalizeWorkDateYMD(workDate);
  if (!workDateYmd) return null;

  const timeRaw = String(timeValue).trim();
  const match = timeRaw.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [year, month, day] = workDateYmd.split("-").map(Number);
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const ss = Number(match[3] || 0);

  if (![year, month, day, hh, mm, ss].every(Number.isFinite)) return null;
  return new Date(Date.UTC(year, month - 1, day, hh, mm, ss));
}

function minutesDiff(later, earlier) {
  if (!(later instanceof Date) || Number.isNaN(later.getTime())) return 0;
  if (!(earlier instanceof Date) || Number.isNaN(earlier.getTime())) return 0;
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / 60000));
}

async function getAttendanceSchemaMeta() {
  if (attendanceSchemaMetaPromise) return attendanceSchemaMetaPromise;

  attendanceSchemaMetaPromise = (async () => {
    const [attendanceColumns] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_logs'`
    );

    const [payrollSettingsColumns] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_settings'`
    );

    const [scheduleTableRows] = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employee_schedules'`
    );

    return {
      attendanceColumns: new Set(attendanceColumns.map((r) => r.COLUMN_NAME)),
      payrollSettingsColumns: new Set(payrollSettingsColumns.map((r) => r.COLUMN_NAME)),
      hasEmployeeSchedulesTable: Number(scheduleTableRows?.[0]?.cnt || 0) > 0,
    };
  })();

  return attendanceSchemaMetaPromise;
}

function selectAttendanceColumns(meta, alias = "") {
  const p = alias ? `${alias}.` : "";
  const has = (col) => meta.attendanceColumns.has(col);

  return [
    `${p}id`,
    `${p}work_date`,
    `${p}time_in`,
    `${p}time_out`,
    has("minutes_late") ? `${p}minutes_late` : (has("late_minutes") ? `${p}late_minutes AS minutes_late` : "0 AS minutes_late"),
    has("minutes_undertime") ? `${p}minutes_undertime` : "0 AS minutes_undertime",
    has("minutes_overtime") ? `${p}minutes_overtime` : "0 AS minutes_overtime",
    has("total_work_minutes") ? `${p}total_work_minutes` : "0 AS total_work_minutes",
    has("scheduled_start") ? `${p}scheduled_start` : "NULL AS scheduled_start",
    has("scheduled_end") ? `${p}scheduled_end` : "NULL AS scheduled_end",
    has("actual_clock_in") ? `${p}actual_clock_in` : "NULL AS actual_clock_in",
    has("actual_clock_out") ? `${p}actual_clock_out` : "NULL AS actual_clock_out",
    has("source") ? `${p}source` : "'manual' AS source",
  ].join(", ");
}

async function getPayrollDefaults(barId, meta, conn = pool) {
  const defaults = {
    standardWorkMinutes: 480,
    defaultBreakMinutes: 60,
    overtimeMultiplier: 1.25,
    undertimePenaltyMultiplier: 1.0,
  };

  if (!meta.payrollSettingsColumns.size) return defaults;

  const selectParts = [];
  if (meta.payrollSettingsColumns.has("standard_work_minutes")) selectParts.push("standard_work_minutes");
  if (meta.payrollSettingsColumns.has("default_break_minutes")) selectParts.push("default_break_minutes");
  if (meta.payrollSettingsColumns.has("overtime_multiplier")) selectParts.push("overtime_multiplier");
  if (meta.payrollSettingsColumns.has("undertime_penalty_multiplier")) selectParts.push("undertime_penalty_multiplier");

  if (!selectParts.length) return defaults;

  try {
    const [rows] = await conn.query(
      `SELECT ${selectParts.join(", ")} FROM payroll_settings WHERE bar_id=? LIMIT 1`,
      [barId]
    );

    const row = rows[0] || {};
    defaults.standardWorkMinutes = Math.max(1, toSafeNumber(row.standard_work_minutes, defaults.standardWorkMinutes));
    defaults.defaultBreakMinutes = Math.max(0, toSafeNumber(row.default_break_minutes, defaults.defaultBreakMinutes));
    defaults.overtimeMultiplier = Math.max(1, toSafeNumber(row.overtime_multiplier, defaults.overtimeMultiplier));
    defaults.undertimePenaltyMultiplier = Math.max(0, toSafeNumber(row.undertime_penalty_multiplier, defaults.undertimePenaltyMultiplier));
  } catch (_) {
    // Keep defaults when settings table/columns are unavailable.
  }

  return defaults;
}

async function resolveSchedule(barId, userId, workDate, meta, conn = pool) {
  const defaults = await getPayrollDefaults(barId, meta, conn);
  const schedule = {
    id: null,
    shift_start: "09:00:00",
    shift_end: "18:00:00",
    break_minutes: defaults.defaultBreakMinutes,
    overtime_multiplier: defaults.overtimeMultiplier,
    undertime_penalty_multiplier: defaults.undertimePenaltyMultiplier,
    is_rest_day: 0,
  };

  if (!meta.hasEmployeeSchedulesTable) {
    return { schedule, defaults };
  }

  try {
    const workDateYmd = normalizeWorkDateYMD(workDate);
    if (!workDateYmd) return { schedule, defaults };

    const work = new Date(`${workDateYmd}T00:00:00Z`);
    const dayOfWeek = Number.isNaN(work.getTime()) ? null : work.getUTCDay();

    if (dayOfWeek === null) return { schedule, defaults };

    const [rows] = await conn.query(
      `SELECT id, shift_start, shift_end, break_minutes,
              overtime_multiplier, undertime_penalty_multiplier, is_rest_day
       FROM employee_schedules
       WHERE bar_id=? AND employee_user_id=? AND day_of_week=? AND is_active=1
       LIMIT 1`,
      [barId, userId, dayOfWeek]
    );

    if (!rows.length) return { schedule, defaults };

    const r = rows[0];
    schedule.id = r.id;
    schedule.shift_start = r.shift_start || schedule.shift_start;
    schedule.shift_end = r.shift_end || schedule.shift_end;
    schedule.break_minutes = Math.max(0, toSafeNumber(r.break_minutes, defaults.defaultBreakMinutes));
    schedule.overtime_multiplier = Math.max(1, toSafeNumber(r.overtime_multiplier, defaults.overtimeMultiplier));
    schedule.undertime_penalty_multiplier = Math.max(0, toSafeNumber(r.undertime_penalty_multiplier, defaults.undertimePenaltyMultiplier));
    schedule.is_rest_day = Number(r.is_rest_day || 0);
  } catch (_) {
    // Fallback schedule is used when schedule table is unavailable.
  }

  return { schedule, defaults };
}

function computeAttendanceMetrics({ workDate, timeIn, timeOut, schedule, defaults }) {
  const actualIn = parseDateTimeValue(timeIn);
  let actualOut = parseDateTimeValue(timeOut);

  const breakMinutes = Math.max(0, toSafeNumber(schedule.break_minutes, defaults.defaultBreakMinutes));

  // Parse shift start/end as "minutes after midnight" for overnight-detection comparison
  const shiftStartRaw = String(schedule.shift_start).trim();
  const shiftEndRaw = String(schedule.shift_end).trim();
  const shiftStartMatch = shiftStartRaw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  const shiftEndMatch = shiftEndRaw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  const shiftStartHours = shiftStartMatch ? Number(shiftStartMatch[1]) : 0;
  const shiftStartMin = shiftStartMatch ? Number(shiftStartMatch[2]) : 0;
  const shiftEndHours = shiftEndMatch ? Number(shiftEndMatch[1]) : 23;
  const shiftEndMin = shiftEndMatch ? Number(shiftEndMatch[2]) : 0;
  const shiftStartTotalMin = shiftStartHours * 60 + shiftStartMin; // e.g. 19:00 → 1140
  const shiftEndTotalMin = shiftEndHours * 60 + shiftEndMin;     // e.g. 05:00 → 300

  // Detect overnight shift: shift start (e.g. 19:00) > shift end (e.g. 05:00)
  const isOvernightShift = shiftStartTotalMin > shiftEndTotalMin;

  const scheduledStart = combineWorkDateAndTimeUTC(workDate, schedule.shift_start);
  let scheduledEnd = combineWorkDateAndTimeUTC(workDate, schedule.shift_end);

  // Standard overnight adjust: if shiftEnd <= shiftAddShiftStart, push end to next calendar day
  if (isOvernightShift && scheduledEnd && scheduledEnd.getTime() <= scheduledStart.getTime()) {
    scheduledEnd = new Date(scheduledEnd.getTime() + 24 * 60 * 60000);
  }

  // If clock-out occurred "before" clock-in (e.g. overnight past midnight), shift actualOut forward 24h
  if (actualIn && actualOut && actualOut.getTime() < actualIn.getTime()) {
    actualOut = new Date(actualOut.getTime() + 24 * 60 * 60000);
  }

  // --- Worked Time Calculation ---
  // Raw minutes from clock-in to clock-out (always positive after the adjust above)
  const rawWorked = actualIn && actualOut ? minutesDiff(actualOut, actualIn) : 0;
  const totalWorkMinutes = Math.max(0, rawWorked - breakMinutes);

  // --- Late Calculation (overnight-aware) ---
  // For overnight shifts, if the clock-in occurs after midnight (i.e. the early‑morning portion
  // of the shift that started the previous evening), the person is NOT late — they are within the shift.
  // We detect this by checking whether the clock-in time falls between 00:00 and the shift's end time.
  // Use UTC methods since the attendance system stores dates in UTC.
  let minutesLate;
  if (isOvernightShift && actualIn) {
    const actualInMin = actualIn.getUTCHours() * 60 + actualIn.getUTCMinutes(); // e.g. 03:41 UTC → 221
    // If actualIn is in the "early morning" band of the overnight shift (00:00 – shiftEnd),
    // it belongs to the shift that started the previous evening → not late.
    // If actualIn is outside that band (e.g. late evening before shiftEnd), use normal late logic.
    const isEarlyMorningClockIn = actualInMin < shiftEndTotalMin; // e.g. 03:41 < 05:00 → true
    minutesLate = isEarlyMorningClockIn ? 0 : (actualIn && scheduledStart ? minutesDiff(actualIn, scheduledStart) : 0);
  } else {
    minutesLate = actualIn && scheduledStart ? minutesDiff(actualIn, scheduledStart) : 0;
  }

  // --- Overtime vs. Regular Hours ---
  // Overtime ONLY triggers when clock-out exceeds the (adjusted) scheduled end time.
  // Minutes worked between shift start and shift end are strictly Regular Worked Time,
  // NOT overtime — even for overnight shifts.
  let minutesOvertime;
  let minutesUndertime;

  if (isOvernightShift) {
    // For overnight shifts, the "worked window" runs from shiftStart (e.g. 19:00) through 24:00
    // and 00:00 to shiftEnd (e.g. 05:00). Overtime only if clock-out goes past shiftEnd.
    const overtimeAnchor = actualIn && scheduledEnd
      ? new Date(Math.max(actualIn.getTime(), scheduledEnd.getTime()))
      : scheduledEnd;
    minutesOvertime = actualOut && overtimeAnchor && actualOut > overtimeAnchor
      ? minutesDiff(actualOut, overtimeAnchor)
      : 0;

    // Undertime: if clock-out is before the shift's end (i.e. left early during the early‑morning window),
    // those minutes are undertime; otherwise all minutes in-window are regular worked time.
    // For overnight shifts with early‑morning clock-in, undertime is 0 (person is within the shift window).
    minutesUndertime = isOvernightShift && actualIn
      ? 0
      : (actualOut && scheduledEnd && actualOut < overtimeAnchor
          ? minutesDiff(overtimeAnchor, actualOut)
          : 0);
  } else {
    // Daytime shift logic (unchanged)
    const overtimeAnchor = actualIn && scheduledEnd
      ? new Date(Math.max(actualIn.getTime(), scheduledEnd.getTime()))
      : scheduledEnd;
    minutesOvertime = actualOut && overtimeAnchor && actualOut > overtimeAnchor
      ? minutesDiff(actualOut, overtimeAnchor)
      : 0;
    minutesUndertime = actualOut && scheduledEnd && actualOut < scheduledEnd ? minutesDiff(scheduledEnd, actualOut) : 0;
  }

  // --- Format workedTime dynamically (using raw worked minutes, not break-deducted) ---
  const workedTimeString = rawWorked > 0
    ? `${Math.floor(rawWorked / 60)}h ${(rawWorked % 60)}m`
    : '0h 0m';

  return {
    minutesLate,
    minutesUndertime,
    minutesOvertime,
    totalWorkMinutes,
    workedTimeString,
    scheduledStart,
    scheduledEnd,
    actualIn,
    actualOut,
  };
}

function formatShiftTimeLabel(timeValue) {
  const raw = String(timeValue || "").trim();
  const m = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!m) return raw || "shift start";

  let hh = Number(m[1]);
  const mm = m[2];
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${hh}:${mm} ${ampm}`;
}

async function validateClockInNotBeforeShift({ barId, employeeUserId, workDate, clockInValue, meta, conn = pool }) {
  const workDateYmd = normalizeWorkDateYMD(workDate);
  if (!workDateYmd) {
    return { ok: false, message: "Invalid work_date" };
  }

  const actualClockIn = parseDateTimeValue(clockInValue);
  if (!(actualClockIn instanceof Date) || Number.isNaN(actualClockIn.getTime())) {
    return { ok: false, message: "Invalid time_in value" };
  }

  const { schedule } = await resolveSchedule(barId, employeeUserId, workDateYmd, meta, conn);

  // Rest day has no shift-start restriction.
  if (Number(schedule.is_rest_day || 0) === 1) {
    return { ok: true, schedule };
  }

  const scheduledStart = combineWorkDateAndTimeUTC(workDateYmd, schedule.shift_start);
  if (!(scheduledStart instanceof Date) || Number.isNaN(scheduledStart.getTime())) {
    return { ok: true, schedule };
  }

  if (actualClockIn.getTime() < scheduledStart.getTime()) {
    return {
      ok: false,
      message: `Cannot clock in before shift start (${formatShiftTimeLabel(schedule.shift_start)}).`,
      schedule,
    };
  }

  return { ok: true, schedule };
}

async function recomputeAttendanceForLog(conn, logRow) {
  if (!logRow?.id || !logRow?.bar_id || !logRow?.employee_user_id || !logRow?.work_date) return null;

  const meta = await getAttendanceSchemaMeta();
  const { schedule, defaults } = await resolveSchedule(logRow.bar_id, logRow.employee_user_id, logRow.work_date, meta, conn);
  const computed = computeAttendanceMetrics({
    workDate: logRow.work_date,
    timeIn: logRow.time_in,
    timeOut: logRow.time_out,
    schedule,
    defaults,
  });

  const has = (col) => meta.attendanceColumns.has(col);
  const updates = [];
  const params = [];

  if (has("minutes_late")) {
    updates.push("minutes_late = ?");
    params.push(computed.minutesLate);
  }
  if (has("late_minutes")) {
    updates.push("late_minutes = ?");
    params.push(computed.minutesLate);
  }
  if (has("minutes_undertime")) {
    updates.push("minutes_undertime = ?");
    params.push(computed.minutesUndertime);
  }
  if (has("minutes_overtime")) {
    updates.push("minutes_overtime = ?");
    params.push(computed.minutesOvertime);
  }
  if (has("total_work_minutes")) {
    updates.push("total_work_minutes = ?");
    params.push(computed.totalWorkMinutes);
  }
  if (has("schedule_id")) {
    updates.push("schedule_id = ?");
    params.push(schedule.id || null);
  }
  if (has("scheduled_start")) {
    updates.push("scheduled_start = ?");
    params.push(toMySQLDateTimeUTC(computed.scheduledStart));
  }
  if (has("scheduled_end")) {
    updates.push("scheduled_end = ?");
    params.push(toMySQLDateTimeUTC(computed.scheduledEnd));
  }
  if (has("actual_clock_in")) {
    updates.push("actual_clock_in = ?");
    params.push(toMySQLDateTimeUTC(computed.actualIn));
  }
  if (has("actual_clock_out")) {
    updates.push("actual_clock_out = ?");
    params.push(toMySQLDateTimeUTC(computed.actualOut));
  }
  if (has("computed_at")) {
    updates.push("computed_at = NOW()");
  }
  if (has("updated_at")) {
    updates.push("updated_at = NOW()");
  }

  if (!updates.length) return computed;

  params.push(logRow.id, logRow.bar_id);
  await conn.query(
    `UPDATE attendance_logs SET ${updates.join(", ")} WHERE id = ? AND bar_id = ?`,
    params
  );

  return computed;
}

async function recomputeAttendanceForEmployeeDay(conn, { barId, employeeUserId, dayOfWeek }) {
  const dow = Number(dayOfWeek);
  if (!Number.isInteger(dow) || dow < 0 || dow > 6) return 0;

  const [rows] = await conn.query(
    `SELECT id, bar_id, employee_user_id, work_date, time_in, time_out
     FROM attendance_logs
     WHERE bar_id=? AND employee_user_id=? AND DAYOFWEEK(work_date)=?`,
    [barId, employeeUserId, dow + 1]
  );

  for (const row of rows) {
    await recomputeAttendanceForLog(conn, row);
  }

  return rows.length;
}

router.post("/employee/attendance", requireAuth, async (req, res) => {
  // SELF clock-in/out: the handler only ever acts on req.user.id within the
  // caller's own bar, so authentication (+ bar scope checked below) is the
  // only gate. Any bar-attached role may clock itself: staff, finance, hr,
  // cashier, manager, bar_owner, employee. Customers have no bar and are
  // excluded by the role list below.
  try {
    const meta = await getAttendanceSchemaMeta();
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const userId = req.user.id;
    const workDate = todayYYYYMMDD();
    const { action } = req.body || {}; // "clock_in" | "clock_out"
    
    if (!action || !["clock_in", "clock_out"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action. Use 'clock_in' or 'clock_out'." });
    }

    // ── SECURITY: Full employee status validation ──
    const [me] = await pool.query(
      `SELECT u.id, u.bar_id, u.role, u.is_active,
              ep.employment_status
       FROM users u
       LEFT JOIN employee_profiles ep ON ep.user_id = u.id
       WHERE u.id=? LIMIT 1`,
      [userId]
    );
    if (!me.length) return res.status(404).json({ success: false, message: "User not found" });
    if (me[0].bar_id !== barId) return res.status(403).json({ success: false, message: "Forbidden" });

    // Block inactive accounts
    if (!me[0].is_active) {
      logAudit(null, {
        bar_id: barId, user_id: userId, action: "BLOCKED_ATTENDANCE",
        entity: "attendance", details: { reason: "account_inactive", attempted_action: action },
        ...auditContext(req)
      });
      return res.status(403).json({ success: false, message: "Account is inactive. Cannot record attendance." });
    }

    // Any bar-attached staff role may clock itself (customers cannot).
    const allowedClockRoles = ["staff", "finance", "hr", "cashier", "manager", "bar_owner", "employee"];
    if (!allowedClockRoles.includes((me[0].role || "").toLowerCase())) {
      logAudit(null, {
        bar_id: barId, user_id: userId, action: "BLOCKED_ATTENDANCE",
        entity: "attendance", details: { reason: "invalid_role", role: me[0].role, attempted_action: action },
        ...auditContext(req)
      });
      return res.status(403).json({ success: false, message: "Your role is not eligible for attendance clock." });
    }

    // Check for approved leave on this date — warn but don't hard-block
    const [leaveToday] = await pool.query(
      `SELECT id FROM leave_requests
       WHERE bar_id=? AND employee_user_id=? AND status='approved'
         AND ? BETWEEN start_date AND end_date
       LIMIT 1`,
      [barId, userId, workDate]
    );
    if (leaveToday.length) {
      logAudit(null, {
        bar_id: barId, user_id: userId, action: "ATTENDANCE_ON_LEAVE_DAY",
        entity: "attendance", details: { leave_request_id: leaveToday[0].id, work_date: workDate, attempted_action: action },
        ...auditContext(req)
      });
    }

    if (action === "clock_in") {
      // Prevent duplicate open sessions for the same day.
      const [openRows] = await pool.query(
        `SELECT id
         FROM attendance_logs
         WHERE bar_id=? AND employee_user_id=? AND work_date=?
           AND time_in IS NOT NULL AND time_out IS NULL
         ORDER BY id DESC
         LIMIT 1`,
        [barId, userId, workDate]
      );

      if (openRows.length) {
        logAudit(null, {
          bar_id: barId, user_id: userId, action: "DUPLICATE_CLOCK_IN",
          entity: "attendance", entity_id: openRows[0].id,
          details: { work_date: workDate, existing_log_id: openRows[0].id },
          ...auditContext(req)
        });
        return res.status(400).json({ success: false, message: "Already timed in" });
      }

      const clockInValidation = await validateClockInNotBeforeShift({
        barId,
        employeeUserId: userId,
        workDate,
        clockInValue: new Date(),
        meta,
        conn: pool,
      });
      if (!clockInValidation.ok) {
        logAudit(null, {
          bar_id: barId,
          user_id: userId,
          action: "BLOCKED_EARLY_CLOCK_IN",
          entity: "attendance",
          details: {
            reason: "before_shift_start",
            work_date: workDate,
            shift_start: clockInValidation?.schedule?.shift_start || null,
          },
          ...auditContext(req),
        });
        return res.status(400).json({ success: false, message: clockInValidation.message });
      }

      const [insertResult] = await pool.query(
        `INSERT INTO attendance_logs (bar_id, employee_user_id, work_date, time_in, source)
         VALUES (?, ?, ?, NOW(), 'manual')`,
        [barId, userId, workDate]
      );

      const [createdRows] = await pool.query(
        `SELECT id, bar_id, employee_user_id, work_date, time_in, time_out
         FROM attendance_logs
         WHERE id=? AND bar_id=?
         LIMIT 1`,
        [insertResult.insertId, barId]
      );
      if (createdRows.length) {
        const computed = await recomputeAttendanceForLog(pool, createdRows[0]);
        if (computed && Number(computed.minutesLate) > 0) {
          try {
            const [[barRow]] = await pool.query("SELECT name FROM bars WHERE id=? LIMIT 1", [barId]);
            const barName = barRow?.name || "your bar";
            await createNotification({
              userIds: userId,
              type: "attendance_late",
              title: "Late Clock-In",
              message: `You clocked in ${computed.minutesLate} min late at ${barName}.`,
              referenceType: "attendance",
              referenceId: createdRows[0].id,
              category: "attendance",
              action: "navigate",
              targetRoute: "/attendance",
            });
            await createNotification({
              barId,
              type: "attendance_late",
              title: "Staff Late Clock-In",
              message: `A staff member clocked in ${computed.minutesLate} min late at ${barName}.`,
              referenceType: "attendance",
              referenceId: createdRows[0].id,
              category: "attendance",
              action: "navigate",
              targetRoute: "/attendance",
              excludeUserId: userId,
            });
          } catch (e) {
            console.error("attendance late notification failed:", e.message);
          }
        }
      }

      return res.json({ success: true, message: "Time in recorded", data: { work_date: workDate, time_in: createdRows[0]?.time_in || null } });
    } else {
      // time-out
      const [rows] = await pool.query(
        `SELECT id, time_in, time_out
         FROM attendance_logs
         WHERE bar_id=? AND employee_user_id=? AND work_date=?
           AND time_in IS NOT NULL AND time_out IS NULL
         ORDER BY id DESC
         LIMIT 1`,
        [barId, userId, workDate]
      );

      if (!rows.length || !rows[0].time_in) {
        logAudit(null, {
          bar_id: barId, user_id: userId, action: "CLOCK_OUT_NO_CLOCK_IN",
          entity: "attendance",
          details: { work_date: workDate },
          ...auditContext(req)
        });
        return res.status(400).json({ success: false, message: "No time-in found for today" });
      }

      const [updateResult] = await pool.query(
        "UPDATE attendance_logs SET time_out = NOW() WHERE id = ? AND time_out IS NULL",
        [rows[0].id]
      );

      if (updateResult.affectedRows === 0) {
        return res.status(400).json({ success: false, message: "Already timed out" });
      }

      const [updatedRows] = await pool.query(
        `SELECT id, bar_id, employee_user_id, work_date, time_in, time_out
         FROM attendance_logs
         WHERE id=? AND bar_id=?
         LIMIT 1`,
        [rows[0].id, barId]
      );
      if (updatedRows.length) {
        await recomputeAttendanceForLog(pool, updatedRows[0]);
      }

      return res.json({ success: true, message: "Time out recorded", data: { work_date: workDate, time_out: updatedRows[0]?.time_out || null } });
    }
  } catch (err) {
    // Handle duplicate entry gracefully
    if (err.code === 'ER_DUP_ENTRY') {
      logAudit(null, {
        bar_id: req.user?.bar_id, user_id: req.user?.id, action: "DUPLICATE_ATTENDANCE_ENTRY",
        entity: "attendance", details: { error: "ER_DUP_ENTRY" },
        ...auditContext(req)
      });
      return res.status(409).json({
        success: false,
        message: "You already have an attendance record for today."
      });
    }
    console.error("ATTENDANCE CREATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// HR/Owner: Create attendance record for an employee
router.post("/hr/attendance", requireAuth, requirePermission("attendance_view_all"), async (req, res) => {
  try {
    const meta = await getAttendanceSchemaMeta();
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const { employee_user_id, work_date, time_in, time_out } = req.body || {};
    if (!employee_user_id || !work_date || !time_in) {
      return res.status(400).json({ success: false, message: "employee_user_id, work_date, and time_in are required" });
    }

    const normalizedWorkDate = normalizeWorkDateYMD(work_date);
    if (!normalizedWorkDate) {
      return res.status(400).json({ success: false, message: "Invalid work_date" });
    }

    // Verify employee belongs to same bar
    const [emp] = await pool.query("SELECT id, bar_id FROM users WHERE id=? AND bar_id=? LIMIT 1", [employee_user_id, barId]);
    if (!emp.length) return res.status(404).json({ success: false, message: "Employee not found in your bar" });

    const normalizedTimeIn = normalizeDateTimeInput(normalizedWorkDate, time_in);
    const normalizedTimeOut = normalizeDateTimeInput(normalizedWorkDate, time_out);

    if (!normalizedTimeIn) {
      return res.status(400).json({ success: false, message: "Invalid time_in" });
    }

    const clockInValidation = await validateClockInNotBeforeShift({
      barId,
      employeeUserId: Number(employee_user_id),
      workDate: normalizedWorkDate,
      clockInValue: normalizedTimeIn,
      meta,
      conn: pool,
    });
    if (!clockInValidation.ok) {
      return res.status(400).json({ success: false, message: clockInValidation.message });
    }

    const [result] = await pool.query(
      `INSERT INTO attendance_logs (bar_id, employee_user_id, work_date, time_in, time_out, source)
       VALUES (?, ?, ?, ?, ?, 'manual')`,
      [barId, employee_user_id, normalizedWorkDate, normalizedTimeIn, normalizedTimeOut]
    );

    const [createdRows] = await pool.query(
      `SELECT id, bar_id, employee_user_id, work_date, time_in, time_out
       FROM attendance_logs
       WHERE id=? AND bar_id=?
       LIMIT 1`,
      [result.insertId, barId]
    );
    if (createdRows.length) {
      await recomputeAttendanceForLog(pool, createdRows[0]);
    }

    logAudit(null, {
      bar_id: barId, user_id: req.user.id, action: "HR_CREATE_ATTENDANCE",
      entity: "attendance", entity_id: result.insertId,
      details: { employee_user_id, work_date },
      ...auditContext(req)
    });

    return res.status(201).json({ success: true, message: "Attendance record created", data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: "Duplicate attendance record for this date" });
    }
    console.error("HR CREATE ATTENDANCE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get(
  "/my/attendance",
  requireAuth,
  async (req, res) => {
    try {
      const meta = await getAttendanceSchemaMeta();
      const barId = req.user.bar_id;
      const userId = req.user.id;
      if (barId === null || barId === undefined) {
        return res.status(403).json({ success: false, message: "No bar_id on account" });
      }

      const { from, to, start_date, end_date } = req.query;
      const fromDate = from || start_date || todayYYYYMMDD();
      const toDate = to || end_date || todayYYYYMMDD();

      const [rows] = await pool.query(
        `SELECT ${selectAttendanceColumns(meta)}
         FROM attendance_logs
         WHERE bar_id = ? AND employee_user_id = ? AND work_date BETWEEN ? AND ?
         ORDER BY work_date DESC, id DESC`,
        [barId, userId, fromDate, toDate]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("MY ATTENDANCE ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

router.get(
  "/hr/attendance",
  requireAuth,
  requirePermission("attendance_view_all"),
  async (req, res) => {
    try {
      const meta = await getAttendanceSchemaMeta();
      const barId = req.user.bar_id;
      if (barId === null || barId === undefined) {
        return res.status(403).json({ success: false, message: "No bar_id on account" });
      }

      const { from, to, employee_user_id, start_date, end_date } = req.query;
      const fromDate = from || start_date;
      const toDate = to || end_date;

      if (!fromDate || !toDate) {
        return res.status(400).json({ success: false, message: "from and to required (YYYY-MM-DD)" });
      }

      const params = [barId, fromDate, toDate];
      let extra = "";

      if (employee_user_id) {
        extra = " AND a.employee_user_id = ? ";
        params.push(Number(employee_user_id));
      }

      const [rows] = await pool.query(
        `SELECT ${selectAttendanceColumns(meta, "a")},
                u.first_name, u.last_name, u.email
         FROM attendance_logs a
         JOIN users u ON u.id = a.employee_user_id
         WHERE a.bar_id = ? AND a.work_date BETWEEN ? AND ? ${extra}
         ORDER BY a.work_date DESC, u.last_name ASC`,
        params
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("HR ATTENDANCE ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);


router.patch("/hr/attendance/:id", requireAuth, requirePermission("attendance_view_all"), async (req, res) => {
  try {
    const meta = await getAttendanceSchemaMeta();
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

    // SECURITY: work_date is immutable — prevent changing which day a record belongs to
    if (req.body.work_date !== undefined || req.body.employee_user_id !== undefined || req.body.bar_id !== undefined) {
      logAudit(null, {
        bar_id: barId, user_id: req.user.id, action: "ATTENDANCE_TAMPER_ATTEMPT",
        entity: "attendance", entity_id: id,
        details: { attempted_fields: Object.keys(req.body) },
        ...auditContext(req)
      });
      return res.status(400).json({ success: false, message: "Cannot modify work_date, employee_user_id, or bar_id" });
    }

    const [existingRows] = await pool.query(
      `SELECT id, employee_user_id, work_date
       FROM attendance_logs
       WHERE id=? AND bar_id=?
       LIMIT 1`,
      [id, barId]
    );
    if (!existingRows.length) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }
    const existingLog = existingRows[0];

    const { time_in, time_out, minutes_late, minutes_undertime, minutes_overtime } = req.body || {};

    // SECURITY: Validate datetime strings if provided
    const datetimeRx = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/;
    if (time_in !== undefined && time_in !== null && !datetimeRx.test(String(time_in))) {
      return res.status(400).json({ success: false, message: "Invalid time_in format (YYYY-MM-DD HH:MM:SS)" });
    }
    if (time_out !== undefined && time_out !== null && !datetimeRx.test(String(time_out))) {
      return res.status(400).json({ success: false, message: "Invalid time_out format (YYYY-MM-DD HH:MM:SS)" });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (time_in !== undefined) {
      const normalizedTimeIn = normalizeDateTimeInput(existingLog.work_date, time_in) || time_in;
      if (normalizedTimeIn !== null) {
        const clockInValidation = await validateClockInNotBeforeShift({
          barId,
          employeeUserId: Number(existingLog.employee_user_id),
          workDate: existingLog.work_date,
          clockInValue: normalizedTimeIn,
          meta,
          conn: pool,
        });
        if (!clockInValidation.ok) {
          return res.status(400).json({ success: false, message: clockInValidation.message });
        }
      }

      updates.push("time_in = ?");
      params.push(normalizedTimeIn);
    }
    if (time_out !== undefined) {
      updates.push("time_out = ?");
      params.push(normalizeDateTimeInput(req.body.work_date || "", time_out) || time_out);
    }
    if (minutes_late !== undefined) {
      updates.push("minutes_late = ?");
      params.push(Number(minutes_late));
    }
    if (minutes_undertime !== undefined) {
      updates.push("minutes_undertime = ?");
      params.push(Number(minutes_undertime));
    }
    if (minutes_overtime !== undefined) {
      updates.push("minutes_overtime = ?");
      params.push(Number(minutes_overtime));
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    updates.push("updated_at = NOW()");
    params.push(id, barId);

    const [result] = await pool.query(
      `UPDATE attendance_logs SET ${updates.join(", ")} WHERE id = ? AND bar_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Attendance record not found" });
    }

    // Audit the successful update
    logAudit(null, {
      bar_id: barId, user_id: req.user.id, action: "ATTENDANCE_MANUAL_UPDATE",
      entity: "attendance", entity_id: id,
      details: { updated_fields: Object.keys(req.body) },
      ...auditContext(req)
    });

    if (time_in !== undefined || time_out !== undefined) {
      const [updatedRows] = await pool.query(
        `SELECT id, bar_id, employee_user_id, work_date, time_in, time_out
         FROM attendance_logs
         WHERE id=? AND bar_id=?
         LIMIT 1`,
        [id, barId]
      );

      if (updatedRows.length) {
        await recomputeAttendanceForLog(pool, updatedRows[0]);
      }
    }

    return res.json({ success: true, message: "Attendance record updated" });
  } catch (err) {
    console.error("HR ATTENDANCE UPDATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/my/schedules", requireAuth, requirePermission("attendance_view_own"), async (req, res) => {
  try {
    const meta = await getAttendanceSchemaMeta();
    if (!meta.hasEmployeeSchedulesTable) {
      return res.json({ success: true, data: [] });
    }

    const barId = req.user.bar_id;
    const userId = req.user.id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const [rows] = await pool.query(
      `SELECT id, day_of_week, shift_start, shift_end, break_minutes,
              overtime_multiplier, undertime_penalty_multiplier, is_rest_day, is_active
       FROM employee_schedules
       WHERE bar_id=? AND employee_user_id=?
       ORDER BY day_of_week ASC`,
      [barId, userId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("MY SCHEDULES ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/hr/schedules", requireAuth, requirePermission("attendance_view_all"), async (req, res) => {
  try {
    const meta = await getAttendanceSchemaMeta();
    if (!meta.hasEmployeeSchedulesTable) {
      return res.json({ success: true, data: [] });
    }

    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const { employee_user_id } = req.query;
    const params = [barId];
    let extra = "";
    if (employee_user_id) {
      extra = " AND s.employee_user_id = ?";
      params.push(Number(employee_user_id));
    }

    const [rows] = await pool.query(
      `SELECT s.id, s.employee_user_id, s.day_of_week, s.shift_start, s.shift_end,
              s.break_minutes, s.overtime_multiplier, s.undertime_penalty_multiplier,
              s.is_rest_day, s.is_active,
              u.first_name, u.last_name, u.email
       FROM employee_schedules s
       JOIN users u ON u.id = s.employee_user_id
       WHERE s.bar_id = ? ${extra}
       ORDER BY u.last_name ASC, u.first_name ASC, s.day_of_week ASC`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("HR SCHEDULES LIST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/hr/schedules", requireAuth, requirePermission("attendance_view_all"), async (req, res) => {
  try {
    const meta = await getAttendanceSchemaMeta();
    if (!meta.hasEmployeeSchedulesTable) {
      return res.status(503).json({ success: false, message: "Schedules feature is not available. Run latest migration first." });
    }

    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const {
      employee_user_id,
      day_of_week,
      shift_start,
      shift_end,
      break_minutes,
      overtime_multiplier,
      undertime_penalty_multiplier,
      is_rest_day,
      is_active,
    } = req.body || {};

    if (!employee_user_id && employee_user_id !== 0) {
      return res.status(400).json({ success: false, message: "employee_user_id is required" });
    }

    const dow = Number(day_of_week);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
      return res.status(400).json({ success: false, message: "day_of_week must be an integer from 0 to 6" });
    }

    const timeRx = /^\d{2}:\d{2}(:\d{2})?$/;
    if (shift_start && !timeRx.test(String(shift_start))) {
      return res.status(400).json({ success: false, message: "shift_start must be HH:MM or HH:MM:SS" });
    }
    if (shift_end && !timeRx.test(String(shift_end))) {
      return res.status(400).json({ success: false, message: "shift_end must be HH:MM or HH:MM:SS" });
    }

    const [emp] = await pool.query(
      "SELECT id FROM users WHERE id=? AND bar_id=? LIMIT 1",
      [employee_user_id, barId]
    );
    if (!emp.length) {
      return res.status(404).json({ success: false, message: "Employee not found in your bar" });
    }

    await pool.query(
      `INSERT INTO employee_schedules
       (bar_id, employee_user_id, day_of_week, shift_start, shift_end, break_minutes,
        overtime_multiplier, undertime_penalty_multiplier, is_rest_day, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         shift_start = VALUES(shift_start),
         shift_end = VALUES(shift_end),
         break_minutes = VALUES(break_minutes),
         overtime_multiplier = VALUES(overtime_multiplier),
         undertime_penalty_multiplier = VALUES(undertime_penalty_multiplier),
         is_rest_day = VALUES(is_rest_day),
         is_active = VALUES(is_active),
         updated_at = NOW()`,
      [
        barId,
        employee_user_id,
        dow,
        shift_start || "09:00:00",
        shift_end || "18:00:00",
        Math.max(0, toSafeNumber(break_minutes, 60)),
        Math.max(1, toSafeNumber(overtime_multiplier, 1.25)),
        Math.max(0, toSafeNumber(undertime_penalty_multiplier, 1)),
        Number(is_rest_day ? 1 : 0),
        Number(is_active === undefined ? 1 : (is_active ? 1 : 0)),
      ]
    );

    const recomputedCount = await recomputeAttendanceForEmployeeDay(pool, {
      barId,
      employeeUserId: Number(employee_user_id),
      dayOfWeek: dow,
    });

    return res.status(201).json({
      success: true,
      message: "Schedule saved",
      recomputed_attendance_count: recomputedCount,
    });
  } catch (err) {
    console.error("HR SCHEDULE CREATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/hr/schedules/:id", requireAuth, requirePermission("attendance_view_all"), async (req, res) => {
  try {
    const meta = await getAttendanceSchemaMeta();
    if (!meta.hasEmployeeSchedulesTable) {
      return res.status(503).json({ success: false, message: "Schedules feature is not available. Run latest migration first." });
    }

    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const scheduleId = Number(req.params.id);
    if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid schedule id" });
    }

    const {
      shift_start,
      shift_end,
      break_minutes,
      overtime_multiplier,
      undertime_penalty_multiplier,
      is_rest_day,
      is_active,
    } = req.body || {};

    const updates = [];
    const params = [];

    const timeRx = /^\d{2}:\d{2}(:\d{2})?$/;
    if (shift_start !== undefined) {
      if (shift_start && !timeRx.test(String(shift_start))) {
        return res.status(400).json({ success: false, message: "shift_start must be HH:MM or HH:MM:SS" });
      }
      updates.push("shift_start = ?");
      params.push(shift_start || "09:00:00");
    }
    if (shift_end !== undefined) {
      if (shift_end && !timeRx.test(String(shift_end))) {
        return res.status(400).json({ success: false, message: "shift_end must be HH:MM or HH:MM:SS" });
      }
      updates.push("shift_end = ?");
      params.push(shift_end || "18:00:00");
    }
    if (break_minutes !== undefined) {
      updates.push("break_minutes = ?");
      params.push(Math.max(0, toSafeNumber(break_minutes, 60)));
    }
    if (overtime_multiplier !== undefined) {
      updates.push("overtime_multiplier = ?");
      params.push(Math.max(1, toSafeNumber(overtime_multiplier, 1.25)));
    }
    if (undertime_penalty_multiplier !== undefined) {
      updates.push("undertime_penalty_multiplier = ?");
      params.push(Math.max(0, toSafeNumber(undertime_penalty_multiplier, 1)));
    }
    if (is_rest_day !== undefined) {
      updates.push("is_rest_day = ?");
      params.push(Number(is_rest_day ? 1 : 0));
    }
    if (is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(Number(is_active ? 1 : 0));
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    updates.push("updated_at = NOW()");
    params.push(scheduleId, barId);

    const [result] = await pool.query(
      `UPDATE employee_schedules
       SET ${updates.join(", ")}
       WHERE id=? AND bar_id=?`,
      params
    );

    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }

    const [scheduleRows] = await pool.query(
      `SELECT employee_user_id, day_of_week
       FROM employee_schedules
       WHERE id=? AND bar_id=?
       LIMIT 1`,
      [scheduleId, barId]
    );

    const targetSchedule = scheduleRows[0];
    const recomputedCount = targetSchedule
      ? await recomputeAttendanceForEmployeeDay(pool, {
          barId,
          employeeUserId: Number(targetSchedule.employee_user_id),
          dayOfWeek: Number(targetSchedule.day_of_week),
        })
      : 0;

    return res.json({
      success: true,
      message: "Schedule updated",
      recomputed_attendance_count: recomputedCount,
    });
  } catch (err) {
    console.error("HR SCHEDULE UPDATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/hr/attendance/report", requireAuth, requirePermission("attendance_view_all"), async (req, res) => {
  try {
    const meta = await getAttendanceSchemaMeta();
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const { from, to, start_date, end_date } = req.query;
    const fromDate = from || start_date;
    const toDate = to || end_date;
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: "from and to required (YYYY-MM-DD)" });
    }

    const has = (col) => meta.attendanceColumns.has(col);
    const lateExpr = has("minutes_late") ? "COALESCE(SUM(a.minutes_late), 0)" : (has("late_minutes") ? "COALESCE(SUM(a.late_minutes), 0)" : "0");
    const undertimeExpr = has("minutes_undertime") ? "COALESCE(SUM(a.minutes_undertime), 0)" : "0";
    const overtimeExpr = has("minutes_overtime") ? "COALESCE(SUM(a.minutes_overtime), 0)" : "0";
    const workedExpr = has("total_work_minutes")
      ? "COALESCE(SUM(a.total_work_minutes), 0)"
      : "COALESCE(SUM(CASE WHEN a.time_in IS NOT NULL AND a.time_out IS NOT NULL THEN GREATEST(TIMESTAMPDIFF(MINUTE, a.time_in, a.time_out), 0) ELSE 0 END), 0)";

    const [rows] = await pool.query(
      `SELECT a.employee_user_id,
              u.first_name,
              u.last_name,
              COUNT(*) AS attendance_records,
              COUNT(CASE WHEN a.time_in IS NOT NULL THEN 1 END) AS days_present,
              ${lateExpr} AS total_late_minutes,
              ${undertimeExpr} AS total_undertime_minutes,
              ${overtimeExpr} AS total_overtime_minutes,
              ${workedExpr} AS total_work_minutes
       FROM attendance_logs a
       JOIN users u ON u.id = a.employee_user_id
       WHERE a.bar_id = ? AND a.work_date BETWEEN ? AND ?
       GROUP BY a.employee_user_id, u.first_name, u.last_name
       ORDER BY u.last_name ASC, u.first_name ASC`,
      [barId, fromDate, toDate]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("HR ATTENDANCE REPORT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
module.exports.recomputeAttendanceForLog = recomputeAttendanceForLog;
