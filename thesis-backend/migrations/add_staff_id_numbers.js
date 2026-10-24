// Staff ID numbers: [year]-[6 digits] on every user, with a unique index.
// Backfills existing rows so every staff member has one.

const mysql = require('mysql2/promise');
const { generateStaffIdNumber, maskStaffIdNumber } = require('../utils/staffId');

const SQL = `
SET @c1 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='staff_id_number');
SET @s1 = IF(@c1=0, 'ALTER TABLE users ADD COLUMN staff_id_number VARCHAR(20) NULL AFTER staff_type', 'SELECT 1');
PREPARE p1 FROM @s1; EXECUTE p1; DEALLOCATE PREPARE p1;

SET @i1 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='uq_users_staff_id_number');
SET @s2 = IF(@i1=0, 'ALTER TABLE users ADD UNIQUE KEY uq_users_staff_id_number (staff_id_number)', 'SELECT 1');
PREPARE p2 FROM @s2; EXECUTE p2; DEALLOCATE PREPARE p2;
`;

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tpg', multipleStatements: true,
  });
  try {
    await conn.query(SQL);

    const [missing] = await conn.query(
      "SELECT id FROM users WHERE staff_id_number IS NULL OR staff_id_number = '' ORDER BY id"
    );
    for (const row of missing) {
      const generated = await generateStaffIdNumber(conn);
      await conn.query("UPDATE users SET staff_id_number = ? WHERE id = ?", [generated, row.id]);
    }

    const [total] = await conn.query("SELECT COUNT(*) AS n FROM users WHERE staff_id_number IS NOT NULL");
    const [sample] = await conn.query("SELECT staff_id_number FROM users WHERE staff_id_number IS NOT NULL ORDER BY id DESC LIMIT 3");
    const [col] = await conn.query("SHOW COLUMNS FROM users WHERE Field='staff_id_number'");
    console.log('users.staff_id_number:', col.length === 1);
    console.log('users with an ID number:', total[0].n);
    console.log('sample:', sample.map((r) => `${r.staff_id_number} -> ${maskStaffIdNumber(r.staff_id_number)}`).join(', '));
    console.log('STAFF ID NUMBER MIGRATION OK');
  } catch (err) { console.error('ERR', err.message); process.exit(1); }
  finally { await conn.end(); }
})();
