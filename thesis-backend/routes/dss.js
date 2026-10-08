const express = require("express");
const router = express.Router();

const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");

// OWNER DSS - Reservation Analytics
// GET /owner/dss/reservations-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get(
  "/owner/dss/reservations-summary",
  requireAuth,
  requirePermission("analytics_bar_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { from, to } = req.query;
      if (!from || !to) {
        return res.status(400).json({ success: false, message: "from and to required (YYYY-MM-DD)" });
      }

      // 1) Total reservations by status
      const [statusRows] = await pool.query(
        `SELECT status, COUNT(*) AS count
         FROM reservations
         WHERE bar_id=? AND reservation_date BETWEEN ? AND ?
         GROUP BY status`,
        [barId, from, to]
      );

      // 2) Peak hour (most reservations in that hour)
      const [peakHourRows] = await pool.query(
        `SELECT HOUR(reservation_time) AS hour, COUNT(*) AS count
         FROM reservations
         WHERE bar_id=? AND reservation_date BETWEEN ? AND ?
           AND status IN ('pending','approved')
         GROUP BY HOUR(reservation_time)
         ORDER BY count DESC
         LIMIT 1`,
        [barId, from, to]
      );

      // 3) Busiest day
      const [busiestDayRows] = await pool.query(
        `SELECT reservation_date AS day, COUNT(*) AS count
         FROM reservations
         WHERE bar_id=? AND reservation_date BETWEEN ? AND ?
           AND status IN ('pending','approved')
         GROUP BY reservation_date
         ORDER BY count DESC
         LIMIT 1`,
        [barId, from, to]
      );

      // 4) Most reserved table
      const [tableRows] = await pool.query(
        `SELECT r.table_id, t.table_number, COUNT(*) AS count
         FROM reservations r
         JOIN bar_tables t ON t.id = r.table_id
         WHERE r.bar_id=? AND r.reservation_date BETWEEN ? AND ?
           AND r.status IN ('pending','approved')
         GROUP BY r.table_id, t.table_number
         ORDER BY count DESC
         LIMIT 1`,
        [barId, from, to]
      );

      // 5) Trend: daily totals
      const [trendRows] = await pool.query(
        `SELECT reservation_date AS day, COUNT(*) AS total
         FROM reservations
         WHERE bar_id=? AND reservation_date BETWEEN ? AND ?
           AND status IN ('pending','approved')
         GROUP BY reservation_date
         ORDER BY reservation_date ASC`,
        [barId, from, to]
      );

      const summary = {
        bar_id: barId,
        from,
        to,
        by_status: statusRows,
        peak_hour: peakHourRows[0] || null,
        busiest_day: busiestDayRows[0] || null,
        most_reserved_table: tableRows[0] || null,
        trend_daily: trendRows
      };

      return res.json({ success: true, data: summary });
    } catch (err) {
      console.error("DSS RESERVATIONS SUMMARY ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// OWNER DSS - Inventory Restock Recommendations
router.get(
  "/owner/dss/inventory",
  requireAuth,
  requirePermission("analytics_bar_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

      const [rows] = await pool.query(
        `SELECT 
        id, name, unit, stock_qty, reorder_level,
        CASE
          WHEN COALESCE(stock_qty, 0) <= 0 THEN 'critical'
          WHEN COALESCE(stock_qty, 0) < COALESCE(reorder_level, 0) THEN 'low'
          ELSE 'normal'
        END AS stock_status,
        GREATEST(COALESCE(reorder_level, 0) - COALESCE(stock_qty, 0), 0) AS suggested_restock
        FROM inventory_items
        WHERE bar_id=?
        AND is_active = 1
        AND (
          COALESCE(stock_qty, 0) <= 0
          OR COALESCE(stock_qty, 0) < COALESCE(reorder_level, 0)
        )
        ORDER BY
          CASE WHEN COALESCE(stock_qty, 0) <= 0 THEN 0 ELSE 1 END,
          name ASC`,
        [barId]
      );

      return res.json({
        success: true,
        data: {
          bar_id: barId,
          recommendations: rows
        }
      });
    } catch (err) {
      console.error("DSS INVENTORY ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

router.get("/owner/dss/sales-trend", requireAuth, requirePermission("analytics_bar_view"), async (req, res) => {
  try {
    const barId = req.user.bar_id;

    const [rows] = await pool.query(
      `SELECT i.name,
              SUM(s.quantity) AS total_sold,
              AVG(s.quantity) AS avg_sale
       FROM sales s
       JOIN inventory_items i ON i.id=s.item_id
       WHERE s.bar_id=?
       AND s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY s.item_id
       ORDER BY total_sold DESC`,
      [barId]
    );

    return res.json({ success:true, data: rows });
  } catch (err) {
    return res.status(500).json({ success:false, message:"Server error" });
  }
});


// ═══════════════════════════════════════════════════════
// SMART DSS — Unified Recommendations Endpoint
// GET /owner/dss/recommendations
// ═══════════════════════════════════════════════════════

const dssCache = new Map(); // barId -> { ts, recommendations }
const DSS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Build prescriptive DSS recommendations (Wisdom tier)
async function buildRecommendations(barId, forceRefresh = false) {
  const cached = dssCache.get(barId);
  if (!forceRefresh && cached && Date.now() - cached.ts < DSS_CACHE_TTL) {
    return { recommendations: cached.recommendations, cached: true, generated_at: new Date(cached.ts).toISOString() };
  }
  const recs = [];
  let idSeq = 1;

      // ─── Minimum data check ───────────────────────────────────────────────
      const [[{ activityCount }]] = await pool.query(
        `SELECT (
           (SELECT COUNT(*) FROM sales WHERE bar_id = ?)
           + (SELECT COUNT(*) FROM reservation_items WHERE bar_id = ?)
           + (SELECT COUNT(*) FROM reservations WHERE bar_id = ?)
           + (SELECT COUNT(*) FROM pos_orders WHERE bar_id = ?)
         ) AS activityCount`,
        [barId, barId, barId, barId]
      );
       if (activityCount < 1) {
         return { recommendations: [], generated_at: new Date().toISOString(), message: "Not enough data yet to generate recommendations" };
       }

      // ─── INVENTORY RECOMMENDATIONS ────────────────────────────────────────

      // 1. Critical low stock (stock = 0, still active in menu)
      const [outOfStockMenuItems] = await pool.query(
        `SELECT ii.id AS inventory_item_id, ii.name, ii.stock_qty
         FROM inventory_items ii
         JOIN menu_items mi ON mi.inventory_item_id = ii.id AND mi.bar_id = ii.bar_id AND mi.is_available = 1
         WHERE ii.bar_id = ? AND COALESCE(ii.stock_qty, 0) <= 0 AND ii.is_active = 1`,
        [barId]
      );
      for (const item of outOfStockMenuItems.slice(0, 2)) {
        recs.push({ id: idSeq++, inventory_item_id: item.inventory_item_id, type: 'inventory', severity: 'critical', icon: 'warning', title: 'Out of Stock on Menu', message: `${item.name} is out of stock but still listed as available on your menu.`, action_label: 'Update Stock', action_route: '/inventory' });
      }

      // 2. Items below reorder level with recent sales (POS or reservation)
      const [criticalLow] = await pool.query(
        `SELECT ii.id AS inventory_item_id, ii.name, ii.stock_qty, ii.reorder_level
         FROM inventory_items ii
         WHERE ii.bar_id = ? AND ii.is_active = 1 AND COALESCE(ii.stock_qty, 0) > 0
           AND COALESCE(ii.stock_qty, 0) < COALESCE(ii.reorder_level, 0)
           AND (
             EXISTS (SELECT 1 FROM sales s WHERE s.item_id = ii.id AND s.bar_id = ? AND s.sale_date >= DATE_SUB(NOW(), INTERVAL 7 DAY))
             OR EXISTS (
               SELECT 1 FROM reservation_items ri
               JOIN menu_items mi ON mi.id = ri.menu_item_id AND mi.inventory_item_id = ii.id
               WHERE ri.bar_id = ? AND ri.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             )
           )
         ORDER BY ii.stock_qty ASC LIMIT 3`,
        [barId, barId, barId]
      );
      for (const item of criticalLow) {
        recs.push({ id: idSeq++, inventory_item_id: item.inventory_item_id, type: 'inventory', severity: 'critical', icon: 'warning', title: 'Low Stock Alert', message: `${item.name} stock is critically low — only ${item.stock_qty} units left.`, action_label: 'Update Stock', action_route: '/inventory' });
      }

      // 3. Fast-moving items (sold >70% of stock in last 7 days — POS + reservations)
      const [fastMoving] = await pool.query(
        `SELECT ii.id, ii.name, ii.stock_qty, SUM(combined.qty) AS sold_7d
         FROM inventory_items ii
         JOIN (
           SELECT item_id AS inv_id, quantity AS qty FROM sales
           WHERE bar_id = ? AND sale_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
           UNION ALL
           SELECT mi.inventory_item_id AS inv_id, ri.quantity AS qty
           FROM reservation_items ri
           JOIN menu_items mi ON mi.id = ri.menu_item_id AND mi.bar_id = ?
           WHERE ri.bar_id = ? AND ri.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ) combined ON combined.inv_id = ii.id
         WHERE ii.bar_id = ? AND ii.is_active = 1 AND COALESCE(ii.stock_qty, 0) > 0
         GROUP BY ii.id, ii.name, ii.stock_qty
         HAVING SUM(combined.qty) >= (ii.stock_qty * 0.7)
         ORDER BY sold_7d DESC LIMIT 2`,
        [barId, barId, barId, barId]
      );
      for (const item of fastMoving) {
        recs.push({ id: idSeq++, inventory_item_id: item.id, type: 'inventory', severity: 'warning', icon: 'trending_up', title: 'Fast-Moving Item', message: `${item.name} is selling fast — consider restocking soon.`, action_label: 'Update Stock', action_route: '/inventory' });
      }

      // 4. Zero sales in 30 days (neither POS nor reservation)
      const [deadStock] = await pool.query(
        `SELECT ii.id AS inventory_item_id, ii.name
         FROM inventory_items ii
         WHERE ii.bar_id = ? AND ii.is_active = 1 AND COALESCE(ii.stock_qty, 0) > 0
           AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.item_id = ii.id AND s.bar_id = ? AND s.sale_date >= DATE_SUB(NOW(), INTERVAL 30 DAY))
           AND NOT EXISTS (
             SELECT 1 FROM reservation_items ri
             JOIN menu_items mi ON mi.id = ri.menu_item_id AND mi.inventory_item_id = ii.id
             WHERE ri.bar_id = ? AND ri.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           )
         LIMIT 2`,
        [barId, barId, barId]
      );
      for (const item of deadStock) {
        recs.push({ id: idSeq++, inventory_item_id: item.inventory_item_id, type: 'inventory', severity: 'warning', icon: 'trending_down', title: 'Slow-Moving Item', message: `${item.name} has not sold in 30 days — consider removing or discounting it.`, action_label: 'View Menu', action_route: '/menu' });
      }

      // ─── MENU / SALES RECOMMENDATIONS ────────────────────────────────────

      // 5. Top seller this week (POS + reservations combined)
      const [topSeller] = await pool.query(
        `SELECT ii.name, SUM(combined.qty) AS total_sold
         FROM inventory_items ii
         JOIN (
           SELECT item_id AS inv_id, quantity AS qty FROM sales
           WHERE bar_id = ? AND sale_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
           UNION ALL
           SELECT mi.inventory_item_id AS inv_id, ri.quantity AS qty
           FROM reservation_items ri
           JOIN menu_items mi ON mi.id = ri.menu_item_id AND mi.bar_id = ?
           WHERE ri.bar_id = ? AND ri.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         ) combined ON combined.inv_id = ii.id
         WHERE ii.bar_id = ?
         GROUP BY ii.id, ii.name ORDER BY total_sold DESC LIMIT 1`,
        [barId, barId, barId, barId]
      );
      if (topSeller.length) {
        recs.push({ id: idSeq++, type: 'menu', severity: 'positive', icon: 'star', title: 'Top Performer', message: `${topSeller[0].name} is your best seller this week (${topSeller[0].total_sold} sold) — keep it stocked.`, action_label: 'View Menu', action_route: '/menu' });
      }

      // 6. Sales dropped >50% vs previous week (POS + reservations combined)
      const [salesDropped] = await pool.query(
        `SELECT ii.name,
                SUM(CASE WHEN combined.sale_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN combined.qty ELSE 0 END) AS this_week,
                SUM(CASE WHEN combined.sale_date < DATE_SUB(NOW(), INTERVAL 7 DAY) AND combined.sale_date >= DATE_SUB(NOW(), INTERVAL 14 DAY) THEN combined.qty ELSE 0 END) AS last_week
         FROM inventory_items ii
         JOIN (
           SELECT item_id AS inv_id, quantity AS qty, sale_date FROM sales
           WHERE bar_id = ? AND sale_date >= DATE_SUB(NOW(), INTERVAL 14 DAY)
           UNION ALL
           SELECT mi.inventory_item_id AS inv_id, ri.quantity AS qty, ri.created_at AS sale_date
           FROM reservation_items ri
           JOIN menu_items mi ON mi.id = ri.menu_item_id AND mi.bar_id = ?
           WHERE ri.bar_id = ? AND ri.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
         ) combined ON combined.inv_id = ii.id
         WHERE ii.bar_id = ?
         GROUP BY ii.id, ii.name
         HAVING SUM(CASE WHEN combined.sale_date < DATE_SUB(NOW(), INTERVAL 7 DAY) AND combined.sale_date >= DATE_SUB(NOW(), INTERVAL 14 DAY) THEN combined.qty ELSE 0 END) > 0
            AND SUM(CASE WHEN combined.sale_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN combined.qty ELSE 0 END) <
                (SUM(CASE WHEN combined.sale_date < DATE_SUB(NOW(), INTERVAL 7 DAY) AND combined.sale_date >= DATE_SUB(NOW(), INTERVAL 14 DAY) THEN combined.qty ELSE 0 END) * 0.5)
         ORDER BY (SUM(CASE WHEN combined.sale_date < DATE_SUB(NOW(), INTERVAL 7 DAY) AND combined.sale_date >= DATE_SUB(NOW(), INTERVAL 14 DAY) THEN combined.qty ELSE 0 END)
                 - SUM(CASE WHEN combined.sale_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN combined.qty ELSE 0 END)) DESC LIMIT 1`,
        [barId, barId, barId, barId]
      );
      if (salesDropped.length) {
        const drop = salesDropped[0];
        recs.push({ id: idSeq++, type: 'menu', severity: 'warning', icon: 'trending_down', title: 'Sales Drop Detected', message: `${drop.name} sales dropped ${Math.round((1 - drop.this_week / drop.last_week) * 100)}% this week vs last week.`, action_label: 'View Menu', action_route: '/menu' });
      }

      // 7. Item never ordered since added
      const [neverOrdered] = await pool.query(
        `SELECT mi.menu_name
         FROM menu_items mi
         WHERE mi.bar_id = ? AND mi.is_available = 1
           AND NOT EXISTS (SELECT 1 FROM reservation_items ri WHERE ri.menu_item_id = mi.id)
           AND NOT EXISTS (SELECT 1 FROM sales s JOIN inventory_items ii ON ii.id = s.item_id WHERE ii.bar_id = ? AND mi.inventory_item_id = ii.id)
         LIMIT 1`,
        [barId, barId]
      );
      if (neverOrdered.length) {
        recs.push({ id: idSeq++, type: 'menu', severity: 'insight', icon: 'info', title: 'Unordered Menu Item', message: `${neverOrdered[0].menu_name} has never been ordered — consider replacing or promoting it.`, action_label: 'View Menu', action_route: '/menu' });
      }

      // ─── RESERVATION RECOMMENDATIONS ─────────────────────────────────────

      // 8. Busiest day of week (40%+ above average)
      const [dayOfWeek] = await pool.query(
        `SELECT DAYNAME(reservation_date) AS day_name, COUNT(*) AS cnt
         FROM reservations
         WHERE bar_id = ? AND reservation_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           AND status IN ('pending','approved','confirmed','paid')
         GROUP BY DAYOFWEEK(reservation_date), DAYNAME(reservation_date)
         ORDER BY cnt DESC LIMIT 3`,
        [barId]
      );
      if (dayOfWeek.length >= 2) {
        const top = dayOfWeek[0];
        const avg = dayOfWeek.reduce((s, r) => s + Number(r.cnt), 0) / dayOfWeek.length;
        if (Number(top.cnt) >= avg * 1.4) {
          recs.push({ id: idSeq++, type: 'reservation', severity: 'insight', icon: 'calendar', title: 'Peak Day Detected', message: `${top.day_name}s are your busiest — consider requiring advance reservations on ${top.day_name}s.`, action_label: 'View Reservations', action_route: '/reservations' });
        }
      }

      // 9. Most requested table (80%+ of all reservations)
      const [[totalRes]] = await pool.query(
        `SELECT COUNT(*) AS total FROM reservations WHERE bar_id = ? AND reservation_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND status IN ('pending','approved','confirmed','paid')`,
        [barId]
      );
      if (Number(totalRes.total) >= 5) {
        const [topTable] = await pool.query(
          `SELECT t.table_number, COUNT(*) AS cnt
           FROM reservations r JOIN bar_tables t ON t.id = r.table_id
           WHERE r.bar_id = ? AND r.reservation_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND r.status IN ('pending','approved','confirmed','paid')
           GROUP BY r.table_id, t.table_number ORDER BY cnt DESC LIMIT 1`,
          [barId]
        );
        if (topTable.length && Number(topTable[0].cnt) / Number(totalRes.total) >= 0.8) {
          recs.push({ id: idSeq++, type: 'reservation', severity: 'insight', icon: 'star', title: 'Most Requested Table', message: `Table ${topTable[0].table_number} is requested in ${Math.round(Number(topTable[0].cnt) / Number(totalRes.total) * 100)}% of reservations — prioritize its maintenance.`, action_label: 'View Tables', action_route: '/tables' });
        }
      }

      // 10. Reservations down vs last week
      const [[thisWeekRes]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM reservations WHERE bar_id = ? AND reservation_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        [barId]
      );
      const [[lastWeekRes]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM reservations WHERE bar_id = ? AND reservation_date BETWEEN DATE_SUB(NOW(), INTERVAL 14 DAY) AND DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        [barId]
      );
      if (Number(lastWeekRes.cnt) > 0 && Number(thisWeekRes.cnt) < Number(lastWeekRes.cnt) * 0.6) {
        const drop = Math.round((1 - Number(thisWeekRes.cnt) / Number(lastWeekRes.cnt)) * 100);
        recs.push({ id: idSeq++, type: 'reservation', severity: 'warning', icon: 'trending_down', title: 'Reservations Down', message: `Reservations are down ${drop}% this week compared to last — consider running a promotion.`, action_label: 'View Reservations', action_route: '/reservations' });
      }

      // ─── REVENUE RECOMMENDATIONS ──────────────────────────────────────────

      // 11. Revenue down >30% vs last week
      const [[thisWeekRev]] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS rev FROM pos_orders WHERE bar_id = ? AND status = 'completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        [barId]
      );
      const [[lastWeekRev]] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS rev FROM pos_orders WHERE bar_id = ? AND status = 'completed' AND created_at BETWEEN DATE_SUB(NOW(), INTERVAL 14 DAY) AND DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        [barId]
      );
      if (parseFloat(lastWeekRev.rev) > 0 && parseFloat(thisWeekRev.rev) < parseFloat(lastWeekRev.rev) * 0.7) {
        const drop = Math.round((1 - parseFloat(thisWeekRev.rev) / parseFloat(lastWeekRev.rev)) * 100);
        recs.push({ id: idSeq++, type: 'revenue', severity: 'warning', icon: 'trending_down', title: 'Revenue Drop', message: `Revenue this week is ${drop}% lower than last week — check if any operational issues affected sales.`, action_label: 'View Financials', action_route: '/financials' });
      }

      // 12. Weekend vs weekday revenue ratio
      const [[weekendRev]] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS rev FROM pos_orders WHERE bar_id = ? AND status = 'completed' AND DAYOFWEEK(created_at) IN (1,7) AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [barId]
      );
      const [[weekdayRev]] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS rev FROM pos_orders WHERE bar_id = ? AND status = 'completed' AND DAYOFWEEK(created_at) NOT IN (1,7) AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [barId]
      );
      if (parseFloat(weekdayRev.rev) > 0 && parseFloat(weekendRev.rev) >= parseFloat(weekdayRev.rev) * 3) {
        recs.push({ id: idSeq++, type: 'revenue', severity: 'insight', icon: 'info', title: 'Weekend Revenue Spike', message: `Your weekend revenue is ${Math.round(parseFloat(weekendRev.rev) / parseFloat(weekdayRev.rev))}x higher than weekdays — consider weekday-only promotions.`, action_label: 'View Financials', action_route: '/financials' });
      }

      // ─── Sort and cap ─────────────────────────────────────────────────────
      const severityOrder = { critical: 0, warning: 1, insight: 2, positive: 3 };
      recs.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));
      const final = recs.slice(0, 8).map((r, i) => ({ ...r, id: i + 1 }));

      dssCache.set(barId, { ts: Date.now(), recommendations: final });
      return { recommendations: final, cached: false, generated_at: new Date().toISOString() };
}

