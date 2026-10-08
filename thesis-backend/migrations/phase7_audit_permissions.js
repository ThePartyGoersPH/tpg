// Phase 7 — Ensure logs_view is granted to operational roles so the
// consolidated Audit Logs view is accessible. The audit_logs table is
// already populated by TPS, Procurement, Supply Chain, Payroll-Finance,
// and other modules via logAudit().
// Run: node migrations/phase7_audit_permissions.js
// Idempotent.

const mysql = require('mysql2/promise');
const DB = { host: 'localhost', user: 'root', password: '', database: 'tpg' };

const ROLES = [1, 7, 9, 10, 15]; // ADMIN, BAR_OWNER, MANAGER, EXECUTIVE, OPERATIONS

(async () => {
  const conn = await mysql.createConnection(DB);
  try {
    const [[p]] = await conn.query("SELECT id FROM permissions WHERE name = 'logs_view' LIMIT 1");
    if (!p) { console.error('logs_view permission not found'); process.exit(1); }
    for (const roleId of ROLES) {
      await conn.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, p.id]);
    }
    const [grants] = await conn.query(
      `SELECT r.name AS role_name FROM role_permissions rp JOIN roles r ON r.id = rp.role_id WHERE rp.permission_id = ? ORDER BY r.id`,
      [p.id]
    );
    console.log('logs_view granted to:', grants.map((g) => g.role_name).join(', '));
    console.log('DONE');
  } catch (e) {
    console.error('MIGRATION ERROR:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
    process.exit(0);
  }
})();
