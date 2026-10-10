const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { USER_ROLES } = require("../config/constants");
const { REGISTRATION_DOC_KEYS, labelFor } = require("../config/requiredPermits");
const { safeProfileUrl } = require("../utils/profileUrl");
const { logAudit, auditContext } = require("../utils/audit");
const { sendVerificationEmail, sendBarOwnerVerificationEmail, sendPasswordResetEmail } = require("../utils/emailService");
const { DEFAULT_AVATAR } = require("../utils/profileUrl");
const { checkCustomerApproval } = require("../utils/customerApproval");
const {
  policy: loginPolicy,
  clientIp,
  userAgent,
  checkLoginAllowed,
  lockedResponse,
  recordFailure,
  resetOnSuccess,
  auditPlatform,
  safeCompare,
  ipRouteLimit,
} = require("../utils/loginAttempts");

let hasGlobalBanColumnCache = null;
let hasUserBanReasonColumnCache = null;
let hasBarSuspensionMessageColumnCache = null;
let hasCustomerBarBanReasonColumnCache = null;
let maintenanceStateCache = {
  expiresAt: 0,
  maintenanceMode: false,
  maintenanceMessage: "",
};

async function hasGlobalBanColumn() {
  if (hasGlobalBanColumnCache !== null) return hasGlobalBanColumnCache;
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM users LIKE 'is_banned'");
    hasGlobalBanColumnCache = rows.length > 0;
    return hasGlobalBanColumnCache;
  } catch (_) {
    hasGlobalBanColumnCache = false;
    return false;
  }
}

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

async function getCustomerBarBanNotices(customerId) {
  if (!customerId) return [];
  const hasReason = await hasCustomerBarBanReasonColumn();
  const [rows] = await pool.query(
    `SELECT cbb.bar_id, b.name AS bar_name, cbb.banned_at,
            ${hasReason ? "NULLIF(TRIM(cbb.ban_reason), '') AS ban_reason" : "NULL AS ban_reason"}
     FROM customer_bar_bans cbb
     JOIN bars b ON b.id = cbb.bar_id
     WHERE cbb.customer_id = ?
     ORDER BY cbb.banned_at DESC`,
    [customerId]
  );
  return rows || [];
}

async function getBarSideBanForUser(userId) {
  if (!userId) return null;
  const hasReason = await hasCustomerBarBanReasonColumn();
  const [rows] = await pool.query(
    `SELECT cbb.bar_id, b.name AS bar_name, cbb.banned_at,
            ${hasReason ? "NULLIF(TRIM(cbb.ban_reason), '') AS ban_reason" : "NULL AS ban_reason"}
     FROM customer_bar_bans cbb
     LEFT JOIN bars b ON b.id = cbb.bar_id
     WHERE cbb.customer_id = ?
     ORDER BY cbb.banned_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows?.[0] || null;
}

async function getOwnedBarIdForOwnerUser(userId) {
  if (!userId) return null;
  const [rows] = await pool.query(
    `SELECT b.id
     FROM bars b
     JOIN bar_owners bo ON bo.id = b.owner_id
     WHERE bo.user_id = ?
     ORDER BY b.id ASC
     LIMIT 1`,
    [userId]
  );
  return rows?.[0]?.id || null;
}

async function getBarAccessBanForUser(userId, barId) {
  if (!userId || !barId) return null;
  const hasReason = await hasCustomerBarBanReasonColumn();
  const [rows] = await pool.query(
    `SELECT cbb.banned_at,
            ${hasReason ? "NULLIF(TRIM(cbb.ban_reason), '') AS ban_reason" : "NULL AS ban_reason"}
     FROM customer_bar_bans cbb
     WHERE cbb.customer_id = ? AND cbb.bar_id = ?
     LIMIT 1`,
    [userId, barId]
  );
  return rows?.[0] || null;
}

/**
 * Get effective permissions for a user.
 *
 * Resolution:
 *  1. If user_permissions has ANY rows → use only those (granted = 1).
 *  2. Otherwise → use role_permissions defaults.
 */
async function getEffectivePermissionCodes(userId) {
  // Check if per-user overrides exist
  const [overrideCheck] = await pool.query(
    "SELECT 1 FROM user_permissions WHERE user_id = ? LIMIT 1",
    [userId]
  );

  if (overrideCheck.length > 0) {
    // User has custom permissions — only return granted ones
    const [rows] = await pool.query(
      `SELECT DISTINCT p.name
       FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = ? AND up.granted = 1
       ORDER BY p.name`,
      [userId]
    );
    return rows.map((x) => x.name);
  }

  // Fall back to role defaults — join via role_id or fall back to role name
  const [rows] = await pool.query(
    `SELECT DISTINCT p.name
     FROM users u
     JOIN roles r ON r.id = COALESCE(u.role_id, (SELECT id FROM roles WHERE UPPER(name) = UPPER(u.role) LIMIT 1))
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE u.id = ?
     ORDER BY p.name`,
    [userId]
  );
  return rows.map((x) => x.name);
}

async function getMaintenanceState() {
  const now = Date.now();
  if (maintenanceStateCache.expiresAt > now) {
    return {
      maintenanceMode: maintenanceStateCache.maintenanceMode,
      maintenanceMessage: maintenanceStateCache.maintenanceMessage,
    };
  }

  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value
       FROM platform_settings
       WHERE setting_key IN ('maintenance_mode', 'maintenance_message')`
    );
    const settingsMap = rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});
    maintenanceStateCache = {
      expiresAt: now + 15000,
      maintenanceMode: Number(settingsMap.maintenance_mode || 0) === 1,
      maintenanceMessage: String(settingsMap.maintenance_message || "").trim(),
    };
  } catch (_) {
    maintenanceStateCache = {
      expiresAt: now + 15000,
      maintenanceMode: false,
      maintenanceMessage: "",
    };
  }

  return {
    maintenanceMode: maintenanceStateCache.maintenanceMode,
    maintenanceMessage: maintenanceStateCache.maintenanceMessage,
  };
}

// Utility function
function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      email: user.email,
      bar_id: user.bar_id
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

const NAME_REGEX = /^(?=.{1,100}$)(?!.*\d)[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ .'-]*$/;
const PHONE_ALLOWED_CHARS_REGEX = /^[0-9+()\-\s]+$/;

function normalizeName(value, fieldLabel, { required = true } = {}) {
  const raw = value === undefined || value === null ? "" : String(value).trim();

  if (!raw) {
    if (required) return { error: `${fieldLabel} is required` };
    return { value: null };
  }

  if (raw.length > 100) {
    return { error: `${fieldLabel} must be 100 characters or less` };
  }

  if (!NAME_REGEX.test(raw)) {
    return { error: `${fieldLabel} contains invalid characters` };
  }

  return { value: raw };
}

function normalizePhoneNumber(value, { required = false, fieldLabel = "Phone number" } = {}) {
  const raw = value === undefined || value === null ? "" : String(value).trim();

  if (!raw) {
    if (required) return { error: `${fieldLabel} is required` };
    return { value: null };
  }

  if (raw.length > 25) {
    return { error: `Invalid ${fieldLabel.toLowerCase()}` };
  }

  if (!PHONE_ALLOWED_CHARS_REGEX.test(raw)) {
    return { error: `Invalid ${fieldLabel.toLowerCase()}` };
  }

  const plusCount = (raw.match(/\+/g) || []).length;
  if (plusCount > 1 || (plusCount === 1 && !raw.startsWith("+"))) {
    return { error: `Invalid ${fieldLabel.toLowerCase()}` };
  }

  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return { error: `Invalid ${fieldLabel.toLowerCase()}` };
  }

  return {
    value: raw.startsWith("+") ? `+${digits}` : digits,
  };
}

function normalizeDateOfBirth(value, { required = false, minimumAge = null } = {}) {
  const raw = value === undefined || value === null ? "" : String(value).trim();

  if (!raw) {
    if (required) return { error: "Date of birth is required" };
    return { value: null, age: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { error: "Invalid date of birth format. Use YYYY-MM-DD" };
  }

  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "Invalid date of birth" };
  }

  const now = new Date();
  if (parsed.getTime() > now.getTime()) {
    return { error: "Date of birth cannot be in the future" };
  }

  const age = calculateAgeFromDob(raw);
  if (minimumAge !== null && (age === null || age < minimumAge)) {
    return {
      error: `You must be at least ${minimumAge} years old`,
      tooYoung: true,
      age,
    };
  }

  return { value: raw, age };
}