router.get(
  "/owner/dss/recommendations",
  requireAuth,
  requirePermission("analytics_bar_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const forceRefresh = ['1', 'true', 'yes'].includes(String(req.query.force || '').toLowerCase());
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
      const result = await buildRecommendations(barId, forceRefresh);
      return res.json({ success: true, ...result });
    } catch (err) {
      console.error("DSS RECOMMENDATIONS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// DIKW TIERS — Decision Support System
// Data → Information → Knowledge → Wisdom
// ═══════════════════════════════════════════════════════════════════

// ─── DATA TIER: raw operational records ──────────────────────────────
router.get(
  "/owner/dss/data",
  requireAuth,
  requirePermission("analytics_bar_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [posOrders] = await pool.query(
        `SELECT id, order_number, transaction_name, total_amount, status, created_at
         FROM pos_orders WHERE bar_id = ? ORDER BY created_at DESC LIMIT 10`,
        [barId]
      );
      const [wastage] = await pool.query(
        `SELECT w.id, w.quantity_wasted, w.reason, w.date_logged, i.name AS item_name
         FROM wastage_logs w LEFT JOIN inventory_items i ON i.id = w.item_id
         WHERE i.bar_id = ? ORDER BY w.date_logged DESC LIMIT 10`,
        [barId]
      );
      const [payrollRuns] = await pool.query(
        `SELECT id, period_start, period_end, status, finance_approved_at
         FROM payroll_runs WHERE bar_id = ? ORDER BY created_at DESC LIMIT 5`,
        [barId]
      );
      const [purchaseOrders] = await pool.query(
        `SELECT id, supplier_id, status, total_amount, order_date
         FROM purchase_orders WHERE bar_id = ? ORDER BY created_at DESC LIMIT 5`,
        [barId]
      );
      const [promotions] = await pool.query(
        `SELECT id, title, discount_type, discount_value, status, redeemed_count, valid_from, valid_until
         FROM promotions WHERE bar_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 5`,
        [barId]
      );

      return res.json({
        success: true,
        data: { tier: "data", pos_orders: posOrders, wastage_logs: wastage, payroll_runs: payrollRuns, purchase_orders: purchaseOrders, promotions },
      });
    } catch (err) {
      console.error("DSS DATA ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── INFORMATION TIER: aggregated KPIs ───────────────────────────────
router.get(
  "/owner/dss/information",
  requireAuth,
  requirePermission("analytics_bar_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [trend] = await pool.query(
        `SELECT DATE(created_at) AS day, COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS orders
         FROM pos_orders
         WHERE bar_id = ? AND status IN ('completed','paid') AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(created_at) ORDER BY day ASC`,
        [barId]
      );
      const [[payrollExp]] = await pool.query(
        `SELECT COALESCE(SUM(amount),0) AS total FROM payroll_expenses WHERE bar_id = ? AND posted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [barId]
      );
      const [[procExp]] = await pool.query(
        `SELECT COALESCE(SUM(total_amount),0) AS total FROM purchase_orders
         WHERE bar_id = ? AND status IN ('approved','partially_received','received') AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [barId]
      );
      const [[wastageCost]] = await pool.query(
        `SELECT COALESCE(SUM(w.quantity_wasted * COALESCE(i.cost_price,0)),0) AS total
         FROM wastage_logs w LEFT JOIN inventory_items i ON i.id = w.item_id
         WHERE i.bar_id = ? AND w.date_logged >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [barId]
      );
      const [topItems] = await pool.query(
        `SELECT oi.menu_item_id, oi.item_name, SUM(oi.quantity) AS qty, SUM(oi.subtotal) AS revenue
         FROM pos_order_items oi JOIN pos_orders o ON o.id = oi.order_id
         WHERE o.bar_id = ? AND o.status IN ('completed','paid') AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY oi.menu_item_id, oi.item_name ORDER BY qty DESC LIMIT 5`,
        [barId]
      );
      const [[kpis]] = await pool.query(
        `SELECT COALESCE(SUM(total_amount),0) AS total_revenue,
                COUNT(*) AS total_orders,
                COALESCE(AVG(total_amount),0) AS avg_order_value
         FROM pos_orders
         WHERE bar_id = ? AND status IN ('completed','paid') AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [barId]
      );

      return res.json({
        success: true,
        data: {
          tier: "information",
          revenue_trend: trend,
          expense_breakdown: {
            payroll: Number(payrollExp.total),
            procurement: Number(procExp.total),
            wastage: Number(wastageCost.total),
          },
          top_items: topItems,
          kpis: {
            total_revenue_30d: Number(kpis.total_revenue),
            total_orders_30d: Number(kpis.total_orders),
            avg_order_value: Number(kpis.avg_order_value),
            total_payroll_expense_30d: Number(payrollExp.total),
          },
        },
      });
    } catch (err) {
      console.error("DSS INFORMATION ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── KNOWLEDGE TIER: diagnostics + prediction ───────────────────────
router.get(
  "/owner/dss/knowledge",
  requireAuth,
  requirePermission(["dss_diagnostic_view", "dss_predictive_view"]),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [lowStock] = await pool.query(
        `SELECT id, name, stock_qty, reorder_level, stock_status
         FROM inventory_items
         WHERE bar_id = ? AND is_active = 1 AND (COALESCE(stock_qty,0) <= 0 OR COALESCE(stock_qty,0) < COALESCE(reorder_level,0))
         ORDER BY stock_qty ASC LIMIT 10`,
        [barId]
      );
      const [nearExpiry] = await pool.query(
        `SELECT id, name, stock_qty, expiry_date
         FROM inventory_items
         WHERE bar_id = ? AND is_perishable = 1 AND expiry_date IS NOT NULL
           AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
         ORDER BY expiry_date ASC LIMIT 10`,
        [barId]
      );
      const [[wastageAnom]] = await pool.query(
        `SELECT
           COALESCE(SUM(w.quantity_wasted * COALESCE(i.cost_price,0)),0) AS wastage_cost,
           (SELECT COALESCE(SUM(total_amount),0) FROM pos_orders WHERE bar_id = ? AND status IN ('completed','paid') AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS revenue
         FROM wastage_logs w LEFT JOIN inventory_items i ON i.id = w.item_id
         WHERE i.bar_id = ? AND w.date_logged >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
        [barId, barId]
      );
      const wastageCost = Number(wastageAnom.wastage_cost);
      const revenue = Number(wastageAnom.revenue);
      const wastageRatio = revenue > 0 ? wastageCost / revenue : 0;
      const [turnover] = await pool.query(
        `SELECT i.id, i.name, i.stock_qty, COALESCE(SUM(oi.quantity),0) AS sold_30d
         FROM inventory_items i
         LEFT JOIN pos_order_items oi ON oi.inventory_item_id = i.id
         LEFT JOIN pos_orders o ON o.id = oi.order_id AND o.bar_id = ? AND o.status IN ('completed','paid') AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         WHERE i.bar_id = ? AND i.is_active = 1
         GROUP BY i.id, i.name, i.stock_qty
         HAVING sold_30d > 0
         ORDER BY (COALESCE(SUM(oi.quantity),0) / (COALESCE(i.stock_qty,0)+1)) DESC LIMIT 10`,
        [barId, barId]
      );
      const [[forecast]] = await pool.query(
        `SELECT COALESCE(AVG(daily_rev),0) AS avg_daily
         FROM (SELECT DATE(created_at) d, SUM(total_amount) daily_rev FROM pos_orders
               WHERE bar_id = ? AND status IN ('completed','paid') AND created_at >= DATE_SUB(NOW(), INTERVAL 28 DAY)
               GROUP BY DATE(created_at)) t`,
        [barId]
      );
      const [weekly] = await pool.query(
        `SELECT WEEK(created_at) AS wk, COALESCE(SUM(total_amount),0) AS revenue
         FROM pos_orders
         WHERE bar_id = ? AND status IN ('completed','paid') AND created_at >= DATE_SUB(NOW(), INTERVAL 28 DAY)
         GROUP BY WEEK(created_at) ORDER BY wk ASC`,
        [barId]
      );
      const [promoEff] = await pool.query(
        `SELECT id, title, discount_type, discount_value, redeemed_count, max_redemptions, status
         FROM promotions WHERE bar_id = ? ORDER BY redeemed_count DESC LIMIT 5`,
        [barId]
      );

      return res.json({
        success: true,
        data: {
          tier: "knowledge",
          low_stock_items: lowStock,
          near_expiry_items: nearExpiry,
          wastage_anomaly: {
            wastage_cost: wastageCost,
            revenue,
            ratio: wastageRatio,
            flagged: wastageRatio > 0.05,
          },
          inventory_turnover: turnover,
          sales_forecast: {
            avg_daily_revenue: Number(forecast.avg_daily),
            forecast_next_7d: Number(forecast.avg_daily) * 7,
            weekly,
          },
          promo_effectiveness: promoEff,
        },
      });
    } catch (err) {
      console.error("DSS KNOWLEDGE ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ─── WISDOM TIER: prescriptive recommendations ───────────────────────
router.get(
  "/owner/dss/wisdom",
  requireAuth,
  requirePermission("dss_prescriptive_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
      const forceRefresh = ['1', 'true', 'yes'].includes(String(req.query.force || '').toLowerCase());
      const result = await buildRecommendations(barId, forceRefresh);
      return res.json({ success: true, tier: "wisdom", ...result });
    } catch (err) {
      console.error("DSS WISDOM ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
