const express = require("express");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const { logAudit, logPlatformAudit, auditContext } = require("../utils/audit");
const { sendBarApprovalEmail } = require("../utils/emailService");
const { createNotification } = require("../utils/notificationService");

const {
  REGISTRATION_DOC_KEYS,
  REGISTRATION_DOC_LABELS,
  PORTAL_TYPES_BY_REGISTRATION_KEY,
  COMPLIANCE_DOCUMENTS,
  REQUIRED_COUNT: COMPLIANCE_REQUIRED_COUNT,
} = require("../config/requiredPermits");
const {
  resolveComplianceDocuments,
  resolveComplianceRegistrationId,
} = require("../utils/complianceDocuments");

// Required permits for a registration (Permit Checking panel + approval gate).
// Both lists come from config/requiredPermits.js — the same file the Bar Owner
// form loads, so the two sides can never drift apart.
const REQUIRED_REGISTRATION_DOCUMENTS = REGISTRATION_DOC_KEYS;

const ALLOWED_REGISTRATION_DOCUMENT_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".pdf"]);

const SERVER_ROOT = path.resolve(__dirname, "..");

// Stored values come as relative paths (uploads/...), localhost URLs or full
// URLs — normalise them to something fs can stat.
function registrationDocLocalPath(filePath) {
  if (!filePath) return null;
  const raw = String(filePath).trim();
  if (!raw) return null;
  let rel = raw.replace(/^https?:\/\/[^/]+/i, "").split("?")[0];
  try { rel = decodeURIComponent(rel); } catch (_) { /* keep raw */ }
  rel = rel.replace(/^\/+/, "");
  if (!rel) return null;
  return path.resolve(SERVER_ROOT, rel);
}

function registrationDocExists(filePath) {
  const local = registrationDocLocalPath(filePath);
  if (!local) return false;
  try { return fs.statSync(local).isFile(); } catch (_) { return false; }
}

// Link handed to the admin UI: relative paths stay relative (the frontend
// prefixes its API base), absolute URLs keep a working origin.
function registrationDocUrl(filePath) {
  if (!filePath) return null;
  const raw = String(filePath).trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return raw;
  const backend = process.env.BACKEND_URL;
  if (backend) return raw.replace(/^https?:\/\/[^/]+/i, backend.replace(/\/+$/, ""));
  if (/localhost/i.test(raw) && process.env.NODE_ENV === "production") {
    return raw.replace(/^https?:\/\/[^/]+/i, "https://api.thepartygoers.fun");
  }
  return raw;
}

function registrationDocFileName(filePath) {
  if (!filePath) return null;
  return path.basename(String(filePath).split("?")[0].replace(/\\/g, "/"));
}

/**
 * Actual file for every required permit of a registration: the owner portal
 * submission first (bar_registration_documents), then the legacy column.
 * Returns { bir_certificate: "uploads/..." | null, ... }.
 */
async function resolveRegistrationDocumentFiles(registrationId, registrationRow) {
  const files = {};
  REQUIRED_REGISTRATION_DOCUMENTS.forEach((documentType) => { files[documentType] = null; });
  try {
    const [docRows] = await pool.query(
      `SELECT document_type, file_path FROM bar_registration_documents
        WHERE registration_id = ? AND file_path IS NOT NULL AND file_path != ''
        ORDER BY id DESC`,
      [registrationId]
    );
    const portalByType = new Map();
    docRows.forEach((row) => {
      if (!portalByType.has(row.document_type)) portalByType.set(row.document_type, row.file_path);
    });
    for (const documentType of REQUIRED_REGISTRATION_DOCUMENTS) {
      const aliases = PORTAL_TYPES_BY_REGISTRATION_KEY[documentType] || [documentType];
      const fromPortal = aliases.map((alias) => portalByType.get(alias)).find(Boolean);
      files[documentType] = fromPortal || (registrationRow ? registrationRow[documentType] : null) || null;
    }
  } catch (err) {
    console.error("resolveRegistrationDocumentFiles failed:", err.message);
  }
  return files;
}

/**
 * One permit row for the admin panel. Status is DERIVED FROM THE FILE so an
 * item can never read "missing" when a file is actually on record:
 *   no path / file not in storage -> "missing"
 *   file on record                -> last review status, or "pending"
 *
 * A stored review that claims the file is absent is stale (the owner uploaded
 * after that check ran) — it is reported as pending, never as "no file on
 * record", so a live View Document link can never contradict the status.
 */
const FILE_BACKED_REVIEW_STATUSES = new Set(["pending", "approved", "rejected", "manual_review"]);

function buildRegistrationDocumentView(documentType, filePath, review) {
  const present = Boolean(filePath && String(filePath).trim());
  const exists = present && registrationDocExists(filePath);

  let status = "missing";
  let notes = null;
  let staleReview = false;

  if (!present) {
    notes = "No file is on record for this permit.";
  } else if (!exists) {
    notes = "A file path is recorded but the file is missing from storage.";
  } else if (review && FILE_BACKED_REVIEW_STATUSES.has(review.status)) {
    status = review.status;
    notes = review.notes;
  } else if (review) {
    status = "pending";
    notes = "File on record — the previous check ran before this file was uploaded, so the review was reset.";
    staleReview = true;
  } else {
    status = "pending";
    notes = "File on record — awaiting review.";
  }

  return {
    document_type: documentType,
    label: REGISTRATION_DOC_LABELS[documentType] || documentType.replaceAll("_", " "),
    file_present: present,
    file_exists: exists,
    file_path: present ? filePath : null,
    file_url: present ? registrationDocUrl(filePath) : null,
    file_name: registrationDocFileName(filePath),
    status,
    stale_review: staleReview,
    check_method: staleReview ? null : (review ? review.check_method : null),
    notes,
    checked_by: staleReview ? null : (review ? review.checked_by : null),
    checked_at: staleReview ? null : (review ? review.checked_at : null),
  };
}

async function buildRegistrationDocumentViews(registrationId, registrationRow, reviews) {
  const files = await resolveRegistrationDocumentFiles(registrationId, registrationRow);
  const reviewMap = new Map((reviews || []).map((review) => [review.document_type, review]));
  return REQUIRED_REGISTRATION_DOCUMENTS.map((documentType) =>
    buildRegistrationDocumentView(documentType, files[documentType], reviewMap.get(documentType) || null)
  );
}

let triggerPushDispatch = () => {};
try {
  ({ triggerPushDispatch } = require("../utils/triggerPushDispatch"));
} catch (_) {
  // Keep announcement creation non-fatal on older deployments without push-dispatch utility.
}

const tableImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/tables";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `table_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});

const tableImageUpload = multer({ storage: tableImageStorage, limits: { fileSize: 5 * 1024 * 1024 } });

let hasLifecycleStatusCache = null;
let hasGlobalBanColumnsCache = null;
let hasUserBanReasonColumnCache = null;
let hasBarSuspensionMessageColumnCache = null;
let hasParentBarIdColumnCache = null;
let hasCustomerBarBanReasonColumnCache = null;

async function hasUserBanReasonColumn() {
  if (hasUserBanReasonColumnCache !== null) return hasUserBanReasonColumnCache;
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM users LIKE 'ban_reason'");
    hasUserBanReasonColumnCache = rows.length > 0;
    return hasUserBanReasonColumnCache;
  } catch (_) {
    hasUserBanReasonColumnCache = false;
    return false;
  }
}

async function hasBarSuspensionMessageColumn() {
  if (hasBarSuspensionMessageColumnCache !== null) return hasBarSuspensionMessageColumnCache;
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM bars LIKE 'suspension_message'");
    hasBarSuspensionMessageColumnCache = rows.length > 0;
    return hasBarSuspensionMessageColumnCache;
  } catch (_) {
    hasBarSuspensionMessageColumnCache = false;
    return false;
  }
}

