require("dotenv").config();
const mysql = require("mysql2/promise");

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });

  const [rows] = await conn.query("SHOW COLUMNS FROM customer_bar_bans LIKE 'ban_reason'");
  if (!rows.length) {
    await conn.query("ALTER TABLE customer_bar_bans ADD COLUMN ban_reason VARCHAR(500) NULL AFTER customer_id");
    console.log("BAR_BAN_REASON_MIGRATION=APPLIED");
  } else {
    console.log("BAR_BAN_REASON_MIGRATION=SKIPPED_ALREADY_EXISTS");
  }

  await conn.end();
}

run().catch((err) => {
  console.error("BAR_BAN_REASON_MIGRATION_ERROR:", err.message || err);
  process.exit(1);
});
