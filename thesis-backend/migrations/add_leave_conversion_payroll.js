// Leave-to-cash approvals flow into payroll as an earning line item.
// - leave_cash_conversions: which payroll item the approved payout landed on
// - payroll_items.additions: earning total folded into gross pay + net pay
// - payroll_addition_items: per-conversion earning line (mirrors payroll_deduction_items)

const mysql = require('mysql2/promise');

const SQL = `
SET @c1 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='leave_cash_conversions' AND COLUMN_NAME='payroll_run_id');
SET @s1 = IF(@c1=0, 'ALTER TABLE leave_cash_conversions ADD COLUMN payroll_run_id INT NULL AFTER decided_at, ADD COLUMN payroll_item_id INT NULL AFTER payroll_run_id, ADD COLUMN applied_at DATETIME NULL AFTER payroll_item_id', 'SELECT 1');
PREPARE p1 FROM @s1; EXECUTE p1; DEALLOCATE PREPARE p1;

SET @c2 = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payroll_items' AND COLUMN_NAME='additions');
SET @s2 = IF(@c2=0, 'ALTER TABLE payroll_items ADD COLUMN additions DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER adjusted_gross_pay', 'SELECT 1');
PREPARE p2 FROM @s2; EXECUTE p2; DEALLOCATE PREPARE p2;

CREATE TABLE IF NOT EXISTS payroll_addition_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payroll_item_id INT NOT NULL,
  leave_conversion_id INT NOT NULL,
  label VARCHAR(100) NOT NULL,
  days DECIMAL(6,2) NOT NULL DEFAULT 0,
  hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  computation_basis VARCHAR(255) DEFAULT NULL,
  approved_by INT DEFAULT NULL,
  approved_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payroll_addition_conversion (leave_conversion_id),
  KEY idx_payroll_addition_item (payroll_item_id)
);
`;

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tpg', multipleStatements: true,
  });
  try {
    await conn.query(SQL);
    const [a] = await conn.query("SHOW COLUMNS FROM leave_cash_conversions WHERE Field='payroll_item_id'");
    const [b] = await conn.query("SHOW COLUMNS FROM payroll_items WHERE Field='additions'");
    const [c] = await conn.query("SHOW TABLES LIKE 'payroll_addition_items'");
    console.log('leave_cash_conversions.payroll_item_id:', a.length === 1);
    console.log('payroll_items.additions:', b.length === 1);
    console.log('payroll_addition_items:', c.length === 1);
    console.log('LEAVE CONVERSION -> PAYROLL MIGRATION OK');
  } catch (err) { console.error('ERR', err.message); process.exit(1); }
  finally { await conn.end(); }
})();