async function hasGlobalBanColumns() {
  if (hasGlobalBanColumnsCache !== null) return hasGlobalBanColumnsCache;
  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME IN ('is_banned', 'banned_at', 'banned_by')`
    );
    const names = new Set(rows.map((r) => r.COLUMN_NAME));
    hasGlobalBanColumnsCache =
      names.has("is_banned") && names.has("banned_at") && names.has("banned_by");
    return hasGlobalBanColumnsCache;
  } catch (_) {
    hasGlobalBanColumnsCache = false;
    return false;
  }
}

async function hasLifecycleStatusColumn() {
  if (hasLifecycleStatusCache !== null) return hasLifecycleStatusCache;
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM bars LIKE 'lifecycle_status'");
    hasLifecycleStatusCache = rows.length > 0;
    return hasLifecycleStatusCache;
  } catch (_) {
    hasLifecycleStatusCache = false;
    return false;
  }
}

async function hasParentBarIdColumn() {
  if (hasParentBarIdColumnCache !== null) return hasParentBarIdColumnCache;
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM bars LIKE 'parent_bar_id'");
    hasParentBarIdColumnCache = rows.length > 0;
    return hasParentBarIdColumnCache;
  } catch (_) {
    hasParentBarIdColumnCache = false;
    return false;
  }
}

async function hasCustomerBarBanReasonColumn() {
  if (hasCustomerBarBanReasonColumnCache !== null) return hasCustomerBarBanReasonColumnCache;
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM customer_bar_bans LIKE 'ban_reason'");
    hasCustomerBarBanReasonColumnCache = rows.length > 0;
    return hasCustomerBarBanReasonColumnCache;
  } catch (_) {
    hasCustomerBarBanReasonColumnCache = false;
    return false;
  }
}

function toLifecycle(status) {
  if (status === "inactive") return "suspended";
  return status;
}

function asLikeTerm(value) {
  return `%${String(value || "").trim()}%`;
}

const INVALID_ANNOUNCEMENT_DATETIME = Symbol("invalid_announcement_datetime");

function pad2(value) {
  return String(value).padStart(2, "0");
}

function toMySQLDateTimeUTC(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

function normalizeAnnouncementDateTimeInput(value) {
  if (value === undefined || value === null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  let parsed;
  const hasExplicitTimezone = /Z|[+-]\d{2}:?\d{2}$/i.test(raw);
  const isNaiveDateTime = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw);

  if (!hasExplicitTimezone && isNaiveDateTime) {
    // Treat datetime-local values as Asia/Manila and convert to UTC for storage.
    const normalized = raw.replace(" ", "T");
    const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
    parsed = new Date(`${withSeconds}+08:00`);
  } else {
    parsed = new Date(raw);
  }

  if (Number.isNaN(parsed.getTime())) {
    return INVALID_ANNOUNCEMENT_DATETIME;
  }

  return toMySQLDateTimeUTC(parsed);
}

async function ensureSuperAdmin(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [req.user.id]
    );

    const roleName = rows[0]?.role_name;
    if (String(roleName || '').trim().toUpperCase() !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    req.user.role_name = roleName;
    return next();
  } catch (err) {
    console.error("SUPER_ADMIN CHECK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

router.use(requireAuth, ensureSuperAdmin);

// Session validation for app boot (token check + fresh role). Lightweight:
// requireAuth above already verified the token, resolved the user row, and
// enforced active/ban/maintenance gates, so just echo the identity back.
router.get("/me", async (req, res) => {
  try {
    const u = req.user || {};
    return res.json({
      success: true,
      data: {
        id: u.id ?? null,
        email: u.email ?? null,
        role: u.role_name || u.role || null,
        first_name: u.first_name ?? null,
        last_name: u.last_name ?? null,
      },
    });
  } catch (err) {
    console.error("SA ME ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── SUPER ADMIN ACCOUNT MANAGEMENT ──────────────────────────────────
router.get("/accounts", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "all").toLowerCase();
    const where = ["LOWER(u.role) = 'super_admin'"];
    const params = [];

    if (q) {
      where.push("(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)");
      const term = asLikeTerm(q);
      params.push(term, term, term);
    }
    if (status === "active") where.push("u.is_active = 1");
    if (status === "disabled" || status === "inactive") where.push("u.is_active = 0");

    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.created_at, u.updated_at,
              r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE ${where.join(" AND ")}
       ORDER BY u.id DESC
       LIMIT 300`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA LIST SUPER ADMIN ACCOUNTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/accounts", async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body || {};
    if (!first_name || !last_name || !email || !password || String(password).length < 8) {
      return res.status(400).json({ success: false, message: "first_name, last_name, email, password(>=8) are required" });
    }

    const [exists] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (exists.length) return res.status(409).json({ success: false, message: "Email already exists" });

    const [roleRows] = await pool.query("SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1");
    if (!roleRows.length) return res.status(500).json({ success: false, message: "SUPER_ADMIN role not found" });

    const hashed = await bcrypt.hash(password, 10);
    const [ins] = await pool.query(
      `INSERT INTO users
       (first_name, last_name, email, password, role, role_id, is_active, bar_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'super_admin', ?, 1, NULL, NOW(), NOW())`,
      [first_name, last_name, email, hashed, roleRows[0].id]
    );

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "CREATE_SUPER_ADMIN_ACCOUNT",
      entity: "user",
      entity_id: ins.insertId,
      details: { email },
      ...auditContext(req),
    });

    return res.status(201).json({ success: true, message: "Super Admin account created", data: { id: ins.insertId } });
  } catch (err) {
    console.error("SA CREATE SUPER ADMIN ACCOUNT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/accounts/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid user id" });

    const [found] = await pool.query("SELECT id FROM users WHERE id = ? AND LOWER(role) = 'super_admin' LIMIT 1", [userId]);
    if (!found.length) return res.status(404).json({ success: false, message: "Super Admin account not found" });

    const updates = [];
    const params = [];
    const fields = ["first_name", "last_name", "email"];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }
    if (req.body.is_active !== undefined) {
      updates.push("is_active = ?");
      params.push(Number(req.body.is_active) ? 1 : 0);
    }

    if (!updates.length) return res.status(400).json({ success: false, message: "No fields to update" });

    updates.push("updated_at = NOW()");
    params.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UPDATE_SUPER_ADMIN_ACCOUNT",
      entity: "user",
      entity_id: userId,
      details: { fields: Object.keys(req.body || {}) },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Super Admin account updated" });
  } catch (err) {
    console.error("SA UPDATE SUPER ADMIN ACCOUNT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/accounts/:id/reset-password", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const newPassword = String(req.body?.new_password || "");
    if (!userId || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Valid id and new_password(>=8) are required" });
    }

    const [found] = await pool.query("SELECT id FROM users WHERE id = ? AND LOWER(role) = 'super_admin' LIMIT 1", [userId]);
    if (!found.length) return res.status(404).json({ success: false, message: "Super Admin account not found" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?", [hashed, userId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "RESET_SUPER_ADMIN_PASSWORD",
      entity: "user",
      entity_id: userId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Super Admin password reset" });
  } catch (err) {
    console.error("SA RESET SUPER ADMIN PASSWORD ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/dashboard/summary", async (req, res) => {
  try {
    const [[barsCount]] = await pool.query(
      `SELECT
         COUNT(*) AS total_bars,
         SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active_bars,
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_bars,
         SUM(CASE WHEN status='inactive' THEN 1 ELSE 0 END) AS suspended_bars
       FROM bars`
    );

    const [[usersCount]] = await pool.query("SELECT COUNT(*) AS total_users FROM users");
    const [[reservationsCount]] = await pool.query("SELECT COUNT(*) AS total_reservations FROM reservations");
    const [[eventsCount]] = await pool.query("SELECT COUNT(*) AS total_events FROM bar_events");
    const [[eventSocialCount]] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM event_likes) AS total_event_likes,
         (SELECT COUNT(*) FROM event_comments WHERE status = 'active') AS total_event_comments`
    );
    const [[revenueCount]] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total_revenue
       FROM pos_orders
       WHERE status = 'completed'`
    );
    const [[subsCount]] = await pool.query(
      `SELECT 
         COUNT(*) AS total_subscriptions,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_subscriptions,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_subscriptions,
         SUM(CASE WHEN status = 'cancelled' OR status = 'expired' THEN 1 ELSE 0 END) AS inactive_subscriptions
       FROM subscriptions`
    );
    const [[activeUsersCount]] = await pool.query(
      `SELECT COUNT(*) AS active_users FROM users WHERE is_active = 1`
    );
    const [popularEvents] = await pool.query(
      `SELECT be.id, be.title, be.bar_id, b.name AS bar_name,
              (SELECT COUNT(*) FROM event_likes el WHERE el.event_id = be.id) AS like_count,
              (SELECT COUNT(*) FROM event_comments ec WHERE ec.event_id = be.id AND ec.status = 'active') AS comment_count
       FROM bar_events be
       LEFT JOIN bars b ON b.id = be.bar_id
       ORDER BY like_count DESC, comment_count DESC, be.id DESC
       LIMIT 5`
    );

    return res.json({
      success: true,
      data: {
        total_bars: barsCount.total_bars || 0,
        active_bars: barsCount.active_bars || 0,
        pending_bars: barsCount.pending_bars || 0,
        suspended_bars: barsCount.suspended_bars || 0,
        total_users: usersCount.total_users || 0,
        active_users: activeUsersCount.active_users || 0,
        total_reservations: reservationsCount.total_reservations || 0,
        total_events: eventsCount.total_events || 0,
        total_event_likes: eventSocialCount.total_event_likes || 0,
        total_event_comments: eventSocialCount.total_event_comments || 0,
        total_revenue: Number(revenueCount.total_revenue || 0),
        total_subscriptions: subsCount.total_subscriptions || 0,
        active_subscriptions: subsCount.active_subscriptions || 0,
        pending_subscriptions: subsCount.pending_subscriptions || 0,
        inactive_subscriptions: subsCount.inactive_subscriptions || 0,
        popular_events: popularEvents,
      },
    });
  } catch (err) {
    console.error("SUPER ADMIN SUMMARY ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 30), 100);
    const [rows] = await pool.query(
      `SELECT a.id, a.bar_id, a.user_id, a.action, a.entity, a.entity_id, a.details, a.created_at,
              b.name AS bar_name,
              CONCAT(u.first_name, ' ', u.last_name) AS actor_name,
              u.email AS actor_email
       FROM audit_logs a
       LEFT JOIN bars b ON b.id = a.bar_id
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.id DESC
       LIMIT ${limit}`
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SUPER ADMIN RECENT ACTIVITY ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/bars", async (req, res) => {
  try {
    const { status, q } = req.query;
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const hasParentBarId = await hasParentBarIdColumn();

    const where = [];
    const params = [];

    if (status) {
      where.push("b.status = ?");
      params.push(status === "suspended" ? "inactive" : status);
    }
    if (q) {
      where.push("(b.name LIKE ? OR b.city LIKE ? OR u.email LIKE ?)");
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    const [rows] = await pool.query(
      `SELECT b.id, b.name, b.address, b.city, b.phone, b.email, b.status,
              ${hasParentBarId ? "b.parent_bar_id" : "NULL AS parent_bar_id"},
              b.latitude, b.longitude, b.logo_path, b.video_path,
              b.monday_hours, b.tuesday_hours, b.wednesday_hours, b.thursday_hours,
              b.friday_hours, b.saturday_hours, b.sunday_hours,
              b.created_at, b.updated_at,
              b.paymongo_mode, b.paymongo_test_connected,
              b.paymongo_onboarding_status, b.paymongo_child_merchant_id,
              b.stripe_account_id, b.stripe_onboarding_status,
              ${hasParentBarId ? "pb.name AS parent_bar_name" : "NULL AS parent_bar_name"},
              bo.id AS bar_owner_id,
              u.id AS owner_user_id,
              CONCAT(u.first_name, ' ', u.last_name) AS owner_name,
              u.email AS owner_email,
              u.is_active AS owner_is_active
       FROM bars b
       ${hasParentBarId ? "LEFT JOIN bars pb ON pb.id = b.parent_bar_id" : ""}
       LEFT JOIN bar_owners bo ON bo.id = b.owner_id
       LEFT JOIN users u ON u.id = bo.user_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY b.id DESC
       LIMIT ${limit}`,
      params
    );

    const data = rows.map((row) => ({ ...row, lifecycle_status: toLifecycle(row.status), latitude: row.latitude ?? null, longitude: row.longitude ?? null }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error("SUPER ADMIN BARS LIST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/bars/:id", async (req, res) => {
  try {
    const barId = Number(req.params.id);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    const [rows] = await pool.query(
      `SELECT b.*, bo.id AS bar_owner_id,
              bo.business_name, bo.business_email, bo.business_phone,
              u.id AS owner_user_id,
              u.first_name, u.last_name, u.email AS owner_email, u.is_active AS owner_is_active
       FROM bars b
       LEFT JOIN bar_owners bo ON bo.id = b.owner_id
       LEFT JOIN users u ON u.id = bo.user_id
       WHERE b.id = ?
       LIMIT 1`,
      [barId]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Bar not found" });

    const row = rows[0];
    return res.json({ success: true, data: { ...row, lifecycle_status: toLifecycle(row.status) } });
  } catch (err) {
    console.error("SUPER ADMIN BAR DETAIL ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/bars/:id", async (req, res) => {
  try {
    const barId = Number(req.params.id);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    const allowed = [
      "name",
      "description",
      "address",
      "city",
      "state",
      "zip_code",
      "phone",
      "email",
      "website",
      "category",
      "price_range",
      "image_path",
      "logo_path",
      "video_path",
      "monday_hours",
      "tuesday_hours",
      "wednesday_hours",
      "thursday_hours",
      "friday_hours",
      "saturday_hours",
      "sunday_hours",
      "latitude",
      "longitude",
    ];

    const updates = [];
    const params = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    updates.push("updated_at = NOW()");
    params.push(barId);

    await pool.query(`UPDATE bars SET ${updates.join(", ")} WHERE id = ?`, params);

    await logAudit(null, {
      bar_id: barId,
      user_id: req.user.id,
      action: "SUPER_ADMIN_UPDATE_BAR",
      entity: "bar",
      entity_id: barId,
      details: { fields: Object.keys(req.body || {}) },
      ...auditContext(req),
    });

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UPDATE_BAR",
      entity: "bar",
      entity_id: barId,
      target_bar_id: barId,
      details: { fields: Object.keys(req.body || {}) },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Bar updated" });
  } catch (err) {
    console.error("SUPER ADMIN UPDATE BAR ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

async function setBarLifecycle(barId, nextStatus) {
  const hasLifecycle = await hasLifecycleStatusColumn();

  const updates = ["status = ?", "updated_at = NOW()"];
  const params = [nextStatus, barId];
  if (hasLifecycle) {
    updates.unshift("lifecycle_status = ?");
    params.unshift(toLifecycle(nextStatus));
  }

  const [result] = await pool.query(`UPDATE bars SET ${updates.join(", ")} WHERE id = ?`, params);
  return Number(result?.affectedRows || 0);
}

router.post("/bars/:id/approve", async (req, res) => {
  try {
    const barId = Number(req.params.id);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    const affectedRows = await setBarLifecycle(barId, "active");
    if (!affectedRows) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }

    await logAudit(null, {
      bar_id: barId,
      user_id: req.user.id,
      action: "SUPER_ADMIN_APPROVE_BAR",
      entity: "bar",
      entity_id: barId,
      details: null,
      ...auditContext(req),
    });

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "APPROVE_BAR",
      entity: "bar",
      entity_id: barId,
      target_bar_id: barId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Bar approved" });
  } catch (err) {
    console.error("SUPER ADMIN APPROVE BAR ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/bars/:id/suspend", async (req, res) => {
  try {
    const barId = Number(req.params.id);
    const suspensionMessage = String(req.body?.message || req.body?.reason || "").trim();
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });
    if (!suspensionMessage) {
      return res.status(400).json({ success: false, message: "Reason is required when deactivating a bar" });
    }

    const affectedRows = await setBarLifecycle(barId, "inactive");
    if (!affectedRows) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }
    if (await hasBarSuspensionMessageColumn()) {
      await pool.query(
        "UPDATE bars SET suspension_message = ?, updated_at = NOW() WHERE id = ?",
        [suspensionMessage, barId]
      );
    }

    await logAudit(null, {
      bar_id: barId,
      user_id: req.user.id,
      action: "SUPER_ADMIN_SUSPEND_BAR",
      entity: "bar",
      entity_id: barId,
      details: { reason: suspensionMessage || null },
      ...auditContext(req),
    });

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "SUSPEND_BAR",
      entity: "bar",
      entity_id: barId,
      target_bar_id: barId,
      details: { reason: suspensionMessage || null },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Bar suspended" });
  } catch (err) {
    console.error("SUPER ADMIN SUSPEND BAR ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/bars/:id/reactivate", async (req, res) => {
  try {
    const barId = Number(req.params.id);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    const affectedRows = await setBarLifecycle(barId, "active");
    if (!affectedRows) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }
    if (await hasBarSuspensionMessageColumn()) {
      await pool.query("UPDATE bars SET suspension_message = NULL, updated_at = NOW() WHERE id = ?", [barId]);
    }

    await logAudit(null, {
      bar_id: barId,
      user_id: req.user.id,
      action: "SUPER_ADMIN_REACTIVATE_BAR",
      entity: "bar",
      entity_id: barId,
      details: null,
      ...auditContext(req),
    });

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "REACTIVATE_BAR",
      entity: "bar",
      entity_id: barId,
      target_bar_id: barId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Bar reactivated" });
  } catch (err) {
    console.error("SUPER ADMIN REACTIVATE BAR ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/owners", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      phone_number,
      business_name,
      business_email,
      business_phone,
      bar_id,
    } = req.body || {};

    if (!first_name || !last_name || !email || !password || !business_name) {
      return res.status(400).json({
        success: false,
        message: "first_name, last_name, email, password, business_name are required",
      });
    }

    await conn.beginTransaction();

    const [exists] = await conn.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (exists.length) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const [roleRows] = await conn.query("SELECT id FROM roles WHERE name = 'BAR_OWNER' LIMIT 1");
    if (!roleRows.length) {
      await conn.rollback();
      return res.status(500).json({ success: false, message: "BAR_OWNER role not found" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [userIns] = await conn.query(
      `INSERT INTO users
       (first_name, last_name, email, password, phone_number, role, role_id, is_active, bar_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'bar_owner', ?, 1, NULL, NOW(), NOW())`,
      [first_name, last_name, email, hashed, phone_number || null, roleRows[0].id]
    );

    const ownerUserId = userIns.insertId;

    const [boIns] = await conn.query(
      `INSERT INTO bar_owners
       (user_id, business_name, business_email, business_phone, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [ownerUserId, business_name, business_email || null, business_phone || null]
    );

    if (bar_id) {
      const targetBarId = Number(bar_id);
      const [barRows] = await conn.query("SELECT id FROM bars WHERE id = ? LIMIT 1", [targetBarId]);
      if (!barRows.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Target bar not found" });
      }

      await conn.query("UPDATE users SET bar_id = ? WHERE id = ?", [targetBarId, ownerUserId]);
      await conn.query("UPDATE bars SET owner_id = ?, updated_at = NOW() WHERE id = ?", [boIns.insertId, targetBarId]);
    }

    await conn.commit();

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "CREATE_OWNER",
      entity: "user",
      entity_id: ownerUserId,
      target_bar_id: bar_id ? Number(bar_id) : null,
      details: { email },
      ...auditContext(req),
    });

    return res.status(201).json({
      success: true,
      message: "Bar owner created",
      data: {
        owner_user_id: ownerUserId,
        bar_owner_id: boIns.insertId,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error("SUPER ADMIN CREATE OWNER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

router.post("/owners/:userId/reset-password", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { new_password } = req.body || {};
    if (!userId || !new_password || String(new_password).length < 6) {
      return res.status(400).json({ success: false, message: "Valid userId and new_password(>=6) required" });
    }

    const [rows] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? AND role = 'bar_owner' LIMIT 1",
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Bar owner not found" });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?", [hashed, userId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "RESET_OWNER_PASSWORD",
      entity: "user",
      entity_id: userId,
      details: null,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Owner password reset" });
  } catch (err) {
    console.error("SUPER ADMIN RESET OWNER PASSWORD ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/owners/:userId/disable", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid user id" });

    const [rows] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? AND role = 'bar_owner' LIMIT 1",
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Bar owner not found" });

    await pool.query("UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?", [userId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "DISABLE_OWNER",
      entity: "user",
      entity_id: userId,
      details: { reason: req.body?.reason || null },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Owner disabled" });
  } catch (err) {
    console.error("SUPER ADMIN DISABLE OWNER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/owners/:userId/enable", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid user id" });

    const [rows] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? AND role = 'bar_owner' LIMIT 1",
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Bar owner not found" });

    await pool.query("UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?", [userId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "ENABLE_OWNER",
      entity: "user",
      entity_id: userId,
      details: null,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Owner enabled" });
  } catch (err) {
    console.error("SUPER ADMIN ENABLE OWNER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/owners/:userId/transfer", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = Number(req.params.userId);
    const targetBarId = Number(req.body?.target_bar_id);
    if (!userId || !targetBarId) {
      return res.status(400).json({ success: false, message: "userId and target_bar_id are required" });
    }

    await conn.beginTransaction();

    const [ownerRows] = await conn.query(
      `SELECT u.id, u.role, u.first_name, u.last_name, u.email, bo.id AS bar_owner_id
       FROM users u
       LEFT JOIN bar_owners bo ON bo.user_id = u.id
       WHERE u.id = ? AND u.role = 'bar_owner'
       LIMIT 1`,
      [userId]
    );
    if (!ownerRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Bar owner not found" });
    }

    const owner = ownerRows[0];
    let barOwnerId = owner.bar_owner_id;

    if (!barOwnerId) {
      const [boIns] = await conn.query(
        `INSERT INTO bar_owners (user_id, business_name, business_email, created_at)
         VALUES (?, ?, ?, NOW())`,
        [userId, `${owner.first_name} ${owner.last_name} Business`, owner.email]
      );
      barOwnerId = boIns.insertId;
    }

    const [barRows] = await conn.query("SELECT id FROM bars WHERE id = ? LIMIT 1", [targetBarId]);
    if (!barRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Target bar not found" });
    }

    await conn.query("UPDATE bars SET owner_id = ?, updated_at = NOW() WHERE id = ?", [barOwnerId, targetBarId]);
    await conn.query("UPDATE users SET bar_id = ?, updated_at = NOW() WHERE id = ?", [targetBarId, userId]);

    await conn.commit();

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "TRANSFER_OWNERSHIP",
      entity: "bar",
      entity_id: targetBarId,
      target_bar_id: targetBarId,
      details: { new_owner_user_id: userId },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Ownership transferred" });
  } catch (err) {
    await conn.rollback();
    console.error("SUPER ADMIN TRANSFER OWNERSHIP ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

router.get("/audit-logs", async (req, res) => {
  try {
    const { user_id, bar_id, action, from, to } = req.query;
    const limit = Math.min(Number(req.query.limit || 200), 500);

    const where = ["1=1"];
    const params = [];

    if (user_id) {
      where.push("a.user_id = ?");
      params.push(Number(user_id));
    }
    if (bar_id) {
      where.push("a.bar_id = ?");
      params.push(Number(bar_id));
    }
    if (action) {
      where.push("a.action = ?");
      params.push(action);
    }
    if (from && to) {
      where.push("DATE(a.created_at) BETWEEN ? AND ?");
      params.push(from, to);
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.bar_id, a.user_id, a.action, a.entity, a.entity_id, a.details, a.ip_address, a.user_agent, a.created_at,
              b.name AS bar_name,
              CONCAT(u.first_name, ' ', u.last_name) AS actor_name,
              u.email AS actor_email
       FROM audit_logs a
       LEFT JOIN bars b ON b.id = a.bar_id
       LEFT JOIN users u ON u.id = a.user_id
       WHERE ${where.join(" AND ")}
       ORDER BY a.id DESC
       LIMIT ${limit}`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SUPER ADMIN AUDIT LOGS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);

    const [feedbackRows] = await pool.query(
      `SELECT pf.id,
              pf.rating,
              pf.comment,
              pf.category,
              pf.created_at,
              CONCAT(u.first_name, ' ', u.last_name) AS customer_name
       FROM platform_feedback pf
       JOIN users u ON u.id = pf.user_id
       WHERE pf.status = 'pending'
       ORDER BY pf.created_at DESC
       LIMIT ?`,
      [limit]
    );

    const [registrationRows] = await pool.query(
      `SELECT br.id,
              br.business_name,
              br.owner_email,
              br.created_at
       FROM business_registrations br
       WHERE br.status IN ('pending', 'pending_email_verification', 'pending_admin_approval')
       ORDER BY br.created_at DESC
       LIMIT ?`,
      [limit]
    );

    let pendingPayouts = [];
    try {
      const [payoutRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM super_admin_payouts WHERE status = 'pending'`
      );
      if (payoutRows[0]?.cnt > 0) {
        pendingPayouts = [{ count: payoutRows[0].cnt }];
      }
    } catch (_) {}

    let flaggedPosts = [];
    try {
      const [postRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM social_posts WHERE status = 'reported' OR status = 'flagged'`
      );
      if (postRows[0]?.cnt > 0) {
        flaggedPosts = [{ count: postRows[0].cnt }];
      }
    } catch (_) {}

    let flaggedComments = [];
    try {
      const [commentRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM social_comment_reports WHERE status = 'pending'`
      );
      if (commentRows[0]?.cnt > 0) {
        flaggedComments = [{ count: commentRows[0].cnt }];
      }
    } catch (_) {}

    let pendingCustomers = [];
    try {
      const [customerRows] = await pool.query(
        `SELECT COUNT(*) AS cnt,
                MAX(created_at) AS latest_at
         FROM users
         WHERE LOWER(COALESCE(role, '')) = 'customer'
           AND COALESCE(approval_status, 'approved') = 'pending'`
      );
      if (Number(customerRows[0]?.cnt || 0) > 0) {
        pendingCustomers = [{
          count: Number(customerRows[0].cnt),
          latest_at: customerRows[0].latest_at,
        }];
      }
    } catch (_) {}

    // Per-admin read state (best-effort: table created by
    // 20261007 migration; absence just means everything is unread).
    let readKeys = new Set();
    try {
      const [readRows] = await pool.query(
        `SELECT notification_key FROM super_admin_notification_reads WHERE admin_user_id = ?`,
        [req.user.id]
      );
      readKeys = new Set(readRows.map((r) => r.notification_key));
    } catch (_) {
      readKeys = new Set();
    }

    const ACTIONABLE = new Set(["business_registration", "pending_payouts", "flagged_content", "customer_approval"]);

    const notifications = [
      ...registrationRows.map((r) => ({
        id: `registration-${r.id}`,
        item_id: r.id,
        type: "business_registration",
        title: "New Bar Registration",
        message: `${r.business_name || "Business"} (${r.owner_email || "No email"}) — pending review`,
        action_url: "/registrations",
        created_at: r.created_at,
      })),
      ...feedbackRows.map((f) => ({
        id: `feedback-${f.id}`,
        item_id: f.id,
        type: "platform_feedback",
        title: "New Platform Review",
        message: `${f.customer_name || "Customer"} rated ${f.rating}/5${f.comment ? `: ${String(f.comment).slice(0, 80)}` : ""}`,
        action_url: "/feedback",
        created_at: f.created_at,
      })),
      ...pendingPayouts.map(() => ({
        id: "pending-payouts",
        type: "pending_payouts",
        title: "Pending Payouts",
        message: `${pendingPayouts[0].count} payout(s) awaiting processing`,
        action_url: "/payouts",
        created_at: new Date().toISOString(),
      })),
      ...flaggedPosts.map(() => ({
        id: "flagged-posts",
        type: "flagged_content",
        title: "Flagged Social Content",
        message: `${flaggedPosts[0].count} post(s) flagged for moderation`,
        action_url: "/social",
        created_at: new Date().toISOString(),
      })),
      ...flaggedComments.map(() => ({
        id: "flagged-comments",
        type: "flagged_content",
        title: "Reported Comments",
        message: `${flaggedComments[0].count} comment report(s) awaiting review`,
        action_url: "/social",
        created_at: new Date().toISOString(),
      })),
      ...pendingCustomers.map(() => ({
        id: "customer-approvals",
        type: "customer_approval",
        title: "New Customer Registrations",
        message: `${pendingCustomers[0].count} customer(s) awaiting approval`,
        action_url: "/customer-approvals",
        created_at: pendingCustomers[0].latest_at || new Date().toISOString(),
      })),
    ]
      .map((n) => ({ ...n, is_read: readKeys.has(n.id) }))
      // Urgency-then-recency: actionable items (registrations, payouts,
      // flagged content) pin above informational ones (reviews); newest
      // first within each group.
      .sort((a, b) => {
        const au = ACTIONABLE.has(a.type) ? 0 : 1;
        const bu = ACTIONABLE.has(b.type) ? 0 : 1;
        if (au !== bu) return au - bu;
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .slice(0, limit);

    return res.json({
      success: true,
      data: {
        notifications,
        unread_count: notifications.filter((n) => !n.is_read).length,
        counts: {
          pending_feedback: feedbackRows.length,
          pending_registrations: registrationRows.length,
          pending_payouts: pendingPayouts[0]?.count || 0,
          flagged_posts: flaggedPosts[0]?.count || 0,
          flagged_comments: flaggedComments[0]?.count || 0,
          pending_customers: pendingCustomers[0]?.count || 0,
        },
      },
    });
  } catch (err) {
    console.error("SUPER ADMIN NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Mark one, several, or all notifications as read for the calling admin.
// Body: { key: "registration-5" } | { keys: [...] } | { all: true }
router.post("/notifications/read", async (req, res) => {
  try {
    const { key, keys, all } = req.body || {};

    if (all) {
      // Mark every currently-pending notification key as read.
      const [pending] = await pool.query(
        `SELECT CONCAT('registration-', id) AS k FROM business_registrations
         WHERE status IN ('pending', 'pending_email_verification', 'pending_admin_approval')
         UNION
         SELECT CONCAT('feedback-', id) FROM platform_feedback WHERE status = 'pending'`
      );
      const staticKeys = ["pending-payouts", "flagged-posts", "flagged-comments", "customer-approvals"];
      const allKeys = [...pending.map((r) => r.k), ...staticKeys];
      if (allKeys.length) {
        await pool.query(
          `INSERT IGNORE INTO super_admin_notification_reads (notification_key, admin_user_id)
           VALUES ${allKeys.map(() => "(?, ?)").join(", ")}`,
          allKeys.flatMap((k) => [k, req.user.id])
        );
      }
      return res.json({ success: true, message: "All notifications marked as read" });
    }

    const list = [key, ...(Array.isArray(keys) ? keys : [])].filter(
      (k) => typeof k === "string" && k.length > 0 && k.length <= 64
    );
    if (!list.length) {
      return res.status(400).json({ success: false, message: "Provide a notification key, keys array, or all:true" });
    }

    await pool.query(
      `INSERT IGNORE INTO super_admin_notification_reads (notification_key, admin_user_id)
       VALUES ${list.map(() => "(?, ?)").join(", ")}`,
      list.flatMap((k) => [k, req.user.id])
    );
    return res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("SUPER ADMIN NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── CUSTOMER APPROVALS (new sign-ups reviewed by super admins) ───
// All routes here inherit requireAuth + ensureSuperAdmin from router.use().

const CUSTOMER_APPROVAL_SELECT = `
  SELECT u.id,
         CONCAT(u.first_name, ' ', u.last_name) AS name,
         u.first_name, u.last_name, u.email, u.phone_number,
         u.date_of_birth,
         TIMESTAMPDIFF(YEAR, u.date_of_birth, CURDATE()) AS age,
         u.profile_picture, u.is_verified, u.created_at,
         u.approval_status,
         CONCAT(rev.first_name, ' ', rev.last_name) AS reviewed_by_name,
         u.approval_reviewed_at AS reviewed_at,
         u.approval_rejection_reason AS rejection_reason
   FROM users u
   LEFT JOIN users rev ON rev.id = u.approval_reviewed_by
   WHERE LOWER(COALESCE(u.role, '')) = 'customer'`;

async function applyCustomerDecision(conn, { customerId, action, reason, adminId }) {
  const normalizedAction = String(action || "").trim().toLowerCase();
  if (!["approve", "reject"].includes(normalizedAction)) {
    const err = new Error("Action must be 'approve' or 'reject'.");
    err.statusCode = 400;
    throw err;
  }

  let cleanReason = "";
  if (normalizedAction === "reject") {
    cleanReason = String(reason || "").trim();
    if (cleanReason.length < 5 || cleanReason.length > 500) {
      const err = new Error("A rejection reason between 5 and 500 characters is required.");
      err.statusCode = 400;
      throw err;
    }
  }

  const [rows] = await conn.query(
    `SELECT id, first_name, email, role, approval_status, is_verified
     FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
    [customerId]
  );
  const target = rows[0];
  if (!target || String(target.role || "").trim().toLowerCase() !== "customer") {
    const err = new Error("Customer not found.");
    err.statusCode = 404;
    throw err;
  }

  const current = String(target.approval_status || "approved").trim().toLowerCase();
  const isVerified = Number(target.is_verified || 0) === 1;
  // Approving also sets verification, so an already-approved account that is
  // still unverified (pre-verification-flag backlog) stays actionable instead
  // of being stuck: the admin can run Approve to fix the missing flag.
  if (normalizedAction === "approve" && current === "approved" && isVerified) {
    const err = new Error("This customer is already approved and verified — no action needed. Reject first to revoke, then approve again if needed.");
    err.statusCode = 400;
    throw err;
  }
  if (normalizedAction === "reject" && current === "rejected") {
    const err = new Error("This customer is already rejected. Approve them first to change the decision.");
    err.statusCode = 400;
    throw err;
  }

  const nextStatus = normalizedAction === "approve" ? "approved" : "rejected";

  // Approving is the final gate, so it also marks the account verified:
  // a reviewed sign-up logs in immediately without a separate email click.
  // COALESCE preserves an earlier self-service verification timestamp, and
  // the stale token is cleared so the pending link can never be replayed.
  // Rejection never touches is_verified — an admin decision to revoke
  // approval must not silently un-verify an already confirmed email address.
  const verifyColumns = normalizedAction === "approve"
    ? `,
         is_verified = 1,
         email_verified_at = COALESCE(email_verified_at, ?),
         email_verification_token = NULL,
         email_verification_expires = NULL`
    : "";

  await conn.query(
    `UPDATE users
     SET approval_status = ?,
         approval_reviewed_by = ?,
         approval_reviewed_at = NOW(),
         approval_rejection_reason = ?${verifyColumns}
     WHERE id = ?`,
    [
      nextStatus,
      adminId,
      normalizedAction === "reject" ? cleanReason : null,
      // Node sends UTC (pool runs with timezone: 'Z'); MySQL NOW() is
      // server-local, so a JS Date keeps the stamped time consistent.
      ...(normalizedAction === "approve" ? [new Date()] : []),
      customerId,
    ]
  );

  return { target, nextStatus, reason: cleanReason };
}

async function recordCustomerDecision({ conn, usePool, customer, nextStatus, reason, adminId, req }) {
  const db = conn || pool;
  const auditAction = nextStatus === "approved" ? "APPROVE_CUSTOMER" : "REJECT_CUSTOMER";
  await db.query(
    `INSERT INTO platform_audit_logs
     (actor_user_id, action, entity, entity_id, target_bar_id, details, ip_address, user_agent)
     VALUES (?, ?, 'customer', ?, NULL, ?, ?, ?)`,
    [
      adminId,
      auditAction,
      customer.id,
      JSON.stringify({ email: customer.email, reason: reason || null, marked_verified: nextStatus === "approved" }),
      req?.ip || null,
      req?.get ? req.get("user-agent") || null : null,
    ]
  );
  await db.query(
    `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, 'customer_approval', 0, NOW())`,
    [
      customer.id,
      nextStatus === "approved" ? "account_approved" : "account_rejected",
      nextStatus === "approved" ? "Account approved" : "Registration update",
      nextStatus === "approved"
        ? "Your account has been approved. You can now log in."
        : "Your registration was not approved. Tap to see details.",
      customer.id,
    ]
  );
}

router.get("/customer-approvals", async (req, res) => {
  try {
    const status = String(req.query.status || "pending").trim().toLowerCase();
    const search = String(req.query.search || "").trim();
    const verified = String(req.query.verified || "all").trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (["pending", "approved", "rejected"].includes(status)) {
      where.push("u.approval_status = ?");
      params.push(status);
    }
    if (verified === "verified") {
      where.push("u.is_verified = 1");
    } else if (verified === "unverified") {
      where.push("COALESCE(u.is_verified, 0) <> 1");
    }
    if (search) {
      where.push("(CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.email LIKE ? OR u.phone_number LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u WHERE LOWER(COALESCE(u.role, '')) = 'customer'${where.length ? ` AND ${where.join(" AND ")}` : ""}`,
      params
    );
    const [rows] = await pool.query(
      `${CUSTOMER_APPROVAL_SELECT}${where.length ? ` AND ${where.join(" AND ")}` : ""}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      success: true,
      data: {
        customers: rows,
        pagination: {
          page,
          limit,
          total: Number(countRow?.total || 0),
          total_pages: Math.ceil(Number(countRow?.total || 0) / limit),
        },
      },
    });
  } catch (err) {
    console.error("SA CUSTOMER APPROVALS LIST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/customer-approvals/stats", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(u.approval_status, 'approved') AS status, COUNT(*) AS cnt
       FROM users u
       WHERE LOWER(COALESCE(u.role, '')) = 'customer'
       GROUP BY COALESCE(u.approval_status, 'approved')`
    );
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const r of rows) {
      const key = String(r.status || "").trim().toLowerCase();
      if (key in counts) counts[key] = Number(r.cnt || 0);
    }
    const [[unvRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM users
       WHERE LOWER(COALESCE(role, '')) = 'customer'
         AND COALESCE(is_verified, 0) <> 1`
    );
    counts.unverified = Number(unvRow?.cnt || 0);
    return res.json({ success: true, data: counts });
  } catch (err) {
    console.error("SA CUSTOMER APPROVALS STATS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/customer-approvals/:id/approve", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const customerId = Number(req.params.id);
    if (!customerId) return res.status(400).json({ success: false, message: "Invalid customer id" });

    await conn.beginTransaction();
    const { target, nextStatus } = await applyCustomerDecision(conn, {
      customerId, action: "approve", adminId: req.user.id,
    });
    await recordCustomerDecision({ conn, customer: target, nextStatus, adminId: req.user.id, req });
    await conn.commit();

    try {
      const { sendCustomerApprovalEmail } = require("../utils/emailService");
      await sendCustomerApprovalEmail(target.email, target.first_name);
    } catch (emailErr) {
      console.error("APPROVE CUSTOMER EMAIL ERROR:", emailErr?.message || emailErr);
    }

    return res.json({ success: true, message: "Customer approved and marked as verified. They can now log in." });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("SA APPROVE CUSTOMER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

router.post("/customer-approvals/:id/reject", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const customerId = Number(req.params.id);
    if (!customerId) return res.status(400).json({ success: false, message: "Invalid customer id" });

    await conn.beginTransaction();
    const { target, nextStatus, reason } = await applyCustomerDecision(conn, {
      customerId, action: "reject", reason: req.body?.reason, adminId: req.user.id,
    });
    await recordCustomerDecision({ conn, customer: target, nextStatus, reason, adminId: req.user.id, req });
    await conn.commit();

    try {
      const { sendCustomerRejectionEmail } = require("../utils/emailService");
      await sendCustomerRejectionEmail(target.email, target.first_name, reason);
    } catch (emailErr) {
      console.error("REJECT CUSTOMER EMAIL ERROR:", emailErr?.message || emailErr);
    }

    return res.json({ success: true, message: "Customer rejected." });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("SA REJECT CUSTOMER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

router.post("/customer-approvals/bulk", async (req, res) => {
  const { action, ids, reason } = req.body || {};
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter((n) => n > 0))].slice(0, 100);
  if (!["approve", "reject"].includes(String(action || "").trim().toLowerCase())) {
    return res.status(400).json({ success: false, message: "Action must be 'approve' or 'reject'." });
  }
  if (!list.length) {
    return res.status(400).json({ success: false, message: "Provide at least one customer id." });
  }

  const conn = await pool.getConnection();
  const results = [];
  try {
    await conn.beginTransaction();
    for (const customerId of list) {
      const decided = await applyCustomerDecision(conn, {
        customerId, action, reason, adminId: req.user.id,
      });
      await recordCustomerDecision({
        conn, customer: decided.target, nextStatus: decided.nextStatus,
        reason: decided.reason, adminId: req.user.id, req,
      });
      results.push({ id: customerId, status: decided.nextStatus });
    }
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
    console.error("SA BULK CUSTOMER DECISION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }

  // Emails go out after commit, best-effort, never failing the decision.
  const { sendCustomerApprovalEmail, sendCustomerRejectionEmail } = require("../utils/emailService");
  for (const r of results) {
    try {
      const [[row]] = await pool.query("SELECT email, first_name FROM users WHERE id = ? LIMIT 1", [r.id]);
      if (!row) continue;
      if (r.status === "approved") await sendCustomerApprovalEmail(row.email, row.first_name);
      else await sendCustomerRejectionEmail(row.email, row.first_name, reason);
    } catch (emailErr) {
      console.error("BULK CUSTOMER EMAIL ERROR:", emailErr?.message || emailErr);
    }
  }

  const verb = String(action).trim().toLowerCase() === "approve" ? "approved" : "rejected";
  return res.json({ success: true, message: `${results.length} customer(s) ${verb}.`, data: results });
});

router.get("/platform/maintenance", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value, updated_at
       FROM platform_settings
       WHERE setting_key IN ('maintenance_mode', 'maintenance_message')`
    );

    const settingsMap = rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});

    const updatedAt = rows.reduce((latest, row) => {
      if (!latest || (row.updated_at && row.updated_at > latest)) return row.updated_at;
      return latest;
    }, null);

    return res.json({
      success: true,
      data: {
        maintenance_mode: Number(settingsMap.maintenance_mode || 0),
        maintenance_message: settingsMap.maintenance_message || null,
        updated_at: updatedAt,
      },
    });
  } catch (err) {
    return res.status(200).json({ success: true, data: { maintenance_mode: 0, maintenance_message: null, updated_at: null } });
  }
});

router.patch("/platform/maintenance", async (req, res) => {
  try {
    const maintenanceMode = req.body?.maintenance_mode ? 1 : 0;
    const maintenanceMessage = req.body?.maintenance_message || null;

    await pool.query(
      `INSERT INTO platform_settings (setting_key, setting_value, description, updated_by)
       VALUES ('maintenance_mode', ?, 'Enable/disable maintenance mode', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [String(maintenanceMode), req.user.id]
    );

    await pool.query(
      `INSERT INTO platform_settings (setting_key, setting_value, description, updated_by)
       VALUES ('maintenance_message', ?, 'Message shown during maintenance mode', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
      [maintenanceMessage || "", req.user.id]
    );

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UPDATE_MAINTENANCE_MODE",
      entity: "platform_setting",
      entity_id: null,
      details: { maintenance_mode: maintenanceMode, maintenance_message: maintenanceMessage },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Maintenance settings updated" });
  } catch (err) {
    console.error("SUPER ADMIN UPDATE MAINTENANCE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/platform/announcements", async (req, res) => {
  try {
    const onlyActive = req.query.active === "1";
    const [rows] = await pool.query(
      `SELECT id, title, message, is_active, starts_at, ends_at, created_by, created_at, updated_at
       FROM platform_announcements
       ${onlyActive ? "WHERE is_active = 1" : ""}
       ORDER BY id DESC
       LIMIT 200`
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

router.post("/platform/announcements", async (req, res) => {
  try {
    const { title, message, starts_at, ends_at } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ success: false, message: "title and message required" });
    }

    const normalizedStartsAt = normalizeAnnouncementDateTimeInput(starts_at);
    const normalizedEndsAt = normalizeAnnouncementDateTimeInput(ends_at);

    if (
      normalizedStartsAt === INVALID_ANNOUNCEMENT_DATETIME ||
      normalizedEndsAt === INVALID_ANNOUNCEMENT_DATETIME
    ) {
      return res.status(400).json({ success: false, message: "Invalid starts_at or ends_at datetime" });
    }

    if (normalizedStartsAt && normalizedEndsAt && normalizedEndsAt < normalizedStartsAt) {
      return res.status(400).json({ success: false, message: "ends_at must be after starts_at" });
    }

    const [result] = await pool.query(
      `INSERT INTO platform_announcements
       (title, message, is_active, starts_at, ends_at, created_by)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [title, message, normalizedStartsAt, normalizedEndsAt, req.user.id]
    );

    let notifiedUsers = 0;
    try {
      const [notifResult] = await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read, created_at)
         SELECT u.id, 'announcement', 'New Platform Announcement', ?, ?, 'announcement', 0, NOW()
         FROM users u
         WHERE LOWER(COALESCE(u.role, '')) = 'customer'
           AND COALESCE(u.is_active, 1) = 1`,
        [`${title}: ${message}`, result.insertId]
      );
      notifiedUsers = Number(notifResult.affectedRows || 0);
      if (notifiedUsers > 0) {
        triggerPushDispatch('platform-announcement');
      }
    } catch (notifErr) {
      console.error('SUPER ADMIN ANNOUNCEMENT PUSH NOTIFICATION ERROR:', notifErr);
    }

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "CREATE_ANNOUNCEMENT",
      entity: "platform_announcement",
      entity_id: result.insertId,
      details: { title },
      ...auditContext(req),
    });

    return res.status(201).json({
      success: true,
      message: "Announcement created",
      data: { id: result.insertId, notified_users: notifiedUsers },
    });
  } catch (err) {
    console.error("SUPER ADMIN CREATE ANNOUNCEMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/platform/announcements/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid announcement id" });

    const updates = [];
    const params = [];

    const fields = ["title", "message", "is_active", "starts_at", "ends_at"];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (field === "starts_at" || field === "ends_at") {
          const normalized = normalizeAnnouncementDateTimeInput(req.body[field]);
          if (normalized === INVALID_ANNOUNCEMENT_DATETIME) {
            return res.status(400).json({ success: false, message: `Invalid ${field} datetime` });
          }
          updates.push(`${field} = ?`);
          params.push(normalized);
          continue;
        }
        updates.push(`${field} = ?`);
        params.push(req.body[field]);
      }
    }

    if (!updates.length) return res.status(400).json({ success: false, message: "No fields to update" });

    const startsAtIndex = updates.indexOf("starts_at = ?");
    const endsAtIndex = updates.indexOf("ends_at = ?");
    if (startsAtIndex !== -1 && endsAtIndex !== -1) {
      const startsAt = params[startsAtIndex];
      const endsAt = params[endsAtIndex];
      if (startsAt && endsAt && endsAt < startsAt) {
        return res.status(400).json({ success: false, message: "ends_at must be after starts_at" });
      }
    }

    params.push(id);
    await pool.query(`UPDATE platform_announcements SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, params);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UPDATE_ANNOUNCEMENT",
      entity: "platform_announcement",
      entity_id: id,
      details: { fields: Object.keys(req.body || {}) },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Announcement updated" });
  } catch (err) {
    console.error("SUPER ADMIN UPDATE ANNOUNCEMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/platform/announcements/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid announcement id" });
    }

    const [[existing]] = await pool.query(
      "SELECT id, title FROM platform_announcements WHERE id = ? LIMIT 1",
      [id]
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: "Announcement not found" });
    }

    await pool.query("DELETE FROM platform_announcements WHERE id = ?", [id]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "DELETE_ANNOUNCEMENT",
      entity: "platform_announcement",
      entity_id: id,
      details: { title: existing.title || null },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Announcement deleted" });
  } catch (err) {
    console.error("SUPER ADMIN DELETE ANNOUNCEMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/platform/suspicious-logins", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 300);
    const [rows] = await pool.query(
      `SELECT id, user_id, email_attempt, ip_address, user_agent, reason, details, created_at
       FROM suspicious_logins
       ORDER BY id DESC
       LIMIT ${limit}`
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.json({ success: true, data: [] });
  }
});

// ─── CREATE BAR (Super Admin only) ───────────────────────────────────
router.post("/bars", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { name, description, address, city, state, zip_code, phone, email, website, category, price_range, owner_user_id } = req.body || {};

    if (!name || !address || !city) {
      return res.status(400).json({ success: false, message: "name, address, and city are required" });
    }

    await conn.beginTransaction();

    const [barIns] = await conn.query(
      `INSERT INTO bars
       (name, description, address, city, state, zip_code, phone, email, website, category, price_range, status, compliance_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'approved', NOW(), NOW())`,
      [name, description || null, address, city, state || null, zip_code || null, phone || null, email || null, website || null, category || null, price_range || null]
    );

    const barId = barIns.insertId;

    // If lifecycle_status column exists, set it too
    const hasLifecycle = await hasLifecycleStatusColumn();
    if (hasLifecycle) {
      await conn.query("UPDATE bars SET lifecycle_status = 'pending' WHERE id = ?", [barId]);
    }

    // Optionally link an existing bar owner user
    if (owner_user_id) {
      const uid = Number(owner_user_id);
      const [ownerRows] = await conn.query(
        `SELECT u.id, bo.id AS bar_owner_id FROM users u LEFT JOIN bar_owners bo ON bo.user_id = u.id WHERE u.id = ? AND u.role = 'bar_owner' LIMIT 1`,
        [uid]
      );
      if (ownerRows.length && ownerRows[0].bar_owner_id) {
        await conn.query("UPDATE bars SET owner_id = ?, updated_at = NOW() WHERE id = ?", [ownerRows[0].bar_owner_id, barId]);
        await conn.query("UPDATE users SET bar_id = ?, updated_at = NOW() WHERE id = ?", [barId, uid]);
      }
    }

    await conn.commit();

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "CREATE_BAR",
      entity: "bar",
      entity_id: barId,
      target_bar_id: barId,
      details: { name, city },
      ...auditContext(req),
    });

    return res.status(201).json({ success: true, message: "Bar created", data: { id: barId } });
  } catch (err) {
    await conn.rollback();
    console.error("SUPER ADMIN CREATE BAR ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

// ─── LIST OWNERS ─────────────────────────────────────────────────────
router.get("/owners", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const q = req.query.q || null;

    const where = ["u.role = 'bar_owner'"];
    const params = [];

    if (q) {
      where.push("(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)");
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number, u.is_active, u.bar_id, u.created_at,
              bo.id AS bar_owner_id, bo.business_name, bo.business_email, bo.business_phone,
              b.name AS bar_name
       FROM users u
       LEFT JOIN bar_owners bo ON bo.user_id = u.id
       LEFT JOIN bars b ON b.id = u.bar_id
       WHERE ${where.join(" AND ")}
       ORDER BY u.id DESC
       LIMIT ${limit}`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SUPER ADMIN LIST OWNERS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── RBAC OVERSIGHT ──────────────────────────────────────────────────
router.get("/roles", async (_req, res) => {
  try {
    const [roles] = await pool.query(
      `SELECT r.id, r.name, r.description,
              (SELECT COUNT(*) FROM users u2 WHERE u2.role_id = r.id) AS user_count
       FROM roles r
       ORDER BY r.id`
    );

    const [permissions] = await pool.query(
      `SELECT rp.role_id, p.code AS permission_name
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       ORDER BY rp.role_id, p.code`
    );

    const permMap = {};
    for (const row of permissions) {
      if (!permMap[row.role_id]) permMap[row.role_id] = [];
      permMap[row.role_id].push(row.permission_name);
    }

    const data = roles.map((r) => ({
      ...r,
      permissions: permMap[r.id] || [],
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error("SUPER ADMIN ROLES LIST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/roles/:roleId/users", async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    if (!roleId) return res.status(400).json({ success: false, message: "Invalid role id" });

    const limit = Math.min(Number(req.query.limit || 100), 300);
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.bar_id, b.name AS bar_name
       FROM users u
       LEFT JOIN bars b ON b.id = u.bar_id
       WHERE u.role_id = ?
       ORDER BY u.id DESC
       LIMIT ${limit}`,
      [roleId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SUPER ADMIN ROLE USERS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/roles/:roleId/force-reset", async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    if (!roleId) return res.status(400).json({ success: false, message: "Invalid role id" });

    // Get the default permissions for this role from the original role_permissions table
    const [currentPerms] = await pool.query(
      "SELECT permission_id FROM role_permissions WHERE role_id = ?",
      [roleId]
    );

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "FORCE_PERMISSION_RESET",
      entity: "role",
      entity_id: roleId,
      details: { permission_count: currentPerms.length },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: "Permission audit logged. Current permission count: " + currentPerms.length,
      data: { role_id: roleId, permission_count: currentPerms.length },
    });
  } catch (err) {
    console.error("SUPER ADMIN FORCE RESET ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── LOGIN ACTIVITY (cross-bar) ──────────────────────────────────────
router.get("/login-activity", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 100), 300);
    const [rows] = await pool.query(
      `SELECT a.id, a.user_id, a.action, a.entity, a.ip_address, a.user_agent, a.created_at,
              u.email, u.first_name, u.last_name, b.name AS bar_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN bars b ON b.id = a.bar_id
       WHERE a.action IN ('LOGIN', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'login', 'login_success', 'login_failed')
       ORDER BY a.id DESC
       LIMIT ${limit}`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SUPER ADMIN LOGIN ACTIVITY ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── BAR TABLES MANAGEMENT ───────────────────────────────────────────
router.get("/bars/:barId/tables", async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    const [rows] = await pool.query(
      `SELECT id, bar_id, table_number, capacity, is_active, image_path, price, created_at
       FROM bar_tables
       WHERE bar_id = ?
       ORDER BY table_number ASC`,
      [barId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SUPER ADMIN LIST TABLES ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/bars/:barId/tables", async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    const { table_number, capacity, price } = req.body || {};
    if (!table_number) {
      return res.status(400).json({ success: false, message: "table_number is required" });
    }

    const [result] = await pool.query(
      `INSERT INTO bar_tables (bar_id, table_number, capacity, price, is_active, created_at)
       VALUES (?, ?, ?, ?, 1, NOW())`,
      [barId, table_number, capacity || 2, price || null]
    );

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "CREATE_TABLE",
      entity: "bar_table",
      entity_id: result.insertId,
      target_bar_id: barId,
      details: { table_number, capacity },
      ...auditContext(req),
    });

    return res.status(201).json({ success: true, message: "Table created", data: { id: result.insertId } });
  } catch (err) {
    console.error("SUPER ADMIN CREATE TABLE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/bars/:barId/tables/:tableId", async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    const tableId = Number(req.params.tableId);
    if (!barId || !tableId) return res.status(400).json({ success: false, message: "Invalid ids" });

    const allowed = ["table_number", "capacity", "is_active", "price"];
    const updates = [];
    const params = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    params.push(tableId, barId);
    await pool.query(`UPDATE bar_tables SET ${updates.join(", ")} WHERE id = ? AND bar_id = ?`, params);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UPDATE_TABLE",
      entity: "bar_table",
      entity_id: tableId,
      target_bar_id: barId,
      details: { fields: Object.keys(req.body || {}) },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Table updated" });
  } catch (err) {
    console.error("SUPER ADMIN UPDATE TABLE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/bars/:barId/tables/:tableId/image", tableImageUpload.single("image"), async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    const tableId = Number(req.params.tableId);
    if (!barId || !tableId) return res.status(400).json({ success: false, message: "Invalid ids" });
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const filePath = req.file.path.replace(/\\/g, "/");
    await pool.query("UPDATE bar_tables SET image_path = ? WHERE id = ? AND bar_id = ?", [filePath, tableId, barId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UPLOAD_TABLE_IMAGE",
      entity: "bar_table",
      entity_id: tableId,
      target_bar_id: barId,
      details: { image_path: filePath },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Table image uploaded", data: { image_path: filePath } });
  } catch (err) {
    console.error("SUPER ADMIN TABLE IMAGE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/bars/:barId/tables/:tableId", async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    const tableId = Number(req.params.tableId);
    if (!barId || !tableId) return res.status(400).json({ success: false, message: "Invalid ids" });

    await pool.query("DELETE FROM bar_tables WHERE id = ? AND bar_id = ?", [tableId, barId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "DELETE_TABLE",
      entity: "bar_table",
      entity_id: tableId,
      target_bar_id: barId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Table deleted" });
  } catch (err) {
    console.error("SUPER ADMIN DELETE TABLE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── USER MANAGEMENT ─────────────────────────────────────────────────
router.get("/users", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(Number(req.query.limit || 10), 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const role = req.query.role || "";
    const status = req.query.status || "";

    const where = ["1=1"];
    const params = [];

    if (search) {
      where.push("(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term);
    }
    if (role) {
      where.push("u.role = ?");
      params.push(role);
    }
    if (status === "active") {
      where.push("u.is_active = 1");
    } else if (status === "inactive") {
      where.push("u.is_active = 0");
    }

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u WHERE ${where.join(" AND ")}`,
      params
    );
    const total = countRow.total;

    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.is_active,
              u.is_verified, u.phone_number, u.created_at, u.updated_at, u.bar_id,
              b.name AS bar_name
       FROM users u
       LEFT JOIN bars b ON b.id = u.bar_id
       WHERE ${where.join(" AND ")}
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`,
      dataParams
    );

    return res.json({
      success: true,
      data: {
        users: rows,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    console.error("SA LIST USERS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, role, is_active, is_verified,
              phone_number, profile_picture, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("SA GET USER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/users", ensureSuperAdmin, async (req, res) => {
  try {
    const { first_name, last_name, email, password, role, is_verified, bar_id } = req.body;
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const userRole = (role || "user").toLowerCase();
    if (userRole === "super_admin") {
      return res.status(403).json({ success: false, message: "Cannot create Super Admin accounts via this endpoint" });
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing.length) return res.status(409).json({ success: false, message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    let roleId = null;
    const [roleRows] = await pool.query("SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1", [userRole]);
    if (roleRows.length) roleId = roleRows[0].id;

    const [result] = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password, role, role_id, is_active, is_verified, bar_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NOW(), NOW())`,
      [first_name, last_name, email, hashed, userRole, roleId, is_verified ? 1 : 0, bar_id ? Number(bar_id) : null]
    );

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "CREATE_USER",
      entity: "user",
      entity_id: result.insertId,
      details: { email, role: userRole, bar_id: bar_id ? Number(bar_id) : null },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "User created", data: { id: result.insertId } });
  } catch (err) {
    console.error("SA CREATE USER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/users/:id", ensureSuperAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { first_name, last_name, email, role, is_active, password, bar_id } = req.body;

    if (role && String(role).toLowerCase() === "super_admin") {
      return res.status(403).json({ success: false, message: "Cannot assign Super Admin role via this endpoint" });
    }

    const updates = [];
    const params = [];

    if (first_name !== undefined) { updates.push("first_name = ?"); params.push(first_name); }
    if (last_name !== undefined) { updates.push("last_name = ?"); params.push(last_name); }
    if (email !== undefined) { updates.push("email = ?"); params.push(email); }
    if (role !== undefined) {
      updates.push("role = ?");
      params.push(role);
      const [roleRows] = await pool.query("SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1", [role]);
      if (roleRows.length) {
        updates.push("role_id = ?");
        params.push(roleRows[0].id);
      }
    }
    if (is_active !== undefined) { updates.push("is_active = ?"); params.push(Number(is_active)); }
    if (bar_id !== undefined) {
      updates.push("bar_id = ?");
      params.push(bar_id ? Number(bar_id) : null);
    }
    if (password && password.trim()) {
      const hashed = await bcrypt.hash(password, 10);
      updates.push("password = ?");
      params.push(hashed);
    }

    if (!updates.length) return res.status(400).json({ success: false, message: "No fields to update" });

    updates.push("updated_at = NOW()");
    params.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UPDATE_USER",
      entity: "user",
      entity_id: userId,
      details: { fields: Object.keys(req.body) },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "User updated" });
  } catch (err) {
    console.error("SA UPDATE USER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/users/:id/toggle-status", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const [[user]] = await pool.query("SELECT is_active FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const newStatus = user.is_active ? 0 : 1;
    await pool.query("UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?", [newStatus, userId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: newStatus ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entity: "user",
      entity_id: userId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: newStatus ? "User activated" : "User deactivated" });
  } catch (err) {
    console.error("SA TOGGLE USER STATUS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/users/:id/reset-password", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { new_password } = req.body;

    if (!userId || !new_password || new_password.length < 8) {
      return res.status(400).json({ success: false, message: "Valid user ID and new password (min 8 characters) required" });
    }

    const [[user]] = await pool.query("SELECT id, email, role FROM users WHERE id = ?", [userId]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?", [hashed, userId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "RESET_USER_PASSWORD",
      entity: "user",
      entity_id: userId,
      details: { target_email: user.email, target_role: user.role },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("SA RESET USER PASSWORD ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    // Prevent self-delete
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: "Cannot delete yourself" });
    }

    await pool.query("DELETE FROM users WHERE id = ?", [userId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "DELETE_USER",
      entity: "user",
      entity_id: userId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "User deleted" });
  } catch (err) {
    console.error("SA DELETE USER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── BUSINESS REGISTRATION REVIEW ────────────────────────────────────
// Document URLs come back pointing at localhost in development; hand the admin
// UI the same origin the production API serves files from.
function transformRegistrationRow(row) {
  const transformed = { ...row };
  const backendUrl = process.env.BACKEND_URL || 'https://api.thepartygoers.fun';
  // One list: config/requiredPermits.js (the registration column names).
  REGISTRATION_DOC_KEYS.forEach((field) => {
    if (row[field] && row[field].includes('localhost')) {
      transformed[field] = row[field].replace(/http:\/\/localhost:\d+/, backendUrl);
    }
  });
  return transformed;
}

router.get("/registrations", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(Number(req.query.limit || 10), 100);
    const offset = (page - 1) * limit;
    const status = req.query.status || "pending";

    const where = [];
    const params = [];
    if (status && status !== "all") {
      if (status === "pending") {
        where.push("br.status IN ('pending', 'pending_email_verification', 'pending_admin_approval')");
      } else {
        where.push("br.status = ?");
        params.push(status);
      }
    }

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM business_registrations br ${where.length ? "WHERE " + where.join(" AND ") : ""}`,
      params
    );

    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query(
      `SELECT br.*, 
              rv.first_name AS reviewer_first, rv.last_name AS reviewer_last
       FROM business_registrations br
       LEFT JOIN users rv ON rv.id = br.reviewed_by
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY br.created_at DESC
       LIMIT ? OFFSET ?`,
      dataParams
    );

    // Transform document URLs to use production backend URL
    const transformedRows = rows.map((row) => transformRegistrationRow(row));

    return res.json({
      success: true,
      data: {
        registrations: transformedRows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          total_pages: Math.ceil(countRow.total / limit),
        },
      },
    });
  } catch (err) {
    console.error("SA LIST REGISTRATIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/registrations/:id", async (req, res) => {
  try {
    const regId = Number(req.params.id);
    if (!Number.isSafeInteger(regId) || regId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid registration id" });
    }
    const [rows] = await pool.query(
      `SELECT br.*, rv.first_name AS reviewer_first, rv.last_name AS reviewer_last
         FROM business_registrations br
         LEFT JOIN users rv ON rv.id = br.reviewed_by
        WHERE br.id = ?
        LIMIT 1`,
      [regId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Registration not found" });
    return res.json({ success: true, data: { registration: transformRegistrationRow(rows[0]) } });
  } catch (err) {
    console.error("SA GET REGISTRATION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/registrations/:id/document-checks", async (req, res) => {
  try {
    const registrationId = Number(req.params.id);
    if (!Number.isSafeInteger(registrationId) || registrationId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid registration id" });
    }
    const [registrationRows] = await pool.query(
      `SELECT * FROM business_registrations WHERE id = ? LIMIT 1`,
      [registrationId]
    );
    if (!registrationRows.length) return res.status(404).json({ success: false, message: "Registration not found" });
    const [reviews] = await pool.query(
      "SELECT document_type, status, check_method, notes, checked_by, checked_at FROM business_registration_document_reviews WHERE registration_id = ?",
      [registrationId]
    );
    const documents = await buildRegistrationDocumentViews(registrationId, registrationRows[0], reviews);
    return res.json({ success: true, data: { documents } });
  } catch (err) {
    console.error("SA GET REGISTRATION DOCUMENT CHECKS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/registrations/:id/automatic-document-check", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const registrationId = Number(req.params.id);
    if (!Number.isSafeInteger(registrationId) || registrationId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid registration id" });
    }
    const [rows] = await conn.query(
      `SELECT * FROM business_registrations WHERE id = ? LIMIT 1`,
      [registrationId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Registration not found" });

    await conn.beginTransaction();
    const registration = rows[0];
    const files = await resolveRegistrationDocumentFiles(registrationId, registration);
    const results = [];
    for (const documentType of REQUIRED_REGISTRATION_DOCUMENTS) {
      const filePath = files[documentType];
      const present = Boolean(filePath && String(filePath).trim());
      const exists = present && registrationDocExists(filePath);
      const extension = present ? path.extname(String(filePath).split("?")[0]).toLowerCase() : "";
      let size = 0;
      if (exists) {
        try { size = fs.statSync(registrationDocLocalPath(filePath)).size; } catch (_) { size = 0; }
      }
      const passed = exists && size >= 500 && ALLOWED_REGISTRATION_DOCUMENT_EXTENSIONS.has(extension);

      // Never approve a permit that has no usable file: "missing" is written
      // back so the approval gate blocks it too.
      let status = "missing";
      let notes = "No file is on record for this permit.";
      if (present && !exists) {
        notes = "A file path is recorded but the file is missing from storage.";
      } else if (present && exists && passed) {
        status = "approved";
        notes = "File exists, is readable, and uses an allowed document format.";
      } else if (present && exists) {
        status = "manual_review";
        notes = "Automatic check could not fully verify this file. Manual review required.";
      }

      await conn.query(
        `INSERT INTO business_registration_document_reviews
          (registration_id, document_type, status, check_method, notes, checked_by, checked_at)
         VALUES (?, ?, ?, 'automatic', ?, ?, NOW())
         ON DUPLICATE KEY UPDATE status = VALUES(status), check_method = 'automatic', notes = VALUES(notes), checked_by = VALUES(checked_by), checked_at = NOW()`,
        [registrationId, documentType, status, notes, req.user.id]
      );
      results.push({ registration_id: registrationId, document_type: documentType, status, notes, check_method: "automatic" });
    }
    await conn.commit();

    // Return the same rich payload as GET /document-checks (file links
    // included) so the panel does not lose them after an automatic run.
    const [reviews] = await pool.query(
      "SELECT document_type, status, check_method, notes, checked_by, checked_at FROM business_registration_document_reviews WHERE registration_id = ?",
      [registrationId]
    );
    const documents = await buildRegistrationDocumentViews(registrationId, registration, reviews);
    return res.json({ success: true, data: { documents } });
  } catch (err) {
    await conn.rollback();
    console.error("SA AUTOMATIC REGISTRATION DOCUMENT CHECK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

router.post("/registrations/:id/document-checks/:documentType", async (req, res) => {
  try {
    const registrationId = Number(req.params.id);
    const { documentType } = req.params;
    const decision = String(req.body?.decision || "").toLowerCase();
    const notes = String(req.body?.notes || "").trim() || null;
    if (!Number.isSafeInteger(registrationId) || registrationId <= 0 || !REQUIRED_REGISTRATION_DOCUMENTS.includes(documentType)) {
      return res.status(400).json({ success: false, message: "Invalid registration document" });
    }
    if (!["approved", "rejected", "manual_review"].includes(decision)) {
      return res.status(400).json({ success: false, message: "Decision must be approved, rejected, or manual_review" });
    }

    const [registrationRows] = await pool.query(
      "SELECT * FROM business_registrations WHERE id = ? LIMIT 1",
      [registrationId]
    );
    if (!registrationRows.length) return res.status(404).json({ success: false, message: "Registration not found" });

    // A permit can only be reviewed when its file is actually viewable — this
    // is what makes "approved" impossible for an item with nothing on record.
    const files = await resolveRegistrationDocumentFiles(registrationId, registrationRows[0]);
    const filePath = files[documentType];
    const label = REGISTRATION_DOC_LABELS[documentType] || documentType;
    if (!filePath || !String(filePath).trim()) {
      return res.status(400).json({ success: false, message: `No file is on record for ${label} — it cannot be ${decision === "approved" ? "approved" : "reviewed"}.` });
    }
    if (!registrationDocExists(filePath)) {
      return res.status(400).json({ success: false, message: `The ${label} file is missing from storage — re-upload it before reviewing.` });
    }

    const [result] = await pool.query(
      `INSERT INTO business_registration_document_reviews
        (registration_id, document_type, status, check_method, notes, checked_by, checked_at)
       VALUES (?, ?, ?, 'manual', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), check_method = 'manual', notes = VALUES(notes), checked_by = VALUES(checked_by), checked_at = NOW()`,
      [registrationId, documentType, decision, notes, req.user.id]
    );
    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "CHECK_REGISTRATION_DOCUMENT",
      entity: "business_registration_document_reviews",
      entity_id: result.insertId || registrationId,
      details: { registration_id: registrationId, document_type: documentType, decision, notes },
      ...auditContext(req),
    });
    const [reviews] = await pool.query(
      "SELECT document_type, status, check_method, notes, checked_by, checked_at FROM business_registration_document_reviews WHERE registration_id = ?",
      [registrationId]
    );
    const [document] = await buildRegistrationDocumentViews(registrationId, registrationRows[0], reviews)
      .then((views) => views.filter((view) => view.document_type === documentType));
    return res.json({ success: true, data: { registration_id: registrationId, document_type: documentType, status: decision, document } });
  } catch (err) {
    console.error("SA MANUAL REGISTRATION DOCUMENT CHECK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/registrations/:id/approve", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const regId = Number(req.params.id);
    await conn.beginTransaction();

    const [regs] = await conn.query(
      "SELECT * FROM business_registrations WHERE id = ? AND status IN ('pending', 'pending_email_verification', 'pending_admin_approval')",
      [regId]
    );
    if (!regs.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Registration not found or already processed" });
    }
    const reg = regs[0];

    const [documentReviews] = await conn.query(
      "SELECT document_type, status FROM business_registration_document_reviews WHERE registration_id = ?",
      [regId]
    );
    const reviewMap = new Map(documentReviews.map((review) => [review.document_type, review.status]));
    // A permit only counts as approved when a real file exists AND its review
    // says approved — a stale "approved" row with nothing on record blocks it.
    // Approving a registration publishes a bar with compliance_status =
    // 'approved', so the same required-document standard applies here.
    const files = await resolveRegistrationDocumentFiles(regId, reg);
    const complianceDocTypes = COMPLIANCE_DOCUMENTS.map((doc) => doc.legacyColumn);
    const uploadedCount = complianceDocTypes.filter((documentType) => {
      const filePath = files[documentType];
      return Boolean(filePath && String(filePath).trim());
    }).length;
    if (uploadedCount < COMPLIANCE_REQUIRED_COUNT) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: incompleteComplianceMessage(uploadedCount, COMPLIANCE_REQUIRED_COUNT),
        data: { uploaded: uploadedCount, required: COMPLIANCE_REQUIRED_COUNT },
      });
    }

    const unapprovedDocuments = REQUIRED_REGISTRATION_DOCUMENTS.filter((documentType) => {
      const filePath = files[documentType];
      const usable = Boolean(filePath && String(filePath).trim()) && registrationDocExists(filePath);
      return !usable || reviewMap.get(documentType) !== "approved";
    });
    if (unapprovedDocuments.length) {
      await conn.rollback();
      const labels = unapprovedDocuments.map((documentType) => REGISTRATION_DOC_LABELS[documentType] || documentType);
      return res.status(400).json({
        success: false,
        message: `All required permits must have a file on record and pass automatic or manual review before approval. Outstanding: ${labels.join(", ")}.`,
        data: { documents: unapprovedDocuments },
      });
    }
    // Both gates above passed: every required permit is on record and approved,
    // so this approval also publishes the bar (see the status sync below).
    const docsComplete =
      uploadedCount >= COMPLIANCE_REQUIRED_COUNT && unapprovedDocuments.length === 0;

    // Update registration status
    await conn.query(
      "UPDATE business_registrations SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [req.user.id, regId]
    );

    // ── Owner account: LINK, never duplicate ───────────────────────────────
    // users.email and users.phone_number are UNIQUE and an earlier submission
    // (or a portal sign-up) often already owns the account, so a blind INSERT
    // aborted the whole approval with ER_DUP_ENTRY and the UI only showed the
    // generic "Server error" toast. Reuse the existing row instead.
    const [roleRows] = await conn.query("SELECT id FROM roles WHERE name = 'BAR_OWNER' LIMIT 1");
    const roleId = roleRows.length ? roleRows[0].id : null;

    let userId;
    const [[existingUser]] = await conn.query(
      "SELECT id, role FROM users WHERE email = ? LIMIT 1",
      [reg.owner_email]
    );
    if (existingUser) {
      userId = existingUser.id;
      const alreadyOwnerish = ["bar_owner", "manager", "staff", "employee", "hr", "admin", "super_admin"]
        .includes(String(existingUser.role || "").toLowerCase());
      if (alreadyOwnerish) {
        await conn.query(
          "UPDATE users SET is_active = 1, is_verified = 1, role_id = COALESCE(role_id, ?) WHERE id = ?",
          [roleId, userId]
        );
      } else {
        // e.g. a customer account with the same email — promote it so the
        // approval email can actually open the Bar Owner portal.
        await conn.query(
          "UPDATE users SET is_active = 1, is_verified = 1, role = 'bar_owner', role_id = COALESCE(role_id, ?) WHERE id = ?",
          [roleId, userId]
        );
      }
      console.log(`APPROVE REGISTRATION #${regId}: linked existing account ${reg.owner_email} (user ${userId})`);
    } else {
      // Older submissions carry a password; the portal registration form no
      // longer collects one, so fall back to a random value.
      const accountPassword =
        reg.owner_password && String(reg.owner_password).trim()
          ? reg.owner_password
          : require("crypto").randomBytes(18).toString("hex");
      // The phone is UNIQUE too — if some other account already holds it,
      // store NULL rather than aborting the approval.
      let ownerPhone = reg.owner_phone || null;
      if (ownerPhone) {
        const [[phoneOwner]] = await conn.query("SELECT id FROM users WHERE phone_number = ? LIMIT 1", [ownerPhone]);
        if (phoneOwner) {
          console.warn(`APPROVE REGISTRATION #${regId}: phone ${ownerPhone} already belongs to user ${phoneOwner.id} — saving the account without it`);
          ownerPhone = null;
        }
      }
      const [userIns] = await conn.query(
        `INSERT INTO users (first_name, middle_name, last_name, email, password, phone_number, role, role_id, is_active, is_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'bar_owner', ?, 1, 1, NOW(), NOW())`,
        [reg.owner_first_name, reg.owner_middle_name || null, reg.owner_last_name, reg.owner_email, accountPassword, ownerPhone, roleId]
      );
      userId = userIns.insertId;
    }

    // ── bar_owners record: link, never duplicate ───────────────────────────
    let ownerId;
    const [[existingOwner]] = await conn.query(
      "SELECT id FROM bar_owners WHERE user_id = ? ORDER BY id LIMIT 1",
      [userId]
    );
    if (existingOwner) {
      ownerId = existingOwner.id;
      // Fill anything the account is still missing; never clobber profile data.
      await conn.query(
        `UPDATE bar_owners
            SET business_name = COALESCE(NULLIF(business_name, ''), ?),
                business_address = COALESCE(NULLIF(business_address, ''), ?),
                business_phone = COALESCE(NULLIF(business_phone, ''), ?),
                business_email = COALESCE(NULLIF(business_email, ''), ?)
          WHERE id = ?`,
        [reg.business_name, reg.business_address, reg.business_phone, reg.business_email, ownerId]
      );
      console.log(`APPROVE REGISTRATION #${regId}: linked existing bar_owners row ${ownerId}`);
    } else {
      const [boIns] = await conn.query(
        `INSERT INTO bar_owners (user_id, business_name, business_address, business_phone, business_email, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [userId, reg.business_name, reg.business_address, reg.business_phone, reg.business_email]
      );
      ownerId = boIns.insertId;
    }

    // Create bar
    let barTypesValue = null;
    let timeLimitMode = null;
    let timeLimitMinutes = null;
    let categoryValue = null;
    if (reg.bar_types) {
      try {
        const parsed = JSON.parse(reg.bar_types);
        if (Array.isArray(parsed)) {
          barTypesValue = JSON.stringify(parsed);
          const normalized = parsed.map((x) => String(x || "").toLowerCase());
          // Derive category from first bar type
          if (parsed.length > 0) {
            categoryValue = parsed[0];
          }
          if (normalized.includes("club")) {
            timeLimitMode = "club";
          } else if (normalized.includes("comedy bar")) {
            timeLimitMode = "event";
          } else if (normalized.includes("restobar")) {
            timeLimitMode = "restobar";
            timeLimitMinutes = 120;
          } else if (normalized.length) {
            timeLimitMode = "custom";
            timeLimitMinutes = 120;
          }
        }
      } catch (_) {}
    }

    // Parse opening_time into per-day hours
    // Format: "Monday: 8:00 PM – 2:00 AM, Tuesday: 6:00 PM – 12:00 AM"
    const dayHours = {};
    if (reg.opening_time) {
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const parts = reg.opening_time.split(',').map(s => s.trim());
      for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx === -1) continue;
        const dayInput = part.substring(0, colonIdx).trim().toLowerCase();
        const hours = part.substring(colonIdx + 1).trim();
        const matchedDay = dayNames.find(d => dayInput.toLowerCase().startsWith(d));
        if (matchedDay && hours) {
          dayHours[matchedDay + '_hours'] = hours;
        }
      }
    }

    // Defence in depth: never publish a bar whose documents are short of every
    // required document, even if the gates above were ever bypassed.
    const barComplianceStatus = uploadedCount >= COMPLIANCE_REQUIRED_COUNT ? 'approved' : 'pending_review';

    // ── Bar: link to the one this owner already has, otherwise create it ────
    // Approving a submission whose owner already went through the portal flow
    // used to insert a second row with the same bar name.
    let barId;
    let createdBar = false;
    const [[linkedDoc]] = await conn.query(
      "SELECT bar_id FROM bar_registration_documents WHERE registration_id = ? AND bar_id IS NOT NULL ORDER BY id DESC LIMIT 1",
      [regId]
    );
    const [[existingBar]] = linkedDoc && linkedDoc.bar_id
      ? await conn.query("SELECT id FROM bars WHERE id = ?", [linkedDoc.bar_id])
      : await conn.query("SELECT id FROM bars WHERE owner_id = ? ORDER BY id LIMIT 1", [ownerId]);

    if (existingBar) {
      barId = existingBar.id;
      console.log(`APPROVE REGISTRATION #${regId}: linked existing bar #${barId} instead of creating a duplicate`);
      // Fill profile gaps only. compliance_status / lifecycle_status / status
      // belong to the Compliance Queue and the PayMongo activation flow.
      await conn.query(
        `UPDATE bars
            SET description = COALESCE(NULLIF(description, ''), ?),
                address = COALESCE(NULLIF(address, ''), ?),
                city = COALESCE(NULLIF(city, ''), ?),
                state = COALESCE(NULLIF(state, ''), ?),
                phone = COALESCE(NULLIF(phone, ''), ?),
                email = COALESCE(NULLIF(email, ''), ?),
                bar_types = COALESCE(NULLIF(bar_types, ''), ?),
                gcash_number = COALESCE(NULLIF(gcash_number, ''), ?),
                gcash_account_name = COALESCE(NULLIF(gcash_account_name, ''), ?)
          WHERE id = ?`,
        [
          reg.business_description || null,
          reg.business_address,
          reg.business_city,
          reg.business_state,
          reg.business_phone,
          reg.business_email || null,
          barTypesValue,
          reg.gcash_number || null,
          reg.gcash_name || null,
          barId
        ]
      );
    } else {
    let barIns;
    try {
      // `status = 'pending'`, not 'active': the owner must still complete the
      // PayMongo setup before the bar becomes publicly visible / orderable.
      // Promotion to 'active' happens in services/barActivation.js once the
      // payment setup verifies (test-mode handshake or complete live mode).
      [barIns] = await conn.query(
        `INSERT INTO bars (name, description, address, city, state, zip_code, phone, contact_number, email, website, category, price_range, bar_types,
          reservation_time_limit_mode, reservation_time_limit_minutes,
          monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours,
          gcash_number, gcash_account_name, accept_online_payment, accept_gcash,
          owner_id, status, compliance_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, 'pending', ?, NOW(), NOW())`,
        [
          reg.business_name,
          reg.business_description || null,
          reg.business_address,
          reg.business_city,
          reg.business_state,
          reg.business_zip || null,
          reg.business_phone,
          reg.bar_contact_number || reg.business_phone || null,
          reg.business_email || null,
          null,
          categoryValue,
          null,
          barTypesValue,
          timeLimitMode,
          timeLimitMinutes,
          dayHours.monday_hours || null,
          dayHours.tuesday_hours || null,
          dayHours.wednesday_hours || null,
          dayHours.thursday_hours || null,
          dayHours.friday_hours || null,
          dayHours.saturday_hours || null,
          dayHours.sunday_hours || null,
          reg.gcash_number || null,
          reg.gcash_name || null,
          ownerId,
          barComplianceStatus
        ]
      );
      barId = barIns.insertId;
      createdBar = true;
    } catch (e) {
      if (String(e?.sqlMessage || e?.message || "").toLowerCase().includes("unknown column")) {
        [barIns] = await conn.query(
          `INSERT INTO bars (name, description, address, city, state, zip_code, phone, contact_number, email, category, bar_types, owner_id, status, compliance_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())`,
          [reg.business_name, reg.business_description || null, reg.business_address, reg.business_city, reg.business_state, reg.business_zip || null, reg.business_phone, reg.bar_contact_number || reg.business_phone || null, reg.business_email || null, categoryValue, barTypesValue, ownerId, barComplianceStatus]
        );
        barId = barIns.insertId;
        createdBar = true;
      } else {
        throw e;
      }
    }
    }

    // Keep lifecycle_status consistent with status — public/reservation queries
    // require BOTH to be 'active' (COALESCE(lifecycle_status,'active')). Only a
    // brand-new bar starts at 'pending'; an existing one keeps its lifecycle.
    if (createdBar && (await hasLifecycleStatusColumn())) {
      await conn.query("UPDATE bars SET lifecycle_status = 'pending' WHERE id = ?", [barId]);
    }

    // Point the owner account at the bar it owns (existing or new).
    await conn.query("UPDATE users SET bar_id = ? WHERE id = ?", [barId, userId]);

    // ── Status sync: one approval, every status field, one transaction ──────
    // business_registrations.status alone is NOT what the Bar Owner Portal
    // reads. The portal-wide banner and the "Bar compliance status" card come
    // from bars.compliance_status, the 3-day countdown from
    // bars.grace_period_start / bars.temp_visible_until, and the "Auto: …"
    // badge from business_registrations.auto_verification_status. Before this
    // block the approve action left all four untouched, so Super Admin showed
    // APPROVED while the owner still saw "Registration Pending Review" with a
    // live countdown. They are updated here, inside the same transaction.
    if (docsComplete) {
      await conn.query(
        `UPDATE bars
            SET compliance_status = 'approved',
                compliance_rejection_reason = NULL,
                compliance_submitted_at = COALESCE(compliance_submitted_at, NOW()),
                compliance_reviewed_by = ?,
                compliance_reviewed_at = NOW(),
                grace_period_start = NULL,
                temp_visible_until = NULL,
                approval_banner_dismissed = 0
          WHERE id = ?`,
        [req.user.id, barId]
      );
      await conn.query(
        "UPDATE business_registrations SET auto_verification_status = 'passed' WHERE id = ?",
        [regId]
      );
    }

    await conn.commit();

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "APPROVE_REGISTRATION",
      entity: "business_registration",
      entity_id: regId,
      target_bar_id: barId,
      details: { email: reg.owner_email, business: reg.business_name },
      ...auditContext(req),
    });

    // Send approval email to bar owner
    try {
      const ownerFullName = [reg.owner_first_name, reg.owner_middle_name, reg.owner_last_name].filter(Boolean).join(" ");
      await sendBarApprovalEmail(reg.owner_email, ownerFullName, reg.business_name);
    } catch (emailErr) {
      console.error("Failed to send approval email:", emailErr);
      // Don't fail the approval if email fails
    }

    return res.json({ success: true, message: "Registration approved" });
  } catch (err) {
    await conn.rollback();
    console.error("SA APPROVE REGISTRATION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

router.post("/registrations/:id/reject", async (req, res) => {
  try {
    const regId = Number(req.params.id);
    const reason = req.body?.reason || null;

    const [regRows] = await pool.query(
      "SELECT id, owner_email, business_name FROM business_registrations WHERE id = ? LIMIT 1",
      [regId]
    );

    const [result] = await pool.query(
      "UPDATE business_registrations SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ? AND status IN ('pending', 'pending_admin_approval', 'pending_email_verification')",
      [reason, req.user.id, regId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Registration not found or already processed" });
    }

    // Tell the owner when an account already exists for this submission.
    const reg = regRows[0];
    if (reg && reg.owner_email) {
      try {
        const [[ownerUser]] = await pool.query(
          "SELECT id FROM users WHERE email = ? AND role = 'bar_owner' LIMIT 1",
          [reg.owner_email]
        );
        if (ownerUser) {
          await createNotification({
            userIds: [ownerUser.id],
            type: "registration_rejected",
            title: "Registration Not Approved",
            message: `Your bar registration was not approved. Reason: ${reason} You can update your documents and resubmit from Bar Registration.`,
            referenceType: "business_registration",
            referenceId: regId,
            category: "compliance",
            action: "navigate",
            targetRoute: "/bar-registration",
          });
        }
      } catch (notifyErr) {
        console.error("Registration rejection notification failed:", notifyErr.message);
      }
    }

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "REJECT_REGISTRATION",
      entity: "business_registration",
      entity_id: regId,
      details: { reason },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Registration rejected" });
  } catch (err) {
    console.error("SA REJECT REGISTRATION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── COMPLIANCE APPROVAL QUEUE (customer visibility gate) ───────────────────
// A bar stays invisible to customers until compliance_status = 'approved'.
const COMPLIANCE_STATUSES = ["incomplete", "pending_review", "approved", "rejected"];
// COMPLIANCE_DOCUMENTS + COMPLIANCE_REQUIRED_COUNT come from
// config/requiredPermits.js (shared with the Bar Owner form) — never redefine
// a permit list here.

// The one message every approval path must surface when documents are missing.
function incompleteComplianceMessage(uploaded, required) {
  return `Cannot approve — only ${uploaded} of ${required} required documents have been submitted.`;
}

// resolveComplianceDocuments / resolveComplianceRegistrationId live in
// utils/complianceDocuments.js so Permit Monitoring and the approval gates read
// the exact same document records.

async function getBarComplianceOwner(barId) {
  const [[row]] = await pool.query(
    `SELECT bo.user_id, u.email, u.first_name, u.last_name
       FROM bars b
       LEFT JOIN bar_owners bo ON bo.id = b.owner_id
       LEFT JOIN users u ON u.id = bo.user_id
      WHERE b.id = ?
      LIMIT 1`,
    [barId]
  );
  if (row && row.user_id) return row;

  const [[fallback]] = await pool.query(
    "SELECT id AS user_id, email, first_name, last_name FROM users WHERE bar_id = ? AND role = 'bar_owner' AND is_active = 1 LIMIT 1",
    [barId]
  );
  return fallback || null;
}

router.get("/compliance/queue", async (req, res) => {
  try {
    const status = req.query.status || "pending_review";
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (status !== "all" && COMPLIANCE_STATUSES.includes(status)) {
      where.push("b.compliance_status = ?");
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM bars b ${whereSql}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT b.id, b.name, b.address, b.city, b.status, b.lifecycle_status,
              b.compliance_status, b.compliance_rejection_reason,
              b.compliance_submitted_at, b.compliance_reviewed_at,
              b.compliance_reviewed_by, b.created_at,
              COALESCE(u.first_name, '') AS owner_first_name,
              COALESCE(u.last_name, '') AS owner_last_name,
              u.email AS owner_email,
              rv.first_name AS reviewer_first, rv.last_name AS reviewer_last
         FROM bars b
         LEFT JOIN bar_owners bo ON bo.id = b.owner_id
         LEFT JOIN users u ON u.id = bo.user_id
         LEFT JOIN users rv ON rv.id = b.compliance_reviewed_by
         ${whereSql}
         ORDER BY COALESCE(b.compliance_submitted_at, b.created_at) DESC, b.id DESC
         LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const items = [];
    for (const row of rows) {
      const ownerName = [row.owner_first_name, row.owner_last_name].filter(Boolean).join(" ");
      const documents = await resolveComplianceDocuments(row.id, row.owner_email, row.name);
      items.push({
        ...row,
        owner_name: ownerName || null,
        reviewer_name: [row.reviewer_first, row.reviewer_last].filter(Boolean).join(" ") || null,
        submitted_at: row.compliance_submitted_at || row.created_at,
        documents,
        uploaded_count: documents.filter((doc) => doc.uploaded).length,
        required_count: COMPLIANCE_REQUIRED_COUNT,
        registration_id: await resolveComplianceRegistrationId(row.id, row.owner_email, row.name),
      });
    }

    return res.json({
      success: true,
      data: {
        bars: items,
        pagination: {
          page,
          limit,
          total: countRow.total,
          total_pages: Math.ceil(countRow.total / limit),
        },
      },
    });
  } catch (err) {
    console.error("SA COMPLIANCE QUEUE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/compliance/:id/approve", async (req, res) => {
  try {
    const barId = Number(req.params.id);
    if (!Number.isSafeInteger(barId) || barId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid bar id" });
    }

    const [[barRow]] = await pool.query(
      `SELECT b.id, b.name, u.email AS owner_email
         FROM bars b
         LEFT JOIN bar_owners bo ON bo.id = b.owner_id
         LEFT JOIN users u ON u.id = bo.user_id
        WHERE b.id = ?
        LIMIT 1`,
      [barId]
    );
    if (!barRow) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }

    // Integrity gate: a bar can only be published once every required document
    // is on record. The queue shows the same count, so the message matches.
    const documents = await resolveComplianceDocuments(barId, barRow.owner_email, barRow.name);
    const uploadedCount = documents.filter((doc) => doc.uploaded).length;
    if (uploadedCount < COMPLIANCE_REQUIRED_COUNT) {
      return res.status(400).json({
        success: false,
        message: incompleteComplianceMessage(uploadedCount, COMPLIANCE_REQUIRED_COUNT),
        data: { uploaded: uploadedCount, required: COMPLIANCE_REQUIRED_COUNT, documents },
      });
    }

    const [result] = await pool.query(
      `UPDATE bars
          SET compliance_status = 'approved',
              compliance_rejection_reason = NULL,
              compliance_reviewed_by = ?,
              compliance_reviewed_at = NOW(),
              approval_banner_dismissed = 0
        WHERE id = ?`,
      [req.user.id, barId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }

    const owner = await getBarComplianceOwner(barId);
    if (owner && owner.user_id) {
      await createNotification({
        userIds: [owner.user_id],
        type: "bar_compliance_approved",
        title: "Registration Approved 🎉",
        message: `Your bar registration was approved. Your bar is now visible to customers on The Party Goers.`,
        referenceType: "bar",
        referenceId: barId,
        category: "compliance",
        action: "navigate",
        targetRoute: "/dashboard",
      });
    }

    await logAudit(null, {
      bar_id: barId,
      user_id: req.user.id,
      action: "COMPLIANCE_APPROVE",
      entity: "bar",
      entity_id: barId,
      details: { compliance_status: "approved" },
      ...auditContext(req),
    });
    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "APPROVE_COMPLIANCE",
      entity: "bar",
      entity_id: barId,
      target_bar_id: barId,
      details: { compliance_status: "approved" },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Bar approved and published to customers" });
  } catch (err) {
    console.error("SA COMPLIANCE APPROVE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/compliance/:id/reject", async (req, res) => {
  try {
    const barId = Number(req.params.id);
    if (!Number.isSafeInteger(barId) || barId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid bar id" });
    }
    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: "Rejection reason is required" });
    }

    const [[current]] = await pool.query(
      "SELECT name, compliance_status FROM bars WHERE id = ? LIMIT 1",
      [barId]
    );
    if (!current) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }
    // Pulling an already-published bar is a revocation, not a first rejection.
    const revoking = current.compliance_status === "approved";

    const [result] = await pool.query(
      `UPDATE bars
          SET compliance_status = 'rejected',
              compliance_rejection_reason = ?,
              compliance_reviewed_by = ?,
              compliance_reviewed_at = NOW()
        WHERE id = ?`,
      [reason, req.user.id, barId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Bar not found" });
    }

    const owner = await getBarComplianceOwner(barId);
    if (owner && owner.user_id) {
      await createNotification({
        userIds: [owner.user_id],
        type: revoking ? "bar_compliance_revoked" : "bar_compliance_rejected",
        title: revoking ? "Approval Revoked" : "Registration Not Approved",
        message: revoking
          ? `Your bar's compliance approval was revoked. Reason: ${reason} You can update your documents and resubmit from Bar Registration.`
          : `Your bar registration was not approved. Reason: ${reason} You can update your documents and resubmit from Bar Registration.`,
        referenceType: "bar",
        referenceId: barId,
        category: "compliance",
        action: "navigate",
        targetRoute: "/bar-registration",
      });
    }

    await logAudit(null, {
      bar_id: barId,
      user_id: req.user.id,
      action: revoking ? "COMPLIANCE_REVOKE" : "COMPLIANCE_REJECT",
      entity: "bar",
      entity_id: barId,
      details: { compliance_status: "rejected", reason, revoking },
      ...auditContext(req),
    });
    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: revoking ? "REVOKE_COMPLIANCE" : "REJECT_COMPLIANCE",
      entity: "bar",
      entity_id: barId,
      target_bar_id: barId,
      details: { compliance_status: "rejected", reason, revoking },
      ...auditContext(req),
    });

    return res.json({ success: true, message: revoking ? "Compliance approval revoked" : "Registration rejected" });
  } catch (err) {
    console.error("SA COMPLIANCE REJECT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── BAR OWNERS with subscription info ───────────────────────────────
router.get("/bar-owners", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(Number(req.query.limit || 10), 100);
    const offset = (page - 1) * limit;
    const status = req.query.status || "";
    const search = req.query.search || "";

    const where = ["u.role = 'bar_owner'"];
    const params = [];

    if (status === "active") { where.push("u.is_active = 1"); }
    else if (status === "inactive") { where.push("u.is_active = 0"); }
    if (search) {
      where.push("(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR bo.business_name LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u LEFT JOIN bar_owners bo ON bo.user_id = u.id WHERE ${where.join(" AND ")}`,
      params
    );

    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone_number, u.is_active, u.created_at,
              bo.id AS bar_owner_id, bo.business_name, bo.business_email, bo.business_phone,
              bo.subscription_tier, bo.subscription_expires_at,
              (SELECT COUNT(*) FROM bars b WHERE b.owner_id = bo.id) AS bar_count,
              s.id AS subscription_id, sp.display_name AS plan_name, s.status AS sub_status, s.expires_at AS sub_expires
       FROM users u
       LEFT JOIN bar_owners bo ON bo.user_id = u.id
       LEFT JOIN subscriptions s ON s.bar_owner_id = bo.id AND s.status = 'active'
       LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE ${where.join(" AND ")}
       ORDER BY u.id DESC
       LIMIT ? OFFSET ?`,
      dataParams
    );

    return res.json({
      success: true,
      data: {
        owners: rows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          total_pages: Math.ceil(countRow.total / limit),
        },
      },
    });
  } catch (err) {
    console.error("SA LIST BAR OWNERS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── BAR POSTS MANAGEMENT ────────────────────────────────────────────
router.get("/bar-posts", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(Number(req.query.limit || 10), 100);
    const offset = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status || "";

    const where = ["1=1"];
    const params = [];

    if (search) {
      where.push("(bp.content LIKE ? OR b.name LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term);
    }
    if (status === "active") { where.push("bp.status = 'active'"); }
    else if (status === "inactive") { where.push("bp.status != 'active'"); }

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM bar_posts bp LEFT JOIN bars b ON b.id = bp.bar_id WHERE ${where.join(" AND ")}`,
      params
    );

    const dataParams = [...params, limit, offset];
    const [rows] = await pool.query(
      `SELECT bp.*, b.name AS bar_name,
              CONCAT(u.first_name, ' ', u.last_name) AS author_name
       FROM bar_posts bp
       LEFT JOIN bars b ON b.id = bp.bar_id
       LEFT JOIN users u ON u.id = bp.user_id
       WHERE ${where.join(" AND ")}
       ORDER BY bp.created_at DESC
       LIMIT ? OFFSET ?`,
      dataParams
    );

    return res.json({
      success: true,
      data: {
        posts: rows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          total_pages: Math.ceil(countRow.total / limit),
        },
      },
    });
  } catch (err) {
    console.error("SA LIST BAR POSTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/bar-posts/:id/toggle-status", async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const [[post]] = await pool.query("SELECT status FROM bar_posts WHERE id = ?", [postId]);
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    const newStatus = post.status === "active" ? "archived" : "active";
    await pool.query("UPDATE bar_posts SET status = ? WHERE id = ?", [newStatus, postId]);

    return res.json({ success: true, message: `Post ${newStatus === "active" ? "activated" : "deactivated"}` });
  } catch (err) {
    console.error("SA TOGGLE POST STATUS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DYNAMIC RBAC CONTROLS ───────────────────────────────────────────
router.get("/permissions", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, code, description
       FROM permissions
       ORDER BY code ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA LIST PERMISSIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/roles/:roleId/permissions", async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    if (!roleId) return res.status(400).json({ success: false, message: "Invalid role id" });

    const [rows] = await pool.query(
      `SELECT p.id, p.code, p.description
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.code`,
      [roleId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA ROLE PERMISSIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/roles/:roleId/permissions", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const roleId = Number(req.params.roleId);
    const permissionIds = Array.isArray(req.body?.permission_ids)
      ? req.body.permission_ids.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0)
      : null;

    if (!roleId || !permissionIds) {
      return res.status(400).json({ success: false, message: "roleId and permission_ids[] are required" });
    }

    await conn.beginTransaction();
    await conn.query("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);

    if (permissionIds.length) {
      const values = permissionIds.map((id) => [roleId, id]);
      await conn.query("INSERT INTO role_permissions (role_id, permission_id) VALUES ?", [values]);
    }

    await conn.commit();

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UPDATE_ROLE_PERMISSIONS",
      entity: "role",
      entity_id: roleId,
      details: { permission_count: permissionIds.length },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Role permissions updated" });
  } catch (err) {
    await conn.rollback();
    console.error("SA UPDATE ROLE PERMISSIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

router.get("/users/:userId/permissions", async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid user id" });

    const [direct] = await pool.query(
      `SELECT p.id, p.code, p.description
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = ?
       ORDER BY p.code`,
      [userId]
    );

    const [inherited] = await pool.query(
      `SELECT p.id, p.code, p.description
       FROM users u
       JOIN role_permissions rp ON rp.role_id = u.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE u.id = ?
       ORDER BY p.code`,
      [userId]
    );

    return res.json({ success: true, data: { direct_permissions: direct, inherited_permissions: inherited } });
  } catch (err) {
    console.error("SA USER PERMISSIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/users/:userId/permissions", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = Number(req.params.userId);
    const permissionIds = Array.isArray(req.body?.permission_ids)
      ? req.body.permission_ids.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0)
      : null;

    if (!userId || !permissionIds) {
      return res.status(400).json({ success: false, message: "userId and permission_ids[] are required" });
    }

    await conn.beginTransaction();
    await conn.query("DELETE FROM user_permissions WHERE user_id = ?", [userId]);

    if (permissionIds.length) {
      const values = permissionIds.map((id) => [userId, id]);
      await conn.query("INSERT INTO user_permissions (user_id, permission_id) VALUES ?", [values]);
    }

    await conn.commit();

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UPDATE_USER_PERMISSIONS",
      entity: "user",
      entity_id: userId,
      details: { permission_count: permissionIds.length },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "User permissions updated" });
  } catch (err) {
    await conn.rollback();
    console.error("SA UPDATE USER PERMISSIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

// ─── CUSTOMER BANNING OVERSIGHT ──────────────────────────────────────
router.get("/customer-bans/global", async (req, res) => {
  try {
    const status = String(req.query.status || "all").toLowerCase();
    const q = String(req.query.q || "").trim();
    const hasGlobalBan = await hasGlobalBanColumns();
    const hasBanReason = await hasUserBanReasonColumn();

    const where = ["LOWER(u.role) = 'customer'"];
    const params = [];

    if (q) {
      where.push("(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)");
      const term = asLikeTerm(q);
      params.push(term, term, term);
    }

    if (hasGlobalBan) {
      if (status === "banned") where.push("COALESCE(u.is_banned, 0) = 1");
      if (status === "active") where.push("COALESCE(u.is_banned, 0) = 0");

      const [rows] = await pool.query(
        `SELECT u.id AS customer_id,
                u.first_name,
                u.last_name,
                u.email,
                COALESCE(u.is_banned, 0) AS is_banned,
                u.banned_at,
                ${hasBanReason ? "u.ban_reason" : "NULL AS ban_reason"},
                u.banned_by,
                bu.email AS banned_by_email,
                CONCAT(COALESCE(bu.first_name, ''),
                       CASE WHEN bu.last_name IS NULL OR bu.last_name = '' THEN '' ELSE ' ' END,
                       COALESCE(bu.last_name, '')) AS banned_by_name,
                COALESCE(bb.bar_ban_count, 0) AS bar_ban_count
         FROM users u
         LEFT JOIN users bu ON bu.id = u.banned_by
         LEFT JOIN (
            SELECT customer_id, COUNT(*) AS bar_ban_count
            FROM customer_bar_bans
            GROUP BY customer_id
         ) bb ON bb.customer_id = u.id
         WHERE ${where.join(" AND ")}
         ORDER BY is_banned DESC, u.banned_at DESC, u.id DESC
         LIMIT 600`,
        params
      );

      return res.json({ success: true, data: rows });
    }

    if (status === "banned") {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await pool.query(
      `SELECT u.id AS customer_id,
              u.first_name,
              u.last_name,
              u.email,
              0 AS is_banned,
              NULL AS banned_at,
              NULL AS ban_reason,
              NULL AS banned_by,
              NULL AS banned_by_email,
              NULL AS banned_by_name,
              COALESCE(bb.bar_ban_count, 0) AS bar_ban_count
       FROM users u
       LEFT JOIN (
          SELECT customer_id, COUNT(*) AS bar_ban_count
          FROM customer_bar_bans
          GROUP BY customer_id
       ) bb ON bb.customer_id = u.id
       WHERE ${where.join(" AND ")}
       ORDER BY u.id DESC
       LIMIT 600`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA GLOBAL CUSTOMER BANS LIST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/customer-bans/global/:customerId", async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    const banReason = String(req.body?.reason || req.body?.message || "").trim();
    if (!customerId) {
      return res.status(400).json({ success: false, message: "Invalid customerId" });
    }

    const hasGlobalBan = await hasGlobalBanColumns();
    if (!hasGlobalBan) {
      return res.status(500).json({
        success: false,
        message: "Global ban columns missing. Please apply global ban migration.",
      });
    }

    const [[customer]] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [customerId]
    );
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    if (String(customer.role || "").toLowerCase() !== "customer") {
      return res.status(400).json({ success: false, message: "Selected user is not a customer" });
    }

    const hasBanReason = await hasUserBanReasonColumn();
    if (hasBanReason) {
      await pool.query(
        `UPDATE users
         SET is_banned = 1,
             banned_at = NOW(),
             banned_by = ?,
             ban_reason = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [req.user.id, banReason || null, customerId]
      );
    } else {
      await pool.query(
        `UPDATE users
         SET is_banned = 1,
             banned_at = NOW(),
             banned_by = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [req.user.id, customerId]
      );
    }

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "BAN_CUSTOMER_PLATFORM",
      entity: "user",
      entity_id: customerId,
      details: { scope: "global", reason: banReason || null },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: "Customer has been banned from the platform",
    });
  } catch (err) {
    console.error("SA GLOBAL BAN CUSTOMER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/customer-bans/global/:customerId", async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    if (!customerId) {
      return res.status(400).json({ success: false, message: "Invalid customerId" });
    }

    const hasGlobalBan = await hasGlobalBanColumns();
    if (!hasGlobalBan) {
      return res.status(500).json({
        success: false,
        message: "Global ban columns missing. Please apply global ban migration.",
      });
    }

    const [[customer]] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [customerId]
    );
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    if (String(customer.role || "").toLowerCase() !== "customer") {
      return res.status(400).json({ success: false, message: "Selected user is not a customer" });
    }

    const hasBanReason = await hasUserBanReasonColumn();
    if (hasBanReason) {
      await pool.query(
        `UPDATE users
         SET is_banned = 0,
             banned_at = NULL,
             banned_by = NULL,
             ban_reason = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [customerId]
      );
    } else {
      await pool.query(
        `UPDATE users
         SET is_banned = 0,
             banned_at = NULL,
             banned_by = NULL,
             updated_at = NOW()
         WHERE id = ?`,
        [customerId]
      );
    }

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UNBAN_CUSTOMER_PLATFORM",
      entity: "user",
      entity_id: customerId,
      details: { scope: "global" },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: "Customer has been unbanned from the platform",
    });
  } catch (err) {
    console.error("SA GLOBAL UNBAN CUSTOMER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Legacy super-admin bar-level ban endpoints (kept for backward compatibility)
router.get("/customer-bans", async (req, res) => {
  try {
    const hasBarBanReason = await hasCustomerBarBanReasonColumn();
    const status = String(req.query.status || "all").toLowerCase();
    const q = String(req.query.q || "").trim();
    const barId = Number(req.query.bar_id || 0);
    const where = ["LOWER(u.role) = 'customer'"];
    const params = [];

    if (barId) {
      where.push("x.bar_id = ?");
      params.push(barId);
    }
    if (q) {
      where.push("(u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR b.name LIKE ?)");
      const term = asLikeTerm(q);
      params.push(term, term, term, term);
    }
    if (status === "banned") where.push("cbb.id IS NOT NULL");
    if (status === "active") where.push("cbb.id IS NULL");

    const [rows] = await pool.query(
            `SELECT x.bar_id, b.name AS bar_name,
              b.status AS bar_status,
              COALESCE(b.lifecycle_status, 'active') AS bar_lifecycle_status,
              CASE
                WHEN b.status = 'inactive' OR COALESCE(b.lifecycle_status, 'active') = 'suspended'
                THEN NULLIF(TRIM(b.suspension_message), '')
                ELSE NULL
              END AS bar_ban_reason,
              CASE
                WHEN b.status = 'inactive' OR COALESCE(b.lifecycle_status, 'active') = 'suspended'
                THEN b.updated_at
                ELSE NULL
              END AS bar_banned_at,
              u.id AS customer_id, u.first_name, u.last_name, u.email, u.role AS customer_role,
              MAX(x.last_interaction_at) AS last_interaction_at,
              CASE WHEN cbb.id IS NULL THEN 0 ELSE 1 END AS is_banned,
              cbb.banned_at,
              ${hasBarBanReason ? "cbb.ban_reason" : "NULL AS ban_reason"}
       FROM (
          SELECT r.bar_id, r.customer_user_id AS customer_id, MAX(r.created_at) AS last_interaction_at
          FROM reservations r
          WHERE r.customer_user_id IS NOT NULL
          GROUP BY r.bar_id, r.customer_user_id
          UNION ALL
          SELECT rv.bar_id, rv.customer_id AS customer_id, MAX(rv.created_at) AS last_interaction_at
          FROM reviews rv
          GROUP BY rv.bar_id, rv.customer_id
          UNION ALL
          SELECT bf.bar_id, bf.user_id AS customer_id, MAX(bf.created_at) AS last_interaction_at
          FROM bar_followers bf
          GROUP BY bf.bar_id, bf.user_id
       ) x
       JOIN users u ON u.id = x.customer_id
       JOIN bars b ON b.id = x.bar_id
       LEFT JOIN customer_bar_bans cbb ON cbb.bar_id = x.bar_id AND cbb.customer_id = x.customer_id
       WHERE ${where.join(" AND ")}
      GROUP BY x.bar_id, b.name, b.status, b.lifecycle_status, b.suspension_message, b.updated_at, u.id, u.first_name, u.last_name, u.email, u.role, cbb.id, cbb.banned_at, ${hasBarBanReason ? "cbb.ban_reason" : "NULL"}
       ORDER BY is_banned DESC, last_interaction_at DESC
       LIMIT 600`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA CUSTOMER BANS OVERSIGHT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/customer-bans/:barId/:customerId", async (req, res) => {
  try {
    const hasBarBanReason = await hasCustomerBarBanReasonColumn();
    const barId = Number(req.params.barId);
    const customerId = Number(req.params.customerId);
    const reasonRaw = String(req.body?.reason || req.body?.ban_reason || "").trim();
    const reason = reasonRaw ? reasonRaw.slice(0, 500) : null;
    if (!barId || !customerId) {
      return res.status(400).json({ success: false, message: "Invalid barId/customerId" });
    }

    const [[targetUser]] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [customerId]
    );
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    if (String(targetUser.role || "").toLowerCase() !== "customer") {
      return res.status(400).json({
        success: false,
        message: "Per-bar bans are customer-only. To block bar owners/staff, deactivate the bar or disable the account.",
      });
    }

    if (hasBarBanReason) {
      await pool.query(
        `INSERT INTO customer_bar_bans (bar_id, customer_id, ban_reason, banned_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE ban_reason = VALUES(ban_reason), banned_at = NOW()`,
        [barId, customerId, reason]
      );
    } else {
      await pool.query("INSERT IGNORE INTO customer_bar_bans (bar_id, customer_id) VALUES (?, ?)", [barId, customerId]);
    }

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "BAN_CUSTOMER",
      entity: "customer_bar_ban",
      entity_id: customerId,
      target_bar_id: barId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Customer banned" });
  } catch (err) {
    console.error("SA BAN CUSTOMER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/customer-bans/:barId/:customerId", async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    const customerId = Number(req.params.customerId);
    if (!barId || !customerId) {
      return res.status(400).json({ success: false, message: "Invalid barId/customerId" });
    }

    await pool.query("DELETE FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ?", [barId, customerId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "UNBAN_CUSTOMER",
      entity: "customer_bar_ban",
      entity_id: customerId,
      target_bar_id: barId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Customer unbanned" });
  } catch (err) {
    console.error("SA UNBAN CUSTOMER ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── EVENTS FEED & MODERATION ────────────────────────────────────────
router.get("/events/feed", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "all").toLowerCase();
    const barId = Number(req.query.bar_id || 0);
    const limit = Math.min(Number(req.query.limit || 300), 500);

    const where = ["1=1"];
    const params = [];

    if (status !== "all") {
      if (status === "archived") where.push("be.archived_at IS NOT NULL");
      else where.push("be.status = ?");
      if (status !== "archived") params.push(status);
    }
    if (barId) {
      where.push("be.bar_id = ?");
      params.push(barId);
    }
    if (q) {
      where.push("(be.title LIKE ? OR be.description LIKE ? OR b.name LIKE ?)");
      const term = asLikeTerm(q);
      params.push(term, term, term);
    }

    const [rows] = await pool.query(
      `SELECT be.id, be.bar_id, b.name AS bar_name, be.title, be.description,
              be.event_date, be.start_time, be.end_time, be.status, be.image_path,
              be.archived_at, be.created_at, be.updated_at,
              (SELECT COUNT(*) FROM event_likes el WHERE el.event_id = be.id) AS like_count,
              (SELECT COUNT(*) FROM event_comments ec WHERE ec.event_id = be.id AND ec.status = 'active') AS comment_count,
              (SELECT COUNT(*) FROM bar_followers bf WHERE bf.bar_id = be.bar_id) AS follower_count
       FROM bar_events be
       JOIN bars b ON b.id = be.bar_id
       WHERE ${where.join(" AND ")}
       ORDER BY be.created_at DESC
       LIMIT ${limit}`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA EVENTS FEED ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/events/:id/comments", async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    if (!eventId) return res.status(400).json({ success: false, message: "Invalid event id" });

    const [rows] = await pool.query(
      `SELECT ec.id, ec.event_id, ec.user_id, ec.comment, ec.status, ec.created_at, ec.updated_at,
              u.first_name, u.last_name, u.email,
              be.bar_id, b.name AS bar_name, be.title AS event_title
       FROM event_comments ec
       JOIN users u ON u.id = ec.user_id
       JOIN bar_events be ON be.id = ec.event_id
       JOIN bars b ON b.id = be.bar_id
       WHERE ec.event_id = ?
       ORDER BY ec.created_at DESC
       LIMIT 500`,
      [eventId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA EVENT COMMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/events/comments/:commentId/flag", async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    if (!commentId) return res.status(400).json({ success: false, message: "Invalid comment id" });

    await pool.query(
      "UPDATE event_comments SET status = 'deleted', updated_at = NOW() WHERE id = ? AND status = 'active'",
      [commentId]
    );

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "FLAG_EVENT_COMMENT",
      entity: "event_comment",
      entity_id: commentId,
      details: { reason: req.body?.reason || null },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Comment flagged" });
  } catch (err) {
    console.error("SA FLAG EVENT COMMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/events/comments/:commentId", async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    if (!commentId) return res.status(400).json({ success: false, message: "Invalid comment id" });

    await pool.query(
      "UPDATE event_comments SET status = 'deleted', updated_at = NOW() WHERE id = ?",
      [commentId]
    );

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "DELETE_EVENT_COMMENT",
      entity: "event_comment",
      entity_id: commentId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Comment deleted" });
  } catch (err) {
    console.error("SA DELETE EVENT COMMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/events/:id/archive", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const eventId = Number(req.params.id);
    if (!eventId) return res.status(400).json({ success: false, message: "Invalid event id" });

    await conn.beginTransaction();
    const [eventRows] = await conn.query(
      `SELECT id, bar_id, title, description, event_date, start_time, end_time,
              entry_price, max_capacity, current_bookings, status, image_url, image_path,
              created_at, updated_at
       FROM bar_events
       WHERE id = ?
       LIMIT 1`,
      [eventId]
    );

    if (!eventRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Event not found" });
    }

    const event = eventRows[0];
    await conn.query(
      `INSERT INTO bar_events_archive
       (original_event_id, bar_id, title, description, event_date, start_time, end_time,
        entry_price, max_capacity, current_bookings, status, image_url, image_path,
        original_created_at, original_updated_at, archived_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.bar_id,
        event.title,
        event.description,
        event.event_date,
        event.start_time,
        event.end_time,
        event.entry_price,
        event.max_capacity,
        event.current_bookings,
        event.status,
        event.image_url,
        event.image_path,
        event.created_at,
        event.updated_at,
        req.user.id,
      ]
    );

    await conn.query(
      "UPDATE bar_events SET status = 'cancelled', archived_at = NOW(), updated_at = NOW() WHERE id = ?",
      [eventId]
    );

    await conn.commit();

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "ARCHIVE_EVENT",
      entity: "bar_event",
      entity_id: eventId,
      target_bar_id: event.bar_id,
      details: { reason: req.body?.reason || null },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Event archived" });
  } catch (err) {
    await conn.rollback();
    console.error("SA ARCHIVE EVENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

// ─── POS OVERSIGHT ───────────────────────────────────────────────────
router.get("/pos/overview", async (req, res) => {
  try {
    const barId = Number(req.query.bar_id || 0);
    const status = String(req.query.status || "all").toLowerCase();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    const limit = Math.min(Number(req.query.limit || 200), 500);

    const where = ["1=1"];
    const params = [];
    if (barId) {
      where.push("o.bar_id = ?");
      params.push(barId);
    }
    if (status !== "all") {
      where.push("o.status = ?");
      params.push(status);
    }
    if (from && to) {
      where.push("DATE(o.created_at) BETWEEN ? AND ?");
      params.push(from, to);
    }

    const [orders] = await pool.query(
      `SELECT o.id, o.bar_id, b.name AS bar_name, o.table_id, t.table_number,
              o.staff_user_id, CONCAT(u.first_name, ' ', u.last_name) AS staff_name,
              o.order_number, o.status, o.total_amount, o.payment_method,
              o.created_at, o.completed_at
       FROM pos_orders o
       LEFT JOIN bars b ON b.id = o.bar_id
       LEFT JOIN bar_tables t ON t.id = o.table_id
       LEFT JOIN users u ON u.id = o.staff_user_id
       WHERE ${where.join(" AND ")}
       ORDER BY o.created_at DESC
       LIMIT ${limit}`,
      params
    );

    const [summaryRows] = await pool.query(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(CASE WHEN o.status = 'pending' THEN 1 ELSE 0 END) AS pending_orders,
         SUM(CASE WHEN o.status = 'completed' THEN 1 ELSE 0 END) AS completed_orders,
         SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_orders,
         COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total_amount ELSE 0 END), 0) AS completed_revenue
       FROM pos_orders o
       WHERE ${where.join(" AND ")}`,
      params
    );

    const [roleMappings] = await pool.query(
      `SELECT r.id AS role_id, r.name AS role_name,
              GROUP_CONCAT(p.code ORDER BY p.code SEPARATOR ', ') AS pos_permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id AND p.code LIKE 'POS%'
       GROUP BY r.id, r.name
       ORDER BY r.name`
    );

    return res.json({ success: true, data: { summary: summaryRows[0] || {}, orders, role_mappings: roleMappings } });
  } catch (err) {
    console.error("SA POS OVERVIEW ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── RESERVATION OVERSIGHT ───────────────────────────────────────────
router.get("/reservations/oversight", async (req, res) => {
  try {
    const barId = Number(req.query.bar_id || 0);
    const status = String(req.query.status || "all").toLowerCase();
    const paymentStatus = String(req.query.payment_status || "all").toLowerCase();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();
    const limit = Math.min(Number(req.query.limit || 300), 600);

    const where = ["1=1"];
    const params = [];
    if (barId) {
      where.push("r.bar_id = ?");
      params.push(barId);
    }
    if (status !== "all") {
      where.push("r.status = ?");
      params.push(status);
    }
    if (paymentStatus !== "all") {
      where.push("COALESCE(r.payment_status, 'pending') = ?");
      params.push(paymentStatus);
    }
    if (from && to) {
      where.push("r.reservation_date BETWEEN ? AND ?");
      params.push(from, to);
    }

    const [rows] = await pool.query(
      `SELECT r.id, r.bar_id, b.name AS bar_name, r.table_id, t.table_number,
              r.customer_user_id, CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
              r.guest_name, r.guest_email,
              r.reservation_date, r.reservation_time, r.party_size, r.status,
              r.payment_status, r.payment_method, r.deposit_amount, r.payment_reference,
              r.created_at,
              (
                SELECT COUNT(*)
                FROM reservations r2
                WHERE r2.bar_id = r.bar_id
                  AND r2.table_id = r.table_id
                  AND r2.reservation_date = r.reservation_date
                  AND r2.reservation_time = r.reservation_time
                  AND r2.status IN ('pending', 'approved')
              ) AS reservation_slot_count
       FROM reservations r
       JOIN bars b ON b.id = r.bar_id
       LEFT JOIN bar_tables t ON t.id = r.table_id
       LEFT JOIN users u ON u.id = r.customer_user_id
       WHERE ${where.join(" AND ")}
       ORDER BY r.created_at DESC
       LIMIT ${limit}`,
      params
    );

    const withFlags = rows.map((row) => ({
      ...row,
      has_double_booking: Number(row.reservation_slot_count || 0) > 1,
      has_deposit_issue:
        String(row.status || "") === "approved" &&
        ["paid", "pending"].includes(String(row.payment_status || "pending")) &&
        (row.deposit_amount === null || Number(row.deposit_amount) <= 0),
    }));

    return res.json({ success: true, data: withFlags });
  } catch (err) {
    console.error("SA RESERVATION OVERSIGHT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PLATFORM AUDIT LOGS ─────────────────────────────────────────────
router.get("/platform-audit-logs", async (req, res) => {
  try {
    const action = String(req.query.action || "").trim();
    const entity = String(req.query.entity || "").trim();
    const entityLike = String(req.query.entity_like || "").trim();
    const barId = Number(req.query.bar_id || 0);
    const limit = Math.min(Number(req.query.limit || 300), 600);
    const where = ["1=1"];
    const params = [];

    if (action) {
      // Support comma-separated action list
      const actions = action.split(',').map(a => a.trim()).filter(Boolean);
      if (actions.length === 1) {
        where.push("pa.action LIKE ?");
        params.push(asLikeTerm(actions[0]));
      } else if (actions.length > 1) {
        where.push(`pa.action IN (${actions.map(() => '?').join(',')})`);
        params.push(...actions);
      }
    }
    if (entity) {
      // Support comma-separated entity list
      const entities = entity.split(',').map(e => e.trim()).filter(Boolean);
      if (entities.length === 1) {
        where.push("pa.entity = ?");
        params.push(entities[0]);
      } else if (entities.length > 1) {
        where.push(`pa.entity IN (${entities.map(() => '?').join(',')})`);
        params.push(...entities);
      }
    }
    if (entityLike) {
      where.push("pa.entity LIKE ?");
      params.push(asLikeTerm(entityLike));
    }
    if (barId) {
      where.push("pa.target_bar_id = ?");
      params.push(barId);
    }

    const [rows] = await pool.query(
      `SELECT pa.id, pa.actor_user_id, pa.action, pa.entity, pa.entity_id, pa.target_bar_id,
              pa.details, pa.ip_address, pa.user_agent, pa.created_at,
              CONCAT(u.first_name, ' ', u.last_name) AS actor_name,
              u.email AS actor_email,
              b.name AS bar_name
       FROM platform_audit_logs pa
       LEFT JOIN users u ON u.id = pa.actor_user_id
       LEFT JOIN bars b ON b.id = pa.target_bar_id
       WHERE ${where.join(" AND ")}
       ORDER BY pa.id DESC
       LIMIT ${limit}`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA PLATFORM AUDIT LOGS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── BAR POST COMMENTS MODERATION ────────────────────────────────────

/**
 * GET /super-admin/bar-posts/:postId/comments
 * List all comments (and replies) on a specific bar post
 */
router.get("/bar-posts/:postId/comments", async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    if (!postId) return res.status(400).json({ success: false, message: "Invalid post id" });

    const [comments] = await pool.query(
      `SELECT bpc.id, bpc.post_id, bpc.comment, bpc.status,
              bpc.parent_comment_id, bpc.created_at, bpc.updated_at,
              CONCAT(u.first_name, ' ', u.last_name) AS author_name,
              u.email AS author_email, u.id AS author_id
       FROM bar_post_comments bpc
       LEFT JOIN users u ON u.id = bpc.user_id
       WHERE bpc.post_id = ?
       ORDER BY bpc.created_at ASC`,
      [postId]
    );

    return res.json({ success: true, data: comments });
  } catch (err) {
    console.error("SA GET POST COMMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * DELETE /super-admin/bar-posts/comments/:commentId
 * Remove (soft-delete) a specific bar post comment
 */
router.delete("/bar-posts/comments/:commentId", async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    if (!commentId) return res.status(400).json({ success: false, message: "Invalid comment id" });

    const [[comment]] = await pool.query("SELECT id, post_id FROM bar_post_comments WHERE id = ? LIMIT 1", [commentId]);
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

    await pool.query("UPDATE bar_post_comments SET status = 'deleted', updated_at = NOW() WHERE id = ?", [commentId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: "DELETE_POST_COMMENT",
      entity: "bar_post_comment",
      entity_id: commentId,
      details: { post_id: comment.post_id },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Comment removed" });
  } catch (err) {
    console.error("SA DELETE POST COMMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── EVENT COMMENTS MODERATION ───────────────────────────────────────

/**
 * GET /super-admin/event-comments?bar_id=&status=&limit=&search=
 * List all event comments across the platform
 */
router.get("/event-comments", async (req, res) => {
  try {
    const { bar_id, status, search, limit = 200 } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (bar_id) {
      where += " AND be.bar_id = ?";
      params.push(Number(bar_id));
    }
    if (status === "active") {
      where += " AND ec.status = 'active'";
    } else if (status === "deleted") {
      where += " AND ec.status = 'deleted'";
    }
    if (search) {
      where += " AND (ec.comment LIKE ? OR be.title LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term);
    }

    const [rows] = await pool.query(
      `SELECT ec.id, ec.event_id, ec.comment, ec.status, ec.created_at, ec.updated_at,
              be.title AS event_title, be.event_date,
              b.id AS bar_id, b.name AS bar_name,
              CONCAT(u.first_name, ' ', u.last_name) AS author_name,
              u.email AS author_email, u.id AS author_id
       FROM event_comments ec
       JOIN bar_events be ON be.id = ec.event_id
       JOIN bars b ON b.id = be.bar_id
       LEFT JOIN users u ON u.id = ec.user_id
       ${where}
       ORDER BY ec.created_at DESC
       LIMIT ?`,
      [...params, Math.min(Number(limit), 500)]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA GET EVENT COMMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PATCH /super-admin/event-comments/:commentId
 * Soft-delete an event comment
 * Body: { status: 'deleted' }
 */
router.patch("/event-comments/:commentId", async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const { status } = req.body || {};

    if (!commentId) return res.status(400).json({ success: false, message: "Invalid comment id" });
    if (!["active", "deleted"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'active' or 'deleted'" });
    }

    const [[comment]] = await pool.query("SELECT id, event_id FROM event_comments WHERE id = ? LIMIT 1", [commentId]);
    if (!comment) return res.status(404).json({ success: false, message: "Comment not found" });

    await pool.query("UPDATE event_comments SET status = ?, updated_at = NOW() WHERE id = ?", [status, commentId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: status === "deleted" ? "DELETE_EVENT_COMMENT" : "RESTORE_EVENT_COMMENT",
      entity: "event_comment",
      entity_id: commentId,
      details: { event_id: comment.event_id },
      ...auditContext(req),
    });

    return res.json({ success: true, message: `Comment ${status === "deleted" ? "removed" : "restored"}` });
  } catch (err) {
    console.error("SA PATCH EVENT COMMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /super-admin/event-comments/:commentId/replies
 * Get all replies to an event comment
 */
router.get("/event-comments/:commentId/replies", async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    if (!commentId) return res.status(400).json({ success: false, message: "Invalid comment id" });

    const [rows] = await pool.query(
      `SELECT ecr.id, ecr.event_comment_id, ecr.reply, ecr.status, ecr.created_at, ecr.updated_at,
              CONCAT(u.first_name, ' ', u.last_name) AS author_name,
              u.email AS author_email, u.id AS author_id
       FROM event_comment_replies ecr
       LEFT JOIN users u ON u.id = ecr.user_id
       WHERE ecr.event_comment_id = ?
       ORDER BY ecr.created_at ASC`,
      [commentId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("SA GET COMMENT REPLIES ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * PATCH /super-admin/event-comment-replies/:replyId
 * Delete/restore an event comment reply
 */
router.patch("/event-comment-replies/:replyId", async (req, res) => {
  try {
    const replyId = Number(req.params.replyId);
    const { status } = req.body || {};

    if (!replyId) return res.status(400).json({ success: false, message: "Invalid reply id" });
    if (!["active", "deleted"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'active' or 'deleted'" });
    }

    const [[reply]] = await pool.query("SELECT id FROM event_comment_replies WHERE id = ? LIMIT 1", [replyId]);
    if (!reply) return res.status(404).json({ success: false, message: "Reply not found" });

    await pool.query("UPDATE event_comment_replies SET status = ?, updated_at = NOW() WHERE id = ?", [status, replyId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: status === "deleted" ? "DELETE_EVENT_REPLY" : "RESTORE_EVENT_REPLY",
      entity: "event_comment_reply",
      entity_id: replyId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: `Reply ${status === "deleted" ? "removed" : "restored"}` });
  } catch (err) {
    console.error("SA PATCH EVENT REPLY ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POS ORDERS OVERVIEW ─────────────────────────────────────────────

/**
 * GET /super-admin/pos-orders?bar_id=&status=&from=&to=&limit=&search=
 * List all POS orders across all bars
 */
router.get("/pos-orders", async (req, res) => {
  try {
    const { bar_id, status, from, to, search, limit = 200 } = req.query;

    let where = "WHERE 1=1";
    const params = [];

    if (bar_id) {
      where += " AND o.bar_id = ?";
      params.push(Number(bar_id));
    }
    if (status) {
      where += " AND o.status = ?";
      params.push(status);
    }
    if (from && to) {
      where += " AND DATE(o.created_at) BETWEEN ? AND ?";
      params.push(from, to);
    }
    if (search) {
      where += " AND (o.order_number LIKE ? OR b.name LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term);
    }

    const [orders] = await pool.query(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.payment_method,
              o.subtotal, o.discount_amount, o.total_amount,
              o.amount_received, o.change_amount, o.notes,
              o.completed_at, o.cancelled_at, o.created_at,
              b.id AS bar_id, b.name AS bar_name,
              t.table_number,
              CONCAT(u.first_name, ' ', u.last_name) AS staff_name
       FROM pos_orders o
       JOIN bars b ON b.id = o.bar_id
       LEFT JOIN bar_tables t ON t.id = o.table_id
       LEFT JOIN users u ON u.id = o.staff_user_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ?`,
      [...params, Math.min(Number(limit), 1000)]
    );

    return res.json({ success: true, data: orders });
  } catch (err) {
    console.error("SA GET POS ORDERS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /super-admin/pos-orders/:orderId
 * POS order detail with line items
 */
router.get("/pos-orders/:orderId", async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!orderId) return res.status(400).json({ success: false, message: "Invalid order id" });

    const [[order]] = await pool.query(
      `SELECT o.*, b.name AS bar_name, t.table_number,
              CONCAT(u.first_name, ' ', u.last_name) AS staff_name
       FROM pos_orders o
       JOIN bars b ON b.id = o.bar_id
       LEFT JOIN bar_tables t ON t.id = o.table_id
       LEFT JOIN users u ON u.id = o.staff_user_id
       WHERE o.id = ? LIMIT 1`,
      [orderId]
    );
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const [items] = await pool.query(
      `SELECT poi.id, poi.menu_item_id, poi.item_name, poi.quantity,
              poi.unit_price, poi.line_total, poi.notes
       FROM pos_order_items poi
       WHERE poi.order_id = ?
       ORDER BY poi.id ASC`,
      [orderId]
    );

    return res.json({ success: true, data: { ...order, items } });
  } catch (err) {
    console.error("SA GET POS ORDER DETAIL ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── RESERVATION DETAIL WITH ITEMS ───────────────────────────────────

/**
 * GET /super-admin/reservations/:reservationId
 * Full reservation detail, including reservation_items if available
 */
router.get("/reservations/:reservationId", async (req, res) => {
  try {
    const reservationId = Number(req.params.reservationId);
    if (!reservationId) return res.status(400).json({ success: false, message: "Invalid reservation id" });

    const [[reservation]] = await pool.query(
      `SELECT r.*, b.name AS bar_name, b.address AS bar_address,
              t.table_number, t.capacity AS table_capacity,
              CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
              u.email AS customer_email, u.phone_number AS customer_phone
       FROM reservations r
       JOIN bars b ON b.id = r.bar_id
       LEFT JOIN bar_tables t ON t.id = r.table_id
       LEFT JOIN users u ON u.id = r.customer_user_id
       WHERE r.id = ? LIMIT 1`,
      [reservationId]
    );
    if (!reservation) return res.status(404).json({ success: false, message: "Reservation not found" });

    // Check if reservation_items table exists
    const [riCheck] = await pool.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation_items' LIMIT 1`
    );

    let items = [];
    if (riCheck.length) {
      const [itemRows] = await pool.query(
        `SELECT ri.id, ri.menu_item_id, m.menu_name, m.category,
                ri.quantity, ri.unit_price,
                (ri.quantity * ri.unit_price) AS line_total
         FROM reservation_items ri
         JOIN menu_items m ON m.id = ri.menu_item_id
         WHERE ri.reservation_id = ?
         ORDER BY m.menu_name`,
        [reservationId]
      );
      items = itemRows;
    }

    return res.json({ success: true, data: { ...reservation, items } });
  } catch (err) {
    console.error("SA GET RESERVATION DETAIL ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── SOCIAL POSTS MODERATION ─────────────────────────────────────────
router.get("/social/posts", async (req, res) => {
  try {
    const { bar_id, status = 'active', limit = 100 } = req.query;
    const where = [];
    const params = [];

    if (bar_id) {
      where.push("bp.bar_id = ?");
      params.push(parseInt(bar_id));
    }
    if (status) {
      where.push("bp.status = ?");
      params.push(status);
    }

    const [posts] = await pool.query(
      `SELECT bp.id, bp.content, bp.image_path, bp.status,
              (SELECT COUNT(*) FROM bar_post_likes bpl WHERE bpl.post_id = bp.id) AS like_count,
              (SELECT COUNT(*) FROM bar_post_comments bpc WHERE bpc.post_id = bp.id AND bpc.status = 'active') AS comment_count,
              bp.created_at,
              b.name AS bar_name, b.logo_path AS bar_logo,
              CONCAT(u.first_name, ' ', u.last_name) AS author_name,
              u.email AS author_email
       FROM bar_posts bp
       JOIN bars b ON b.id = bp.bar_id
       JOIN users u ON u.id = bp.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY bp.created_at DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    return res.json({ success: true, data: posts });
  } catch (err) {
    console.error("SA GET SOCIAL POSTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/social/posts/:postId/comments", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const [comments] = await pool.query(
      `SELECT pc.id, pc.comment, pc.created_at, pc.status, pc.parent_comment_id,
              CONCAT(u.first_name, ' ', u.last_name) AS commenter_name,
              u.email AS commenter_email,
              u.profile_picture
       FROM bar_post_comments pc
       JOIN users u ON u.id = pc.user_id
       WHERE pc.post_id = ? AND pc.status = 'active'
       ORDER BY pc.created_at ASC`,
      [postId]
    );

    return res.json({ success: true, data: comments });
  } catch (err) {
    console.error("SA GET POST COMMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/social/posts/:postId", async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const { status } = req.body;

    if (!['active', 'archived', 'deleted'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    await pool.query("UPDATE bar_posts SET status = ? WHERE id = ?", [status, postId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: status === 'deleted' ? 'DELETE_POST' : 'UPDATE_POST_STATUS',
      entity: 'bar_post',
      entity_id: postId,
      details: { status },
      ...auditContext(req),
    });

    return res.json({ success: true, message: `Post ${status}` });
  } catch (err) {
    console.error("SA UPDATE POST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/social/comments/:commentId", async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);

    if (!Number.isInteger(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid comment id" });
    }

    const [[comment]] = await pool.query(
      "SELECT id FROM bar_post_comments WHERE id = ? LIMIT 1",
      [commentId]
    );

    if (comment) {
      // Soft-delete the comment plus its whole reply thread (replies share the
      // parent_comment_id; nested reply rows are removed outright since
      // bar_comment_replies has no status column).
      await pool.query(
        "UPDATE bar_post_comments SET status = 'deleted', updated_at = NOW() WHERE id = ? OR parent_comment_id = ?",
        [commentId, commentId]
      );
      await pool.query(
        `DELETE FROM bar_comment_replies
         WHERE comment_id = ? OR comment_id IN (SELECT id FROM bar_post_comments WHERE parent_comment_id = ?)`,
        [commentId, commentId]
      );
    } else {
      // Fall back to the replies table: reply ids live in bar_comment_replies,
      // so deleting a reply id against bar_post_comments would silently affect 0 rows.
      const [[reply]] = await pool.query(
        "SELECT id FROM bar_comment_replies WHERE id = ? LIMIT 1",
        [commentId]
      );
      if (!reply) {
        return res.status(404).json({ success: false, message: "Comment not found. It may have been deleted already." });
      }
      await pool.query("DELETE FROM bar_comment_replies WHERE id = ?", [commentId]);
    }

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: 'DELETE_POST_COMMENT',
      entity: 'post_comment',
      entity_id: commentId,
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Comment deleted" });
  } catch (err) {
    console.error("SA DELETE COMMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

async function hasCommentReportsTable() {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comment_reports' LIMIT 1`
  );
  return rows.length > 0;
}

async function removeCommentByType(commentId, commentType) {
  if (commentType === "post_comment") {
    const [result] = await pool.query(
      "UPDATE bar_post_comments SET status = 'deleted' WHERE id = ? OR parent_comment_id = ?",
      [commentId, commentId]
    );
    await pool.query("DELETE FROM bar_comment_replies WHERE comment_id = ?", [commentId]);
    return result.affectedRows > 0;
  }
  if (commentType === "event_comment") {
    const [result] = await pool.query("UPDATE event_comments SET status = 'deleted' WHERE id = ?", [commentId]);
    return result.affectedRows > 0;
  }
  if (commentType === "post_reply") {
    const [replyResult] = await pool.query("DELETE FROM bar_comment_replies WHERE id = ?", [commentId]);
    const [commentResult] = await pool.query(
      "UPDATE bar_post_comments SET status = 'deleted' WHERE id = ? AND parent_comment_id IS NOT NULL",
      [commentId]
    );
    return replyResult.affectedRows > 0 || commentResult.affectedRows > 0;
  }
  if (commentType === "event_reply") {
    const [result] = await pool.query("DELETE FROM event_comment_replies WHERE id = ?", [commentId]);
    return result.affectedRows > 0;
  }
  return false;
}

router.get("/social/comment-reports", async (req, res) => {
  try {
    const tableExists = await hasCommentReportsTable();
    if (!tableExists) {
      return res.json({ success: true, data: [] });
    }

    const { status = "pending", comment_type, limit = 200 } = req.query;
    const where = [];
    const params = [];

    const allowedStatuses = ["pending", "reviewed", "dismissed", "all"];
    if (!allowedStatuses.includes(String(status))) {
      return res.status(400).json({ success: false, message: "Invalid status filter" });
    }

    if (status !== "all") {
      where.push("cr.status = ?");
      params.push(status);
    }

    const allowedCommentTypes = ["post_comment", "event_comment", "post_reply", "event_reply"];
    if (comment_type) {
      if (!allowedCommentTypes.includes(String(comment_type))) {
        return res.status(400).json({ success: false, message: "Invalid comment_type filter" });
      }
      where.push("cr.comment_type = ?");
      params.push(comment_type);
    }

    const limitValue = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);

    const [reports] = await pool.query(
      `SELECT cr.id, cr.comment_id, cr.comment_type, cr.reason, cr.details,
              cr.status, cr.reported_at,
              CONCAT(reporter.first_name, ' ', reporter.last_name) AS reporter_name,
              reporter.email AS reporter_email,
              CASE
                WHEN cr.comment_type = 'post_comment' THEN pc.comment
                WHEN cr.comment_type = 'event_comment' THEN ec.comment
                WHEN cr.comment_type = 'post_reply' THEN pcr.reply
                WHEN cr.comment_type = 'event_reply' THEN ecr.reply
                ELSE NULL
              END AS comment_text,
              CASE
                WHEN cr.comment_type = 'post_comment' THEN CONCAT(pc_user.first_name, ' ', pc_user.last_name)
                WHEN cr.comment_type = 'event_comment' THEN CONCAT(ec_user.first_name, ' ', ec_user.last_name)
                WHEN cr.comment_type = 'post_reply' THEN CONCAT(pcr_user.first_name, ' ', pcr_user.last_name)
                WHEN cr.comment_type = 'event_reply' THEN CONCAT(ecr_user.first_name, ' ', ecr_user.last_name)
                ELSE NULL
              END AS comment_author_name,
              CASE
                WHEN cr.comment_type = 'post_comment' THEN pc_user.email
                WHEN cr.comment_type = 'event_comment' THEN ec_user.email
                WHEN cr.comment_type = 'post_reply' THEN pcr_user.email
                WHEN cr.comment_type = 'event_reply' THEN ecr_user.email
                ELSE NULL
              END AS comment_author_email,
              COALESCE(post_bar.name, event_bar.name, post_reply_bar.name, event_reply_bar.name) AS bar_name,
              COALESCE(post_data.content, event_data.title, post_reply_data.content, event_reply_data.title) AS parent_content,
              COALESCE(event_data.title, event_reply_data.title) AS event_title,
              (
                SELECT COUNT(*)
                FROM comment_reports cr2
                WHERE cr2.comment_id = cr.comment_id
                  AND cr2.comment_type = cr.comment_type
                  AND cr2.status = 'pending'
              ) AS pending_report_count
       FROM comment_reports cr
       JOIN users reporter ON reporter.id = cr.reporter_id
       LEFT JOIN bar_post_comments pc
         ON cr.comment_type = 'post_comment' AND pc.id = cr.comment_id
       LEFT JOIN users pc_user ON pc_user.id = pc.user_id
       LEFT JOIN bar_posts post_data ON post_data.id = pc.post_id
       LEFT JOIN bars post_bar ON post_bar.id = post_data.bar_id
       LEFT JOIN event_comments ec
         ON cr.comment_type = 'event_comment' AND ec.id = cr.comment_id
       LEFT JOIN users ec_user ON ec_user.id = ec.user_id
       LEFT JOIN bar_events event_data ON event_data.id = ec.event_id
       LEFT JOIN bars event_bar ON event_bar.id = event_data.bar_id
       LEFT JOIN bar_comment_replies pcr
         ON cr.comment_type = 'post_reply' AND pcr.id = cr.comment_id
       LEFT JOIN users pcr_user ON pcr_user.id = pcr.user_id
       LEFT JOIN bar_post_comments post_reply_comment ON post_reply_comment.id = pcr.comment_id
       LEFT JOIN bar_posts post_reply_data ON post_reply_data.id = post_reply_comment.post_id
       LEFT JOIN bars post_reply_bar ON post_reply_bar.id = post_reply_data.bar_id
       LEFT JOIN event_comment_replies ecr
         ON cr.comment_type = 'event_reply' AND ecr.id = cr.comment_id
       LEFT JOIN users ecr_user ON ecr_user.id = ecr.user_id
       LEFT JOIN event_comments event_reply_comment ON event_reply_comment.id = ecr.event_comment_id
       LEFT JOIN bar_events event_reply_data ON event_reply_data.id = event_reply_comment.event_id
       LEFT JOIN bars event_reply_bar ON event_reply_bar.id = event_reply_data.bar_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY cr.reported_at DESC
       LIMIT ?`,
      [...params, limitValue]
    );

    return res.json({ success: true, data: reports });
  } catch (err) {
    console.error("SA GET COMMENT REPORTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/social/comment-reports/:reportId", async (req, res) => {
  try {
    const reportId = parseInt(req.params.reportId);
    if (!reportId) return res.status(400).json({ success: false, message: "Invalid report id" });

    const tableExists = await hasCommentReportsTable();
    if (!tableExists) {
      return res.status(404).json({ success: false, message: "Report table not found" });
    }

    const { status, action = "review" } = req.body || {};
    const allowedStatuses = ["pending", "reviewed", "dismissed"];
    const allowedActions = ["review", "dismiss", "remove_comment"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    const [[report]] = await pool.query(
      "SELECT id, comment_id, comment_type FROM comment_reports WHERE id = ? LIMIT 1",
      [reportId]
    );
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    let nextStatus = status || "reviewed";
    if (action === "dismiss") nextStatus = "dismissed";

    let commentRemoved = false;
    if (action === "remove_comment") {
      commentRemoved = await removeCommentByType(report.comment_id, report.comment_type);
      nextStatus = "reviewed";

      await pool.query(
        "UPDATE comment_reports SET status = 'reviewed' WHERE comment_id = ? AND comment_type = ? AND status = 'pending'",
        [report.comment_id, report.comment_type]
      );
    } else {
      await pool.query("UPDATE comment_reports SET status = ? WHERE id = ?", [nextStatus, reportId]);
    }

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: action === "remove_comment" ? "MODERATE_REPORTED_COMMENT" : "UPDATE_COMMENT_REPORT_STATUS",
      entity: "comment_report",
      entity_id: reportId,
      details: {
        status: nextStatus,
        action,
        comment_id: report.comment_id,
        comment_type: report.comment_type,
        comment_removed: commentRemoved,
      },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: action === "remove_comment"
        ? "Comment removed and related reports marked as reviewed"
        : "Report updated",
      data: {
        report_id: reportId,
        status: nextStatus,
        comment_removed: commentRemoved,
      },
    });
  } catch (err) {
    console.error("SA UPDATE COMMENT REPORT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/social/event-comments", async (req, res) => {
  try {
    const { bar_id, status = 'active', limit = 200 } = req.query;
    const where = [];
    const params = [];

    if (bar_id) {
      where.push("b.id = ?");
      params.push(parseInt(bar_id));
    }
    if (status) {
      where.push("ec.status = ?");
      params.push(status);
    }

    const [comments] = await pool.query(
            `SELECT ec.id, ec.event_id, ec.comment, ec.status,
              ec.created_at,
              be.title AS event_title, b.name AS bar_name,
              CONCAT(u.first_name, ' ', u.last_name) AS commenter_name,
              u.email AS commenter_email
       FROM event_comments ec
       JOIN bar_events be ON be.id = ec.event_id
       JOIN bars b ON b.id = be.bar_id
       JOIN users u ON u.id = ec.user_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY ec.created_at DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    return res.json({ success: true, data: comments });
  } catch (err) {
    console.error("SA GET EVENT COMMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/social/event-comments/:commentId", async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    const { status } = req.body || {};

    if (!Number.isInteger(commentId) || commentId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid comment id" });
    }
    // NOTE: must stay in sync with event_comments.status enum
    // ('active','deleted' + 'flagged' via 20261007 migration).
    if (!['active', 'deleted', 'flagged'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status. Use 'active', 'deleted' or 'flagged'." });
    }

    const [[comment]] = await pool.query(
      "SELECT id FROM event_comments WHERE id = ? LIMIT 1",
      [commentId]
    );

    if (comment) {
      await pool.query("UPDATE event_comments SET status = ?, updated_at = NOW() WHERE id = ?", [status, commentId]);
    } else {
      // Fall back to the replies table: reply ids live in event_comment_replies,
      // so deleting a reply id against event_comments would silently affect 0 rows.
      // Replies support active/deleted only — a 'flagged' request on a reply
      // is treated as a delete since replies have no flagged state.
      const [[reply]] = await pool.query(
        "SELECT id FROM event_comment_replies WHERE id = ? LIMIT 1",
        [commentId]
      );
      if (!reply) {
        return res.status(404).json({ success: false, message: "Comment not found. It may have been deleted already." });
      }
      if (status === 'deleted') {
        await pool.query("UPDATE event_comment_replies SET status = 'deleted', updated_at = NOW() WHERE id = ?", [commentId]);
      } else {
        return res.status(400).json({ success: false, message: "Replies can only be deleted, not flagged." });
      }
    }

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: status === 'deleted' ? 'DELETE_EVENT_COMMENT' : 'UPDATE_EVENT_COMMENT_STATUS',
      entity: 'event_comment',
      entity_id: commentId,
      details: { status },
      ...auditContext(req),
    });

    const verb = status === 'deleted' ? 'Comment deleted' : status === 'flagged' ? 'Comment flagged for review' : 'Comment restored';
    return res.json({ success: true, message: verb });
  } catch (err) {
    console.error("SA UPDATE EVENT COMMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── BAR EVENTS MODERATION ───────────────────────────────────────────
router.get("/social/events", async (req, res) => {
  try {
    const { bar_id, status = 'active', limit = 100 } = req.query;
    const where = [];
    const params = [];

    if (bar_id) {
      where.push("be.bar_id = ?");
      params.push(parseInt(bar_id));
    }
    if (status) {
      where.push("be.status = ?");
      params.push(status);
    }

    const [events] = await pool.query(
      `SELECT be.id, be.title, be.description, be.event_date, be.start_time, 
              be.end_time, be.entry_price, be.max_capacity, be.current_bookings,
              be.status, be.image_url, be.image_path, be.created_at,
              (SELECT COUNT(*) FROM event_likes el WHERE el.event_id = be.id) AS like_count,
              (SELECT COUNT(*) FROM event_comments ec WHERE ec.event_id = be.id AND ec.status = 'active') AS comment_count,
              b.name AS bar_name, b.logo_path AS bar_logo
       FROM bar_events be
       JOIN bars b ON b.id = be.bar_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY be.created_at DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    return res.json({ success: true, data: events });
  } catch (err) {
    console.error("SA GET BAR EVENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/social/events/:eventId/comments", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const [comments] = await pool.query(
      `SELECT ec.id, ec.comment, ec.status, ec.created_at,
              CONCAT(u.first_name, ' ', u.last_name) AS commenter_name,
              u.email AS commenter_email,
              u.profile_picture
       FROM event_comments ec
       JOIN users u ON u.id = ec.user_id
       WHERE ec.event_id = ? AND ec.status = 'active'
       ORDER BY ec.created_at ASC`,
      [eventId]
    );

    return res.json({ success: true, data: comments });
  } catch (err) {
    console.error("SA GET EVENT COMMENTS BY EVENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/social/events/:eventId", async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const { status } = req.body;

    if (!['active', 'cancelled', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    await pool.query("UPDATE bar_events SET status = ?, archived_at = ? WHERE id = ?", 
      [status, status === 'cancelled' ? new Date() : null, eventId]);

    await logPlatformAudit({
      actor_user_id: req.user.id,
      action: status === 'cancelled' ? 'CANCEL_EVENT' : 'UPDATE_EVENT_STATUS',
      entity: 'bar_event',
      entity_id: eventId,
      details: { status },
      ...auditContext(req),
    });

    return res.json({ success: true, message: `Event ${status}` });
  } catch (err) {
    console.error("SA UPDATE EVENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
