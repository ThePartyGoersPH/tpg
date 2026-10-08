const pool = require("../config/database");

/**
 * HR Operations Permission Middleware
 * 
 * Checks if user has ALL required HR permissions to operate as an HR.
 * This is a shortcut middleware that validates multiple HR-related permissions at once.
 * 
 * Required HR permissions:
 * - staff_view: View list of staff accounts
 * - staff_create: Create new staff accounts  
 * - staff_update: Edit staff profiles and details
 * - attendance_view_all: View attendance records of all staff
 * - leave_view_all: See all leave applications
 * - leave_approve: Approve or decline leave requests
 * - payroll_view_all: View all payroll records
 * - payroll_create: Run payroll processing
 * - documents_view_all: View all documents
 * - documents_send: Upload and send documents
 * 
 * Usage: router.get('/hr/dashboard', requireAuth, requireHRPermissions, async (req, res) => {...})
 */
const requireHRPermissions = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // List of all required HR permissions
    const requiredHRPermissions = [
      'staff_view',
      'staff_create', 
      'staff_update',
      'attendance_view_all',
      'leave_view_all',
      'leave_approve',
      'payroll_view_all',
      'payroll_create',
      'documents_view_all',
      'documents_send'
    ];

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
    if (String(user.role_name || '').trim().toUpperCase() === "SUPER_ADMIN") {
      req.user.hrPermissions = {
        hasAll: true,
        missing: [],
        present: requiredHRPermissions
      };
      return next();
    }

    // Everyone else must be scoped to a bar
    if (!user.bar_id) {
      return res.status(403).json({ success: false, message: "Forbidden (no bar scope)" });
    }

    // Check if user has ANY per-user overrides
    const [overrideCheck] = await pool.query(
      "SELECT 1 FROM user_permissions WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const hasOverrides = overrideCheck.length > 0;

    let userPermissions = [];
    
    if (hasOverrides) {
      // User has custom permissions → check user_permissions
      const [userPermRows] = await pool.query(
        `SELECT p.name
         FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id
         WHERE up.user_id = ? AND up.granted = 1`,
        [userId]
      );
      userPermissions = userPermRows.map(row => row.name);
    } else {
      // No overrides → fall back to role defaults
      const [rolePermRows] = await pool.query(
        `SELECT p.name
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [user.role_id]
      );
      userPermissions = rolePermRows.map(row => row.name);
    }

    // Check which HR permissions are missing
    const missingPermissions = requiredHRPermissions.filter(perm => !userPermissions.includes(perm));
    const hasAllHRPermissions = missingPermissions.length === 0;

    // Attach permission info to request for downstream handlers
    req.user.role_id = user.role_id;
    req.user.role_name = user.role_name;
    req.user.bar_id = user.bar_id;
    req.user.hrPermissions = {
      hasAll: hasAllHRPermissions,
      missing: missingPermissions,
      present: requiredHRPermissions.filter(perm => userPermissions.includes(perm))
    };

    if (!hasAllHRPermissions) {
      return res.status(403).json({ 
        success: false, 
        message: "Insufficient HR permissions. Missing: " + missingPermissions.join(", "),
        missing: missingPermissions,
        present: req.user.hrPermissions.present
      });
    }

    return next();
  } catch (err) {
    console.error("requireHRPermissions error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Partial HR Permissions Check
 * 
 * Checks if user has ANY of the specified HR permissions.
 * Useful for features that need some HR capabilities but not all.
 * 
 * Usage: router.get('/hr/reports', requireAuth, requireAnyHR(['attendance_view_all', 'payroll_view_all']), async (req, res) => {...})
 */
const requireAnyHR = (permissions = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      if (permissions.length === 0) {
        return res.status(500).json({ success: false, message: "Server RBAC misconfiguration" });
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

      // Everyone else must be scoped to a bar
      if (!user.bar_id) {
        return res.status(403).json({ success: false, message: "Forbidden (no bar scope)" });
      }

      // Check if user has ANY per-user overrides
      const [overrideCheck] = await pool.query(
        "SELECT 1 FROM user_permissions WHERE user_id = ? LIMIT 1",
        [userId]
      );
      const hasOverrides = overrideCheck.length > 0;

      let hasAnyPermission = false;
      
      if (hasOverrides) {
        // User has custom permissions → check user_permissions
        const [userPermRows] = await pool.query(
          `SELECT 1
           FROM user_permissions up
           JOIN permissions p ON p.id = up.permission_id
           WHERE up.user_id = ? AND up.granted = 1 AND p.name IN (?)
           LIMIT 1`,
          [userId, permissions]
        );
        hasAnyPermission = userPermRows.length > 0;
      } else {
        // No overrides → fall back to role defaults
        const [rolePermRows] = await pool.query(
          `SELECT 1
           FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
           WHERE rp.role_id = ? AND p.name IN (?)
           LIMIT 1`,
          [user.role_id, permissions]
        );
        hasAnyPermission = rolePermRows.length > 0;
      }

      // Attach for downstream handlers
      req.user.role_id = user.role_id;
      req.user.role_name = user.role_name;
      req.user.bar_id = user.bar_id;

      if (!hasAnyPermission) {
        return res.status(403).json({ 
          success: false, 
          message: "Forbidden. Requires any of: " + permissions.join(", ")
        });
      }

      return next();
    } catch (err) {
      console.error("requireAnyHR error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };
};

module.exports = requireHRPermissions;
module.exports.requireAnyHR = requireAnyHR;
