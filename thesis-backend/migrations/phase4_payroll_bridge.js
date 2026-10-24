// Phase 4 — HR <-> Finance Payroll Bridge.
// - add finance approval gate to payroll_runs (status approved/rejected)
// - finance_approved_by / finance_approved_at / finance_notes
// - payroll_expenses ledger (the posted bridge record)
// - ensure FINANCE/ADMIN can approve payroll

const mysql = require('mysql2/promise');

const SQL = `
ALTER TABLE payroll_runs MODIFY COLUMN status
  ENUM('draft','finalized','pending_approval','approved','rejected') NOT NULL DEFAULT 'draft';

SET @has_fab = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payroll_runs' AND COLUMN_NAME='finance_approved_by');
SET @sql_fab = IF(@has_fab=0, 'ALTER TABLE payroll_runs ADD COLUMN finance_approved_by INT NULL AFTER finalized_at', 'SELECT 1');
PREPARE s1 FROM @sql_fab; EXECUTE s1; DEALLOCATE PREPARE s1;

SET @has_faa = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payroll_runs' AND COLUMN_NAME='finance_approved_at');
SET @sql_faa = IF(@has_faa=0, 'ALTER TABLE payroll_runs ADD COLUMN finance_approved_at DATETIME NULL AFTER finance_approved_by', 'SELECT 1');
PREPARE s2 FROM @sql_faa; EXECUTE s2; DEALLOCATE PREPARE s2;

SET @has_fn = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payroll_runs' AND COLUMN_NAME='finance_notes');
SET @sql_fn = IF(@has_fn=0, 'ALTER TABLE payroll_runs ADD COLUMN finance_notes TEXT NULL AFTER finance_approved_at', 'SELECT 1');
PREPARE s3 FROM @sql_fn; EXECUTE s3; DEALLOCATE PREPARE s3;

CREATE TABLE IF NOT EXISTS payroll_expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bar_id INT NOT NULL,
  payroll_run_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  period_start DATE NULL,
  period_end DATE NULL,
  posted_at DATETIME NOT NULL DEFAULT NOW(),
  created_at DATETIME NOT NULL DEFAULT NOW(),
  INDEX (bar_id),
  INDEX (payroll_run_id)
);

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'FINANCE' AND p.name IN ('finance_payroll_approve','payroll_view_all')
  ON DUPLICATE KEY UPDATE role_id = r.id;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 1, p.id FROM permissions p
  WHERE p.name IN ('finance_payroll_approve','payroll_view_all')
    AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 1 AND rp.permission_id = p.id);
`;

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tpg', multipleStatements: true,
  });
  try {
    await conn.query(SQL);
    const [e] = await conn.query("SHOW COLUMNS FROM payroll_runs WHERE Field='finance_approved_by'");
    console.log('payroll_runs.finance_approved_by exists:', e.length === 1);
    console.log('PHASE 4 MIGRATION OK');
  } catch (err) { console.error('ERR', err.message); process.exit(1); }
  finally { await conn.end(); }
})();
