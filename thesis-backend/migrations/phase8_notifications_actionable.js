/**
 * Phase 8 — Make notifications actionable.
 *
 * Adds self-routing / categorization fields to the `notifications` table so the
 * frontend can route a click (navigate vs open a chat thread) without a second
 * resolver round-trip, and so notifications can be grouped by category.
 *
 * Safe to re-run: each column is only added if missing.
 */
const POOL = require("../config/database");

async function addColumnIfMissing(conn, column, definition) {
  const [rows] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = ?`,
    [column]
  );
  if (rows.length === 0) {
    await conn.query(`ALTER TABLE notifications ADD COLUMN ${column} ${definition}`);
    console.log(`notifications: added column ${column}`);
  } else {
    console.log(`notifications: column ${column} already exists (skipped)`);
  }
}

async function up() {
  const conn = await POOL.getConnection();
  try {
    await conn.query("START TRANSACTION");
    await addColumnIfMissing(conn, "category", "VARCHAR(40) NULL AFTER reference_type");
    await addColumnIfMissing(conn, "action", "VARCHAR(30) NULL DEFAULT 'navigate' AFTER category");
    await addColumnIfMissing(conn, "target_route", "VARCHAR(500) NULL AFTER action");
    await addColumnIfMissing(conn, "metadata", "JSON NULL AFTER target_route");
    await conn.query("COMMIT");
    console.log("Phase 8 migration completed.");
  } catch (err) {
    await conn.query("ROLLBACK");
    console.error("Phase 8 migration failed:", err);
    throw err;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  up()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { up };
