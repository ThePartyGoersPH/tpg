// Portal gate: hard role separation between admin / manager-bar-side /
// customer surfaces. Unlike requireRole (which deliberately lets BAR_OWNER
// and SUPER_ADMIN through everywhere), this middleware has NO bypasses —
// only the roles listed for the portal in config/portalAccess.js pass.
//
//   requirePortalAccess("admin")               -> super_admin, admin only
//   requirePortalAccess("manager")            -> bar-side roles only
//   requirePortalAccess("manager", { requireBar: true })
//     -> plus the account must carry a valid bar_id (a bar_owner/manager
//        without a linked bar gets a clear 403, never a vague error)
//   requirePortalAccess("customer")           -> customer role only
//
// Wrong role  -> 403 { code: "FORBIDDEN_PORTAL", ... }
// Missing bar -> 403 { code: "NO_BAR_LINKED", ... }
// No/invalid token is handled upstream by requireAuth (401).

const { norm, rolesForPortal } = require("../config/portalAccess");

function requirePortalAccess(portal, options = {}) {
  const allowed = rolesForPortal(portal);
  const requireBar = options.requireBar === true;

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const role = norm(req.user.role || req.user.role_name);
    if (!allowed.includes(role)) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN_PORTAL",
        message: "Your account cannot access this portal.",
      });
    }
    if (requireBar && (req.user.bar_id === null || req.user.bar_id === undefined)) {
      return res.status(403).json({
        success: false,
        code: "NO_BAR_LINKED",
        message: "This account is not linked to a bar.",
      });
    }
    return next();
  };
}

module.exports = { requirePortalAccess };
