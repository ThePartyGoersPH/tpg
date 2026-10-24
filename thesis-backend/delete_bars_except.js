const mysql = require('mysql2/promise');

const BARS_TO_KEEP = ['Juan Bar', 'Pegazus'];

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tpg'
  });

  try {
    await conn.beginTransaction();

    const [allBars] = await conn.execute('SELECT id, name FROM bars ORDER BY id');
    console.log('All bars before deletion:');
    allBars.forEach(b => console.log(`  id=${b.id}  name="${b.name}"`));

    const keepIds = allBars.filter(b => BARS_TO_KEEP.includes(b.name)).map(b => b.id);
    const deleteIds = allBars.filter(b => !BARS_TO_KEEP.includes(b.name)).map(b => b.id);

    console.log(`\nKeeping: ${keepIds.map(id => allBars.find(b => b.id === id).name).join(', ')} (ids: ${keepIds})`);
    console.log(`Deleting: ${deleteIds.map(id => allBars.find(b => b.id === id).name).join(', ')} (ids: ${deleteIds})`);

    if (deleteIds.length === 0) {
      console.log('\nNothing to delete.');
      await conn.rollback();
      return;
    }

    const placeholders = deleteIds.map(() => '?').join(',');

    const childTables = [
      'attendance_logs', 'bar_amenities', 'bar_events', 'bar_events_archive',
      'bar_followers', 'bar_packages', 'bar_posts', 'bar_reviews',
      'bar_tables', 'bar_visits', 'customer_bar_bans', 'employee_documents',
      'employee_profiles', 'employee_schedules', 'inventory_items',
      'inventory_requests', 'leave_requests', 'menu_items', 'payouts',
      'payroll_settings', 'permit_expiry_notifications', 'pos_orders',
      'promotions', 'reservations', 'reviews'
    ];

    for (const table of childTables) {
      try {
        const [result] = await conn.execute(
          `DELETE FROM ${table} WHERE bar_id IN (${placeholders})`,
          deleteIds
        );
        if (result.affectedRows > 0) {
          console.log(`  ${table}: deleted ${result.affectedRows} rows`);
        }
      } catch (e) {
        if (e.code === 'ER_NO_SUCH_TABLE') {
          console.log(`  ${table}: skipped (table not found)`);
        } else if (e.errno === 1146) {
          console.log(`  ${table}: skipped (table not found)`);
        } else {
          throw e;
        }
      }
    }

    // Also clean platform_audit_logs (SET NULL, not CASCADE)
    try {
      await conn.execute(
        `UPDATE platform_audit_logs SET target_bar_id = NULL WHERE target_bar_id IN (${placeholders})`,
        deleteIds
      );
    } catch (e) {
      if (e.code !== 'ER_NO_SUCH_TABLE' && e.errno !== 1146) throw e;
    }

    const [result] = await conn.execute(
      `DELETE FROM bars WHERE id IN (${placeholders})`,
      deleteIds
    );
    console.log(`\nbars: deleted ${result.affectedRows} rows`);

    const [remaining] = await conn.execute('SELECT id, name FROM bars ORDER BY id');
    console.log('\nRemaining bars:');
    remaining.forEach(b => console.log(`  id=${b.id}  name="${b.name}"`));

    await conn.commit();
    console.log('\n✓ Transaction committed. All deletions successful.');
  } catch (err) {
    await conn.rollback();
    console.error('\n✗ Error — transaction rolled back:', err.message);
  } finally {
    await conn.end();
  }
})();
