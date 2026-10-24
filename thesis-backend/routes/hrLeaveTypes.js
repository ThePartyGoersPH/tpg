// routes/hrLeaveTypes.js
const express = require("express");
const router = express.Router();
const pool = require("../db"); // adjust path
const { requireAuth, requireRole, requirePermission } = require("../middleware/auth");

router.get("/hr/leave-types", requireAuth, requireRole("hr"), async (req, res) => {
  const barId = req.user.bar_id;

  const [rows] = await pool.query(
    `SELECT id, code, name, default_annual_days, is_paid, is_active
     FROM leave_types
     WHERE bar_id = ?
     ORDER BY code ASC`,
    [barId]
  );

  res.json(rows);
});

module.exports = router;

router.post("/hr/leave-types", requireAuth, requireRole("hr"), async (req, res) => {
  const barId = req.user.bar_id;
  const { code, name, default_annual_days, is_paid } = req.body;

  if (!code || !name) {
    return res.status(400).json({ message: "code and name are required" });
  }

  const cleanCode = String(code).trim().toUpperCase();
  const days = default_annual_days == null ? 0 : Number(default_annual_days);
  const paid = is_paid == null ? 1 : (Number(is_paid) ? 1 : 0);

  if (!Number.isFinite(days) || days < 0) {
    return res.status(400).json({ message: "default_annual_days must be >= 0" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO leave_types (bar_id, code, name, default_annual_days, is_paid)
       VALUES (?, ?, ?, ?, ?)`,
      [barId, cleanCode, name, days, paid]
    );

    const [created] = await pool.query(
      `SELECT id, code, name, default_annual_days, is_paid, is_active
       FROM leave_types WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json(created[0]);
  } catch (err) {
    // duplicate code per bar
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Leave type code already exists" });
    }
    throw err;
  }
});
