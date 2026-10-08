const pool = require('./config/database');

(async () => {
  try {
    console.log('Testing dashboard summary queries...\n');
    
    // Test with bar_id 11 (adjust if needed)
    const barId = 11;
    
    console.log('1. Testing low stock query:');
    const [lowStockRows] = await pool.query(
      `SELECT id, name, stock_qty, reorder_level, unit,
              CASE
                WHEN COALESCE(stock_qty, 0) <= 0 THEN 'critical'
                WHEN COALESCE(stock_qty, 0) < COALESCE(reorder_level, 0) THEN 'low'
                ELSE 'normal'
              END AS stock_status
       FROM inventory_items
       WHERE bar_id = ? AND is_active = 1
         AND (COALESCE(stock_qty, 0) < COALESCE(reorder_level, 0))
       ORDER BY 
         CASE
           WHEN COALESCE(stock_qty, 0) <= 0 THEN 1
           ELSE 2
         END,
         stock_qty ASC
       LIMIT 10`,
      [barId]
    );
    console.log('Low stock items:', lowStockRows);
    
    console.log('\n2. Testing reservations today:');
    const [reservationsTodayRows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM reservations
       WHERE bar_id = ? AND reservation_date = CURDATE()`,
      [barId]
    );
    console.log('Reservations today:', reservationsTodayRows[0]);
    
    console.log('\n3. Testing today revenue:');
    const [todayRevenueRows] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS revenue,
              COUNT(*) AS orders
       FROM pos_orders
       WHERE bar_id = ?
         AND status = 'completed'
         AND DATE(COALESCE(completed_at, created_at)) = CURDATE()`,
      [barId]
    );
    console.log('Today revenue:', todayRevenueRows[0]);
    
    console.log('\n4. Testing upcoming events:');
    const [upcomingEventsRows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM bar_events
       WHERE bar_id = ? AND archived_at IS NULL AND status = 'active' AND event_date >= CURDATE()`,
      [barId]
    );
    console.log('Upcoming events:', upcomingEventsRows[0]);
    
    console.log('\n5. Testing top menu items:');
    const [topMenuRows] = await pool.query(
      `SELECT m.id, m.menu_name,
              COALESCE(SUM(poi.quantity), 0) AS total_sold
       FROM menu_items m
       LEFT JOIN pos_order_items poi ON poi.menu_item_id = m.id
       LEFT JOIN pos_orders po ON po.id = poi.order_id AND po.status = 'completed'
       WHERE m.bar_id = ?
       GROUP BY m.id, m.menu_name
       ORDER BY total_sold DESC, m.menu_name ASC
       LIMIT 5`,
      [barId]
    );
    console.log('Top menu items:', topMenuRows);
    
    console.log('\n✅ All queries executed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
