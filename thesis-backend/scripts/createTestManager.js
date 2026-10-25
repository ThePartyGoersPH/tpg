#!/usr/bin/env node
// One-off seed: create (or reset) a TEST manager account for verifying the
// Manager portal login flow. Follows scripts/create_super_admin_custom.js:
// argv-driven, no credentials hardcoded in source.
//
// Usage:
//   node scripts/createTestManager.js [email] [password] [bar_id]
//
//   email    - defaults to test.manager@tpg.test
//   password - omitted => generated randomly and printed ONCE here
//   bar_id   - defaults to 65 (Pegazus, active); use 0 for no bar link
//
// The account is always left in the exact state the backend login gates
// expect: role/role_id = manager/MANAGER, is_active=1, is_verified=1,
// status='active', approval_status='approved'.

require("dotenv").config();
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../config/database");

const DEFAULT_EMAIL = "test.manager@tpg.test";
const DEFAULT_BAR_ID = 65;

function randomPassword() {
  // 20 chars, shell/URL-safe, satisfies any complexity check the UI applies
  return crypto.randomBytes(15).toString("base64url");
}

async function main() {
  const email = String(process.argv[2] || DEFAULT_EMAIL).trim().toLowerCase();
  const password = process.argv[3] || randomPassword();
  const barIdRaw = process.argv[4];
  const barId =
    barIdRaw === undefined ? DEFAULT_BAR_ID : Number(barIdRaw) === 0 ? null : Number(barIdRaw);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Invalid email: ${email}`);
  }
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const [roleRows] = await pool.query(
    "SELECT id FROM roles WHERE name = 'MANAGER' LIMIT 1"
  );
  if (!roleRows.length) {
    throw new Error("MANAGER role not found in roles table");
  }
  const roleId = roleRows[0].id;

  if (barId !== null) {
    if (!Number.isFinite(barId)) throw new Error(`Invalid bar_id: ${barIdRaw}`);
    const [barRows] = await pool.query(
      "SELECT id FROM bars WHERE id = ? AND status = 'active' LIMIT 1",
      [barId]
    );
    if (!barRows.length) {
      throw new Error(`bar_id ${barId} does not exist or is not active`);
    }
  }

  const hashed = await bcrypt.hash(password, 10);

  const [exists] = await pool.query(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email]
  );

  let userId;
  if (exists.length) {
    userId = exists[0].id;
    await pool.query(
      `UPDATE users
       SET first_name = ?,
           last_name = ?,
           password = ?,
           role = 'manager',
           role_id = ?,
           bar_id = ?,
           is_active = 1,
           is_verified = 1,
           is_banned = 0,
           status = 'active',
           approval_status = 'approved',
           updated_at = NOW()
       WHERE id = ?`,
      ["Test", "Manager", hashed, roleId, barId, userId]
    );
    console.log(`UPDATED_USER_ID=${userId}`);
  } else {
    const [ins] = await pool.query(
      `INSERT INTO users
       (first_name, last_name, email, password, role, role_id, bar_id,
        is_active, is_verified, status, approval_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'manager', ?, ?, 1, 1, 'active', 'approved', NOW(), NOW())`,
      ["Test", "Manager", email, hashed, roleId, barId]
    );
    userId = ins.insertId;
    console.log(`CREATED_USER_ID=${userId}`);
  }

  // Clear any stale lockout so the account can be exercised immediately.
  await pool.query(
    "DELETE FROM login_attempts WHERE identifier = ? AND app = '' AND ip = ''",
    [email]
  );

  console.log(`EMAIL=${email}`);
  if (!process.argv[3]) {
    console.log(`PASSWORD=${password}  (printed once — not stored in source)`);
  } else {
    console.log("PASSWORD=(the value you passed)");
  }
  console.log(`BAR_ID=${barId === null ? "none" : barId}`);
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
