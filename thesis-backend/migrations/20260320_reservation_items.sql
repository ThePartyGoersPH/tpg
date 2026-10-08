-- Migration: reservation_items
-- Tracks which menu items were added per reservation (for best-seller DSS)
-- Safe: only adds a new table; does NOT modify any existing tables used by the POS app.

CREATE TABLE IF NOT EXISTS `reservation_items` (
  `id`             int(11)        NOT NULL AUTO_INCREMENT,
  `reservation_id` int(11)        NOT NULL,
  `bar_id`         int(11)        NOT NULL,
  `menu_item_id`   int(11)        NOT NULL,
  `quantity`       int(11)        NOT NULL DEFAULT 1,
  `unit_price`     decimal(10,2)  NOT NULL DEFAULT 0.00,
  `created_at`     timestamp      NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ri_reservation`  (`reservation_id`),
  KEY `idx_ri_menu_item`    (`menu_item_id`),
  KEY `idx_ri_bar`          (`bar_id`),
  CONSTRAINT `fk_ri_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ri_menu_item`   FOREIGN KEY (`menu_item_id`)   REFERENCES `menu_items`    (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
