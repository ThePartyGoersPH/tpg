const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");

// ═══════════════════════════════════════════
// GET /analytics/dashboard — owner dashboard stats
// ═══════════════════════════════════════════
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get bar_owner_id
    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) return res.status(404).json({ success: false, message: "Bar owner not found" });
    const ownerId = owners[0].id;

    // Total bars
    const [barCount] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM bars WHERE owner_id = ? AND status != 'deleted'",
      [ownerId]
    );

    // Total visits
    const [visitCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bar_visits bv
       JOIN bars b ON bv.bar_id = b.id
       WHERE b.owner_id = ?`,
      [ownerId]
    );

    // Total reviews
    const [reviewCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bar_reviews br
       JOIN bars b ON br.bar_id = b.id
       WHERE b.owner_id = ?`,
      [ownerId]
    );

    // Total followers
    const [followerCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bar_followers bf
       JOIN bars b ON bf.bar_id = b.id
       WHERE b.owner_id = ?`,
      [ownerId]
    );

    // Active events
    const [eventCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bar_events be
       JOIN bars b ON be.bar_id = b.id
       WHERE b.owner_id = ? AND be.status = 'active'`,
      [ownerId]
    );

    // Active promotions
    const [promoCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM promotions p
       JOIN bars b ON p.bar_id = b.id
       WHERE b.owner_id = ? AND p.status = 'active'`,
      [ownerId]
    );

    // Recent visits (last 5)
    const [recentVisits] = await pool.query(
      `SELECT bv.*, b.name AS bar_name, u.first_name, u.last_name
       FROM bar_visits bv
       JOIN bars b ON bv.bar_id = b.id
       LEFT JOIN users u ON bv.user_id = u.id
       WHERE b.owner_id = ?
       ORDER BY bv.visit_date DESC LIMIT 5`,
      [ownerId]
    );

    // Average rating
    const [avgRating] = await pool.query(
      `SELECT AVG(br.rating) AS avg_rating
       FROM bar_reviews br
       JOIN bars b ON br.bar_id = b.id
       WHERE b.owner_id = ?`,
      [ownerId]
    );

    return res.json({
      success: true,
      data: {
        total_bars: barCount[0].cnt,
        total_visits: visitCount[0].cnt,
        total_reviews: reviewCount[0].cnt,
        total_followers: followerCount[0].cnt,
        active_events: eventCount[0].cnt,
        active_promotions: promoCount[0].cnt,
        average_rating: avgRating[0].avg_rating ? parseFloat(avgRating[0].avg_rating).toFixed(1) : "0.0",
        recent_visits: recentVisits,
      },
    });
  } catch (err) {
    console.error("DASHBOARD STATS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /analytics/visits — visit analytics with date range
// ═══════════════════════════════════════════
router.get("/visits", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period } = req.query; // 'week', 'month', 'year'

    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) return res.status(404).json({ success: false, message: "Bar owner not found" });
    const ownerId = owners[0].id;

    let dateFilter = "DATE_SUB(NOW(), INTERVAL 7 DAY)";
    let groupFormat = "%a"; // day name
    if (period === "month") {
      dateFilter = "DATE_SUB(NOW(), INTERVAL 30 DAY)";
      groupFormat = "%Y-%m-%d";
    } else if (period === "year") {
      dateFilter = "DATE_SUB(NOW(), INTERVAL 1 YEAR)";
      groupFormat = "%Y-%m";
    }

    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(bv.visit_date, '${groupFormat}') AS label, COUNT(*) AS count
       FROM bar_visits bv
       JOIN bars b ON bv.bar_id = b.id
       WHERE b.owner_id = ? AND bv.visit_date >= ${dateFilter}
       GROUP BY label ORDER BY MIN(bv.visit_date) ASC`,
      [ownerId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("VISIT ANALYTICS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /analytics/reviews — review analytics
// ═══════════════════════════════════════════
router.get("/reviews", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) return res.status(404).json({ success: false, message: "Bar owner not found" });
    const ownerId = owners[0].id;

    // Total + avg from actual reviews table
    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS total_reviews, COALESCE(AVG(r.rating), 0) AS avg_rating
       FROM reviews r
       JOIN bars b ON r.bar_id = b.id
       WHERE b.owner_id = ?`,
      [ownerId]
    );

    // Rating distribution
    const [distribution] = await pool.query(
      `SELECT r.rating AS stars, COUNT(*) AS count
       FROM reviews r
       JOIN bars b ON r.bar_id = b.id
       WHERE b.owner_id = ?
       GROUP BY r.rating ORDER BY r.rating DESC`,
      [ownerId]
    );

    // Recent reviews
    const [recent] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at, b.name AS bar_name,
              u.first_name, u.last_name
       FROM reviews r
       JOIN bars b ON r.bar_id = b.id
       LEFT JOIN users u ON r.customer_id = u.id
       WHERE b.owner_id = ?
       ORDER BY r.created_at DESC LIMIT 10`,
      [ownerId]
    );

    return res.json({
      success: true,
      data: {
        total_reviews: stats.total_reviews,
        average_rating: stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(1) : "0.0",
        distribution,
        recent,
      },
    });
  } catch (err) {
    console.error("REVIEW ANALYTICS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /analytics/followers — follower analytics
// ═══════════════════════════════════════════
router.get("/followers", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) return res.status(404).json({ success: false, message: "Bar owner not found" });
    const ownerId = owners[0].id;

    // Followers per bar
    const [perBar] = await pool.query(
      `SELECT b.id, b.name, COUNT(bf.id) AS follower_count
       FROM bars b
       LEFT JOIN bar_followers bf ON b.id = bf.bar_id
       WHERE b.owner_id = ? AND b.status != 'deleted'
       GROUP BY b.id ORDER BY follower_count DESC`,
      [ownerId]
    );

    // New followers this week
    const [newThisWeek] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM bar_followers bf
       JOIN bars b ON bf.bar_id = b.id
       WHERE b.owner_id = ? AND bf.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [ownerId]
    );

    return res.json({
      success: true,
      data: { per_bar: perBar, new_this_week: newThisWeek[0].cnt },
    });
  } catch (err) {
    console.error("FOLLOWER ANALYTICS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