// ─── EMAIL VERIFICATION HELPERS ───
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // emailed link lifetime
const OTP_TTL_MS = 10 * 60 * 1000; // 6-digit code lifetime
const OTP_MAX_ATTEMPTS = 5; // wrong guesses per code before a fresh one is needed

function generateEmailOtp() {
  // crypto.randomInt, not Math.random — the code must not be predictable.
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

// Only the digest is ever stored. The plaintext code lives transiently in
// the minting request (emailed / console-logged once) and is never persisted.
function hashEmailOtp(code) {
  return crypto.createHash("sha256").update(String(code || ""), "utf8").digest("hex");
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a || ""));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Make sure an unverified customer has a live verification token AND a 6-digit
 * code, then email both.
 *
 * Whatever is already in play is reused while it is still valid, so logging in
 * (or clicking resend) repeatedly never spams the inbox — a new code is only
 * minted when the previous one is missing or expired. Only the code's hash is
 * stored; the plaintext is returned solely so this request can deliver it.
 *
 * Returns { token, otp, sent, reused, alreadyVerified }.
 */
async function issueEmailVerification(email, { force = false } = {}) {
  const [rows] = await pool.query(
    `SELECT id, email, first_name, is_verified, email_verification_token,
            email_verification_expires, email_verification_otp, email_otp_expires
     FROM users WHERE email = ? LIMIT 1`,
    [String(email || "").trim().toLowerCase()]
  );

  const user = rows[0];
  if (!user) {
    return { token: null, otp: null, sent: false, reused: false, alreadyVerified: false };
  }
  if (Number(user.is_verified || 0) === 1) {
    return { token: null, otp: null, sent: false, reused: false, alreadyVerified: true };
  }

  const now = Date.now();
  const tokenAlive =
    !force &&
    Boolean(user.email_verification_token) &&
    Boolean(user.email_verification_expires) &&
    new Date(user.email_verification_expires).getTime() > now;
  const otpAlive =
    !force &&
    Boolean(user.email_verification_otp) &&
    Boolean(user.email_otp_expires) &&
    new Date(user.email_otp_expires).getTime() > now;

  // Still valid and not forced: leave the row alone and send nothing, so
  // logging in repeatedly never floods the inbox. Only a missing or expired
  // code triggers a new one.
  if (tokenAlive && otpAlive) {
    return {
      token: user.email_verification_token,
      otp: null,
      sent: false,
      reused: true,
      alreadyVerified: false,
    };
  }

  const token = tokenAlive ? user.email_verification_token : crypto.randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(
    tokenAlive && user.email_verification_expires
      ? new Date(user.email_verification_expires).getTime()
      : now + VERIFICATION_TTL_MS
  );
  const otp = generateEmailOtp();
  const otpExpiresAt = new Date(now + OTP_TTL_MS);

  await pool.query(
    `UPDATE users
        SET email_verification_token = ?,
            email_verification_expires = ?,
            email_verification_otp = ?,
            email_otp_expires = ?,
            email_otp_attempts = 0
      WHERE id = ?`,
    [token, tokenExpiresAt, hashEmailOtp(otp), otpExpiresAt, user.id]
  );

  let sent = false;
  try {
    await sendVerificationEmail(user.email, user.first_name || "there", token, otp);
    sent = true;
    try {
      const { auditEmail } = require("../utils/notifyCustomer");
      await auditEmail(user.id, user.email, "verification_code", "Confirm your Party Goers account");
    } catch (_) {}
  } catch (err) {
    console.error("EMAIL VERIFICATION SEND ERROR:", err?.code || "", err?.message || err);
  }

  return { token, otp, sent, reused: false, alreadyVerified: false };
}

/**
 * Flip a customer account to verified. Shared by the link and OTP flows.
 * The timestamp is passed in from Node because this pool runs in UTC
 * (`timezone: 'Z'`) while MySQL's NOW() is server-local — mixing the two
 * would stamp verification 8 hours off.
 */
async function markCustomerVerified(userId) {
  await pool.query(
    `UPDATE users
        SET is_verified = 1,
            email_verified_at = COALESCE(email_verified_at, ?),
            email_verification_token = NULL,
            email_verification_expires = NULL,
            email_verification_otp = NULL,
            email_otp_expires = NULL,
            email_otp_attempts = 0
      WHERE id = ?`,
    [new Date(), userId]
  );
  // Welcome mail, best-effort: never blocks verification.
  try {
    const { notifyCustomer } = require("../utils/notifyCustomer");
    await notifyCustomer(userId, "welcome");
  } catch (_) {}
}

// Build a login session for a freshly-verified user. Verification is the
// ONLY place besides password/Google login that mints tokens: registration
// never does, so nobody is authenticated before confirming their email.
async function fetchVerifiedSession(userId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.role_id,
            r.name AS role_name, u.is_active, u.is_verified, u.email_verified_at,
            u.bar_id, u.phone_number, u.date_of_birth, u.profile_picture,
            b.name AS bar_name, bo.id AS bar_owner_id
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN bars b ON b.id = u.bar_id
     LEFT JOIN bar_owners bo ON bo.user_id = u.id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  const user = rows[0];
  if (!user) return null;
  user.profile_url = safeProfileUrl(user.profile_picture);
  user.is_verified = Number(user.is_verified || 0) === 1;
  user.isVerified = user.is_verified;
  user.email_verified = user.is_verified;
  user.verified = user.is_verified ? "VERIFIED" : "UNVERIFIED";
  user.verifiedAt = user.email_verified_at || null;
  return { token: signToken(user), user };
}

