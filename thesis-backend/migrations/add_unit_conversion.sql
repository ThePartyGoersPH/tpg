-- Migration: bulk-to-unit conversion (Cases/Boxes -> Bottles/Pieces)
-- Date: 2026-10-06
-- Purpose: track inventory stock at the atomic (base-unit) level so bulk
-- purchases (cases) can be sold as single units (bottles) on the menu.
--
-- inventory_items: pack_unit / base_unit labels + units_per_pack ratio
--   (1 pack = N base units). stock_qty is stored in BASE units.
-- menu_items: sell_unit_type ('single' | 'pack') + units_per_sale
--   (base units deducted per 1 ordered).

ALTER TABLE `inventory_items`
  ADD COLUMN IF NOT EXISTS `pack_unit` varchar(30) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `base_unit` varchar(30) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `units_per_pack` decimal(10,2) NOT NULL DEFAULT 1.00;

ALTER TABLE `menu_items`
  ADD COLUMN IF NOT EXISTS `sell_unit_type` varchar(10) NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS `units_per_sale` decimal(10,2) NOT NULL DEFAULT 1.00;

-- One inventory item can back several menu rows now (e.g. a full case AND a
-- single bottle of the same stock), so drop the one-menu-per-inventory rule.
ALTER TABLE `menu_items` DROP INDEX IF EXISTS `uniq_bar_inventory`;

-- Backfill: the 'Case (12 bottles)' unit carries its ratio in the name, so
-- convert those rows to atomic stock (cases -> bottles). All other units
-- keep 1:1 semantics with base_unit = unit.
UPDATE `inventory_items`
  SET pack_unit = 'Case',
      base_unit = 'Bottle',
      units_per_pack = 12.00,
      stock_qty = stock_qty * 12
  WHERE unit = 'Case (12 bottles)';

UPDATE `inventory_items`
  SET base_unit = unit
  WHERE base_unit IS NULL;
