// Phase 0 — Foundation: master roles, permission codes, role_permissions seeds,
// and Admin-exclusive access to Logs & Audit Trail.
// Run with: node migrations/phase0_foundation_rbac.js

const mysql = require('mysql2/promise');

const SQL = `
-- 1. Master roles (add the ones missing from the existing set:
--    ADMIN, HR already exist; add EXECUTIVE, FINANCE,
--    SUPPLY_CHAIN, CRM, OPERATIONS)
INSERT INTO roles (name, description) VALUES
  ('EXECUTIVE', 'Executive director; directs HR, oversight across modules'),
  ('FINANCE', 'Finance; approves payroll (from HR) and releases procurement budgets'),
  ('SUPPLY_CHAIN', 'Supply chain; receives & manages inventory deliveries'),
  ('CRM', 'Customer relationship management; shared customer data'),
  ('OPERATIONS', 'Bar operations; waiters, cashiers, kitchen, floor ops')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 2. New permission codes (module-scoped, per-bar via bar_id on records)
INSERT INTO permissions (name, module, action, description) VALUES
  ('finance_view', 'finance', 'view', 'View finance dashboard'),
  ('finance_budget_manage', 'finance', 'budget_manage', 'Release / approve budgets'),
  ('finance_payroll_approve', 'finance', 'payroll_approve', 'Approve payroll submitted by HR'),
  ('finance_reports_view', 'finance', 'reports_view', 'View financial reports'),
  ('procurement_view', 'procurement', 'view', 'View procurement dashboard'),
  ('procurement_create', 'procurement', 'create', 'Create purchase orders'),
  ('procurement_approve', 'procurement', 'approve', 'Approve purchase orders'),
  ('procurement_budget_view', 'procurement', 'budget_view', 'View finance-approved budgets'),
  ('supply_chain_view', 'supply_chain', 'view', 'View supply chain'),
  ('supply_chain_receive', 'supply_chain', 'receive', 'Receive goods / deliveries'),
  ('supply_chain_manage', 'supply_chain', 'manage', 'Manage supply chain operations'),
  ('inventory_receive', 'supply_chain', 'inventory_receive', 'Receive inventory into stock'),
  ('dss_diagnostic_view', 'dss', 'diagnostic_view', 'View diagnostic analytics (why)'),
  ('dss_predictive_view', 'dss', 'predictive_view', 'View predictive analytics (forecast)'),
  ('dss_prescriptive_view', 'dss', 'prescriptive_view', 'View prescriptive recommendations'),
  ('crm_view', 'crm', 'view', 'View CRM data'),
  ('crm_manage', 'crm', 'manage', 'Manage CRM data'),
  ('bar_registration_view', 'bar_registration', 'view', 'View bar registration submissions'),
  ('bar_registration_review', 'bar_registration', 'review', 'Manually review / approve bar registrations'),
  ('bar_verification_manage', 'bar_registration', 'verification_manage', 'Manage automated verification config')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 3. Seed role_permissions (join on permission NAME so we never hardcode IDs)
-- Helper: grant a list of permission names to a role name.

-- EXECUTIVE: oversight across all modules
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'EXECUTIVE' AND p.name IN (
    'finance_view','finance_reports_view','procurement_view','supply_chain_view','crm_view',
    'analytics_bar_view','dss_diagnostic_view','dss_predictive_view','dss_prescriptive_view',
    'bar_details_view','bar_registration_view','financials_view','events_view','reviews_view',
    'staff_view','attendance_view_all','leave_view_all','payroll_view_all','menu_view',
    'reservation_view','table_view','documents_view_all'
  )
  ON DUPLICATE KEY UPDATE role_id = r.id;

-- HR: staff/attendance/leave/payroll/documents + crm linkage
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'HR' AND p.name IN (
    'staff_view','staff_create','staff_update','staff_delete','staff_deactivate','staff_reset_password','staff_edit_permissions',
    'attendance_view_all','attendance_view_own','attendance_create',
    'leave_view_all','leave_view_own','leave_apply','leave_approve',
    'payroll_view_all','payroll_view_own','payroll_create',
    'documents_view_all','documents_view_own','documents_send','documents_manage',
    'deduction_settings_view','deduction_settings_manage',
    'crm_view','bar_details_view','analytics_bar_view'
  )
  ON DUPLICATE KEY UPDATE role_id = r.id;

-- FINANCE
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'FINANCE' AND p.name IN (
    'finance_view','finance_budget_manage','finance_payroll_approve','finance_reports_view',
    'procurement_budget_view','crm_view','analytics_bar_view',
    'dss_diagnostic_view','dss_predictive_view','dss_prescriptive_view',
    'financials_view','bar_details_view','bar_registration_view','procurement_view'
  )
  ON DUPLICATE KEY UPDATE role_id = r.id;

-- CRM
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'CRM' AND p.name IN (
    'crm_view','crm_manage','reviews_view','reviews_reply','ban_view','ban_lift','ban_branch',
    'analytics_bar_view','bar_details_view','documents_view_all','documents_view_own','events_view'
  )
  ON DUPLICATE KEY UPDATE role_id = r.id;

-- ADMIN (id 1): grant EVERY permission (incl. logs_view) -> Admin-exclusive logs
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 1, p.id FROM permissions p
  WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = 1 AND rp.permission_id = p.id
  );

-- 4. Admin-exclusive Logs & Audit Trail:
--    Remove logs_view from BAR_OWNER and MANAGER so only ADMIN (and SUPER_ADMIN bypass) hold it.
DELETE FROM role_permissions
  WHERE permission_id = (SELECT id FROM permissions WHERE name = 'logs_view')
    AND role_id IN (7, 9);
`;

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tpg', multipleStatements: true,
  });
  try {
    await conn.query(SQL);
    // Report
    const [roles] = await conn.query('SELECT id, name FROM roles ORDER BY id');
    const [permCount] = await conn.query('SELECT COUNT(*) c FROM permissions');
    const [logs] = await conn.query(
      `SELECT r.name AS role FROM roles r
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE p.name = 'logs_view'`
    );
    const [op] = await conn.query(
      `SELECT COUNT(*) c FROM role_permissions rp
       JOIN roles r ON r.id = rp.role_id WHERE r.name = 'OPERATIONS'`
    );
    console.log('ROLES:', JSON.stringify(roles));
    console.log('TOTAL PERMISSIONS:', permCount[0].c);
    console.log('logs_view held by:', JSON.stringify(logs.map(l => l.role)));
    console.log('OPERATIONS permission count:', op[0].c);
    console.log('PHASE 0 MIGRATION OK');
  } catch (e) {
    console.error('MIGRATION ERROR:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
