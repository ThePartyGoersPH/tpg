/**
 * Middleware to allow both super admins and bar owners to access permit monitoring.
 * - Super admins see all bars
 * - Bar owners see only their own bars (via req.user.bar_id)
 */
async function requirePermitAccess(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const roleName = String(req.user.role_name || req.user.role || '').toUpperCase();

    if (roleName === 'SUPER_ADMIN') {
      req.isSuperAdmin = true;
      return next();
    }

    if (roleName === 'BAR_OWNER') {
      req.isSuperAdmin = false;
      if (!req.user.bar_id) {
        return res.status(400).json({ success: false, message: 'No bar associated with this account' });
      }
      return next();
    }

    return res.status(403).json({ success: false, message: 'Access denied' });
  } catch (err) {
    console.error('REQUIRE_PERMIT_ACCESS_ERROR:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = requirePermitAccess;
