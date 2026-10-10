const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
const { requireBarOrderAccess } = require("../middlewares/requireBarOrder");
const requirePermission = require("../middlewares/requirePermission");
const { USER_ROLES } = require("../config/constants");
const { logAudit, auditContext } = require("../utils/audit");
const { createNotification } = require("../utils/notificationService");
const jwt = require("jsonwebtoken");
const { loadPaymentReadiness, paymentsNotReadyResponse } = require("../services/paymentReadiness");
const { complianceVisible } = require("../utils/compliance");

let triggerPushDispatch = () => {};
try {
  ({ triggerPushDispatch } = require("../utils/triggerPushDispatch"));
} catch (_) {
  // Keep reservation routes operational on deployments without push dispatcher module.
}

function parseReservationOrderItems(notes) {
  if (!notes) return [];
  const m = String(notes).match(/Order:\s*(.+)/i);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const qtyMatch = entry.match(/(.+?)\s*x\s*(\d+)$/i);
      if (!qtyMatch) return { name: entry, quantity: 1 };
      return { name: qtyMatch[1].trim(), quantity: Number(qtyMatch[2]) || 1 };
    });
}

function generateTransactionNumber() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `RES-${date}-${rand}`;
}

let _hasReservationModeColumnCache = null;
async function hasReservationModeColumn() {
  if (_hasReservationModeColumnCache !== null) return _hasReservationModeColumnCache;
  try {
    const [rows] = await pool.query(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'bars'
         AND COLUMN_NAME = 'reservation_mode'
       LIMIT 1`
    );
    _hasReservationModeColumnCache = rows.length > 0;
  } catch (_) {
    _hasReservationModeColumnCache = false;
  }
  return _hasReservationModeColumnCache;
}

let _hasReservationTimeLimitColumnsCache = null;
async function hasReservationTimeLimitColumns() {
  if (_hasReservationTimeLimitColumnsCache !== null) return _hasReservationTimeLimitColumnsCache;
  try {
    const [rows] = await pool.query(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'bars'
         AND COLUMN_NAME = 'reservation_time_limit_mode'
       LIMIT 1`
    );
    _hasReservationTimeLimitColumnsCache = rows.length > 0;
  } catch (_) {
    _hasReservationTimeLimitColumnsCache = false;
  }
  return _hasReservationTimeLimitColumnsCache;
}

let _hasReservedUntilColumnCache = null;
async function hasReservedUntilColumn() {
  if (_hasReservedUntilColumnCache !== null) return _hasReservedUntilColumnCache;
  try {
    const [rows] = await pool.query(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'reservations'
         AND COLUMN_NAME = 'reserved_until'
       LIMIT 1`
    );
    _hasReservedUntilColumnCache = rows.length > 0;
  } catch (_) {
    _hasReservedUntilColumnCache = false;
  }
  return _hasReservedUntilColumnCache;
}

let _hasReservationPaidAtColumnCache = null;
async function hasReservationPaidAtColumn() {
  if (_hasReservationPaidAtColumnCache !== null) return _hasReservationPaidAtColumnCache;
  try {
    const [rows] = await pool.query(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'reservations'
         AND COLUMN_NAME = 'paid_at'
       LIMIT 1`
    );
    _hasReservationPaidAtColumnCache = rows.length > 0;
  } catch (_) {
    _hasReservationPaidAtColumnCache = false;
  }
  return _hasReservationPaidAtColumnCache;
}

let _hasLifecycleStatusColumnCache = null;
async function hasLifecycleStatusColumn() {
  if (_hasLifecycleStatusColumnCache !== null) return _hasLifecycleStatusColumnCache;
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM bars LIKE 'lifecycle_status'");
    _hasLifecycleStatusColumnCache = rows.length > 0;
  } catch (_) {
    _hasLifecycleStatusColumnCache = false;
  }
  return _hasLifecycleStatusColumnCache;
}

