const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { complianceVisible } = require("../utils/compliance");

// ═══════════════════════════════════════════
// ACTIVE BARS (posted within last 24-48h)
// ═══════════════════════════════════════════
router.get("/active-bars", async (req, res) => {
  try {
    const hoursBack = Number(req.query.hours) || 48;
    
    const [rows] = await pool.query(
      `SELECT DISTINCT
        b.id,
        b.name,
        b.logo_path,
        b.city,
        (SELECT COUNT(*) FROM bar_followers bf WHERE bf.bar_id = b.id) AS follower_count,
        (
          SELECT 1 
          FROM bar_events be 
          WHERE be.bar_id = b.id 
            AND be.status = 'active'
            AND be.event_date = CURDATE()
            AND CURTIME() BETWEEN be.start_time AND be.end_time
          LIMIT 1
        ) AS is_live
      FROM bars b
      WHERE b.status = 'active'
        AND ${complianceVisible("b")}
        AND (
          EXISTS (
            SELECT 1 FROM bar_posts bp 
            WHERE bp.bar_id = b.id 
              AND bp.status = 'active'
              AND bp.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          )
          OR EXISTS (
            SELECT 1 FROM bar_events be 
            WHERE be.bar_id = b.id 
              AND be.status = 'active'
              AND be.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
          )
        )
      ORDER BY is_live DESC, follower_count DESC
      LIMIT 10`,
      [hoursBack, hoursBack]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("ACTIVE BARS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// QUICK STATS
// ═══════════════════════════════════════════
router.get("/quick-stats", async (req, res) => {
  try {
    // Total published events
    const [totalEventsRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM bar_events WHERE status = 'active'`
    );
    
    // Events scheduled for today
    const [todayEventsRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM bar_events 
       WHERE status = 'active' AND event_date = CURDATE()`
    );
    
    // Total registered bars
    const [totalBarsRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM bars WHERE status = 'active' AND ${complianceVisible()}`
    );
    
    // Bars currently live (event happening right now)
    const [liveBarsRows] = await pool.query(
      `SELECT COUNT(DISTINCT be.bar_id) AS count
       FROM bar_events be
       WHERE be.status = 'active'
         AND be.event_date = CURDATE()
         AND CURTIME() BETWEEN be.start_time AND be.end_time`
    );

    return res.json({
      success: true,
      data: {
        total_events: totalEventsRows[0].count,
        events_today: todayEventsRows[0].count,
        total_bars: totalBarsRows[0].count,
        bars_live: liveBarsRows[0].count,
      },
    });
  } catch (err) {
    console.error("QUICK STATS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// HOT TONIGHT (events today, starting soon)
// ═══════════════════════════════════════════
router.get("/hot-tonight", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        be.id,
        be.bar_id,
        be.title,
        be.description,
        be.event_date,
        be.start_time,
        be.end_time,
        be.entry_price,
        be.image_path,
        b.name AS bar_name,
        b.logo_path AS bar_logo,
        (SELECT COUNT(*) FROM event_likes el WHERE el.event_id = be.id) AS like_count
      FROM bar_events be
      JOIN bars b ON b.id = be.bar_id
      WHERE be.status = 'active'
        AND b.status = 'active'
        AND ${complianceVisible("b")}
        AND be.event_date = CURDATE()
        AND be.start_time >= CURTIME()
      ORDER BY be.start_time ASC
      LIMIT 5`,
      []
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("HOT TONIGHT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GENRE/VIBE TAGS (only tags actually used)
// ═══════════════════════════════════════════
router.get("/genre-tags", async (req, res) => {
  try {
    // Check if bar_events has a genre/category/vibe column
    const [columns] = await pool.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'bar_events' 
         AND COLUMN_NAME IN ('genre', 'category', 'vibe', 'event_type')`
    );

    if (!columns.length) {
      // No genre column exists, return empty
      return res.json({ success: true, data: [] });
    }

    const genreColumn = columns[0].COLUMN_NAME;

    const [rows] = await pool.query(
      `SELECT DISTINCT ${genreColumn} AS tag, COUNT(*) AS event_count
       FROM bar_events
       WHERE status = 'active' 
         AND ${genreColumn} IS NOT NULL 
         AND ${genreColumn} != ''
       GROUP BY ${genreColumn}
       ORDER BY event_count DESC
       LIMIT 10`,
      []
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GENRE TAGS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// BAR CITIES (only cities with active bars)
// ═══════════════════════════════════════════
router.get("/bar-cities", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT city, COUNT(*) AS bar_count
       FROM bars
       WHERE status = 'active' 
         AND ${complianceVisible()}
         AND city IS NOT NULL 
         AND city != ''
       GROUP BY city
       ORDER BY bar_count DESC, city ASC`,
      []
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("BAR CITIES ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
