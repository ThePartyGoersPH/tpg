const pool = require("../config/database");

// Seed catalog used when a bar has no leave_types rows yet (Pegazus/bar 21 has
// none). Allocations mirror the values already used on other bars (VL/SL = 5).
// NOTE: for vacation and sick leave this stored number is only a legacy seed —
// the balance the API returns is the monthly accrual (1 day per month employed).
const SEED_LEAVE_TYPES = [
  { code: "VL", name: "Vacation Leave", days: 5 },
  { code: "SL", name: "Sick Leave", days: 5 },
  { code: "EL", name: "Emergency Leave", days: 0 },
  { code: "ML", name: "Maternity Leave", days: 0 },
  { code: "PL", name: "Paternity Leave", days: 0 },
  { code: "SPL", name: "Special Leave", days: 0 },
];

// leave_requests.leave_type (what the portal stores) <-> leave_types.code
const CODE_BY_REQUEST_TYPE = {
  vacation: "VL",
  sick: "SL",
  emergency: "EL",
  maternity: "ML",
  paternity: "PL",
  special: "SPL",
};
const REQUEST_TYPE_BY_CODE = {
  VL: "vacation",
  SL: "sick",
  EL: "emergency",
  ML: "maternity",
  PL: "paternity",
  SPL: "special",
  // Full-word codes exist on some bars (bar 11 stores "sick").
  VACATION: "vacation",
  SICK: "sick",
  EMERGENCY: "emergency",
  MATERNITY: "maternity",
  PATERNITY: "paternity",
  SPECIAL: "special",
};

function requestTypeForCode(code) {
  return REQUEST_TYPE_BY_CODE[String(code || "").toUpperCase()] || null;
}

function codeForRequestType(type) {
  return CODE_BY_REQUEST_TYPE[type] || String(type || "").toUpperCase();
}

// ── Monthly accrual ─────────────────────────────────────────────────────────
// Vacation and sick leave are NOT a fixed annual pool: they build up
// 1 day per completed month of employment (8 hrs each — 16 hrs per month).
// Emergency / maternity / paternity / special keep their stored allocation.
const ACCRUAL_TYPES = new Set(["vacation", "sick"]);
const ACCRUAL_DAYS_PER_MONTH = 1;

// Calendar parts of a date value, whichever shape the driver handed us:
// 'YYYY-MM-DD' strings and mysql2 DATE values. m is ALWAYS 1-based so string
// and Date inputs are comparable.
function dateParts(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  }
  const text = String(value || "").slice(0, 10);
  const [y, m, d] = text.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function formatParts(parts) {
  if (!parts) return null;
  const m = String(parts.m).padStart(2, "0");
  const d = String(parts.d).padStart(2, "0");
  return `${parts.y}-${m}-${d}`;
}

// Full months completed between the hire date and today (today's day-of-month
// must have reached the hire day; a hire on the 31st counts from the 31st, or
// from the last day of shorter months).
function monthsEmployed(hireDate, now = new Date()) {
  const start = dateParts(hireDate);
  if (!start) return 0;
  const today = dateParts(now);
  let months = (today.y - start.y) * 12 + (today.m - start.m);
  if (today.d < start.d) months -= 1;
  return Math.max(0, months);
}

// Hire date for accrual: employee_profiles.hired_date when HR set it, else the
// account creation date so brand-new rows still accrue from day one.
async function getEmployment(conn, barId, userId) {
  const [rows] = await conn.query(
    `SELECT ep.hired_date, u.created_at
       FROM users u
       LEFT JOIN employee_profiles ep ON ep.user_id = u.id AND ep.bar_id = ?
      WHERE u.id = ? LIMIT 1`,
    [barId, userId]
  );
  const row = rows[0];
  if (!row) return { hire_date: null, hire_date_source: null, months_employed: 0 };

  const hiredParts = dateParts(row.hired_date);
  const createdParts = dateParts(row.created_at);
  const source = hiredParts ? "hired_date" : createdParts ? "account_created" : null;
  const hireDate = hiredParts ? formatParts(hiredParts) : formatParts(createdParts);

  return {
    hire_date: hireDate,
    hire_date_source: source,
    months_employed: monthsEmployed(hireDate),
  };
}

