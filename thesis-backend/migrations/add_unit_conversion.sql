SET @cx179 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'pack_unit');
SET @sx179 := IF(@cx179 = 0, 'ALTER TABLE inventory_items ADD COLUMN `pack_unit` varchar(30) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx179 FROM @sx179;
EXECUTE stx179;
DEALLOCATE PREPARE stx179;
SET @cx180 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'base_unit');
SET @sx180 := IF(@cx180 = 0, 'ALTER TABLE inventory_items ADD COLUMN `base_unit` varchar(30) NULL DEFAULT NULL', 'SELECT 1');
PREPARE stx180 FROM @sx180;
EXECUTE stx180;
DEALLOCATE PREPARE stx180;
SET @cx181 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'units_per_pack');
SET @sx181 := IF(@cx181 = 0, 'ALTER TABLE inventory_items ADD COLUMN `units_per_pack` decimal(10,2) NOT NULL DEFAULT 1.00', 'SELECT 1');
PREPARE stx181 FROM @sx181;
EXECUTE stx181;
DEALLOCATE PREPARE stx181;
SET @cx18 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items' AND COLUMN_NAME = 'sell_unit_type');
SET @sx18 := IF(@cx18 = 0, 'ALTER TABLE menu_items ADD COLUMN `sell_unit_type` varchar(10) NOT NULL DEFAULT ''single''', 'SELECT 1');
PREPARE stx18 FROM @sx18;
EXECUTE stx18;
DEALLOCATE PREPARE stx18;
SET @cx19 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items' AND COLUMN_NAME = 'units_per_sale');
SET @sx19 := IF(@cx19 = 0, 'ALTER TABLE menu_items ADD COLUMN `units_per_sale` decimal(10,2) NOT NULL DEFAULT 1.00', 'SELECT 1');
PREPARE stx19 FROM @sx19;
EXECUTE stx19;
DEALLOCATE PREPARE stx19;
SET @cx582 := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'menu_items' AND INDEX_NAME = 'uniq_bar_inventory');
SET @sx582 := IF(@cx582 > 0, 'ALTER TABLE menu_items DROP INDEX `uniq_bar_inventory`', 'SELECT 1');
PREPARE stx582 FROM @sx582;
EXECUTE stx582;
DEALLOCATE PREPARE stx582;
UPDATE `inventory_items`
  SET pack_unit = 'Case',
      base_unit = 'Bottle',
      units_per_pack = 12.00,
      stock_qty = stock_qty * 12
  WHERE unit = 'Case (12 bottles)';
UPDATE `inventory_items`
  SET base_unit = unit
  WHERE base_unit IS NULL;
