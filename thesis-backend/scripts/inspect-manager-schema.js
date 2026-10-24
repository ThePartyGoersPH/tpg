require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "tpg",
  });
  const [barColumns] = await db.query("SHOW COLUMNS FROM bars");
  const [roles] = await db.query("SELECT id, name FROM roles WHERE UPPER(name) IN ('MANAGER', 'BAR_OWNER')");
  console.log(JSON.stringify({
    barColumns: barColumns.map((column) => ({ field: column.Field, type: column.Type, required: column.Null === "NO", default: column.Default })),
    roles,
  }, null, 2));
  await db.end();
})().catch((error) => { console.error(error.message); process.exit(1); });
