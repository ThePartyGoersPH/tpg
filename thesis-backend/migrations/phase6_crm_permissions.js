// Phase 6 — Seed CRM permission codes and grant to operational roles
// Run: node migrations/phase6_crm_permissions.js
// Idempotent: INSERT IGNORE for permission rows + role_permissions.

const mysql = require('mysql2/promise');
const DB = { host: 'localhost', user: 'root', password: '', database: 'tpg' };

const PERMISSIONS = [
  { code: 'crm_view', module: 'crm', action: 'view', description: 'View CRM / customer insights' },
  { code: 'crm_manage', module: 'crm', action: 'manage', description: 'Manage CRM records' },
];

// ADMIN, BAR_OWNER, MANAGER, EXECUTIVE, OPERATIONS
const ROLES = [1, 7, 9, 10, 15];

(async () => {
  const conn = await mysql.createConnection(DB);
  try {
    for (const p of PERMISSIONS) {
      await conn.query(
        `INSERT IGNORE INTO permissions (name, module, action, description, created_at) VALUES (?, ?, ?, ?, NOW())`,
        [p.code, p.module, p.action, p.description]
      );
    }
    const [rows] = await conn.query(`SELECT id, name FROM permissions WHERE name IN (?)`, [PERMISSIONS.map((p) => p.code)]);
    const permIdByName = {};
    rows.forEach((r) => { permIdByName[r.name] = r.id; });

    for (const roleId of ROLES) {
      for (const p of PERMISSIONS) {
        await conn.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [roleId, permIdByName[p.code]]);
      }
    }
    console.log('Phase 6 CRM permissions seeded.');
    const [grants] = await conn.query(
      `SELECT r.name AS role_name, p.name AS permission FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
       WHERE p.name IN (?) ORDER BY r.id, p.name`,
      [PERMISSIONS.map((p) => p.code)]
    );
    grants.forEach((g) => console.log(`  ${g.role_name} -> ${g.permission}`));
    console.log('DONE');
  } catch (e) {
    console.error('MIGRATION ERROR:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
    process.exit(0);
  }
})();
