-- Migration: Add staff_types to bars table and update inventory units
-- Date: 2026-03-30
-- Purpose: Support staff type selection (PROMPT 3.2) and inventory units (PROMPT 3.4)

-- Add staff_types column to bars table
-- Stores JSON array of selected staff types: ["DJ", "Live Band", "Host / Emcee", "Security", "Waitstaff"]
ALTER TABLE `bars` 
ADD COLUMN `staff_types` JSON DEFAULT NULL COMMENT 'Array of staff types present at the bar' AFTER `bar_types`;

-- Update inventory_items table to change unit from varchar(50) to ENUM
-- First, check if unit column exists and update it
ALTER TABLE `inventory_items` 
MODIFY COLUMN `unit` ENUM('Bottle', 'Bucket', 'Case (12 bottles)', 'Glass', 'Liter', 'Kilogram', 'Piece') DEFAULT 'Piece' COMMENT 'Unit of measurement for inventory item';
