require('dotenv').config();

const mysql = require('mysql2/promise');

const SHOULD_EXECUTE = process.argv.includes('--execute');
const TARGET_ROLES = ['customer', 'staff', 'employee', 'bar_owner'];

function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildRoleWhereClause(columnName = 'role') {
  const inList = TARGET_ROLES.map(quote).join(', ');
  return `LOWER(COALESCE(${columnName}, '')) IN (${inList})`;
}

const TARGET_ROLE_WHERE = buildRoleWhereClause('role');
const TARGET_USER_WHERE = `user_id IN (SELECT id FROM users WHERE ${TARGET_ROLE_WHERE})`;

const TABLES_TO_CLEAR = [
  'mobile_notification_push_log',
  'mobile_push_tokens',
  'webhook_events',
  'payment_line_items',
  'payment_transactions',
  'paymongo_webhook_logs',
  'payroll_deduction_items',
  'payroll_items',
  'payroll_runs',
  'attendance_logs',
  'leave_requests',
  'employee_documents',
  'reservation_reviews',
  'reservation_items',
  'reservation_tables',
  'reservations',
  'event_comment_replies',
  'event_comments',
  'event_likes',
  'bar_comment_replies',
  'bar_post_comments',
  'bar_post_likes',
  'comment_reports',
  'notifications',
  'bar_followers',
  'customer_bar_bans',
  'post_reactions',
  'comment_reactions',
  'reply_reactions',
  'bar_events_archive',
  'bar_events',
  'bar_posts',
];

const ROLE_RELATED_TABLE_DELETES = [
  { table: 'user_permissions', where: TARGET_USER_WHERE },
  { table: 'employee_profiles', where: TARGET_USER_WHERE },
  { table: 'employee_deduction_settings', where: TARGET_USER_WHERE },
  { table: 'social_accounts', where: TARGET_USER_WHERE },
  { table: 'otp_verifications', where: TARGET_USER_WHERE },
  { table: 'bar_owners', where: TARGET_USER_WHERE },
];

async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName]
  );
  return rows.length > 0;
}

async function countRows(conn, tableName) {
  const [rows] = await conn.query(`SELECT COUNT(1) AS c FROM \`${tableName}\``);
  return Number(rows[0]?.c || 0);
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const [beforeUserRows] = await conn.query(
      `SELECT LOWER(COALESCE(role, '')) AS role, COUNT(1) AS total
       FROM users
       GROUP BY LOWER(COALESCE(role, ''))
       ORDER BY role ASC`
    );

    const existingTables = [];
    const beforeCounts = {};

    for (const table of TABLES_TO_CLEAR) {
      if (!(await tableExists(conn, table))) continue;
      existingTables.push(table);
      beforeCounts[table] = await countRows(conn, table);
    }

    let targetUserCount = 0;
    if (await tableExists(conn, 'users')) {
      const [targetUserRows] = await conn.query(
        `SELECT COUNT(1) AS c FROM users WHERE ${TARGET_ROLE_WHERE}`
      );
      targetUserCount = Number(targetUserRows[0]?.c || 0);
    }

    console.log('--- PRESENTATION CLEANUP PREVIEW ---');
    console.log('Mode:', SHOULD_EXECUTE ? 'EXECUTE' : 'DRY-RUN');
    console.log('Target roles:', TARGET_ROLES.join(', '));
    console.log('Users by role BEFORE:', JSON.stringify(beforeUserRows));
    console.log('Target accounts BEFORE:', targetUserCount);
    console.log('Tables to clear (existing):', existingTables.length);

    for (const table of existingTables) {
      console.log(`  ${table}: ${beforeCounts[table]}`);
    }

    if (!SHOULD_EXECUTE) {
      console.log('Dry-run complete. Re-run with --execute to apply cleanup.');
      return;
    }

    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS=0');

    for (const table of existingTables) {
      await conn.query(`DELETE FROM \`${table}\``);
    }

    for (const op of ROLE_RELATED_TABLE_DELETES) {
      if (!(await tableExists(conn, op.table))) continue;
      await conn.query(`DELETE FROM \`${op.table}\` WHERE ${op.where}`);
    }

    await conn.query(
      `DELETE FROM users
       WHERE ${TARGET_ROLE_WHERE}`
    );

    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    await conn.commit();

    const [afterUserRows] = await conn.query(
      `SELECT LOWER(COALESCE(role, '')) AS role, COUNT(1) AS total
       FROM users
       GROUP BY LOWER(COALESCE(role, ''))
       ORDER BY role ASC`
    );

    console.log('--- CLEANUP APPLIED ---');
    console.log('Users by role AFTER:', JSON.stringify(afterUserRows));
  } catch (err) {
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS=1');
    } catch (_) {
      // no-op
    }
    try {
      await conn.rollback();
    } catch (_) {
      // no-op
    }
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('PRESENTATION_CLEANUP_ERROR:', err.message || err);
  process.exit(1);
});
