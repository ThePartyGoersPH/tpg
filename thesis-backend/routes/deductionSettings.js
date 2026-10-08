const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { logAudit, auditContext } = require("../utils/audit");

/**
 * GET EMPLOYEE DEDUCTION SETTINGS
 * GET /hr/payroll/deduction-settings/:userId
 */
router.get(
  "/deduction-settings/:userId",
  requireAuth,
  requirePermission(["deduction_settings_view", "payroll_view_all"]),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) {
        return res.status(400).json({ success: false, message: "No bar_id on account" });
      }

      const userId = Number(req.params.userId);
      if (!userId) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
      }

      // Get or create deduction settings
      let [settings] = await pool.query(
        `SELECT * FROM employee_deduction_settings 
         WHERE bar_id = ? AND user_id = ? 
         LIMIT 1`,
        [barId, userId]
      );

      if (!settings.length) {
        // Create default settings
        await pool.query(
          `INSERT INTO employee_deduction_settings 
            (bar_id, user_id, bir_enabled, sss_enabled, philhealth_enabled, late_deduction_enabled)
           VALUES (?, ?, 0, 0, 0, 0)`,
          [barId, userId]
        );

        [settings] = await pool.query(
          `SELECT * FROM employee_deduction_settings 
           WHERE bar_id = ? AND user_id = ? 
           LIMIT 1`,
          [barId, userId]
        );
      }

      return res.json({ success: true, data: settings[0] });
    } catch (err) {
      console.error("GET DEDUCTION SETTINGS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * UPDATE EMPLOYEE DEDUCTION SETTINGS
 * PUT /hr/payroll/deduction-settings/:userId
 */
router.put(
  "/deduction-settings/:userId",
  requireAuth,
  requirePermission(["deduction_settings_manage", "payroll_create"]),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) {
        return res.status(400).json({ success: false, message: "No bar_id on account" });
      }

      const userId = Number(req.params.userId);
      if (!userId) {
        return res.status(400).json({ success: false, message: "Invalid user ID" });
      }

      const {
        bir_enabled,
        bir_exemption_status,
        sss_enabled,
        sss_number,
        philhealth_enabled,
        philhealth_number,
        late_deduction_enabled
      } = req.body;

      // Get current settings for audit
      const [currentSettings] = await pool.query(
        `SELECT * FROM employee_deduction_settings 
         WHERE bar_id = ? AND user_id = ? 
         LIMIT 1`,
        [barId, userId]
      );

      // Upsert deduction settings
      await pool.query(
        `INSERT INTO employee_deduction_settings 
          (bar_id, user_id, bir_enabled, bir_exemption_status, 
           sss_enabled, sss_number, philhealth_enabled, philhealth_number, 
           late_deduction_enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           bir_enabled = VALUES(bir_enabled),
           bir_exemption_status = VALUES(bir_exemption_status),
           sss_enabled = VALUES(sss_enabled),
           sss_number = VALUES(sss_number),
           philhealth_enabled = VALUES(philhealth_enabled),
           philhealth_number = VALUES(philhealth_number),
           late_deduction_enabled = VALUES(late_deduction_enabled)`,
        [
          barId, userId,
          bir_enabled ? 1 : 0,
          bir_exemption_status || 'S',
          sss_enabled ? 1 : 0,
          sss_number || null,
          philhealth_enabled ? 1 : 0,
          philhealth_number || null,
          late_deduction_enabled ? 1 : 0
        ]
      );

      // Audit log
      logAudit(null, {
        bar_id: barId,
        user_id: userId,
        action: "DEDUCTION_SETTINGS_UPDATED",
        entity: "employee_deduction_settings",
        entity_id: userId,
        details: {
          changed_by: req.user.id,
          old_settings: currentSettings[0] || null,
          new_settings: {
            bir_enabled, bir_exemption_status,
            sss_enabled, sss_number,
            philhealth_enabled, philhealth_number,
            late_deduction_enabled
          }
        },
        ...auditContext(req)
      });

      // Get updated settings
      const [updatedSettings] = await pool.query(
        `SELECT * FROM employee_deduction_settings 
         WHERE bar_id = ? AND user_id = ? 
         LIMIT 1`,
        [barId, userId]
      );

      return res.json({
        success: true,
        message: "Deduction settings updated",
        data: updatedSettings[0]
      });
    } catch (err) {
      console.error("UPDATE DEDUCTION SETTINGS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * GET ALL EMPLOYEES WITH DEDUCTION SETTINGS
 * GET /hr/payroll/deduction-settings
 */
router.get(
  "/deduction-settings",
  requireAuth,
  requirePermission(["deduction_settings_view", "payroll_view_all"]),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) {
        return res.status(400).json({ success: false, message: "No bar_id on account" });
      }

      const [employees] = await pool.query(
        `SELECT 
           u.id, u.first_name, u.last_name, u.email,
           COALESCE(ep.daily_rate, 0) AS daily_rate,
           eds.bir_enabled, eds.bir_exemption_status,
           eds.sss_enabled, eds.sss_number,
           eds.philhealth_enabled, eds.philhealth_number,
           eds.late_deduction_enabled
         FROM users u
         LEFT JOIN employee_profiles ep ON ep.user_id = u.id AND ep.bar_id = u.bar_id
         LEFT JOIN employee_deduction_settings eds ON eds.user_id = u.id AND eds.bar_id = u.bar_id
         WHERE u.bar_id = ?
           AND u.is_active = 1
           AND LOWER(COALESCE(u.role, '')) NOT IN ('customer', 'bar_owner')
         ORDER BY u.last_name ASC, u.first_name ASC`,
        [barId]
      );

      return res.json({ success: true, data: employees });
    } catch (err) {
      console.error("GET ALL DEDUCTION SETTINGS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * TOGGLE SPECIFIC DEDUCTION FOR EMPLOYEE
 * PATCH /hr/payroll/deduction-settings/:userId/toggle
 */
router.patch(
  "/deduction-settings/:userId/toggle",
  requireAuth,
  requirePermission(["deduction_settings_manage", "payroll_create"]),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) {
        return res.status(400).json({ success: false, message: "No bar_id on account" });
      }

      const userId = Number(req.params.userId);
      const { deduction_type, enabled } = req.body;

      if (!['bir', 'sss', 'philhealth', 'late'].includes(deduction_type)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid deduction type. Must be: bir, sss, philhealth, or late" 
        });
      }

      const deductionColumnMap = {
        bir: "bir_enabled",
        sss: "sss_enabled",
        philhealth: "philhealth_enabled",
        late: "late_deduction_enabled",
      };

      const columnName = deductionColumnMap[deduction_type];
      if (!columnName) {
        return res.status(400).json({
          success: false,
          message: "Invalid deduction type. Must be: bir, sss, philhealth, or late"
        });
      }

      const enabledValue = enabled ? 1 : 0;

      // Ensure settings exist
      await pool.query(
        `INSERT IGNORE INTO employee_deduction_settings 
          (bar_id, user_id, bir_enabled, sss_enabled, philhealth_enabled, late_deduction_enabled)
         VALUES (?, ?, 0, 0, 0, 0)`,
        [barId, userId]
      );

      // Update specific deduction
      await pool.query(
        `UPDATE employee_deduction_settings 
         SET ${columnName} = ?
         WHERE bar_id = ? AND user_id = ?`,
        [enabledValue, barId, userId]
      );

      // Audit log
      await pool.query(
        `INSERT INTO payroll_deduction_audit 
          (bar_id, user_id, changed_by, action, deduction_type, new_value)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [barId, userId, req.user.id, enabled ? 'enable' : 'disable', deduction_type, enabled ? 'true' : 'false']
      );

      return res.json({
        success: true,
        message: `${deduction_type.toUpperCase()} deduction ${enabled ? 'enabled' : 'disabled'}`
      });
    } catch (err) {
      console.error("TOGGLE DEDUCTION ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

/**
 * GET DEDUCTION AUDIT LOG
 * GET /hr/payroll/deduction-audit/:userId
 */
router.get(
  "/deduction-audit/:userId",
  requireAuth,
  requirePermission(["deduction_settings_view", "payroll_view_all"]),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) {
        return res.status(400).json({ success: false, message: "No bar_id on account" });
      }

      const userId = Number(req.params.userId);

      const [auditLogs] = await pool.query(
        `SELECT 
           pda.*,
           u.first_name AS changed_by_first_name,
           u.last_name AS changed_by_last_name
         FROM payroll_deduction_audit pda
         LEFT JOIN users u ON u.id = pda.changed_by
         WHERE pda.bar_id = ? AND pda.user_id = ?
         ORDER BY pda.created_at DESC
         LIMIT 100`,
        [barId, userId]
      );

      return res.json({ success: true, data: auditLogs });
    } catch (err) {
      console.error("GET DEDUCTION AUDIT ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
