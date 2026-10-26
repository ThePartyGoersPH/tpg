SET @cx124 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'supplier_name');
SET @sx124 := IF(@cx124 = 0, 'ALTER TABLE purchase_orders ADD COLUMN supplier_name VARCHAR(150) NULL AFTER supplier_id', 'SELECT 1');
PREPARE stx124 FROM @sx124;
EXECUTE stx124;
DEALLOCATE PREPARE stx124;
UPDATE purchase_orders
   SET supplier_name = 'Walk-in'
 WHERE supplier_id IS NULL AND supplier_name IS NULL;
SET @cx125 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'po_finance_approval_threshold');
SET @sx125 := IF(@cx125 = 0, 'ALTER TABLE bars ADD COLUMN po_finance_approval_threshold DECIMAL(12,2) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stx125 FROM @sx125;
EXECUTE stx125;
DEALLOCATE PREPARE stx125;
INSERT INTO permissions (name, module, action, description)
VALUES ('procurement_finance_approve', 'procurement', 'finance_approve',
        'Approve/reject purchase orders in the Finance Approvals queue')
ON DUPLICATE KEY UPDATE description = VALUES(description);
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.name = 'procurement_finance_approve'
   WHERE r.name IN ('ADMIN', 'BAR_OWNER', 'MANAGER', 'EXECUTIVE', 'FINANCE')
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);
INSERT INTO user_permissions (user_id, permission_id, granted)
  SELECT DISTINCT u.id, p.id, 1
    FROM user_permissions up
    JOIN users u ON u.id = up.user_id
    JOIN roles r ON r.id = COALESCE(
      u.role_id,
      (SELECT id FROM roles WHERE UPPER(name) = UPPER(u.role) LIMIT 1)
    )
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
   WHERE p.name = 'procurement_finance_approve'
ON DUPLICATE KEY UPDATE granted = 1;
