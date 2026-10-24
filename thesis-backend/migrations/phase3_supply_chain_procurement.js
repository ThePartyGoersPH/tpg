// Phase 3 — Supply Chain / Procurement.
// - suppliers, purchase_orders, purchase_order_items
// - goods_received_notes, goods_received_items (receive & stock reconciliation)
// - seed procurement / supply-chain permissions to the relevant roles

const mysql = require('mysql2/promise');

const SQL = `
CREATE TABLE IF NOT EXISTS suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bar_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(150),
  email VARCHAR(150),
  phone VARCHAR(50),
  address TEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  INDEX (bar_id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bar_id INT NOT NULL,
  supplier_id INT NULL,
  created_by INT NOT NULL,
  status ENUM('draft','pending_approval','approved','rejected','partially_received','received','cancelled') NOT NULL DEFAULT 'draft',
  order_date DATE NULL,
  expected_delivery DATE NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  updated_at DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  INDEX (bar_id),
  INDEX (status)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  po_id INT NOT NULL,
  inventory_item_id INT NULL,
  item_name VARCHAR(150) NOT NULL,
  quantity_ordered INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity_received INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  INDEX (po_id)
);

CREATE TABLE IF NOT EXISTS goods_received_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bar_id INT NOT NULL,
  po_id INT NOT NULL,
  received_by INT NOT NULL,
  received_at DATETIME NOT NULL DEFAULT NOW(),
  notes TEXT,
  INDEX (bar_id),
  INDEX (po_id)
);

CREATE TABLE IF NOT EXISTS goods_received_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grn_id INT NOT NULL,
  po_item_id INT NOT NULL,
  quantity_received INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  INDEX (grn_id)
);

-- Seed role permissions
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'PROCUREMENT' AND p.name IN
    ('procurement_view','procurement_create','procurement_approve','procurement_budget_view','supply_chain_view','supply_chain_manage')
  ON DUPLICATE KEY UPDATE role_id = r.id;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'SUPPLY_CHAIN' AND p.name IN
    ('supply_chain_view','supply_chain_receive','supply_chain_manage','inventory_receive','procurement_view')
  ON DUPLICATE KEY UPDATE role_id = r.id;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'FINANCE' AND p.name IN
    ('procurement_view','procurement_budget_view','supply_chain_view')
  ON DUPLICATE KEY UPDATE role_id = r.id;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'MANAGER' AND p.name IN
    ('procurement_view','procurement_create','supply_chain_view')
  ON DUPLICATE KEY UPDATE role_id = r.id;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 1, p.id FROM permissions p
  WHERE p.name IN
    ('procurement_view','procurement_create','procurement_approve','procurement_budget_view',
     'supply_chain_view','supply_chain_receive','supply_chain_manage','inventory_receive')
    AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 1 AND rp.permission_id = p.id);
`;

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tpg', multipleStatements: true,
  });
  try {
    await conn.query(SQL);
    const [t] = await conn.query("SHOW TABLES LIKE 'purchase_orders'");
    console.log('purchase_orders created:', t.length === 1);
    console.log('PHASE 3 MIGRATION OK');
  } catch (e) { console.error('ERR', e.message); process.exit(1); }
  finally { await conn.end(); }
})();