// Get current user profile
router.get("/me", require("../middlewares/requireAuth"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.is_active, u.is_verified,
              u.email_verified_at, u.bar_id, u.phone_number, u.date_of_birth, u.profile_picture,
              b.name AS bar_name,
              bo.id AS bar_owner_id
       FROM users u
       LEFT JOIN bars b ON b.id = u.bar_id
       LEFT JOIN bar_owners bo ON bo.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = rows[0];
    user.profile_url = safeProfileUrl(user.profile_picture);
    // Normalise the verification flags so consumers can check either the raw
    // boolean or the string form without caring how MySQL stored it.
    user.is_verified = Number(user.is_verified || 0) === 1;
    user.isVerified = user.is_verified;
    user.email_verified = user.is_verified;
    user.verified = user.is_verified ? "VERIFIED" : "UNVERIFIED";
    user.verifiedAt = user.email_verified_at || null;

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error("GET /me ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get current user permissions
router.get("/me/permissions", require("../middlewares/requireAuth"), async (req, res) => {
  try {
    const userId = req.user.id;

    const [userRows] = await pool.query(
      `SELECT u.id, u.email, u.role, u.role_id, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    const permissionCodes = await getEffectivePermissionCodes(userId);
    
    res.json({
      success: true,
      user: userRows[0] || null,
      permissions: permissionCodes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Register new customer user
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
  } catch (_) {
    return res.json({
      success: true,
      data: { maintenance_mode: 0, maintenance_message: null, updated_at: null },
    });
  }
});

router.get("/platform/announcements", async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const [rows] = await pool.query(
      `SELECT id, title, message, is_active, starts_at, ends_at, created_at, updated_at
       FROM platform_announcements
       WHERE is_active = 1
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY id DESC
       LIMIT ${limit}`
    );
    return res.json({ success: true, data: rows });
  } catch (_) {
    return res.json({ success: true, data: [] });
  }
});

// Login user
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (String(email).length > 255 || String(password).length > 128) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Brute-force shield (single source of truth for every portal: customer,
    // manager/bar owner, POS, super admin). The lock is checked BEFORE the
    // password so a locked account never even burns bcrypt work — and a
    // locked response never reveals whether the password was right.
    const emailNorm = String(email).trim().toLowerCase();
    const loginPortal = String(req.headers["x-login-portal"] || req.body?.portal || "bar_management").toLowerCase();
    const reqIp = clientIp(req);
    const reqUa = userAgent(req);
    const gate = await checkLoginAllowed(emailNorm, reqIp);
    if (!gate.allowed) {
      return lockedResponse(res, gate);
    }

    // Find user by email with bar_id + bar name
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.password, u.role,
              u.role_id, r.name AS role_name,
              u.is_active, u.status, u.is_verified, u.bar_id, u.phone_number, u.date_of_birth,
              u.profile_picture, b.name AS bar_name,
              u.approval_status, u.approval_rejection_reason
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN bars b ON b.id = u.bar_id
       WHERE u.email = ? LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      // Check if email has a pending business registration
      try {
        const [pendingRegs] = await pool.query(
          "SELECT id, status FROM business_registrations WHERE owner_email = ? ORDER BY id DESC LIMIT 1",
          [String(email).trim().toLowerCase()]
        );
        if (pendingRegs.length) {
          const reg = pendingRegs[0];
          if (['pending', 'pending_email_verification', 'pending_admin_approval'].includes(reg.status)) {
            return res.status(403).json({
              success: false,
              code: "REGISTRATION_PENDING",
              message: "Your business registration is currently under review. Please wait for approval before logging in.",
            });
          }
          if (reg.status === 'rejected') {
            return res.status(403).json({
              success: false,
              code: "REGISTRATION_REJECTED",
              message: "Your business registration was not approved. Please contact support for more information.",
            });
          }
        }
      } catch (_) { /* table may not exist yet */ }

      // Unknown address: identical shape to a wrong password (never reveal
      // whether the email exists), same bcrypt cost for timing parity, and
      // the attempt still counts toward the account + IP limits.
      await safeCompare(password, null);
      const miss = await recordFailure({ identifier: emailNorm, ip: reqIp, userId: null });
      if (miss.locked) {
        return lockedResponse(res, miss.lock);
      }
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = rows[0];

    // Check if account is active
    if (user.is_active === 0) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DEACTIVATED",
        message: "Your account has been deactivated. Please contact your administrator.",
      });
    }

    // 3-tier staff status guard: archived / fully_deactivated accounts cannot
    // log in (is_active stays synced, so this is explicit defense in depth).
    const accountStatus = String(user.status || 'active').toLowerCase();
    if (accountStatus === 'archived' || accountStatus === 'fully_deactivated') {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DEACTIVATED",
        message: "Your account for this bar has been deactivated. Please contact management.",
      });
    }

    // Email verification does NOT block login. An unverified customer receives a
    // limited session instead: safe reads are allowed so they can browse with
    // the banner reminder, while requireAuth refuses every state-changing
    // request until the email is confirmed. Approval, bans and deactivation
    // above still block outright. The per-login re-issue happens below, after
    // the password is proven, so a wrong password never mints or mails a code.

    // Detect Google-only accounts (password stored as empty string)
    if (!user.password) {
      return res.status(401).json({
        success: false,
        code: "GOOGLE_ACCOUNT",
        message: "This account uses Google sign-in. Please use the 'Continue with Google' button to log in.",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      const earlyRole = String(user.role_name || user.role || "").toUpperCase();
      const miss = await recordFailure({
        identifier: emailNorm, ip: reqIp, userId: user.id,
      });
      if (miss.locked) {
        await auditPlatform({
          action: "ACCOUNT_LOCKED", userId: user.id, email: user.email,
          app: loginPortal, ip: reqIp, userAgent: reqUa,
          details: { lock_level: miss.lock.level, lock_minutes: miss.lock.durationMinutes },
        });
      } else {
        await auditPlatform({
          action: "LOGIN_FAILED", userId: user.id, email: user.email,
          app: loginPortal, ip: reqIp, userAgent: reqUa,
          details: { attempts_remaining: miss.attemptsRemaining },
        });
      }
      if (miss.locked) {
        // "Was this you?" mail + an extra audit-visible ping for super admins.
        // Best-effort: mail failure never blocks the response.
        try {
          const { sendAccountLockedEmail } = require("../utils/emailService");
          await sendAccountLockedEmail(user.email, user.first_name, {
            minutes: miss.lock.durationMinutes, app: loginPortal,
          });
          if (earlyRole === "SUPER_ADMIN") {
            const { alertEmail } = require("../config/loginSecurity");
            await sendAccountLockedEmail(alertEmail(), "admin", {
              minutes: miss.lock.durationMinutes, app: `super-admin (${user.email})`,
            });
          }
        } catch (_) {}
        return lockedResponse(res, miss.lock);
      }
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        attemptsRemaining: miss.attemptsRemaining,
      });
    }

    // ROLE RESTRICTION by portal
    // - Default behavior remains Bar Management login restrictions
    // - Customer website sends x-login-portal: customer to allow customer accounts
    // - BAR_OWNER/MANAGER are additionally allowed on the customer website so
    //   they can preview their own public bar page (and add products/tables)
    //   before payment setup is finished. Their session stays bar-scoped.
    const roleName = String(user.role_name || user.role || "").toUpperCase();

    if (loginPortal === "customer") {
      const customerPortalRoles = ["CUSTOMER", "BAR_OWNER", "MANAGER"];
      if (!customerPortalRoles.includes(roleName)) {
        return res.status(403).json({
          success: false,
          code: "ROLE_NOT_ALLOWED",
          message: "This account cannot access the Customer Website.",
        });
      }
    } else {
      // Bar Management / POS portal: bar owners plus every staff sub-role the
      // Staff Management can create (staff, cashier, hr, finance, manager).
      // These resolve case-insensitively against role_name (UPPERCASE master
      // roles, e.g. FINANCE) or role (lowercase, e.g. finance).
      const allowedRoles = ["BAR_OWNER", "MANAGER", "STAFF", "EMPLOYEE", "SUPER_ADMIN", "HR", "FINANCE", "CASHIER"];
      if (!allowedRoles.includes(roleName)) {
        return res.status(403).json({
          success: false,
          code: "ROLE_NOT_ALLOWED",
          message: "This account cannot access the Bar Management system. Please use the customer app instead.",
        });
      }
    }

    // Maintenance mode: only SUPER_ADMIN can continue
    if (roleName !== "SUPER_ADMIN") {
      const { maintenanceMode, maintenanceMessage } = await getMaintenanceState();
      if (maintenanceMode) {
        return res.status(503).json({
          success: false,
          code: "MAINTENANCE_MODE",
          message:
            maintenanceMessage ||
            "Platform is currently under maintenance. Please try again later.",
        });
      }
    }

    // Global platform ban check (SUPER_ADMIN bans)
    if (await hasGlobalBanColumn()) {
      const [[banRow]] = await pool.query(
        "SELECT COALESCE(is_banned, 0) AS is_banned FROM users WHERE id = ? LIMIT 1",
        [user.id]
      );

      if (Number(banRow?.is_banned || 0) === 1) {
        let banMessage = "Your account has been banned from the platform.";
        if (await hasUserBanReasonColumn()) {
          const [[banReasonRow]] = await pool.query(
            "SELECT ban_reason FROM users WHERE id = ? LIMIT 1",
            [user.id]
          );
          const reason = String(banReasonRow?.ban_reason || "").trim();
          if (reason) banMessage = reason;
        }

        return res.status(403).json({
          success: false,
          code: "ACCOUNT_BANNED",
          message: banMessage,
        });
      }
    }

    // Super-admin bar-level bans can also target bar-side users (owner/staff)
    if (roleName !== "SUPER_ADMIN" && roleName !== "CUSTOMER") {
      const barSideBan = await getBarSideBanForUser(user.id);
      if (barSideBan) {
        const reason = String(barSideBan.ban_reason || "").trim();
        return res.status(403).json({
          success: false,
          code: "BAR_ACCESS_BANNED",
          message: reason || "Your bar account access has been banned by platform administration.",
        });
      }
    }

    // Bar suspension check: block bar-side roles when assigned bar is inactive/suspended
    if (roleName !== "SUPER_ADMIN" && roleName !== "CUSTOMER") {
      let effectiveBarId = user.bar_id || null;
      if (!effectiveBarId && roleName === "BAR_OWNER") {
        effectiveBarId = await getOwnedBarIdForOwnerUser(user.id);
      }

      if (effectiveBarId) {
      const hasSuspensionMessage = await hasBarSuspensionMessageColumn();
      const [barRows] = await pool.query(
        `SELECT b.status, b.lifecycle_status,
                p.status AS parent_status, p.lifecycle_status AS parent_lifecycle_status,
                ${hasSuspensionMessage ? "COALESCE(b.suspension_message, p.suspension_message) AS suspension_message" : "NULL AS suspension_message"}
         FROM bars b
         LEFT JOIN bars p ON p.id = b.parent_bar_id
         WHERE b.id = ?
         LIMIT 1`,
        [effectiveBarId]
      );
      const barState = barRows[0];
      if (barState) {
        const status = String(barState.status || "").toLowerCase();
        const lifecycle = String(barState.lifecycle_status || "").toLowerCase();
        const parentStatus = String(barState.parent_status || "").toLowerCase();
        const parentLifecycle = String(barState.parent_lifecycle_status || "").toLowerCase();
        const isSuspended =
          status === "inactive" ||
          lifecycle === "suspended" ||
          parentStatus === "inactive" ||
          parentLifecycle === "suspended";
        if (isSuspended) {
          return res.status(403).json({
            success: false,
            code: "BAR_SUSPENDED",
            message:
              String(barState.suspension_message || "").trim() ||
              "Your bar account is currently suspended. Please contact support.",
          });
        }
      }
      }
    }

    // Customer approval gate: pending/rejected customers cannot log in.
    // Runs after identity + portal checks, deliberately WITHOUT an audit
    // entry so retrying users don't spam the login audit trail.
    const approvalBlock = checkCustomerApproval(user);
    if (approvalBlock) {
      return res.status(403).json({ success: false, ...approvalBlock });
    }

    // Email verification gate: unverified customers cannot log in, even with
    // the right password. No code is auto-sent here (that would let anyone
    // trigger mail to the address); the client offers the resend endpoint,
    // which carries its own cooldown, and routes to the code screen.
    if (String(user.role || "").trim().toLowerCase() === "customer" && !Number(user.is_verified || 0)) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before logging in. Enter the verification code we sent you, or request a new one.",
        email: user.email,
      });
    }

    // A correct password wipes the slate: counter and lock level reset. When
    // the account had lock history, say so in the audit trail explicitly.
    const hadLockHistory = await resetOnSuccess({ identifier: emailNorm, ip: reqIp });
    if (hadLockHistory) {
      await auditPlatform({
        action: "LOGIN_SUCCESS_AFTER_LOCK", userId: user.id, email: user.email,
        app: loginPortal, ip: reqIp, userAgent: reqUa, details: {},
      });
    }

    // Generate token
    const token = signToken(user);

    // Effective permissions at login
    const permissionCodes = await getEffectivePermissionCodes(user.id);
    let barBanNotices = [];
    if (loginPortal === "customer" && roleName === "CUSTOMER") {
      barBanNotices = await getCustomerBarBanNotices(user.id);
    }

    // Non-blocking audit log for successful login
    if (user.bar_id) {
      logAudit(null, {
        bar_id: user.bar_id,
        user_id: user.id,
        action: "LOGIN",
        entity: "user",
        entity_id: user.id,
        details: { email: user.email, role: user.role },
        ...auditContext(req)
      });
    }

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role,
          bar_id: user.bar_id,
          bar_name: user.bar_name || null,
          phone_number: user.phone_number,
          date_of_birth: user.date_of_birth,
          profile_picture: user.profile_picture,
          profile_url: safeProfileUrl(user.profile_picture),
          is_active: user.is_active,
          is_verified: Number(user.is_verified || 0) === 1,
          isVerified: Number(user.is_verified || 0) === 1,
          email_verified: Number(user.is_verified || 0) === 1,
          verified: Number(user.is_verified || 0) === 1 ? "VERIFIED" : "UNVERIFIED"
        },
        permissions: permissionCodes,
        bar_ban_notices: barBanNotices
      }
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// CUSTOMER REGISTER (sets role_id too)
router.post("/register", ipRouteLimit("register"), async (req, res) => {
  try {
    const { first_name, last_name, email, password, phone_number, date_of_birth } = req.body || {};

    if (email === undefined || password === undefined) {
      return res.status(400).json({
        success: false,
        message: "first_name, last_name, email, password are required"
      });
    }

    const firstNameValidation = normalizeName(first_name, "First name");
    if (firstNameValidation.error) {
      return res.status(400).json({ success: false, message: firstNameValidation.error });
    }

    const lastNameValidation = normalizeName(last_name, "Last name");
    if (lastNameValidation.error) {
      return res.status(400).json({ success: false, message: lastNameValidation.error });
    }

    if (String(email).length > 255) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    if (String(password).length > 128) {
      return res.status(400).json({ success: false, message: "Password must be 128 characters or less" });
    }

    const phoneValidation = normalizePhoneNumber(phone_number, {
      required: false,
      fieldLabel: "Phone number",
    });
    if (phoneValidation.error) {
      return res.status(400).json({ success: false, message: phoneValidation.error });
    }

    const dobValidation = normalizeDateOfBirth(date_of_birth, {
      required: false,
      minimumAge: 18,
    });
    if (dobValidation.error) {
      return res.status(400).json({ success: false, message: dobValidation.error });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm);
    if (!emailOk) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    // Ensure CUSTOMER role exists and get role_id
    const [roleRows] = await pool.query(
      "SELECT id FROM roles WHERE name IN ('CUSTOMER','customer') LIMIT 1"
    );
    if (!roleRows.length) {
      return res.status(500).json({
        success: false,
        message: "CUSTOMER role not found in roles table"
      });
    }
    const customerRoleId = roleRows[0].id;

    // Check existing email
    const [exists] = await pool.query(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [emailNorm]
    );
    if (exists.length) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    // Check duplicate phone (if provided)
    if (phoneValidation.value) {
      const phoneNorm = phoneValidation.value;
      const [phoneExists] = await pool.query(
        "SELECT id FROM users WHERE phone_number = ? LIMIT 1",
        [phoneNorm]
      );
      if (phoneExists.length) {
        return res.status(409).json({ success: false, message: "Phone number already in use" });
      }
    }

    const hashed = await bcrypt.hash(password, 10);

    // Generate email verification token (link, 24h) + 6-digit code (10 min):
    // the recipient can use either the emailed link or the code on the verify
    // screen. Only the code's hash is stored — never the plaintext.
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationOtp = generateEmailOtp();
    const tokenExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
    const otpExpires = new Date(Date.now() + OTP_TTL_MS);

    // Create user as CUSTOMER (bar_id NULL) + role_id set + default avatar.
    // approval_status is set EXPLICITLY to 'pending' here (never rely on
    // the column default): every new customer sign-up needs admin approval.
    const [result] = await pool.query(
      `INSERT INTO users
       (first_name, last_name, email, password, phone_number, date_of_birth, role, role_id, is_verified, is_active, bar_id,
        profile_picture, email_verification_token, email_verification_expires, email_verification_otp, email_otp_expires,
        approval_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'customer', ?, 0, 1, NULL, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
       firstNameValidation.value,
       lastNameValidation.value,
       emailNorm,
       hashed,
       phoneValidation.value,
       dobValidation.value,
       customerRoleId,
       DEFAULT_AVATAR, verificationToken, tokenExpires, hashEmailOtp(verificationOtp), otpExpires]
    );

    // Send verification email (non-blocking — don't fail registration if email fails)
    try {
      await sendVerificationEmail(emailNorm, firstNameValidation.value, verificationToken, verificationOtp);
      console.log('Verification email sent to:', emailNorm);
    } catch (emailErr) {
      console.error('VERIFICATION EMAIL ERROR (full):', emailErr);
    }

    return res.status(201).json({
      success: true,
      message: "Customer registered. Please check your email to verify your account.",
      data: {
        user_id: result.insertId,
        email: emailNorm,
        role: "customer",
        role_id: customerRoleId,
        is_verified: 0
      }
    });
  } catch (err) {
    console.error("CUSTOMER REGISTER ERROR:", err);
    return res.status(500).json({
      success: false,
      message: err.sqlMessage || err.message || "Server error"
    });
  }
});



// ─── CHECK EMAIL AVAILABILITY ───
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    const emailNorm = String(email).trim().toLowerCase();
    const [existingUser] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [emailNorm]);
    if (existingUser.length) {
      return res.json({ success: true, exists: true });
    }
    const [existingReg] = await pool.query(
      "SELECT id FROM business_registrations WHERE owner_email = ? AND status IN ('pending','pending_email_verification','pending_admin_approval') LIMIT 1",
      [emailNorm]
    );
    if (existingReg.length) {
      return res.json({ success: true, exists: true });
    }
    return res.json({ success: true, exists: false });
  } catch (err) {
    console.error("CHECK EMAIL ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to check email" });
  }
});

