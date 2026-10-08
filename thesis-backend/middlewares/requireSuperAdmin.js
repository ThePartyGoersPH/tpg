/**
 * Middleware to ensure user is a super admin
 */
async function requireSuperAdmin(req, res, next) {
  try {
    // Check if user exists (should be set by requireAuth)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user is super admin
    const roleName = String(req.user.role_name || req.user.role || '').toUpperCase();
    
    if (roleName !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Super admin access required'
      });
    }

    // User is super admin, continue
    next();
  } catch (err) {
    console.error('REQUIRE_SUPER_ADMIN_ERROR:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
}

module.exports = requireSuperAdmin;
