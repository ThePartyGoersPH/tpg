// Phase 5 — Seed DSS/DIKW permission codes and grant to operational roles
// Run: node migrations/phase5_dss_permissions.js
// Idempotent: INSERT IGNORE for permission rows + role_permissions.

const mysql = require('mysql2/promise');

const DB = { host: 'localhost', user: 'root', password: '', database: 'tpg' };

const PERMISSIONS = [
  { code: 'analytics_bar_view', module: 'analytics', action: 'view', description: 'View bar analytics' },
  { code: 'dss_diagnostic_view', module: 'dss', action: 'diagnostic', description: 'DSS diagnostic (knowledge) view' },
  { code: 'dss_predictive_view', module: 'dss', action: 'predictive', description: 'DSS predictive (knowledge) view' },
  { code: 'dss_prescriptive_view', module: 'dss', action: 'prescriptive', description: 'DSS prescriptive (wisdom) view' },
];

// Roles that should receive DSS access (SUPER_ADMIN and BAR_OWNER bypass requirePermission,
// but granting keeps role_permissions consistent).
const ROLES = [1, 7, 9, 10, 11]; // ADMIN, BAR_OWNER, MANAGER, EXECUTIVE, FINANCE

(async () => {
  const conn = await mysql.createConnection(DB);
  try {
    for (const p of PERMISSIONS) {
      await conn.query(
        `INSERT IGNORE INTO permissions (name, module, action, description, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [p.code, p.module, p.action, p.description]
      );
    }

    const [rows] = await conn.query(
      `SELECT id, name FROM permissions WHERE name IN (?)`,
      [PERMISSIONS.map((p) => p.code)]
    );
    const permIdByName = {};
    rows.forEach((r) => { permIdByName[r.name] = r.id; });

    for (const roleId of ROLES) {
      for (const p of PERMISSIONS) {
        const permId = permIdByName[p.code];
        await conn.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [roleId, permId]
        );
      }
    }

    console.log('Phase 5 DSS permissions seeded. Grants:');
    const [grants] = await conn.query(
      `SELECT r.name AS role_name, p.name AS permission
       FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.name IN (?)
       ORDER BY r.id, p.name`,
      [PERMISSIONS.map((p) => p.code)]
    );
    grants.forEach((g) => console.log(`  ${g.role_name} -> ${g.permission}`));
    console.log('DONE');
  } catch (e) {
    console.error('MIGRATION ERROR:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
