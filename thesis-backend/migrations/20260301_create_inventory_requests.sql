-- Migration: Create inventory_requests table
-- Date: 2026-03-30
-- Purpose: Support inventory request and approval workflow (PROMPT 3.5)

CREATE TABLE IF NOT EXISTS `inventory_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `bar_id` int(11) NOT NULL,
  `requester_id` int(11) NOT NULL COMMENT 'User ID of staff who submitted request',
  `item_name` varchar(255) NOT NULL,
  `quantity_needed` int(11) NOT NULL,
  `unit` ENUM('Bottle', 'Bucket', 'Case (12 bottles)', 'Glass', 'Liter', 'Kilogram', 'Piece') DEFAULT 'Piece',
  `reason` text DEFAULT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `reorder_level` int(11) DEFAULT NULL,
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL COMMENT 'User ID of owner/manager who reviewed',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `rejection_note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_requests_bar` (`bar_id`, `status`),
  KEY `idx_inventory_requests_requester` (`requester_id`),
  KEY `idx_inventory_requests_reviewed_by` (`reviewed_by`),
  CONSTRAINT `fk_inventory_requests_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventory_requests_requester` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventory_requests_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
