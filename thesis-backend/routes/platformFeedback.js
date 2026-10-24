const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");

// ═══════════════════════════════════════════
// CUSTOMER: Submit platform feedback
// ═══════════════════════════════════════════
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rating, comment, category } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }

    const [result] = await pool.query(
      `INSERT INTO platform_feedback (user_id, rating, comment, category)
       VALUES (?, ?, ?, ?)`,
      [userId, rating, comment || null, category || 'general']
    );

    return res.status(201).json({
      success: true,
      message: "Thank you for your feedback!",
      data: { id: result.insertId }
    });
  } catch (err) {
    console.error("SUBMIT PLATFORM FEEDBACK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// CUSTOMER: Get my feedback history
// ═══════════════════════════════════════════
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT pf.id, pf.rating, pf.comment, pf.category, pf.status,
              pf.admin_reply, pf.replied_at,
              pf.created_at,
              CONCAT(u.first_name, ' ', u.last_name) AS replied_by_name,
              u.email AS replied_by_email
       FROM platform_feedback pf
       LEFT JOIN users u ON u.id = pf.replied_by
       WHERE pf.user_id = ?
       ORDER BY pf.created_at DESC`,
      [userId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET MY FEEDBACK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// ADMIN: Get all platform feedback
// ═══════════════════════════════════════════
router.get("/admin/all", requireAuth, async (req, res) => {
  try {
    if (String(req.user.role || '').trim().toLowerCase() !== 'super_admin') {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const status = req.query.status || null;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    let sql = `SELECT pf.*, u.first_name, u.last_name, u.email
               FROM platform_feedback pf
               JOIN users u ON pf.user_id = u.id`;
    const params = [];

    if (status) {
      sql += " WHERE pf.status = ?";
      params.push(status);
    }

    sql += " ORDER BY pf.created_at DESC LIMIT ?";
    params.push(limit);

    const [rows] = await pool.query(sql, params);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET ALL FEEDBACK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// ADMIN: Update feedback status
// ═══════════════════════════════════════════
router.patch("/admin/:id/status", requireAuth, async (req, res) => {
  try {
    if (String(req.user.role || '').trim().toLowerCase() !== 'super_admin') {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const feedbackId = Number(req.params.id);
    const { status } = req.body;

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    await pool.query(
      "UPDATE platform_feedback SET status = ? WHERE id = ?",
      [status, feedbackId]
    );

    return res.json({ success: true, message: "Feedback status updated" });
  } catch (err) {
    console.error("UPDATE FEEDBACK STATUS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// ADMIN: Reply to a platform feedback item
// ═══════════════════════════════════════════
router.patch("/admin/:id/reply", requireAuth, async (req, res) => {
  try {
    if (String(req.user.role || '').trim().toLowerCase() !== 'super_admin') {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const feedbackId = Number(req.params.id);
    const { reply } = req.body || {};

    if (!feedbackId) return res.status(400).json({ success: false, message: "Invalid feedback id" });
    if (!reply || !String(reply).trim()) {
      return res.status(400).json({ success: false, message: "Reply text is required" });
    }

    const [[feedback]] = await pool.query(
      "SELECT id FROM platform_feedback WHERE id = ? LIMIT 1",
      [feedbackId]
    );
    if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

    await pool.query(
      `UPDATE platform_feedback
       SET admin_reply = ?, replied_at = NOW(), replied_by = ?, status = 'reviewed'
       WHERE id = ?`,
      [String(reply).trim(), req.user.id, feedbackId]
    );

    return res.json({ success: true, message: "Reply posted successfully" });
  } catch (err) {
    console.error("ADMIN REPLY FEEDBACK ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// PUBLIC: Get platform statistics
// ═══════════════════════════════════════════
router.get("/stats", async (req, res) => {
  try {
    const [[avgRating]] = await pool.query(
      "SELECT AVG(rating) AS average_rating, COUNT(*) AS total_feedback FROM platform_feedback"
    );

    const [ratingDistribution] = await pool.query(
      `SELECT rating, COUNT(*) AS count
       FROM platform_feedback
       GROUP BY rating
       ORDER BY rating DESC`
    );

    return res.json({
      success: true,
      data: {
        average_rating: Number(avgRating.average_rating || 0).toFixed(2),
        total_feedback: avgRating.total_feedback || 0,
        rating_distribution: ratingDistribution
      }
    });
  } catch (err) {
    console.error("GET FEEDBACK STATS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
