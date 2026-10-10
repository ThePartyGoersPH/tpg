// Brute-force protection for every password login (customer, manager/bar
// owner, POS, super admin share POST /auth/login) plus Google-verify and
// forgot/register IP limits.
//
// Storage is MySQL (survives restarts, shared by every instance) in
// login_attempts / ip_rate_limits. Every check-then-write pair runs inside
// one transaction with SELECT ... FOR UPDATE so parallel requests cannot
// slip past the limit.
//
// Row flavours in login_attempts (UNIQUE identifier, app, ip):
//   account rows: identifier = lowercased email, app = '', ip = ''. ONE row
//     per account across every portal and role — deliberately NOT split, so
//     switching portals or roles buys no fresh attempts. Carry failed_count,
//     lock_level and locked_until for the escalating 5 -> 60 minute ladder.
//     Portal/role travel in the audit details instead.
//   IP rows:      identifier = 'ip', app = '', ip = the address. Carry a
//     short fixed cooldown so one attacker can't sweep accounts.

const bcrypt = require("bcrypt");
const pool = require("../config/database");
const policy = require("../config/loginSecurity");

// Burned once at boot so unknown-email logins cost the same bcrypt work as
// real ones — identical timing whether the address exists or not.
const DUMMY_HASH = bcrypt.hashSync("invalid-login-timing-pad-v1", 10);

function clientIp(req) {
  // index.js sets "trust proxy", so req.ip already honours X-Forwarded-For
  // behind nginx. The manual parse is a belt-and-braces fallback.
  const fwd = req.headers ? req.headers["x-forwarded-for"] : "";
  const raw = String(
    req.ip || (typeof fwd === "string" ? fwd.split(",")[0] : "") || (req.socket && req.socket.remoteAddress) || ""
  )
    .trim()
    .slice(0, 45);
  return raw || "unknown";
}

function userAgent(req) {
  try {
    return String(req.get ? req.get("user-agent") || "" : "").slice(0, 255);
  } catch (_) {
    return "";
  }
}

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mmss(totalSeconds) {
  const s = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Lock length for a zero-based level: base * 2^level, capped.
function lockMinutesForLevel(level) {
  const raw = policy.LOCK_BASE_MINUTES * 2 ** Math.max(0, Number(level) || 0);
  return Math.min(raw, policy.LOCK_MAX_MINUTES);
}

function lockPayload(lockedUntil) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)
  );
  return {
    retryAfterSeconds,
    lockedUntil: lockedUntil.toISOString(),
    message: `Too many failed attempts. Try again in ${mmss(retryAfterSeconds)}.`,
  };
}

async function loadRow(conn, identifier, app, ip) {
  const [[row]] = await conn.query(
    "SELECT * FROM login_attempts WHERE identifier = ? AND app = ? AND ip = ? LIMIT 1",
    [identifier, app, ip]
  );
  return row || null;
}

function quietStale(row) {
  if (!row || !row.last_failed_at) return false;
  const last = toDate(row.last_failed_at);
  if (!last) return false;
  return Date.now() - last.getTime() > policy.QUIET_RESET_HOURS * 3600 * 1000;
}

// Read-only pre-check. Returns { allowed:true } or { allowed:false, ...lock }.
async function checkLoginAllowed(identifier, ip) {
  const email = String(identifier || "").trim().toLowerCase();
  if (!email) return { allowed: true };

  const [[account]] = await pool.query(
    "SELECT locked_until FROM login_attempts WHERE identifier = ? AND app = '' LIMIT 1",
    [email]
  );
  const until = account && toDate(account.locked_until);
  if (until && until.getTime() > Date.now()) {
    return { allowed: false, scope: "account", ...lockPayload(until) };
  }

  const [[ipRow]] = await pool.query(
    "SELECT locked_until FROM login_attempts WHERE identifier = 'ip' AND app = '' AND ip = ? LIMIT 1",
    [ip]
  );
  const ipUntil = ipRow && toDate(ipRow.locked_until);
  if (ipUntil && ipUntil.getTime() > Date.now()) {
    return { allowed: false, scope: "ip", ...lockPayload(ipUntil) };
  }

  return { allowed: true };
}

function lockedResponse(res, lock) {
  res.set("Retry-After", String(lock.retryAfterSeconds));
  return res.status(429).json({
    success: false,
    code: "ACCOUNT_LOCKED",
    message: lock.message,
    retryAfterSeconds: lock.retryAfterSeconds,
    lockedUntil: lock.lockedUntil,
  });
}

