const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
const { USER_ROLES } = require("../config/constants");
const { complianceVisible } = require("../utils/compliance");

// ─── PUBLIC: Get reviews for a bar (with average + list) ───
router.get("/bars/:id/reviews", async (req, res) => {
  try {
    const barId = Number(req.params.id);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

    // Ensure bar is active
    const [barCheck] = await pool.query(
      `SELECT id FROM bars WHERE id = ? AND status = 'active' AND ${complianceVisible()} LIMIT 1`,
      [barId]
    );
    if (!barCheck.length) return res.status(404).json({ success: false, message: "Bar not found" });

    // Get average and count
    const [agg] = await pool.query(
      `SELECT COALESCE(AVG(rating), 0) AS average_rating,
              COUNT(*) AS review_count
       FROM reviews
       WHERE bar_id = ?`,
      [barId]
    );

    // Get individual reviews
    const [reviews] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at,
              u.first_name, u.last_name, u.profile_picture
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       WHERE r.bar_id = ?
       ORDER BY r.created_at DESC
       LIMIT 100`,
      [barId]
    );

    return res.json({
      success: true,
      data: {
        average_rating: parseFloat(Number(agg[0].average_rating).toFixed(1)),
        review_count: agg[0].review_count,
        reviews,
      },
    });
  } catch (err) {
    console.error("GET BAR REVIEWS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── CUSTOMER: Get my review for a specific bar ───
router.get(
  "/bars/:id/reviews/mine",
  requireAuth,
  async (req, res) => {
    try {
      const barId = Number(req.params.id);
      const customerId = req.user.id;
      if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

      const [rows] = await pool.query(
        `SELECT id, rating, comment, created_at, updated_at
         FROM reviews
         WHERE bar_id = ? AND customer_id = ?
         LIMIT 1`,
        [barId, customerId]
      );

      return res.json({
        success: true,
        data: rows.length ? rows[0] : null,
      });
    } catch (err) {
      console.error("GET MY REVIEW ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── CUSTOMER: Check review eligibility (has approved reservation) ───
router.get(
  "/bars/:id/reviews/eligibility",
  requireAuth,
  async (req, res) => {
    try {
      const barId = Number(req.params.id);
      const customerId = req.user.id;
      if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

      const [rows] = await pool.query(
        `SELECT id FROM reservations
         WHERE bar_id = ? AND customer_user_id = ?
           AND status IN ('approved', 'completed')
         LIMIT 1`,
        [barId, customerId]
      );

      return res.json({
        success: true,
        data: { eligible: rows.length > 0 },
      });
    } catch (err) {
      console.error("REVIEW ELIGIBILITY ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── CUSTOMER: Submit or update a review ───
router.post(
  "/bars/:id/reviews",
  requireAuth,
  requireRole([USER_ROLES.CUSTOMER]),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = Number(req.params.id);
      const customerId = req.user.id;
      if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

      const { rating, comment } = req.body || {};
      const ratingNum = Number(rating);

      if (!rating || !Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
      }

      const [banRows] = await conn.query(
        "SELECT 1 FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ? LIMIT 1",
        [barId, customerId]
      );
      if (banRows.length) {
        return res.status(403).json({ success: false, message: "You are banned from this bar" });
      }

      // Ensure bar is active
      const [barCheck] = await conn.query(
        `SELECT id FROM bars WHERE id = ? AND status = 'active' AND ${complianceVisible()} LIMIT 1`,
        [barId]
      );
      if (!barCheck.length) {
        conn.release();
        return res.status(404).json({ success: false, message: "Bar not found or is not active" });
      }

      // ─── Gate: require an approved/completed reservation ───
      const [eligCheck] = await conn.query(
        `SELECT id FROM reservations
         WHERE bar_id = ? AND customer_user_id = ?
           AND status IN ('approved', 'completed')
         LIMIT 1`,
        [barId, customerId]
      );
      if (!eligCheck.length) {
        conn.release();
        return res.status(403).json({
          success: false,
          message: "You can only leave a review after having an approved reservation at this bar.",
        });
      }

      await conn.beginTransaction();

      // Check if customer already reviewed this bar
      const [existing] = await conn.query(
        "SELECT id FROM reviews WHERE bar_id = ? AND customer_id = ? LIMIT 1",
        [barId, customerId]
      );

      let reviewId;
      let isUpdate = false;

      if (existing.length) {
        // Update existing review
        reviewId = existing[0].id;
        isUpdate = true;
        await conn.query(
          `UPDATE reviews SET rating = ?, comment = ?, updated_at = NOW()
           WHERE id = ?`,
          [ratingNum, comment || null, reviewId]
        );
      } else {
        // Insert new review
        const [ins] = await conn.query(
          `INSERT INTO reviews (bar_id, customer_id, rating, comment)
           VALUES (?, ?, ?, ?)`,
          [barId, customerId, ratingNum, comment || null]
        );
        reviewId = ins.insertId;
      }

      // Recalculate bar average rating and review_count
      const [agg] = await conn.query(
        `SELECT COALESCE(AVG(rating), 0) AS avg_rating,
                COUNT(*) AS cnt
         FROM reviews WHERE bar_id = ?`,
        [barId]
      );

      await conn.query(
        `UPDATE bars SET rating = ?, review_count = ?, updated_at = NOW()
         WHERE id = ?`,
        [parseFloat(Number(agg[0].avg_rating).toFixed(1)), agg[0].cnt, barId]
      );

      await conn.commit();

      return res.status(isUpdate ? 200 : 201).json({
        success: true,
        message: isUpdate ? "Review updated" : "Review submitted",
        data: {
          id: reviewId,
          rating: ratingNum,
          comment: comment || null,
          average_rating: parseFloat(Number(agg[0].avg_rating).toFixed(1)),
          review_count: agg[0].cnt,
        },
      });
    } catch (err) {
      await conn.rollback();
      console.error("SUBMIT REVIEW ERROR:", err);
      return res.status(500).json({ success: false, message: err.sqlMessage || "Server error" });
    } finally {
      conn.release();
    }
  }
);

// ─── CUSTOMER: Delete my review ───
router.delete(
  "/bars/:id/reviews",
  requireAuth,
  requireRole([USER_ROLES.CUSTOMER]),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const barId = Number(req.params.id);
      const customerId = req.user.id;
      if (!barId) return res.status(400).json({ success: false, message: "Invalid bar id" });

      await conn.beginTransaction();

      const [existing] = await conn.query(
        "SELECT id FROM reviews WHERE bar_id = ? AND customer_id = ? LIMIT 1",
        [barId, customerId]
      );

      if (!existing.length) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ success: false, message: "Review not found" });
      }

      await conn.query("DELETE FROM reviews WHERE id = ?", [existing[0].id]);

      // Recalculate bar average rating and review_count
      const [agg] = await conn.query(
        `SELECT COALESCE(AVG(rating), 0) AS avg_rating,
                COUNT(*) AS cnt
         FROM reviews WHERE bar_id = ?`,
        [barId]
      );

      await conn.query(
        `UPDATE bars SET rating = ?, review_count = ?, updated_at = NOW()
         WHERE id = ?`,
        [parseFloat(Number(agg[0].avg_rating).toFixed(1)), agg[0].cnt, barId]
      );

      await conn.commit();

      return res.json({ success: true, message: "Review deleted" });
    } catch (err) {
      await conn.rollback();
      console.error("DELETE REVIEW ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    } finally {
      conn.release();
    }
  }
);

module.exports = router;
