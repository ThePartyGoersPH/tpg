require('dotenv').config();

const mysql = require('mysql2/promise');

const SHOULD_EXECUTE = process.argv.includes('--execute');
const WIPE_ALL_USERS = process.argv.includes('--wipe-all-users');

const PRESERVE_TABLES = new Set([
  'migrations',
  'knex_migrations',
  'knex_migrations_lock',
  'users',
  'roles',
  'user_roles',
  'permissions',
  'role_permissions',
  'permission_groups',
  'subscription_plans',
  'sss_contribution_table',
  'philhealth_contribution_table',
  'bir_tax_brackets',
  'leave_types',
  'system_settings',
  'app_settings',
  'platform_settings',
]);

const ADMIN_ROLES = ['admin', 'super_admin'];

function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function summarizeRoleCounts(rows) {
  const data = Array.isArray(rows) ? rows : [];
  return data.map((row) => ({
    role: String(row.role || '').toLowerCase(),
    total: Number(row.total || 0),
  }));
}

async function getTableNames(conn) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME ASC`
  );

  return rows.map((row) => row.TABLE_NAME).filter(Boolean);
}

async function countRows(conn, tableName) {
  const [rows] = await conn.query(`SELECT COUNT(1) AS c FROM \`${tableName}\``);
  return Number(rows[0]?.c || 0);
}

async function getRoleCounts(conn) {
  const [rows] = await conn.query(
    `SELECT LOWER(COALESCE(role, '')) AS role, COUNT(1) AS total
     FROM users
     GROUP BY LOWER(COALESCE(role, ''))
     ORDER BY role ASC`
  );
  return summarizeRoleCounts(rows);
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
    const allTables = await getTableNames(conn);

    const tablesToClear = allTables.filter((table) => !PRESERVE_TABLES.has(table));
    const beforeRoleCounts = await getRoleCounts(conn);

    const nonEmptyTableCounts = [];
    for (const table of tablesToClear) {
      const count = await countRows(conn, table);
      if (count > 0) {
        nonEmptyTableCounts.push({ table, count });
      }
    }

    const userDeleteWhere = WIPE_ALL_USERS
      ? '1=1'
      : `LOWER(COALESCE(role, '')) NOT IN (${ADMIN_ROLES.map(quote).join(', ')})`;

    const [[targetUserCountRow]] = await conn.query(
      `SELECT COUNT(1) AS c FROM users WHERE ${userDeleteWhere}`
    );
    const targetUserCount = Number(targetUserCountRow?.c || 0);

    console.log('--- HARD RESET PREVIEW ---');
    console.log('Mode:', SHOULD_EXECUTE ? 'EXECUTE' : 'DRY-RUN');
    console.log('Wipe all users:', WIPE_ALL_USERS ? 'YES' : 'NO (keeps admin + super_admin)');
    console.log('Preserved tables:', JSON.stringify(Array.from(PRESERVE_TABLES)));
    console.log('Users by role BEFORE:', JSON.stringify(beforeRoleCounts));
    console.log('User accounts targeted for deletion:', targetUserCount);
    console.log('Tables targeted for full clear:', tablesToClear.length);

    if (nonEmptyTableCounts.length) {
      console.log('Non-empty tables to clear:');
      for (const item of nonEmptyTableCounts) {
        console.log(`  ${item.table}: ${item.count}`);
      }
    } else {
      console.log('All targeted tables are already empty.');
    }

    if (!SHOULD_EXECUTE) {
      console.log('Dry-run complete. Re-run with --execute to apply hard reset.');
      return;
    }

    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS=0');

    for (const table of tablesToClear) {
      await conn.query(`DELETE FROM \`${table}\``);
    }

    await conn.query(`DELETE FROM users WHERE ${userDeleteWhere}`);

    await conn.query('SET FOREIGN_KEY_CHECKS=1');
    await conn.commit();

    const afterRoleCounts = await getRoleCounts(conn);

    console.log('--- HARD RESET APPLIED ---');
    console.log('Users by role AFTER:', JSON.stringify(afterRoleCounts));

    const keyTables = ['bars', 'bar_owners', 'bar_events', 'bar_posts', 'event_comments', 'bar_post_comments', 'reservations'];
    for (const table of keyTables) {
      if (!allTables.includes(table)) continue;
      const count = await countRows(conn, table);
      console.log(`${table}: ${count}`);
    }
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
  console.error('PRESENTATION_HARD_RESET_ERROR:', err.message || err);
  process.exit(1);
});