// ── Conversion window settings (per bar, company-wide) ─────────────────────
// Stored in leave_conversion_settings; every bar falls back to "every year,
// December 1 - 31" until someone configures something else.
const CONVERSION_FREQUENCIES = ["yearly", "semiannual", "quarterly", "custom"];
// How many open months each frequency implies (custom lets them pick).
const FREQUENCY_MONTH_COUNT = { yearly: 1, semiannual: 2, quarterly: 4, custom: null };
const DEFAULT_CONVERSION_SETTINGS = { frequency: "yearly", months: [12], open_day: 1, close_day: 31 };
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Coerce whatever came out of the DB (or a request body) into a shape the
// window maths can trust — invalid input silently falls back to the default.
function normalizeSettings(raw) {
  const requested = String(raw?.frequency || "").toLowerCase();
  const frequency = CONVERSION_FREQUENCIES.includes(requested)
    ? requested
    : DEFAULT_CONVERSION_SETTINGS.frequency;
  const want = FREQUENCY_MONTH_COUNT[frequency];

  let months = (Array.isArray(raw?.months) ? raw.months : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
  months = [...new Set(months)].sort((a, b) => a - b);
  if (!months.length) months = [...DEFAULT_CONVERSION_SETTINGS.months];
  if (want) {
    if (months.length > want) months = months.slice(0, want);
    while (months.length < want) {
      const filler = DEFAULT_CONVERSION_SETTINGS.months.find((m) => !months.includes(m));
      if (filler === undefined) break;
      months = [...months, filler].sort((a, b) => a - b);
    }
  }

  const day = (value, fallback) => {
    const n = Math.round(Number(value));
    return Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : fallback;
  };
  const open_day = day(raw?.open_day, DEFAULT_CONVERSION_SETTINGS.open_day);
  const close_day = Math.max(open_day, day(raw?.close_day, DEFAULT_CONVERSION_SETTINGS.close_day));

  return { frequency, months, open_day, close_day };
}

// "Dec 1-31, 2026" for a single-month window, "Dec 30 - Jan 2, 2027" when a
// window (or the year) rolls over.
function formatWindow(w) {
  if (!w) return null;
  const [oy, om, od] = w.opens.split("-").map(Number);
  const [cy, cm, cd] = w.closes.split("-").map(Number);
  if (oy === cy && om === cm) return `${MONTH_ABBR[om - 1]} ${od}\u2013${cd}, ${oy}`;
  if (oy === cy) return `${MONTH_ABBR[om - 1]} ${od}\u2013${MONTH_ABBR[cm - 1]} ${cd}, ${oy}`;
  return `${MONTH_ABBR[om - 1]} ${od} \u2013 ${MONTH_ABBR[cm - 1]} ${cd}, ${cy}`;
}

// "December 1, 2026"
function formatDay(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTH_FULL[m - 1]} ${d}, ${y}`;
}

// Every window for one year: one per chosen month, day range clamped to the
// real length of that month (Feb 1-31 becomes Feb 1-28/29).
function windowsForYear(settings, year) {
  const s = normalizeSettings(settings);
  return s.months
    .map((month) => {
      const len = new Date(year, month, 0).getDate();
      const openDay = Math.min(Math.max(1, s.open_day), len);
      const closeDay = Math.min(Math.max(openDay, s.close_day), len);
      return {
        month,
        opens: `${year}-${pad2(month)}-${pad2(openDay)}`,
        closes: `${year}-${pad2(month)}-${pad2(closeDay)}`,
      };
    })
    .sort((a, b) => a.opens.localeCompare(b.opens));
}

// Active-or-upcoming window for "now", driven entirely by the stored settings.
// `opens` / `closes` keep their historical meaning: the window that is open
// right now, or the next one if none is open.
function conversionWindow(now = new Date(), settings = DEFAULT_CONVERSION_SETTINGS) {
  const s = normalizeSettings(settings);
  const year = now.getFullYear();
  const today = toISODate(now);
  const horizon = [...windowsForYear(s, year), ...windowsForYear(s, year + 1)];

  const active = horizon.find((w) => w.opens <= today && today <= w.closes) || null;
  const upcoming = horizon.find((w) => w.opens > today) || null;
  const current = active || upcoming || null;

  return {
    year,
    today,
    open: Boolean(active),
    opens: current?.opens || `${year}-12-01`,
    closes: current?.closes || `${year}-12-31`,
    label: formatWindow(current),
    active: active ? { ...active, label: formatWindow(active) } : null,
    active_label: formatWindow(active),
    next: upcoming ? { ...upcoming, label: formatWindow(upcoming), opens_again_label: formatDay(upcoming.opens) } : null,
    next_label: formatWindow(upcoming),
    opens_again: upcoming?.opens || null,
    opens_again_label: formatDay(upcoming?.opens),
    windows: windowsForYear(s, year).map((w) => ({ ...w, label: formatWindow(w) })),
    settings: s,
  };
}

// Stored settings for a bar (defaults + configured flag when nothing saved yet).
async function getConversionSettings(conn, barId) {
  const [rows] = await conn.query(
    `SELECT frequency, months, open_day, close_day, updated_by, updated_at
       FROM leave_conversion_settings WHERE bar_id = ? LIMIT 1`,
    [barId]
  );
  if (!rows.length) {
    return { ...DEFAULT_CONVERSION_SETTINGS, months: [...DEFAULT_CONVERSION_SETTINGS.months], configured: false };
  }
  const row = rows[0];
  const months = String(row.months || "")
    .split(",")
    .map((m) => Number(m.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 12);
  return {
    ...normalizeSettings({ frequency: row.frequency, months, open_day: row.open_day, close_day: row.close_day }),
    configured: true,
    updated_by: row.updated_by,
    updated_at: row.updated_at,
  };
}

// Strict validation for the settings form; returns the persisted shape.
async function saveConversionSettings(conn, barId, body, userId) {
  const frequency = String(body?.frequency || "").toLowerCase();
  if (!CONVERSION_FREQUENCIES.includes(frequency)) {
    return { ok: false, message: `frequency must be one of: ${CONVERSION_FREQUENCIES.join(", ")}` };
  }
  const rawMonths = Array.isArray(body?.months) ? body.months : [];
  const months = [...new Set(rawMonths.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12))].sort((a, b) => a - b);
  if (!months.length) return { ok: false, message: "Pick at least one month" };

  const want = FREQUENCY_MONTH_COUNT[frequency];
  if (want && months.length !== want) {
    const label = { yearly: "exactly 1 month", semiannual: "exactly 2 months", quarterly: "exactly 4 months" }[frequency];
    return { ok: false, message: `"${frequency}" needs ${label}` };
  }

  const day = (value, name) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 1 || n > 31) return { error: `${name} must be between 1 and 31` };
    return { value: n };
  };
  const open = day(body?.open_day, "open_day");
  if (open.error) return { ok: false, message: open.error };
  const close = day(body?.close_day, "close_day");
  if (close.error) return { ok: false, message: close.error };
  if (close.value < open.value) return { ok: false, message: "close_day must be on or after open_day" };

  const settings = normalizeSettings({ frequency, months, open_day: open.value, close_day: close.value });
  await conn.query(
    `INSERT INTO leave_conversion_settings (bar_id, frequency, months, open_day, close_day, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE frequency = VALUES(frequency), months = VALUES(months),
       open_day = VALUES(open_day), close_day = VALUES(close_day),
       updated_by = VALUES(updated_by), updated_at = NOW()`,
    [barId, settings.frequency, settings.months.join(","), settings.open_day, settings.close_day, userId || null]
  );
  return { ok: true, settings };
}

// Convenience: window for a bar right now (reads settings on every call so a
// saved change applies immediately, with no cache to invalidate).
async function conversionWindowFor(conn, barId, now = new Date()) {
  const settings = await getConversionSettings(conn, barId);
  return conversionWindow(now, settings);
}

// Standard hours in a work day (payroll_settings.standard_work_minutes).
async function hoursPerDay(conn, barId) {
  const [rows] = await conn.query(
    "SELECT standard_work_minutes FROM payroll_settings WHERE bar_id = ? LIMIT 1",
    [barId]
  );
  const minutes = Number(rows[0]?.standard_work_minutes) || 480;
  return Math.max(1, Math.round((minutes / 60) * 100) / 100);
}

async function getDailyRate(conn, barId, userId) {
  const [rows] = await conn.query(
    "SELECT daily_rate FROM employee_profiles WHERE bar_id = ? AND user_id = ? LIMIT 1",
    [barId, userId]
  );
  return rows.length ? Number(rows[0].daily_rate) || 0 : 0;
}

// Make sure the bar has a full leave_types catalog (missing codes only).
async function ensureLeaveTypes(conn, barId) {
  const [existing] = await conn.query(
    "SELECT id, code FROM leave_types WHERE bar_id = ?",
    [barId]
  );
  const have = new Set(existing.map((r) => String(r.code).toUpperCase()));
  for (const t of SEED_LEAVE_TYPES) {
    if (!have.has(t.code)) {
      await conn.query(
        `INSERT INTO leave_types (bar_id, code, name, default_annual_days, is_paid, is_active)
         VALUES (?, ?, ?, ?, 1, 1)`,
        [barId, t.code, t.name, t.days]
      );
    }
  }
}

// Resolve the leave_types row that a leave_requests.leave_type maps to.
async function resolveLeaveType(conn, barId, requestType) {
  await ensureLeaveTypes(conn, barId);
  const [types] = await conn.query(
    "SELECT id, code, name, default_annual_days FROM leave_types WHERE bar_id = ? AND is_active = 1",
    [barId]
  );
  const wanted = codeForRequestType(requestType);
  let row = types.find((t) => String(t.code).toUpperCase() === wanted);
  if (!row) row = types.find((t) => requestTypeForCode(t.code) === requestType);
  return row || null;
}

// Create any missing balance rows for (bar, employee, year). When a row is
// first created its used_days is backfilled from already-approved requests so
// the summary is truthful. `excludeRequestId` prevents double counting the
// request that is being approved right now.
async function ensureBalances(conn, barId, userId, year, excludeRequestId = null) {
  await ensureLeaveTypes(conn, barId);
  const [types] = await conn.query(
    "SELECT id, code, default_annual_days FROM leave_types WHERE bar_id = ? AND is_active = 1",
    [barId]
  );

  for (const t of types) {
    const [ins] = await conn.query(
      `INSERT IGNORE INTO leave_balances
         (bar_id, employee_user_id, leave_type_id, year, allocated_days, used_days, carryover_days)
       VALUES (?, ?, ?, ?, ?, 0, 0)`,
      [barId, userId, t.id, year, Number(t.default_annual_days) || 0]
    );
    if (!ins.affectedRows) continue;

    const requestType = requestTypeForCode(t.code);
    if (!requestType) continue;
    const params = [barId, userId, requestType, year];
    let exclude = "";
    if (excludeRequestId) {
      exclude = " AND id <> ?";
      params.push(excludeRequestId);
    }
    const [usedRows] = await conn.query(
      `SELECT COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) AS used
       FROM leave_requests
       WHERE bar_id = ? AND employee_user_id = ? AND status = 'approved'
         AND leave_type = ? AND YEAR(start_date) = ?${exclude}`,
      params
    );
    const used = Number(usedRows[0]?.used) || 0;
    if (used > 0) {
      await conn.query(
        "UPDATE leave_balances SET used_days = ? WHERE bar_id = ? AND employee_user_id = ? AND leave_type_id = ? AND year = ?",
        [used, barId, userId, t.id, year]
      );
    }
  }
}

// Full balance list for one employee + year (days and hours).
// Vacation / sick allocated_days is REPLACED by the monthly accrual
// (months_employed x 1 day) — the stored column is only the legacy seed.
async function getBalances(conn, barId, userId, year, employment = null) {
  const emp = employment || (await getEmployment(conn, barId, userId));
  await ensureBalances(conn, barId, userId, year);
  const [rows] = await conn.query(
    `SELECT lb.leave_type_id, lt.code, lt.name, lt.default_annual_days,
            lb.allocated_days, lb.carryover_days, lb.used_days
     FROM leave_balances lb
     JOIN leave_types lt ON lt.id = lb.leave_type_id
     WHERE lb.bar_id = ? AND lb.employee_user_id = ? AND lb.year = ?
     ORDER BY lt.id`,
    [barId, userId, year]
  );
  const perDay = await hoursPerDay(conn, barId);

  // Some bars carry two codes for the same type (bar 11 has both "sick" and
  // "SL"). Collapse them into one row so the summary never shows duplicate
  // labels and so "the sick balance" is unambiguous for conversions. The
  // biggest allocation wins the representative id — that is the row later
  // increments and conversion rows are written against.
  const merged = new Map();
  for (const r of rows) {
    const type = requestTypeForCode(r.code) || `id:${r.leave_type_id}`;
    const allocated = Number(r.allocated_days);
    const carryover = Number(r.carryover_days);
    const used = Number(r.used_days);
    const current = merged.get(type);
    if (!current) {
      merged.set(type, {
        leave_type_id: r.leave_type_id,
        code: r.code,
        name: r.name,
        request_type: type,
        allocated,
        carryover,
        used,
        weight: allocated + carryover,
      });
      continue;
    }
    current.allocated += allocated;
    current.carryover += carryover;
    current.used += used;
    const weight = allocated + carryover;
    if (weight > current.weight) {
      current.weight = weight;
      current.leave_type_id = r.leave_type_id;
      current.code = r.code;
      current.name = r.name;
    }
  }

  return [...merged.values()].map((m) => {
    const monthly = ACCRUAL_TYPES.has(m.request_type);
    const accrued = monthly
      ? Math.max(0, emp.months_employed * ACCRUAL_DAYS_PER_MONTH)
      : m.allocated;
    const carryover = m.carryover;
    const used = m.used;
    const remaining = accrued + carryover - used;
    const remainingDays = Math.max(0, Math.round(remaining * 100) / 100);
    const accruedDays = Math.round(accrued * 100) / 100;
    return {
      leave_type_id: m.leave_type_id,
      code: m.code,
      leave_type: m.request_type,
      name: m.name,
      // For vacation/sick this is the accrued pool, not a static allocation.
      allocated_days: accruedDays,
      accrued_days: accruedDays,
      accrual: monthly ? "monthly" : "annual",
      accrual_days_per_month: monthly ? ACCRUAL_DAYS_PER_MONTH : null,
      months_employed: emp.months_employed,
      hire_date: emp.hire_date,
      hire_date_source: emp.hire_date_source,
      carryover_days: Math.round(carryover * 100) / 100,
      used_days: Math.round(used * 100) / 100,
      remaining_days: remainingDays,
      remaining_hours: Math.round(remainingDays * perDay * 100) / 100,
    };
  });
}

// Approval guard: accrued balance minus used can never go negative. Returns
// { ok: false, message } when the request asks for more days than remain.
// Only vacation and sick are accrued, so other types pass straight through.
async function checkLeaveAccrual(conn, { barId, userId, requestType, startDate, endDate }) {
  const type = String(requestType || "").toLowerCase();
  if (!ACCRUAL_TYPES.has(type)) return { ok: true };

  const [dayRows] = await conn.query("SELECT DATEDIFF(?, ?) + 1 AS days", [endDate, startDate]);
  const days = Number(dayRows[0]?.days) || 0;
  if (days <= 0) return { ok: true, days };

  const year = Number(String(startDate).slice(0, 4));
  const balances = await getBalances(conn, barId, userId, year);
  const bal = balances.find((b) => b.leave_type === type);
  if (!bal) return { ok: true, days };
  if (days <= bal.remaining_days) {
    return { ok: true, days, remaining_days: bal.remaining_days };
  }

  const n = (v) => Math.round(Number(v) * 100) / 100;
  return {
    ok: false,
    days,
    accrued_days: bal.accrued_days,
    used_days: bal.used_days,
    remaining_days: bal.remaining_days,
    months_employed: bal.months_employed,
    name: bal.name,
    message:
      `Only ${n(bal.remaining_days)} day(s) of ${bal.name} remain — ` +
      `${n(bal.accrued_days)} accrued (${bal.months_employed} month(s) employed), ` +
      `${n(bal.used_days)} used. This request needs ${days} day(s).`,
  };
}

// Called when a leave request is approved: push the days onto used_days.
async function addApprovedLeaveDays(conn, { barId, userId, requestType, startDate, endDate, requestId }) {
  const year = Number(String(startDate).slice(0, 4));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return 0;

  await ensureBalances(conn, barId, userId, year, requestId || null);
  const typeRow = await resolveLeaveType(conn, barId, requestType);
  if (!typeRow) return 0;

  const [dayRows] = await conn.query(
    "SELECT DATEDIFF(?, ?) + 1 AS days",
    [endDate, startDate]
  );
  const days = Number(dayRows[0]?.days) || 0;
  if (days <= 0) return 0;

  await conn.query(
    `UPDATE leave_balances
     SET used_days = used_days + ?
     WHERE bar_id = ? AND employee_user_id = ? AND leave_type_id = ? AND year = ?`,
    [days, barId, userId, typeRow.id, year]
  );
  return days;
}

module.exports = {
  SEED_LEAVE_TYPES,
  CODE_BY_REQUEST_TYPE,
  ACCRUAL_TYPES,
  ACCRUAL_DAYS_PER_MONTH,
  CONVERSION_FREQUENCIES,
  FREQUENCY_MONTH_COUNT,
  DEFAULT_CONVERSION_SETTINGS,
  requestTypeForCode,
  codeForRequestType,
  monthsEmployed,
  getEmployment,
  normalizeSettings,
  windowsForYear,
  formatWindow,
  formatDay,
  getConversionSettings,
  saveConversionSettings,
  conversionWindowFor,
  conversionWindow,
  hoursPerDay,
  getDailyRate,
  ensureLeaveTypes,
  resolveLeaveType,
  ensureBalances,
  getBalances,
  checkLeaveAccrual,
  addApprovedLeaveDays,
};
