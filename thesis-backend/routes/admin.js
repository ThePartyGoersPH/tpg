const express = require("express");
const router = express.Router();
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
const { requirePortalAccess } = require("../middlewares/requirePortal");
const requirePermission = require("../middlewares/requirePermission");
const { USER_ROLES } = require("../config/constants");
const adminController = require("../controllers/adminController");
const { logPlatformAudit, auditContext } = require("../utils/audit");

// Create new bar owner with business and bar
router.post(
  "/bars",
  requireAuth,
  requirePortalAccess("admin"),
  requireRole([USER_ROLES.ADMIN]),
  adminController.createBarWithOwner
);

// Reset admin password
router.post(
  "/reset-admin",
  requireAuth,
  requirePortalAccess("admin"),
  requireRole([USER_ROLES.SUPER_ADMIN]),
  async (req, res) => {
    try {
      const bcrypt = require("bcrypt");
      const pool = require("../config/database");

      const { email, newPassword } = req.body;

      // Validate required fields
      if (!email || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      const [result] = await pool.query(
        "UPDATE users SET password=? WHERE email=?",
        [hashedPassword, email]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      await logPlatformAudit({
        actor_user_id: req.user.id,
        action: "RESET_USER_PASSWORD",
        entity: "user",
        details: {
          reset_email: email,
        },
        ...auditContext(req),
      });

      res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (err) {
      console.error("RESET ADMIN ERROR:", err.message);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
});
module.exports = router;
