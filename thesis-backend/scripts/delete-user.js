// Delete ONE customer account and everything referencing it.
//
//   node scripts/delete-user.js thepartygoersph@gmail.com            # DRY-RUN (default)
//   node scripts/delete-user.js thepartygoersph@gmail.com --confirm # actually delete
//
// Safety rails (all enforced before anything is touched):
// - DRY-RUN is the default: prints exactly what WOULD be deleted, per table.
// - Only thepartygoersph@gmail.com can be deleted; any other address aborts.
// - Admins / super admins / bar owners are never deleted, even that address
//   would be refused if it ever held such a role.
// - Real deletion requires --confirm, runs inside one transaction, and
//   enumerates referencing tables live from INFORMATION_SCHEMA so nothing is
//   missed when the schema evolves.
// - Engine check: this project runs MySQL (mysql2). Postgres/MongoDB are
//   detected and refused with a clear message instead of guessing.
//
// Back up first on the server, e.g.:
//   mysqldump -u <user> -p --single-transaction --routines --triggers \
//     --events <db> | gzip > /var/backups/tpg/pre-delete-<date>.sql.gz

require("dotenv").config();

const ALLOWED_EMAIL = "thepartygoersph@gmail.com";
const PROTECTED_ROLE_PATTERNS = ["super_admin", "superadmin", "admin", "bar_owner", "owner"];

function detectEngine() {
  try {
    require.resolve("mysql2/promise");
    return "mysql";
  } catch (_) {
    // fall through
  }
  try {
    require.resolve("pg");
    return "postgres";
  } catch (_) {}
  try {
    require.resolve("mongoose");
    return "mongodb";
  } catch (_) {}
  return "unknown";
}

function usage(exitCode) {
  console.error("Usage: node scripts/delete-user.js <email> [--confirm]");
  console.error("  No flags  -> DRY-RUN: print what would be deleted, change nothing.");
  console.error("  --confirm -> delete inside one transaction after the safety checks.");
  process.exitCode = exitCode == null ? 2 : exitCode;
}

async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  const emailArg = args.find((a) => !a.startsWith("--"));
  const confirm = args.includes("--confirm");

  if (!emailArg || args.includes("--help") || args.includes("-h")) usage(2);
  if (!emailArg) return;

  const engine = detectEngine();
  if (engine !== "mysql") {
    console.error(`Refusing: detected engine is '${engine}', but this script only supports the project's MySQL schema.`);
    process.exitCode = 2;
    return;
  }

  const email = String(emailArg).trim().toLowerCase();
  if (email !== ALLOWED_EMAIL) {
    console.error(`Refusing: only ${ALLOWED_EMAIL} may be deleted with this script. Got '${emailArg}'.`);
    process.exitCode = 2;
    return;
  }

  const pool = require("../config/database");
  try {
    const [[user]] = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_verified, u.is_active,
              r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.email = ? LIMIT 1`,
      [email]
    );
    if (!user) {
      console.log(`No user row for ${email} — nothing to delete.`);
      return;
    }

    const roleText = `${user.role || ""} ${user.role_name || ""}`.toLowerCase();
    if (PROTECTED_ROLE_PATTERNS.some((p) => roleText.includes(p))) {
      console.error(
        `Refusing: ${email} holds a protected role ('${user.role || user.role_name}'). ` +
          "Admins/super admins/bar owners are never deleted by this script."
      );
      process.exitCode = 2;
      return;
    }

    const userId = user.id;
    console.log(`Target: #${userId} ${user.email} (${user.first_name || ""} ${user.last_name || ""}) role=${user.role || user.role_name || "?"}`);

    // Every table with a foreign key pointing at users(id), discovered live.
    const [fkRows] = await pool.query(
      `SELECT DISTINCT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND REFERENCED_TABLE_NAME = 'users'
         AND REFERENCED_COLUMN_NAME = 'id'
       ORDER BY TABLE_NAME, COLUMN_NAME`
    );

    const plan = [];
    for (const fk of fkRows) {
      const [[row]] = await pool.query(
        `SELECT COUNT(*) AS c FROM \`${fk.table_name}\` WHERE \`${fk.column_name}\` = ?`,
        [userId]
      );
      plan.push({ table: fk.table_name, column: fk.column_name, count: Number(row?.c || 0) });
    }
    plan.push({ table: "users", column: "id", count: 1 });

    console.log(confirm ? "PLAN (executing with --confirm):" : "DRY-RUN plan (nothing will change):");
    for (const step of plan) {
      console.log(` - ${step.table}.${step.column}: ${step.count} row(s)`);
    }
    const total = plan.reduce((n, s) => n + s.count, 0);
    console.log(`Total rows affected: ${total}`);

    if (!confirm) {
      console.log("Re-run with --confirm to actually delete (back up the DB first).");
      return;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // FK checks off inside the transaction: the enumeration above already
      // covers every referencing table, so this only removes ordering risk
      // between sibling tables (e.g. replies pointing at comments).
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const step of plan) {
        if (!step.count) continue;
        if (step.table === "users") {
          await conn.query("DELETE FROM users WHERE id = ?", [userId]);
        } else {
          await conn.query(`DELETE FROM \`${step.table}\` WHERE \`${step.column}\` = ?`, [userId]);
        }
      }
      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
      await conn.commit();
      console.log(`Deleted ${email} and ${total - 1} referencing row(s).`);
    } catch (err) {
      try {
        await conn.query("SET FOREIGN_KEY_CHECKS = 1");
        await conn.rollback();
      } catch (_) {}
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
