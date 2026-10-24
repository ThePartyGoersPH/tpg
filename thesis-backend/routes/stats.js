const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { complianceVisible } = require("../utils/compliance");

router.get('/platform', async (req, res) => {
  try {
    const [activeBarsResult] = await pool.query(
      `SELECT COUNT(*) as count FROM bars WHERE status = 'active' AND ${complianceVisible()}`
    );
    
    const [featuredEventsResult] = await pool.query(
      `SELECT COUNT(*) as count FROM bar_events 
       WHERE event_date >= CURDATE() 
       AND event_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)`
    );
    
    const [reservationsResult] = await pool.query(
      `SELECT COUNT(*) as count FROM reservations 
       WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) 
       AND YEAR(created_at) = YEAR(CURRENT_DATE())`
    );
    
    const [customersResult] = await pool.query(
      `SELECT COUNT(*) as count FROM users 
       WHERE role = 'customer' AND is_active = 1`
    );

    return res.json({
      success: true,
      data: {
        active_bars: activeBarsResult[0].count,
        featured_events: featuredEventsResult[0].count,
        reservations_this_month: reservationsResult[0].count,
        total_customers: customersResult[0].count,
      }
    });
  } catch (err) {
    console.error('PLATFORM STATS ERROR:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch platform statistics' 
    });
  }
});

module.exports = router;
