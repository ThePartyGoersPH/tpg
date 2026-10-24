// Reset a customer's payment history (dev/test helper).
// Deletes the user's payment_transactions (+ dependent line items) so the
// Payments page (/payments) returns to its empty state.
//
// Dependent records:
//  - payment_line_items      -> removed (CASCADE / explicit)
//  - payouts                 -> removed ONLY when orphaned (bar no longer
//                               exists) or when --include-payouts is passed;
//                               otherwise the script aborts and lists them.
//  - pos_orders / reservations / subscription_payments references
//                               -> auto-nulled by FK SET NULL rules; the
//                               booking/order rows themselves are KEPT.
//
// Usage:
//   node scripts/reset-customer-payments.js <email|userId> [--yes] [--include-payouts]
// Without --yes this is a dry run (prints what WOULD be deleted).

const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const EXECUTE = args.includes('--yes');
const INCLUDE_PAYOUTS = args.includes('--include-payouts');

if (!target) {
  console.error('Usage: node scripts/reset-customer-payments.js <email|userId> [--yes] [--include-payouts]');
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

    const [payments] = await c.query(
      'SELECT id, reference_id, payment_type, related_id, bar_id, amount, status FROM payment_transactions WHERE user_id = ? ORDER BY id',
      [user.id]
    );
    const payIds = payments.map((p) => p.id);
    console.log(`payment_transactions: ${payIds.length}`, payIds.length ? `[${payIds.join(',')}]` : '');
    const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    console.log(`total amount across history: ₱${total.toFixed(2)}`);

    let lineCount = 0;
    if (payIds.length) {
      const [[li]] = await c.query(
        `SELECT COUNT(*) c FROM payment_line_items WHERE payment_transaction_id IN (${payIds.join(',')})`
      );
      lineCount = Number(li.c);
    }
    console.log(`payment_line_items: ${lineCount}`);

    // Payouts referencing these payments
    let payouts = [];
    if (payIds.length) {
      const [rows] = await c.query(
        `SELECT p.id, p.bar_id, p.status, b.id AS bar_exists
         FROM payouts p LEFT JOIN bars b ON b.id = p.bar_id
         WHERE p.payment_transaction_id IN (${payIds.join(',')})`
      );
      payouts = rows;
    }
    const orphaned = payouts.filter((p) => !p.bar_exists);
    const live = payouts.filter((p) => p.bar_exists);
    console.log(`payouts: ${payouts.length} (orphaned bar gone: ${orphaned.length}, live bar: ${live.length})`);
    if (live.length && !INCLUDE_PAYOUTS) {
      console.error('ABORT: live-bar payouts reference this history: ' + live.map((p) => `#${p.id}(bar ${p.bar_id},${p.status})`).join(', '));
      console.error('Re-run with --include-payouts to remove them too (test resets only).');
      process.exit(1);
    }

    // Other FK references (auto-nulled by SET NULL rules; rows are kept)
    for (const t of ['pos_orders', 'reservations', 'subscription_payments']) {
      if (!payIds.length) break;
      try {
        const [r] = await c.query(
          `SELECT id FROM ${t} WHERE payment_transaction_id IN (${payIds.join(',')})`
        );
        if (r.length) console.log(`${t} rows referencing (kept, ref auto-nulled): [${r.map((x) => x.id).join(',')}]`);
      } catch (e) { console.log(`${t}: skipped (${e.message})`); }
    }

    if (!payIds.length) {
      console.log('Nothing to delete — history already empty.');
      return;
    }

    if (!EXECUTE) {
      console.log('DRY RUN — re-run with --yes to execute.');
      return;
    }

    await c.query('SET FOREIGN_KEY_CHECKS=0');
    if (lineCount) await c.query(`DELETE FROM payment_line_items WHERE payment_transaction_id IN (${payIds.join(',')})`);
    const payoutIds = (INCLUDE_PAYOUTS ? payouts : orphaned).map((p) => p.id);
    if (payoutIds.length) await c.query(`DELETE FROM payouts WHERE id IN (${payoutIds.join(',')})`);
    const [del] = await c.query('DELETE FROM payment_transactions WHERE user_id = ?', [user.id]);
    await c.query('SET FOREIGN_KEY_CHECKS=1');

    console.log(`Deleted ${del.affectedRows} payment_transactions, ${lineCount} line items, ${payoutIds.length} payouts.`);
    const [[left]] = await c.query('SELECT COUNT(*) c FROM payment_transactions WHERE user_id = ?', [user.id]);
    console.log(`Remaining history rows for user #${user.id}: ${left.c}`);
    console.log('RESET OK');
  } finally {
    await c.end();
  }
})().catch((e) => { console.error('RESET ERROR:', e.message); process.exit(1); });
