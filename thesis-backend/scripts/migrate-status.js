require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function checksumOf(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
}

function loadMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function hasSchemaMigrationsTable(conn) {
  const [rows] = await conn.query(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schema_migrations'
     LIMIT 1`
  );
  return rows.length > 0;
}

async function run() {
  const conn = await createConnection();
  try {
    const [[versionRow]] = await conn.query('SELECT VERSION() AS version');
    console.log(`[migrate:status] Connected. MySQL version: ${versionRow?.version || 'unknown'}`);

    const files = loadMigrationFiles();
    if (!files.length) {
      console.log('[migrate:status] No SQL migration files found.');
      return;
    }

    const hasTable = await hasSchemaMigrationsTable(conn);
    if (!hasTable) {
      console.log('[migrate:status] schema_migrations table does not exist yet.');
      console.log(`[migrate:status] Pending migrations: ${files.length}`);
      for (const fileName of files) {
        console.log(`- PENDING  ${fileName}`);
      }
      return;
    }

    const [appliedRows] = await conn.query(
      'SELECT file_name, checksum, applied_at FROM schema_migrations ORDER BY id ASC'
    );
    const appliedMap = new Map(appliedRows.map((row) => [row.file_name, row]));

    let appliedCount = 0;
    let pendingCount = 0;
    let driftCount = 0;

    for (const fileName of files) {
      const filePath = path.join(MIGRATIONS_DIR, fileName);
      const sql = fs.readFileSync(filePath, 'utf8').trim();
      const checksum = checksumOf(sql);
      const applied = appliedMap.get(fileName);

      if (!applied) {
        pendingCount += 1;
        console.log(`- PENDING  ${fileName}`);
        continue;
      }

      if (applied.checksum !== checksum) {
        driftCount += 1;
        console.log(`- DRIFT    ${fileName}`);
        continue;
      }

      appliedCount += 1;
      console.log(`- APPLIED  ${fileName} (${applied.applied_at})`);
    }

    console.log(
      `[migrate:status] Summary -> applied: ${appliedCount}, pending: ${pendingCount}, drift: ${driftCount}`
    );

    if (driftCount > 0) {
      process.exitCode = 2;
    }
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(`[migrate:status] ERROR: ${err.message}`);
  process.exitCode = 1;
});
