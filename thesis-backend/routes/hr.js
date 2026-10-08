const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const bcrypt = require("bcrypt");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
const requirePermission = require("../middlewares/requirePermission");
const { USER_ROLES, HR_ALLOWED_CREATE, EMPLOYMENT_STATUSES } = require("../config/constants");
const { createNotification } = require("../utils/notificationService");

function canManageDailyRate(user) {
  const role = String(user?.role_name || user?.role || "").toLowerCase();
  return role === USER_ROLES.HR || role === USER_ROLES.BAR_OWNER;
}

// HR creates employee with profile - REFACTORED
router.post("/hr/employees", requireAuth, requirePermission("staff_view"), async (req, res) => {
  // Use bar_id from authenticated user
  const barId = req.user.bar_id;
  if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

  const {
    first_name, last_name, email, password, phone_number,
    position, department, employment_status, hired_date,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
    address, role_id
  } = (req.body || {});

  // Validate required fields
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  // Validate employment status using constants
  if (employment_status && !EMPLOYMENT_STATUSES.includes(employment_status)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid employment status. Allowed: ${EMPLOYMENT_STATUSES.join(", ")}` 
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [exists] = await conn.query("SELECT id FROM users WHERE email=? LIMIT 1", [email]);
    if (exists.length) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Validate and resolve role_id
    let roleId = null;
    let roleName = null;
    
    if (role_id) {
      // Validate that the provided role_id exists
      const [roleRows] = await conn.query("SELECT id, name FROM roles WHERE id = ? LIMIT 1", [role_id]);
      if (!roleRows.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Invalid role_id provided" });
      }
      roleId = roleRows[0].id;
      roleName = roleRows[0].name;
    } else {
      // Default to STAFF role if no role_id provided
      const [roleRows] = await conn.query(
        "SELECT id, name FROM roles WHERE UPPER(name) = ? LIMIT 1",
        [USER_ROLES.STAFF.toUpperCase()]
      );
      roleId = roleRows.length ? roleRows[0].id : null;
      roleName = roleRows.length ? roleRows[0].name : null;
    }

    // users row: use the actual role name
    const [u] = await conn.query(
      `INSERT INTO users
       (first_name,last_name,email,password,phone_number,role,role_id,is_active,bar_id,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,1,?,NOW(),NOW())`,
      [first_name, last_name, email, hashed, phone_number || null, roleName, roleId, barId]
    );
    const employeeUserId = u.insertId;

    // Automatically assign permissions based on role
    if (roleId) {
      await conn.query(
        `INSERT INTO user_permissions (user_id, permission_id, granted_by)
         SELECT ?, rp.permission_id, ?
         FROM role_permissions rp
         WHERE rp.role_id = ?
         ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by)`,
        [employeeUserId, req.user.id, roleId]
      );
    }

    // employee_profiles row
    await conn.query(
      `INSERT INTO employee_profiles
       (user_id,bar_id,position,department,employment_status,hired_date,
        emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,address)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        employeeUserId, barId,
        position || null, 
        department || null, 
        employment_status || EMPLOYMENT_STATUSES[0], // default to first status
        hired_date || null,
        emergency_contact_name || null, 
        emergency_contact_phone || null, 
        emergency_contact_relationship || null,
        address || null
      ]
    );

    await conn.commit();

    // Notify the bar owner/team (and the new staff member) that a staff account was created
    try {
      const fullName = `${first_name} ${last_name}`.trim();
      await createNotification({
        barId,
        type: "staff_added",
        title: "New Staff Added",
        message: `${fullName} was added as ${roleName || "staff"} for your bar.`,
        referenceType: "user",
        referenceId: employeeUserId,
        category: "hr",
        action: "navigate",
        targetRoute: "/staff",
        excludeUserId: employeeUserId,
      });
      await createNotification({
        userIds: employeeUserId,
        type: "staff_added",
        title: "Welcome to the Team",
        message: `Your staff account for the bar was created. You can now clock in and view your schedule.`,
        referenceType: "user",
        referenceId: employeeUserId,
        category: "hr",
        action: "navigate",
        targetRoute: "/attendance",
      });
    } catch (e) {
      console.error("staff_added notification failed:", e.message);
    }
    
    // Get assigned permissions for response
    const [assignedPermissions] = await conn.query(
      `SELECT p.code, p.description 
       FROM user_permissions up
       JOIN permissions p ON up.permission_id = p.id
       WHERE up.user_id = ?`,
      [employeeUserId]
    );
    
    res.status(201).json({ 
      success: true, 
      message: "Employee created with automatic permissions", 
      data: { 
        user_id: employeeUserId, 
        bar_id: barId,
        role: roleName,
        role_id: roleId,
        permissions: assignedPermissions
      } 
    });
  } catch (err) {
    await conn.rollback();
    console.error("HR CREATE EMPLOYEE ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

// Fix permissions for existing users (run once after migration)
router.post("/hr/fix-permissions", requireAuth, requireRole([USER_ROLES.BAR_OWNER, USER_ROLES.ADMIN]), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Get all users without permissions but with a role
    const [usersWithoutPerms] = await conn.query(`
      SELECT u.id, u.email, u.role, u.role_id 
      FROM users u 
      LEFT JOIN user_permissions up ON u.id = up.user_id 
      WHERE up.user_id IS NULL 
      AND u.role_id IS NOT NULL 
      AND u.is_active = 1
    `);
    
    let totalFixed = 0;
    
    for (const user of usersWithoutPerms) {
      // Assign all permissions for their role
      const [result] = await conn.query(`
        INSERT INTO user_permissions (user_id, permission_id, granted_by) 
        SELECT ?, rp.permission_id, ? 
        FROM role_permissions rp 
        WHERE rp.role_id = ?
        ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by)
      `, [user.id, req.user.id, user.role_id]);
      
      totalFixed += result.affectedRows;
    }
    
    await conn.commit();
    
    res.json({ 
      success: true, 
      message: `Fixed permissions for ${usersWithoutPerms.length} users (${totalFixed} total permissions assigned)`,
      users_fixed: usersWithoutPerms.length,
      permissions_assigned: totalFixed
    });
    
  } catch (err) {
    await conn.rollback();
    console.error("FIX PERMISSIONS ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

// HR creates staff only - NEW ENDPOINT
router.post("/staff", requireAuth, requireRole([USER_ROLES.HR]), async (req, res) => {
  // Use bar_id from authenticated user
  const barId = req.user.bar_id;
  if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

  const { first_name, last_name, email, password, phone_number } = (req.body || {});

  // Validate required fields (password is now optional - auto-generated if not provided)
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ success: false, message: "Missing required fields: first_name, last_name, email" });
  }

  // Validate role using constants
  if (!HR_ALLOWED_CREATE.includes(USER_ROLES.STAFF)) {
    return res.status(400).json({ 
      success: false, 
      message: `Invalid role. Only can create: ${HR_ALLOWED_CREATE.join(", ")}` 
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch bar name for default password generation
    let barName = '';
    try {
      const [[bar]] = await conn.query("SELECT name FROM bars WHERE id = ? LIMIT 1", [barId]);
      barName = bar?.name || '';
    } catch (e) {
      console.error("FETCH BAR NAME ERROR:", e);
    }

    // Auto-generate default password if not provided: [barname]@surname (lowercase, no spaces/special chars)
    const cleanBarName = String(barName || 'bar').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLastName = String(last_name).toLowerCase().replace(/[^a-z0-9]/g, '');
    const defaultPassword = `${cleanBarName}@${cleanLastName}`;
    const finalPassword = password && String(password).trim() ? password : defaultPassword;

    const [exists] = await conn.query("SELECT id FROM users WHERE email=? LIMIT 1", [email]);
    if (exists.length) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(finalPassword, 10);

    // Auto-resolve role_id from roles table for RBAC permission system
    const [staffRoleRows] = await conn.query(
      "SELECT id FROM roles WHERE UPPER(name) = ? LIMIT 1",
      [USER_ROLES.STAFF.toUpperCase()]
    );
    const staffRoleId = staffRoleRows.length ? staffRoleRows[0].id : null;

    // users row: force role to STAFF using constants
    const [result] = await conn.query(
      `INSERT INTO users
       (first_name,last_name,email,password,phone_number,role,role_id,is_active,bar_id,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,1,?,NOW(),NOW())`,
      [first_name, last_name, email, hashed, phone_number || null, USER_ROLES.STAFF, staffRoleId, barId]
    );

    // Seed user_permissions from role defaults so staff permissions are not blank.
    if (staffRoleId) {
      await conn.query(
        `INSERT INTO user_permissions (user_id, permission_id, granted_by)
         SELECT ?, rp.permission_id, ?
         FROM role_permissions rp
         WHERE rp.role_id = ?`,
        [result.insertId, req.user.id, staffRoleId]
      );
    }

    await conn.commit();

    // Fire-and-forget onboarding email with the (unhashed) login credential.
    // Never awaited and never throws — a mail failure must not fail creation.
    try {
      const { sendStaffOnboardingEmail } = require("../utils/emailService");
      sendStaffOnboardingEmail(email, {
        firstName: first_name,
        barName: barName || 'your bar',
        role: USER_ROLES.STAFF,
        defaultPassword: finalPassword,
        isDefaultPassword: !(password && String(password).trim()),
      }).catch((e) => console.error("STAFF ONBOARDING EMAIL ERROR:", e.message));
    } catch (e) {
      console.error("STAFF ONBOARDING EMAIL ERROR:", e.message);
    }

    res.status(201).json({ 
      success: true, 
      message: `Staff account created successfully. Onboarding email sent to ${email}.`, 
      data: { user_id: result.insertId, bar_id: barId, default_password: !password ? defaultPassword : undefined }
    });
  } catch (err) {
    await conn.rollback();
    console.error("HR CREATE STAFF ERROR:", err);
    // Handle duplicate entry errors with user-friendly messages
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      const msg = String(err.message || '');
      if (msg.includes('idx_users_phone_unique') || msg.includes('phone_number')) {
        return res.status(400).json({ success: false, message: "This phone number is already registered to another staff member." });
      }
      if (msg.includes('idx_users_email_unique') || msg.includes('email')) {
        return res.status(400).json({ success: false, message: "This email address is already registered to another staff member." });
      }
      return res.status(400).json({ success: false, message: "A record with these details already exists." });
    }
    res.status(500).json({ success: false, message: "Failed to create staff account. Please double-check the entered details." });
  } finally {
    conn.release();
  }
});

// HR lists employees - NEW ENDPOINT
router.get("/employees", requireAuth, requirePermission("staff_view"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.phone_number, u.is_active, u.created_at,
              ep.position, ep.department, ep.employment_status, ep.daily_rate, ep.hired_date,
              b.name AS bar_name
       FROM users u
       LEFT JOIN employee_profiles ep ON ep.user_id = u.id
       LEFT JOIN bars b ON b.id = u.bar_id
       WHERE u.bar_id = ? AND u.role IN ('staff','hr')
       ORDER BY u.id DESC`,
      [barId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("HR LIST EMPLOYEES ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// HR updates employee profile - NEW ENDPOINT
router.put("/employees/:userId/profile", requireAuth, requirePermission("staff_view"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid userId" });

    // ensure employee belongs to same bar
    const [empRows] = await pool.query("SELECT id, bar_id, role FROM users WHERE id=? LIMIT 1", [userId]);
    if (!empRows.length) return res.status(404).json({ success: false, message: "Employee not found" });
    if (empRows[0].bar_id !== barId) return res.status(403).json({ success: false, message: "Forbidden" });

    const {
      position, department, employment_status, daily_rate, hired_date,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
      address
    } = (req.body || {});

    if (daily_rate !== undefined && !canManageDailyRate(req.user)) {
      return res.status(403).json({ success: false, message: "Only HR or Bar Owner can update daily salary." });
    }

    // Validate employment status using constants
    if (employment_status && !EMPLOYMENT_STATUSES.includes(employment_status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid employment status. Allowed: ${EMPLOYMENT_STATUSES.join(", ")}` 
      });
    }

    // upsert profile
    await pool.query(
      `INSERT INTO employee_profiles
        (user_id, bar_id, position, department, employment_status, daily_rate, hired_date,
         emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         position=VALUES(position),
         department=VALUES(department),
         employment_status=VALUES(employment_status),
         daily_rate=VALUES(daily_rate),
         hired_date=VALUES(hired_date),
         emergency_contact_name=VALUES(emergency_contact_name),
         emergency_contact_phone=VALUES(emergency_contact_phone),
         emergency_contact_relationship=VALUES(emergency_contact_relationship),
         address=VALUES(address)`,
      [
        userId, barId,
        position || null,
        department || null,
        employment_status || EMPLOYMENT_STATUSES[0], // default to first status
        daily_rate ?? 0,
        hired_date || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        emergency_contact_relationship || null,
        address || null
      ]
    );

    res.status(200).json({ success: true, message: "Employee profile saved" });
  } catch (err) {
    console.error("HR UPSERT PROFILE ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// HR deletes employee - SOFT DELETE
router.delete("/employees/:id", requireAuth, requirePermission("staff_delete"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid userId" });

    // Guardrail: nobody can delete/deactivate their own account.
    if (Number(req.user?.id) === userId) {
      return res.status(400).json({ success: false, message: "You cannot delete your own account." });
    }

    // ensure employee belongs to same bar
    const [empRows] = await pool.query("SELECT id, bar_id, role FROM users WHERE id=? LIMIT 1", [userId]);
    if (!empRows.length) return res.status(404).json({ success: false, message: "Employee not found" });
    if (empRows[0].bar_id !== barId) return res.status(403).json({ success: false, message: "Forbidden" });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Soft delete user (set is_active = 0)
      const [result] = await conn.query(
        "UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ? AND bar_id = ?",
        [userId, barId]
      );

      if (result.affectedRows === 0) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Employee not found" });
      }

      await conn.commit();
      res.status(200).json({ success: true, message: "Employee deleted successfully" });
    } catch (err) {
      await conn.rollback();
      console.error("HR DELETE EMPLOYEE ERROR:", err);
      res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("HR DELETE EMPLOYEE ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/attendance", requireAuth, requirePermission("attendance_view_all"), async (req, res) => {
  try {
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

    const { from, to, employee_user_id, start_date, end_date } = req.query;
    const fromDate = from || start_date;
    const toDate = to || end_date;
    
    if (!fromDate || !toDate) return res.status(400).json({ success:false, message:"from and to required (YYYY-MM-DD)" });

    const params = [barId, fromDate, toDate];
    let extra = "";

    if (employee_user_id) {
      extra = " AND a.employee_user_id = ? ";
      params.push(Number(employee_user_id));
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.work_date, a.time_in, a.time_out, a.minutes_late, a.minutes_undertime, a.minutes_overtime,
              u.first_name, u.last_name, u.email
       FROM attendance_logs a
       JOIN users u ON u.id = a.employee_user_id
       WHERE a.bar_id = ? AND a.work_date BETWEEN ? AND ? ${extra}
       ORDER BY a.work_date DESC, u.last_name ASC`,
      params
    );

    return res.json({ success:true, data: rows });
  } catch (err) {
    console.error("HR ATTENDANCE ERROR:", err);
    return res.status(500).json({ success:false, message:"Server error" });
  }
});

router.get(
  "/payroll/preview",
  requireAuth,
  requirePermission("payroll_view_all"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (barId === null || barId === undefined) {
        return res.status(403).json({ success: false, message: "No bar_id on account" });
      }

      const { from, to } = req.query;
      if (!from || !to) {
        return res.status(400).json({ success: false, message: "from and to required (YYYY-MM-DD)" });
      }

      const [rows] = await pool.query(
        `SELECT 
            u.id AS employee_user_id,
            CONCAT(u.first_name, ' ', u.last_name) AS name,
            COALESCE(ep.daily_rate, 0) AS daily_rate,
            SUM(CASE WHEN a.time_in IS NOT NULL THEN 1 ELSE 0 END) AS days_present,
            (COALESCE(ep.daily_rate, 0) * SUM(CASE WHEN a.time_in IS NOT NULL THEN 1 ELSE 0 END)) AS gross_pay
         FROM users u
         LEFT JOIN employee_profiles ep ON ep.user_id = u.id
         LEFT JOIN attendance_logs a 
            ON a.employee_user_id = u.id
           AND a.bar_id = u.bar_id
           AND a.work_date BETWEEN ? AND ?
         WHERE u.bar_id = ? AND LOWER(u.role) = 'staff' AND u.is_active = 1
         GROUP BY u.id, ep.daily_rate, u.first_name, u.last_name
         ORDER BY u.last_name ASC, u.first_name ASC`,
        [from, to, barId]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("HR PAYROLL PREVIEW ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Create payroll run (draft)
router.post(
  "/payroll/run",
  requireAuth,
  requirePermission("payroll_create"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const createdBy = req.user.id;

      if (barId === null || barId === undefined) {
        return res.status(403).json({ success: false, message: "No bar_id on account" });
      }

      const { period_start, period_end } = req.body || {};
      if (!period_start || !period_end) {
        return res.status(400).json({ success: false, message: "period_start and period_end required" });
      }

      const [result] = await pool.query(
        `INSERT INTO payroll_runs (bar_id, period_start, period_end, created_by, status)
         VALUES (?, ?, ?, ?, 'draft')`,
        [barId, period_start, period_end, createdBy]
      );

      return res.status(201).json({
        success: true,
        message: "Payroll run created",
        data: { id: result.insertId }
      });
    } catch (err) {
      console.error("CREATE PAYROLL RUN ERROR:", err);

      if (err?.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          success: false,
          message: "Duplicate payroll run for this period (same bar_id, period_start, period_end)."
        });
      }

      return res.status(500).json({
        success: false,
        message: err.sqlMessage || err.message || "Server error"
      });
    }
  }
);

// List payroll runs
router.get(
  "/payroll/runs",
  requireAuth,
  requirePermission("payroll_view_all"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (barId === null || barId === undefined) {
        return res.status(403).json({ success: false, message: "No bar_id on account" });
      }

      const [rows] = await pool.query(
        `SELECT id, period_start, period_end, status, created_by, created_at, finalized_at
         FROM payroll_runs
         WHERE bar_id = ?
         ORDER BY id DESC`,
        [barId]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("LIST PAYROLL RUNS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// STAFF - View own finalized payroll history
router.get(
  "/payroll/my",
  requireAuth,
  requirePermission("payroll_view_own"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const userId = req.user.id;

      if (!barId) {
        return res.status(400).json({
          success: false,
          message: "No bar_id on account"
        });
      }

      const [rows] = await pool.query(
        `SELECT 
            pr.id AS payroll_run_id,
            pr.period_start,
            pr.period_end,
            pr.status,
            pi.daily_rate,
            pi.days_present,
            pi.gross_pay,
            pi.deductions,
            pi.net_pay,
            pr.finalized_at
         FROM payroll_items pi
         JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
         WHERE pi.user_id = ?
           AND pi.bar_id = ?
           AND pr.status = 'finalized'
         ORDER BY pr.period_end DESC`,
        [userId, barId]
      );

      return res.json({
        success: true,
        data: rows
      });

    } catch (err) {
      console.error("STAFF PAYROLL ERROR:", err);
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }
);

module.exports = router;
