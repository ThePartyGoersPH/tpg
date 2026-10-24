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
    multipleStatements: true,
  });
}

async function ensureMigrationTable(conn) {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      file_name VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_schema_migrations_file_name (file_name)
    )`
  );
}

function loadMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function loadAppliedMigrations(conn) {
  const [rows] = await conn.query('SELECT file_name, checksum, applied_at FROM schema_migrations ORDER BY id ASC');
  const map = new Map();
  for (const row of rows) map.set(row.file_name, row);
  return map;
}

function parseMysqlMajorVersion(versionText) {
  const raw = String(versionText || '');
  const major = Number.parseInt(raw.split('.')[0], 10);
  return Number.isFinite(major) ? major : null;
}

async function run() {
  const conn = await createConnection();
  let appliedCount = 0;
  let skippedCount = 0;

  try {
    const [[versionRow]] = await conn.query('SELECT VERSION() AS version');
    const version = versionRow?.version || 'unknown';
    const major = parseMysqlMajorVersion(version);

    console.log(`[migrate] Connected. MySQL version: ${version}`);
    if (major !== null && major < 8) {
      console.warn('[migrate] WARNING: MySQL < 8 detected. Some migrations using IF NOT EXISTS may fail.');
    }

    await ensureMigrationTable(conn);

    const files = loadMigrationFiles();
    const appliedMap = await loadAppliedMigrations(conn);

    for (const fileName of files) {
      const filePath = path.join(MIGRATIONS_DIR, fileName);
      const sql = fs.readFileSync(filePath, 'utf8').trim();

      if (!sql) {
        console.log(`[migrate] SKIP ${fileName} (empty file)`);
        skippedCount += 1;
        continue;
      }

      const checksum = checksumOf(sql);
      const applied = appliedMap.get(fileName);

      if (applied) {
        if (applied.checksum !== checksum) {
          throw new Error(
            `Checksum mismatch for already-applied migration ${fileName}. ` +
              'Create a new migration file instead of editing an applied one.'
          );
        }

        console.log(`[migrate] SKIP ${fileName} (already applied at ${applied.applied_at})`);
        skippedCount += 1;
        continue;
      }

      console.log(`[migrate] APPLY ${fileName}`);
      await conn.beginTransaction();
      try {
        await conn.query(sql);
        await conn.query(
          'INSERT INTO schema_migrations (file_name, checksum) VALUES (?, ?)',
          [fileName, checksum]
        );
        await conn.commit();
        appliedCount += 1;
      } catch (err) {
        await conn.rollback();
        throw new Error(`Migration failed for ${fileName}: ${err.message}`);
      }
    }

    console.log(`[migrate] Done. Applied: ${appliedCount}, Skipped: ${skippedCount}`);
    process.exitCode = 0;
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error(`[migrate] ERROR: ${err.message}`);
  process.exitCode = 1;
});
