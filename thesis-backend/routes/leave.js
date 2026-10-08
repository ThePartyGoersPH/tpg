const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
const requirePermission = require("../middlewares/requirePermission");
const { USER_ROLES } = require("../config/constants");
const { addApprovedLeaveDays, checkLeaveAccrual } = require("../services/leaveBalanceService");

const toDateString = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

const ALLOWED_LEAVE_TYPES = ["vacation", "sick", "emergency", "maternity", "paternity", "special"];

function isValidDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Apply leave (employee)
router.post(
  "/",
  requireAuth,
  requirePermission("leave_apply"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const body = req.body || {};
      const { leave_type, start_date, end_date, reason } = body;

      if (!leave_type || !start_date || !end_date) {
        return res.status(400).json({ success: false, message: "leave_type, start_date, end_date required" });
      }
      if (!ALLOWED_LEAVE_TYPES.includes(leave_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid leave_type. Allowed: ${ALLOWED_LEAVE_TYPES.join(", ")}`
        });
      }
      if (!isValidDateStr(start_date) || !isValidDateStr(end_date)) {
        return res.status(400).json({ success: false, message: "Dates must be YYYY-MM-DD" });
      }
      if (end_date < start_date) {
        return res.status(400).json({ success: false, message: "end_date must be >= start_date" });
      }

      // Ensure requester belongs to this bar in DB
      const [me] = await pool.query("SELECT id, bar_id, role FROM users WHERE id=? LIMIT 1", [req.user.id]);
      if (!me.length) return res.status(404).json({ success: false, message: "User not found" });
      if (me[0].bar_id !== barId) return res.status(403).json({ success: false, message: "Forbidden" });

      // Staff may not self-file a sick leave: HR/Manager file it on their
      // behalf. Role is read fresh from the DB (not the JWT) so the check
      // cannot be bypassed with a stale token.
      const requesterRole = String(me[0].role || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

      // The bar owner is the business owner, not an employee who takes leave
      // through this system. requirePermission() deliberately bypasses
      // BAR_OWNER, so this role check is what actually enforces the rule
      // against a direct API call — the UI only hides the +Add button.
      if (requesterRole === "bar_owner") {
        return res.status(403).json({
          success: false,
          code: "BAR_OWNER_CANNOT_FILE",
          message: "Bar owners cannot file leave requests."
        });
      }

      if (leave_type === "sick" && requesterRole === "staff") {
        return res.status(403).json({
          success: false,
          message: "Staff cannot file sick leave themselves — HR or a manager must file it on your behalf."
        });
      }

      const [ins] = await pool.query(
        `INSERT INTO leave_requests
         (bar_id, employee_user_id, leave_type, start_date, end_date, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [barId, req.user.id, leave_type, start_date, end_date, reason || null]
      );

      return res.status(201).json({
        success: true,
        message: "Leave request submitted",
        data: { leave_request_id: ins.insertId }
      });
    } catch (err) {
      console.error("LEAVE APPLY ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// View own leaves
router.get(
  "/my",
  requireAuth,
  requirePermission("leave_view_own"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [rows] = await pool.query(
        `SELECT id, leave_type, start_date, end_date, reason, status, decided_by, decided_at, created_at
         FROM leave_requests
         WHERE bar_id = ? AND employee_user_id = ?
         ORDER BY id DESC`,
        [barId, req.user.id]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("LEAVE MY LIST ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// View all leaves (HR / Owner)
router.get(
  "/",
  requireAuth,
  requirePermission("leave_view_all"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { status, from, to } = req.query;

      const where = ["lr.bar_id = ?"];
      const params = [barId];

      if (status) {
        where.push("lr.status = ?");
        params.push(status);
      }
      if (from && to) {
        where.push("lr.start_date <= ? AND lr.end_date >= ?");
        params.push(to, from); // overlap range
      }

      const [rows] = await pool.query(
        `SELECT lr.id, lr.leave_type, lr.start_date, lr.end_date, lr.reason, lr.status, lr.decided_by, lr.decided_at, lr.created_at,
                u.id AS employee_user_id, u.first_name, u.last_name, u.email
         FROM leave_requests lr
         JOIN users u ON u.id = lr.employee_user_id
         WHERE ${where.join(" AND ")}
         ORDER BY lr.id DESC`,
        params
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("HR LIST LEAVES ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Decide leave (approve/reject)
router.patch(
  "/:id/decision",
  requireAuth,
  requirePermission("leave_approve"),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Invalid id" });

      const { action } = req.body || {}; // "approve" | "reject"
      if (!action || !["approve", "reject"].includes(action)) {
        return res.status(400).json({ success: false, message: "action must be approve or reject" });
      }

      // lock & fetch
      const [checkRows] = await conn.query(
        "SELECT id, status, employee_user_id, leave_type, start_date, end_date FROM leave_requests WHERE id=? AND bar_id=? LIMIT 1 FOR UPDATE",
        [id, barId]
      );
      if (!checkRows.length) {
        await conn.rollback();
        return res.status(404).json({ success: false, message: "Leave request not found" });
      }
      if (checkRows[0].status !== "pending") {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Only pending requests can be decided" });
      }

      // Accrual cap: vacation and sick build up 1 day per month employed, so
      // approving more days than accrued would drive the balance negative.
      if (action === "approve") {
        const guard = await checkLeaveAccrual(conn, {
          barId,
          userId: checkRows[0].employee_user_id,
          requestType: checkRows[0].leave_type,
          startDate: toDateString(checkRows[0].start_date),
          endDate: toDateString(checkRows[0].end_date),
        });
        if (!guard.ok) {
          await conn.rollback();
          return res.status(409).json({
            success: false,
            code: "INSUFFICIENT_ACCRUAL",
            message: guard.message,
            data: {
              days: guard.days,
              accrued_days: guard.accrued_days,
              used_days: guard.used_days,
              remaining_days: guard.remaining_days,
              months_employed: guard.months_employed,
            },
          });
        }
      }

      const newStatus = action === "approve" ? "approved" : "rejected";
      await conn.query(
        "UPDATE leave_requests SET status=?, decided_by=?, decided_at=NOW() WHERE id=?",
        [newStatus, req.user.id, id]
      );

      if (action === "approve") {
        await addApprovedLeaveDays(conn, {
          barId,
          userId: checkRows[0].employee_user_id,
          requestType: checkRows[0].leave_type,
          startDate: toDateString(checkRows[0].start_date),
          endDate: toDateString(checkRows[0].end_date),
          requestId: id,
        });
      }

      await conn.commit();
      return res.json({ success: true, message: action === "approve" ? "Leave request approved" : "Leave request rejected" });
    } catch (err) {
      await conn.rollback();
      console.error("LEAVE DECISION ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  }
);

module.exports = router;
