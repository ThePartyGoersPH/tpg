-- Migration: Pickup / Delivery fulfillment + takeout delivery details
-- Date: 2026-10-06
-- Purpose: Let bars offer Store Pickup and/or Delivery for takeout orders,
-- and store delivery contact info on reservations for riders/staff.

-- Bar-level fulfillment settings
ALTER TABLE `bars`
  ADD COLUMN IF NOT EXISTS `allow_pickup` tinyint(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `allow_delivery` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `delivery_fee` decimal(10,2) NOT NULL DEFAULT 0.00;

-- Reservation-level fulfillment (takeout orders only; NULL for table bookings)
ALTER TABLE `reservations`
  ADD COLUMN IF NOT EXISTS `fulfillment` varchar(20) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `delivery_name` varchar(150) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `delivery_phone` varchar(50) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `delivery_address` text NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `delivery_notes` varchar(255) NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `delivery_fee` decimal(10,2) NOT NULL DEFAULT 0.00;
