/**
 * Phase 9 — Add QR Scan permission.
 *
 * Inserts the `qr_scan` permission into the `permissions` table so staff can
 * scan customer QR codes at the door for reservation check-in.
 *
 * Safe to re-run: permission is only inserted if it doesn't already exist.
 */
const POOL = require("../config/database");

async function up() {
  const conn = await POOL.getConnection();
  try {
    await conn.query("START TRANSACTION");

    // Check if qr_scan already exists
    const [existing] = await conn.query(
      "SELECT id FROM permissions WHERE name = 'qr_scan' LIMIT 1"
    );

    if (existing.length === 0) {
      await conn.query(
        `INSERT INTO permissions (name, module, action, description, created_at)
         VALUES ('qr_scan', 'qr_scan', 'scan', 'Scan customer QR codes to verify reservations and check guests in', NOW())`
      );
      console.log("Inserted permission: qr_scan");
    } else {
      console.log("Permission qr_scan already exists (skipped)");
    }

    await conn.query("COMMIT");
    console.log("Phase 9 migration completed.");
  } catch (err) {
    await conn.query("ROLLBACK");
    console.error("Phase 9 migration failed:", err);
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