// ─── VERIFY EMAIL ───
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: "Token is required" });

    const [rows] = await pool.query(
      "SELECT id, email_verification_expires, is_verified FROM users WHERE email_verification_token = ? LIMIT 1",
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Invalid or already used verification link." });
    }

    const user = rows[0];

    if (user.is_verified) {
      return res.json({ success: true, message: "Email already verified. You can log in." });
    }

    if (new Date() > new Date(user.email_verification_expires)) {
      return res.status(410).json({ success: false, code: "LINK_EXPIRED", message: "Verification link has expired. Please request a new one." });
    }

    await markCustomerVerified(user.id);

    // Verification logs the user in: this is where the session starts.
    const session = await fetchVerifiedSession(user.id);

    return res.json({
      success: true,
      code: "VERIFIED",
      message: "Email verified successfully! You are now logged in.",
      data: session,
    });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── RESEND VERIFICATION EMAIL (rate-limited: 60s cooldown) ───
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const emailNorm = String(email).trim().toLowerCase();
    const [rows] = await pool.query(
      "SELECT id, first_name, is_verified, email_verification_expires FROM users WHERE email = ? LIMIT 1",
      [emailNorm]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: "Email not found" });
    if (rows[0].is_verified) return res.json({ success: true, message: "Email already verified." });

    // Rate limit: token was issued at (expires - 24h). Block if issued < 60s ago.
    if (rows[0].email_verification_expires) {
      const issuedAt = new Date(rows[0].email_verification_expires).getTime() - (24 * 60 * 60 * 1000);
      const secondsSinceIssued = Math.floor((Date.now() - issuedAt) / 1000);
      const COOLDOWN_SECONDS = 60;
      if (secondsSinceIssued < COOLDOWN_SECONDS) {
        const waitSeconds = COOLDOWN_SECONDS - secondsSinceIssued;
        return res.status(429).json({
          success: false,
          code: "RESEND_COOLDOWN",
          message: `Please wait ${waitSeconds} second${waitSeconds !== 1 ? 's' : ''} before requesting another email.`,
          wait_seconds: waitSeconds
        });
      }
    }

    // Mint a fresh token + OTP and email them. `force` retires whatever code
    // was outstanding so an old OTP can no longer be replayed.
    const issued = await issueEmailVerification(emailNorm, { force: true });

    return res.json({
      success: true,
      verification_sent: issued.sent,
      message: issued.sent
        ? "Verification email sent! Check your inbox for the link and 6-digit code."
        : "A new verification code was issued, but the email could not be delivered right now. Please try again shortly."
    });
  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── VERIFY EMAIL WITH 6-DIGIT CODE ───
