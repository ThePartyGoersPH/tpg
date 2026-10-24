require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../config/database");

async function main() {
  const email = "tpgsuperadmin@gmail.com";
  const tempPassword = "TpgSuper@12345";

  const hashed = await bcrypt.hash(tempPassword, 10);

  const [roleRows] = await pool.query(
    "SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1"
  );

  if (!roleRows.length) {
    throw new Error("SUPER_ADMIN role not found in roles table");
  }

  const roleId = roleRows[0].id;

  const [exists] = await pool.query(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  if (exists.length) {
    await pool.query(
      `UPDATE users
       SET first_name = ?,
           last_name = ?,
           password = ?,
           role = ?,
           role_id = ?,
           is_active = 1,
           updated_at = NOW()
       WHERE id = ?`,
      ["TPG", "Super Admin", hashed, "super_admin", roleId, exists[0].id]
    );
    console.log(`UPDATED_USER_ID=${exists[0].id}`);
  } else {
    const [ins] = await pool.query(
      `INSERT INTO users
       (first_name, last_name, email, password, role, role_id, is_active, bar_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NOW(), NOW())`,
      ["TPG", "Super Admin", email, hashed, "super_admin", roleId]
    );
    console.log(`CREATED_USER_ID=${ins.insertId}`);
  }

  console.log(`EMAIL=${email}`);
  console.log(`TEMP_PASSWORD=${tempPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
