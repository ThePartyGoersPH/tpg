-- PO Finance Approval workflow + Walk-in supplier support
-- 1) Denormalized supplier display name, snapshotted at PO creation.
--    Existing supplier-less POs are backfilled as "Walk-in".
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(150) NULL AFTER supplier_id;

UPDATE purchase_orders
   SET supplier_name = 'Walk-in'
 WHERE supplier_id IS NULL AND supplier_name IS NULL;

-- 2) Per-bar finance approval threshold (PHP). 0 = every PO requires finance approval.
ALTER TABLE bars
  ADD COLUMN IF NOT EXISTS po_finance_approval_threshold DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 3) New permission: final finance approval of purchase orders (Finance Approvals queue).
INSERT INTO permissions (name, module, action, description)
VALUES ('procurement_finance_approve', 'procurement', 'finance_approve',
        'Approve/reject purchase orders in the Finance Approvals queue')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 4) Grants: Finance / Bar Owner / Manager / Executive.
--    The PROCUREMENT role is deliberately excluded — separation of duties:
--    the team that raises purchase orders cannot give final finance approval.
INSERT INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.name = 'procurement_finance_approve'
   WHERE r.name IN ('ADMIN', 'BAR_OWNER', 'MANAGER', 'EXECUTIVE', 'FINANCE')
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

-- 5) Users carrying per-user overrides (role defaults snapshotted at creation or
--    role change) only read user_permissions, so mirror the new grant into their
--    overrides — the same way the role-change sync in routes/owner.js does it.
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
