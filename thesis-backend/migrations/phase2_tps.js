// Phase 2 — Transaction Processing System (TPS).
// - tps_view / tps_create permission codes
// - seed them to OPERATIONS + FINANCE (BAR_OWNER bypasses; ADMIN gets all)
// - add transaction_name to pos_orders for order/item naming
// - allow free-form pos_order_items (menu_item_id / inventory_item_id nullable)

const mysql = require('mysql2/promise');

const SQL = `
INSERT INTO permissions (name, module, action, description) VALUES
  ('tps_view', 'tps', 'view', 'View transactions & TPS reports'),
  ('tps_create', 'tps', 'create', 'Record / process transactions')
ON DUPLICATE KEY UPDATE description = VALUES(description);

SET @has_txn_name = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_orders' AND COLUMN_NAME = 'transaction_name'
);
SET @sql_txn = IF(@has_txn_name = 0,
  'ALTER TABLE pos_orders ADD COLUMN transaction_name VARCHAR(150) NULL AFTER order_number',
  'SELECT 1');
PREPARE stmt_txn FROM @sql_txn; EXECUTE stmt_txn; DEALLOCATE PREPARE stmt_txn;

SET @has_mi = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_order_items' AND COLUMN_NAME = 'menu_item_id' AND IS_NULLABLE = 'NO'
);
SET @sql_mi = IF(@has_mi > 0,
  'ALTER TABLE pos_order_items MODIFY COLUMN menu_item_id INT NULL',
  'SELECT 1');
PREPARE stmt_mi FROM @sql_mi; EXECUTE stmt_mi; DEALLOCATE PREPARE stmt_mi;

SET @has_ii = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pos_order_items' AND COLUMN_NAME = 'inventory_item_id' AND IS_NULLABLE = 'NO'
);
SET @sql_ii = IF(@has_ii > 0,
  'ALTER TABLE pos_order_items MODIFY COLUMN inventory_item_id INT NULL',
  'SELECT 1');
PREPARE stmt_ii FROM @sql_ii; EXECUTE stmt_ii; DEALLOCATE PREPARE stmt_ii;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name IN ('OPERATIONS','FINANCE') AND p.name IN ('tps_view','tps_create')
  ON DUPLICATE KEY UPDATE role_id = r.id;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 1, p.id FROM permissions p
  WHERE p.name IN ('tps_view','tps_create')
    AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 1 AND rp.permission_id = p.id);
`;

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tpg', multipleStatements: true,
  });
  try {
    await conn.query(SQL);
    const [p] = await conn.query("SELECT id FROM permissions WHERE name IN ('tps_view','tps_create')");
    const [c] = await conn.query("SHOW COLUMNS FROM pos_orders WHERE Field='transaction_name'");
    console.log('tps perms ids:', JSON.stringify(p.map(x=>x.id)));
    console.log('pos_orders.transaction_name exists:', c.length === 1);
    console.log('PHASE 2 MIGRATION OK');
  } catch (e) { console.error('ERR', e.message); process.exit(1); }
  finally { await conn.end(); }
})();
