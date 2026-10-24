-- ============================================================
-- POS System Migration — Additive only, does NOT modify existing tables
-- ============================================================

-- 1. New POS permissions
INSERT IGNORE INTO permissions (code, description) VALUES
  ('POS_ACCESS', 'Access the POS system'),
  ('POS_CREATE_ORDER', 'Create POS orders'),
  ('POS_VIEW_ORDERS', 'View POS order history'),
  ('POS_VOID_ORDER', 'Void/cancel POS orders');

-- 2. Grant POS permissions to BAR_OWNER (role_id=7) and STAFF (role_id=5) and CASHIER (role_id=8)
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 7, id FROM permissions WHERE code IN ('POS_ACCESS','POS_CREATE_ORDER','POS_VIEW_ORDERS','POS_VOID_ORDER');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 5, id FROM permissions WHERE code IN ('POS_ACCESS','POS_CREATE_ORDER','POS_VIEW_ORDERS');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 8, id FROM permissions WHERE code IN ('POS_ACCESS','POS_CREATE_ORDER','POS_VIEW_ORDERS');

-- Also grant INVENTORY_READ and MENU_READ to STAFF and CASHIER so they can fetch menu/inventory
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 5, id FROM permissions WHERE code IN ('INVENTORY_READ','MENU_READ');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 8, id FROM permissions WHERE code IN ('INVENTORY_READ','MENU_READ');

-- 3. POS Orders table
CREATE TABLE IF NOT EXISTS pos_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bar_id INT NOT NULL,
  table_id INT,                                    -- NULL = takeaway / no table
  staff_user_id INT NOT NULL,                      -- who created the order
  order_number VARCHAR(30) NOT NULL,               -- human-readable e.g. POS-20260306-001
  status ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method ENUM('cash','digital') DEFAULT NULL,
  amount_received DECIMAL(12,2) DEFAULT 0.00,
  change_amount DECIMAL(12,2) DEFAULT 0.00,
  notes TEXT,
  completed_at DATETIME,
  cancelled_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (bar_id) REFERENCES bars(id) ON DELETE CASCADE,
  FOREIGN KEY (table_id) REFERENCES bar_tables(id) ON DELETE SET NULL,
  FOREIGN KEY (staff_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pos_orders_bar_date (bar_id, created_at),
  INDEX idx_pos_orders_status (bar_id, status)
);

-- 4. POS Order Items table
CREATE TABLE IF NOT EXISTS pos_order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  inventory_item_id INT NOT NULL,
  item_name VARCHAR(150) NOT NULL,                 -- snapshot of name at time of order
  unit_price DECIMAL(10,2) NOT NULL,               -- snapshot of selling_price at time of order
  quantity INT NOT NULL DEFAULT 1,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,    -- unit_price * quantity
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id),
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
);