// Alternative to the emailed link: same verification state, code instead of
// token. Only the code's SHA-256 hash is stored; at most OTP_MAX_ATTEMPTS
// wrong guesses are allowed per code, then a fresh one must be requested.
router.post("/verify-otp", async (req, res) => {
  try {
    const emailNorm = String(req.body?.email || "").trim().toLowerCase();
    const codeNorm = String(req.body?.code || "").trim();

    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ success: false, message: "A valid email is required." });
    }
    if (!/^\d{6}$/.test(codeNorm)) {
      return res.status(400).json({ success: false, message: "Enter the 6-digit code from your email." });
    }

    const [rows] = await pool.query(
      `SELECT id, is_verified, email_verification_otp, email_otp_expires, email_otp_attempts
       FROM users WHERE email = ? LIMIT 1`,
      [emailNorm]
    );

    const user = rows[0];
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found for that email." });
    }
    if (Number(user.is_verified || 0) === 1) {
      return res.json({ success: true, code: "VERIFIED", message: "Email already verified. You can log in." });
    }

    if (!user.email_verification_otp || !user.email_otp_expires || new Date(user.email_otp_expires).getTime() <= Date.now()) {
      return res.status(410).json({
        success: false,
        code: "OTP_EXPIRED",
        message: "That code has expired. Request a new verification email."
      });
    }

    if (Number(user.email_otp_attempts || 0) >= OTP_MAX_ATTEMPTS) {
      return res.status(403).json({
        success: false,
        code: "OTP_ATTEMPTS_EXCEEDED",
        message: "Too many wrong codes. Request a new verification email to get a fresh code."
      });
    }

    if (!timingSafeStringEqual(user.email_verification_otp, hashEmailOtp(codeNorm))) {
      const attempts = Number(user.email_otp_attempts || 0) + 1;
      await pool.query("UPDATE users SET email_otp_attempts = ? WHERE id = ?", [attempts, user.id]);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        return res.status(403).json({
          success: false,
          code: "OTP_ATTEMPTS_EXCEEDED",
          message: "Too many wrong codes. Request a new verification email to get a fresh code."
        });
      }
      return res.status(400).json({
        success: false,
        code: "OTP_INVALID",
        message: "Incorrect code. Please try again."
      });
    }

    await markCustomerVerified(user.id);

    // Verification logs the user in: this is where the session starts.
    const session = await fetchVerifiedSession(user.id);

    return res.json({
      success: true,
      code: "VERIFIED",
      message: "Email verified successfully! You are now logged in.",
      data: session,
    });
  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── UPDATE PROFILE (all roles) ───
