function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // BAR_OWNER and SUPER_ADMIN always have full, unrestricted access and
    // must never be blocked by a role check.
    const rawRole = String(req.user.role || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
    if (rawRole === "BAR_OWNER" || rawRole === "SUPER_ADMIN") {
      return next();
    }

    const userRole = String(req.user.role || "").toLowerCase();
    const allowedRoles = roles.map((r) => String(r).toLowerCase());

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }
    
    next();
  };
}

module.exports = requireRole;
