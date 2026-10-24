const pool = require("../config/database");

/**
 * Permission-based RBAC middleware (DB-driven)
 *
 * Resolution order:
 *  1. SUPER_ADMIN bypass → always allowed.
 *  2. Check user_permissions (per-user overrides).
 *     - If ANY row exists for this user, ONLY user_permissions is used
 *       (granted = 1 means allowed, absence or granted = 0 means denied).
 *  3. Fall back to role_permissions (defaults for the user's role).
 *
 * Accepts a single permission string or an array (OR logic — any match grants access).
 */
module.exports = (permissionCodeOrCodes) => {
  return async (req, res, next) => {
    try {
      const permissionCodes = Array.isArray(permissionCodeOrCodes)
        ? permissionCodeOrCodes.filter(Boolean)
        : [permissionCodeOrCodes].filter(Boolean);
      if (permissionCodes.length === 0) {
        return res.status(500).json({ success: false, message: "Server RBAC misconfiguration" });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      // BAR_OWNER and SUPER_ADMIN always have full, unrestricted access —
      // they are the accounts that grant permissions to everyone else, so they
      // must never be blocked by a granular permission check. Bypass on the
      // raw role string (normalized) so it works regardless of how the role
      // name is stored in the roles table.
      const rawRole = String(req.user?.role || '')
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
      if (rawRole === 'BAR_OWNER' || rawRole === 'SUPER_ADMIN') {
        return next();
      }

      // Load role + bar scope fresh from DB
      const [uRows] = await pool.query(
        `SELECT u.id, u.bar_id, u.role_id, u.role, r.name AS role_name
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? LIMIT 1`,
        [userId]
      );

      let user = uRows[0];
      if (!user) {
        return res.status(403).json({ success: false, message: "Forbidden (user not found)" });
      }

      // If role_id is not set, try to resolve it from the role string column
      if (!user.role_id || !user.role_name) {
        const roleStr = user.role || "";
        const [resolvedRole] = await pool.query(
          "SELECT id, name FROM roles WHERE UPPER(name) = UPPER(?) LIMIT 1",
          [roleStr]
        );
        if (!resolvedRole.length) {
          return res.status(403).json({ success: false, message: "Forbidden (role not mapped)" });
        }
        user = { ...user, role_id: resolvedRole[0].id, role_name: resolvedRole[0].name };
      }

      // SUPER_ADMIN bypass
      if (String(user.role_name || '').trim().toUpperCase() === "SUPER_ADMIN") return next();

      // BAR_OWNER bypass — bar owners have all permissions by design
      if (String(user.role_name || '').trim().toUpperCase() === "BAR_OWNER") return next();

      // Everyone else must be scoped to a bar (ADMIN is a platform master role, exempt)
      if (!user.bar_id && String(user.role_name || '').trim().toUpperCase() !== "ADMIN") {
        return res.status(403).json({ success: false, message: "Forbidden (no bar scope)" });
      }

      // Check if user has ANY per-user overrides
      const [overrideCheck] = await pool.query(
        "SELECT 1 FROM user_permissions WHERE user_id = ? LIMIT 1",
        [userId]
      );
      const hasOverrides = overrideCheck.length > 0;

      if (hasOverrides) {
        // User has custom permissions → ONLY check user_permissions (granted = 1)
        const [userPermRows] = await pool.query(
          `SELECT 1
           FROM user_permissions up
           JOIN permissions p ON p.id = up.permission_id
           WHERE up.user_id = ? AND up.granted = 1 AND p.name IN (?)
           LIMIT 1`,
          [userId, permissionCodes]
        );

        if (userPermRows.length === 0) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }
      } else {
        // No overrides → fall back to role defaults
        const [rolePermRows] = await pool.query(
          `SELECT 1
           FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
           WHERE rp.role_id = ? AND p.name IN (?)
           LIMIT 1`,
          [user.role_id, permissionCodes]
        );

        if (rolePermRows.length === 0) {
          return res.status(403).json({ success: false, message: "Forbidden" });
        }
      }

      // Attach for downstream handlers
      req.user.role_id = user.role_id;
      req.user.role_name = user.role_name;
      req.user.bar_id = user.bar_id;

      return next();
    } catch (err) {
      console.error("requirePermission error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
};
