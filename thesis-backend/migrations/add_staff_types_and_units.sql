SET @cx581 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bars' AND COLUMN_NAME = 'staff_types');
SET @sx581 := IF(@cx581 = 0, 'ALTER TABLE bars ADD COLUMN staff_types JSON DEFAULT NULL COMMENT ''Array of staff types present at the bar'' AFTER `bar_types`', 'SELECT 1');
PREPARE stx581 FROM @sx581;
EXECUTE stx581;
DEALLOCATE PREPARE stx581;
-- Backfill legacy unit values into the narrowed enum (data-preserving:
-- 'bottle' normalizes case; unrecognized junk values fall back to 'Piece')
UPDATE inventory_items SET unit = 'Bottle' WHERE unit = 'bottle';
UPDATE inventory_items SET unit = 'Piece'
WHERE unit NOT IN ('Bottle', 'Bucket', 'Case (12 bottles)', 'Glass', 'Liter', 'Kilogram', 'Piece');
ALTER TABLE inventory_items MODIFY COLUMN `unit` ENUM('Bottle', 'Bucket', 'Case (12 bottles)', 'Glass', 'Liter', 'Kilogram', 'Piece') DEFAULT 'Piece' COMMENT 'Unit of measurement for inventory item';
