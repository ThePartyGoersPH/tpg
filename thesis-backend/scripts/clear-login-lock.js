// Manual escape hatch for the login lockout ladder.
//
// Usage (on the server, inside thesis-backend/):
//   node scripts/clear-login-lock.js --email=user@example.com [--app=customer]
//   node scripts/clear-login-lock.js --email=user@example.com --ip=1.2.3.4
//   node scripts/clear-login-lock.js --ip=1.2.3.4        # clear an IP cooldown
//
// Prints only counts and the identifier scope — never tokens or passwords —
// and records an ACCOUNT_UNLOCKED audit entry when a real user row exists.
//
// NOTE: this is the documented way to release a super-admin lockout early;
// super-admin accounts are never exempt from locking in the first place.

require("dotenv").config();
const pool = require("../config/database");

function arg(name) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  const eq = hit.indexOf("=");
  return eq === -1 ? "" : hit.slice(eq + 1);
}

async function main() {
  const email = String(arg("email") || "").trim().toLowerCase();
  const app = String(arg("app") || "").trim().toLowerCase();
  const ip = String(arg("ip") || "").trim().slice(0, 45);

  if (!email && !ip) {
    console.error("Usage: node scripts/clear-login-lock.js --email=<addr> [--app=<portal>] [--ip=<addr>]");
    console.error("   or: node scripts/clear-login-lock.js --ip=<addr>");
    process.exitCode = 2;
    return;
  }

  const clauses = [];
  const params = [];
  if (email) {
    clauses.push("identifier = ?");
    params.push(email);
  } else {
    clauses.push("identifier = 'ip'");
  }
  if (app) {
    clauses.push("app = ?");
    params.push(app);
  }
  if (ip) {
    clauses.push("ip = ?");
    params.push(ip);
  }

  const [rows] = await pool.query(
    `SELECT id, identifier, app, ip, failed_count, lock_level, locked_until
     FROM login_attempts WHERE ${clauses.join(" AND ")}`,
    params
  );

  if (!rows.length) {
    console.log("No lockout rows matched — nothing to clear.");
    await pool.end();
    return;
  }

  const ids = rows.map((r) => r.id);
  await pool.query(`DELETE FROM login_attempts WHERE id IN (${ids.map(() => "?").join(",")})`, ids);

  // Audit the manual release against the real user when there is one.
  try {
    if (email) {
      const [[user]] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
      if (user) {
        await pool.query(
          `INSERT INTO platform_audit_logs
           (actor_user_id, action, entity, entity_id, target_bar_id, details, ip_address, user_agent)
           VALUES (?, 'ACCOUNT_UNLOCKED', 'user', ?, NULL, ?, NULL, 'clear-login-lock script')`,
          [user.id, user.id, JSON.stringify({ email, cleared_rows: rows.length })]
        );
      }
    }
  } catch (_) {
    // Audit must never fail the unlock itself.
  }

  const locked = rows.filter((r) => r.locked_until && new Date(r.locked_until).getTime() > Date.now()).length;
  console.log(`Cleared ${rows.length} lockout row(s) (${locked} currently locked).`);
  for (const r of rows) {
    console.log(` - ${r.identifier} [${r.app || "-"}] fails=${r.failed_count} level=${r.lock_level}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exitCode = 1;
});
