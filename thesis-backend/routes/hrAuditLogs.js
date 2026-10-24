const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");

// GET /hr/audit-logs?entity=payroll_run&user_id=30&from=2026-02-01&to=2026-02-28&limit=100
router.get(
  "/audit-logs",
  requireAuth,
  requirePermission("logs_view"),
  async (req, res) => {
    try {
      const barId = req.user?.bar_id;
      if (barId === null || barId === undefined) {
        return res.status(403).json({ success: false, message: "No bar_id on account" });
      }

      const { entity, entity_id, user_id, from, to, limit } = req.query;

      const where = ["a.bar_id = ?"];
      const params = [barId];

      if (entity) {
        where.push("a.entity = ?");
        params.push(entity);
      }
      if (entity_id) {
        where.push("a.entity_id = ?");
        params.push(Number(entity_id));
      }
      if (user_id) {
        where.push("a.user_id = ?");
        params.push(Number(user_id));
      }
      if (from && to) {
        where.push("DATE(a.created_at) BETWEEN ? AND ?");
        params.push(from, to);
      }

      const lim = Math.min(Number(limit || 100), 200);

      const [rows] = await pool.query(
        `SELECT a.id, a.bar_id, a.user_id, a.action, a.entity, a.entity_id,
                a.details, a.ip_address, a.user_agent, a.created_at,
                u.first_name AS actor_first_name, u.last_name AS actor_last_name,
                u.email AS actor_email, u.role AS actor_role
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE ${where.join(" AND ")}
         ORDER BY a.id DESC
         LIMIT ${lim}`,
        params
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("AUDIT LOGS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
