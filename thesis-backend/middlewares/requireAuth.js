let maintenanceCache = {
  expiresAt: 0,
  maintenanceMode: false,
  maintenanceMessage: "",
};
let hasCustomerBarBanReasonColumnCache = null;
let hasBarSuspensionMessageColumnCache = null;

async function hasCustomerBarBanReasonColumn(pool) {
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

async function hasBarSuspensionMessageColumn(pool) {
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

async function getMaintenanceState(pool) {
  const now = Date.now();
  if (maintenanceCache.expiresAt > now) {
    return {
      maintenanceMode: maintenanceCache.maintenanceMode,
      maintenanceMessage: maintenanceCache.maintenanceMessage,
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
    maintenanceCache = {
      expiresAt: now + 15000,
      maintenanceMode: Number(settingsMap.maintenance_mode || 0) === 1,
      maintenanceMessage: String(settingsMap.maintenance_message || "").trim(),
    };
  } catch (_) {
    // Keep the app operational even if platform_settings does not exist yet.
    maintenanceCache = {
      expiresAt: now + 15000,
      maintenanceMode: false,
      maintenanceMessage: "",
    };
  }

  return {
    maintenanceMode: maintenanceCache.maintenanceMode,
    maintenanceMessage: maintenanceCache.maintenanceMessage,
  };
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Missing token",
    });
  }

  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user with role info from database
    const pool = require("../config/database");
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.role, u.role_id, u.bar_id, u.is_active, u.is_verified,
              r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id=?
       LIMIT 1`,
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // SECURITY: Block inactive/deactivated users from all API access
    if (!rows[0].is_active) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact your administrator.",
      });
    }

    // LIMITED SESSION for customers whose email was never confirmed: safe
    // reads (GET/HEAD/OPTIONS) pass through so they can browse with the banner
    // reminder, but every state-changing request is refused until they verify.
    // Customer-only effect — staff/owners/admins are untouched. The flag is
    // attached for downstream handlers that want to tailor responses.
    // (No approval gate: registration is auto-approved. Bans below still
    // block outright.)
    if (String(rows[0].role || "").trim().toLowerCase() === "customer" && !Number(rows[0].is_verified || 0)) {
      const method = String(req.method || "GET").trim().toUpperCase();
      if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        return res.status(403).json({
          success: false,
          code: "EMAIL_NOT_VERIFIED",
          email: rows[0].email,
          message: "Please verify your email to unlock this action. Check your inbox for the verification link and code."
        });
      }
      rows[0].email_unverified = true;
    }

    const roleName = String(rows[0].role_name || rows[0].role || "").toUpperCase();
    
    // Check if user is globally banned (only for non-super-admins)
    if (roleName !== "SUPER_ADMIN") {
      // Check for global ban
      try {
        const [banCheck] = await pool.query(
          "SELECT is_banned, ban_reason FROM users WHERE id = ? LIMIT 1",
          [decoded.id]
        );
        if (banCheck.length && Number(banCheck[0].is_banned || 0) === 1) {
          const banReason = String(banCheck[0].ban_reason || "").trim();
          return res.status(403).json({
            success: false,
            code: "USER_BANNED",
            message: banReason || "Your account has been banned from the platform.",
          });
        }
      } catch (banErr) {
        // Column might not exist, continue
      }
      
      // Check maintenance mode
      const { maintenanceMode, maintenanceMessage } = await getMaintenanceState(pool);
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
    
    req.user = rows[0];

    // ── Multi-branch: allow bar owners to override bar_id via X-Bar-Id header ──
    const xBarId = req.headers["x-bar-id"];
    if (xBarId) {
      const requestedBarId = parseInt(xBarId, 10);
      const role = String(rows[0].role || rows[0].role_name || "").toLowerCase();

      if (role === "bar_owner" && Number.isFinite(requestedBarId)) {
        // Verify the owner actually owns this bar
        const [ownerRows] = await pool.query(
          "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
          [rows[0].id]
        );
        if (ownerRows.length) {
          const [barRows] = await pool.query(
            "SELECT id FROM bars WHERE id = ? AND owner_id = ? AND is_locked = 0 LIMIT 1",
            [requestedBarId, ownerRows[0].id]
          );
          if (barRows.length) {
            req.user.bar_id = requestedBarId;
          }
        }
      }
    }

    // Enforce bar-side bans/suspensions (applies to bar-side roles, including active sessions)
    if (roleName !== "SUPER_ADMIN" && roleName !== "CUSTOMER") {
      try {
        const hasReason = await hasCustomerBarBanReasonColumn(pool);
        const [barBanRows] = await pool.query(
          `SELECT cbb.bar_id,
                  b.name AS bar_name,
                  ${hasReason ? "NULLIF(TRIM(cbb.ban_reason), '') AS ban_reason" : "NULL AS ban_reason"}
           FROM customer_bar_bans cbb
           LEFT JOIN bars b ON b.id = cbb.bar_id
           WHERE cbb.customer_id = ?
           ORDER BY cbb.banned_at DESC
           LIMIT 1`,
          [decoded.id]
        );

        if (barBanRows.length) {
          const reason = String(barBanRows[0].ban_reason || "").trim();
          return res.status(403).json({
            success: false,
            code: "BAR_ACCESS_BANNED",
            message: reason || "Your bar account access has been banned by platform administration.",
          });
        }

        let effectiveBarId = req.user.bar_id || null;
        if (!effectiveBarId && roleName === "BAR_OWNER") {
          const [ownedBarRows] = await pool.query(
            `SELECT b.id
             FROM bars b
             JOIN bar_owners bo ON bo.id = b.owner_id
             WHERE bo.user_id = ?
             ORDER BY b.id ASC
             LIMIT 1`,
            [decoded.id]
          );
          effectiveBarId = ownedBarRows[0]?.id || null;
        }

        if (effectiveBarId) {
          const hasSuspensionMessage = await hasBarSuspensionMessageColumn(pool);
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
      } catch (_) {
        // If customer_bar_bans is unavailable, do not block unrelated auth traffic
      }
    }

    next();
  } catch (e) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
}

module.exports = requireAuth;