function activeBarPredicate(alias, includeLifecycle) {
  // Compliance gate: approved bars, or bars still inside their 3-day
  // submission grace window (see utils/compliance.js).
  const selfActive = includeLifecycle
    ? `${alias}.status = 'active' AND COALESCE(${alias}.lifecycle_status, 'active') = 'active' AND ${complianceVisible(alias)}`
    : `${alias}.status = 'active' AND ${complianceVisible(alias)}`;

  const parentActive = includeLifecycle
    ? `EXISTS (
         SELECT 1
         FROM bars parent_bars
         WHERE parent_bars.id = ${alias}.parent_bar_id
           AND parent_bars.status = 'active'
           AND COALESCE(parent_bars.lifecycle_status, 'active') = 'active'
           AND ${complianceVisible("parent_bars")}
       )`
    : `EXISTS (
         SELECT 1
         FROM bars parent_bars
         WHERE parent_bars.id = ${alias}.parent_bar_id
           AND parent_bars.status = 'active'
           AND ${complianceVisible("parent_bars")}
       )`;

  return `(${selfActive} AND (${alias}.parent_bar_id IS NULL OR ${parentActive}))`;
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function formatTo12HourTime(rawTime) {
  const t = String(rawTime || '').trim();
  if (!t) return '';

  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return t;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return t;

  const d = new Date(Date.UTC(2000, 0, 1, hour, minute, 0));
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

async function getReservationNotificationRecipients(barId) {
  const normalizedBarId = Number(barId);
  if (!normalizedBarId) return [];

  const [rows] = await pool.query(
    `SELECT DISTINCT recipient_id
     FROM (
       SELECT bo.user_id AS recipient_id
       FROM bars b
       JOIN bar_owners bo ON bo.id = b.owner_id
       WHERE b.id = ?
         AND bo.user_id IS NOT NULL

       UNION

       SELECT u.id AS recipient_id
       FROM users u
       LEFT JOIN roles r
         ON r.id = COALESCE(
           u.role_id,
           (SELECT id FROM roles WHERE UPPER(name) = UPPER(u.role) LIMIT 1)
         )
       WHERE u.bar_id = ?
         AND COALESCE(u.is_active, 1) = 1
         AND LOWER(COALESCE(r.name, u.role, '')) IN ('bar_owner', 'manager', 'staff', 'employee', 'hr')
     ) recipients
     WHERE recipient_id IS NOT NULL`,
    [normalizedBarId, normalizedBarId]
  );

  return rows
    .map((row) => Number(row.recipient_id || 0))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function notifyBarTeamReservationCreated({
  barId,
  reservationId,
  reservationDate,
  reservationTime,
  partySize,
  initialStatus,
  transactionNumber = null,
  guestName = null,
  excludeUserId = null,
}) {
  const normalizedReservationId = Number(reservationId);
  if (!normalizedReservationId) return 0;

  const excludedId = Number(excludeUserId) || 0;
  const recipientIds = (await getReservationNotificationRecipients(barId)).filter((id) => id !== excludedId);
  if (!recipientIds.length) return 0;

  const [[barRow]] = await pool.query("SELECT name FROM bars WHERE id = ? LIMIT 1", [barId]);
  const barName = barRow?.name || "your bar";

  const formattedDate = reservationDate
    ? new Date(`${reservationDate}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
  const formattedTime = reservationTime ? formatTo12HourTime(reservationTime) : "";
  const scheduleText = formattedDate
    ? `${formattedDate}${formattedTime ? ` at ${formattedTime}` : ""}`
    : "the selected schedule";

  const guestCount = Number(partySize);
  const partyText = Number.isFinite(guestCount) && guestCount > 0
    ? `for ${guestCount} guest${guestCount === 1 ? "" : "s"}`
    : "for a reservation";

  const statusText = String(initialStatus || "").toLowerCase() === "approved"
    ? "auto-approved"
    : "pending approval";
  const guestLabel = guestName ? ` Guest: ${String(guestName).trim()}.` : "";
  const txnLabel = transactionNumber ? ` Txn: ${transactionNumber}.` : "";

  const message = `New table reservation at ${barName} on ${scheduleText} ${partyText}. Status: ${statusText}.${guestLabel}${txnLabel}`
    .replace(/\s+/g, " ")
    .trim();

  const notificationRows = recipientIds.map((userId) => [
    userId,
    "reservation_received",
    "New Table Reservation",
    message,
    normalizedReservationId,
    "reservation",
  ]);

  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
     VALUES ?`,
    [notificationRows]
  );

  return notificationRows.length;
}

function formatMysqlDateTime(dt) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

function deriveTimeLimitModeFromBarTypes(barTypes) {
  const normalized = barTypes.map((x) => String(x || "").toLowerCase());
  if (normalized.includes("club")) return "club";
  if (normalized.includes("comedy bar")) return "event";
  if (normalized.includes("restobar")) return "restobar";
  return null;
}

function normalizeReservationHourInput(rawTime) {
  if (!rawTime) return null;
  const str = String(rawTime).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm !== 0) return null;
  return `${String(hh).padStart(2, "0")}:00:00`;
}

const RESERVATION_TIME_ZONE = process.env.RESERVATION_TIME_ZONE || process.env.APP_TIMEZONE || "Asia/Manila";

function getTodayDateInReservationTimeZone() {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: RESERVATION_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch (_) {}

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getCurrentHourInReservationTimeZone() {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: RESERVATION_TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const rawHour = parts.find((p) => p.type === "hour")?.value;
    const hour = Number(rawHour);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) return hour;
  } catch (_) {}

  return new Date().getHours();
}

function normalizeReservationDateInput(rawDate) {
  if (!rawDate) return null;
  const str = String(rawDate).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== year || parsed.getMonth() + 1 !== month || parsed.getDate() !== day) return null;

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function normalizeDateLikeToYmd(rawDate) {
  if (!rawDate) return null;

  if (rawDate instanceof Date) {
    if (Number.isNaN(rawDate.getTime())) return null;
    const yyyy = rawDate.getFullYear();
    const mm = String(rawDate.getMonth() + 1).padStart(2, "0");
    const dd = String(rawDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const strict = normalizeReservationDateInput(rawDate);
  if (strict) return strict;

  const parsed = new Date(String(rawDate).trim());
  if (Number.isNaN(parsed.getTime())) return null;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isPastReservationDate(dateStr) {
  const normalized = normalizeReservationDateInput(dateStr);
  if (!normalized) return false;
  return normalized < getTodayDateInReservationTimeZone();
}

function parseClockToMinutes(token) {
  if (!token) return null;
  const cleaned = String(token).trim().toLowerCase();
  const m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2] || 0);
  const meridiem = m[4] ? m[4].toLowerCase() : null;
  if (mm < 0 || mm > 59) return null;

  if (meridiem) {
    if (hh < 1 || hh > 12) return null;
    if (meridiem === "am") {
      if (hh === 12) hh = 0;
    } else if (meridiem === "pm") {
      if (hh !== 12) hh += 12;
    }
  } else if (hh < 0 || hh > 23) {
    return null;
  }

  return hh * 60 + mm;
}

function parseBusinessHoursWindow(hoursText) {
  if (!hoursText) return null;
  const raw = String(hoursText).trim();
  if (!raw) return null;
  if (["closed", "n/a", "na", "off"].includes(raw.toLowerCase())) return null;

  const normalized = raw.replace(/\s+to\s+/gi, " - ").replace(/\u2013|\u2014/g, "-");
  const range = normalized.match(/(.+?)\s*-\s*(.+)/);
  if (!range) return null;

  const start = parseClockToMinutes(range[1]);
  const end = parseClockToMinutes(range[2]);
  if (start === null || end === null) return null;

  return { start, end };
}

function buildHourlySlotsForDate(hoursText, reservationDate) {
  const window = parseBusinessHoursWindow(hoursText);
  if (!window) return [];

  const slots = [];
  const startHour = Math.ceil(window.start / 60);
  const endHourRaw = Math.ceil(window.end / 60);

  if (window.end > window.start) {
    for (let hour = startHour; hour < endHourRaw; hour += 1) {
      slots.push(`${String(hour % 24).padStart(2, "0")}:00`);
    }
  } else {
    for (let hour = startHour; hour < 24; hour += 1) {
      slots.push(`${String(hour).padStart(2, "0")}:00`);
    }
    for (let hour = 0; hour < endHourRaw; hour += 1) {
      slots.push(`${String(hour).padStart(2, "0")}:00`);
    }
  }

  const todayStr = getTodayDateInReservationTimeZone();
  if (reservationDate === todayStr) {
    const currentHour = getCurrentHourInReservationTimeZone();
    return slots.filter((s) => Number(s.split(":")[0]) > currentHour);
  }

  return slots;
}

function dayColumnForDate(dateStr) {
  const normalizedDate = normalizeReservationDateInput(dateStr);
  if (!normalizedDate) return null;
  const d = new Date(`${normalizedDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const cols = [
    "sunday_hours",
    "monday_hours",
    "tuesday_hours",
    "wednesday_hours",
    "thursday_hours",
    "friday_hours",
    "saturday_hours",
  ];
  return cols[d.getDay()] || null;
}

let _hasReservationEventIdColumnCache = null;
async function hasReservationEventIdColumn() {
  if (_hasReservationEventIdColumnCache !== null) return _hasReservationEventIdColumnCache;
  try {
    const [rows] = await pool.query(
      `SELECT 1
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'reservations'
         AND COLUMN_NAME = 'event_id'
       LIMIT 1`
    );
    _hasReservationEventIdColumnCache = rows.length > 0;
  } catch (_) {
    _hasReservationEventIdColumnCache = false;
  }
  return _hasReservationEventIdColumnCache;
}

let _reservationReviewsTableReady = false;
async function ensureReservationReviewsTable() {
  if (_reservationReviewsTableReady) return;

  await pool.query(
    `CREATE TABLE IF NOT EXISTS reservation_reviews (
      id INT(11) NOT NULL AUTO_INCREMENT,
      reservation_id INT(11) NOT NULL,
      bar_id INT(11) NOT NULL,
      customer_id INT(11) NOT NULL,
      rating TINYINT(1) NOT NULL,
      comment TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reservation_reviews_reservation (reservation_id),
      KEY idx_reservation_reviews_customer (customer_id),
      KEY idx_reservation_reviews_bar (bar_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  _reservationReviewsTableReady = true;
}

function getOptionalUserId(req) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return null;
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    return Number(decoded?.id) || null;
  } catch (_) {
    return null;
  }
}

// --------------------------
// PUBLIC: Browse bars + tables + availability
// --------------------------

// GET /public/bars
router.get("/bars", async (req, res) => {
  try {
    const includeLifecycle = await hasLifecycleStatusColumn();
    const customerUserId = getOptionalUserId(req);
    const params = [];
    const where = [activeBarPredicate("b", includeLifecycle)];
    if (customerUserId) {
      where.push("NOT EXISTS (SELECT 1 FROM customer_bar_bans cbb WHERE cbb.bar_id = b.id AND cbb.customer_id = ?)");
      params.push(customerUserId);
    }

    const [rows] = await pool.query(
      `SELECT b.id, b.name, b.address, b.description, b.created_at,
              b.image_path, b.logo_path, b.video_path,
              b.logo_path AS bar_icon, b.video_path AS bar_gif,
              b.rating, b.review_count,
              (SELECT COUNT(*) FROM bar_followers bf WHERE bf.bar_id = b.id) AS follower_count
       FROM bars b
            WHERE ${where.join(" AND ")}
       ORDER BY id DESC
       LIMIT 200`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("PUBLIC BARS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /public/bars/:id
router.get("/bars/:id", async (req, res) => {
  try {
    const includeLifecycle = await hasLifecycleStatusColumn();
    const barId = Number(req.params.id);
    const customerUserId = getOptionalUserId(req);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    const params = [barId];
    let banFilter = "";
    if (customerUserId) {
      banFilter = " AND NOT EXISTS (SELECT 1 FROM customer_bar_bans cbb WHERE cbb.bar_id = b.id AND cbb.customer_id = ?)";
      params.push(customerUserId);
    }

    const [rows] = await pool.query(
      `SELECT b.id, b.name, b.address, b.description, b.created_at,
              b.image_path, b.logo_path, b.video_path,
              b.logo_path AS bar_icon, b.video_path AS bar_gif,
              b.rating, b.review_count,
              (SELECT COUNT(*) FROM bar_followers bf WHERE bf.bar_id = b.id) AS follower_count
       FROM bars b
            WHERE b.id=? AND ${activeBarPredicate("b", includeLifecycle)}${banFilter} LIMIT 1`,
      params
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Bar not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("PUBLIC BAR DETAILS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /public/bars/:id/tables
router.get("/bars/:id/tables", async (req, res) => {
  try {
    const includeLifecycle = await hasLifecycleStatusColumn();
    const barId = Number(req.params.id);
    const customerUserId = getOptionalUserId(req);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    const barCheckParams = [barId];
    let barCheckBanFilter = "";
    if (customerUserId) {
      barCheckBanFilter = " AND NOT EXISTS (SELECT 1 FROM customer_bar_bans cbb WHERE cbb.bar_id = bars.id AND cbb.customer_id = ?)";
      barCheckParams.push(customerUserId);
    }

    const [barCheck] = await pool.query(
      `SELECT id FROM bars WHERE id = ? AND ${activeBarPredicate("bars", includeLifecycle)}${barCheckBanFilter} LIMIT 1`,
      barCheckParams
    );
    if (!barCheck.length) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }

    const [rows] = await pool.query(
      `SELECT id, bar_id, table_number, capacity, is_active, created_at
       FROM bar_tables
       WHERE bar_id=? AND deleted_at IS NULL
       ORDER BY capacity ASC, table_number ASC`,
      [barId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("PUBLIC BAR TABLES ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /public/bars/:id/available-tables?date=YYYY-MM-DD&time=HH:00&party_size=#
router.get("/bars/:id/available-tables", async (req, res) => {
  try {
    const includeLifecycle = await hasLifecycleStatusColumn();
    const barId = Number(req.params.id);
    const customerUserId = getOptionalUserId(req);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    const barCheckParams = [barId];
    let barCheckBanFilter = "";
    if (customerUserId) {
      barCheckBanFilter = " AND NOT EXISTS (SELECT 1 FROM customer_bar_bans cbb WHERE cbb.bar_id = bars.id AND cbb.customer_id = ?)";
      barCheckParams.push(customerUserId);
    }

    const [barCheck] = await pool.query(
      `SELECT id FROM bars WHERE id = ? AND ${activeBarPredicate("bars", includeLifecycle)}${barCheckBanFilter} LIMIT 1`,
      barCheckParams
    );
    if (!barCheck.length) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }

    const { date, time, party_size } = req.query;
    if (!date || !time) {
      return res.status(400).json({ success: false, message: "date and time required" });
    }

    const normalizedReservationDate = normalizeReservationDateInput(date);
    if (!normalizedReservationDate) {
      return res.status(400).json({ success: false, message: "Invalid reservation date" });
    }
    if (isPastReservationDate(normalizedReservationDate)) {
      return res.status(400).json({ success: false, message: "Past reservation dates are not allowed." });
    }

    const dayCol = dayColumnForDate(normalizedReservationDate);
    if (!dayCol) {
      return res.status(400).json({ success: false, message: "Invalid reservation date" });
    }

    const includeTimeLimits = await hasReservationTimeLimitColumns();
    const includeReservedUntil = await hasReservedUntilColumn();
    const timeLimitSelect = includeTimeLimits
      ? `, bar_types, reservation_time_limit_mode, reservation_time_limit_minutes`
      : `, NULL AS bar_types, NULL AS reservation_time_limit_mode, NULL AS reservation_time_limit_minutes`;

    const [barHoursRows] = await pool.query(
      `SELECT ${dayCol} AS hours${timeLimitSelect} FROM bars WHERE id = ? LIMIT 1`,
      [barId]
    );
    const barRow = barHoursRows[0] || {};
    const barHours = barRow.hours || null;
    const hourlySlots = buildHourlySlotsForDate(barHours, normalizedReservationDate);
    if (!hourlySlots.length) {
      return res.json({
        success: true,
        data: [],
        message: "No available reservation slots for the selected date.",
        available_hours: [],
      });
    }

    const normalizedTime = normalizeReservationHourInput(time);
    if (!normalizedTime) {
      return res.status(400).json({ success: false, message: "Reservation time must be on the hour (HH:00)." });
    }
    const selectedHour = normalizedTime.slice(0, 5);
    if (!hourlySlots.includes(selectedHour)) {
      return res.status(400).json({
        success: false,
        message: "Selected hour is outside bar operating hours or already in the past.",
        available_hours: hourlySlots,
      });
    }

    const partySize = party_size ? Number(party_size) : null;
    if (party_size && (!Number.isFinite(partySize) || partySize <= 0)) {
      return res.status(400).json({ success: false, message: "party_size must be a positive number" });
    }

    const barTypes = parseJsonArray(barRow.bar_types);
    const derivedMode = deriveTimeLimitModeFromBarTypes(barTypes);
    const mode = includeTimeLimits ? (barRow.reservation_time_limit_mode || derivedMode) : null;
    const minutes = includeTimeLimits
      ? Number(barRow.reservation_time_limit_minutes || (mode === "club" ? 24 * 60 : mode === "restobar" ? 120 : 60))
      : 60;

    const requestedStart = new Date(`${normalizedReservationDate}T${normalizedTime}`);
    const requestedEnd = mode === "club"
      ? new Date(`${normalizedReservationDate}T23:59:59`)
      : new Date(requestedStart.getTime() + (Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60000);

    // Available = active tables minus those already reserved for overlapping time window
    let capacityFilter = "";
    if (partySize) capacityFilter = " AND t.capacity >= ? ";

    const baseParams = [barId];
    if (partySize) baseParams.push(partySize);
    if (includeReservedUntil) {
      baseParams.push(barId, normalizedReservationDate, formatMysqlDateTime(requestedEnd), minutes, formatMysqlDateTime(requestedStart));
    } else {
      baseParams.push(barId, normalizedReservationDate, normalizedTime);
    }

    const [rows] = includeReservedUntil
      ? await pool.query(
          `SELECT t.id, t.bar_id, t.table_number, t.floor_assignment AS floor, t.capacity, t.is_active,
                  t.manual_status,
                  t.image_path, t.price
           FROM bar_tables t
           WHERE t.bar_id = ?
             AND t.deleted_at IS NULL
             AND t.is_active = 1
             AND t.manual_status NOT IN ('reserved','unavailable')
             ${capacityFilter}
             AND t.id NOT IN (
               SELECT r.table_id
               FROM reservations r
               WHERE r.bar_id = ?
                 AND r.reservation_date = ?
                 AND r.status IN ('pending','approved','paid','confirmed','checked_in')
                 AND TIMESTAMP(CONCAT(r.reservation_date, ' ', r.reservation_time)) < ?
                 AND COALESCE(r.reserved_until, TIMESTAMPADD(MINUTE, ?, TIMESTAMP(CONCAT(r.reservation_date, ' ', r.reservation_time)))) > ?
               UNION ALL
               SELECT rt.table_id
               FROM reservations r
               JOIN reservation_tables rt ON rt.reservation_id = r.id
               WHERE r.bar_id = ?
                 AND r.reservation_date = ?
                 AND r.status IN ('pending','approved','paid','confirmed','checked_in')
                 AND TIMESTAMP(CONCAT(r.reservation_date, ' ', r.reservation_time)) < ?
                 AND COALESCE(r.reserved_until, TIMESTAMPADD(MINUTE, ?, TIMESTAMP(CONCAT(r.reservation_date, ' ', r.reservation_time)))) > ?
             )
           ORDER BY t.capacity ASC, t.table_number ASC`,
          [...baseParams, barId, normalizedReservationDate, formatMysqlDateTime(requestedEnd), minutes, formatMysqlDateTime(requestedStart)]
        )
      : await pool.query(
          `SELECT t.id, t.bar_id, t.table_number, t.floor_assignment AS floor, t.capacity, t.is_active,
                  t.manual_status,
                  t.image_path, t.price
           FROM bar_tables t
           WHERE t.bar_id = ?
             AND t.deleted_at IS NULL
             AND t.is_active = 1
             AND t.manual_status NOT IN ('reserved','unavailable')
             ${capacityFilter}
             AND t.id NOT IN (
               SELECT r.table_id
               FROM reservations r
               WHERE r.bar_id = ?
                 AND r.reservation_date = ?
                 AND r.reservation_time = ?
                 AND r.status IN ('pending','approved','paid','confirmed','checked_in')
               UNION ALL
               SELECT rt.table_id
               FROM reservations r
               JOIN reservation_tables rt ON rt.reservation_id = r.id
               WHERE r.bar_id = ?
                 AND r.reservation_date = ?
                 AND r.reservation_time = ?
                 AND r.status IN ('pending','approved','paid','confirmed','checked_in')
             )
           ORDER BY t.capacity ASC, t.table_number ASC`,
          [...baseParams, barId, normalizedReservationDate, normalizedTime]
        );

    return res.json({ success: true, data: rows, available_hours: hourlySlots });
  } catch (err) {
    console.error("AVAILABLE TABLES ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// --------------------------
// CUSTOMER: Create reservation + view my reservations + cancel
// --------------------------

// POST /reservations  (customer)
router.post(
  "/reservations",
  requireAuth,
  requireBarOrderAccess({ getBarId: (req) => req.body?.bar_id }),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const customerId = req.user.id;

      const { bar_id, table_id, table_ids, event_id, reservation_date, reservation_time, party_size, notes, menu_items } = req.body || {};

      const barId = Number(bar_id);
      // Support both single table_id and multiple table_ids
      let tableIds = [];
      if (table_ids && Array.isArray(table_ids)) {
        tableIds = table_ids.map(id => Number(id)).filter(id => id > 0);
      } else if (table_id) {
        tableIds = [Number(table_id)];
      }
      const eventId = event_id != null ? Number(event_id) : null;
      const partySize = party_size ? Number(party_size) : 1;

      if (!barId || !reservation_date || !reservation_time) {
        return res.status(400).json({ success: false, message: "bar_id, reservation_date, reservation_time required" });
      }
      if (!tableIds.length && !menu_items?.length && !notes) {
        return res.status(400).json({ success: false, message: "At least one table, menu item, or package order is required" });
      }
      if (!Number.isFinite(partySize) || partySize <= 0) {
        return res.status(400).json({ success: false, message: "party_size must be a positive number" });
      }
      if (event_id != null && (!Number.isInteger(eventId) || eventId <= 0)) {
        return res.status(400).json({ success: false, message: "event_id must be a valid integer" });
      }

      // Order type: table bookings need tables; dine-in/takeout never do.
      const ORDER_TYPES = ['table_booking', 'dine_in', 'takeout'];
      let orderType = String(req.body?.order_type || '').trim().toLowerCase();
      if (!orderType) orderType = tableIds.length > 0 ? 'table_booking' : 'dine_in';
      if (!ORDER_TYPES.includes(orderType)) {
        return res.status(400).json({ success: false, message: "order_type must be table_booking, dine_in, or takeout" });
      }
      if (orderType === 'table_booking' && tableIds.length === 0) {
        return res.status(400).json({ success: false, message: "Table booking requires selecting a table" });
      }
      if (orderType !== 'table_booking' && tableIds.length > 0) {
        return res.status(400).json({ success: false, message: "Dine-in and takeout orders do not use tables" });
      }

      // Tax snapshot (optional): VAT calculation applied at checkout, stored
      // so receipts/logs stay accurate if the bar later changes its config.
      const TAX_MODES = ['EXCLUSIVE', 'INCLUSIVE'];
      let taxRate = req.body?.tax_rate === undefined || req.body?.tax_rate === null || req.body?.tax_rate === ''
        ? null : Number(req.body.tax_rate);
      let taxMode = String(req.body?.tax_mode || '').trim().toUpperCase() || null;
      let taxAmount = req.body?.tax_amount === undefined || req.body?.tax_amount === null || req.body?.tax_amount === ''
        ? 0 : Number(req.body.tax_amount);
      let netSubtotal = req.body?.net_subtotal === undefined || req.body?.net_subtotal === null || req.body?.net_subtotal === ''
        ? null : Number(req.body.net_subtotal);
      if (taxRate !== null && (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)) {
        return res.status(400).json({ success: false, message: "tax_rate must be between 0 and 100" });
      }
      if (taxMode !== null && !TAX_MODES.includes(taxMode)) {
        return res.status(400).json({ success: false, message: "tax_mode must be EXCLUSIVE or INCLUSIVE" });
      }
      if (!Number.isFinite(taxAmount) || taxAmount < 0) {
        return res.status(400).json({ success: false, message: "tax_amount must be a non-negative number" });
      }
      if (netSubtotal !== null && (!Number.isFinite(netSubtotal) || netSubtotal < 0)) {
        return res.status(400).json({ success: false, message: "net_subtotal must be a non-negative number" });
      }

      // Fulfillment (takeout only): pickup vs delivery, enforced against
      // the bar's settings. The delivery fee is authoritative from the bar.
      const FULFILLMENTS = ['pickup', 'delivery'];
      // Alcohol detection for takeout payloads: menu items by category,
      // packages by name/inclusion keywords (inclusions are free text).
      const ALCOHOL_CATEGORIES = ['cocktail', 'cocktails', 'beer', 'beers', 'spirit', 'spirits', 'liquor', 'wine', 'shots'];
      const ALCOHOL_KEYWORDS = ['beer', 'whiskey', 'whisky', 'vodka', 'tequila', 'rum', 'gin', 'cocktail', 'mojito', 'margarita', 'liquor', 'spirit', 'cognac', 'hennessy', 'wine', 'shot', 'brandy', 'bourbon', 'sake', 'soju'];
      let fulfillment = String(req.body?.fulfillment || '').trim().toLowerCase() || null;
      let deliveryName = String(req.body?.delivery_name || '').trim() || null;
      let deliveryPhone = String(req.body?.delivery_phone || '').trim() || null;
      let deliveryAddress = String(req.body?.delivery_address || '').trim() || null;
      let deliveryNotes = String(req.body?.delivery_notes || '').trim() || null;
      let deliveryFee = 0;
      if (orderType === 'takeout') {
        if (!fulfillment) fulfillment = 'pickup';
        if (!FULFILLMENTS.includes(fulfillment)) {
          return res.status(400).json({ success: false, message: "fulfillment must be pickup or delivery" });
        }
        const [[barFf]] = await conn.query(
          'SELECT category, bar_types, allow_pickup, allow_delivery, delivery_fee, is_takeout_enabled FROM bars WHERE id = ? LIMIT 1',
          [barId]
        );
        // Takeout is a restobar-only mode (category or bar types mention it).
        let barIsRestobar = /restobar/i.test(String(barFf?.category || ''));
        if (!barIsRestobar) {
          try {
            barIsRestobar = parseJsonArray(barFf?.bar_types).some((t) => /restobar/i.test(String(t || '')));
          } catch (_) { barIsRestobar = false; }
        }
        if (!barIsRestobar) {
          return res.status(400).json({ success: false, message: "Takeout is only available at restobar venues" });
        }
        // ...and strictly opt-in: owner flag plus at least one fulfillment mode.
        const pickupOn = barFf ? Number(barFf.allow_pickup) !== 0 : true;
        const deliveryOn = barFf ? Number(barFf.allow_delivery) === 1 : false;
        const takeoutOn = barFf ? (Number(barFf.is_takeout_enabled) === 1 && (pickupOn || deliveryOn)) : false;
        if (!takeoutOn) {
          return res.status(400).json({ success: false, message: "Takeout is currently disabled for this bar" });
        }
        if (fulfillment === 'pickup' && !pickupOn) {
          return res.status(400).json({ success: false, message: "This bar does not offer store pickup" });
        }
        if (fulfillment === 'delivery' && !deliveryOn) {
          return res.status(400).json({ success: false, message: "This bar does not offer delivery" });
        }
        if (fulfillment === 'delivery') {
          if (!deliveryName || !deliveryPhone || !deliveryAddress) {
            return res.status(400).json({ success: false, message: "Delivery name, phone, and address are required" });
          }
          const { normalizeCustomerPhone } = require("../utils/phonePolicy");
          const deliveryPhoneCheck = normalizeCustomerPhone(deliveryPhone, {
            required: true,
            fieldLabel: "Delivery phone",
          });
          if (deliveryPhoneCheck.error) {
            return res.status(400).json({ success: false, message: deliveryPhoneCheck.error });
          }
          deliveryPhone = deliveryPhoneCheck.value;
          deliveryFee = barFf ? Math.max(0, Number(barFf.delivery_fee) || 0) : 0;
        }
        // Alcohol is restricted to table bookings: check menu items by
        // category and packages by name/inclusion keywords.
        if (Array.isArray(menu_items) && menu_items.length) {
          const alcIds = [...new Set(menu_items.map((mi) => Number(mi?.menu_item_id)).filter((n) => n > 0))];
          if (alcIds.length) {
            const [alcRows] = await conn.query(
              'SELECT id, menu_name, category FROM menu_items WHERE bar_id = ? AND id IN (?)',
              [barId, alcIds]
            );
            const bad = alcRows.find((r) => ALCOHOL_CATEGORIES.includes(String(r.category || '').trim().toLowerCase()));
            if (bad) {
              return res.status(400).json({ success: false, message: `Alcoholic items are restricted to table bookings (${bad.menu_name})` });
            }
          }
        }
        const pkgIds = [...String(notes || '').matchAll(/pkg_(\d+)/gi)].map((m) => Number(m[1])).filter((n) => n > 0);
        if (pkgIds.length) {
          const [pkgRows] = await conn.query(
            `SELECT p.id, p.name,
                    (SELECT GROUP_CONCAT(pi.item_name SEPARATOR ' ') FROM package_inclusions pi WHERE pi.package_id = p.id) AS incs
             FROM bar_packages p WHERE p.bar_id = ? AND p.id IN (?)`,
            [barId, pkgIds]
          );
          const badPkg = pkgRows.find((p) => ALCOHOL_KEYWORDS.some((k) => `${p.name || ''} ${p.incs || ''}`.toLowerCase().includes(k)));
          if (badPkg) {
            return res.status(400).json({ success: false, message: `Alcoholic packages are restricted to table bookings (${badPkg.name})` });
          }
        }
      } else {
        fulfillment = null;
        deliveryName = deliveryPhone = deliveryAddress = deliveryNotes = null;
        deliveryFee = 0;
      }

      const [banRows] = await conn.query(
        "SELECT 1 FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ? LIMIT 1",
        [barId, customerId]
      );
      if (banRows.length) {
        return res.status(403).json({ success: false, message: "You are banned from this bar" });
      }

      // No working payment setup -> the bar cannot take reservations either,
      // so the whole ordering/reservation flow stays closed for customers.
      if (!(await loadPaymentReadiness(barId, conn))) {
        return paymentsNotReadyResponse(res);
      }

      await conn.beginTransaction();

      const includeReservationMode = await hasReservationModeColumn();
      const includeEventId = await hasReservationEventIdColumn();
      const includeTimeLimits = await hasReservationTimeLimitColumns();
      const includeReservedUntil = await hasReservedUntilColumn();

      const normalizedReservationTime = normalizeReservationHourInput(reservation_time);
      if (!normalizedReservationTime) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "reservation_time must be on the hour (HH:00)." });
      }

      const normalizedReservationDate = normalizeReservationDateInput(reservation_date);
      if (!normalizedReservationDate) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Invalid reservation_date" });
      }
      if (isPastReservationDate(normalizedReservationDate)) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Past reservation dates are not allowed." });
      }

      const dayCol = dayColumnForDate(normalizedReservationDate);
      if (!dayCol) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Invalid reservation_date" });
      }

      const [barHoursRows] = await conn.query(`SELECT ${dayCol} AS hours FROM bars WHERE id = ? LIMIT 1`, [barId]);
      const barHours = barHoursRows[0]?.hours || null;
      const hourlySlots = buildHourlySlotsForDate(barHours, normalizedReservationDate);
      if (!hourlySlots.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "No available reservation slots for the selected date." });
      }
      if (!hourlySlots.includes(normalizedReservationTime.slice(0, 5))) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Selected reservation hour is outside bar operating hours or already in the past." });
      }

      // Check reservation_mode for this bar (manual_approval default)
      const barSelect = [
        includeReservationMode ? "reservation_mode" : "NULL AS reservation_mode",
        includeTimeLimits ? "bar_types" : "NULL AS bar_types",
        includeTimeLimits ? "reservation_time_limit_mode" : "NULL AS reservation_time_limit_mode",
        includeTimeLimits ? "reservation_time_limit_minutes" : "NULL AS reservation_time_limit_minutes",
      ].join(", ");
      const [barRows] = await conn.query(
        `SELECT ${barSelect} FROM bars WHERE id = ? LIMIT 1`,
        [barId]
      );
      const barRow = barRows[0] || {};
      const reservationMode = String(barRow.reservation_mode || "manual_approval").toLowerCase();
      const initialStatus = reservationMode === "auto_accept" ? "approved" : "pending";

      if (eventId && includeEventId) {
        const [eventRows] = await conn.query(
          `SELECT id
           FROM bar_events
           WHERE id = ? AND bar_id = ? AND archived_at IS NULL
           LIMIT 1`,
          [eventId, barId]
        );
        if (!eventRows.length) {
          await conn.rollback();
          return res.status(404).json({ success: false, message: "Event not found for this bar" });
        }
      }

      const barTypes = parseJsonArray(barRow.bar_types);
      const derivedMode = deriveTimeLimitModeFromBarTypes(barTypes);
      const mode = includeTimeLimits ? (barRow.reservation_time_limit_mode || derivedMode) : null;
      const minutes = includeTimeLimits
        ? Number(barRow.reservation_time_limit_minutes || (mode === "club" ? 24 * 60 : mode === "restobar" ? 120 : 60))
        : 60;
      const reservationStart = new Date(`${normalizedReservationDate}T${normalizedReservationTime}`);

      let reservedUntil = null;
      if (mode === "club") {
        reservedUntil = new Date(`${normalizedReservationDate}T23:59:59`);
      } else if (mode === "event" && eventId && includeEventId) {
        const [evRows] = await conn.query(
          `SELECT event_date, start_time, end_time
           FROM bar_events
           WHERE id = ? AND bar_id = ? AND archived_at IS NULL
           LIMIT 1`,
          [eventId, barId]
        );
        const ev = evRows[0] || null;
        if (ev) {
          const eventDateYmd = normalizeDateLikeToYmd(ev.event_date);
          const startMinutes = parseClockToMinutes(ev.start_time || normalizedReservationTime);
          const endMinutes = parseClockToMinutes(ev.end_time);

          if (eventDateYmd && startMinutes !== null) {
            const baseDate = new Date(`${eventDateYmd}T00:00:00`);
            const evStart = new Date(baseDate.getTime() + startMinutes * 60000);
            let evEnd = endMinutes !== null
              ? new Date(baseDate.getTime() + endMinutes * 60000)
              : new Date(evStart.getTime() + 2 * 60 * 60 * 1000);

            if (evEnd.getTime() <= evStart.getTime()) {
              evEnd = new Date(evEnd.getTime() + 24 * 60 * 60 * 1000);
            }

            if (!Number.isNaN(evEnd.getTime())) {
              reservedUntil = evEnd;
            }
          }
        }
      }
      if (!reservedUntil) {
        reservedUntil = new Date(reservationStart.getTime() + (Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60000);
      }

      // Validate all tables (only if tables were selected)
      let tables = [];
      if (tableIds.length > 0) {
        const placeholders = tableIds.map(() => '?').join(',');
        const [tableRows] = await conn.query(
          `SELECT id, bar_id, table_number, capacity, is_active, manual_status
           FROM bar_tables
           WHERE id IN (${placeholders}) AND bar_id=?`,
          [...tableIds, barId]
        );
        tables = tableRows;

        if (tables.length !== tableIds.length) {
          await conn.rollback();
          return res.status(404).json({ success: false, message: "One or more tables not found for this bar" });
        }

        // Check each table is active and available
        for (const t of tables) {
          if (Number(t.is_active) !== 1) {
            await conn.rollback();
            return res.status(400).json({ success: false, message: `Table #${t.table_number} is inactive` });
          }
          if (String(t.manual_status || "available").toLowerCase() !== "available") {
            await conn.rollback();
            return res.status(409).json({ success: false, message: `Table #${t.table_number} is already reserved` });
          }
        }

        // Check total capacity
        const totalCapacity = tables.reduce((sum, t) => sum + Number(t.capacity), 0);
        if (partySize > totalCapacity) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: `Party size (${partySize}) exceeds total table capacity (${totalCapacity})` });
        }

        // Prevent double booking – check each table for conflicts
        for (const tableId of tableIds) {
          const [conflict] = includeReservedUntil
            ? await conn.query(
                `SELECT id
                 FROM reservations r
                 WHERE r.bar_id = ?
                   AND r.reservation_date = ?
                   AND r.status IN ('pending','approved','paid','confirmed','checked_in')
                   AND TIMESTAMP(CONCAT(r.reservation_date, ' ', r.reservation_time)) < ?
                   AND COALESCE(r.reserved_until, TIMESTAMPADD(MINUTE, ?, TIMESTAMP(CONCAT(r.reservation_date, ' ', r.reservation_time)))) > ?
                   AND (r.table_id = ? OR EXISTS (
                     SELECT 1 FROM reservation_tables rt WHERE rt.reservation_id = r.id AND rt.table_id = ?
                   ))
                 LIMIT 1`,
                [barId, normalizedReservationDate, formatMysqlDateTime(reservedUntil), minutes, formatMysqlDateTime(reservationStart), tableId, tableId]
              )
            : await conn.query(
                `SELECT id, reservation_time
                 FROM reservations r
                 WHERE r.bar_id = ?
                   AND r.reservation_date = ?
                   AND r.status IN ('pending','approved','paid')
                   AND ABS(TIME_TO_SEC(TIMEDIFF(r.reservation_time, ?))) < 3600
                   AND (r.table_id = ? OR EXISTS (
                     SELECT 1 FROM reservation_tables rt WHERE rt.reservation_id = r.id AND rt.table_id = ?
                   ))
                 LIMIT 1`,
                [barId, normalizedReservationDate, normalizedReservationTime, tableId, tableId]
              );

          if (conflict.length) {
            await conn.rollback();
            const tableInfo = tables.find(t => t.id === tableId);
            return res.status(409).json({
              success: false,
              message: `Table #${tableInfo?.table_number || tableId} is already reserved for an overlapping time window.`
            });
          }
        }
      }

      const txnNumber = generateTransactionNumber();

      const insertReservedUntil = includeReservedUntil ? ", reserved_until" : "";
      const insertReservedUntilValues = includeReservedUntil ? ", ?" : "";
      const reservedUntilValue = includeReservedUntil ? formatMysqlDateTime(reservedUntil) : null;

      // Use first table as primary table_id for backward compatibility (null if no tables)
      const primaryTableId = tableIds.length > 0 ? tableIds[0] : null;

      const [ins] = includeEventId
        ? await conn.query(
            `INSERT INTO reservations
             (transaction_number, bar_id, table_id, event_id, customer_user_id, reservation_date, reservation_time${insertReservedUntil}, party_size, notes, status, order_type, fulfillment, delivery_name, delivery_phone, delivery_address, delivery_notes, delivery_fee, tax_rate, tax_mode, tax_amount, net_subtotal)
             VALUES (?, ?, ?, ?, ?, ?, ?${insertReservedUntilValues}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              txnNumber,
              barId,
              primaryTableId,
              eventId,
              customerId,
              normalizedReservationDate,
              normalizedReservationTime,
              ...(includeReservedUntil ? [reservedUntilValue] : []),
              partySize,
              notes || null,
              initialStatus,
              orderType,
              fulfillment,
              deliveryName,
              deliveryPhone,
              deliveryAddress,
              deliveryNotes,
              deliveryFee,
              taxRate,
              taxMode,
              taxAmount,
              netSubtotal
            ]
          )
        : await conn.query(
            `INSERT INTO reservations
             (transaction_number, bar_id, table_id, customer_user_id, reservation_date, reservation_time${insertReservedUntil}, party_size, notes, status, order_type, fulfillment, delivery_name, delivery_phone, delivery_address, delivery_notes, delivery_fee, tax_rate, tax_mode, tax_amount, net_subtotal)
             VALUES (?, ?, ?, ?, ?, ?${insertReservedUntilValues}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              txnNumber,
              barId,
              primaryTableId,
              customerId,
              normalizedReservationDate,
              normalizedReservationTime,
              ...(includeReservedUntil ? [reservedUntilValue] : []),
              partySize,
              notes || null,
              initialStatus,
              orderType,
              fulfillment,
              deliveryName,
              deliveryPhone,
              deliveryAddress,
              deliveryNotes,
              deliveryFee,
              taxRate,
              taxMode,
              taxAmount,
              netSubtotal
            ]
          );

      // Insert all tables into reservation_tables junction table for multi-table support
      if (tableIds.length > 0) {
        const [rtCheck] = await conn.query(
          `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation_tables' LIMIT 1`
        );
        if (rtCheck.length) {
          const tableRows = tableIds.map(tid => [ins.insertId, tid]);
          await conn.query(
            `INSERT INTO reservation_tables (reservation_id, table_id) VALUES ?`,
            [tableRows]
          );
        }
      }

      // Save menu items if provided
      if (Array.isArray(menu_items) && menu_items.length > 0) {
        const validItems = menu_items.filter(
          (mi) => mi && Number(mi.menu_item_id) > 0 && Number(mi.quantity) > 0
        );
        if (validItems.length > 0) {
          const itemRows = validItems.map((mi) => [
            ins.insertId,
            barId,
            Number(mi.menu_item_id),
            Number(mi.quantity),
            Number(mi.unit_price || 0),
          ]);
          await conn.query(
            `INSERT INTO reservation_items (reservation_id, bar_id, menu_item_id, quantity, unit_price) VALUES ?`,
            [itemRows]
          );
        }
      }

      await conn.commit();

      logAudit(null, {
        bar_id: barId,
        user_id: customerId,
        action: "CREATE_RESERVATION",
        entity: "reservations",
        entity_id: ins.insertId,
        details: {
          table_id: primaryTableId,
          event_id: includeEventId ? eventId : null,
          reservation_date: normalizedReservationDate,
          reservation_time: normalizedReservationTime,
          status: initialStatus,
        },
        ...auditContext(req),
      });

      let shouldTriggerPush = false;

      // Send notification to customer about successful reservation
      try {
        const [barInfo] = await pool.query("SELECT name FROM bars WHERE id = ? LIMIT 1", [barId]);
        const barName = barInfo[0]?.name || "the bar";
        const formattedDate = new Date(`${normalizedReservationDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const formattedTime = formatTo12HourTime(normalizedReservationTime);
        const whenText = `${formattedDate} at ${formattedTime}`;
        const stateText = initialStatus === 'approved' ? 'confirmed' : 'submitted and is pending approval';

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
          [
            customerId,
            'reservation_confirmed',
            'Reservation Confirmed',
            `Your reservation at ${barName} for ${whenText} has been ${stateText}.`,
            ins.insertId,
            'reservation'
          ]
        );
        shouldTriggerPush = true;

        // Mirror email, best-effort: never blocks the booking.
        try {
          const { notifyCustomer } = require("../utils/notifyCustomer");
          await notifyCustomer(customerId, "reservation_submitted", {
            barName, when: whenText, status: stateText,
          });
        } catch (_) {}
      } catch (notifErr) {
        console.error("Failed to create reservation notification:", notifErr);
      }

      // Notify bar owner and staff about new reservation requests.
      try {
        const insertedCount = await notifyBarTeamReservationCreated({
          barId,
          reservationId: ins.insertId,
          reservationDate: normalizedReservationDate,
          reservationTime: normalizedReservationTime,
          partySize,
          initialStatus,
          transactionNumber: txnNumber,
          excludeUserId: customerId,
        });
        shouldTriggerPush = shouldTriggerPush || insertedCount > 0;
      } catch (teamNotifErr) {
        console.error("Failed to create bar team reservation notifications:", teamNotifErr);
      }

      if (shouldTriggerPush) {
        triggerPushDispatch('reservation-created');
      }

      return res.status(201).json({
        success: true,
        message: initialStatus === "approved" ? "Reservation auto-approved" : "Reservation created",
        data: { id: ins.insertId, transaction_number: txnNumber }
      });
    } catch (err) {
      await conn.rollback();
      console.error("CREATE RESERVATION ERROR:", err);
      return res.status(500).json({ success: false, message: err.sqlMessage || err.message || "Server error" });
    } finally {
      conn.release();
    }
  }
);

// GET /reservations/my (customer)
router.get(
  "/reservations/my",
  requireAuth,
  requireRole([USER_ROLES.CUSTOMER]),
  async (req, res) => {
    try {
      const customerId = req.user.id;

      await ensureReservationReviewsTable();

      const [rows] = await pool.query(
        `SELECT r.id, r.transaction_number, r.bar_id, b.name AS bar_name, b.address AS bar_address,
                r.table_id, t.table_number, r.order_type, r.fulfillment, r.delivery_name, r.delivery_phone, r.delivery_address, r.delivery_notes, r.delivery_fee, r.tax_rate, r.tax_mode, r.tax_amount, r.net_subtotal,
                r.reservation_date, r.reservation_time, r.party_size,
                r.status, r.payment_status, r.notes, r.deposit_amount,
                r.paid_at, r.checked_in_at, r.no_show_at, r.created_at,
                pt.reference_id, pt.payment_method, pt.amount AS payment_amount,
                (
                  COALESCE((
                    SELECT SUM(bt2.price)
                    FROM reservation_tables rt2
                    JOIN bar_tables bt2 ON bt2.id = rt2.table_id
                    WHERE rt2.reservation_id = r.id
                  ), t.price, 0) +
                  COALESCE((
                    SELECT SUM(ri.quantity * ri.unit_price)
                    FROM reservation_items ri
                    WHERE ri.reservation_id = r.id
                  ), 0)
                ) AS total_amount,
                GREATEST(0, (
                  COALESCE((
                    SELECT SUM(bt2.price)
                    FROM reservation_tables rt2
                    JOIN bar_tables bt2 ON bt2.id = rt2.table_id
                    WHERE rt2.reservation_id = r.id
                  ), t.price, 0) +
                  COALESCE((
                    SELECT SUM(ri.quantity * ri.unit_price)
                    FROM reservation_items ri
                    WHERE ri.reservation_id = r.id
                  ), 0)
                ) - COALESCE(pt.amount, 0)) AS remaining_balance,
                rr.id AS review_id, rr.rating AS review_rating, rr.comment AS review_comment,
                CASE WHEN rr.id IS NULL THEN 0 ELSE 1 END AS has_review
          FROM reservations r
          JOIN bars b ON b.id = r.bar_id
          LEFT JOIN bar_tables t ON t.id = r.table_id
          LEFT JOIN payment_transactions pt ON pt.id = (
            SELECT id FROM payment_transactions
            WHERE payment_type = 'reservation' AND related_id = r.id
            ORDER BY created_at DESC LIMIT 1
          )
          LEFT JOIN reservation_reviews rr ON rr.reservation_id = r.id
          WHERE r.customer_user_id=?
          ORDER BY r.created_at DESC
          LIMIT 200`,
        [customerId]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("MY RESERVATIONS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET /reservations/my/reviews (customer)
router.get(
  "/reservations/my/reviews",
  requireAuth,
  requireRole([USER_ROLES.CUSTOMER]),
  async (req, res) => {
    try {
      const customerId = req.user.id;
      await ensureReservationReviewsTable();

      const [rows] = await pool.query(
        `SELECT id, reservation_id, bar_id, rating, comment, created_at, updated_at
         FROM reservation_reviews
         WHERE customer_id = ?
         ORDER BY created_at DESC
         LIMIT 500`,
        [customerId]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("MY RESERVATION REVIEWS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET /reservations/my/:id (customer)
router.get(
  "/reservations/my/:id",
  requireAuth,
  requireRole([USER_ROLES.CUSTOMER]),
  async (req, res) => {
    try {
      const customerId = req.user.id;
      const reservationId = Number(req.params.id);

      if (!reservationId) {
        return res.status(400).json({ success: false, message: "Invalid reservation id" });
      }

      await ensureReservationReviewsTable();

      const [rows] = await pool.query(
        `SELECT r.id, r.transaction_number, r.bar_id, b.name AS bar_name, b.address AS bar_address,
                r.table_id, t.table_number, r.order_type, r.fulfillment, r.delivery_name, r.delivery_phone, r.delivery_address, r.delivery_notes, r.delivery_fee, r.tax_rate, r.tax_mode, r.tax_amount, r.net_subtotal,
                r.reservation_date, r.reservation_time, r.party_size,
                r.status, r.payment_status, r.notes, r.deposit_amount,
                r.paid_at, r.checked_in_at, r.no_show_at, r.created_at,
                pt.reference_id, pt.payment_method, pt.amount AS payment_amount,
                (
                  COALESCE((
                    SELECT SUM(bt2.price)
                    FROM reservation_tables rt2
                    JOIN bar_tables bt2 ON bt2.id = rt2.table_id
                    WHERE rt2.reservation_id = r.id
                  ), t.price, 0) +
                  COALESCE((
                    SELECT SUM(ri.quantity * ri.unit_price)
                    FROM reservation_items ri
                    WHERE ri.reservation_id = r.id
                  ), 0)
                ) AS total_amount,
                GREATEST(0, (
                  COALESCE((
                    SELECT SUM(bt2.price)
                    FROM reservation_tables rt2
                    JOIN bar_tables bt2 ON bt2.id = rt2.table_id
                    WHERE rt2.reservation_id = r.id
                  ), t.price, 0) +
                  COALESCE((
                    SELECT SUM(ri.quantity * ri.unit_price)
                    FROM reservation_items ri
                    WHERE ri.reservation_id = r.id
                  ), 0)
                ) - COALESCE(pt.amount, 0)) AS remaining_balance,
                rr.id AS review_id, rr.rating AS review_rating, rr.comment AS review_comment,
                CASE WHEN rr.id IS NULL THEN 0 ELSE 1 END AS has_review
         FROM reservations r
          JOIN bars b ON b.id = r.bar_id
          LEFT JOIN bar_tables t ON t.id = r.table_id
          LEFT JOIN payment_transactions pt ON pt.id = (
            SELECT id FROM payment_transactions
            WHERE payment_type = 'reservation' AND related_id = r.id
            ORDER BY created_at DESC LIMIT 1
          )
          LEFT JOIN reservation_reviews rr ON rr.reservation_id = r.id
          WHERE r.customer_user_id=? AND r.id=?
         LIMIT 1`,
        [customerId, reservationId]
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, message: "Reservation not found" });
      }

      return res.json({ success: true, data: rows[0] });
    } catch (err) {
      console.error("MY RESERVATION DETAIL ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /reservations/:id/reviews (customer)
router.post(
  "/reservations/:id/reviews",
  requireAuth,
  requireRole([USER_ROLES.CUSTOMER]),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const customerId = req.user.id;
      const reservationId = Number(req.params.id);
      const { rating, comment } = req.body || {};

      if (!reservationId) {
        return res.status(400).json({ success: false, message: "Invalid reservation id" });
      }

      const ratingNum = Number(rating);
      if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
      }

      await ensureReservationReviewsTable();

      const [reservationRows] = await conn.query(
        `SELECT id, bar_id, status
         FROM reservations
         WHERE id = ? AND customer_user_id = ?
         LIMIT 1`,
        [reservationId, customerId]
      );

      if (!reservationRows.length) {
        return res.status(404).json({ success: false, message: "Reservation not found" });
      }

      const reservation = reservationRows[0];
      if (String(reservation.status || "").toLowerCase() !== "completed") {
        return res.status(400).json({ success: false, message: "You can only review completed bookings." });
      }

      const [existingRows] = await conn.query(
        `SELECT id
         FROM reservation_reviews
         WHERE reservation_id = ?
         LIMIT 1`,
        [reservationId]
      );

      if (existingRows.length) {
        return res.status(409).json({ success: false, message: "You have already reviewed this booking." });
      }

      const [insertResult] = await conn.query(
        `INSERT INTO reservation_reviews (reservation_id, bar_id, customer_id, rating, comment)
         VALUES (?, ?, ?, ?, ?)`,
        [reservationId, reservation.bar_id, customerId, ratingNum, comment ? String(comment).trim() : null]
      );

      return res.status(201).json({
        success: true,
        message: "Review submitted",
        data: {
          id: insertResult.insertId,
          reservation_id: reservationId,
          bar_id: reservation.bar_id,
          rating: ratingNum,
          comment: comment ? String(comment).trim() : null,
        },
      });
    } catch (err) {
      console.error("CREATE RESERVATION REVIEW ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  }
);

// POST /reservations/:id/check-in (customer)
router.post(
  "/reservations/:id/check-in",
  requireAuth,
  requireRole([USER_ROLES.CUSTOMER]),
  async (req, res) => {
    try {
      const customerId = req.user.id;
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

      const [rows] = await pool.query(
        `SELECT id, status, checked_in_at, reservation_date, reservation_time
         FROM reservations
         WHERE id=? AND customer_user_id=? LIMIT 1`,
        [id, customerId]
      );
      if (!rows.length) return res.status(404).json({ success: false, message: "Reservation not found" });

      const r = rows[0];
      if (r.checked_in_at) {
        return res.json({ success: true, message: "Already checked in" });
      }
      if (r.status !== "confirmed") {
        return res.status(400).json({ success: false, message: "Reservation is not eligible for check-in" });
      }

      const [timeRows] = await pool.query(
        `SELECT NOW() AS now_dt,
                TIMESTAMP(CONCAT(?, ' ', ?)) AS start_dt,
                TIMESTAMPADD(MINUTE, 30, TIMESTAMP(CONCAT(?, ' ', ?))) AS grace_dt`,
        [r.reservation_date, r.reservation_time, r.reservation_date, r.reservation_time]
      );
      const nowDt = new Date(timeRows[0].now_dt);
      const startDt = new Date(timeRows[0].start_dt);
      const graceDt = new Date(timeRows[0].grace_dt);

      if (nowDt < startDt) {
        return res.status(400).json({ success: false, message: "Check-in is available at your reservation time." });
      }
      if (nowDt > graceDt) {
        return res.status(400).json({ success: false, message: "Check-in window has expired." });
      }

      await pool.query(
        `UPDATE reservations
         SET status='checked_in', checked_in_at=NOW()
         WHERE id=? AND customer_user_id=? AND status='confirmed' AND checked_in_at IS NULL`,
        [id, customerId]
      );

      return res.json({ success: true, message: "Checked in successfully" });
    } catch (err) {
      console.error("CUSTOMER CHECK-IN ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET /reservations/lookup/:txn — Bar owner looks up reservation by transaction number
router.get(
  "/reservations/lookup/:txn",
  requireAuth,
  requirePermission(["reservation_view"]),
  async (req, res) => {
    try {
      const txn = String(req.params.txn || '').trim().toUpperCase();
      if (!txn) return res.status(400).json({ success: false, message: "Transaction number required" });

      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar associated with your account" });

      const [rows] = await pool.query(
        `SELECT r.id, r.transaction_number, r.bar_id, b.name AS bar_name,
                r.table_id, t.table_number, t.capacity, t.price AS table_price, r.order_type, r.fulfillment, r.delivery_name, r.delivery_phone, r.delivery_address, r.delivery_notes, r.delivery_fee, r.tax_rate, r.tax_mode, r.tax_amount, r.net_subtotal,
                r.customer_user_id, u.first_name, u.last_name, u.email, u.phone_number,
                r.reservation_date, r.reservation_time, r.party_size, r.occasion, r.notes,
                r.status, r.payment_status, r.deposit_amount, r.created_at
         FROM reservations r
          JOIN bars b ON b.id = r.bar_id
          LEFT JOIN bar_tables t ON t.id = r.table_id
          LEFT JOIN users u ON u.id = r.customer_user_id
          WHERE r.transaction_number = ?
            AND r.bar_id = ?
         LIMIT 1`,
        [txn, barId]
      );

      if (!rows.length) {
        return res.status(404).json({ success: false, message: "Reservation not found or does not belong to your bar" });
      }

      const reservation = rows[0];

      // Fetch all tables from junction table for multi-table support
      const [rtTables] = await pool.query(
        `SELECT rt.table_id, bt.table_number, bt.capacity, bt.price, bt.floor_assignment AS floor
         FROM reservation_tables rt
         JOIN bar_tables bt ON bt.id = rt.table_id
         WHERE rt.reservation_id = ?
         ORDER BY bt.table_number`,
        [reservation.id]
      );
      if (rtTables.length > 0) {
        reservation.tables = rtTables;
        reservation.table_price = rtTables.reduce((sum, t) => sum + Number(t.price || 0), 0);
      } else if (reservation.table_id) {
        reservation.tables = [{ table_id: reservation.table_id, table_number: reservation.table_number, capacity: reservation.capacity, price: reservation.table_price, floor: null }];
      } else {
        // Table-less booking (menu-only order) — no phantom table entry.
        reservation.tables = [];
      }

      // Fetch reservation items if table exists
      const [riCheck] = await pool.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation_items' LIMIT 1`
      );

      let items = [];
      if (riCheck.length) {
        const [itemRows] = await pool.query(
          `SELECT ri.menu_item_id, COALESCE(m.menu_name, CONCAT('Item #', ri.menu_item_id)) AS menu_name,
                  ri.quantity, ri.unit_price,
                  (ri.quantity * ri.unit_price) AS line_total
           FROM reservation_items ri
           LEFT JOIN menu_items m ON m.id = ri.menu_item_id
           WHERE ri.reservation_id = ?
           ORDER BY COALESCE(m.menu_name, 'zzz')`,
          [reservation.id]
        );
        items = itemRows;
      }

      // Supplement with any items from notes not already represented in DB results
      if (reservation.notes) {
        const dbItemNames = new Set(items.map(it => (it.menu_name || '').toLowerCase().trim()));
        const parsedItems = parseReservationOrderItems(reservation.notes);
        for (const it of parsedItems) {
          if (dbItemNames.has(it.name.toLowerCase().trim())) continue;
          const [[menuRow]] = await pool.query(
            `SELECT selling_price FROM menu_items WHERE bar_id = ? AND LOWER(menu_name) = LOWER(?) ORDER BY id DESC LIMIT 1`,
            [reservation.bar_id, it.name]
          );
          const unitPrice = Number(menuRow?.selling_price || 0);
          if (unitPrice > 0) {
            items.push({
              menu_name: it.name,
              quantity: Number(it.quantity),
              unit_price: unitPrice,
              line_total: unitPrice * Number(it.quantity),
            });
          }
        }
      }

      // Fetch payment transaction info
      const [paymentRows] = await pool.query(
        `SELECT pt.id AS payment_id, pt.reference_id, pt.amount, pt.status AS payment_status,
                pt.payment_method, pt.paid_at, pt.created_at AS payment_created_at
         FROM payment_transactions pt
         WHERE pt.payment_type = 'reservation' AND pt.related_id = ?
         ORDER BY pt.created_at DESC LIMIT 1`,
        [reservation.id]
      );
      const payment = paymentRows[0] || null;

      const computedTotal = items.reduce((sum, it) => sum + Number(it.line_total || 0), 0)
        + Number(reservation.table_price || 0);

      // Also check payment_line_items for the total (captures full order at checkout time)
      let pliTotal = 0;
      if (payment?.payment_id) {
        const [[pliRow]] = await pool.query(
          `SELECT COALESCE(SUM(line_total), 0) AS pli_total FROM payment_line_items WHERE payment_transaction_id = ?`,
          [payment.payment_id]
        );
        pliTotal = Number(pliRow?.pli_total || 0);
      }

      // Use the best total we have; never fall back to paidAmount (that causes false "Fully Paid")
      const totalAmount = Math.max(computedTotal, pliTotal) || Number(reservation.deposit_amount || 0);

      return res.json({
        success: true,
        data: {
          ...reservation,
          items,
          total_amount: totalAmount,
          online_payment_amount: payment?.status === 'paid' ? Number(payment.amount || 0) : 0,
          online_payment_method: payment?.payment_method || null,
          online_paid_at: payment?.paid_at || null,
          online_reference: payment?.reference_id || null,
          payment: payment ? {
            payment_id: payment.payment_id,
            reference_id: payment.reference_id,
            amount: Number(payment.amount),
            status: payment.payment_status,
            payment_method: payment.payment_method,
            paid_at: payment.paid_at,
          } : null,
        },
      });
    } catch (err) {
      console.error("LOOKUP RESERVATION ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /reservations/:id/recheck-payment (customer) - Fix payment status mismatch
router.post(
  "/reservations/:id/recheck-payment",
  requireAuth,
  requireRole([USER_ROLES.CUSTOMER]),
  async (req, res) => {
    try {
      const customerId = req.user.id;
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

      const [rows] = await pool.query(
        `SELECT id, status, payment_status FROM reservations WHERE id=? AND customer_user_id=? LIMIT 1`,
        [id, customerId]
      );
      if (!rows.length) return res.status(404).json({ success: false, message: "Reservation not found" });

      // Get latest payment transaction
      const [payments] = await pool.query(
        `SELECT status, paid_at FROM payment_transactions
         WHERE payment_type = 'reservation' AND related_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [id]
      );

      if (!payments.length) {
        return res.status(400).json({ success: false, message: "No payment found for this reservation" });
      }

      const latestPayment = payments[0];
      
      // If payment is paid but reservation is cancelled, fix it
      if (latestPayment.status === 'paid' && rows[0].status === 'cancelled') {
        await pool.query(
          `UPDATE reservations SET status = 'confirmed', payment_status = 'paid', paid_at = ? WHERE id = ?`,
          [latestPayment.paid_at, id]
        );
        return res.json({ success: true, message: "Reservation status corrected to confirmed", data: { status: 'confirmed', payment_status: 'paid' } });
      }

      // If payment is cancelled/failed but reservation is confirmed, fix it
      if (['cancelled', 'failed'].includes(latestPayment.status) && rows[0].status === 'confirmed') {
        await pool.query(
          `UPDATE reservations SET status = 'cancelled', payment_status = 'cancelled' WHERE id = ?`,
          [id]
        );
        return res.json({ success: true, message: "Reservation status corrected to cancelled", data: { status: 'cancelled', payment_status: 'cancelled' } });
      }

      return res.json({ success: true, message: "Status already correct", data: { status: rows[0].status, payment_status: rows[0].payment_status } });
    } catch (err) {
      console.error("RECHECK PAYMENT ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH /reservations/:id/cancel (customer)
router.patch(
  "/reservations/:id/cancel",
  requireAuth,
  requireBarOrderAccess({
    getBarId: async (req) => {
      const id = Number(req.params.id);
      if (!id) return NaN;
      const [[row]] = await pool.query(
        "SELECT bar_id FROM reservations WHERE id = ? LIMIT 1",
        [id]
      );
      return row?.bar_id;
    },
  }),
  async (req, res) => {
    try {
      const customerId = req.user.id;
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

      const [rows] = await pool.query(
        `SELECT id, status
         FROM reservations
         WHERE id=? AND customer_user_id=? LIMIT 1`,
        [id, customerId]
      );
      if (!rows.length) return res.status(404).json({ success: false, message: "Reservation not found" });

      if (rows[0].status === "cancelled") {
        return res.status(400).json({ success: false, message: "Already cancelled" });
      }

      await pool.query(
        `UPDATE reservations
         SET status='cancelled'
         WHERE id=? AND customer_user_id=?`,
        [id, customerId]
      );

      // Cancellation mail, best-effort: never blocks the cancel.
      try {
        const { notifyCustomer } = require("../utils/notifyCustomer");
        const [[info]] = await pool.query(
          `SELECT r.reservation_date, r.reservation_time, b.name AS bar_name
           FROM reservations r LEFT JOIN bars b ON b.id = r.bar_id
           WHERE r.id = ? LIMIT 1`,
          [id]
        );
        const when = info?.reservation_date
          ? `${new Date(`${info.reservation_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${info.reservation_time ? ` at ${String(info.reservation_time).slice(0, 5)}` : ''}`
          : '';
        await notifyCustomer(customerId, "reservation_cancelled", {
          barName: info?.bar_name || "the bar", when,
        });
      } catch (_) {}

      return res.json({ success: true, message: "Reservation cancelled" });
    } catch (err) {
      console.error("CANCEL RESERVATION ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// --------------------------
// OWNER: Manage reservations (approve/reject/cancel)
// --------------------------

// GET /owner/reservations?status=pending&date=YYYY-MM-DD
router.get(
  "/owner/reservations",
  requireAuth,
  requirePermission("reservation_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { status, date } = req.query;

      const where = ["r.bar_id = ?"];
      const params = [barId];

      if (status) {
        where.push("r.status = ?");
        params.push(status);
      }
      if (date) {
        where.push("r.reservation_date = ?");
        params.push(date);
      }

      const [rows] = await pool.query(
        `SELECT r.id, r.transaction_number, r.table_id, t.table_number, t.price AS table_price, r.customer_user_id,
                r.order_type, r.fulfillment, r.delivery_name, r.delivery_phone, r.delivery_address, r.delivery_notes, r.delivery_fee, r.tax_rate, r.tax_mode, r.tax_amount, r.net_subtotal,
                COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), 'Guest') AS guest_name,
                cu.email AS guest_email,
                cu.phone_number AS guest_phone,
                r.reservation_date, r.reservation_time, r.party_size,
                r.status, r.payment_status, r.deposit_amount, r.checked_in_at, r.no_show_at,
                r.occasion, r.notes, r.created_at,
                pt.amount AS online_payment_amount,
                pt.payment_method AS online_payment_method,
                pt.paid_at AS online_paid_at,
                pt.reference_id AS online_reference,
                COALESCE(t.price, 0) + COALESCE((
                  SELECT SUM(ri.quantity * ri.unit_price)
                  FROM reservation_items ri WHERE ri.reservation_id = r.id
                ), 0) AS total_amount
         FROM reservations r
          LEFT JOIN bar_tables t ON t.id = r.table_id
          LEFT JOIN users cu ON cu.id = r.customer_user_id
         LEFT JOIN payment_transactions pt ON pt.id = r.payment_transaction_id AND pt.status = 'paid'
         WHERE ${where.join(" AND ")}
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT 300`,
        params
      );

      // Fetch all tables for each reservation from junction table
      for (const row of rows) {
        const [tables] = await pool.query(
          `SELECT rt.table_id, bt.table_number, bt.capacity, bt.price, bt.floor_assignment AS floor
           FROM reservation_tables rt
           JOIN bar_tables bt ON bt.id = rt.table_id
           WHERE rt.reservation_id = ?
           ORDER BY bt.table_number`,
          [row.id]
        );
        
        if (tables.length > 0) {
          row.tables = tables;
          // Recalculate total_amount with all table prices
          const totalTablePrice = tables.reduce((sum, t) => sum + Number(t.price || 0), 0);
          const itemsTotal = Number(row.total_amount || 0) - Number(row.table_price || 0);
          row.total_amount = totalTablePrice + itemsTotal;
          row.table_price = totalTablePrice;
        } else if (row.table_id) {
          // Fallback to single table for backward compatibility
          row.tables = [{
            table_id: row.table_id,
            table_number: row.table_number,
            price: row.table_price,
            capacity: null,
            floor: null
          }];
        } else {
          // Table-less booking (menu-only order) — no phantom table entry.
          row.tables = [];
        }
      }

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("OWNER RESERVATIONS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// POST /owner/reservations/qr-checkin  body: { transaction_number }
// Staff scans customer QR code and checks in the reservation.
router.post(
  "/owner/reservations/qr-checkin",
  requireAuth,
  requirePermission("qr_scan"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const transactionNumber = String(req.body?.transaction_number || "").trim();
      if (!transactionNumber) {
        return res.status(400).json({ success: false, message: "Transaction number is required" });
      }

      const [rows] = await pool.query(
        `SELECT r.id, r.status, r.party_size, r.reservation_date, r.reservation_time,
                r.guest_name, r.guest_phone, r.transaction_number, r.checked_in_at,
                r.table_id, r.payment_status, r.deposit_amount,
                t.table_number
         FROM reservations r
         LEFT JOIN bar_tables t ON r.table_id = t.id
         WHERE r.transaction_number = ? AND r.bar_id = ? LIMIT 1`,
        [transactionNumber, barId]
      );

      // ── Not found at all ──────────────────────────────────────────
      if (!rows.length) {
        return res.status(404).json({
          success: false,
          reservation_status: "not_found",
          message: "No reservation found for this code.",
        });
      }

      const r = rows[0];

      // ── Already checked in ────────────────────────────────────────
      if (r.status === "checked_in") {
        return res.status(409).json({
          success: false,
          reservation_status: "checked_in",
          message: "This guest has already been checked in.",
          reservation: {
            id: r.id, status: r.status, guest_name: r.guest_name,
            checked_in_at: r.checked_in_at,
          },
        });
      }

      // ── Completed ─────────────────────────────────────────────────
      if (r.status === "completed") {
        return res.status(409).json({
          success: false,
          reservation_status: "completed",
          message: "This reservation has already been completed.",
          reservation: { id: r.id, status: r.status, guest_name: r.guest_name },
        });
      }

      // ── Cancelled / Rejected ──────────────────────────────────────
      if (r.status === "cancelled" || r.status === "rejected") {
        const label = r.status === "cancelled" ? "cancelled" : "rejected";
        return res.status(409).json({
          success: false,
          reservation_status: r.status,
          message: `This reservation was ${label} and cannot be checked in.`,
          reservation: { id: r.id, status: r.status, guest_name: r.guest_name },
        });
      }

      // ── No-show ───────────────────────────────────────────────────
      if (r.status === "no_show") {
        return res.status(409).json({
          success: false,
          reservation_status: "no_show",
          message: "This reservation was marked as a no-show.",
          reservation: { id: r.id, status: r.status, guest_name: r.guest_name },
        });
      }

      // ── Pending — exists but not yet approved ──────────────────────
      if (r.status === "pending") {
        return res.status(400).json({
          success: false,
          reservation_status: "pending",
          message: "This reservation is still pending approval. Please approve it in Reservations first.",
          reservation: { id: r.id, status: r.status, guest_name: r.guest_name },
        });
      }

      // ── Not yet payable (e.g. confirmed but no deposit recorded) ──
      if (r.status !== "confirmed" && r.status !== "approved" && r.status !== "paid") {
        return res.status(400).json({
          success: false,
          reservation_status: r.status,
          message: `Cannot check in a reservation with status "${r.status}".`,
          reservation: { id: r.id, status: r.status, guest_name: r.guest_name },
        });
      }

      // ── Approvable statuses: confirmed / approved / paid ──────────
      // Calculate balance for info (don't block)
      const deposit = Number(r.deposit_amount || 0);
      const hasBalance = r.payment_status !== "paid" && deposit > 0;

      // Perform check-in
      await pool.query(
        `UPDATE reservations SET status = 'checked_in', checked_in_at = NOW() WHERE id = ? AND bar_id = ?`,
        [r.id, barId]
      );

      // Auto-settle remaining balance on QR check-in
      let paymentSettled = false;
      if (r.payment_status !== "paid" && Number(r.deposit_amount || 0) > 0) {
        const settleNote = "Balance settled at QR check-in by staff";
        const includePaidAtSettle = await hasReservationPaidAtColumn();
        const updateFields = [`payment_status = 'paid'`, `notes = CONCAT(COALESCE(notes, ''), IF(notes IS NOT NULL AND notes != '', ' | ', ''), ?)`];
        const updateParams = [settleNote];
        if (includePaidAtSettle) {
          updateFields.push("paid_at = NOW()");
        }
        await pool.query(
          `UPDATE reservations SET ${updateFields.join(', ')} WHERE id = ?`,
          [...updateParams, r.id]
        );
        r.payment_status = "paid";
        paymentSettled = true;
      }

      // Audit log
      try {
        await logAudit({
          userId: req.user.id,
          barId,
          action: "reservation_check_in",
          entityType: "reservation",
          entityId: r.id,
          details: { transaction_number: transactionNumber, method: "qr_scan", payment_settled: paymentSettled || undefined },
        });
      } catch (_) { /* non-critical */ }

      return res.json({
        success: true,
        reservation_status: "checked_in",
        message: hasBalance
          ? `Guest checked in. Balance of \u20B1${deposit.toLocaleString()} due at door.`
          : "Guest checked in successfully.",
        reservation: {
          id: r.id,
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
          guest_name: r.guest_name || "Guest",
          party_size: r.party_size,
          table_number: r.table_number || r.table_id,
          reservation_date: r.reservation_date,
          reservation_time: r.reservation_time,
          transaction_number: r.transaction_number,
          payment_status: r.payment_status,
          deposit_amount: r.deposit_amount,
        },
      });
    } catch (err) {
      console.error("QR check-in error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH /owner/reservations/:id/status  body: { action: "approve"|"reject"|"cancel" }
router.patch(
  "/owner/reservations/:id/status",
  requireAuth,
  requirePermission("reservation_manage"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

      const action = String(req.body?.action || "").toLowerCase();
      const allowed = ["approve", "reject", "cancel", "check_in", "complete", "no_show"];
      if (!allowed.includes(action)) {
        return res.status(400).json({ success: false, message: "Invalid action" });
      }

      const nextStatus =
        action === "approve" ? "approved" :
        action === "reject" ? "rejected" :
        action === "check_in" ? "checked_in" :
        action === "complete" ? "completed" :
        action === "no_show" ? "no_show" :
        "cancelled";

      const [found] = await pool.query(
        `SELECT id, status, payment_status, deposit_amount, customer_user_id,
                reservation_date, reservation_time, transaction_number
         FROM reservations
         WHERE id=? AND bar_id=? LIMIT 1`,
        [id, barId]
      );
      if (!found.length) return res.status(404).json({ success: false, message: "Reservation not found" });

      const current = found[0];
      if ((action === 'cancel' || action === 'reject') && current.payment_status === 'paid') {
        return res.status(400).json({ success: false, message: "Cannot cancel or reject a paid reservation. Process a refund first." });
      }
      if (current.status === 'cancelled') {
        return res.status(400).json({ success: false, message: "Reservation is already cancelled." });
      }

      if (action === "check_in") {
        await pool.query(
          `UPDATE reservations
           SET status='checked_in', checked_in_at=NOW()
           WHERE id=? AND bar_id=? AND status='confirmed' AND checked_in_at IS NULL`,
          [id, barId]
        );
      } else if (action === "no_show") {
        await pool.query(
          `UPDATE reservations
           SET status='no_show', no_show_at=NOW()
           WHERE id=? AND bar_id=?`,
          [id, barId]
        );
      } else {
        await pool.query(
          `UPDATE reservations
           SET status=?
           WHERE id=? AND bar_id=?`,
          [nextStatus, id, barId]
        );
      }

      // Auto-settle remaining balance on check_in or complete
      let paymentSettled = false;
      if ((nextStatus === "checked_in" || nextStatus === "completed") &&
          current.payment_status !== "paid" &&
          Number(current.deposit_amount || 0) > 0) {
        const settleNote = `Balance settled at ${nextStatus === "checked_in" ? "check-in" : "completion"} by staff`;
        const includePaidAtSettle = await hasReservationPaidAtColumn();
        const updateFields = [`payment_status = 'paid'`, `notes = CONCAT(COALESCE(notes, ''), IF(notes IS NOT NULL AND notes != '', ' | ', ''), ?)`];
        const updateParams = [settleNote];
        if (includePaidAtSettle) {
          updateFields.push("paid_at = NOW()");
        }
        await pool.query(
          `UPDATE reservations SET ${updateFields.join(', ')} WHERE id = ?`,
          [...updateParams, id]
        );
        paymentSettled = true;
      }

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action:
          nextStatus === "approved"
            ? "APPROVE_RESERVATION"
            : nextStatus === "rejected"
            ? "REJECT_RESERVATION"
            : nextStatus === "checked_in"
            ? "CHECKIN_RESERVATION"
            : nextStatus === "completed"
            ? "COMPLETE_RESERVATION"
            : nextStatus === "no_show"
            ? "NOSHOW_RESERVATION"
            : "CANCEL_RESERVATION",
        entity: "reservations",
        entity_id: id,
        details: { reservation_id: id, new_status: nextStatus, payment_settled: paymentSettled || undefined },
        ...auditContext(req),
      });

      const customerUserId = Number(current.customer_user_id || 0);
      if (customerUserId > 0) {
        try {
          const [[barRow]] = await pool.query(
            "SELECT name FROM bars WHERE id = ? LIMIT 1",
            [barId]
          );
          const barName = barRow?.name || 'the bar';

          const statusMeta =
            nextStatus === 'approved'
              ? {
                  type: 'reservation_approved',
                  title: 'Reservation Approved',
                  message: `Your reservation at ${barName} has been approved.`,
                }
              : nextStatus === 'rejected'
              ? {
                  type: 'reservation_rejected',
                  title: 'Reservation Rejected',
                  message: `Your reservation at ${barName} has been rejected.`,
                }
              : nextStatus === 'checked_in'
              ? {
                  type: 'reservation_checked_in',
                  title: 'Reservation Checked In',
                  message: `Your reservation at ${barName} has been checked in.`,
                }
              : nextStatus === 'completed'
              ? {
                  type: 'reservation_completed',
                  title: 'Reservation Completed',
                  message: `Your reservation at ${barName} has been marked as completed.`,
                }
              : nextStatus === 'no_show'
              ? {
                  type: 'reservation_no_show',
                  title: 'Reservation Marked No-Show',
                  message: `Your reservation at ${barName} has been marked as no-show.`,
                }
              : {
                  type: 'reservation_cancelled',
                  title: 'Reservation Cancelled',
                  message: `Your reservation at ${barName} has been cancelled.`,
                };

          const reservationDate = current.reservation_date
            ? new Date(current.reservation_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : '';
          const reservationTime = current.reservation_time
            ? formatTo12HourTime(current.reservation_time)
            : '';
          const scheduleSuffix = reservationDate
            ? ` (${reservationDate}${reservationTime ? ` at ${reservationTime}` : ''})`
            : '';

          await createNotification({
            userIds: customerUserId,
            type: statusMeta.type,
            title: statusMeta.title,
            message: `${statusMeta.message}${scheduleSuffix}`,
            referenceType: "reservation",
            referenceId: id,
            category: "reservation",
            action: "navigate",
            targetRoute: "/reservations",
          });

          // Mirror email, best-effort: never blocks the status change.
          try {
            const { notifyCustomer } = require("../utils/notifyCustomer");
            await notifyCustomer(customerUserId, "reservation_status", {
              barName,
              status: nextStatus,
              when: scheduleSuffix.replace(/^[\s()]+|[\s()]+$/g, ""),
            });
          } catch (_) {}

          // Also notify the bar team of the status change (not just new reservations)
          try {
            await createNotification({
              barId,
              type: `reservation_${nextStatus}`,
              title: `Reservation ${nextStatus}`,
              message: `Reservation #${id} at ${barName} is now ${nextStatus}.`,
              referenceType: "reservation",
              referenceId: id,
              category: "reservation",
              action: "navigate",
              targetRoute: "/reservations",
              excludeUserId: customerUserId,
            });
          } catch (e) {
            console.error("bar-team reservation status notification failed:", e.message);
          }

          triggerPushDispatch('reservation-status-update');
        } catch (notifErr) {
          console.error('Failed to create reservation status notification:', notifErr);
        }
      }

      return res.json({
        success: true,
        message: `Reservation ${nextStatus}`,
        payment_settled: paymentSettled || false,
      });
    } catch (err) {
      console.error("OWNER UPDATE RESERVATION ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// --------------------------
// PUBLIC: Guest reservation request (no auth required)
// --------------------------
router.post("/reservations/guest", async (req, res) => {
  try {
    const { full_name, phone, email, venue, date, time, guests, occasion, notes } = req.body || {};

    if (!full_name || !email || !venue || !date || !time) {
      return res.status(400).json({ success: false, message: "Full name, email, venue, date, and time are required" });
    }

    const partySize = guests ? Number(guests) : 1;
    const normalizedGuestDate = normalizeReservationDateInput(date);
    if (!normalizedGuestDate) {
      return res.status(400).json({ success: false, message: "Invalid reservation date" });
    }
    if (isPastReservationDate(normalizedGuestDate)) {
      return res.status(400).json({ success: false, message: "Past reservation dates are not allowed." });
    }

    const normalizedGuestTime = normalizeReservationHourInput(time);
    if (!normalizedGuestTime) {
      return res.status(400).json({ success: false, message: "time must be on the hour (HH:00)." });
    }

    const includeReservationMode = await hasReservationModeColumn();

    // Resolve bar by name
    const [bars] = await pool.query(
      includeReservationMode
        ? "SELECT id, reservation_mode FROM bars WHERE name = ? AND status = 'active' LIMIT 1"
        : "SELECT id, NULL AS reservation_mode FROM bars WHERE name = ? AND status = 'active' LIMIT 1",
      [venue]
    );
    const barId = bars.length ? bars[0].id : null;
    const reservationMode = String(bars[0]?.reservation_mode || "manual_approval").toLowerCase();
    const initialStatus = reservationMode === "auto_accept" ? "approved" : "pending";

    const [result] = await pool.query(
      `INSERT INTO reservations
       (bar_id, guest_name, guest_email, guest_phone, reservation_date, reservation_time, party_size, occasion, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [barId, full_name, email, phone || null, normalizedGuestDate, normalizedGuestTime, partySize, occasion || null, notes || null, initialStatus]
    );

    try {
      const insertedCount = await notifyBarTeamReservationCreated({
        barId,
        reservationId: result.insertId,
        reservationDate: normalizedGuestDate,
        reservationTime: normalizedGuestTime,
        partySize,
        initialStatus,
        guestName: full_name,
      });
      if (insertedCount > 0) {
        triggerPushDispatch('guest-reservation-created');
      }
    } catch (teamNotifErr) {
      console.error("Failed to create guest reservation notifications for bar team:", teamNotifErr);
    }

    return res.status(201).json({
      success: true,
      message: initialStatus === "approved"
        ? "Reservation submitted and auto-approved."
        : "Reservation request submitted successfully. We'll confirm shortly.",
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error("GUEST RESERVATION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH /owner/reservations/:id/mark-balance-paid
// Bar manager marks remaining balance as collected in person (cash)
router.patch(
  "/owner/reservations/:id/mark-balance-paid",
  requireAuth,
  requirePermission("reservation_manage"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid reservation id" });

      const includePaidAt = await hasReservationPaidAtColumn();

      const [rows] = await pool.query(
        `SELECT r.id, r.bar_id, r.payment_status, r.status, r.deposit_amount,
                r.transaction_number,
                COALESCE(t.price, 0) + COALESCE((
                  SELECT SUM(ri.quantity * ri.unit_price)
                  FROM reservation_items ri WHERE ri.reservation_id = r.id
                ), 0) AS total_amount
         FROM reservations r
         LEFT JOIN bar_tables t ON t.id = r.table_id
         WHERE r.id = ? AND r.bar_id = ? LIMIT 1`,
        [id, barId]
      );

      if (!rows.length) return res.status(404).json({ success: false, message: "Reservation not found" });
      const r = rows[0];

      if (r.payment_status === "paid") {
        return res.status(400).json({ success: false, message: "Balance is already fully paid" });
      }

      const allowedStatuses = ["approved", "confirmed", "paid", "checked_in"];
      if (!allowedStatuses.includes(r.status)) {
        return res.status(400).json({ success: false, message: "Cannot mark balance paid for this reservation status" });
      }

      const balanceDue = Math.max(0, Number(r.total_amount || 0) - Number(r.deposit_amount || 0));

      const note = `Balance ₱${balanceDue.toFixed(2)} collected in person (cash) by staff`;

      if (includePaidAt) {
        await pool.query(
          `UPDATE reservations SET payment_status = 'paid', paid_at = NOW(),
           notes = CONCAT(COALESCE(notes, ''), IF(notes IS NOT NULL AND notes != '', ' | ', ''), ?)
           WHERE id = ?`,
          [note, id]
        );
      } else {
        await pool.query(
          `UPDATE reservations SET payment_status = 'paid',
           notes = CONCAT(COALESCE(notes, ''), IF(notes IS NOT NULL AND notes != '', ' | ', ''), ?)
           WHERE id = ?`,
          [note, id]
        );
      }

      logAudit && logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "MARK_BALANCE_PAID",
        entity: "reservations",
        entity_id: id,
        details: { balance_due: balanceDue, transaction_number: r.transaction_number },
      });

      return res.json({ success: true, message: `Balance of ₱${balanceDue.toFixed(2)} marked as paid in cash.` });
    } catch (err) {
      console.error("MARK BALANCE PAID ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
