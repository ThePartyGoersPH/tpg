const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");

// ═══════════════════════════════════════════
// GET /owner-reviews — list all reviews for owner's bars
// ═══════════════════════════════════════════
router.get("/", requireAuth, requirePermission("reviews_view"), async (req, res) => {
  try {
    const barId = Number(req.user.bar_id);
    if (!barId) return res.status(403).json({ success: false, message: "Forbidden (no bar scope)" });

    const [reviews] = await pool.query(
      `SELECT r.id, r.bar_id, r.customer_id,
              r.rating,
              r.comment AS review,
              r.created_at AS review_date,
              r.updated_at,
              b.name AS bar_name,
              u.first_name, u.last_name, u.profile_picture,
              rr.id AS response_id, rr.response, rr.created_at AS response_date,
              ru.role AS responder_role,
              CONCAT(ru.first_name, ' ', ru.last_name) AS responder_name
       FROM reviews r
       JOIN bars b ON r.bar_id = b.id
       LEFT JOIN users u ON r.customer_id = u.id
       LEFT JOIN review_responses rr ON rr.review_id = r.id
       LEFT JOIN users ru ON ru.id = rr.user_id
       WHERE r.bar_id = ?
       ORDER BY r.created_at DESC`,
      [barId]
    );

    return res.json({ success: true, data: reviews });
  } catch (err) {
    console.error("GET OWNER REVIEWS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /owner-reviews/:id — single review detail
// ═══════════════════════════════════════════
router.get("/:id", requireAuth, requirePermission("reviews_view"), async (req, res) => {
  try {
    const barId = Number(req.user.bar_id);
    if (!barId) return res.status(403).json({ success: false, message: "Forbidden (no bar scope)" });

    const [reviews] = await pool.query(
      `SELECT r.id, r.bar_id, r.customer_id,
              r.rating,
              r.comment AS review,
              r.created_at AS review_date,
              r.updated_at,
              b.name AS bar_name,
              u.first_name, u.last_name, u.profile_picture,
              rr.id AS response_id, rr.response, rr.created_at AS response_date,
              ru.role AS responder_role,
              CONCAT(ru.first_name, ' ', ru.last_name) AS responder_name
       FROM reviews r
       JOIN bars b ON r.bar_id = b.id
       LEFT JOIN users u ON r.customer_id = u.id
       LEFT JOIN review_responses rr ON rr.review_id = r.id
       LEFT JOIN users ru ON ru.id = rr.user_id
       WHERE r.id = ? AND r.bar_id = ?`,
      [req.params.id, barId]
    );
    if (!reviews.length) return res.status(404).json({ success: false, message: "Review not found" });
    return res.json({ success: true, data: reviews[0] });
  } catch (err) {
    console.error("GET OWNER REVIEW ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// POST /owner-reviews/:id/respond — respond to a review
// ═══════════════════════════════════════════
router.post("/:id/respond", requireAuth, requirePermission("reviews_reply"), async (req, res) => {
  try {
    const reviewId = req.params.id;
    const barId = Number(req.user.bar_id);
    const { response } = req.body;
    if (!barId) return res.status(403).json({ success: false, message: "Forbidden (no bar scope)" });
    if (!response || !response.trim()) {
      return res.status(400).json({ success: false, message: "Response text is required" });
    }

    console.log("RESPOND TO REVIEW DEBUG:", { reviewId, barId, userId: req.user.id, response: response.trim() });

    // Verify ownership
    const [reviews] = await pool.query(
      `SELECT r.id FROM reviews r
       JOIN bars b ON r.bar_id = b.id
       WHERE r.id = ? AND r.bar_id = ?`,
      [reviewId, barId]
    );
    if (!reviews.length) {
      console.log("RESPOND ERROR: Review not found or not authorized", { reviewId, barId });
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Check if response already exists
    const [existing] = await pool.query(
      "SELECT id FROM review_responses WHERE review_id = ?",
      [reviewId]
    );

    if (existing.length) {
      console.log("RESPOND: Updating existing response");
      // Update existing response
      await pool.query(
        "UPDATE review_responses SET response = ?, updated_at = NOW() WHERE review_id = ?",
        [response.trim(), reviewId]
      );
      return res.json({ success: true, message: "Response updated successfully" });
    } else {
      console.log("RESPOND: Creating new response");
      // Create new response
      await pool.query(
        "INSERT INTO review_responses (review_id, user_id, response) VALUES (?, ?, ?)",
        [reviewId, req.user.id, response.trim()]
      );
      return res.json({ success: true, message: "Response posted successfully" });
    }
  } catch (err) {
    console.error("RESPOND TO REVIEW ERROR:", err);
    console.error("SQL Error details:", {
      code: err.code,
      errno: err.errno,
      sqlMessage: err.sqlMessage,
      sqlState: err.sqlState,
    });
    return res.status(500).json({ success: false, message: err.sqlMessage || "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /owner-reviews/stats/summary — review stats summary
// ═══════════════════════════════════════════
router.get("/stats/summary", requireAuth, requirePermission("reviews_view"), async (req, res) => {
  try {
    const barId = Number(req.user.bar_id);
    if (!barId) return res.status(403).json({ success: false, message: "Forbidden (no bar scope)" });

    const [stats] = await pool.query(
      `SELECT 
        COUNT(*) AS total_reviews,
        AVG(r.rating) AS avg_rating,
        SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS five_star,
        SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS four_star,
        SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS three_star,
        SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS two_star,
        SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS one_star
       FROM reviews r
       WHERE r.bar_id = ?`,
      [barId]
    );

    // Count responded vs unresponded
    const [responded] = await pool.query(
      `SELECT COUNT(DISTINCT rr.review_id) AS cnt
       FROM review_responses rr
       JOIN reviews r ON rr.review_id = r.id
       WHERE r.bar_id = ?`,
      [barId]
    );

    return res.json({
      success: true,
      data: {
        ...stats[0],
        avg_rating: stats[0].avg_rating ? parseFloat(stats[0].avg_rating).toFixed(1) : "0.0",
        responded_count: responded[0].cnt,
        unresponded_count: (stats[0].total_reviews || 0) - (responded[0].cnt || 0),
      },
    });
  } catch (err) {
    console.error("REVIEW STATS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