async function auditPlatform({ action, userId, email, app, ip, userAgent: ua, details }) {
  // actor_user_id carries an FK to users, so unknown-email events (no user
  // row) stay in login_attempts only — that row keeps email + ip + agent.
  if (!userId) return;
  try {
    await pool.query(
      `INSERT INTO platform_audit_logs
       (actor_user_id, action, entity, entity_id, target_bar_id, details, ip_address, user_agent)
       VALUES (?, ?, 'user', ?, NULL, ?, ?, ?)`,
      [userId, action, userId, JSON.stringify({ email, app, ...(details || {}) }), ip, ua]
    );
  } catch (_) {
    // Audit must never break authentication.
  }
}

// Record one failed password attempt (account row + IP row, atomically).
// The account row is keyed (identifier) alone — deliberately NOT per portal
// or role — so an attacker can't buy fresh attempts by switching portals.
// Portal/role travel in the audit details instead. Returns
// { locked, attemptsRemaining?, lock?... , ipLimited }.
async function recordFailure({ identifier, ip, userId }) {
  const email = String(identifier || "").trim().toLowerCase();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const now = new Date();

    let account = (await loadRow(conn, email, "", "")) || {
      failed_count: 0,
      lock_level: 0,
      locked_until: null,
      last_failed_at: null,
    };
    if (quietStale(account)) {
      account = { failed_count: 0, lock_level: 0, locked_until: null, last_failed_at: null };
    }

    const newCount = Number(account.failed_count || 0) + 1;
    const firstSeen = account.first_attempt_at || now;
    let locked = null;

    if (newCount >= policy.MAX_FAILED_ATTEMPTS) {
      const level = Number(account.lock_level || 0);
      const minutes = lockMinutesForLevel(level);
      const until = new Date(now.getTime() + minutes * 60 * 1000);
      // Account rows are keyed (identifier, '', '') for life: the key
      // columns are never touched by the UPDATE, so the row can neither hide
      // from the next read nor collide with a sibling. Per-request IPs live
      // in the sibling IP rows and in the audit trail, not here.
      await conn.query(
        `INSERT INTO login_attempts
           (identifier, app, ip, user_id, failed_count, lock_level, locked_until, first_attempt_at, last_failed_at)
         VALUES (?, ?, '', ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           failed_count = ?, lock_level = ?, locked_until = ?, last_failed_at = ?`,
        [email, "", userId || null, policy.MAX_FAILED_ATTEMPTS, level + 1, until, firstSeen, now,
         policy.MAX_FAILED_ATTEMPTS, level + 1, until, now]
      );
      locked = { level, durationMinutes: minutes, ...lockPayload(until) };
    } else {
      await conn.query(
        `INSERT INTO login_attempts (identifier, app, ip, user_id, failed_count, lock_level, locked_until, first_attempt_at, last_failed_at)
         VALUES (?, ?, '', ?, ?, ?, NULL, ?, ?)
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           failed_count = ?, lock_level = ?, locked_until = NULL, last_failed_at = ?`,
        [email, "", userId || null, newCount, Number(account.lock_level || 0), firstSeen, now,
         newCount, Number(account.lock_level || 0), now]
      );
    }

    // IP counter lives beside it in the same transaction.
    let ipRow = await loadRow(conn, "ip", "", ip);
    const windowMs = policy.IP_WINDOW_MINUTES * 60 * 1000;
    const windowStart = ipRow && toDate(ipRow.first_attempt_at);
    if (!ipRow || !windowStart || now.getTime() - windowStart.getTime() > windowMs) {
      ipRow = { failed_count: 0 };
    }
    const ipCount = Number(ipRow.failed_count || 0) + 1;
    let ipLimited = null;
    if (ipCount >= policy.IP_MAX_FAILURES) {
      const until = new Date(now.getTime() + policy.IP_LOCK_MINUTES * 60 * 1000);
      ipLimited = { ...lockPayload(until) };
    }
    await conn.query(
      `INSERT INTO login_attempts (identifier, app, ip, failed_count, lock_level, locked_until, first_attempt_at, last_failed_at)
       VALUES ('ip', '', ?, ?, 0, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         failed_count = ?, locked_until = ?, first_attempt_at = ?, last_failed_at = ?`,
      [ip, ipCount, ipLimited ? ipLimited.lockedUntil : null, ipRow.first_attempt_at || now, now,
       ipCount, ipLimited ? ipLimited.lockedUntil : null, ipRow.first_attempt_at || now, now]
    );

    await conn.commit();

    if (locked) {
      return { locked: true, attemptsRemaining: 0, lock: locked, ipLimited: Boolean(ipLimited) };
    }
    return {
      locked: false,
      attemptsRemaining: Math.max(0, policy.MAX_FAILED_ATTEMPTS - newCount),
      ipLimited: Boolean(ipLimited),
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

// A correct password wipes the slate: counter and lock level both reset. The
// IP row is cleared too so a legit user behind shared NAT doesn't inherit an
// attacker's count. Returns true when a lock had been in force (the caller
// logs "successful login after a lock" in that case).
async function resetOnSuccess({ identifier, ip }) {
  const email = String(identifier || "").trim().toLowerCase();
  try {
    const [[row]] = await pool.query(
      "SELECT lock_level, locked_until FROM login_attempts WHERE identifier = ? AND app = '' LIMIT 1",
      [email]
    );
    const hadLockHistory =
      Boolean(row) && (Number(row.lock_level || 0) > 0 || Boolean(toDate(row.locked_until)));
    await pool.query("DELETE FROM login_attempts WHERE identifier = ? AND app = ''", [email]);
    await pool.query("DELETE FROM login_attempts WHERE identifier = 'ip' AND app = '' AND ip = ?", [ip]);
    return hadLockHistory;
  } catch (_) {
    return false;
  }
}

// Google verify failures have no account to lock — only the per-IP brake.
async function recordGoogleFailure(ip) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const now = new Date();
    const windowMs = policy.IP_WINDOW_MINUTES * 60 * 1000;
    let ipRow = await loadRow(conn, "ip", "", ip);
    const windowStart = ipRow && toDate(ipRow.first_attempt_at);
    if (!ipRow || !windowStart || now.getTime() - windowStart.getTime() > windowMs) {
      ipRow = { failed_count: 0 };
    }
    const ipCount = Number(ipRow.failed_count || 0) + 1;
    let limited = null;
    if (ipCount >= policy.IP_MAX_FAILURES) {
      limited = { ...lockPayload(new Date(now.getTime() + policy.IP_LOCK_MINUTES * 60 * 1000)) };
    }
    await conn.query(
      `INSERT INTO login_attempts (identifier, app, ip, failed_count, lock_level, locked_until, first_attempt_at, last_failed_at)
       VALUES ('ip', '', ?, ?, 0, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         failed_count = ?, locked_until = ?, first_attempt_at = ?, last_failed_at = ?`,
      [ip, ipCount, limited ? limited.lockedUntil : null, ipRow.first_attempt_at || now, now,
       ipCount, limited ? limited.lockedUntil : null, ipRow.first_attempt_at || now, now]
    );
    await conn.commit();
    return limited;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

// Generic per-route IP bucket (forgot-password, register): max N per window.
async function checkRouteLimit(route, ip) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const now = new Date();
    const windowMs = policy.ROUTE_WINDOW_MINUTES * 60 * 1000;
    const [[row]] = await conn.query(
      "SELECT window_start, request_count FROM ip_rate_limits WHERE route = ? AND ip = ? LIMIT 1 FOR UPDATE",
      [route, ip]
    );
    const start = row && toDate(row.window_start);
    let count;
    let windowStart;
    if (!row || !start || now.getTime() - start.getTime() > windowMs) {
      count = 1;
      windowStart = now;
    } else {
      count = Number(row.request_count || 0) + 1;
      windowStart = start;
    }
    await conn.query(
      `INSERT INTO ip_rate_limits (route, ip, window_start, request_count)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE window_start = VALUES(window_start), request_count = VALUES(request_count)`,
      [route, ip, windowStart, count]
    );
    await conn.commit();
    if (count > policy.ROUTE_MAX) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000)
      );
      return { limited: true, retryAfterSeconds };
    }
    return { limited: false };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

function ipRouteLimit(route) {
  return async (req, res, next) => {
    try {
      const result = await checkRouteLimit(route, clientIp(req));
      if (result.limited) {
        res.set("Retry-After", String(result.retryAfterSeconds));
        return res.status(429).json({
          success: false,
          code: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
          retryAfterSeconds: result.retryAfterSeconds,
        });
      }
      return next();
    } catch (_) {
      // A limiter outage must never take login-adjacent flows down.
      return next();
    }
  };
}

// bcrypt.compare is work-proportional, so unknown emails cost the same ~100ms
// as real ones: no timing oracle for account enumeration.
async function safeCompare(password, hash) {
  try {
    return await bcrypt.compare(String(password || ""), hash || DUMMY_HASH);
  } catch (_) {
    return false;
  }
}

module.exports = {
  policy,
  clientIp,
  userAgent,
  mmss,
  checkLoginAllowed,
  lockedResponse,
  recordFailure,
  resetOnSuccess,
  recordGoogleFailure,
  auditPlatform,
  ipRouteLimit,
  safeCompare,
};
