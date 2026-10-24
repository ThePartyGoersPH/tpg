const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const requireAuth = require('../middlewares/requireAuth');
const { logAudit, auditContext } = require('../utils/audit');

/**
 * Get HR Permissions Checklist
 * 
 * Returns a checklist of all HR-related permissions and indicates which ones
 * the current user has. This helps HR users understand their capabilities.
 */
router.get('/hr/permissions-checklist', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Load user info with role
    const [uRows] = await pool.query(
      `SELECT u.id, u.bar_id, u.role_id, u.role, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    let user = uRows[0];
    if (!user) {
      return res.status(403).json({ success: false, message: "User not found" });
    }

    // Resolve role if needed
    if (!user.role_id || !user.role_name) {
      const roleStr = user.role || "";
      const [resolvedRole] = await pool.query(
        "SELECT id, name FROM roles WHERE UPPER(name) = UPPER(?) LIMIT 1",
        [roleStr]
      );
      if (!resolvedRole.length) {
        return res.status(403).json({ success: false, message: "Role not mapped" });
      }
      user = { ...user, role_id: resolvedRole[0].id, role_name: resolvedRole[0].name };
    }

    // Define HR permission categories with descriptions
    const hrPermissionCategories = {
      staff_management: {
        label: "Staff Management",
        description: "Create, view, and manage staff accounts",
        permissions: [
          { code: 'staff_view', label: 'View Staff List', description: 'View list of all staff accounts' },
          { code: 'staff_create', label: 'Create Staff', description: 'Create new staff accounts' },
          { code: 'staff_update', label: 'Update Staff', description: 'Edit staff profiles and details' },
          { code: 'staff_reset_password', label: 'Reset Password', description: 'Reset any employee password' },
          { code: 'staff_edit_permissions', label: 'Edit Permissions', description: 'Edit staff member permissions' },
          { code: 'staff_deactivate', label: 'Deactivate Staff', description: 'Deactivate staff accounts' },
          { code: 'staff_delete', label: 'Delete Staff', description: 'Permanently delete staff accounts' }
        ]
      },
      attendance_management: {
        label: "Attendance Management",
        description: "View and manage attendance records",
        permissions: [
          { code: 'attendance_view_own', label: 'View Own Attendance', description: 'View own attendance records' },
          { code: 'attendance_view_all', label: 'View All Attendance', description: 'View attendance of all staff' },
          { code: 'attendance_create', label: 'Create Attendance', description: 'Create attendance entries for staff' }
        ]
      },
      leave_management: {
        label: "Leave Management",
        description: "Manage leave requests and approvals",
        permissions: [
          { code: 'leave_view_own', label: 'View Own Leave', description: 'View own leave applications' },
          { code: 'leave_apply', label: 'Apply Leave', description: 'Submit leave requests' },
          { code: 'leave_view_all', label: 'View All Leave', description: 'See all leave applications' },
          { code: 'leave_approve', label: 'Approve Leave', description: 'Approve or decline leave requests' }
        ]
      },
      payroll_management: {
        label: "Payroll Management",
        description: "Process and manage payroll",
        permissions: [
          { code: 'payroll_view_own', label: 'View Own Payroll', description: 'View own payroll records' },
          { code: 'payroll_view_all', label: 'View All Payroll', description: 'View all payroll records' },
          { code: 'payroll_create', label: 'Process Payroll', description: 'Run payroll processing' }
        ]
      },
      document_management: {
        label: "Document Management",
        description: "Manage employee documents",
        permissions: [
          { code: 'documents_view_own', label: 'View Own Documents', description: 'View own documents' },
          { code: 'documents_view_all', label: 'View All Documents', description: 'View all documents' },
          { code: 'documents_send', label: 'Send Documents', description: 'Upload and send documents' },
          { code: 'documents_manage', label: 'Manage Documents', description: 'Approve and manage documents' }
        ]
      }
    };

    // Get user's permissions
    let userPermissions = [];
    
    // Check for per-user overrides
    const [overrideCheck] = await pool.query(
      "SELECT 1 FROM user_permissions WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const hasOverrides = overrideCheck.length > 0;

    if (hasOverrides) {
      // User has custom permissions
      const [userPermRows] = await pool.query(
        `SELECT p.name, p.description
         FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id
         WHERE up.user_id = ? AND up.granted = 1`,
        [userId]
      );
      userPermissions = userPermRows.map(row => row.name);
    } else {
      // Use role permissions
      const [rolePermRows] = await pool.query(
        `SELECT p.name, p.description
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [user.role_id]
      );
      userPermissions = rolePermRows.map(row => row.name);
    }

    // Build checklist with permission status
    const checklist = {};
    let totalPermissions = 0;
    let grantedPermissions = 0;

    Object.keys(hrPermissionCategories).forEach(category => {
      checklist[category] = {
        ...hrPermissionCategories[category],
        permissions: hrPermissionCategories[category].permissions.map(perm => {
          totalPermissions++;
          const hasPermission = userPermissions.includes(perm.code);
          if (hasPermission) grantedPermissions++;
          
          return {
            ...perm,
            granted: hasPermission
          };
        }),
        granted_count: hrPermissionCategories[category].permissions.filter(perm => 
          userPermissions.includes(perm.code)
        ).length,
        total_count: hrPermissionCategories[category].permissions.length
      };
    });

    // Calculate overall HR readiness score
    const hrReadinessScore = Math.round((grantedPermissions / totalPermissions) * 100);

    // Determine if user can operate as HR (has all essential permissions)
    const essentialPermissions = [
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
    
    const canOperateAsHR = essentialPermissions.every(perm => userPermissions.includes(perm));
    const missingEssential = essentialPermissions.filter(perm => !userPermissions.includes(perm));

    // Log the checklist access
    logAudit(null, {
      bar_id: user.bar_id,
      user_id: userId,
      action: "HR_PERMISSIONS_CHECKLIST_VIEWED",
      entity: "user",
      entity_id: userId,
      details: {
        role: user.role_name,
        hr_readiness_score: hrReadinessScore,
        can_operate_as_hr: canOperateAsHR,
        granted_permissions: grantedPermissions,
        total_permissions: totalPermissions
      },
      ...auditContext(req)
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          role: user.role_name,
          bar_id: user.bar_id
        },
        hr_readiness_score: hrReadinessScore,
        can_operate_as_hr: canOperateAsHR,
        missing_essential_permissions: missingEssential,
        summary: {
          granted_permissions: grantedPermissions,
          total_permissions: totalPermissions,
          missing_permissions: totalPermissions - grantedPermissions
        },
        checklist: checklist
      }
    });

  } catch (err) {
    console.error("HR Permissions Checklist Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * Get HR Operations Summary
 * 
 * Returns a summary of what HR operations the user can perform
 * based on their current permissions.
 */
router.get('/hr/operations-summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get user permissions (reuse logic from checklist)
    const [uRows] = await pool.query(
      `SELECT u.id, u.bar_id, u.role_id, u.role, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    let user = uRows[0];
    if (!user) {
      return res.status(403).json({ success: false, message: "User not found" });
    }

    // Resolve role if needed
    if (!user.role_id || !user.role_name) {
      const roleStr = user.role || "";
      const [resolvedRole] = await pool.query(
        "SELECT id, name FROM roles WHERE UPPER(name) = UPPER(?) LIMIT 1",
        [roleStr]
      );
      if (!resolvedRole.length) {
        return res.status(403).json({ success: false, message: "Role not mapped" });
      }
      user = { ...user, role_id: resolvedRole[0].id, role_name: resolvedRole[0].name };
    }

    // Get user permissions
    let userPermissions = [];
    const [overrideCheck] = await pool.query(
      "SELECT 1 FROM user_permissions WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const hasOverrides = overrideCheck.length > 0;

    if (hasOverrides) {
      const [userPermRows] = await pool.query(
        `SELECT p.name
         FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id
         WHERE up.user_id = ? AND up.granted = 1`,
        [userId]
      );
      userPermissions = userPermRows.map(row => row.name);
    } else {
      const [rolePermRows] = await pool.query(
        `SELECT p.name
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [user.role_id]
      );
      userPermissions = rolePermRows.map(row => row.name);
    }

    // Define operations and their required permissions
    const operations = [
      {
        name: "View Staff Directory",
        permissions: ["staff_view"],
        category: "staff",
        can_perform: userPermissions.includes("staff_view")
      },
      {
        name: "Hire New Employee",
        permissions: ["staff_create"],
        category: "staff",
        can_perform: userPermissions.includes("staff_create")
      },
      {
        name: "Update Employee Details",
        permissions: ["staff_update"],
        category: "staff",
        can_perform: userPermissions.includes("staff_update")
      },
      {
        name: "View All Attendance",
        permissions: ["attendance_view_all"],
        category: "attendance",
        can_perform: userPermissions.includes("attendance_view_all")
      },
      {
        name: "Approve Leave Requests",
        permissions: ["leave_approve"],
        category: "leave",
        can_perform: userPermissions.includes("leave_approve")
      },
      {
        name: "Process Payroll",
        permissions: ["payroll_create"],
        category: "payroll",
        can_perform: userPermissions.includes("payroll_create")
      },
      {
        name: "Send Documents",
        permissions: ["documents_send"],
        category: "documents",
        can_perform: userPermissions.includes("documents_send")
      }
    ];

    // Group by category
    const operationsByCategory = {};
    operations.forEach(op => {
      if (!operationsByCategory[op.category]) {
        operationsByCategory[op.category] = [];
      }
      operationsByCategory[op.category].push(op);
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          role: user.role_name,
          bar_id: user.bar_id
        },
        operations: operations,
        operations_by_category: operationsByCategory,
        summary: {
          total_operations: operations.length,
          can_perform: operations.filter(op => op.can_perform).length,
          cannot_perform: operations.filter(op => !op.can_perform).length
        }
      }
    });

  } catch (err) {
    console.error("HR Operations Summary Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
