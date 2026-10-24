// Example: Updating HR routes to use the new HR permission middleware
// This shows how to replace existing permission checks with the HR shortcut

const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const requireHRPermissions = require("../middlewares/requireHRPermissions");
const { requireAnyHR } = require("../middlewares/requireHRPermissions");

// ===== BEFORE: Individual permission checks =====
/*
router.get('/hr/dashboard', requireAuth, 
  requirePermission('staff_view'),
  requirePermission('attendance_view_all'),
  requirePermission('leave_view_all'),
  requirePermission('payroll_view_all'),
  async (req, res) => {
    // Dashboard logic
  }
);
*/

// ===== AFTER: Using HR permission shortcut =====
router.get('/hr/dashboard', requireAuth, requireHRPermissions, async (req, res) => {
  // User has all HR permissions
  const { hasAll, missing, present } = req.user.hrPermissions;
  
  try {
    const barId = req.user.bar_id;
    
    // Get dashboard stats
    const [staffCount] = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE bar_id = ? AND is_active = 1",
      [barId]
    );
    
    const [attendanceToday] = await pool.query(
      "SELECT COUNT(*) as count FROM attendance_logs WHERE bar_id = ? AND work_date = CURDATE()",
      [barId]
    );
    
    const [pendingLeaves] = await pool.query(
      "SELECT COUNT(*) as count FROM leave_requests WHERE bar_id = ? AND status = 'pending'",
      [barId]
    );
    
    res.json({
      success: true,
      data: {
        permissions: {
          hasAll,
          missing,
          present
        },
        stats: {
          staff_count: staffCount[0].count,
          attendance_today: attendanceToday[0].count,
          pending_leaves: pendingLeaves[0].count
        }
      }
    });
  } catch (err) {
    console.error("HR Dashboard Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== Example: Using requireAnyHR for partial HR access =====
router.get('/hr/reports', requireAuth, requireAnyHR([
  'attendance_view_all', 
  'payroll_view_all',
  'leave_view_all'
]), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    
    // Check which specific permissions the user has
    const hasAttendance = req.user.permissions?.includes('attendance_view_all');
    const hasPayroll = req.user.permissions?.includes('payroll_view_all');
    const hasLeave = req.user.permissions?.includes('leave_view_all');
    
    const reports = {};
    
    if (hasAttendance) {
      const [attendanceReport] = await pool.query(
        "SELECT DATE(work_date) as date, COUNT(*) as present FROM attendance_logs WHERE bar_id = ? AND work_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(work_date)",
        [barId]
      );
      reports.attendance = attendanceReport;
    }
    
    if (hasPayroll) {
      const [payrollReport] = await pool.query(
        "SELECT MONTH(pay_date) as month, SUM(net_salary) as total FROM payroll_items WHERE bar_id = ? AND pay_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY MONTH(pay_date)",
        [barId]
      );
      reports.payroll = payrollReport;
    }
    
    if (hasLeave) {
      const [leaveReport] = await pool.query(
        "SELECT status, COUNT(*) as count FROM leave_requests WHERE bar_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY status",
        [barId]
      );
      reports.leave = leaveReport;
    }
    
    res.json({
      success: true,
      data: {
        available_reports: Object.keys(reports),
        reports
      }
    });
  } catch (err) {
    console.error("HR Reports Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== Example: Granular permission checking with feedback =====
router.post('/hr/employees', requireAuth, requirePermission('staff_create'), async (req, res) => {
  try {
    // Check if user has additional HR permissions for better UX
    const canUpdatePermissions = req.user.permissions?.includes('staff_edit_permissions');
    const canSetRole = req.user.permissions?.includes('staff_update');
    
    const {
      first_name, last_name, email, password, phone_number,
      position, department, employment_status, hired_date,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
      address, role_id
    } = req.body;
    
    // Create employee logic here...
    
    res.json({
      success: true,
      message: "Employee created successfully",
      data: {
        employee_id: newEmployeeId,
        additional_capabilities: {
          can_edit_permissions: canUpdatePermissions,
          can_change_role: canSetRole
        }
      }
    });
  } catch (err) {
    console.error("Create Employee Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