router.patch("/me/profile", require("../middlewares/requireAuth"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, phone_number, date_of_birth, email } = req.body || {};

    // Only allow safe fields
    const updates = [];
    const params = [];

    if (first_name !== undefined) {
      const firstNameValidation = normalizeName(first_name, "First name");
      if (firstNameValidation.error) {
        return res.status(400).json({ success: false, message: firstNameValidation.error });
      }
      updates.push("first_name = ?");
      params.push(firstNameValidation.value);
    }

    if (last_name !== undefined) {
      const lastNameValidation = normalizeName(last_name, "Last name");
      if (lastNameValidation.error) {
        return res.status(400).json({ success: false, message: lastNameValidation.error });
      }
      updates.push("last_name = ?");
      params.push(lastNameValidation.value);
    }

    if (phone_number !== undefined) {
      const phoneValidation = normalizePhoneNumber(phone_number, {
        required: false,
        fieldLabel: "Phone number",
      });
      if (phoneValidation.error) {
        return res.status(400).json({ success: false, message: phoneValidation.error });
      }
      updates.push("phone_number = ?");
      params.push(phoneValidation.value);
    }

    if (date_of_birth !== undefined) {
      const dobValidation = normalizeDateOfBirth(date_of_birth, {
        required: false,
        minimumAge: 18,
      });
      if (dobValidation.error) {
        return res.status(400).json({ success: false, message: dobValidation.error });
      }
      updates.push("date_of_birth = ?");
      params.push(dobValidation.value);
    }

    if (email !== undefined) {
      const emailNorm = String(email).trim().toLowerCase();
      if (emailNorm.length > 255) {
        return res.status(400).json({ success: false, message: "Invalid email format" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        return res.status(400).json({ success: false, message: "Invalid email format" });
      }
      // Check if email is taken by another user
      const [dup] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1", [emailNorm, userId]);
      if (dup.length) {
        return res.status(409).json({ success: false, message: "Email already in use by another account" });
      }
      updates.push("email = ?"); params.push(emailNorm);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    updates.push("updated_at = NOW()");
    params.push(userId);

    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    // Return updated user (with bar_name + profile_url)
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.is_active, u.is_verified,
              u.bar_id, u.phone_number, u.date_of_birth, u.profile_picture,
              b.name AS bar_name
       FROM users u
       LEFT JOIN bars b ON b.id = u.bar_id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    const updated = rows[0];
    if (updated) updated.profile_url = safeProfileUrl(updated.profile_picture);

    return res.json({ success: true, message: "Profile updated", data: updated });
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    return res.status(500).json({ success: false, message: err.sqlMessage || "Server error" });
  }
});

// ─── CHANGE PASSWORD (all roles) ───
router.post("/me/change-password", require("../middlewares/requireAuth"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: "current_password and new_password required" });
    }

    if (String(new_password).length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }
    if (String(current_password).length > 128 || String(new_password).length > 128) {
      return res.status(400).json({ success: false, message: "Password must be 128 characters or less" });
    }

    // Verify current password
    const [rows] = await pool.query("SELECT password FROM users WHERE id = ? LIMIT 1", [userId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isValid = await bcrypt.compare(current_password, rows[0].password);
    if (!isValid) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?", [hashed, userId]);

    // Security mail, best-effort: never blocks the change.
    try {
      const { notifyCustomer } = require("../utils/notifyCustomer");
      await notifyCustomer(userId, "password_changed");
    } catch (_) {}

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GOOGLE OAUTH ───
const { OAuth2Client } = require("google-auth-library");

function getGoogleClient() {
  return new OAuth2Client();
}

function getGoogleAudiences() {
  const primary = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  const extras = String(process.env.GOOGLE_CLIENT_IDS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  return [...new Set([primary, ...extras].filter(Boolean))];
}

// Fail-soft but loud: without an audience the /auth/google routes can only
// answer 500. Surface it once at boot so it shows in pm2 logs.
if (!getGoogleAudiences().length) {
  console.warn(
    "[auth] WARNING: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_IDS is not set — " +
    "Google sign-in will return 'Google sign-in is temporarily unavailable. Please try again later.' until it is."
  );
}

function calculateAgeFromDob(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// POST /auth/google — verify credential, return JWT if existing user or profile info if new
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ success: false, message: "Google credential is required" });
    const googleAudiences = getGoogleAudiences();
    if (!googleAudiences.length) return res.status(500).json({ success: false, message: "Google sign-in is temporarily unavailable. Please try again later." });

    const client = getGoogleClient();
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: googleAudiences.length === 1 ? googleAudiences[0] : googleAudiences,
      });
      payload = ticket.getPayload();
    } catch (e) {
      // Server-side only: the real reason (expired token, wrong audience aka
      // old/revoked client, etc.). Message only — never the credential.
      console.error("GOOGLE VERIFY ERROR:", e?.message || e);
      // No account to lock here, but repeated junk credentials from one IP
      // still earn the shared IP cooldown.
      try {
        const { recordGoogleFailure } = require("../utils/loginAttempts");
        const limited = await recordGoogleFailure(clientIp(req));
        if (limited) return lockedResponse(res, limited);
      } catch (_) {}
      return res.status(401).json({ success: false, message: "Invalid Google credential. Please try again." });
    }

    const emailNorm = String(payload.email || "").trim().toLowerCase();
    if (!emailNorm) return res.status(400).json({ success: false, message: "Google account has no email." });

    // Only Google-confirmed addresses are trusted. Anything else cannot be
    // linked to an account.
    if (payload.email_verified !== true) {
      return res.status(401).json({ success: false, message: "Google could not confirm this email address. Please try again." });
    }

    const profileName = String(
      payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(" ") || ""
    ).trim();

    // Check maintenance mode
    const { maintenanceMode, maintenanceMessage } = await getMaintenanceState();
    if (maintenanceMode) {
      return res.status(503).json({ success: false, code: "MAINTENANCE_MODE", message: maintenanceMessage || "Platform is under maintenance." });
    }

    // Check if user already exists
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.role_id, r.name AS role_name,
              u.is_active, u.status, u.is_verified, u.bar_id, u.phone_number, u.date_of_birth,
              u.profile_picture, b.name AS bar_name,
              u.approval_status, u.approval_rejection_reason
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN bars b ON b.id = u.bar_id
       WHERE u.email = ? LIMIT 1`,
      [emailNorm]
    );

    if (rows.length) {
      const user = rows[0];

      if (user.is_active === 0) {
        return res.status(403).json({ success: false, code: "ACCOUNT_DEACTIVATED", message: "Your account has been deactivated." });
      }

      // 3-tier staff status guard (mirrors password login).
      const gStatus = String(user.status || 'active').toLowerCase();
      if (gStatus === 'archived' || gStatus === 'fully_deactivated') {
        return res.status(403).json({ success: false, code: "ACCOUNT_DEACTIVATED", message: "Your account for this bar has been deactivated. Please contact management." });
      }

      // Only allow customer role via Google login on this portal
      const roleName = String(user.role_name || user.role || "").toUpperCase();
      if (roleName !== "CUSTOMER") {
        return res.status(403).json({ success: false, code: "ROLE_NOT_ALLOWED", message: "This account cannot access the Customer Website." });
      }

      // Global platform ban check (same rule as email/password login)
      if (await hasGlobalBanColumn()) {
        const [[banRow]] = await pool.query(
          "SELECT COALESCE(is_banned, 0) AS is_banned FROM users WHERE id = ? LIMIT 1",
          [user.id]
        );

        if (Number(banRow?.is_banned || 0) === 1) {
          let banMessage = "Your account has been banned from the platform.";
          if (await hasUserBanReasonColumn()) {
            const [[banReasonRow]] = await pool.query(
              "SELECT ban_reason FROM users WHERE id = ? LIMIT 1",
              [user.id]
            );
            const reason = String(banReasonRow?.ban_reason || "").trim();
            if (reason) banMessage = reason;
          }

          return res.status(403).json({
            success: false,
            code: "ACCOUNT_BANNED",
            message: banMessage,
          });
        }
      }

      // Auto-verify email if not yet verified (Google accounts are pre-verified)
      if (!user.is_verified) {
        await pool.query("UPDATE users SET is_verified = 1, updated_at = NOW() WHERE id = ?", [user.id]);
      }

      // Update profile picture from Google if user has default/no picture
      if (payload.picture && (!user.profile_picture || user.profile_picture === DEFAULT_AVATAR)) {
        await pool.query("UPDATE users SET profile_picture = ?, updated_at = NOW() WHERE id = ?", [payload.picture, user.id]);
      }

      const hasCustomStoredProfilePicture =
        !!user.profile_picture && user.profile_picture !== DEFAULT_AVATAR;
      const effectiveProfilePicture = hasCustomStoredProfilePicture
        ? user.profile_picture
        : (payload.picture || user.profile_picture);
      const effectiveProfileUrl = hasCustomStoredProfilePicture
        ? safeProfileUrl(user.profile_picture)
        : (payload.picture || safeProfileUrl(user.profile_picture));

      // Customer approval gate (mirrors password login, incl. no audit spam).
      const googleApprovalBlock = checkCustomerApproval(user);
      if (googleApprovalBlock) {
        return res.status(403).json({ success: false, ...googleApprovalBlock });
      }

      const token = signToken(user);
      const permissionCodes = await getEffectivePermissionCodes(user.id);
      const barBanNotices = await getCustomerBarBanNotices(user.id);

      return res.json({
        success: true,
        new_user: false,
        data: {
          token,
          user: {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            bar_id: user.bar_id,
            bar_name: user.bar_name || null,
            phone_number: user.phone_number,
            date_of_birth: user.date_of_birth,
            profile_picture: effectiveProfilePicture,
            profile_url: effectiveProfileUrl,
            is_active: user.is_active,
            is_verified: Number(user.is_verified || 0) === 1,
            isVerified: Number(user.is_verified || 0) === 1,
            email_verified: Number(user.is_verified || 0) === 1,
            verified: Number(user.is_verified || 0) === 1 ? "VERIFIED" : "UNVERIFIED"
          },
          permissions: permissionCodes,
          bar_ban_notices: barBanNotices
        }
      });
    }

    // No account for this address: never auto-create on sign-in. The client
    // routes the user to registration with the verified details prefilled.
    return res.status(404).json({
      success: false,
      code: "ACCOUNT_NOT_FOUND",
      message: "This Google account is not registered yet. Please create an account first.",
      email: emailNorm,
      name: profileName,
    });
  } catch (err) {
    console.error("GOOGLE AUTH ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── FORGOT PASSWORD ───
router.post("/forgot-password", ipRouteLimit("forgot-password"), async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const emailNorm = String(email).trim().toLowerCase();
    const [rows] = await pool.query(
      "SELECT id, first_name, role FROM users WHERE email = ? AND is_active = 1 LIMIT 1",
      [emailNorm]
    );

    // Always return success to avoid email enumeration
    if (!rows.length) {
      return res.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });
    }

    const user = rows[0];

    // Ensure password_reset_token columns exist
    try {
      const [cols] = await pool.query("SHOW COLUMNS FROM users LIKE 'password_reset_token'");
      if (!cols.length) {
        await pool.query(
          "ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(255) DEFAULT NULL, ADD COLUMN password_reset_expires DATETIME DEFAULT NULL"
        );
      }
    } catch (_) {}

    // Rate limit: block if a token was issued < 60s ago
    try {
      const [tokenRow] = await pool.query(
        "SELECT password_reset_expires FROM users WHERE id = ? LIMIT 1",
        [user.id]
      );
      if (tokenRow[0]?.password_reset_expires) {
        const issuedAt = new Date(tokenRow[0].password_reset_expires).getTime() - (60 * 60 * 1000);
        const secondsSince = Math.floor((Date.now() - issuedAt) / 1000);
        if (secondsSince < 60) {
          const wait = 60 - secondsSince;
          return res.status(429).json({
            success: false,
            code: "RESET_COOLDOWN",
            message: `Please wait ${wait} second${wait !== 1 ? 's' : ''} before requesting another reset.`,
            wait_seconds: wait
          });
        }
      }
    } catch (_) {}

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      "UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?",
      [resetToken, tokenExpires, user.id]
    );

    // Unknown addresses still get the generic success (no enumeration), but
    // a REAL account whose mail fails gets an honest 500 instead of a false
    // "Reset link sent" screen — the failure is logged server-side.
    let mailOk = true;
    try {
      const isManagerPortal = req.get('x-login-portal') === 'bar_management';
      await sendPasswordResetEmail(emailNorm, user.first_name, resetToken, isManagerPortal ? 'manager' : 'customer');
      try {
        const { auditEmail } = require("../utils/notifyCustomer");
        await auditEmail(user.id, emailNorm, "password_reset_requested", "Reset your Party Goers password");
      } catch (_) {}
    } catch (emailErr) {
      console.error("PASSWORD RESET EMAIL ERROR:", emailErr?.code || "", emailErr?.message || emailErr);
      mailOk = false;
    }

    if (!mailOk) {
      return res.status(500).json({ success: false, message: "We couldn't send the email, please try again." });
    }
    return res.json({ success: true, message: "If an account exists with that email, a reset link has been sent." });
  } catch (err) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── RESET PASSWORD ───
router.post("/reset-password", async (req, res) => {
  try {
    const { token, new_password } = req.body || {};
    if (!token || !new_password) {
      return res.status(400).json({ success: false, message: "Token and new_password are required" });
    }
    if (String(new_password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const [rows] = await pool.query(
      "SELECT id, password_reset_expires FROM users WHERE password_reset_token = ? LIMIT 1",
      [token]
    );

    if (!rows.length) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link. Please request a new one." });
    }

    const user = rows[0];
    if (new Date() > new Date(user.password_reset_expires)) {
      return res.status(410).json({ success: false, message: "This reset link has expired. Please request a new one." });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query(
      "UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW() WHERE id = ?",
      [hashed, user.id]
    );

    return res.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error("RESET PASSWORD ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── UPLOAD PROFILE PICTURE (all roles) ───
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/profiles";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `user_${req.user.id}_${Date.now()}${ext}`);
  }
});
const profileUpload = multer({ storage: profileStorage, limits: { fileSize: 5 * 1024 * 1024 } });

const regDocsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/registration_docs";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `reg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const regDocsUpload = multer({ storage: regDocsStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/me/profile-picture", require("../middlewares/requireAuth"), profileUpload.single("profile_picture"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // Delete old profile picture file if it exists
    const [oldRows] = await pool.query(
      "SELECT profile_picture FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    if (oldRows.length && oldRows[0].profile_picture) {
      const oldPath = path.resolve(oldRows[0].profile_picture);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (_) {}
      }
    }

    const filePath = req.file.path.replace(/\\/g, "/");
    await pool.query("UPDATE users SET profile_picture = ?, updated_at = NOW() WHERE id = ?", [filePath, req.user.id]);

    return res.json({ success: true, message: "Profile picture updated", data: { profile_picture: filePath, profile_url: safeProfileUrl(filePath) } });
  } catch (err) {
    console.error("PROFILE PICTURE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── BAR OWNER REGISTRATION (multi-step form, named doc uploads) ───
const barOwnerDocsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/registration_docs";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fieldSafe = file.fieldname.replace(/[^a-z0-9]/gi, "_");
    cb(null, `${fieldSafe}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const barOwnerUpload = multer({
  storage: barOwnerDocsStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only JPG, PNG, and PDF files are allowed"));
  }
});

router.post(
  "/register-bar-owner",
  barOwnerUpload.fields([
    ...REGISTRATION_DOC_KEYS.map((name) => ({ name, maxCount: 1 })),
    { name: "dti_sec_registration", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        // Step 1 — Owner Account
        first_name, middle_name, last_name, email, password, phone_number,
        // Step 2 — Bar Details
        bar_name, bar_address, bar_city, bar_barangay, bar_types, bar_description,
        opening_time, closing_time, gcash_number, gcash_name, bar_contact_number,
        // Step 3 — Documents (OCR extracted)
        permit_expiry_date
      } = req.body || {};

      const barName = String(bar_name || "").trim();
      const barAddress = String(bar_address || "").trim();
      const barCity = String(bar_city || "").trim();
      const barBarangay = bar_barangay ? String(bar_barangay).trim() : null;

      // --- Validation ---
      if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ success: false, message: "Owner first name, last name, email, and password are required" });
      }
      if (!barName || !barAddress || !barCity) {
        return res.status(400).json({ success: false, message: "Bar name, address, and city are required" });
      }

      const firstNameValidation = normalizeName(first_name, "Owner first name");
      if (firstNameValidation.error) {
        return res.status(400).json({ success: false, message: firstNameValidation.error });
      }
      const lastNameValidation = normalizeName(last_name, "Owner last name");
      if (lastNameValidation.error) {
        return res.status(400).json({ success: false, message: lastNameValidation.error });
      }
      const middleNameValidation = normalizeName(middle_name, "Owner middle name", { required: false });
      if (middleNameValidation.error) {
        return res.status(400).json({ success: false, message: middleNameValidation.error });
      }

      const phoneValidation = normalizePhoneNumber(phone_number, {
        required: false,
        fieldLabel: "Phone number",
      });
      if (phoneValidation.error) {
        return res.status(400).json({ success: false, message: phoneValidation.error });
      }

      const emailNorm = String(email).trim().toLowerCase();
      if (emailNorm.length > 255) {
        return res.status(400).json({ success: false, message: "Invalid email format" });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        return res.status(400).json({ success: false, message: "Invalid email format" });
      }
      if (String(password).length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
      }
      if (String(password).length > 128) {
        return res.status(400).json({ success: false, message: "Password must be 128 characters or less" });
      }

      // Every permit on config/requiredPermits.js accompanies the signup.
      const docFiles = {};
      for (const column of REGISTRATION_DOC_KEYS) {
        const file = req.files?.[column]?.[0];
        if (!file) {
          return res.status(400).json({ success: false, message: `${labelFor(column)} is required` });
        }
        docFiles[column] = file;
      }
      const selfieExt = path.extname(docFiles.selfie_with_id.originalname).toLowerCase();
      if (![".jpg", ".jpeg", ".png"].includes(selfieExt)) {
        return res.status(400).json({ success: false, message: `${labelFor("selfie_with_id")} must be a JPG or PNG image` });
      }

      // Check duplicate email in users
      const [existingUser] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [emailNorm]);
      if (existingUser.length) {
        return res.status(409).json({ success: false, message: "This email is already registered. Please log in instead." });
      }

      // Check duplicate pending registration
      const [existingReg] = await pool.query(
      "SELECT id FROM business_registrations WHERE owner_email = ? AND status IN ('pending','pending_email_verification','pending_admin_approval') LIMIT 1",
        [emailNorm]
      );
      if (existingReg.length) {
        return res.status(409).json({ success: false, message: "A registration with this email is already pending review." });
      }

      // Check duplicate phone (if provided)
      if (phoneValidation.value) {
        const phoneNorm = phoneValidation.value;
        const [phoneExists] = await pool.query(
          "SELECT id FROM users WHERE phone_number = ? LIMIT 1",
          [phoneNorm]
        );
        if (phoneExists.length) {
          return res.status(409).json({ success: false, message: "Phone number already in use" });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const docPaths = Object.fromEntries(
        REGISTRATION_DOC_KEYS.map((column) => [column, docFiles[column].path.replace(/\\/g, "/")])
      );

      const verificationToken = crypto.randomBytes(32).toString("hex");
      const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      let barTypesJson = null;
      if (bar_types) {
        try {
          const parsed = JSON.parse(bar_types);
          if (Array.isArray(parsed)) barTypesJson = JSON.stringify(parsed);
        } catch (_) {
          barTypesJson = null;
        }
      }
      const fullAddress = barBarangay ? `${barAddress}, ${barBarangay}` : barAddress;

      const [result] = await pool.query(
        `INSERT INTO business_registrations
         (business_name, business_address, business_city, business_state, business_phone, bar_contact_number, business_barangay, bar_types,
          business_description, opening_time, closing_time, gcash_number, gcash_name,
          owner_first_name, owner_middle_name, owner_last_name, owner_email, owner_phone, owner_password,
          email_verification_token, email_verification_expires,
          ${REGISTRATION_DOC_KEYS.join(", ")}, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${REGISTRATION_DOC_KEYS.map(() => "?").join(", ")}, 'pending_email_verification', NOW(), NOW())`,
        [
          barName, fullAddress, barCity, "Cavite", phoneValidation.value, bar_contact_number?.trim() || null, barBarangay || null, barTypesJson,
          bar_description || null, opening_time || null, closing_time || null,
          gcash_number || null, gcash_name || null,
          firstNameValidation.value,
          middleNameValidation.value,
          lastNameValidation.value,
          emailNorm,
          phoneValidation.value,
          hashedPassword,
          verificationToken, tokenExpires,
          ...REGISTRATION_DOC_KEYS.map((column) => docPaths[column])
        ]
      );

      try {
        await sendBarOwnerVerificationEmail(emailNorm, firstNameValidation.value, verificationToken);
      } catch (emailErr) {
        console.error("BAR OWNER VERIFICATION EMAIL ERROR:", emailErr);
      }

      return res.status(201).json({
        success: true,
        message: "Registration submitted. Please check your email to verify your address before admin review.",
        data: { registration_id: result.insertId }
      });
    } catch (err) {
      console.error("BAR OWNER REGISTER ERROR:", err);
      return res.status(500).json({ success: false, message: err.sqlMessage || err.message || "Server error" });
    }
  }
);

router.get("/verify-bar-owner-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: "Token is required" });

    const [rows] = await pool.query(
      "SELECT id, email_verification_expires, email_verified_at, status FROM business_registrations WHERE email_verification_token = ? LIMIT 1",
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Invalid or already used verification link." });
    }

    const reg = rows[0];
    if (reg.email_verified_at) {
      return res.json({
        success: true,
        message: "Email already verified. Your account is under review. You will be notified once approved."
      });
    }

    if (reg.email_verification_expires && new Date() > new Date(reg.email_verification_expires)) {
      return res.status(410).json({ success: false, message: "Verification link has expired. Please register again." });
    }

    await pool.query(
      "UPDATE business_registrations SET email_verified_at = NOW(), email_verification_token = NULL, email_verification_expires = NULL, status = 'pending_admin_approval' WHERE id = ?",
      [reg.id]
    );

    return res.json({
      success: true,
      message: "Your account is under review. You will be notified once approved."
    });
  } catch (err) {
    console.error("VERIFY BAR OWNER EMAIL ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── JOIN TPG: Business Registration (public, with doc uploads) ───
router.post("/register-business", regDocsUpload.array("supporting_docs", 5), async (req, res) => {
  try {
    const {
      business_name, business_address, business_city, business_state,
      business_zip, business_phone, business_email, business_category,
      owner_first_name, owner_last_name, owner_email, owner_phone, owner_password
    } = req.body || {};

    const businessName = String(business_name || "").trim();
    const businessAddress = String(business_address || "").trim();
    const businessCity = String(business_city || "").trim();
    const businessState = business_state ? String(business_state).trim() : null;
    const businessZip = business_zip ? String(business_zip).trim() : null;
    const businessCategory = business_category ? String(business_category).trim() : null;
    const businessEmailNorm = business_email ? String(business_email).trim().toLowerCase() : null;

    // Validate required fields
    if (!businessName || !businessAddress || !businessCity || !business_phone) {
      return res.status(400).json({ success: false, message: "Business name, address, city, and phone are required" });
    }
    if (!owner_first_name || !owner_last_name || !owner_email || !owner_phone || !owner_password) {
      return res.status(400).json({ success: false, message: "Owner first name, last name, email, phone, and password are required" });
    }

    const ownerFirstNameValidation = normalizeName(owner_first_name, "Owner first name");
    if (ownerFirstNameValidation.error) {
      return res.status(400).json({ success: false, message: ownerFirstNameValidation.error });
    }

    const ownerLastNameValidation = normalizeName(owner_last_name, "Owner last name");
    if (ownerLastNameValidation.error) {
      return res.status(400).json({ success: false, message: ownerLastNameValidation.error });
    }

    const businessPhoneValidation = normalizePhoneNumber(business_phone, {
      required: true,
      fieldLabel: "Business phone",
    });
    if (businessPhoneValidation.error) {
      return res.status(400).json({ success: false, message: businessPhoneValidation.error });
    }

    const ownerPhoneValidation = normalizePhoneNumber(owner_phone, {
      required: true,
      fieldLabel: "Owner phone",
    });
    if (ownerPhoneValidation.error) {
      return res.status(400).json({ success: false, message: ownerPhoneValidation.error });
    }

    const emailNorm = String(owner_email).trim().toLowerCase();
    if (emailNorm.length > 255) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }
    if (businessEmailNorm && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmailNorm)) {
      return res.status(400).json({ success: false, message: "Invalid business email format" });
    }
    if (String(owner_password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    if (String(owner_password).length > 128) {
      return res.status(400).json({ success: false, message: "Password must be 128 characters or less" });
    }

    // Check if email already exists in users OR pending registrations
    const [existingUser] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [emailNorm]);
    if (existingUser.length) {
      return res.status(409).json({ success: false, message: "This email is already registered. Please login instead." });
    }

    const [existingReg] = await pool.query(
      "SELECT id FROM business_registrations WHERE owner_email = ? AND status = 'pending' LIMIT 1",
      [emailNorm]
    );
    if (existingReg.length) {
      return res.status(409).json({ success: false, message: "A registration with this email is already pending review." });
    }

    // Check duplicate owner phone in users (if provided)
    if (ownerPhoneValidation.value) {
      const phoneNorm = ownerPhoneValidation.value;
      const [phoneExists] = await pool.query(
        "SELECT id FROM users WHERE phone_number = ? LIMIT 1",
        [phoneNorm]
      );
      if (phoneExists.length) {
        return res.status(409).json({ success: false, message: "Owner phone number already in use" });
      }
    }

    const hashedPassword = await bcrypt.hash(owner_password, 10);

    // Collect uploaded document paths
    const docPaths = (req.files || []).map(f => f.path.replace(/\\/g, "/"));
    const docsJson = docPaths.length ? JSON.stringify(docPaths) : null;

    const [result] = await pool.query(
      `INSERT INTO business_registrations
       (business_name, business_address, business_city, business_state, business_zip,
        business_phone, business_email, business_category,
        owner_first_name, owner_last_name, owner_email, owner_phone, owner_password, supporting_docs, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        businessName,
        businessAddress,
        businessCity,
        businessState,
        businessZip,
        businessPhoneValidation.value,
        businessEmailNorm,
        businessCategory,
        ownerFirstNameValidation.value,
        ownerLastNameValidation.value,
        emailNorm,
        ownerPhoneValidation.value,
        hashedPassword,
        docsJson
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Your registration has been submitted and is pending approval.",
      data: { registration_id: result.insertId, documents_uploaded: docPaths.length }
    });
  } catch (err) {
    console.error("REGISTER BUSINESS ERROR:", err);
    return res.status(500).json({ success: false, message: err.sqlMessage || "Server error" });
  }
});

module.exports = router;
