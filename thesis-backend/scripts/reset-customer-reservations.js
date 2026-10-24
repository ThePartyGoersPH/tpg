// Reset a customer's booking history (dev/test helper).
// Deletes the user's reservations (+ dependent table/item rows and the
// reservation notifications tied to them) so the customer Reservations page
// (/reservations) and admin lookups return to their empty states.
//
// Safety:
//  - Dry run by default; pass --yes to execute.
//  - Aborts if live payment_transactions still reference these reservations
//    (run scripts/reset-customer-payments.js first), so financial records
//    are never orphaned silently. Override with --include-payments, which
//    also deletes those payment rows + their line items (payout rows are
//    NEVER touched by this script).
//  - Booking rows themselves (reservations, reservation_tables,
//    reservation_items, scoped notifications) are removed.
//
// Usage:
//   node scripts/reset-customer-reservations.js <email|userId> [--yes] [--include-payments]

const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const EXECUTE = args.includes('--yes');
const INCLUDE_PAYMENTS = args.includes('--include-payments');

if (!target) {
  console.error('Usage: node scripts/reset-customer-reservations.js <email|userId> [--yes] [--include-payments]');
  process.exit(1);
}

(async () => {
  const c = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'tpg', multipleStatements: true });
  try {
    const isId = /^\d+$/.test(target);
    const [[user]] = await c.query(
      `SELECT id, email, first_name, last_name, role FROM users WHERE ${isId ? 'id = ?' : 'email = ?'} LIMIT 1`,
      [isId ? Number(target) : target]
    );
    if (!user) {
      console.error(`User not found: ${target}`);
      process.exit(1);
    }
    console.log(`User: #${user.id} ${user.email} (${user.first_name} ${user.last_name}, ${user.role})`);

    const [reservations] = await c.query(
      'SELECT id, bar_id, reservation_date, status, payment_status FROM reservations WHERE customer_user_id = ? ORDER BY id',
      [user.id]
    );
    const resIds = reservations.map((r) => r.id);
    console.log(`reservations: ${resIds.length}`, resIds.length ? `[${resIds.join(',')}]` : '');

    let tableCount = 0;
    let itemCount = 0;
    let notifCount = 0;
    if (resIds.length) {
      const inList = resIds.join(',');
      const [[t]] = await c.query(`SELECT COUNT(*) c FROM reservation_tables WHERE reservation_id IN (${inList})`);
      const [[i]] = await c.query(`SELECT COUNT(*) c FROM reservation_items WHERE reservation_id IN (${inList})`);
      const [[n]] = await c.query(`SELECT COUNT(*) c FROM notifications WHERE reference_type = 'reservation' AND reference_id IN (${inList})`);
      tableCount = Number(t.c);
      itemCount = Number(i.c);
      notifCount = Number(n.c);
    }
    console.log(`reservation_tables: ${tableCount} | reservation_items: ${itemCount} | notifications: ${notifCount}`);

    // Live payments still pointing at these reservations?
    let payIds = [];
    if (resIds.length) {
      const [pays] = await c.query(
        `SELECT id, reference_id, status FROM payment_transactions WHERE payment_type = 'reservation' AND related_id IN (${resIds.join(',')})`
      );
      payIds = pays.map((p) => p.id);
      if (payIds.length) {
        console.log(`payment_transactions referencing: [${payIds.join(',')}]`);
        if (!INCLUDE_PAYMENTS) {
          console.error('ABORT: run scripts/reset-customer-payments.js first, or re-run with --include-payments.');
          process.exit(1);
        }
      }
    }

    if (!resIds.length) {
      console.log('Nothing to delete — booking history already empty.');
      return;
    }

    if (!EXECUTE) {
      console.log('DRY RUN — re-run with --yes to execute.');
      return;
    }

    const inList = resIds.join(',');
    await c.query('SET FOREIGN_KEY_CHECKS=0');
    if (payIds.length && INCLUDE_PAYMENTS) {
      await c.query(`DELETE FROM payment_line_items WHERE payment_transaction_id IN (${payIds.join(',')})`);
      await c.query(`DELETE FROM payment_transactions WHERE id IN (${payIds.join(',')})`);
      console.log(`Deleted ${payIds.length} payment_transactions (+ line items).`);
    }
    if (tableCount) await c.query(`DELETE FROM reservation_tables WHERE reservation_id IN (${inList})`);
    if (itemCount) await c.query(`DELETE FROM reservation_items WHERE reservation_id IN (${inList})`);
    if (notifCount) await c.query(`DELETE FROM notifications WHERE reference_type = 'reservation' AND reference_id IN (${inList})`);
    const [del] = await c.query('DELETE FROM reservations WHERE customer_user_id = ?', [user.id]);
    await c.query('SET FOREIGN_KEY_CHECKS=1');

    console.log(`Deleted ${del.affectedRows} reservations, ${tableCount} table links, ${itemCount} items, ${notifCount} notifications.`);
    const [[left]] = await c.query('SELECT COUNT(*) c FROM reservations WHERE customer_user_id = ?', [user.id]);
    console.log(`Remaining bookings for user #${user.id}: ${left.c}`);
    console.log('RESET OK');
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('RESET ERROR:', e.message); process.exit(1); });
