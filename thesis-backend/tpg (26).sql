-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 22, 2026 at 05:52 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `tpg`
--

-- --------------------------------------------------------

--
-- Table structure for table `ai_verifications`
--

CREATE TABLE `ai_verifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `verification_status` enum('pending','checking','approved','rejected','manual_review') DEFAULT 'pending',
  `ai_confidence_score` decimal(5,2) DEFAULT NULL,
  `ai_analysis` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`ai_analysis`)),
  `verification_started_at` timestamp NULL DEFAULT NULL,
  `verification_completed_at` timestamp NULL DEFAULT NULL,
  `auto_approved` tinyint(1) DEFAULT 0,
  `manual_override` tinyint(1) DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `ai_verifications`
--

INSERT INTO `ai_verifications` (`id`, `user_id`, `verification_status`, `ai_confidence_score`, `ai_analysis`, `verification_started_at`, `verification_completed_at`, `auto_approved`, `manual_override`, `notes`, `created_at`, `updated_at`) VALUES
(1, 2, 'rejected', 25.00, 'null', '2026-01-24 02:48:48', '2026-01-24 02:48:48', 0, 0, 'Bulk AI Reject with confidence score of 25%', '2026-01-24 02:48:48', '2026-01-24 02:48:48'),
(2, 14, 'manual_review', 80.00, '{\"confidence_score\":80,\"recommendation\":\"manual_review\",\"checks\":{\"email_domain\":{\"score\":25,\"status\":\"pass\",\"note\":\"Business email domain\"},\"business_name\":{\"score\":20,\"status\":\"pass\",\"note\":\"Valid business name\"},\"business_address\":{\"score\":20,\"status\":\"pass\",\"note\":\"Complete business address\"},\"business_phone\":{\"score\":15,\"status\":\"pass\",\"note\":\"Valid phone format\"},\"account_age\":{\"score\":5,\"status\":\"warning\",\"note\":\"Recent account (-0 days)\"},\"business_email\":{\"score\":0,\"status\":\"neutral\",\"note\":\"No separate business email\"}},\"factors\":[],\"timestamp\":\"2026-01-24 04:08:06\"}', '2026-01-24 03:08:06', '2026-01-24 03:08:06', 0, 0, 'Bulk AI Manual_review with confidence score of 80%', '2026-01-24 03:08:06', '2026-01-24 03:08:06'),
(3, 15, 'manual_review', 80.00, '{\"confidence_score\":80,\"recommendation\":\"manual_review\",\"checks\":{\"email_domain\":{\"score\":25,\"status\":\"pass\",\"note\":\"Business email domain\"},\"business_name\":{\"score\":20,\"status\":\"pass\",\"note\":\"Valid business name\"},\"business_address\":{\"score\":20,\"status\":\"pass\",\"note\":\"Complete business address\"},\"business_phone\":{\"score\":15,\"status\":\"pass\",\"note\":\"Valid phone format\"},\"account_age\":{\"score\":5,\"status\":\"warning\",\"note\":\"Recent account (-0 days)\"},\"business_email\":{\"score\":0,\"status\":\"neutral\",\"note\":\"No separate business email\"}},\"factors\":[],\"timestamp\":\"2026-01-24 04:08:06\"}', '2026-01-24 03:08:06', '2026-01-24 03:08:06', 0, 0, 'Bulk AI Manual_review with confidence score of 80%', '2026-01-24 03:08:06', '2026-01-24 03:08:06'),
(4, 16, 'manual_review', 80.00, '{\"confidence_score\":80,\"recommendation\":\"manual_review\",\"checks\":{\"email_domain\":{\"score\":25,\"status\":\"pass\",\"note\":\"Business email domain\"},\"business_name\":{\"score\":20,\"status\":\"pass\",\"note\":\"Valid business name\"},\"business_address\":{\"score\":20,\"status\":\"pass\",\"note\":\"Complete business address\"},\"business_phone\":{\"score\":15,\"status\":\"pass\",\"note\":\"Valid phone format\"},\"account_age\":{\"score\":5,\"status\":\"warning\",\"note\":\"Recent account (-0 days)\"},\"business_email\":{\"score\":0,\"status\":\"neutral\",\"note\":\"No separate business email\"}},\"factors\":[],\"timestamp\":\"2026-01-24 04:08:06\"}', '2026-01-24 03:08:06', '2026-01-24 03:08:06', 0, 0, 'Bulk AI Manual_review with confidence score of 80%', '2026-01-24 03:08:06', '2026-01-24 03:08:06'),
(5, 15, 'manual_review', 80.00, '{\"confidence_score\":80,\"recommendation\":\"manual_review\",\"checks\":{\"email_domain\":{\"score\":25,\"status\":\"pass\",\"note\":\"Business email domain\"},\"business_name\":{\"score\":20,\"status\":\"pass\",\"note\":\"Valid business name\"},\"business_address\":{\"score\":20,\"status\":\"pass\",\"note\":\"Complete business address\"},\"business_phone\":{\"score\":15,\"status\":\"pass\",\"note\":\"Valid phone format\"},\"account_age\":{\"score\":5,\"status\":\"warning\",\"note\":\"Recent account (-0 days)\"},\"business_email\":{\"score\":0,\"status\":\"neutral\",\"note\":\"No separate business email\"}},\"factors\":[],\"timestamp\":\"2026-01-24 04:09:06\"}', '2026-01-24 03:09:06', '2026-01-24 03:09:06', 0, 0, 'AI Manual_review with confidence score of 80%', '2026-01-24 03:09:06', '2026-01-24 03:09:06'),
(6, 15, 'manual_review', 80.00, '{\"confidence_score\":80,\"recommendation\":\"manual_review\",\"checks\":{\"email_domain\":{\"score\":25,\"status\":\"pass\",\"note\":\"Business email domain\"},\"business_name\":{\"score\":20,\"status\":\"pass\",\"note\":\"Valid business name\"},\"business_address\":{\"score\":20,\"status\":\"pass\",\"note\":\"Complete business address\"},\"business_phone\":{\"score\":15,\"status\":\"pass\",\"note\":\"Valid phone format\"},\"account_age\":{\"score\":5,\"status\":\"warning\",\"note\":\"Recent account (-0 days)\"},\"business_email\":{\"score\":0,\"status\":\"neutral\",\"note\":\"No separate business email\"}},\"factors\":[],\"timestamp\":\"2026-01-24 04:09:13\"}', '2026-01-24 03:09:13', '2026-01-24 03:09:13', 0, 0, 'AI Manual_review with confidence score of 80%', '2026-01-24 03:09:13', '2026-01-24 03:09:13'),
(7, 15, 'manual_review', 80.00, '{\"confidence_score\":80,\"recommendation\":\"manual_review\",\"checks\":{\"email_domain\":{\"score\":25,\"status\":\"pass\",\"note\":\"Business email domain\"},\"business_name\":{\"score\":20,\"status\":\"pass\",\"note\":\"Valid business name\"},\"business_address\":{\"score\":20,\"status\":\"pass\",\"note\":\"Complete business address\"},\"business_phone\":{\"score\":15,\"status\":\"pass\",\"note\":\"Valid phone format\"},\"account_age\":{\"score\":5,\"status\":\"warning\",\"note\":\"Recent account (-0 days)\"},\"business_email\":{\"score\":0,\"status\":\"neutral\",\"note\":\"No separate business email\"}},\"factors\":[],\"timestamp\":\"2026-01-24 04:09:19\"}', '2026-01-24 03:09:19', '2026-01-24 03:09:19', 0, 0, 'AI Manual_review with confidence score of 80%', '2026-01-24 03:09:19', '2026-01-24 03:09:19');

-- --------------------------------------------------------

--
-- Table structure for table `attendance_logs`
--

CREATE TABLE `attendance_logs` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `employee_user_id` int(11) NOT NULL,
  `work_date` date NOT NULL,
  `time_in` datetime DEFAULT NULL,
  `time_out` datetime DEFAULT NULL,
  `late_minutes` int(11) NOT NULL DEFAULT 0 COMMENT 'Minutes late for this attendance',
  `expected_time_in` time DEFAULT NULL COMMENT 'Expected clock-in time for late calculation',
  `minutes_late` int(11) DEFAULT 0,
  `minutes_undertime` int(11) DEFAULT 0,
  `minutes_overtime` int(11) DEFAULT 0,
  `source` enum('manual','qr','biometric') DEFAULT 'manual',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `attendance_logs`
--

INSERT INTO `attendance_logs` (`id`, `bar_id`, `employee_user_id`, `work_date`, `time_in`, `time_out`, `late_minutes`, `expected_time_in`, `minutes_late`, `minutes_undertime`, `minutes_overtime`, `source`, `created_at`, `updated_at`) VALUES
(30, 11, 59, '2026-03-13', '2026-03-13 03:07:23', '2026-03-13 03:08:15', 0, NULL, 0, 0, 0, 'manual', '2026-03-12 19:07:23', NULL),
(31, 11, 59, '1223-12-12', '0000-00-00 00:00:00', '0000-00-00 00:00:00', 0, NULL, 0, 0, 0, 'manual', '2026-03-14 20:08:02', NULL),
(32, 11, 59, '2026-03-22', '2026-03-22 06:27:16', '2026-03-22 06:27:18', 0, NULL, 0, 0, 0, 'manual', '2026-03-21 22:27:16', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `entity` varchar(50) NOT NULL,
  `entity_id` int(11) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `bar_id`, `user_id`, `action`, `entity`, `entity_id`, `details`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 16:56:47'),
(2, 11, 29, 'RESET_PASSWORD', 'user', 35, '{\"target_user_id\":35}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 16:58:58'),
(3, 11, 35, 'LOGIN', 'user', 35, '{\"email\":\"gamilojuanbar@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 16:59:16'),
(4, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 17:01:58'),
(5, 11, 35, 'LOGIN', 'user', 35, '{\"email\":\"gamilojuanbar@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 17:04:04'),
(6, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 17:06:02'),
(7, 11, 32, 'LOGIN', 'user', 32, '{\"email\":\"ana.staff@bar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 17:07:31'),
(8, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 17:17:17'),
(9, 11, 29, 'RECORD_SALE', 'sales', 4, '{\"item_id\":4,\"quantity\":2,\"total\":112,\"new_stock\":47}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 17:22:37'),
(10, 11, 29, 'RECORD_SALE', 'sales', 3, '{\"item_id\":3,\"quantity\":4,\"total\":224,\"new_stock\":6}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 17:22:48'),
(11, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 17:58:01'),
(12, 11, 35, 'LOGIN', 'user', 35, '{\"email\":\"gamilojuanbar@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 18:17:02'),
(13, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 18:18:06'),
(14, 11, 35, 'LOGIN', 'user', 35, '{\"email\":\"gamilojuanbar@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 18:20:22'),
(15, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 18:21:02'),
(16, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 18:29:32'),
(17, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 18:46:58'),
(18, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 19:15:25'),
(19, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-25 19:26:50'),
(20, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 15:17:48'),
(21, 11, 35, 'LOGIN', 'user', 35, '{\"email\":\"gamilojuanbar@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 15:22:19'),
(22, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 15:23:00'),
(23, 11, 29, 'ADD_TO_MENU', 'menu_items', 1, '{\"inventory_item_id\":3,\"menu_name\":\"gin bulag\",\"selling_price\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 15:53:37'),
(24, 11, 29, 'UPDATE_MENU_ITEM', 'menu_items', 1, '{\"fields_updated\":[\"is_available\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 16:53:26'),
(25, 11, 29, 'UPDATE_MENU_ITEM', 'menu_items', 1, '{\"fields_updated\":[\"is_available\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 16:53:31'),
(26, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 16:57:58'),
(27, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 17:11:32'),
(28, 11, 29, 'ADD_TO_MENU', 'menu_items', 2, '{\"inventory_item_id\":2,\"menu_name\":\"Red Horse Beer\",\"selling_price\":55}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 17:13:33'),
(29, 11, 29, 'ADD_TO_MENU', 'menu_items', 3, '{\"inventory_item_id\":4,\"menu_name\":\"bulag\",\"selling_price\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 17:13:38'),
(30, 11, 36, 'SUPER_ADMIN_APPROVE_BAR', 'bar', 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:29:52'),
(31, 11, 36, 'SUPER_ADMIN_APPROVE_BAR', 'bar', 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:29:54'),
(32, 10, 36, 'SUPER_ADMIN_APPROVE_BAR', 'bar', 10, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:29:55'),
(33, 11, 36, 'SUPER_ADMIN_SUSPEND_BAR', 'bar', 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:36:11'),
(34, 11, 36, 'SUPER_ADMIN_SUSPEND_BAR', 'bar', 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:36:12'),
(35, 11, 36, 'SUPER_ADMIN_SUSPEND_BAR', 'bar', 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:36:13'),
(36, 11, 36, 'SUPER_ADMIN_APPROVE_BAR', 'bar', 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:36:13'),
(37, 11, 36, 'SUPER_ADMIN_SUSPEND_BAR', 'bar', 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:26:22'),
(38, 11, 36, 'SUPER_ADMIN_REACTIVATE_BAR', 'bar', 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:26:24'),
(39, 11, 36, 'SUPER_ADMIN_SUSPEND_BAR', 'bar', 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:26:25'),
(40, 11, 36, 'SUPER_ADMIN_APPROVE_BAR', 'bar', 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:26:26'),
(41, 11, 31, 'LOGIN', 'user', 31, '{\"email\":\"hr1@juanbar.com\",\"role\":\"hr\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:28:33'),
(42, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:30:19'),
(43, 12, 37, 'LOGIN', 'user', 37, '{\"email\":\"clarencebossing@gmail.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 20:39:50'),
(44, 12, 37, 'LOGIN', 'user', 37, '{\"email\":\"clarencebossing@gmail.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 20:44:10'),
(45, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 04:34:21'),
(46, 11, 29, 'UPDATE_INVENTORY', 'inventory_items', 3, '{\"stock_qty\":50,\"stock_status\":\"normal\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 04:34:38'),
(47, 11, 29, 'ADD_TO_MENU', 'menu_items', 4, '{\"inventory_item_id\":1,\"menu_name\":\"Red Horse Beer\",\"selling_price\":55}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 04:34:52'),
(48, 11, 36, 'SUPER_ADMIN_SUSPEND_BAR', 'bar', 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 04:39:15'),
(49, 11, 36, 'SUPER_ADMIN_REACTIVATE_BAR', 'bar', 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 04:45:03'),
(50, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 12:47:49'),
(51, 11, 31, 'LOGIN', 'user', 31, '{\"email\":\"hr1@juanbar.com\",\"role\":\"hr\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 12:54:55'),
(52, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 12:56:29'),
(53, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 18:36:48'),
(54, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 18:55:09'),
(55, 11, 29, 'CREATE_EVENT', 'bar_events', 1, '{\"title\":\"dj Aubrey in the house\",\"event_date\":\"2026-03-01\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 18:57:38'),
(56, 11, 29, 'UPLOAD_EVENT_IMAGE', 'bar_events', 1, '{\"image_path\":\"uploads/events/event_11_1772305058551.jpg\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 18:57:38'),
(57, 11, 29, 'UPDATE_BAR_IMAGE', 'bars', 11, '{\"image_path\":\"uploads/bars/bar_11_1772309520697.jpg\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 20:12:00'),
(58, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 20:12:04'),
(59, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 20:55:27'),
(60, 11, 29, 'UPDATE_EVENT', 'bar_events', 1, '{\"fields_updated\":[\"title\",\"description\",\"event_date\",\"start_time\",\"end_time\",\"max_capacity\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 20:57:12'),
(61, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 21:04:57'),
(62, 11, 29, 'UPDATE_BAR_IMAGE', 'bars', 11, '{\"image_path\":\"uploads/bars/bar_11_1772312757084.jpg\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 21:05:57'),
(63, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 21:06:00'),
(64, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 21:09:55'),
(65, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 21:10:18'),
(66, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 16:48:01'),
(67, 12, 36, 'SUPER_ADMIN_SUSPEND_BAR', 'bar', 12, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 16:49:28'),
(68, 13, 36, 'SUPER_ADMIN_SUSPEND_BAR', 'bar', 13, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 16:49:30'),
(69, 10, 36, 'SUPER_ADMIN_SUSPEND_BAR', 'bar', 10, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 16:49:32'),
(70, 11, 29, 'UPDATE_EVENT', 'bar_events', 1, '{\"fields_updated\":[\"title\",\"description\",\"event_date\",\"start_time\",\"end_time\",\"max_capacity\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 16:52:41'),
(71, 11, 29, 'UPLOAD_EVENT_IMAGE', 'bar_events', 1, '{\"image_path\":\"uploads/events/event_11_1772643161276.jpg\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 16:52:41'),
(72, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 18:11:28'),
(73, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:11:13'),
(74, 11, 29, 'REMOVE_FROM_MENU', 'menu_items', 4, '{}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:12:58'),
(75, 11, 29, 'CREATE_EVENT', 'bar_events', 2, '{\"title\":\"dj again\",\"event_date\":\"2026-03-05\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:43:44'),
(76, 11, 29, 'UPLOAD_EVENT_IMAGE', 'bar_events', 2, '{\"image_path\":\"uploads/events/event_11_1772721824572.jpg\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:43:44'),
(77, 12, 36, 'SUPER_ADMIN_REACTIVATE_BAR', 'bar', 12, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:46:27'),
(78, 13, 36, 'SUPER_ADMIN_REACTIVATE_BAR', 'bar', 13, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:46:28'),
(79, 10, 36, 'SUPER_ADMIN_REACTIVATE_BAR', 'bar', 10, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:46:30'),
(80, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 17:41:53'),
(81, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '2026-03-05 18:41:09'),
(82, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '2026-03-05 19:30:42'),
(83, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '2026-03-05 19:54:49'),
(84, 11, 29, 'UPDATE_EVENT', 'bar_events', 1, '{\"fields_updated\":[\"title\",\"description\",\"event_date\",\"start_time\",\"end_time\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '2026-03-05 20:02:11'),
(85, 11, 31, 'LOGIN', 'user', 31, '{\"email\":\"hr1@juanbar.com\",\"role\":\"hr\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '2026-03-05 21:54:13'),
(86, 11, 31, 'LOGIN', 'user', 31, '{\"email\":\"hr1@juanbar.com\",\"role\":\"hr\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '2026-03-05 21:54:51'),
(87, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36', '2026-03-05 21:55:35'),
(88, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:04:51'),
(89, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 1, '{\"order_number\":\"POS-20260305-001\",\"table_id\":null,\"item_count\":2,\"total\":336}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:05:42'),
(90, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 1, '{\"payment_method\":\"cash\",\"total\":336,\"received\":500,\"change\":164}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:05:46'),
(91, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:15:40'),
(92, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:26:17'),
(93, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:30:34'),
(94, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 2, '{\"order_number\":\"POS-20260305-002\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:43:38'),
(95, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 2, '{\"payment_method\":\"digital\",\"total\":56,\"received\":56,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:43:43'),
(96, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 3, '{\"order_number\":\"POS-20260305-003\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:44:25'),
(97, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 3, '{\"payment_method\":\"cash\",\"total\":56,\"received\":100,\"change\":44}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:44:29'),
(98, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 4, '{\"order_number\":\"POS-20260305-004\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:47:33'),
(99, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 4, '{\"payment_method\":\"cash\",\"total\":56,\"received\":100,\"change\":44}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 22:47:36'),
(100, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 5, '{\"order_number\":\"POS-20260305-005\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:09:48'),
(101, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 5, '{\"payment_method\":\"cash\",\"total\":56,\"received\":100,\"change\":44}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:09:51'),
(102, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 6, '{\"order_number\":\"POS-20260305-006\",\"table_id\":null,\"item_count\":2,\"total\":224}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:13:14'),
(103, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 6, '{\"payment_method\":\"cash\",\"total\":224,\"received\":500,\"change\":276}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:13:21'),
(104, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 7, '{\"order_number\":\"POS-20260305-007\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:20:20'),
(105, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 7, '{\"payment_method\":\"cash\",\"total\":56,\"received\":100,\"change\":44}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:20:22'),
(106, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 8, '{\"order_number\":\"POS-20260305-008\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:21:36'),
(107, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 8, '{\"payment_method\":\"digital\",\"total\":56,\"received\":56,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:21:39'),
(108, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 9, '{\"order_number\":\"POS-20260305-009\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:24:58'),
(109, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 9, '{\"payment_method\":\"digital\",\"total\":56,\"received\":56,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:25:01'),
(110, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 10, '{\"order_number\":\"POS-20260305-010\",\"table_id\":null,\"item_count\":2,\"total\":112}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:27:10'),
(111, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 10, '{\"payment_method\":\"cash\",\"total\":112,\"received\":500,\"change\":388}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:27:13'),
(112, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 11, '{\"order_number\":\"POS-20260305-011\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:30:36'),
(113, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 11, '{\"payment_method\":\"cash\",\"total\":56,\"received\":500,\"change\":444}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:30:38'),
(114, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 12, '{\"order_number\":\"POS-20260305-012\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:32:46'),
(115, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 12, '{\"payment_method\":\"digital\",\"total\":56,\"received\":56,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:32:50'),
(116, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 13, '{\"order_number\":\"POS-20260305-013\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:41:04'),
(117, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 13, '{\"payment_method\":\"digital\",\"total\":56,\"received\":56,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 23:41:07'),
(118, 11, 29, 'RESET_PASSWORD', 'user', 32, '{\"target_user_id\":32}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:35:14'),
(119, 11, 29, 'UPDATE_USER_ROLE', 'users', 30, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:40:17'),
(120, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 30, '{\"target_user_id\":30,\"permission_count\":7}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:40:17'),
(121, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:40:50'),
(122, 11, 29, 'UPDATE_USER_ROLE', 'users', 30, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:41:56'),
(123, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 30, '{\"target_user_id\":30,\"permission_count\":11}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:41:56'),
(124, 11, 29, 'UPDATE_USER_ROLE', 'users', 30, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:42:23'),
(125, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 30, '{\"target_user_id\":30,\"permission_count\":10}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:42:23'),
(126, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:42:53'),
(127, 11, 29, 'UPDATE_USER_ROLE', 'users', 30, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:43:17'),
(128, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 30, '{\"target_user_id\":30,\"permission_count\":6}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:43:17'),
(129, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:43:40'),
(130, 11, 30, 'POS_CREATE_ORDER', 'pos_orders', 14, '{\"order_number\":\"POS-20260306-001\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:43:55'),
(131, 11, 30, 'POS_COMPLETE_ORDER', 'pos_orders', 14, '{\"payment_method\":\"cash\",\"total\":56,\"received\":500,\"change\":444}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:43:57'),
(132, 11, 30, 'POS_CREATE_ORDER', 'pos_orders', 15, '{\"order_number\":\"POS-20260306-002\",\"table_id\":null,\"item_count\":1,\"total\":280}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:44:44'),
(133, 11, 30, 'POS_COMPLETE_ORDER', 'pos_orders', 15, '{\"payment_method\":\"digital\",\"total\":280,\"received\":280,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:44:45'),
(134, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:46:13'),
(135, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 16, '{\"order_number\":\"POS-20260306-003\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:48:37'),
(136, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 16, '{\"payment_method\":\"digital\",\"total\":56,\"received\":56,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 17:48:39'),
(137, 11, 29, 'UPDATE_BAR_IMAGE', 'bars', 11, '{\"image_path\":\"uploads/bars/bar_11_1772820237452.jpg\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:03:57'),
(138, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:04:02'),
(139, 11, 29, 'UPDATE_USER_ROLE', 'users', 33, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:05:09'),
(140, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 33, '{\"target_user_id\":33,\"permission_count\":24}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:05:09'),
(141, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:05:30'),
(142, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:06:12'),
(143, 11, 29, 'UPDATE_USER_ROLE', 'users', 30, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:06:56'),
(144, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 30, '{\"target_user_id\":30,\"permission_count\":30}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:06:56'),
(145, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:07:16'),
(146, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:26:57'),
(147, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:31:12'),
(148, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:32:14'),
(149, 11, 29, 'UPDATE_USER_ROLE', 'users', 30, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:32:57'),
(150, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 30, '{\"target_user_id\":30,\"permission_count\":34}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:32:57'),
(151, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 17, '{\"order_number\":\"POS-20260306-004\",\"table_id\":null,\"item_count\":2,\"total\":112}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:44:51'),
(152, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 17, '{\"payment_method\":\"digital\",\"total\":112,\"received\":112,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 18:44:52'),
(153, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:08:40'),
(154, 11, 30, 'POS_CREATE_ORDER', 'pos_orders', 18, '{\"order_number\":\"POS-20260306-014\",\"table_id\":null,\"item_count\":2,\"total\":504}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:09:02'),
(155, 11, 30, 'POS_COMPLETE_ORDER', 'pos_orders', 18, '{\"payment_method\":\"digital\",\"total\":504,\"received\":504,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:09:03'),
(156, 11, 30, 'POS_CREATE_ORDER', 'pos_orders', 19, '{\"order_number\":\"POS-20260306-014\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:09:20'),
(157, 11, 30, 'POS_COMPLETE_ORDER', 'pos_orders', 19, '{\"payment_method\":\"digital\",\"total\":56,\"received\":56,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:09:22'),
(158, 11, 30, 'POS_CREATE_ORDER', 'pos_orders', 20, '{\"order_number\":\"POS-20260306-014\",\"table_id\":null,\"item_count\":2,\"total\":112}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:23:46'),
(159, 11, 30, 'POS_COMPLETE_ORDER', 'pos_orders', 20, '{\"payment_method\":\"digital\",\"total\":112,\"received\":112,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:23:48'),
(160, 11, 30, 'POS_CREATE_ORDER', 'pos_orders', 21, '{\"order_number\":\"POS-20260306-014\",\"table_id\":null,\"item_count\":2,\"total\":112}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:25:19'),
(161, 11, 30, 'POS_COMPLETE_ORDER', 'pos_orders', 21, '{\"payment_method\":\"digital\",\"total\":112,\"received\":112,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:25:21'),
(162, 11, 30, 'POS_CREATE_ORDER', 'pos_orders', 22, '{\"order_number\":\"POS-20260306-014\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:26:33'),
(163, 11, 30, 'POS_COMPLETE_ORDER', 'pos_orders', 22, '{\"payment_method\":\"cash\",\"total\":56,\"received\":100,\"change\":44}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-06 19:26:36'),
(164, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:41:39'),
(165, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:51:57'),
(166, 11, 32, 'LOGIN', 'user', 32, '{\"email\":\"ana.staff@bar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:53:27'),
(167, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:54:15'),
(168, 11, 29, 'UPDATE_USER_ROLE', 'users', 32, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:54:45'),
(169, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 32, '{\"target_user_id\":32,\"permission_count\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:54:45'),
(170, 11, 29, 'UPDATE_USER_ROLE', 'users', 35, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:54:50'),
(171, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 35, '{\"target_user_id\":35,\"permission_count\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:54:50'),
(172, 11, 35, 'LOGIN', 'user', 35, '{\"email\":\"gamilojuanbar@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:55:19'),
(173, 11, 30, 'LOGIN', 'user', 30, '{\"email\":\"staff1@juanbar.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 18:56:10'),
(174, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 19:00:35'),
(175, 11, 49, 'LOGIN', 'user', 49, '{\"email\":\"ASDFF@GMAIL.COM\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 19:36:11'),
(176, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 19:42:46'),
(177, 11, 55, 'LOGIN', 'user', 55, '{\"email\":\"teststaff1772999472898@test.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 19:51:34'),
(178, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 19:53:55'),
(179, 11, 60, 'LOGIN', 'user', 60, '{\"email\":\"clarence@gmail.com\",\"role\":\"HR\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 20:05:42'),
(180, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 20:07:31'),
(181, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 20:17:15'),
(182, 11, 29, 'RESET_PASSWORD', 'user', 60, '{\"target_user_id\":60}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 20:17:59'),
(183, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 20:18:54'),
(184, 11, 29, 'RESET_PASSWORD', 'user', 60, '{\"target_user_id\":60}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 20:19:19'),
(185, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 20:20:01'),
(186, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-08 20:20:19'),
(187, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:36:17'),
(188, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:42:56'),
(189, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:46:45'),
(190, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":17}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:46:45'),
(191, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:46:52'),
(192, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":18}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:46:52'),
(193, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:46:59'),
(194, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":20}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:46:59'),
(195, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:47:27'),
(196, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:48:10'),
(197, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:49:10'),
(198, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":28}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:49:10'),
(199, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 18:49:29'),
(200, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:08:38'),
(201, 11, 29, 'UPDATE_INVENTORY', 'inventory_items', 2, '{\"stock_qty\":1000,\"stock_status\":\"normal\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:08:52'),
(202, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:09:49'),
(203, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":45}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:09:49'),
(204, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:10:15'),
(205, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:11:28'),
(206, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:25:10'),
(207, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:47:41'),
(208, 11, 29, 'SEND_DOCUMENT', 'documents', 6, '{\"recipient_user_ids\":[29,59],\"total_sent\":2,\"document_title\":\"contract 2026666\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:48:52'),
(209, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\"]}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 19:53:36'),
(210, 11, 29, 'CREATE_EVENT', 'bar_events', 3, '{\"title\":\"sdfsdf\",\"event_date\":\"2026-03-20\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 20:43:59'),
(211, 11, 29, 'UPLOAD_EVENT_IMAGE', 'bar_events', 3, '{\"image_path\":\"uploads/events/event_11_1773348239752.jpg\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 20:43:59'),
(212, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 20:48:32'),
(213, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:35:07'),
(214, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:35:12'),
(215, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:35:13'),
(216, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:35:30'),
(217, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:35:56'),
(218, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:39:40'),
(219, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:39:55'),
(220, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:46:55'),
(221, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:53:30'),
(222, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 23, '{\"order_number\":\"POS-20260312-001\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:53:42'),
(223, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 23, '{\"payment_method\":\"digital\",\"total\":56,\"received\":56,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:53:52'),
(224, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 24, '{\"order_number\":\"POS-20260312-002\",\"table_id\":4,\"item_count\":1,\"total\":168}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:54:09'),
(225, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 24, '{\"payment_method\":\"digital\",\"total\":168,\"received\":168,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:54:12'),
(226, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 22:55:06'),
(227, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 13:56:34'),
(228, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:40:25'),
(229, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 15:54:47'),
(230, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 16:08:45'),
(231, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 20:10:25'),
(232, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 20:21:54'),
(233, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 25, '{\"order_number\":\"POS-20260313-001\",\"table_id\":3,\"item_count\":3,\"total\":387}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 20:22:21'),
(234, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 25, '{\"payment_method\":\"digital\",\"total\":387,\"received\":387,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 20:22:27'),
(235, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 01:57:17'),
(236, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 02:00:26'),
(237, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 02:04:30'),
(238, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 17:57:22'),
(239, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-14 17:58:32'),
(240, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-14 17:59:48'),
(241, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:00:32'),
(242, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:46'),
(243, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:47'),
(244, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:48'),
(245, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:50'),
(246, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:51'),
(247, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:51'),
(248, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:52'),
(249, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:53'),
(250, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:54'),
(251, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:56'),
(252, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:57'),
(253, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:58'),
(254, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:00:59'),
(255, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:01:00');
INSERT INTO `audit_logs` (`id`, `bar_id`, `user_id`, `action`, `entity`, `entity_id`, `details`, `ip_address`, `user_agent`, `created_at`) VALUES
(256, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:01:01'),
(257, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:01:32'),
(258, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:18'),
(259, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:20'),
(260, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:31'),
(261, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:32'),
(262, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:44'),
(263, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:44'),
(264, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:46'),
(265, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:46'),
(266, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:47'),
(267, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:48'),
(268, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:50'),
(269, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:53'),
(270, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:55'),
(271, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:56'),
(272, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:57'),
(273, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:58'),
(274, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:02:59'),
(275, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:01'),
(276, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:02'),
(277, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:03'),
(278, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:04'),
(279, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:06'),
(280, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:07'),
(281, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:10'),
(282, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:11'),
(283, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:12'),
(284, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:14'),
(285, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:15'),
(286, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:16'),
(287, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:17'),
(288, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:18'),
(289, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:20'),
(290, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:21'),
(291, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:22'),
(292, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:24'),
(293, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:25'),
(294, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:26'),
(295, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:27'),
(296, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:30'),
(297, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:32'),
(298, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:32'),
(299, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:33'),
(300, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:34'),
(301, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:35'),
(302, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:36'),
(303, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:03:37'),
(304, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:04:07'),
(305, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:04:10'),
(306, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:04:25'),
(307, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36', '2026-03-14 18:04:29'),
(308, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:05:36'),
(309, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:05:52'),
(310, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:06:38'),
(311, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:08:24'),
(312, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:13:56'),
(313, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:15:33'),
(314, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:15:45'),
(315, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:17:22'),
(316, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 18:17:29'),
(317, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 19:13:02'),
(318, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 19:14:06'),
(319, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 19:14:06'),
(320, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 19:14:29'),
(321, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 19:14:29'),
(322, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 19:16:31'),
(323, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 19:16:47'),
(324, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 19:19:17'),
(325, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 19:27:29'),
(326, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 19:52:24'),
(327, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 19:53:20'),
(328, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":8}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 19:53:21'),
(329, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 20:02:09'),
(330, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:03:39'),
(331, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":9}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:03:40'),
(332, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 20:03:53'),
(333, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:05:03'),
(334, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":8}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:05:03'),
(335, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:05:24'),
(336, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":9}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:05:24'),
(337, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:05:46'),
(338, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":8}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:05:46'),
(339, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:07:46'),
(340, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":7}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:07:46'),
(341, 11, 59, 'HR_CREATE_ATTENDANCE', 'attendance', 31, '{\"employee_user_id\":\"59\",\"work_date\":\"1223-12-12\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 20:08:02'),
(342, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:08:25'),
(343, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":8}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:08:25'),
(344, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:09:13'),
(345, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":45}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:09:13'),
(346, 11, 29, 'UPDATE_USER_ROLE', 'users', 59, '{\"new_role_id\":5,\"new_role_name\":\"STAFF\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:09:34'),
(347, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":45}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-14 20:09:34'),
(348, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 20:13:21'),
(349, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 20:38:59'),
(350, 11, 29, 'UPDATE_BRANCH', 'bars', 11, '{\"fields_updated\":[\"name\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"email\",\"category\",\"latitude\",\"longitude\",\"description\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 20:40:05'),
(351, 14, 29, 'CREATE_BRANCH', 'bars', 14, '{\"name\":\"south bayb\",\"address\":\"C. M. Recto Avenue, Santa Cruz, Manila, 1003\",\"city\":\"Manila\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 20:59:41'),
(352, 14, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 29, '{\"target_user_id\":29,\"permission_count\":45}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-14 21:16:05'),
(353, 14, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-17 14:41:59'),
(354, 14, 62, 'LOGIN', 'user', 62, '{\"email\":\"juanstaff@tpg.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-17 14:45:50'),
(355, 14, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-17 14:50:03'),
(356, 14, 62, 'LOGIN', 'user', 62, '{\"email\":\"juanstaff@tpg.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-17 14:50:37'),
(357, 14, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-17 14:50:57'),
(358, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 14:53:42'),
(359, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:01:18'),
(360, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 26, '{\"order_number\":\"POS-20260317-001\",\"table_id\":null,\"item_count\":1,\"total\":56}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-17 15:06:22'),
(361, 11, 29, 'POS_CANCEL_ORDER', 'pos_orders', 26, '{}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-17 15:07:22'),
(362, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:10:48'),
(363, 11, 29, 'RESET_PASSWORD', 'user', 29, '{\"target_user_id\":29}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:11:06'),
(364, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:11:52'),
(365, 11, 63, 'LOGIN', 'user', 63, '{\"email\":\"juan@tpg.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:13:04'),
(366, 11, 63, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-17\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:18:02'),
(367, 11, 63, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-17\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:18:20'),
(368, 11, 63, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-17\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:19:33'),
(369, 11, 63, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-17\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:19:37'),
(370, 11, 63, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-17\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:19:37'),
(371, 11, 63, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-17\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:19:47'),
(372, 11, 63, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-17\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:19:47'),
(373, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:20:18'),
(374, 11, 29, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"bar_owner\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:21:17'),
(375, 11, 29, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"bar_owner\",\"attempted_action\":\"clock_out\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:21:18'),
(376, 11, 63, 'LOGIN', 'user', 63, '{\"email\":\"juan@tpg.com\",\"role\":\"staff\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-17 15:25:00'),
(377, 11, 63, 'LOGIN', 'user', 63, '{\"email\":\"juan@tpg.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:27:47'),
(378, 11, 63, 'ATTENDANCE_ON_LEAVE_DAY', 'attendance', NULL, '{\"leave_request_id\":24,\"work_date\":\"2026-03-17\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:27:52'),
(379, 11, 63, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-17\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:27:52'),
(380, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:28:04'),
(381, 11, 29, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"bar_owner\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:29:43'),
(382, 11, 29, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"bar_owner\",\"attempted_action\":\"clock_out\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:29:44'),
(383, 11, 29, 'UPDATE_MENU_ITEM', 'menu_items', 2, '{\"fields_updated\":[\"is_available\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:30:17'),
(384, 11, 29, 'UPDATE_MENU_ITEM', 'menu_items', 2, '{\"fields_updated\":[\"is_available\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:30:17'),
(385, 11, 29, 'UPDATE_MENU_ITEM', 'menu_items', 2, '{\"fields_updated\":[\"is_available\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:30:18'),
(386, 11, 29, 'UPDATE_MENU_ITEM', 'menu_items', 2, '{\"fields_updated\":[\"is_available\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:30:18'),
(387, 11, 29, 'UPDATE_MENU_ITEM', 'menu_items', 2, '{\"fields_updated\":[\"is_available\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:30:40'),
(388, 11, 29, 'UPDATE_MENU_ITEM', 'menu_items', 2, '{\"fields_updated\":[\"is_available\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:30:40'),
(389, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-17 15:45:27'),
(390, 11, 29, 'POS_CREATE_ORDER', 'pos_orders', 27, '{\"order_number\":\"POS-20260317-002\",\"table_id\":null,\"item_count\":2,\"total\":499}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-17 15:48:53'),
(391, 11, 29, 'POS_COMPLETE_ORDER', 'pos_orders', 27, '{\"payment_method\":\"digital\",\"total\":499,\"received\":499,\"change\":0}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-17 15:48:54'),
(392, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"category\",\"price_range\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 15:57:58'),
(393, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-17 16:08:01'),
(394, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"category\",\"price_range\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 17:14:51'),
(395, 11, 29, 'CREATE_EVENT', 'bar_events', 4, '{\"title\":\"sdgfsefsdf\",\"event_date\":\"2026-03-19\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 17:17:30'),
(396, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-17 18:05:42'),
(397, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":46}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-17 18:07:24'),
(398, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"category\",\"price_range\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-17 18:24:15'),
(399, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"category\",\"price_range\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\",\"gcash_number\",\"gcash_account_name\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 18:26:12'),
(400, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 20:30:40'),
(401, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 20:35:50'),
(402, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 63, '{\"target_user_id\":63,\"permission_count\":46}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-17 20:43:48'),
(403, 14, 36, 'SUPER_ADMIN_APPROVE_BAR', 'bar', 14, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 16:10:18'),
(404, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-18 17:28:56'),
(405, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:03:19'),
(406, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"category\",\"price_range\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\",\"gcash_number\",\"gcash_account_name\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:03:30'),
(407, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"category\",\"price_range\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\",\"gcash_number\",\"gcash_account_name\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:03:30'),
(408, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"category\",\"price_range\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\",\"gcash_number\",\"gcash_account_name\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:03:30'),
(409, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"category\",\"price_range\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\",\"gcash_number\",\"gcash_account_name\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:03:31'),
(410, 11, 66, 'CREATE_RESERVATION', 'reservations', 6, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-11-12\",\"reservation_time\":\"12:12\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:09:02'),
(411, 11, 66, 'CREATE_RESERVATION', 'reservations', 7, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-12-12\",\"reservation_time\":\"12:12\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:10:00'),
(412, 11, 66, 'CREATE_RESERVATION', 'reservations', 8, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-12-12\",\"reservation_time\":\"13:12\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:17:13'),
(413, 11, 66, 'CREATE_PAYMENT', 'payment_transactions', 8, '{\"payment_type\":\"reservation\",\"related_id\":8,\"amount\":10000,\"payment_method\":\"paymaya\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:17:13'),
(414, 11, 38, 'CREATE_RESERVATION', 'reservations', 9, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-01-30\",\"reservation_time\":\"16:20\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:21:38'),
(415, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 9, '{\"payment_type\":\"reservation\",\"related_id\":9,\"amount\":10000,\"payment_method\":\"paymaya\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 18:21:38'),
(416, 11, 38, 'CREATE_RESERVATION', 'reservations', 10, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-03-18\",\"reservation_time\":\"19:26\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 19:26:32'),
(417, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 10, '{\"payment_type\":\"reservation\",\"related_id\":10,\"amount\":567,\"payment_method\":\"gcash\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 19:26:33'),
(418, 11, 38, 'CREATE_RESERVATION', 'reservations', 11, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-03-20\",\"reservation_time\":\"20:27\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 19:27:52'),
(419, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 11, '{\"payment_type\":\"reservation\",\"related_id\":11,\"amount\":767,\"payment_method\":\"gcash\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 19:27:52'),
(420, 11, 38, 'CREATE_RESERVATION', 'reservations', 12, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-03-29\",\"reservation_time\":\"20:01\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 20:01:24'),
(421, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 12, '{\"payment_type\":\"reservation\",\"related_id\":12,\"amount\":567,\"payment_method\":\"gcash\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 20:01:24'),
(422, 11, 38, 'CREATE_RESERVATION', 'reservations', 13, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-03-29\",\"reservation_time\":\"04:11\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 20:10:41'),
(423, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 13, '{\"payment_type\":\"reservation\",\"related_id\":13,\"amount\":567,\"payment_method\":\"gcash\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 20:10:41'),
(424, 11, 38, 'CREATE_RESERVATION', 'reservations', 14, '{\"table_id\":3,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:29\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 13:29:33'),
(425, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 14, '{\"payment_type\":\"reservation\",\"related_id\":14,\"amount\":446,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 13:29:33'),
(426, 11, 38, 'CREATE_RESERVATION', 'reservations', 15, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-03-23\",\"reservation_time\":\"21:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:15:34'),
(427, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 15, '{\"payment_type\":\"reservation\",\"related_id\":15,\"amount\":567,\"payment_method\":\"gcash\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:15:34'),
(428, 11, 38, 'CREATE_RESERVATION', 'reservations', 16, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-03-31\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:22:17'),
(429, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 16, '{\"payment_type\":\"reservation\",\"related_id\":16,\"amount\":767,\"payment_method\":\"gcash\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:22:24'),
(430, 11, 38, 'CREATE_RESERVATION', 'reservations', 17, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-03-19\",\"reservation_time\":\"23:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:28:31'),
(431, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 17, '{\"payment_type\":\"reservation\",\"related_id\":17,\"amount\":567,\"payment_method\":\"gcash\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:28:32'),
(432, 11, 38, 'CREATE_RESERVATION', 'reservations', 18, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:31:44'),
(433, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 18, '{\"payment_type\":\"reservation\",\"related_id\":18,\"amount\":567,\"payment_method\":\"gcash\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:31:44'),
(434, 11, 38, 'CREATE_RESERVATION', 'reservations', 19, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:57:47'),
(435, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 19, '{\"payment_type\":\"reservation\",\"related_id\":19,\"amount\":767,\"payment_method\":\"paymaya\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 14:57:48'),
(436, 11, 38, 'CREATE_RESERVATION', 'reservations', 20, '{\"table_id\":3,\"event_id\":null,\"reservation_date\":\"2026-03-29\",\"reservation_time\":\"23:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:21:10'),
(437, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 20, '{\"payment_type\":\"reservation\",\"related_id\":20,\"amount\":167,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:21:10'),
(438, 11, 38, 'CREATE_RESERVATION', 'reservations', 21, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-03-22\",\"reservation_time\":\"19:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:26:44');
INSERT INTO `audit_logs` (`id`, `bar_id`, `user_id`, `action`, `entity`, `entity_id`, `details`, `ip_address`, `user_agent`, `created_at`) VALUES
(439, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 21, '{\"payment_type\":\"reservation\",\"related_id\":21,\"amount\":904,\"payment_method\":\"gcash\",\"line_items_count\":2}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:26:44'),
(440, 11, 38, 'CREATE_RESERVATION', 'reservations', 22, '{\"table_id\":3,\"event_id\":null,\"reservation_date\":\"2026-03-31\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:28:44'),
(441, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 22, '{\"payment_type\":\"reservation\",\"related_id\":22,\"amount\":278,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:28:44'),
(442, 11, 38, 'CREATE_RESERVATION', 'reservations', 23, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-04-13\",\"reservation_time\":\"19:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:45:44'),
(443, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 23, '{\"payment_type\":\"reservation\",\"related_id\":23,\"amount\":400,\"payment_method\":\"gcash\",\"line_items_count\":1}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:45:44'),
(444, 11, 38, 'CREATE_RESERVATION', 'reservations', 24, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-04-29\",\"reservation_time\":\"19:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:53:15'),
(445, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 24, '{\"payment_type\":\"reservation\",\"related_id\":24,\"amount\":600,\"payment_method\":\"gcash\",\"line_items_count\":1}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 16:53:15'),
(446, 11, 38, 'CREATE_RESERVATION', 'reservations', 25, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-03-22\",\"reservation_time\":\"19:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 17:49:12'),
(447, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 25, '{\"payment_type\":\"reservation\",\"related_id\":25,\"amount\":1551,\"payment_method\":\"gcash\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 17:49:12'),
(448, 11, 38, 'CREATE_RESERVATION', 'reservations', 26, '{\"table_id\":3,\"event_id\":null,\"reservation_date\":\"2026-03-22\",\"reservation_time\":\"19:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 19:46:04'),
(449, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 26, '{\"payment_type\":\"reservation\",\"related_id\":26,\"amount\":951,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 19:46:04'),
(450, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 17:58:33'),
(451, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-21 18:03:49'),
(452, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-21 18:10:40'),
(453, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 18:16:33'),
(454, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:43:54'),
(455, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 63, '{\"target_user_id\":63,\"permission_count\":33}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:46:10'),
(456, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:47:11'),
(457, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:47:39'),
(458, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":1}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:49:12'),
(459, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:49:36'),
(460, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:49:42'),
(461, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:49:44'),
(462, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:49:44'),
(463, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 20:52:31'),
(464, 11, 29, 'UPDATE_TABLE', 'bar_tables', 1, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:21:32'),
(465, 11, 29, 'UPDATE_TABLE', 'bar_tables', 1, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:21:33'),
(466, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:26:28'),
(467, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:26:32'),
(468, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:26:33'),
(469, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:26:33'),
(470, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:26:49'),
(471, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:26:53'),
(472, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:26:54'),
(473, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:27:18'),
(474, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":2}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:30:15'),
(475, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:30:35'),
(476, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:31:36'),
(477, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"staff\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:32:07'),
(478, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:32:49'),
(479, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 63, '{\"target_user_id\":63,\"permission_count\":10}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:38:05'),
(480, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:38:10'),
(481, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:38:17'),
(482, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":10}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:38:28'),
(483, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:38:34'),
(484, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:39:21'),
(485, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:39:58'),
(486, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":9}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:49:44'),
(487, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:49:48'),
(488, 11, 59, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"employee\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:50:46'),
(489, 11, 59, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"employee\",\"attempted_action\":\"clock_out\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:50:46'),
(490, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:50:58'),
(491, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 63, '{\"target_user_id\":63,\"permission_count\":10}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:52:52'),
(492, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:52:58'),
(493, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:53:11'),
(494, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 21:58:28'),
(495, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:00:38'),
(496, 11, 29, 'UPDATE_TABLE', 'bar_tables', 3, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:06:59'),
(497, 11, 29, 'UPDATE_TABLE', 'bar_tables', 3, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:07:00'),
(498, 11, 29, 'UPDATE_TABLE', 'bar_tables', 1, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:07:03'),
(499, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:10:56'),
(500, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:11:04'),
(501, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":10}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:14:42'),
(502, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:14:55'),
(503, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:14:59'),
(504, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:18:04'),
(505, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":9}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:18:18'),
(506, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":12}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:18:47'),
(507, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:20:25'),
(508, 11, 59, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"employee\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:20:27'),
(509, 11, 59, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"employee\",\"attempted_action\":\"clock_out\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:20:27'),
(510, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:20:37'),
(511, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":11}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:21:54'),
(512, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:22:12'),
(513, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:22:16'),
(514, 11, 59, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"employee\",\"attempted_action\":\"clock_out\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:22:22'),
(515, 11, 59, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"employee\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:22:22'),
(516, 11, 59, 'ATTENDANCE_ON_LEAVE_DAY', 'attendance', NULL, '{\"leave_request_id\":25,\"work_date\":\"2026-03-22\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:24:28'),
(517, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:24:28'),
(518, 11, 59, 'ATTENDANCE_ON_LEAVE_DAY', 'attendance', NULL, '{\"leave_request_id\":25,\"work_date\":\"2026-03-22\",\"attempted_action\":\"clock_out\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:24:29'),
(519, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:24:29'),
(520, 11, 59, 'ATTENDANCE_ON_LEAVE_DAY', 'attendance', NULL, '{\"leave_request_id\":25,\"work_date\":\"2026-03-22\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:25:07'),
(521, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:25:07'),
(522, 11, 59, 'ATTENDANCE_ON_LEAVE_DAY', 'attendance', NULL, '{\"leave_request_id\":25,\"work_date\":\"2026-03-22\",\"attempted_action\":\"clock_out\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:25:08'),
(523, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:25:08'),
(524, 11, 59, 'ATTENDANCE_ON_LEAVE_DAY', 'attendance', NULL, '{\"leave_request_id\":25,\"work_date\":\"2026-03-22\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:25:09'),
(525, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:25:09'),
(526, 11, 59, 'ATTENDANCE_ON_LEAVE_DAY', 'attendance', NULL, '{\"leave_request_id\":25,\"work_date\":\"2026-03-22\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:25:11'),
(527, 11, 59, 'CLOCK_OUT_NO_CLOCK_IN', 'attendance', NULL, '{\"work_date\":\"2026-03-22\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:25:11'),
(528, 11, 59, 'ATTENDANCE_ON_LEAVE_DAY', 'attendance', NULL, '{\"leave_request_id\":25,\"work_date\":\"2026-03-22\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:27:16'),
(529, 11, 59, 'ATTENDANCE_ON_LEAVE_DAY', 'attendance', NULL, '{\"leave_request_id\":25,\"work_date\":\"2026-03-22\",\"attempted_action\":\"clock_out\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:27:18'),
(530, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:27:47'),
(531, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":21}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:36:55'),
(532, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:37:03'),
(533, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:37:09'),
(534, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":21}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:37:15'),
(535, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 59, '{\"target_user_id\":59,\"permission_count\":21}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:37:25'),
(536, 11, 59, 'LOGIN', 'user', 59, '{\"email\":\"asleykerby12@gmail.com\",\"role\":\"employee\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:37:28'),
(537, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:38:03'),
(538, 11, 29, 'UPDATE_TABLE', 'bar_tables', 1, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:56:52'),
(539, 11, 29, 'UPDATE_TABLE', 'bar_tables', 2, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:56:53'),
(540, 11, 29, 'UPDATE_TABLE', 'bar_tables', 3, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:56:54'),
(541, 11, 29, 'UPDATE_TABLE', 'bar_tables', 4, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:56:56'),
(542, 11, 29, 'UPDATE_TABLE', 'bar_tables', 1, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:57:06'),
(543, 11, 29, 'UPDATE_TABLE', 'bar_tables', 2, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:57:08'),
(544, 11, 29, 'UPDATE_TABLE', 'bar_tables', 3, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:57:09'),
(545, 11, 29, 'UPDATE_TABLE', 'bar_tables', 4, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:57:10'),
(546, 11, 29, 'UPDATE_TABLE', 'bar_tables', 1, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:57:26'),
(547, 11, 66, 'CREATE_RESERVATION', 'reservations', 27, '{\"table_id\":1,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:57:34'),
(548, 11, 66, 'CREATE_PAYMENT', 'payment_transactions', 27, '{\"payment_type\":\"reservation\",\"related_id\":27,\"amount\":612,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:57:34'),
(549, 11, 66, 'CREATE_RESERVATION', 'reservations', 28, '{\"table_id\":1,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:58:48'),
(550, 11, 66, 'CREATE_PAYMENT', 'payment_transactions', 28, '{\"payment_type\":\"reservation\",\"related_id\":28,\"amount\":612,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 22:58:48'),
(551, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:07:57'),
(552, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:17:14'),
(553, 11, 63, 'DEDUCTION_SETTINGS_UPDATED', 'employee_deduction_settings', 63, '{\"changed_by\":29,\"old_settings\":{\"id\":1,\"bar_id\":11,\"user_id\":63,\"bir_enabled\":1,\"bir_exemption_status\":\"S\",\"sss_enabled\":0,\"sss_number\":null,\"philhealth_enabled\":0,\"philhealth_number\":null,\"late_deduction_enabled\":0,\"created_at\":\"2026-03-21T23:27:37.000Z\",\"updated_at\":\"2026-03-21T23:27:37.000Z\"},\"new_settings\":{\"bir_enabled\":1,\"bir_exemption_status\":\"S\",\"sss_enabled\":true,\"sss_number\":\"\",\"philhealth_enabled\":true,\"philhealth_number\":\"\",\"late_deduction_enabled\":false}}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:28:05'),
(554, 11, 29, 'DEDUCTION_SETTINGS_UPDATED', 'employee_deduction_settings', 29, '{\"changed_by\":29,\"old_settings\":null,\"new_settings\":{\"bir_enabled\":true,\"bir_exemption_status\":\"S\",\"sss_enabled\":true,\"sss_number\":\"\",\"philhealth_enabled\":true,\"philhealth_number\":\"\",\"late_deduction_enabled\":true}}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:28:15'),
(555, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 29, '{\"target_user_id\":29,\"permission_count\":47}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:31:03'),
(556, 11, 29, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"bar_owner\",\"attempted_action\":\"clock_in\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:31:11'),
(557, 11, 29, 'BLOCKED_ATTENDANCE', 'attendance', NULL, '{\"reason\":\"invalid_role\",\"role\":\"bar_owner\",\"attempted_action\":\"clock_out\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:31:12'),
(558, 11, 29, 'UPDATE_TABLE', 'bar_tables', 4, '{\"fields_updated\":[\"table_number\",\"capacity\",\"price\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:37:09'),
(559, 11, 29, 'UPDATE_TABLE', 'bar_tables', 3, '{\"fields_updated\":[\"table_number\",\"capacity\",\"price\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:37:16'),
(560, 11, 29, 'UPDATE_TABLE', 'bar_tables', 3, '{\"fields_updated\":[\"table_number\",\"capacity\",\"price\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:37:27'),
(561, 11, 29, 'UPDATE_TABLE', 'bar_tables', 2, '{\"fields_updated\":[\"table_number\",\"capacity\",\"price\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:37:40'),
(562, 11, 29, 'UPDATE_TABLE', 'bar_tables', 1, '{\"fields_updated\":[\"table_number\",\"capacity\",\"price\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:37:49'),
(563, 11, 29, 'UPDATE_TABLE', 'bar_tables', 3, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:37:53'),
(564, 11, 29, 'UPDATE_TABLE', 'bar_tables', 2, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:37:54'),
(565, 11, 29, 'UPDATE_TABLE', 'bar_tables', 4, '{\"fields_updated\":[\"manual_status\",\"is_active\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-21 23:37:56'),
(566, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 00:38:21'),
(567, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 00:58:10'),
(568, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 01:06:52'),
(569, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 01:10:25'),
(570, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 01:32:22'),
(571, 11, 66, 'CREATE_RESERVATION', 'reservations', 29, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 01:33:38'),
(572, 11, 66, 'CREATE_PAYMENT', 'payment_transactions', 29, '{\"payment_type\":\"reservation\",\"related_id\":29,\"amount\":712,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 01:33:39'),
(573, 11, 66, 'CREATE_RESERVATION', 'reservations', 30, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 01:34:41'),
(574, 11, 66, 'CREATE_PAYMENT', 'payment_transactions', 30, '{\"payment_type\":\"reservation\",\"related_id\":30,\"amount\":712,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 01:34:41'),
(575, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 29, '{\"target_user_id\":29,\"permission_count\":50}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 02:04:24'),
(576, 11, 29, 'SEND_DOCUMENT', 'documents', 7, '{\"recipient_user_ids\":[29,59,60,63],\"total_sent\":4,\"document_title\":\"ccc\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 02:11:06'),
(577, 11, 29, 'UPDATE_USER_PERMISSIONS', 'user_permissions', 29, '{\"target_user_id\":29,\"permission_count\":0}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 02:13:29'),
(578, 11, 29, 'SEND_DOCUMENT', 'documents', 5, '{\"recipient_user_ids\":[29],\"total_sent\":1,\"document_title\":\"contract 2026666\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 02:14:16'),
(579, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-22 02:59:30'),
(580, 11, 29, 'UPDATE_BAR_DETAILS', 'bars', 11, '{\"fields_updated\":[\"name\",\"description\",\"address\",\"city\",\"state\",\"zip_code\",\"phone\",\"contact_number\",\"email\",\"website\",\"category\",\"price_range\",\"latitude\",\"longitude\",\"accept_cash_payment\",\"accept_online_payment\",\"accept_gcash\",\"minimum_reservation_deposit\",\"gcash_number\",\"gcash_account_name\",\"monday_hours\",\"tuesday_hours\",\"wednesday_hours\",\"thursday_hours\",\"friday_hours\",\"saturday_hours\",\"sunday_hours\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-22 03:00:33'),
(581, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-22 03:01:49'),
(582, 11, 29, 'UPDATE_INVENTORY', 'inventory_items', 4, '{\"cost_price\":56,\"old_cost_price\":0,\"stock_qty\":13,\"name\":\"bulag\",\"stock_status\":\"normal\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-22 03:16:07'),
(583, 11, 29, 'UPDATE_INVENTORY', 'inventory_items', 4, '{\"cost_price\":56,\"old_cost_price\":0,\"stock_qty\":5,\"name\":\"bulag\",\"stock_status\":\"low\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-22 03:16:32'),
(584, 11, 29, 'UPDATE_INVENTORY', 'inventory_items', 1, '{\"cost_price\":55,\"old_cost_price\":0,\"stock_qty\":1,\"name\":\"Red Horse Beer\",\"stock_status\":\"low\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-22 03:17:37'),
(585, 11, 29, 'UPDATE_INVENTORY', 'inventory_items', 2, '{\"cost_price\":55,\"old_cost_price\":0,\"stock_qty\":0,\"name\":\"Red Horse Beer\",\"stock_status\":\"critical\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-22 03:17:49'),
(586, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-22 03:31:51'),
(587, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 04:30:01'),
(588, 11, 66, 'CREATE_RESERVATION', 'reservations', 31, '{\"table_id\":1,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:15:18'),
(589, 11, 66, 'CREATE_PAYMENT', 'payment_transactions', 31, '{\"payment_type\":\"reservation\",\"related_id\":31,\"amount\":667,\"payment_method\":\"gcash\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:15:19'),
(590, 11, 66, 'CREATE_RESERVATION', 'reservations', 32, '{\"table_id\":1,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:19:10'),
(591, 11, 66, 'CREATE_PAYMENT', 'payment_transactions', 32, '{\"payment_type\":\"reservation\",\"related_id\":32,\"amount\":612,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:19:10'),
(592, 11, 29, 'REJECT_RESERVATION', 'reservations', 7, '{\"reservation_id\":7,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:22:55'),
(593, 11, 29, 'REJECT_RESERVATION', 'reservations', 6, '{\"reservation_id\":6,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:22:57'),
(594, 11, 29, 'REJECT_RESERVATION', 'reservations', 16, '{\"reservation_id\":16,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:03'),
(595, 11, 29, 'REJECT_RESERVATION', 'reservations', 12, '{\"reservation_id\":12,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:08'),
(596, 11, 29, 'REJECT_RESERVATION', 'reservations', 13, '{\"reservation_id\":13,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:09'),
(597, 11, 29, 'REJECT_RESERVATION', 'reservations', 14, '{\"reservation_id\":14,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:11'),
(598, 11, 29, 'REJECT_RESERVATION', 'reservations', 32, '{\"reservation_id\":32,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:12'),
(599, 11, 29, 'REJECT_RESERVATION', 'reservations', 15, '{\"reservation_id\":15,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:13'),
(600, 11, 29, 'REJECT_RESERVATION', 'reservations', 11, '{\"reservation_id\":11,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:15'),
(601, 11, 29, 'REJECT_RESERVATION', 'reservations', 17, '{\"reservation_id\":17,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:16'),
(602, 11, 29, 'REJECT_RESERVATION', 'reservations', 10, '{\"reservation_id\":10,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:18'),
(603, 11, 29, 'REJECT_RESERVATION', 'reservations', 9, '{\"reservation_id\":9,\"new_status\":\"rejected\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:23:19'),
(604, 11, 66, 'CREATE_RESERVATION', 'reservations', 33, '{\"table_id\":1,\"event_id\":null,\"reservation_date\":\"2026-03-24\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:24:51'),
(605, 11, 66, 'CREATE_PAYMENT', 'payment_transactions', 33, '{\"payment_type\":\"reservation\",\"related_id\":33,\"amount\":612,\"payment_method\":\"gcash\",\"line_items_count\":3}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:24:51'),
(606, 11, 38, 'CREATE_RESERVATION', 'reservations', 34, '{\"table_id\":1,\"event_id\":null,\"reservation_date\":\"2026-03-23\",\"reservation_time\":\"19:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:26:43'),
(607, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 34, '{\"payment_type\":\"reservation\",\"related_id\":34,\"amount\":667,\"payment_method\":\"gcash\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:26:43'),
(608, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:29:01'),
(609, 11, 38, 'CREATE_RESERVATION', 'reservations', 35, '{\"table_id\":2,\"event_id\":null,\"reservation_date\":\"2026-03-23\",\"reservation_time\":\"19:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:30:29'),
(610, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 35, '{\"payment_type\":\"reservation\",\"related_id\":35,\"amount\":567,\"payment_method\":\"gcash\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:30:29'),
(611, 11, 29, 'APPROVE_RESERVATION', 'reservations', 33, '{\"reservation_id\":33,\"new_status\":\"approved\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:30:52'),
(612, 11, 38, 'CREATE_RESERVATION', 'reservations', 36, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-03-23\",\"reservation_time\":\"19:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:54:15'),
(613, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 36, '{\"payment_type\":\"reservation\",\"related_id\":36,\"amount\":767,\"payment_method\":\"gcash\",\"line_items_count\":4}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 14:54:15'),
(614, 11, 38, 'CREATE_RESERVATION', 'reservations', 37, '{\"table_id\":3,\"event_id\":null,\"reservation_date\":\"2026-03-23\",\"reservation_time\":\"19:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 15:52:40'),
(615, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 37, '{\"payment_type\":\"reservation\",\"related_id\":37,\"amount\":1288,\"payment_method\":\"gcash\",\"line_items_count\":2}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 15:52:40'),
(616, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 15:56:44'),
(617, 11, 29, 'LOGIN', 'user', 29, '{\"email\":\"juan.owner1234243@tpg.com\",\"role\":\"bar_owner\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 16:03:09'),
(618, 11, 29, 'UPDATE_INVENTORY', 'inventory_items', 1, '{\"cost_price\":55,\"old_cost_price\":0,\"stock_qty\":0,\"name\":\"Red Horse Beer\",\"stock_status\":\"critical\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 16:14:38');
INSERT INTO `audit_logs` (`id`, `bar_id`, `user_id`, `action`, `entity`, `entity_id`, `details`, `ip_address`, `user_agent`, `created_at`) VALUES
(619, 11, 38, 'CREATE_RESERVATION', 'reservations', 38, '{\"table_id\":4,\"event_id\":null,\"reservation_date\":\"2026-03-23\",\"reservation_time\":\"20:00:00\",\"status\":\"pending\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 16:27:45'),
(620, 11, 38, 'CREATE_PAYMENT', 'payment_transactions', 38, '{\"payment_type\":\"reservation\",\"related_id\":38,\"amount\":656,\"payment_method\":\"gcash\",\"line_items_count\":2}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-22 16:27:45');

-- --------------------------------------------------------

--
-- Table structure for table `bars`
--

CREATE TABLE `bars` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `address` varchar(255) NOT NULL,
  `city` varchar(100) NOT NULL,
  `state` varchar(100) DEFAULT NULL,
  `zip_code` varchar(20) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `contact_number` varchar(30) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `price_range` varchar(50) DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  `logo_path` varchar(500) DEFAULT NULL,
  `video_path` varchar(500) DEFAULT NULL,
  `monday_hours` varchar(50) DEFAULT NULL,
  `tuesday_hours` varchar(50) DEFAULT NULL,
  `wednesday_hours` varchar(50) DEFAULT NULL,
  `thursday_hours` varchar(50) DEFAULT NULL,
  `friday_hours` varchar(50) DEFAULT NULL,
  `saturday_hours` varchar(50) DEFAULT NULL,
  `sunday_hours` varchar(50) DEFAULT NULL,
  `owner_id` int(11) DEFAULT NULL,
  `status` enum('active','inactive','pending') DEFAULT 'pending',
  `is_locked` tinyint(1) NOT NULL DEFAULT 0,
  `lifecycle_status` enum('pending','active','suspended') DEFAULT NULL,
  `suspension_message` text DEFAULT NULL,
  `rating` decimal(3,2) DEFAULT 0.00,
  `review_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `latitude` decimal(10,7) DEFAULT NULL COMMENT 'GPS latitude for map pin',
  `longitude` decimal(10,7) DEFAULT NULL COMMENT 'GPS longitude for map pin',
  `accept_cash_payment` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Accept cash payments for reservations',
  `accept_online_payment` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Accept online payments for reservations',
  `accept_gcash` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Accept GCash payments',
  `gcash_number` varchar(20) DEFAULT NULL COMMENT 'GCash mobile number for payouts',
  `gcash_account_name` varchar(255) DEFAULT NULL COMMENT 'Registered GCash account name',
  `payout_enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Enable/disable payouts for this bar',
  `is_branch` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0=main bar, 1=branch',
  `parent_bar_id` int(11) DEFAULT NULL COMMENT 'FK to bars.id of the main bar (NULL=main bar)',
  `minimum_reservation_deposit` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Minimum deposit required for reservations'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bars`
--

INSERT INTO `bars` (`id`, `name`, `description`, `address`, `city`, `state`, `zip_code`, `phone`, `contact_number`, `email`, `website`, `category`, `price_range`, `image_path`, `logo_path`, `video_path`, `monday_hours`, `tuesday_hours`, `wednesday_hours`, `thursday_hours`, `friday_hours`, `saturday_hours`, `sunday_hours`, `owner_id`, `status`, `is_locked`, `lifecycle_status`, `suspension_message`, `rating`, `review_count`, `created_at`, `updated_at`, `latitude`, `longitude`, `accept_cash_payment`, `accept_online_payment`, `accept_gcash`, `gcash_number`, `gcash_account_name`, `payout_enabled`, `is_branch`, `parent_bar_id`, `minimum_reservation_deposit`) VALUES
(10, 'South Vibes', 'CGE', 'GOVERNORS DRIVE', 'Dasmarinas', 'Cavite', '4114', '09569370220', NULL, 'montejoasley13@gmail.com', 'https://www.facebook.com/akm.juancho', 'sports-bar', '$', 'assets/images/bars/1769975720_697fafa87c01e.jpg', NULL, NULL, '7:00PM - 10:00PM', '7:00PM - 10:00PM', '7:00PM - 10:00PM', '7:00PM - 10:00PM', '7:00PM - 10:00PM', '7:00PM - 10:00PM', '7:00PM - 10:00PM', 8, 'active', 0, 'active', NULL, 0.00, 0, '2026-02-01 19:55:20', '2026-03-05 14:46:30', NULL, NULL, 1, 0, 0, NULL, NULL, 1, 0, NULL, 0.00),
(11, 'Juan Bar', 'malupitang bar ', 'Kaytambog, Indang, Cavite, Calabarzon, 4122, Philippines', 'Dasma', 'Cavite', '4122', '', '09123456789', '', 'https://chatgpt.com/c/699770bf-7308-839e-9349-cbf9aac48546', '', '0', 'uploads/bars/bar_11_1772820237452.jpg', 'uploads/bars/bar_11_1773344849741.jpg', 'uploads/bars/bar_gif_11_1773519883957.gif', '7:00 PM - 10:00 PM', '8:00 PM - 12:00 PM', '7:00 PM - 12:00 PM', '7:00 PM - 12:00 PM', '7:00 PM - 12:00 PM', '7:00 PM - 12:00 PM', '7:00 PM - 12:00 PM', 14, 'active', 0, 'active', NULL, 3.00, 1, '2026-02-06 15:42:56', '2026-03-22 03:00:33', 14.1891984, 120.8660889, 1, 1, 1, '09123456789', 'asd', 1, 0, NULL, 10000.00),
(12, 'melulu', NULL, 'asasasdf', 'cavite', 'gen tri', '4107', '09123456789', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', 0, 'active', NULL, 0.00, 0, '2026-02-27 20:39:29', '2026-03-05 14:46:27', NULL, NULL, 1, 0, 0, NULL, NULL, 1, 0, NULL, 0.00),
(13, 'melolo', NULL, 'sadfsadf', '123123', '231', '12313', '09123456789', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', 0, 'active', NULL, 0.00, 0, '2026-02-28 20:53:13', '2026-03-05 14:46:28', NULL, NULL, 1, 0, 0, NULL, NULL, 1, 0, NULL, 0.00),
(14, 'south bayb', 'maasim', 'C. M. Recto Avenue, Santa Cruz, Manila, 1003', 'Manila', 'cavite', '1003', NULL, NULL, NULL, NULL, 'karaoke bar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 14, 'active', 0, 'active', NULL, 0.00, 0, '2026-03-14 20:59:41', '2026-03-18 16:10:18', 14.6043090, 120.9786558, 1, 0, 0, NULL, NULL, 1, 0, NULL, 0.00);

-- --------------------------------------------------------

--
-- Table structure for table `bar_amenities`
--

CREATE TABLE `bar_amenities` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `amenity` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bar_amenities`
--

INSERT INTO `bar_amenities` (`id`, `bar_id`, `amenity`) VALUES
(3, 11, 'pool-table'),
(4, 11, 'private-room');

-- --------------------------------------------------------

--
-- Table structure for table `bar_comment_reactions`
--

CREATE TABLE `bar_comment_reactions` (
  `id` int(11) NOT NULL,
  `comment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reaction` varchar(20) NOT NULL DEFAULT 'like',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bar_comment_replies`
--

CREATE TABLE `bar_comment_replies` (
  `id` int(11) NOT NULL,
  `comment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reply` text NOT NULL,
  `parent_reply_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bar_events`
--

CREATE TABLE `bar_events` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `event_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `entry_price` decimal(10,2) DEFAULT NULL,
  `max_capacity` int(11) DEFAULT NULL,
  `current_bookings` int(11) DEFAULT 0,
  `status` enum('active','cancelled','completed') DEFAULT 'active',
  `image_url` varchar(500) DEFAULT NULL,
  `image_path` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `archived_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bar_events`
--

INSERT INTO `bar_events` (`id`, `bar_id`, `title`, `description`, `event_date`, `start_time`, `end_time`, `entry_price`, `max_capacity`, `current_bookings`, `status`, `image_url`, `image_path`, `created_at`, `updated_at`, `archived_at`) VALUES
(1, 11, 'dj Aubrey in the house', 'the DJ will be aubreyyyyyyyyyyyyyy', '2026-03-10', '20:00:00', '12:00:00', NULL, NULL, 0, 'cancelled', NULL, 'uploads/events/event_11_1772643161276.jpg', '2026-02-28 18:57:38', '2026-03-05 20:00:37', NULL),
(2, 11, 'dj again', NULL, '2026-03-05', '19:00:00', '13:00:00', NULL, 59, 0, 'cancelled', NULL, 'uploads/events/event_11_1772721824572.jpg', '2026-03-05 14:43:44', '2026-03-08 18:30:30', NULL),
(3, 11, 'sdfsdf', 'sdfsdfsdf', '2026-03-20', '19:00:00', '23:00:00', NULL, NULL, 0, 'active', NULL, 'uploads/events/event_11_1773348239752.jpg', '2026-03-12 20:43:59', '2026-03-12 20:43:59', NULL),
(4, 11, 'sdgfsefsdf', 'sdfsdfsdfsdf', '2026-03-19', '01:16:00', '13:17:00', 0.00, 12, 0, 'active', NULL, 'uploads/events/event_11_1774149963918.jpg', '2026-03-17 17:17:30', '2026-03-22 03:26:03', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `bar_events_archive`
--

CREATE TABLE `bar_events_archive` (
  `id` int(11) NOT NULL,
  `original_event_id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `event_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `entry_price` decimal(10,2) DEFAULT NULL,
  `max_capacity` int(11) DEFAULT NULL,
  `current_bookings` int(11) DEFAULT NULL,
  `status` enum('active','cancelled','completed') DEFAULT 'cancelled',
  `image_url` varchar(500) DEFAULT NULL,
  `image_path` varchar(500) DEFAULT NULL,
  `original_created_at` datetime DEFAULT NULL,
  `original_updated_at` datetime DEFAULT NULL,
  `archived_at` datetime NOT NULL DEFAULT current_timestamp(),
  `archived_by_user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bar_followers`
--

CREATE TABLE `bar_followers` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bar_followers`
--

INSERT INTO `bar_followers` (`id`, `bar_id`, `user_id`, `created_at`) VALUES
(2, 11, 59, '2026-03-13 13:57:54'),
(4, 10, 38, '2026-03-13 14:42:45'),
(6, 11, 38, '2026-03-18 18:37:39'),
(7, 13, 38, '2026-03-19 16:45:13');

-- --------------------------------------------------------

--
-- Table structure for table `bar_owners`
--

CREATE TABLE `bar_owners` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `business_name` varchar(100) NOT NULL,
  `business_address` text DEFAULT NULL,
  `business_phone` varchar(20) DEFAULT NULL,
  `business_email` varchar(100) DEFAULT NULL,
  `permit_document` varchar(255) DEFAULT NULL,
  `subscription_tier` varchar(30) DEFAULT 'free',
  `subscription_expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `logo_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bar_owners`
--

INSERT INTO `bar_owners` (`id`, `user_id`, `business_name`, `business_address`, `business_phone`, `business_email`, `permit_document`, `subscription_tier`, `subscription_expires_at`, `created_at`, `logo_path`) VALUES
(8, 22, 'South Vibes', 'DASMARINAS CAVITE', '046 123 123', 'montejoasley13@gmail.com', '../uploads/documents/business_permit_22_1769973941.jpg', 'free', NULL, '2026-02-01 19:25:41', NULL),
(14, 29, 'Juan Business', NULL, NULL, NULL, NULL, 'enterprise', '2026-04-17 04:32:15', '2026-02-06 15:42:56', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `bar_posts`
--

CREATE TABLE `bar_posts` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'author (bar owner or staff)',
  `content` text DEFAULT NULL,
  `image_path` varchar(500) DEFAULT NULL,
  `status` enum('active','archived','deleted') DEFAULT 'active',
  `like_count` int(11) NOT NULL DEFAULT 0,
  `comment_count` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bar_posts`
--

INSERT INTO `bar_posts` (`id`, `bar_id`, `user_id`, `content`, `image_path`, `status`, `like_count`, `comment_count`, `created_at`, `updated_at`) VALUES
(1, 11, 29, 'asd', NULL, 'active', 0, 0, '2026-03-14 18:54:33', '2026-03-14 18:54:33'),
(2, 11, 29, 'asdas', NULL, 'deleted', 0, 0, '2026-03-14 18:54:42', '2026-03-21 21:34:15'),
(3, 11, 29, 'mhgjhg', NULL, 'active', 0, 0, '2026-03-22 00:03:54', '2026-03-22 00:03:54');

-- --------------------------------------------------------

--
-- Table structure for table `bar_post_comments`
--

CREATE TABLE `bar_post_comments` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `comment` text NOT NULL,
  `parent_comment_id` int(11) DEFAULT NULL,
  `status` enum('active','deleted','hidden') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `bar_post_comments`
--

INSERT INTO `bar_post_comments` (`id`, `post_id`, `user_id`, `comment`, `parent_comment_id`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 38, 'asd', NULL, 'active', '2026-03-19 16:34:49', '2026-03-19 16:34:49'),
(2, 2, 38, 'asdasd', NULL, 'active', '2026-03-19 19:03:30', '2026-03-19 19:03:30'),
(3, 1, 38, 'asdasdasdasdaa', NULL, 'active', '2026-03-19 19:03:34', '2026-03-19 19:03:34');

-- --------------------------------------------------------

--
-- Table structure for table `bar_post_likes`
--

CREATE TABLE `bar_post_likes` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `bar_post_likes`
--

INSERT INTO `bar_post_likes` (`id`, `post_id`, `user_id`, `created_at`) VALUES
(1, 1, 38, '2026-03-19 16:34:50'),
(2, 2, 38, '2026-03-19 16:34:52'),
(4, 3, 66, '2026-03-22 01:18:40');

-- --------------------------------------------------------

--
-- Table structure for table `bar_reply_reactions`
--

CREATE TABLE `bar_reply_reactions` (
  `id` int(11) NOT NULL,
  `reply_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reaction` varchar(20) NOT NULL DEFAULT 'like',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bar_reviews`
--

CREATE TABLE `bar_reviews` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `rating` decimal(2,1) NOT NULL,
  `review` text DEFAULT NULL,
  `review_date` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bar_tables`
--

CREATE TABLE `bar_tables` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `table_number` varchar(20) NOT NULL,
  `capacity` int(11) NOT NULL DEFAULT 2,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `manual_status` enum('available','reserved','unavailable') NOT NULL DEFAULT 'available',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `image_path` varchar(500) DEFAULT NULL COMMENT 'Photo of the table stored in uploads/',
  `price` decimal(10,2) DEFAULT NULL COMMENT 'Price per table if applicable'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bar_tables`
--

INSERT INTO `bar_tables` (`id`, `bar_id`, `table_number`, `capacity`, `is_active`, `manual_status`, `created_at`, `image_path`, `price`) VALUES
(1, 11, 'vip1', 2, 1, 'available', '2026-02-13 13:06:33', 'uploads/tables/table_11_1774149815268.jpeg', 500.00),
(2, 11, 'vip2', 4, 1, 'available', '2026-02-13 13:06:33', 'uploads/tables/table_11_1774149823650.jpg', 400.00),
(3, 11, 't1', 6, 1, 'available', '2026-02-13 13:06:33', 'uploads/tables/table_11_1774149805623.jpg', 0.00),
(4, 11, 'vip3', 8, 1, 'available', '2026-02-13 13:06:33', 'uploads/tables/table_11_1774149828821.jpg', 600.00);

-- --------------------------------------------------------

--
-- Table structure for table `bar_visits`
--

CREATE TABLE `bar_visits` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `visit_date` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bir_tax_brackets`
--

CREATE TABLE `bir_tax_brackets` (
  `id` int(11) NOT NULL,
  `min_income` decimal(12,2) NOT NULL COMMENT 'Minimum annual taxable income for this bracket',
  `max_income` decimal(12,2) DEFAULT NULL COMMENT 'Maximum annual taxable income (NULL for highest bracket)',
  `base_tax` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Base tax amount',
  `excess_rate` decimal(5,4) NOT NULL DEFAULT 0.0000 COMMENT 'Tax rate on excess (e.g., 0.20 for 20%)',
  `year` int(4) NOT NULL DEFAULT 2024 COMMENT 'Tax year this bracket applies to',
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='BIR tax brackets for withholding tax calculation';

--
-- Dumping data for table `bir_tax_brackets`
--

INSERT INTO `bir_tax_brackets` (`id`, `min_income`, `max_income`, `base_tax`, `excess_rate`, `year`, `is_active`) VALUES
(1, 0.00, 250000.00, 0.00, 0.0000, 2024, 1),
(2, 250000.01, 400000.00, 0.00, 0.1500, 2024, 1),
(3, 400000.01, 800000.00, 22500.00, 0.2000, 2024, 1),
(4, 800000.01, 2000000.00, 102500.00, 0.2500, 2024, 1),
(5, 2000000.01, 8000000.00, 402500.00, 0.3000, 2024, 1),
(6, 8000000.01, NULL, 2202500.00, 0.3500, 2024, 1),
(7, 0.00, 250000.00, 0.00, 0.0000, 2024, 1),
(8, 250000.01, 400000.00, 0.00, 0.1500, 2024, 1),
(9, 400000.01, 800000.00, 22500.00, 0.2000, 2024, 1),
(10, 800000.01, 2000000.00, 102500.00, 0.2500, 2024, 1),
(11, 2000000.01, 8000000.00, 402500.00, 0.3000, 2024, 1),
(12, 8000000.01, NULL, 2202500.00, 0.3500, 2024, 1);

-- --------------------------------------------------------

--
-- Table structure for table `business_registrations`
--

CREATE TABLE `business_registrations` (
  `id` int(11) NOT NULL,
  `business_name` varchar(150) NOT NULL,
  `business_address` text NOT NULL,
  `business_city` varchar(100) NOT NULL,
  `business_state` varchar(100) DEFAULT NULL,
  `business_zip` varchar(20) DEFAULT NULL,
  `business_phone` varchar(30) NOT NULL,
  `business_email` varchar(150) DEFAULT NULL,
  `business_category` varchar(100) DEFAULT NULL,
  `business_description` text DEFAULT NULL COMMENT 'Bar description from registration form',
  `opening_time` varchar(30) DEFAULT NULL COMMENT 'Bar opening time e.g. 6:00 PM',
  `closing_time` varchar(30) DEFAULT NULL COMMENT 'Bar closing time e.g. 2:00 AM',
  `gcash_number` varchar(30) DEFAULT NULL COMMENT 'GCash mobile number',
  `gcash_name` varchar(255) DEFAULT NULL COMMENT 'Registered GCash account name',
  `owner_first_name` varchar(80) NOT NULL,
  `owner_last_name` varchar(80) NOT NULL,
  `owner_email` varchar(150) NOT NULL,
  `owner_phone` varchar(30) NOT NULL,
  `owner_password` varchar(255) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `supporting_docs` text DEFAULT NULL COMMENT 'JSON array of uploaded document file paths (BIR, business permit, etc.)',
  `bir_certificate` varchar(500) DEFAULT NULL COMMENT 'File path: BIR certificate upload',
  `business_permit` varchar(500) DEFAULT NULL COMMENT 'File path: business permit upload'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `business_registrations`
--

INSERT INTO `business_registrations` (`id`, `business_name`, `business_address`, `business_city`, `business_state`, `business_zip`, `business_phone`, `business_email`, `business_category`, `business_description`, `opening_time`, `closing_time`, `gcash_number`, `gcash_name`, `owner_first_name`, `owner_last_name`, `owner_email`, `owner_phone`, `owner_password`, `status`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `created_at`, `updated_at`, `supporting_docs`, `bir_certificate`, `business_permit`) VALUES
(1, 'melulu', 'asasasdf', 'cavite', 'gen tri', '4107', '09123456789', NULL, 'Karaoke Bar', NULL, NULL, NULL, NULL, NULL, 'ckarence', 'gamilo', 'clarencebossing@gmail.com', '09123456789', '$2b$10$TH6558gsW76YQEw/i3Wib.mmizQw/tasmmGWPSWN7l44fGA.DoRZO', 'approved', 36, '2026-02-28 04:39:30', NULL, '2026-02-27 20:20:35', '2026-02-27 20:39:30', NULL, NULL, NULL),
(2, 'melolo', 'sadfsadf', '123123', '231', '12313', '09123456789', NULL, 'Karaoke Bar', NULL, NULL, NULL, NULL, NULL, 'eduard', 'hernanddez', 'hernandez@gmail.com', '0912345678', '$2b$10$HJcLA9RZSprvvI0LL4npCuiG63rj/3NtfQOvbRdDwwKCzDsa1TwPW', 'approved', 36, '2026-03-01 04:53:13', NULL, '2026-02-28 04:33:14', '2026-02-28 20:53:13', NULL, NULL, NULL),
(3, 'Carmelita', 'dyan lang', 'Cavite', NULL, NULL, '09123456789', NULL, NULL, 'MALUPITANG BAR MAY EABAB', '6:00 AM', '10:00 PM', '09123456789', 'John CLarence G.', 'clarence', 'gamilow', 'gamiloclarence3@gmail.com', '09123456789', '$2b$10$Jn7VOJYtwqtGBUqtdDnyKOTqAnPGNXkKhp3qyIJIym9Cs1esfue0a', 'pending', NULL, NULL, NULL, '2026-03-22 01:28:03', '2026-03-22 01:28:03', NULL, 'uploads/registration_docs/bir_certificate_1774142883330_ougg3w.jpg', 'uploads/registration_docs/business_permit_1774142883334_d1spj8.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `comment_reactions`
--

CREATE TABLE `comment_reactions` (
  `id` int(11) NOT NULL,
  `comment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reaction` varchar(20) NOT NULL DEFAULT 'like',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `comment_replies`
--

CREATE TABLE `comment_replies` (
  `id` int(11) NOT NULL,
  `comment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reply` text NOT NULL,
  `parent_reply_id` int(11) DEFAULT NULL COMMENT 'for nested replies',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_bar_bans`
--

CREATE TABLE `customer_bar_bans` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `banned_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `documents`
--

CREATE TABLE `documents` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `employee_user_id` int(11) DEFAULT NULL,
  `uploaded_by_user_id` int(11) NOT NULL,
  `doc_type` enum('contract','id','nbi','medical','clearance','other') NOT NULL DEFAULT 'other',
  `title` varchar(150) NOT NULL,
  `stored_filename` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `size_bytes` bigint(20) NOT NULL,
  `storage_path` varchar(500) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `archived_at` datetime DEFAULT NULL,
  `archived_by_user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `documents`
--

INSERT INTO `documents` (`id`, `bar_id`, `employee_user_id`, `uploaded_by_user_id`, `doc_type`, `title`, `stored_filename`, `original_filename`, `mime_type`, `size_bytes`, `storage_path`, `is_active`, `archived_at`, `archived_by_user_id`, `created_at`) VALUES
(4, 11, 30, 31, 'contract', 'contract 20266', '1770488046858-df0e182758afe.jpg', '2024-toyota-gr-supra.jpg', 'image/jpeg', 85306, 'C:\\Users\\Admin\\thesis-backend\\uploads\\bar_11\\employees\\0\\1770488046858-df0e182758afe.jpg', 1, NULL, NULL, '2026-02-07 18:14:06'),
(5, 11, 30, 31, 'contract', 'contract 2026666', '1770488283491-270a0466da1ec.jpg', '2024-toyota-gr-supra.jpg', 'image/jpeg', 85306, 'C:\\Users\\Admin\\thesis-backend\\uploads\\bar_11\\employees\\30\\1770488283491-270a0466da1ec.jpg', 1, NULL, NULL, '2026-02-07 18:18:03'),
(6, 11, 7, 31, 'contract', 'contract 2026666', '1770488336573-8b7440fb139dc8.jpg', '2024-toyota-gr-supra.jpg', 'image/jpeg', 85306, 'C:\\Users\\Admin\\thesis-backend\\uploads\\bar_11\\employees\\7\\1770488336573-8b7440fb139dc8.jpg', 1, NULL, NULL, '2026-02-07 18:18:56'),
(7, 11, 32, 31, 'contract', 'ccc', '1770744490093-50572b86c48e1.jpg', '54-scaled-e1752206252885-1024x1024.jpg', 'image/jpeg', 110414, 'C:\\Users\\Admin\\thesis-backend\\uploads\\bar_11\\employees\\32\\1770744490093-50572b86c48e1.jpg', 1, NULL, NULL, '2026-02-10 17:28:10'),
(8, 11, 63, 29, 'id', 'sdsdas', '1774145027615-106101d024dc88.jpg', '54-scaled-e1752206252885-1024x1024.jpg', 'image/jpeg', 110414, 'C:\\Users\\Admin\\thesisapps\\manager\\thesis-backend\\uploads\\bar_11\\employees\\63\\1774145027615-106101d024dc88.jpg', 1, NULL, NULL, '2026-03-22 02:03:47');

-- --------------------------------------------------------

--
-- Table structure for table `document_recipients`
--

CREATE TABLE `document_recipients` (
  `id` int(11) NOT NULL,
  `document_id` int(11) NOT NULL,
  `recipient_user_id` int(11) NOT NULL,
  `sent_by_user_id` int(11) NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `read_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `document_recipients`
--

INSERT INTO `document_recipients` (`id`, `document_id`, `recipient_user_id`, `sent_by_user_id`, `sent_at`, `read_at`) VALUES
(1, 6, 29, 29, '2026-03-12 19:48:52', NULL),
(2, 6, 59, 29, '2026-03-12 19:48:52', NULL),
(3, 7, 29, 29, '2026-03-22 02:11:06', NULL),
(4, 7, 59, 29, '2026-03-22 02:11:06', NULL),
(5, 7, 60, 29, '2026-03-22 02:11:06', NULL),
(6, 7, 63, 29, '2026-03-22 02:11:06', NULL),
(7, 5, 29, 29, '2026-03-22 02:14:16', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `email_verifications`
--

CREATE TABLE `email_verifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `code` varchar(10) NOT NULL,
  `expires_at` datetime NOT NULL,
  `consumed` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `email_verifications`
--

INSERT INTO `email_verifications` (`id`, `user_id`, `email`, `code`, `expires_at`, `consumed`, `created_at`) VALUES
(30, 19, 'montejokerby30@gmail.com', '836571', '2026-01-27 06:05:06', 1, '2026-01-27 04:50:06'),
(31, 22, 'montejoasley13@gmail.com', '790717', '2026-02-01 20:40:41', 1, '2026-02-01 19:25:41');

-- --------------------------------------------------------

--
-- Table structure for table `employee_deduction_settings`
--

CREATE TABLE `employee_deduction_settings` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'Employee user_id',
  `bir_enabled` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Enable BIR withholding tax',
  `bir_exemption_status` varchar(20) DEFAULT 'S' COMMENT 'Tax exemption: S, ME, S1, S2, S3, S4, ME1, ME2, ME3, ME4',
  `sss_enabled` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Enable SSS deduction',
  `sss_number` varchar(50) DEFAULT NULL,
  `philhealth_enabled` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Enable PhilHealth deduction',
  `philhealth_number` varchar(50) DEFAULT NULL,
  `late_deduction_enabled` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Enable late deduction',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Per-employee deduction settings and tax information';

--
-- Dumping data for table `employee_deduction_settings`
--

INSERT INTO `employee_deduction_settings` (`id`, `bar_id`, `user_id`, `bir_enabled`, `bir_exemption_status`, `sss_enabled`, `sss_number`, `philhealth_enabled`, `philhealth_number`, `late_deduction_enabled`, `created_at`, `updated_at`) VALUES
(1, 11, 63, 1, 'S', 1, NULL, 1, NULL, 0, '2026-03-21 23:27:37', '2026-03-21 23:28:05'),
(3, 11, 29, 1, 'S', 1, NULL, 1, NULL, 1, '2026-03-21 23:28:15', '2026-03-21 23:28:15');

-- --------------------------------------------------------

--
-- Table structure for table `employee_documents`
--

CREATE TABLE `employee_documents` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `employee_user_id` int(11) NOT NULL,
  `doc_type` enum('id','contract','resume','coe','hr_form','other') NOT NULL DEFAULT 'other',
  `file_path` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `uploaded_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employee_profiles`
--

CREATE TABLE `employee_profiles` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `position` varchar(100) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `employment_status` enum('probationary','regular','contractual','part_time','intern') DEFAULT 'probationary',
  `daily_rate` decimal(10,2) DEFAULT 0.00,
  `hired_date` date DEFAULT NULL,
  `emergency_contact_name` varchar(100) DEFAULT NULL,
  `emergency_contact_phone` varchar(20) DEFAULT NULL,
  `emergency_contact_relationship` varchar(50) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `employee_profiles`
--

INSERT INTO `employee_profiles` (`id`, `user_id`, `bar_id`, `position`, `department`, `employment_status`, `daily_rate`, `hired_date`, `emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relationship`, `address`, `created_at`, `updated_at`) VALUES
(18, 59, 11, 'Bartender', 'Bar', 'probationary', 600.00, NULL, NULL, NULL, NULL, NULL, '2026-03-08 20:04:10', '2026-03-08 20:04:19'),
(20, 60, 11, 'Bartender', 'Bar', 'probationary', 0.00, NULL, NULL, NULL, NULL, 'mcc', '2026-03-08 20:05:28', '2026-03-08 20:05:28'),
(21, 63, 11, NULL, NULL, 'regular', 0.00, NULL, NULL, NULL, NULL, NULL, '2026-03-17 15:23:57', '2026-03-17 15:23:57');

-- --------------------------------------------------------

--
-- Table structure for table `event_comments`
--

CREATE TABLE `event_comments` (
  `id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `comment` text NOT NULL,
  `status` enum('active','deleted') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_comments`
--

INSERT INTO `event_comments` (`id`, `event_id`, `user_id`, `comment`, `status`, `created_at`, `updated_at`) VALUES
(1, 3, 38, 'asdasd', 'active', '2026-03-12 21:48:23', '2026-03-12 21:48:23'),
(2, 3, 38, 'buburat', 'active', '2026-03-12 22:18:54', '2026-03-12 22:18:54'),
(3, 3, 38, 'wer', 'active', '2026-03-14 16:01:02', '2026-03-14 16:01:02'),
(4, 3, 29, 'asd', 'active', '2026-03-14 18:53:59', '2026-03-14 18:53:59'),
(5, 4, 38, 'aasfre', 'active', '2026-03-18 19:02:20', '2026-03-18 19:02:20'),
(6, 3, 38, 'dgh', 'active', '2026-03-18 19:54:56', '2026-03-18 19:54:56'),
(7, 3, 38, 'ssdf', 'active', '2026-03-19 16:32:20', '2026-03-19 16:32:20'),
(8, 3, 38, '65e', 'active', '2026-03-19 17:57:37', '2026-03-19 17:57:37'),
(9, 3, 38, 'sfsdfsd', 'active', '2026-03-22 16:40:13', '2026-03-22 16:40:13'),
(10, 3, 38, 'ewee', 'active', '2026-03-22 16:40:17', '2026-03-22 16:40:17');

-- --------------------------------------------------------

--
-- Table structure for table `event_comment_replies`
--

CREATE TABLE `event_comment_replies` (
  `id` int(11) NOT NULL,
  `event_comment_id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reply` text NOT NULL,
  `status` enum('active','deleted') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_comment_replies`
--

INSERT INTO `event_comment_replies` (`id`, `event_comment_id`, `event_id`, `user_id`, `reply`, `status`, `created_at`, `updated_at`) VALUES
(1, 2, 3, 29, 'hello po', 'active', '2026-03-14 18:36:25', '2026-03-14 18:36:25'),
(2, 1, 3, 29, 'wag po span putangina naman', 'active', '2026-03-14 19:12:17', '2026-03-14 19:12:17'),
(3, 7, 3, 29, 'dfg', 'active', '2026-03-21 23:59:44', '2026-03-21 23:59:44'),
(4, 4, 3, 29, 'sdadsfasdfasdfasdfasdf', 'active', '2026-03-21 23:59:50', '2026-03-21 23:59:50'),
(5, 8, 3, 29, 'asdasdasdasdasdasdasdasdasdasdasd', 'active', '2026-03-22 00:00:05', '2026-03-22 00:00:05'),
(6, 7, 3, 29, 'asd', 'active', '2026-03-22 00:00:27', '2026-03-22 00:00:27'),
(7, 8, 3, 29, 'nbc', 'active', '2026-03-22 00:03:23', '2026-03-22 00:03:23'),
(8, 5, 4, 29, 'ngf', 'active', '2026-03-22 00:04:00', '2026-03-22 00:04:00'),
(9, 5, 4, 29, 'hg', 'active', '2026-03-22 00:04:08', '2026-03-22 00:04:08'),
(10, 8, 3, 29, 'bnfgnhgjhjhgjhgjgh', 'active', '2026-03-22 00:04:26', '2026-03-22 00:04:26');

-- --------------------------------------------------------

--
-- Table structure for table `event_likes`
--

CREATE TABLE `event_likes` (
  `id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `liked_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `event_likes`
--

INSERT INTO `event_likes` (`id`, `event_id`, `user_id`, `liked_at`) VALUES
(1, 3, 38, '2026-03-12 22:18:40'),
(26, 4, 38, '2026-03-19 16:44:59'),
(28, 4, 66, '2026-03-22 01:18:41');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_items`
--

CREATE TABLE `inventory_items` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `name` varchar(120) NOT NULL,
  `unit` varchar(30) DEFAULT NULL,
  `stock_qty` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reorder_level` decimal(10,2) NOT NULL DEFAULT 0.00,
  `cost_price` decimal(10,2) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `stock_status` enum('normal','low','critical') DEFAULT 'normal',
  `image_path` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `inventory_items`
--

INSERT INTO `inventory_items` (`id`, `bar_id`, `name`, `unit`, `stock_qty`, `reorder_level`, `cost_price`, `is_active`, `created_at`, `stock_status`, `image_path`) VALUES
(1, 11, 'Red Horse Beer', 'bottle', 0.00, 30.00, 55.00, 1, '2026-02-13 16:26:57', 'critical', 'uploads/inventory/item_1_1772043330799.jpg'),
(2, 11, 'Red Horse Beer', 'bottle', 0.00, 30.00, 55.00, 1, '2026-02-13 17:35:37', 'critical', 'uploads/inventory/item_2_1774149782791.jpg'),
(3, 11, 'gin bulag', '100', 23.00, 10.00, 56.00, 1, '2026-02-19 07:51:43', 'normal', 'uploads/inventory/item_3_1772721764954.jpg'),
(4, 11, 'bulag', '5', 0.00, 10.00, 56.00, 1, '2026-02-19 18:25:22', 'critical', 'uploads/inventory/item_4_1774149778108.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `leave_balances`
--

CREATE TABLE `leave_balances` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `employee_user_id` int(11) NOT NULL,
  `leave_type_id` int(11) NOT NULL,
  `year` int(11) NOT NULL,
  `allocated_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `used_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `carryover_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `leave_balances`
--

INSERT INTO `leave_balances` (`id`, `bar_id`, `employee_user_id`, `leave_type_id`, `year`, `allocated_days`, `used_days`, `carryover_days`, `created_at`, `updated_at`) VALUES
(1, 11, 30, 6, 2026, 5.00, 5.00, 0.00, '2026-02-07 17:04:37', '2026-02-10 18:26:13');

-- --------------------------------------------------------

--
-- Table structure for table `leave_requests`
--

CREATE TABLE `leave_requests` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `employee_user_id` int(11) NOT NULL,
  `leave_type` enum('vacation','sick','emergency','maternity','paternity','special') NOT NULL,
  `leave_type_id` int(11) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `days` decimal(6,2) NOT NULL DEFAULT 1.00,
  `reason` text DEFAULT NULL,
  `status` enum('pending','approved','rejected','cancelled') DEFAULT 'pending',
  `decided_by` int(11) DEFAULT NULL,
  `decided_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `leave_requests`
--

INSERT INTO `leave_requests` (`id`, `bar_id`, `employee_user_id`, `leave_type`, `leave_type_id`, `start_date`, `end_date`, `days`, `reason`, `status`, `decided_by`, `decided_at`, `created_at`) VALUES
(24, 11, 63, 'vacation', NULL, '2024-12-12', '2026-12-12', 1.00, 'asdasd', 'approved', 29, '2026-03-17 23:25:25', '2026-03-17 15:13:59'),
(25, 11, 59, 'vacation', NULL, '2026-03-05', '2026-03-24', 1.00, NULL, 'approved', 29, '2026-03-22 05:53:23', '2026-03-21 21:50:26');

-- --------------------------------------------------------

--
-- Table structure for table `leave_types`
--

CREATE TABLE `leave_types` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `code` varchar(30) NOT NULL,
  `name` varchar(100) NOT NULL,
  `default_annual_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `is_paid` tinyint(1) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `leave_types`
--

INSERT INTO `leave_types` (`id`, `bar_id`, `code`, `name`, `default_annual_days`, `is_paid`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 11, 'sick', 'sick', 0.00, 1, 1, '2026-02-07 16:29:15', '2026-02-07 16:29:15'),
(2, 1, 'VL', 'Vacation Leave', 5.00, 1, 1, '2026-02-07 16:32:19', '2026-02-07 16:32:19'),
(3, 1, 'SL', 'Sick Leave', 5.00, 1, 1, '2026-02-07 16:32:19', '2026-02-07 16:32:19'),
(4, 1, 'EL', 'Emergency Leave', 0.00, 1, 1, '2026-02-07 16:32:19', '2026-02-07 16:32:19'),
(5, 1, 'ML', 'Maternity Leave', 0.00, 1, 1, '2026-02-07 16:32:19', '2026-02-07 16:32:19'),
(6, 11, 'VL', 'Vacation Leave', 5.00, 1, 1, '2026-02-07 17:04:21', '2026-02-07 17:04:21'),
(7, 11, 'SL', 'Sick Leave', 5.00, 1, 1, '2026-02-07 17:04:21', '2026-02-07 17:04:21'),
(8, 11, 'EL', 'Emergency Leave', 0.00, 1, 1, '2026-02-07 17:04:21', '2026-02-07 17:04:21'),
(9, 11, 'ML', 'Maternity Leave', 0.00, 1, 1, '2026-02-07 17:04:21', '2026-02-07 17:04:21');

-- --------------------------------------------------------

--
-- Stand-in structure for view `menu_best_sellers`
-- (See below for the actual view)
--
CREATE TABLE `menu_best_sellers` (
`menu_item_id` int(11)
,`bar_id` int(11)
,`menu_name` varchar(150)
,`category` varchar(50)
,`selling_price` decimal(10,2)
,`total_orders` bigint(21)
,`total_quantity_sold` decimal(32,0)
,`total_revenue` decimal(34,2)
,`sales_rank` bigint(21)
);

-- --------------------------------------------------------

--
-- Table structure for table `menu_items`
--

CREATE TABLE `menu_items` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `inventory_item_id` int(11) NOT NULL,
  `menu_name` varchar(150) NOT NULL,
  `menu_description` text DEFAULT NULL,
  `selling_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `category` varchar(50) DEFAULT NULL,
  `is_available` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_best_seller` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `menu_items`
--

INSERT INTO `menu_items` (`id`, `bar_id`, `inventory_item_id`, `menu_name`, `menu_description`, `selling_price`, `category`, `is_available`, `sort_order`, `created_at`, `updated_at`, `is_best_seller`) VALUES
(1, 11, 3, 'gin bulag', NULL, 56.00, NULL, 1, 0, '2026-02-27 15:53:37', '2026-02-27 16:53:31', 0),
(2, 11, 2, 'Red Horse Beer', NULL, 55.00, NULL, 1, 0, '2026-02-27 17:13:33', '2026-03-17 15:30:40', 0),
(3, 11, 4, 'bulag', NULL, 56.00, NULL, 1, 0, '2026-02-27 17:13:38', '2026-02-27 17:13:38', 0);

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '2026_01_23_173116_modify_existing_users_table', 1);

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL COMMENT 'follow, like, comment, reply, promotion, reservation, system',
  `title` varchar(255) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `link` varchar(500) DEFAULT NULL COMMENT 'URL to navigate to on click',
  `reference_id` int(11) DEFAULT NULL COMMENT 'related entity ID',
  `reference_type` varchar(50) DEFAULT NULL COMMENT 'post, comment, bar, reservation, etc.',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_line_items`
--

CREATE TABLE `payment_line_items` (
  `id` int(11) NOT NULL,
  `payment_transaction_id` int(11) NOT NULL,
  `item_type` enum('table','menu','service','other') NOT NULL DEFAULT 'other',
  `item_name` varchar(255) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payment_line_items`
--

INSERT INTO `payment_line_items` (`id`, `payment_transaction_id`, `item_type`, `item_name`, `quantity`, `unit_price`, `line_total`, `metadata`, `created_at`) VALUES
(1, 14, 'menu', 'Red Horse Beer', 2, 55.00, 110.00, '{\"reservation_id\":14}', '2026-03-19 13:29:33'),
(2, 14, 'menu', 'gin bulag', 5, 56.00, 280.00, '{\"reservation_id\":14}', '2026-03-19 13:29:33'),
(3, 14, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":14}', '2026-03-19 13:29:33'),
(4, 15, 'table', 'Table #T2', 1, 400.00, 400.00, '{\"table_id\":2,\"reservation_id\":15}', '2026-03-19 14:15:34'),
(5, 15, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":15}', '2026-03-19 14:15:34'),
(6, 15, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":15}', '2026-03-19 14:15:34'),
(7, 15, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":15}', '2026-03-19 14:15:34'),
(8, 16, 'table', 'Table #T4', 1, 600.00, 600.00, '{\"table_id\":4,\"reservation_id\":16}', '2026-03-19 14:22:22'),
(9, 16, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":16}', '2026-03-19 14:22:22'),
(10, 16, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":16}', '2026-03-19 14:22:22'),
(11, 16, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":16}', '2026-03-19 14:22:24'),
(12, 17, 'table', 'Table #T2', 1, 400.00, 400.00, '{\"table_id\":2,\"reservation_id\":17}', '2026-03-19 14:28:32'),
(13, 17, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":17}', '2026-03-19 14:28:32'),
(14, 17, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":17}', '2026-03-19 14:28:32'),
(15, 17, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":17}', '2026-03-19 14:28:32'),
(16, 18, 'table', 'Table #T2', 1, 400.00, 400.00, '{\"table_id\":2,\"reservation_id\":18}', '2026-03-19 14:31:44'),
(17, 18, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":18}', '2026-03-19 14:31:44'),
(18, 18, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":18}', '2026-03-19 14:31:44'),
(19, 18, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":18}', '2026-03-19 14:31:44'),
(20, 19, 'table', 'Table #T4', 1, 600.00, 600.00, '{\"table_id\":4,\"reservation_id\":19}', '2026-03-19 14:57:48'),
(21, 19, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":19}', '2026-03-19 14:57:48'),
(22, 19, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":19}', '2026-03-19 14:57:48'),
(23, 19, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":19}', '2026-03-19 14:57:48'),
(24, 20, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":20}', '2026-03-19 16:21:10'),
(25, 20, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":20}', '2026-03-19 16:21:10'),
(26, 20, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":20}', '2026-03-19 16:21:10'),
(27, 21, 'table', 'Table #T2', 1, 400.00, 400.00, '{\"table_id\":2,\"reservation_id\":21}', '2026-03-19 16:26:44'),
(28, 21, 'menu', 'bulag', 9, 56.00, 504.00, '{\"reservation_id\":21}', '2026-03-19 16:26:44'),
(29, 22, 'menu', 'Red Horse Beer', 2, 55.00, 110.00, '{\"reservation_id\":22}', '2026-03-19 16:28:44'),
(30, 22, 'menu', 'gin bulag', 2, 56.00, 112.00, '{\"reservation_id\":22}', '2026-03-19 16:28:44'),
(31, 22, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":22}', '2026-03-19 16:28:44'),
(32, 23, 'table', 'Table #T2', 1, 400.00, 400.00, '{\"table_id\":2,\"reservation_id\":23}', '2026-03-19 16:45:44'),
(33, 24, 'table', 'Table #T4', 1, 600.00, 600.00, '{\"table_id\":4,\"reservation_id\":24}', '2026-03-19 16:53:15'),
(34, 25, 'table', 'Table #T4', 1, 600.00, 600.00, '{\"table_id\":4,\"reservation_id\":25}', '2026-03-19 17:49:12'),
(35, 25, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":25}', '2026-03-19 17:49:12'),
(36, 25, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":25}', '2026-03-19 17:49:12'),
(37, 25, 'menu', 'bulag', 15, 56.00, 840.00, '{\"reservation_id\":25}', '2026-03-19 17:49:12'),
(38, 26, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":26}', '2026-03-19 19:46:04'),
(39, 26, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":26}', '2026-03-19 19:46:04'),
(40, 26, 'menu', 'bulag', 15, 56.00, 840.00, '{\"reservation_id\":26}', '2026-03-19 19:46:04'),
(41, 27, 'table', 'Table #T1', 1, 500.00, 500.00, '{\"table_id\":1,\"reservation_id\":27}', '2026-03-21 22:57:34'),
(42, 27, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":27}', '2026-03-21 22:57:34'),
(43, 27, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":27}', '2026-03-21 22:57:34'),
(44, 28, 'table', 'Table #T1', 1, 500.00, 500.00, '{\"table_id\":1,\"reservation_id\":28}', '2026-03-21 22:58:48'),
(45, 28, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":28}', '2026-03-21 22:58:48'),
(46, 28, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":28}', '2026-03-21 22:58:48'),
(47, 29, 'table', 'Table #vip3', 1, 600.00, 600.00, '{\"table_id\":4,\"reservation_id\":29}', '2026-03-22 01:33:39'),
(48, 29, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":29}', '2026-03-22 01:33:39'),
(49, 29, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":29}', '2026-03-22 01:33:39'),
(50, 30, 'table', 'Table #vip3', 1, 600.00, 600.00, '{\"table_id\":4,\"reservation_id\":30}', '2026-03-22 01:34:41'),
(51, 30, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":30}', '2026-03-22 01:34:41'),
(52, 30, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":30}', '2026-03-22 01:34:41'),
(53, 31, 'table', 'Table #vip1', 1, 500.00, 500.00, '{\"table_id\":1,\"reservation_id\":31}', '2026-03-22 14:15:19'),
(54, 31, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":31}', '2026-03-22 14:15:19'),
(55, 31, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":31}', '2026-03-22 14:15:19'),
(56, 31, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":31}', '2026-03-22 14:15:19'),
(57, 32, 'table', 'Table #vip1', 1, 500.00, 500.00, '{\"table_id\":1,\"reservation_id\":32}', '2026-03-22 14:19:10'),
(58, 32, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":32}', '2026-03-22 14:19:10'),
(59, 32, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":32}', '2026-03-22 14:19:10'),
(60, 33, 'table', 'Table #vip1', 1, 500.00, 500.00, '{\"table_id\":1,\"reservation_id\":33}', '2026-03-22 14:24:51'),
(61, 33, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":33}', '2026-03-22 14:24:51'),
(62, 33, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":33}', '2026-03-22 14:24:51'),
(63, 34, 'table', 'Table #vip1', 1, 500.00, 500.00, '{\"table_id\":1,\"reservation_id\":34}', '2026-03-22 14:26:43'),
(64, 34, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":34}', '2026-03-22 14:26:43'),
(65, 34, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":34}', '2026-03-22 14:26:43'),
(66, 34, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":34}', '2026-03-22 14:26:43'),
(67, 35, 'table', 'Table #vip2', 1, 400.00, 400.00, '{\"table_id\":2,\"reservation_id\":35}', '2026-03-22 14:30:29'),
(68, 35, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":35}', '2026-03-22 14:30:29'),
(69, 35, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":35}', '2026-03-22 14:30:29'),
(70, 35, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":35}', '2026-03-22 14:30:29'),
(71, 36, 'table', 'Table #vip3', 1, 600.00, 600.00, '{\"table_id\":4,\"reservation_id\":36}', '2026-03-22 14:54:15'),
(72, 36, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":36}', '2026-03-22 14:54:15'),
(73, 36, 'menu', 'bulag', 1, 56.00, 56.00, '{\"reservation_id\":36}', '2026-03-22 14:54:15'),
(74, 36, 'menu', 'Red Horse Beer', 1, 55.00, 55.00, '{\"reservation_id\":36}', '2026-03-22 14:54:15'),
(75, 37, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":37}', '2026-03-22 15:52:40'),
(76, 37, 'menu', 'bulag', 22, 56.00, 1232.00, '{\"reservation_id\":37}', '2026-03-22 15:52:40'),
(77, 38, 'table', 'Table #vip3', 1, 600.00, 600.00, '{\"table_id\":4,\"reservation_id\":38}', '2026-03-22 16:27:45'),
(78, 38, 'menu', 'gin bulag', 1, 56.00, 56.00, '{\"reservation_id\":38}', '2026-03-22 16:27:45');

-- --------------------------------------------------------

--
-- Table structure for table `payment_transactions`
--

CREATE TABLE `payment_transactions` (
  `id` int(11) NOT NULL,
  `reference_id` varchar(100) NOT NULL COMMENT 'Internal reference ID',
  `payment_type` enum('order','reservation','subscription') NOT NULL,
  `related_id` int(11) NOT NULL COMMENT 'ID from orders/reservations/subscriptions',
  `bar_id` int(11) DEFAULT NULL COMMENT 'Related bar (NULL for subscription payments)',
  `user_id` int(11) NOT NULL COMMENT 'Paying user',
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) NOT NULL DEFAULT 'PHP',
  `status` enum('pending','processing','paid','failed','refunded','expired') NOT NULL DEFAULT 'pending',
  `payment_method` varchar(50) DEFAULT NULL COMMENT 'gcash, paymaya, card',
  `paymongo_payment_intent_id` varchar(255) DEFAULT NULL,
  `paymongo_payment_id` varchar(255) DEFAULT NULL,
  `paymongo_source_id` varchar(255) DEFAULT NULL,
  `checkout_url` text DEFAULT NULL COMMENT 'PayMongo checkout URL for customer',
  `paid_at` timestamp NULL DEFAULT NULL,
  `failed_reason` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payment_transactions`
--

INSERT INTO `payment_transactions` (`id`, `reference_id`, `payment_type`, `related_id`, `bar_id`, `user_id`, `amount`, `currency`, `status`, `payment_method`, `paymongo_payment_intent_id`, `paymongo_payment_id`, `paymongo_source_id`, `checkout_url`, `paid_at`, `failed_reason`, `metadata`, `created_at`, `updated_at`) VALUES
(1, 'SUB-1773766401866-0H1XK6', 'subscription', 2, NULL, 29, 1499.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_12y27speAiy7gRN1dTRQ6xqD', 'https://secure-authentication.paymongo.com/sources?id=src_12y27speAiy7gRN1dTRQ6xqD', NULL, NULL, '{\"plan_name\":\"premium\",\"plan_display_name\":\"Premium\"}', '2026-03-17 16:53:23', '2026-03-17 16:53:23'),
(2, 'SUB-1773766572555-97KSKM', 'subscription', 3, NULL, 29, 499.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_48ih3wmz3kiLSnTj3QQiZHMG', 'https://secure-authentication.paymongo.com/sources?id=src_48ih3wmz3kiLSnTj3QQiZHMG', NULL, NULL, '{\"plan_name\":\"basic\",\"plan_display_name\":\"Basic\"}', '2026-03-17 16:56:12', '2026-03-17 16:56:12'),
(3, 'SUB-1773766611711-PDC65J', 'subscription', 4, NULL, 29, 499.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_ufMRj2qkXJGQPMGrA1xCggFk', 'https://secure-authentication.paymongo.com/sources?id=src_ufMRj2qkXJGQPMGrA1xCggFk', NULL, NULL, '{\"plan_name\":\"basic\",\"plan_display_name\":\"Basic\"}', '2026-03-17 16:56:51', '2026-03-17 16:56:51'),
(4, 'SUB-1773767045672-EVBLWI', 'subscription', 5, NULL, 29, 499.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_SXkM966ChsPHqA3HpWhMZ5Yj', 'https://secure-authentication.paymongo.com/sources?id=src_SXkM966ChsPHqA3HpWhMZ5Yj', NULL, NULL, '{\"plan_name\":\"basic\",\"plan_display_name\":\"Basic\"}', '2026-03-17 17:04:05', '2026-03-17 17:04:05'),
(5, 'SUB-1773767401044-V0V5LM', 'subscription', 6, NULL, 29, 499.00, 'PHP', 'paid', 'paymaya', NULL, NULL, 'src_txtrnEFHcGRVFZjBXfEZiwq5', 'https://secure-authentication.paymongo.com/sources?id=src_txtrnEFHcGRVFZjBXfEZiwq5', '2026-03-17 17:10:05', NULL, '{\"plan_name\":\"basic\",\"plan_display_name\":\"Basic\"}', '2026-03-17 17:10:01', '2026-03-17 17:10:05'),
(6, 'SUB-1773767463952-AS17TC', 'subscription', 7, NULL, 29, 499.00, 'PHP', 'paid', 'gcash', NULL, NULL, 'src_dWHqjF29qRATDGpUUYb4Rg6K', 'https://secure-authentication.paymongo.com/sources?id=src_dWHqjF29qRATDGpUUYb4Rg6K', '2026-03-17 17:11:07', NULL, '{\"plan_name\":\"basic\",\"plan_display_name\":\"Basic\"}', '2026-03-17 17:11:04', '2026-03-17 17:11:07'),
(7, 'SUB-1773779531620-G5L18U', 'subscription', 8, NULL, 29, 4999.00, 'PHP', 'paid', 'paymaya', NULL, NULL, 'src_H3Hig1tNwdEaBN1WTzv2XcqJ', 'https://secure-authentication.paymongo.com/sources?id=src_H3Hig1tNwdEaBN1WTzv2XcqJ', '2026-03-17 20:32:15', NULL, '{\"plan_name\":\"enterprise\",\"plan_display_name\":\"Enterprise\"}', '2026-03-17 20:32:11', '2026-03-17 20:32:15'),
(8, 'RES-1773857833043-W8EXOK', 'reservation', 8, 11, 66, 10000.00, 'PHP', 'paid', 'paymaya', NULL, NULL, 'src_GhGYmMybCLXFDHTbCuztWVGJ', 'https://secure-authentication.paymongo.com/sources?id=src_GhGYmMybCLXFDHTbCuztWVGJ', '2026-03-18 18:17:16', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\"}', '2026-03-18 18:17:13', '2026-03-18 18:17:16'),
(9, 'RES-1773858098034-SNAKHS', 'reservation', 9, 11, 38, 10000.00, 'PHP', 'pending', 'paymaya', NULL, NULL, 'src_iGHQQSv75nhHASyXzkwUNKux', 'https://secure-authentication.paymongo.com/sources?id=src_iGHQQSv75nhHASyXzkwUNKux', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\"}', '2026-03-18 18:21:38', '2026-03-18 18:21:38'),
(10, 'RES-1773861992847-2U0155', 'reservation', 10, 11, 38, 567.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_1Lj33TDz7bbAhWFs3njnLZ1H', 'https://secure-authentication.paymongo.com/sources?id=src_1Lj33TDz7bbAhWFs3njnLZ1H', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\"}', '2026-03-18 19:26:33', '2026-03-18 19:26:33'),
(11, 'RES-1773862072557-RFGH0M', 'reservation', 11, 11, 38, 767.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_qBCUXJZoQnkZVAM6JgKGJHhG', 'https://secure-authentication.paymongo.com/sources?id=src_qBCUXJZoQnkZVAM6JgKGJHhG', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\"}', '2026-03-18 19:27:52', '2026-03-18 19:27:52'),
(12, 'RES-1773864084473-OBVTED', 'reservation', 12, 11, 38, 567.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_PQd4Rs71fM2z9G4pxasEbS9k', 'https://secure-authentication.paymongo.com/sources?id=src_PQd4Rs71fM2z9G4pxasEbS9k', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\"}', '2026-03-18 20:01:24', '2026-03-18 20:01:24'),
(13, 'RES-1773864641717-9ZJ5RQ', 'reservation', 13, 11, 38, 567.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_mR9R36YawFpkNg9tE4zmApEJ', 'https://secure-authentication.paymongo.com/sources?id=src_mR9R36YawFpkNg9tE4zmApEJ', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\"}', '2026-03-18 20:10:41', '2026-03-18 20:10:41'),
(14, 'RES-1773926973397-WKVXLU', 'reservation', 14, 11, 38, 446.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_1EVkjiz6UNRVeELkAmQFFoBu', 'https://secure-authentication.paymongo.com/sources?id=src_1EVkjiz6UNRVeELkAmQFFoBu', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":3,\"table_number\":\"T3\",\"source_status\":\"pending\",\"notes\":\"Order: Red Horse Beer x2, gin bulag x5, bulag x1\"}}', '2026-03-19 13:29:33', '2026-03-19 13:29:33'),
(15, 'RES-1773929734485-TXICIP', 'reservation', 15, 11, 38, 567.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_DMqPoDH6D7ZLf3pY74TDJjLn', 'https://secure-authentication.paymongo.com/sources?id=src_DMqPoDH6D7ZLf3pY74TDJjLn', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":2,\"table_number\":\"T2\",\"source_status\":\"pending\",\"notes\":\"Order: Red Horse Beer x1, gin bulag x1, bulag x1\"}}', '2026-03-19 14:15:34', '2026-03-19 14:15:34'),
(16, 'RES-1773930137971-IUP6BI', 'reservation', 16, 11, 38, 767.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_WdvMcRHa9hPWTGbrju24P6kk', 'https://secure-authentication.paymongo.com/sources?id=src_WdvMcRHa9hPWTGbrju24P6kk', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":4,\"table_number\":\"T4\",\"source_status\":\"pending\",\"notes\":\"Order: Red Horse Beer x1, gin bulag x1, bulag x1\"}}', '2026-03-19 14:22:18', '2026-03-19 14:22:18'),
(17, 'RES-1773930511884-FF0QH1', 'reservation', 17, 11, 38, 567.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_qP8zhaRbnjsFLUs1S4EzKHGt', 'https://secure-authentication.paymongo.com/sources?id=src_qP8zhaRbnjsFLUs1S4EzKHGt', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":2,\"table_number\":\"T2\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, Red Horse Beer x1, bulag x1\"}}', '2026-03-19 14:28:32', '2026-03-19 14:28:32'),
(18, 'RES-1773930704733-PQM6J6', 'reservation', 18, 11, 38, 567.00, 'PHP', 'paid', 'gcash', NULL, NULL, 'src_pzkqc72LSRsUdVtYXyRSZkrW', 'https://secure-authentication.paymongo.com/sources?id=src_pzkqc72LSRsUdVtYXyRSZkrW', '2026-03-19 14:40:02', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":2,\"table_number\":\"T2\",\"source_status\":\"pending\",\"notes\":\"Order: bulag x1, gin bulag x1, Red Horse Beer x1\"}}', '2026-03-19 14:31:44', '2026-03-19 14:40:02'),
(19, 'RES-1773932267815-H8B7WI', 'reservation', 19, 11, 38, 767.00, 'PHP', 'paid', 'paymaya', NULL, 'pay_18LwdKYn2oMXL5MFt2i47dTA', 'src_wt3LTyPqtFhYUnQyQ6qcysZs', 'https://secure-authentication.paymongo.com/sources?id=src_wt3LTyPqtFhYUnQyQ6qcysZs', '2026-03-19 14:57:51', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":4,\"table_number\":\"T4\",\"source_status\":\"pending\",\"notes\":\"Order: bulag x1, gin bulag x1, Red Horse Beer x1\"}}', '2026-03-19 14:57:48', '2026-03-19 14:57:51'),
(20, 'RES-1773937270643-7K1YBY', 'reservation', 20, 11, 38, 167.00, 'PHP', 'paid', 'gcash', NULL, 'pay_iYQTZNbGEPX7nuRn2CHXvraC', 'src_wUnMzaMfcNyBBpWm89FGyoKp', 'https://secure-authentication.paymongo.com/sources?id=src_wUnMzaMfcNyBBpWm89FGyoKp', '2026-03-19 16:21:13', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":3,\"table_number\":\"T3\",\"source_status\":\"pending\",\"notes\":\"Order: Red Horse Beer x1, gin bulag x1, bulag x1\"}}', '2026-03-19 16:21:10', '2026-03-19 16:21:13'),
(21, 'RES-1773937604170-EKAJEK', 'reservation', 21, 11, 38, 904.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_bos8fdxpFYjCVafSYoyZJxb3', 'https://secure-authentication.paymongo.com/sources?id=src_bos8fdxpFYjCVafSYoyZJxb3', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":2,\"table_number\":\"T2\",\"source_status\":\"pending\",\"notes\":\"Order: bulag x9\"}}', '2026-03-19 16:26:44', '2026-03-19 16:26:44'),
(22, 'RES-1773937724091-9TARUG', 'reservation', 22, 11, 38, 278.00, 'PHP', 'paid', 'gcash', NULL, 'pay_3tgdGyNdQb7SZ9GiXS7aJncF', 'src_KWkb2e4wngTzPLr3p9ZXR1Hu', 'https://secure-authentication.paymongo.com/sources?id=src_KWkb2e4wngTzPLr3p9ZXR1Hu', '2026-03-19 16:28:47', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":3,\"table_number\":\"T3\",\"source_status\":\"pending\",\"notes\":\"Order: Red Horse Beer x2, gin bulag x2, bulag x1\"}}', '2026-03-19 16:28:44', '2026-03-19 16:28:47'),
(23, 'RES-1773938744232-11BM2B', 'reservation', 23, 11, 38, 400.00, 'PHP', 'paid', 'gcash', NULL, 'pay_Au4UbmamUuxqdvZUwYTgkn6m', 'src_WLkbnSzGbz1sNvhnFk5AaCZZ', 'https://secure-authentication.paymongo.com/sources?id=src_WLkbnSzGbz1sNvhnFk5AaCZZ', '2026-03-19 16:45:48', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":2,\"table_number\":\"T2\",\"source_status\":\"pending\",\"notes\":null}}', '2026-03-19 16:45:44', '2026-03-19 16:45:48'),
(24, 'RES-1773939195378-6Y6VHV', 'reservation', 24, 11, 38, 600.00, 'PHP', 'paid', 'gcash', NULL, 'pay_fTDnyc5yFnr7wtKW25PezwNJ', 'src_NekyPZu4bBfRDbWwLn78yaXw', 'https://secure-authentication.paymongo.com/sources?id=src_NekyPZu4bBfRDbWwLn78yaXw', '2026-03-19 16:53:18', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":4,\"table_number\":\"T4\",\"source_status\":\"pending\",\"notes\":null}}', '2026-03-19 16:53:15', '2026-03-19 16:53:18'),
(25, 'RES-1773942552442-AGJXVH', 'reservation', 25, 11, 38, 1551.00, 'PHP', 'paid', 'gcash', NULL, 'pay_9N97mhQqSSYAhfq4pjfmFdxo', 'src_KpSKCDF47szDBTRKfSSVwAJC', 'https://secure-authentication.paymongo.com/sources?id=src_KpSKCDF47szDBTRKfSSVwAJC', '2026-03-19 17:49:16', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":4,\"table_number\":\"T4\",\"source_status\":\"pending\",\"notes\":\"Order: Red Horse Beer x1, gin bulag x1, bulag x15\"}}', '2026-03-19 17:49:12', '2026-03-19 17:49:16'),
(26, 'RES-1773949564646-FH5DSN', 'reservation', 26, 11, 38, 951.00, 'PHP', 'paid', 'gcash', NULL, 'pay_1XmMER36tyWKzcC6JuorJhvG', 'src_GJjCFFdk7oiLVRepMJDEn7mu', 'https://secure-authentication.paymongo.com/sources?id=src_GJjCFFdk7oiLVRepMJDEn7mu', '2026-03-19 19:46:10', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":3,\"table_number\":\"T3\",\"source_status\":\"pending\",\"notes\":\"Order: Red Horse Beer x1, gin bulag x1, bulag x15\"}}', '2026-03-19 19:46:04', '2026-03-19 19:46:10'),
(27, 'RES-1774133854163-MDP33W', 'reservation', 27, 11, 66, 612.00, 'PHP', 'paid', 'gcash', NULL, NULL, 'src_xviq7NpzT5YepB2rDU5mA7cm', 'https://secure-authentication.paymongo.com/sources?id=src_xviq7NpzT5YepB2rDU5mA7cm', '2026-03-21 22:57:37', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":1,\"table_number\":\"T1\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1\"}}', '2026-03-21 22:57:34', '2026-03-21 22:57:37'),
(28, 'RES-1774133928202-JW0SKQ', 'reservation', 28, 11, 66, 612.00, 'PHP', 'paid', 'gcash', NULL, NULL, 'src_jmsZJYzw5s99MBT9qHhrMhoe', 'https://secure-authentication.paymongo.com/sources?id=src_jmsZJYzw5s99MBT9qHhrMhoe', '2026-03-21 22:58:52', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":1,\"table_number\":\"T1\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1\"}}', '2026-03-21 22:58:48', '2026-03-21 22:58:52'),
(29, 'RES-1774143218843-8MY8BA', 'reservation', 29, 11, 66, 712.00, 'PHP', 'paid', 'gcash', NULL, NULL, 'src_Pt32oCwYRroGDMEnCsLZJ596', 'https://secure-authentication.paymongo.com/sources?id=src_Pt32oCwYRroGDMEnCsLZJ596', '2026-03-22 01:33:42', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":4,\"table_number\":\"vip3\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1\"}}', '2026-03-22 01:33:39', '2026-03-22 01:33:42'),
(30, 'RES-1774143281556-R5V5QV', 'reservation', 30, 11, 66, 712.00, 'PHP', 'paid', 'gcash', NULL, NULL, 'src_thHR8CTBPQpXxKT1mH6wvXYX', 'https://secure-authentication.paymongo.com/sources?id=src_thHR8CTBPQpXxKT1mH6wvXYX', '2026-03-22 01:34:45', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":4,\"table_number\":\"vip3\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1\"}}', '2026-03-22 01:34:41', '2026-03-22 01:34:45'),
(31, 'RES-1774188918898-D7UTFS', 'reservation', 31, 11, 66, 667.00, 'PHP', 'paid', 'gcash', NULL, NULL, 'src_UCSqYe8d7JYzH179uLBwEfCZ', 'https://secure-authentication.paymongo.com/sources?id=src_UCSqYe8d7JYzH179uLBwEfCZ', '2026-03-22 14:15:22', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":1,\"table_number\":\"vip1\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1, Red Horse Beer x1\"}}', '2026-03-22 14:15:19', '2026-03-22 14:15:22'),
(32, 'RES-1774189150636-72DK6U', 'reservation', 32, 11, 66, 612.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_f5W3JBbMMntgv5GWQDr7yv87', 'https://secure-authentication.paymongo.com/sources?id=src_f5W3JBbMMntgv5GWQDr7yv87', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":1,\"table_number\":\"vip1\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1\"}}', '2026-03-22 14:19:10', '2026-03-22 14:19:10'),
(33, 'RES-1774189491045-OGDNF2', 'reservation', 33, 11, 66, 612.00, 'PHP', 'pending', 'gcash', NULL, NULL, 'src_x9zGpgYb2WTGgxFaCsffffYC', 'https://secure-authentication.paymongo.com/sources?id=src_x9zGpgYb2WTGgxFaCsffffYC', NULL, NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":1,\"table_number\":\"vip1\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1\"}}', '2026-03-22 14:24:51', '2026-03-22 14:24:51'),
(34, 'RES-1774189603630-1A7M7B', 'reservation', 34, 11, 38, 667.00, 'PHP', 'paid', 'gcash', NULL, 'pay_5BNch1AMVRkvZ78wRqkN9S2d', 'src_qwRWHLmHerNYXgWKqH3cuGSV', 'https://secure-authentication.paymongo.com/sources?id=src_qwRWHLmHerNYXgWKqH3cuGSV', '2026-03-22 14:26:46', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":1,\"table_number\":\"vip1\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1, Red Horse Beer x1\"}}', '2026-03-22 14:26:43', '2026-03-22 14:26:46'),
(35, 'RES-1774189829150-8EKFR0', 'reservation', 35, 11, 38, 567.00, 'PHP', 'paid', 'gcash', NULL, 'pay_Ux5zLguTHhUNaVzApgYe5Pdv', 'src_b1qBGETVRk9L9hJgMyCohxoY', 'https://secure-authentication.paymongo.com/sources?id=src_b1qBGETVRk9L9hJgMyCohxoY', '2026-03-22 14:30:32', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":2,\"table_number\":\"vip2\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1, Red Horse Beer x1\"}}', '2026-03-22 14:30:29', '2026-03-22 14:30:32'),
(36, 'RES-1774191255698-3V5C4I', 'reservation', 36, 11, 38, 767.00, 'PHP', 'paid', 'gcash', NULL, 'pay_73imt6HG11pfgAyyLargv4tQ', 'src_vxtcNNBmYv5hp4me8QojkKwB', 'https://secure-authentication.paymongo.com/sources?id=src_vxtcNNBmYv5hp4me8QojkKwB', '2026-03-22 14:54:19', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":4,\"table_number\":\"vip3\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x1, Red Horse Beer x1\"}}', '2026-03-22 14:54:15', '2026-03-22 14:54:19'),
(37, 'RES-1774194760713-78CL2L', 'reservation', 37, 11, 38, 1288.00, 'PHP', 'paid', 'gcash', NULL, 'pay_NJMMZutrBJyDu5ELTeoxJ9TZ', 'src_54nyUt38Wq7Mw1cjQ6AgX959', 'https://secure-authentication.paymongo.com/sources?id=src_54nyUt38Wq7Mw1cjQ6AgX959', '2026-03-22 15:52:44', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":3,\"table_number\":\"t1\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1, bulag x22\"}}', '2026-03-22 15:52:40', '2026-03-22 15:52:44'),
(38, 'RES-1774196865064-D9SN3U', 'reservation', 38, 11, 38, 656.00, 'PHP', 'paid', 'gcash', NULL, 'pay_ZN5SKjvQFREGxWRmsUcXXNu1', 'src_E416WUTwQkbBqgyR5dK2egjw', 'https://secure-authentication.paymongo.com/sources?id=src_E416WUTwQkbBqgyR5dK2egjw', '2026-03-22 16:27:49', NULL, '{\"user_agent\":\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36\",\"related_snapshot\":{\"table_id\":4,\"table_number\":\"vip3\",\"source_status\":\"pending\",\"notes\":\"Order: gin bulag x1\"}}', '2026-03-22 16:27:45', '2026-03-22 16:27:49');

-- --------------------------------------------------------

--
-- Table structure for table `payouts`
--

CREATE TABLE `payouts` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `bar_owner_id` int(11) DEFAULT NULL,
  `payment_transaction_id` int(11) DEFAULT NULL,
  `order_id` int(11) DEFAULT NULL COMMENT 'Related order if applicable',
  `reservation_id` int(11) DEFAULT NULL COMMENT 'Related reservation if applicable',
  `gross_amount` decimal(10,2) NOT NULL COMMENT 'Total payment amount',
  `platform_fee` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Platform fee percentage',
  `platform_fee_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `net_amount` decimal(10,2) NOT NULL COMMENT 'Amount to payout to bar',
  `status` enum('pending','processing','sent','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
  `payout_method` varchar(50) DEFAULT NULL COMMENT 'gcash, bank_transfer',
  `payout_reference` varchar(255) DEFAULT NULL,
  `gcash_number` varchar(20) DEFAULT NULL,
  `gcash_account_name` varchar(255) DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payouts`
--

INSERT INTO `payouts` (`id`, `bar_id`, `bar_owner_id`, `payment_transaction_id`, `order_id`, `reservation_id`, `gross_amount`, `platform_fee`, `platform_fee_amount`, `net_amount`, `status`, `payout_method`, `payout_reference`, `gcash_number`, `gcash_account_name`, `processed_at`, `notes`, `created_at`, `updated_at`) VALUES
(1, 11, 14, 18, NULL, 18, 567.00, 22.00, 124.74, 442.26, 'sent', 'gcash', '12313123', '09123456789', 'asd', '2026-03-19 18:56:37', 'sdf', '2026-03-19 14:40:02', '2026-03-19 18:56:37'),
(2, 11, 14, 19, NULL, 19, 767.00, 22.00, 168.74, 598.26, 'sent', 'gcash', '12313123', '09123456789', 'asd', '2026-03-19 18:56:37', 'sdf', '2026-03-19 14:57:51', '2026-03-19 18:56:37'),
(3, 11, 14, 20, NULL, 20, 167.00, 22.00, 36.74, 130.26, 'sent', 'gcash', '12313123', '09123456789', 'asd', '2026-03-19 18:56:37', 'sdf', '2026-03-19 16:21:13', '2026-03-19 18:56:37'),
(4, 11, 14, 22, NULL, 22, 278.00, 22.00, 61.16, 216.84, 'sent', 'gcash', '12313123', '09123456789', 'asd', '2026-03-19 18:56:37', 'sdf', '2026-03-19 16:28:47', '2026-03-19 18:56:37'),
(5, 11, 14, 23, NULL, 23, 400.00, 22.00, 88.00, 312.00, 'sent', 'gcash', '12313123', '09123456789', 'asd', '2026-03-19 18:56:37', 'sdf', '2026-03-19 16:45:48', '2026-03-19 18:56:37'),
(6, 11, 14, 24, NULL, 24, 600.00, 22.00, 132.00, 468.00, 'sent', 'gcash', '12313123', '09123456789', 'asd', '2026-03-19 18:56:37', 'sdf', '2026-03-19 16:53:18', '2026-03-19 18:56:37'),
(7, 11, 14, 25, NULL, 25, 1551.00, 22.00, 341.22, 1209.78, 'sent', 'gcash', '12313123', '09123456789', 'asd', '2026-03-19 18:56:37', 'sdf', '2026-03-19 17:49:16', '2026-03-19 18:56:37'),
(8, 11, 14, 26, NULL, 26, 951.00, 22.00, 209.22, 741.78, 'sent', 'gcash', 'asd', '09123456789', 'asd', '2026-03-19 19:47:50', 'asd', '2026-03-19 19:46:10', '2026-03-19 19:47:50'),
(9, 11, 14, 27, NULL, 27, 612.00, 22.00, 134.64, 477.36, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-21 22:57:37', '2026-03-21 22:57:37'),
(10, 11, 14, 28, NULL, 28, 612.00, 22.00, 134.64, 477.36, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-21 22:58:52', '2026-03-21 22:58:52'),
(11, 11, 14, 29, NULL, 29, 712.00, 22.00, 156.64, 555.36, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-22 01:33:42', '2026-03-22 01:33:42'),
(12, 11, 14, 30, NULL, 30, 712.00, 22.00, 156.64, 555.36, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-22 01:34:45', '2026-03-22 01:34:45'),
(13, 11, 14, 31, NULL, 31, 667.00, 22.00, 146.74, 520.26, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-22 14:15:22', '2026-03-22 14:15:22'),
(14, 11, 14, 34, NULL, 34, 667.00, 22.00, 146.74, 520.26, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-22 14:26:46', '2026-03-22 14:26:46'),
(15, 11, 14, 35, NULL, 35, 567.00, 22.00, 124.74, 442.26, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-22 14:30:32', '2026-03-22 14:30:32'),
(16, 11, 14, 36, NULL, 36, 767.00, 22.00, 168.74, 598.26, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-22 14:54:19', '2026-03-22 14:54:19'),
(17, 11, 14, 37, NULL, 37, 1288.00, 22.00, 283.36, 1004.64, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-22 15:52:44', '2026-03-22 15:52:44'),
(18, 11, 14, 38, NULL, 38, 656.00, 22.00, 144.32, 511.68, 'pending', 'gcash', NULL, '09123456789', 'asd', NULL, NULL, '2026-03-22 16:27:49', '2026-03-22 16:27:49');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_deduction_audit`
--

CREATE TABLE `payroll_deduction_audit` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'Employee whose deductions were modified',
  `changed_by` int(11) NOT NULL COMMENT 'User who made the change',
  `action` varchar(50) NOT NULL COMMENT 'enable, disable, update',
  `deduction_type` varchar(50) DEFAULT NULL,
  `old_value` text DEFAULT NULL,
  `new_value` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Audit trail for deduction setting changes';

--
-- Dumping data for table `payroll_deduction_audit`
--

INSERT INTO `payroll_deduction_audit` (`id`, `bar_id`, `user_id`, `changed_by`, `action`, `deduction_type`, `old_value`, `new_value`, `created_at`) VALUES
(1, 11, 63, 29, 'enable', 'bir', NULL, 'true', '2026-03-21 23:27:37');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_deduction_items`
--

CREATE TABLE `payroll_deduction_items` (
  `id` int(11) NOT NULL,
  `payroll_item_id` int(11) NOT NULL COMMENT 'FK to payroll_items',
  `deduction_type` enum('bir','sss','philhealth','late','other') NOT NULL,
  `deduction_label` varchar(100) NOT NULL COMMENT 'Display label for the deduction',
  `amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1 COMMENT 'Whether this deduction is applied',
  `computation_basis` text DEFAULT NULL COMMENT 'JSON or text explaining how this was computed',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Itemized deductions for each payroll item';

--
-- Dumping data for table `payroll_deduction_items`
--

INSERT INTO `payroll_deduction_items` (`id`, `payroll_item_id`, `deduction_type`, `deduction_label`, `amount`, `is_enabled`, `computation_basis`, `created_at`) VALUES
(1, 63, 'sss', 'SSS Contribution', 180.00, 1, 'Salary: 0.00 → Employee: 180.00, Employer: 380.00, Total: 560.00', '2026-03-21 23:33:07'),
(2, 63, 'philhealth', 'PhilHealth Contribution', 250.00, 1, 'Salary: 0.00 × 5.00% = 500.00 (Employee: 250.00, Employer: 250.00)', '2026-03-21 23:33:07'),
(3, 66, 'sss', 'SSS Contribution', 180.00, 1, 'Salary: 0.00 → Employee: 180.00, Employer: 380.00, Total: 560.00', '2026-03-21 23:33:07'),
(4, 66, 'philhealth', 'PhilHealth Contribution', 250.00, 1, 'Salary: 0.00 × 5.00% = 500.00 (Employee: 250.00, Employer: 250.00)', '2026-03-21 23:33:07');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_items`
--

CREATE TABLE `payroll_items` (
  `id` int(11) NOT NULL,
  `payroll_run_id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `daily_rate` decimal(10,2) NOT NULL DEFAULT 0.00,
  `days_present` decimal(6,2) NOT NULL DEFAULT 0.00,
  `gross_pay` decimal(12,2) NOT NULL DEFAULT 0.00,
  `bir_deduction` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'BIR withholding tax deduction',
  `sss_deduction` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'SSS contribution deduction',
  `philhealth_deduction` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'PhilHealth contribution deduction',
  `late_deduction` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Late deduction based on tardiness',
  `other_deductions` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Other miscellaneous deductions',
  `total_deductions` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Sum of all deductions',
  `deductions` decimal(12,2) NOT NULL DEFAULT 0.00,
  `net_pay` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payroll_items`
--

INSERT INTO `payroll_items` (`id`, `payroll_run_id`, `bar_id`, `user_id`, `daily_rate`, `days_present`, `gross_pay`, `bir_deduction`, `sss_deduction`, `philhealth_deduction`, `late_deduction`, `other_deductions`, `total_deductions`, `deductions`, `net_pay`, `created_at`) VALUES
(2, 1, 11, 32, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-10 17:16:46'),
(3, 1, 11, 33, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-10 17:16:46'),
(4, 1, 11, 30, 500.00, 1.00, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 500.00, '2026-02-10 17:16:46'),
(5, 36, 11, 32, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-10 18:25:21'),
(6, 36, 11, 33, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-10 18:25:21'),
(7, 36, 11, 30, 700.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-10 18:25:21'),
(8, 40, 11, 32, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-10 18:26:13'),
(9, 40, 11, 33, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-10 18:26:13'),
(10, 40, 11, 30, 700.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-10 18:26:13'),
(11, 42, 11, 30, 700.00, 5.00, 3500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 3500.00, '2026-02-18 20:10:35'),
(12, 42, 11, 32, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-18 20:10:35'),
(13, 42, 11, 33, 1000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-18 20:10:35'),
(14, 39, 11, 30, 700.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-19 18:03:34'),
(15, 39, 11, 32, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-19 18:03:34'),
(16, 39, 11, 33, 1000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-19 18:03:34'),
(17, 39, 11, 35, 10000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-19 18:03:34'),
(18, 34, 11, 30, 700.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-19 20:22:39'),
(19, 34, 11, 32, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-19 20:22:39'),
(20, 34, 11, 33, 1000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-19 20:22:39'),
(21, 34, 11, 35, 10000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-19 20:22:39'),
(38, 49, 11, 30, 700.00, 1.00, 700.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 700.00, '2026-02-25 18:04:04'),
(39, 49, 11, 32, 500.00, 1.00, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 500.00, '2026-02-25 18:04:04'),
(40, 49, 11, 33, 1000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-25 18:04:04'),
(41, 49, 11, 35, 10000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-02-25 18:04:04'),
(42, 32, 11, 30, 700.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 19:57:16'),
(43, 32, 11, 32, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 19:57:16'),
(44, 32, 11, 33, 1000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 19:57:16'),
(45, 32, 11, 35, 10000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 19:57:16'),
(46, 50, 11, 30, 700.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 20:06:15'),
(47, 50, 11, 32, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 20:06:15'),
(48, 50, 11, 33, 1000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 20:06:15'),
(49, 50, 11, 35, 10000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 20:06:15'),
(50, 28, 11, 30, 700.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 20:24:22'),
(51, 28, 11, 32, 500.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 20:24:22'),
(52, 28, 11, 33, 1000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 20:24:22'),
(53, 28, 11, 35, 10000.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-05 20:24:22'),
(54, 51, 11, 59, 600.00, 1.00, 600.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 600.00, '2026-03-13 15:56:42'),
(55, 52, 11, 59, 600.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-17 15:28:45'),
(56, 52, 11, 63, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-17 15:28:45'),
(57, 53, 11, 59, 600.00, 1.00, 600.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 600.00, '2026-03-17 15:28:58'),
(58, 53, 11, 63, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-17 15:28:58'),
(59, 54, 11, 59, 600.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-17 15:29:08'),
(60, 54, 11, 63, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-17 15:29:08'),
(61, 56, 11, 59, 600.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-21 20:59:02'),
(62, 56, 11, 63, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-21 20:59:02'),
(63, 64, 11, 29, 0.00, 0.00, 0.00, 0.00, 180.00, 250.00, 0.00, 0.00, 430.00, 430.00, -430.00, '2026-03-21 23:33:07'),
(64, 64, 11, 59, 600.00, 1.00, 600.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 600.00, '2026-03-21 23:33:07'),
(65, 64, 11, 60, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, '2026-03-21 23:33:07'),
(66, 64, 11, 63, 0.00, 0.00, 0.00, 0.00, 180.00, 250.00, 0.00, 0.00, 430.00, 430.00, -430.00, '2026-03-21 23:33:07');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_runs`
--

CREATE TABLE `payroll_runs` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `status` enum('draft','finalized') NOT NULL DEFAULT 'draft',
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `finalized_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payroll_runs`
--

INSERT INTO `payroll_runs` (`id`, `bar_id`, `period_start`, `period_end`, `status`, `created_by`, `created_at`, `finalized_at`) VALUES
(1, 11, '2026-02-01', '2026-02-15', 'finalized', 31, '2026-02-10 16:23:33', '2026-02-11 01:45:35'),
(15, 11, '2026-02-01', '2026-02-01', 'draft', 31, '2026-02-10 18:11:12', NULL),
(16, 11, '2026-02-01', '2026-05-01', 'draft', 31, '2026-02-10 18:11:18', NULL),
(17, 11, '2026-02-01', '2026-05-12', 'draft', 31, '2026-02-10 18:11:24', NULL),
(18, 11, '2026-02-01', '2026-05-13', 'draft', 31, '2026-02-10 18:17:16', NULL),
(19, 11, '2026-02-01', '0000-00-00', 'draft', 31, '2026-02-10 18:17:25', NULL),
(20, 11, '0000-00-00', '0000-00-00', 'draft', 31, '2026-02-10 18:17:36', NULL),
(24, 11, '0000-00-00', '2026-12-13', 'draft', 31, '2026-02-10 18:18:17', NULL),
(28, 11, '2026-12-01', '2026-12-13', 'draft', 31, '2026-02-10 18:18:39', NULL),
(31, 11, '2026-02-01', '2026-03-15', 'finalized', 31, '2026-02-10 18:19:43', '2026-03-06 03:57:01'),
(32, 11, '2026-03-01', '2026-03-15', 'draft', 31, '2026-02-10 18:19:56', NULL),
(34, 11, '2026-03-02', '2026-03-15', 'draft', 31, '2026-02-10 18:20:08', NULL),
(36, 11, '2026-04-02', '2026-03-15', 'finalized', 31, '2026-02-10 18:20:19', '2026-02-11 02:25:21'),
(39, 11, '2026-04-02', '2026-03-16', 'draft', 31, '2026-02-10 18:25:54', NULL),
(40, 11, '2026-04-02', '2026-03-17', 'finalized', 31, '2026-02-10 18:26:13', '2026-02-11 02:26:14'),
(42, 11, '2026-02-01', '2026-03-16', 'finalized', 31, '2026-02-12 18:13:11', '2026-02-19 04:26:48'),
(46, 11, '2026-02-18', '2026-02-19', 'finalized', 31, '2026-02-18 20:27:06', '2026-02-19 04:27:13'),
(49, 11, '2026-02-24', '2026-02-26', 'finalized', 29, '2026-02-25 18:04:02', '2026-02-26 02:18:31'),
(50, 11, '2026-03-04', '2026-03-26', 'finalized', 29, '2026-03-05 20:06:11', '2026-03-13 04:11:10'),
(51, 11, '2026-03-01', '2026-03-31', 'finalized', 29, '2026-03-13 15:56:39', '2026-03-13 23:56:48'),
(52, 11, '2026-03-17', '2026-03-17', 'draft', 29, '2026-03-17 15:28:45', NULL),
(53, 11, '2026-03-12', '2026-03-17', 'finalized', 29, '2026-03-17 15:28:58', '2026-03-18 02:22:44'),
(54, 11, '2026-12-12', '2026-12-17', 'finalized', 29, '2026-03-17 15:29:08', '2026-03-17 23:53:57'),
(55, 11, '2026-03-21', '2026-03-11', 'draft', 29, '2026-03-21 20:58:51', NULL),
(56, 11, '2026-03-21', '2026-03-31', 'finalized', 29, '2026-03-21 20:59:02', '2026-03-22 04:59:08'),
(57, 11, '2026-03-20', '2026-03-23', 'finalized', 29, '2026-03-21 23:28:33', '2026-03-22 07:28:40'),
(64, 11, '2026-03-15', '2026-03-25', 'draft', 29, '2026-03-21 23:33:07', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `module` varchar(50) NOT NULL,
  `action` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `name`, `module`, `action`, `description`, `created_at`) VALUES
(1, 'menu_view', 'menu', 'view', 'View all menu items', '2026-03-21 22:18:29'),
(2, 'menu_create', 'menu', 'create', 'Add new menu items', '2026-03-21 22:18:29'),
(3, 'menu_update', 'menu', 'update', 'Edit existing menu items', '2026-03-21 22:18:29'),
(4, 'menu_delete', 'menu', 'delete', 'Delete menu items', '2026-03-21 22:18:29'),
(5, 'menu_publish', 'menu', 'publish', 'Publish menu item to Customer Platform and POS App', '2026-03-21 22:18:29'),
(6, 'bar_details_view', 'bar_details', 'view', 'View branch info, GCash details, open/close hours', '2026-03-21 22:18:29'),
(7, 'bar_details_update', 'bar_details', 'update', 'Edit branch info, GCash details, open/close hours', '2026-03-21 22:18:29'),
(8, 'table_view', 'table', 'view', 'View all tables and their status', '2026-03-21 22:18:29'),
(9, 'table_update', 'table', 'update', 'Change table status (unavailable, maintenance, etc.)', '2026-03-21 22:18:29'),
(10, 'table_reserve', 'table', 'reserve', 'Create/manage reservations tied to a table', '2026-03-21 22:18:29'),
(11, 'reservation_view', 'reservation', 'view', 'View all reservations with detailed modal info', '2026-03-21 22:18:29'),
(12, 'reservation_manage', 'reservation', 'manage', 'Update or manage reservation statuses', '2026-03-21 22:18:29'),
(13, 'reservation_create', 'reservation', 'create', 'Create new reservations', '2026-03-21 22:18:29'),
(14, 'events_view', 'events', 'view', 'View all events and posts', '2026-03-21 22:18:29'),
(15, 'events_create', 'events', 'create', 'Create new events/posts', '2026-03-21 22:18:29'),
(16, 'events_update', 'events', 'update', 'Edit existing events/posts', '2026-03-21 22:18:29'),
(17, 'events_delete', 'events', 'delete', 'Delete events/posts', '2026-03-21 22:18:29'),
(18, 'events_comment_reply', 'events', 'comment_reply', 'Reply to comments on posts and events', '2026-03-21 22:18:29'),
(19, 'events_comment_manage', 'events', 'comment_manage', 'Delete or moderate comments', '2026-03-21 22:18:29'),
(20, 'staff_view', 'staff', 'view', 'View list of staff accounts', '2026-03-21 22:18:29'),
(21, 'staff_create', 'staff', 'create', 'Create new staff accounts', '2026-03-21 22:18:29'),
(22, 'staff_update', 'staff', 'update', 'Edit staff profiles and details', '2026-03-21 22:18:29'),
(23, 'staff_reset_password', 'staff', 'reset_password', 'Reset any employee password', '2026-03-21 22:18:29'),
(24, 'staff_edit_permissions', 'staff', 'edit_permissions', 'Edit another staff member permission set', '2026-03-21 22:18:29'),
(25, 'staff_deactivate', 'staff', 'deactivate', 'Deactivate a staff account', '2026-03-21 22:18:29'),
(26, 'staff_delete', 'staff', 'delete', 'Permanently delete a staff account', '2026-03-21 22:18:29'),
(27, 'attendance_view_own', 'attendance', 'view_own', 'View and manage own time in/time out', '2026-03-21 22:18:29'),
(28, 'attendance_view_all', 'attendance', 'view_all', 'View attendance records of all staff', '2026-03-21 22:18:29'),
(29, 'attendance_create', 'attendance', 'create', 'Create attendance entries for staff', '2026-03-21 22:18:29'),
(30, 'leave_view_own', 'leave', 'view_own', 'View own leave applications and status', '2026-03-21 22:18:29'),
(31, 'leave_apply', 'leave', 'apply', 'Submit a leave request', '2026-03-21 22:18:29'),
(32, 'leave_view_all', 'leave', 'view_all', 'See all leave applications', '2026-03-21 22:18:29'),
(33, 'leave_approve', 'leave', 'approve', 'Approve or decline leave requests', '2026-03-21 22:18:29'),
(34, 'payroll_view_own', 'payroll', 'view_own', 'View own payroll records', '2026-03-21 22:18:29'),
(35, 'payroll_view_all', 'payroll', 'view_all', 'View all payroll records', '2026-03-21 22:18:29'),
(36, 'payroll_create', 'payroll', 'create', 'Run payroll processing', '2026-03-21 22:18:29'),
(37, 'documents_view_own', 'documents', 'view_own', 'View own documents', '2026-03-21 22:18:29'),
(38, 'documents_view_all', 'documents', 'view_all', 'View all documents', '2026-03-21 22:18:29'),
(39, 'documents_send', 'documents', 'send', 'Upload and send documents', '2026-03-21 22:18:29'),
(40, 'documents_manage', 'documents', 'manage', 'Approve and manage documents', '2026-03-21 22:18:29'),
(41, 'financials_view', 'financials', 'view', 'View financial reports and cashflow', '2026-03-21 22:18:29'),
(42, 'analytics_bar_view', 'analytics', 'bar_view', 'View analytics and DSS insights', '2026-03-21 22:18:29'),
(43, 'reviews_view', 'reviews', 'view', 'View customer reviews', '2026-03-21 22:18:29'),
(44, 'reviews_reply', 'reviews', 'reply', 'Reply to customer reviews', '2026-03-21 22:18:29'),
(45, 'ban_view', 'ban', 'view', 'View customer ban list', '2026-03-21 22:18:29'),
(46, 'ban_branch', 'ban', 'branch', 'Ban customers from this bar', '2026-03-21 22:18:29'),
(47, 'ban_lift', 'ban', 'lift', 'Lift customer bans', '2026-03-21 22:18:29'),
(48, 'logs_view', 'logs', 'view', 'View audit logs and activity history', '2026-03-21 22:18:29'),
(49, 'deduction_settings_view', 'deduction_settings', 'view', 'View employee deduction settings', '2026-03-21 23:27:19'),
(50, 'deduction_settings_manage', 'deduction_settings', 'manage', 'Configure and manage employee deduction settings (BIR, SSS, PhilHealth, Late)', '2026-03-21 23:27:19');

-- --------------------------------------------------------

--
-- Table structure for table `philhealth_contribution_table`
--

CREATE TABLE `philhealth_contribution_table` (
  `id` int(11) NOT NULL,
  `min_salary` decimal(10,2) NOT NULL COMMENT 'Minimum monthly basic salary',
  `max_salary` decimal(10,2) DEFAULT NULL COMMENT 'Maximum monthly basic salary',
  `premium_rate` decimal(5,4) NOT NULL COMMENT 'Premium rate (e.g., 0.05 for 5%)',
  `employee_share_rate` decimal(5,4) NOT NULL COMMENT 'Employee share rate (usually 50%)',
  `min_contribution` decimal(10,2) NOT NULL DEFAULT 0.00,
  `max_contribution` decimal(10,2) DEFAULT NULL,
  `year` int(4) NOT NULL DEFAULT 2024,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='PhilHealth contribution rates based on monthly basic salary';

--
-- Dumping data for table `philhealth_contribution_table`
--

INSERT INTO `philhealth_contribution_table` (`id`, `min_salary`, `max_salary`, `premium_rate`, `employee_share_rate`, `min_contribution`, `max_contribution`, `year`, `is_active`) VALUES
(1, 0.00, 10000.00, 0.0500, 0.5000, 500.00, 500.00, 2024, 1),
(2, 10000.01, 100000.00, 0.0500, 0.5000, 0.00, 5000.00, 2024, 1),
(3, 100000.01, NULL, 0.0500, 0.5000, 5000.00, 5000.00, 2024, 1),
(4, 0.00, 10000.00, 0.0500, 0.5000, 500.00, 500.00, 2024, 1),
(5, 10000.01, 100000.00, 0.0500, 0.5000, 0.00, 5000.00, 2024, 1),
(6, 100000.01, NULL, 0.0500, 0.5000, 5000.00, 5000.00, 2024, 1);

-- --------------------------------------------------------

--
-- Table structure for table `platform_announcements`
--

CREATE TABLE `platform_announcements` (
  `id` int(11) NOT NULL,
  `title` varchar(150) NOT NULL,
  `message` text NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `starts_at` datetime DEFAULT NULL,
  `ends_at` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `platform_announcements`
--

INSERT INTO `platform_announcements` (`id`, `title`, `message`, `is_active`, `starts_at`, `ends_at`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'ASDAD', 'ASD', 1, NULL, NULL, 36, '2026-03-18 16:33:17', '2026-03-18 16:33:17'),
(2, 'app will update', 'hihi', 1, '2026-03-21 02:57:00', '2026-03-21 02:57:00', 36, '2026-03-19 18:57:51', '2026-03-19 18:57:51');

-- --------------------------------------------------------

--
-- Table structure for table `platform_audit_logs`
--

CREATE TABLE `platform_audit_logs` (
  `id` bigint(20) NOT NULL,
  `actor_user_id` int(11) NOT NULL,
  `action` varchar(100) NOT NULL,
  `entity` varchar(80) NOT NULL,
  `entity_id` int(11) DEFAULT NULL,
  `target_bar_id` int(11) DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `platform_audit_logs`
--

INSERT INTO `platform_audit_logs` (`id`, `actor_user_id`, `action`, `entity`, `entity_id`, `target_bar_id`, `details`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, 36, 'APPROVE_BAR', 'bar', 11, 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:29:52'),
(2, 36, 'APPROVE_BAR', 'bar', 11, 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:29:54'),
(3, 36, 'APPROVE_BAR', 'bar', 10, 10, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:29:55'),
(4, 36, 'SUSPEND_BAR', 'bar', 11, 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:36:11'),
(5, 36, 'SUSPEND_BAR', 'bar', 11, 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:36:12'),
(6, 36, 'SUSPEND_BAR', 'bar', 11, 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:36:13'),
(7, 36, 'APPROVE_BAR', 'bar', 11, 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:36:13'),
(8, 36, 'DISABLE_OWNER', 'user', 22, NULL, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:57:53'),
(9, 36, 'ENABLE_OWNER', 'user', 22, NULL, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 18:57:54'),
(10, 36, 'DISABLE_OWNER', 'user', 19, NULL, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:00:15'),
(11, 36, 'ENABLE_OWNER', 'user', 19, NULL, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:00:16'),
(12, 36, 'FORCE_PERMISSION_RESET', 'role', 5, NULL, '{\"permission_count\":8}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:04:00'),
(13, 36, 'FORCE_PERMISSION_RESET', 'role', 5, NULL, '{\"permission_count\":8}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:04:18'),
(14, 36, 'FORCE_PERMISSION_RESET', 'role', 8, NULL, '{\"permission_count\":2}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:04:35'),
(15, 36, 'SUSPEND_BAR', 'bar', 11, 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:26:22'),
(16, 36, 'REACTIVATE_BAR', 'bar', 11, 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:26:24'),
(17, 36, 'SUSPEND_BAR', 'bar', 11, 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:26:25'),
(18, 36, 'APPROVE_BAR', 'bar', 11, 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 19:26:26'),
(19, 36, 'DISABLE_OWNER', 'user', 37, NULL, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 20:42:28'),
(20, 36, 'ENABLE_OWNER', 'user', 37, NULL, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-27 20:42:32'),
(21, 36, 'SUSPEND_BAR', 'bar', 11, 11, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 04:39:15'),
(22, 36, 'REACTIVATE_BAR', 'bar', 11, 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-02-28 04:45:03'),
(23, 36, 'SUSPEND_BAR', 'bar', 12, 12, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 16:49:28'),
(24, 36, 'SUSPEND_BAR', 'bar', 13, 13, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 16:49:30'),
(25, 36, 'SUSPEND_BAR', 'bar', 10, 10, '{\"reason\":null}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-04 16:49:32'),
(26, 36, 'REACTIVATE_BAR', 'bar', 12, 12, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:46:27'),
(27, 36, 'REACTIVATE_BAR', 'bar', 13, 13, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:46:28'),
(28, 36, 'REACTIVATE_BAR', 'bar', 10, 10, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-05 14:46:30'),
(29, 36, 'FORCE_PERMISSION_RESET', 'role', 7, NULL, '{\"permission_count\":39}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-12 23:25:30'),
(30, 36, 'BAN_CUSTOMER', 'customer_bar_ban', 34, 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 13:42:38'),
(31, 36, 'UNBAN_CUSTOMER', 'customer_bar_ban', 34, 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 13:42:42'),
(32, 36, 'BAN_CUSTOMER', 'customer_bar_ban', 38, 11, NULL, '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 13:42:55'),
(33, 36, 'BAN_CUSTOMER_PLATFORM', 'user', 34, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:09:16'),
(34, 36, 'BAN_CUSTOMER_PLATFORM', 'user', 38, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:09:19'),
(35, 36, 'UNBAN_CUSTOMER_PLATFORM', 'user', 34, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:09:20'),
(36, 36, 'BAN_CUSTOMER_PLATFORM', 'user', 34, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:09:22'),
(37, 36, 'BAN_CUSTOMER_PLATFORM', 'user', 23, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:09:23'),
(38, 36, 'UNBAN_CUSTOMER_PLATFORM', 'user', 34, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:09:28'),
(39, 36, 'UNBAN_CUSTOMER_PLATFORM', 'user', 38, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:41:43'),
(40, 36, 'UNBAN_CUSTOMER_PLATFORM', 'user', 23, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:41:44'),
(41, 36, 'BAN_CUSTOMER_PLATFORM', 'user', 38, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:41:45'),
(42, 36, 'UNBAN_CUSTOMER_PLATFORM', 'user', 38, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 14:41:46'),
(43, 36, 'BAN_CUSTOMER_PLATFORM', 'user', 38, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 20:03:00'),
(44, 36, 'UNBAN_CUSTOMER_PLATFORM', 'user', 38, NULL, '{\"scope\":\"global\"}', '::ffff:127.0.0.1', 'Dart/3.11 (dart:io)', '2026-03-13 20:03:06'),
(45, 36, 'APPROVE_BAR', 'bar', 14, 14, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 16:10:18'),
(46, 36, 'CREATE_ANNOUNCEMENT', 'platform_announcement', 1, NULL, '{\"title\":\"ASDAD\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Windsurf/1.107.0 Chrome/142.0.7444.175 Electron/39.2.3 Safari/537.36', '2026-03-18 16:33:17'),
(47, 36, 'BAN_CUSTOMER_PLATFORM', 'user', 38, NULL, '{\"scope\":\"global\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-18 16:35:25'),
(48, 36, 'UNBAN_CUSTOMER_PLATFORM', 'user', 38, NULL, '{\"scope\":\"global\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-18 16:35:29'),
(49, 36, 'BAN_CUSTOMER_PLATFORM', 'user', 23, NULL, '{\"scope\":\"global\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-18 16:38:11'),
(50, 36, 'UNBAN_CUSTOMER_PLATFORM', 'user', 23, NULL, '{\"scope\":\"global\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0', '2026-03-18 16:38:14'),
(51, 36, 'RESET_USER_PASSWORD', 'user', 38, NULL, '{\"target_email\":\"clarencecustomer@gmail.com\",\"target_role\":\"customer\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-18 17:55:27'),
(52, 36, 'CREATE_ANNOUNCEMENT', 'platform_announcement', 2, NULL, '{\"title\":\"app will update\"}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 18:57:51'),
(53, 36, 'UPDATE_MAINTENANCE_MODE', 'platform_setting', NULL, NULL, '{\"maintenance_mode\":1,\"maintenance_message\":null}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 20:09:02'),
(54, 36, 'UPDATE_MAINTENANCE_MODE', 'platform_setting', NULL, NULL, '{\"maintenance_mode\":1,\"maintenance_message\":null}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 20:25:04'),
(55, 36, 'UPDATE_MAINTENANCE_MODE', 'platform_setting', NULL, NULL, '{\"maintenance_mode\":0,\"maintenance_message\":null}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '2026-03-19 20:25:06');

-- --------------------------------------------------------

--
-- Table structure for table `platform_feedback`
--

CREATE TABLE `platform_feedback` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `rating` int(11) NOT NULL CHECK (`rating` between 1 and 5),
  `comment` text DEFAULT NULL,
  `admin_reply` text DEFAULT NULL COMMENT 'Super admin reply to this feedback',
  `replied_at` timestamp NULL DEFAULT NULL COMMENT 'When the admin replied',
  `replied_by` int(11) DEFAULT NULL COMMENT 'FK to users.id of the admin who replied',
  `category` varchar(50) DEFAULT 'general',
  `status` enum('pending','reviewed','resolved') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `platform_feedback`
--

INSERT INTO `platform_feedback` (`id`, `user_id`, `rating`, `comment`, `admin_reply`, `replied_at`, `replied_by`, `category`, `status`, `created_at`, `updated_at`) VALUES
(1, 38, 4, 'MABAGAL', 'sorry for the inconvience po', '2026-03-19 18:55:15', 36, 'performance', 'reviewed', '2026-03-19 17:11:51', '2026-03-19 18:55:15'),
(2, 38, 1, 'sadf', NULL, NULL, NULL, 'general', 'resolved', '2026-03-19 19:09:04', '2026-03-19 20:50:41'),
(3, 66, 5, NULL, NULL, NULL, NULL, 'general', 'pending', '2026-03-22 01:29:14', '2026-03-22 01:29:14');

-- --------------------------------------------------------

--
-- Table structure for table `platform_settings`
--

CREATE TABLE `platform_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text NOT NULL,
  `description` text DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `platform_settings`
--

INSERT INTO `platform_settings` (`id`, `setting_key`, `setting_value`, `description`, `updated_by`, `updated_at`) VALUES
(1, 'platform_fee_percentage', '22.00', 'Platform fee percentage for customer payments', 36, '2026-03-18 17:32:27'),
(2, 'paymongo_public_key', 'pk_test_REMOVED', 'PayMongo public API key', NULL, '2026-03-17 16:52:55'),
(3, 'paymongo_secret_key', 'sk_test_REMOVED', 'PayMongo secret API key', NULL, '2026-03-17 16:52:55'),
(4, 'paymongo_webhook_secret', 'whsk_REMOVED', 'PayMongo webhook signing secret', NULL, '2026-03-17 16:52:55'),
(5, 'payments_enabled', '1', 'Enable/disable global payment processing system', 36, '2026-03-18 16:37:50'),
(14, 'maintenance_mode', '0', 'Enable/disable maintenance mode', 36, '2026-03-19 20:25:06'),
(15, 'maintenance_message', '', 'Message shown during maintenance mode', 36, '2026-03-19 20:09:02');

-- --------------------------------------------------------

--
-- Table structure for table `post_comments`
--

CREATE TABLE `post_comments` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `comment` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `post_likes`
--

CREATE TABLE `post_likes` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pos_orders`
--

CREATE TABLE `pos_orders` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `table_id` int(11) DEFAULT NULL,
  `staff_user_id` int(11) NOT NULL,
  `order_number` varchar(30) NOT NULL,
  `status` enum('pending','completed','cancelled','paid') NOT NULL DEFAULT 'pending',
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payment_transaction_id` int(11) DEFAULT NULL,
  `payment_status` enum('pending','paid','refunded','failed') DEFAULT 'pending',
  `payment_method` enum('cash','digital') DEFAULT NULL,
  `amount_received` decimal(12,2) DEFAULT 0.00,
  `change_amount` decimal(12,2) DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pos_orders`
--

INSERT INTO `pos_orders` (`id`, `bar_id`, `table_id`, `staff_user_id`, `order_number`, `status`, `subtotal`, `discount_amount`, `total_amount`, `payment_transaction_id`, `payment_status`, `payment_method`, `amount_received`, `change_amount`, `notes`, `completed_at`, `cancelled_at`, `created_at`, `updated_at`) VALUES
(1, 11, NULL, 29, 'POS-20260305-001', 'completed', 336.00, 0.00, 336.00, NULL, 'pending', 'cash', 500.00, 164.00, NULL, '2026-03-06 06:05:46', NULL, '2026-03-05 22:05:42', '2026-03-05 22:05:46'),
(2, 11, NULL, 29, 'POS-20260305-002', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'digital', 56.00, 0.00, NULL, '2026-03-06 06:43:42', NULL, '2026-03-05 22:43:38', '2026-03-05 22:43:42'),
(3, 11, NULL, 29, 'POS-20260305-003', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'cash', 100.00, 44.00, NULL, '2026-03-06 06:44:29', NULL, '2026-03-05 22:44:25', '2026-03-05 22:44:29'),
(4, 11, NULL, 29, 'POS-20260305-004', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'cash', 100.00, 44.00, NULL, '2026-03-06 06:47:36', NULL, '2026-03-05 22:47:33', '2026-03-05 22:47:36'),
(5, 11, NULL, 29, 'POS-20260305-005', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'cash', 100.00, 44.00, NULL, '2026-03-06 07:09:51', NULL, '2026-03-05 23:09:48', '2026-03-05 23:09:51'),
(6, 11, NULL, 29, 'POS-20260305-006', 'completed', 224.00, 0.00, 224.00, NULL, 'pending', 'cash', 500.00, 276.00, NULL, '2026-03-06 07:13:21', NULL, '2026-03-05 23:13:14', '2026-03-05 23:13:21'),
(7, 11, NULL, 29, 'POS-20260305-007', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'cash', 100.00, 44.00, NULL, '2026-03-06 07:20:22', NULL, '2026-03-05 23:20:20', '2026-03-05 23:20:22'),
(8, 11, NULL, 29, 'POS-20260305-008', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'digital', 56.00, 0.00, NULL, '2026-03-06 07:21:39', NULL, '2026-03-05 23:21:36', '2026-03-05 23:21:39'),
(9, 11, NULL, 29, 'POS-20260305-009', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'digital', 56.00, 0.00, NULL, '2026-03-06 07:25:01', NULL, '2026-03-05 23:24:58', '2026-03-05 23:25:01'),
(10, 11, NULL, 29, 'POS-20260305-010', 'completed', 112.00, 0.00, 112.00, NULL, 'pending', 'cash', 500.00, 388.00, NULL, '2026-03-06 07:27:13', NULL, '2026-03-05 23:27:10', '2026-03-05 23:27:13'),
(11, 11, NULL, 29, 'POS-20260305-011', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'cash', 500.00, 444.00, NULL, '2026-03-06 07:30:38', NULL, '2026-03-05 23:30:36', '2026-03-05 23:30:38'),
(12, 11, NULL, 29, 'POS-20260305-012', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'digital', 56.00, 0.00, NULL, '2026-03-06 07:32:50', NULL, '2026-03-05 23:32:46', '2026-03-05 23:32:50'),
(13, 11, NULL, 29, 'POS-20260305-013', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'digital', 56.00, 0.00, NULL, '2026-03-06 07:41:07', NULL, '2026-03-05 23:41:04', '2026-03-05 23:41:07'),
(16, 11, NULL, 29, 'POS-20260306-003', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'digital', 56.00, 0.00, NULL, '2026-03-07 01:48:39', NULL, '2026-03-06 17:48:37', '2026-03-06 17:48:39'),
(17, 11, NULL, 29, 'POS-20260306-004', 'completed', 112.00, 0.00, 112.00, NULL, 'pending', 'digital', 112.00, 0.00, NULL, '2026-03-07 02:44:52', NULL, '2026-03-06 18:44:51', '2026-03-06 18:44:52'),
(23, 11, NULL, 29, 'POS-20260312-001', 'completed', 56.00, 0.00, 56.00, NULL, 'pending', 'digital', 56.00, 0.00, NULL, '2026-03-13 06:53:51', NULL, '2026-03-12 14:52:36', '2026-03-12 22:53:51'),
(24, 11, 4, 29, 'POS-20260312-002', 'completed', 168.00, 0.00, 168.00, NULL, 'pending', 'digital', 168.00, 0.00, NULL, '2026-03-13 06:54:12', NULL, '2026-03-12 14:53:03', '2026-03-12 22:54:12'),
(25, 11, 3, 29, 'POS-20260313-001', 'completed', 387.00, 0.00, 387.00, NULL, 'pending', 'digital', 387.00, 0.00, NULL, '2026-03-14 04:22:27', NULL, '2026-03-13 12:22:21', '2026-03-13 20:22:27'),
(26, 11, NULL, 29, 'POS-20260317-001', 'cancelled', 56.00, 0.00, 56.00, NULL, 'pending', NULL, 0.00, 0.00, NULL, NULL, '2026-03-17 23:07:22', '2026-03-17 07:06:10', '2026-03-17 15:07:22'),
(27, 11, NULL, 29, 'POS-20260317-002', 'completed', 499.00, 0.00, 499.00, NULL, 'pending', 'digital', 499.00, 0.00, NULL, '2026-03-17 23:48:54', NULL, '2026-03-17 07:48:52', '2026-03-17 15:48:54');

-- --------------------------------------------------------

--
-- Table structure for table `pos_order_items`
--

CREATE TABLE `pos_order_items` (
  `id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `menu_item_id` int(11) NOT NULL,
  `inventory_item_id` int(11) NOT NULL,
  `item_name` varchar(150) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pos_order_items`
--

INSERT INTO `pos_order_items` (`id`, `order_id`, `menu_item_id`, `inventory_item_id`, `item_name`, `unit_price`, `quantity`, `subtotal`, `created_at`) VALUES
(1, 1, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 22:05:42'),
(2, 1, 1, 3, 'gin bulag', 56.00, 5, 280.00, '2026-03-05 22:05:42'),
(3, 2, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 22:43:38'),
(4, 3, 1, 3, 'gin bulag', 56.00, 1, 56.00, '2026-03-05 22:44:25'),
(5, 4, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 22:47:33'),
(6, 5, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 23:09:48'),
(7, 6, 3, 4, 'bulag', 56.00, 2, 112.00, '2026-03-05 23:13:14'),
(8, 6, 1, 3, 'gin bulag', 56.00, 2, 112.00, '2026-03-05 23:13:14'),
(9, 7, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 23:20:20'),
(10, 8, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 23:21:36'),
(11, 9, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 23:24:58'),
(12, 10, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 23:27:10'),
(13, 10, 1, 3, 'gin bulag', 56.00, 1, 56.00, '2026-03-05 23:27:10'),
(14, 11, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 23:30:36'),
(15, 12, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 23:32:46'),
(16, 13, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-05 23:41:04'),
(19, 16, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-06 17:48:37'),
(20, 17, 1, 3, 'gin bulag', 56.00, 1, 56.00, '2026-03-06 18:44:51'),
(21, 17, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-06 18:44:51'),
(30, 23, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-12 22:53:42'),
(31, 24, 1, 3, 'gin bulag', 56.00, 3, 168.00, '2026-03-12 22:54:09'),
(32, 25, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-13 20:22:21'),
(33, 25, 1, 3, 'gin bulag', 56.00, 1, 56.00, '2026-03-13 20:22:21'),
(34, 25, 2, 2, 'Red Horse Beer', 55.00, 5, 275.00, '2026-03-13 20:22:21'),
(35, 26, 3, 4, 'bulag', 56.00, 1, 56.00, '2026-03-17 15:06:22'),
(36, 27, 3, 4, 'bulag', 56.00, 4, 224.00, '2026-03-17 15:48:53'),
(37, 27, 2, 2, 'Red Horse Beer', 55.00, 5, 275.00, '2026-03-17 15:48:53');

-- --------------------------------------------------------

--
-- Table structure for table `promotions`
--

CREATE TABLE `promotions` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `discount_type` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
  `discount_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `valid_from` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `image_path` varchar(500) DEFAULT NULL,
  `status` enum('active','inactive','expired') DEFAULT 'active',
  `redeemed_count` int(11) NOT NULL DEFAULT 0,
  `max_redemptions` int(11) DEFAULT NULL COMMENT 'NULL = unlimited',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reply_reactions`
--

CREATE TABLE `reply_reactions` (
  `id` int(11) NOT NULL,
  `reply_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reaction` varchar(20) NOT NULL DEFAULT 'like',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `reservations`
--

CREATE TABLE `reservations` (
  `id` int(11) NOT NULL,
  `transaction_number` varchar(30) DEFAULT NULL COMMENT 'Human-readable transaction number for bar owner lookup',
  `bar_id` int(11) NOT NULL,
  `table_id` int(11) DEFAULT NULL,
  `customer_user_id` int(11) DEFAULT NULL,
  `guest_name` varchar(255) DEFAULT NULL,
  `guest_email` varchar(255) DEFAULT NULL,
  `guest_phone` varchar(50) DEFAULT NULL,
  `reservation_date` date NOT NULL,
  `reservation_time` time NOT NULL,
  `party_size` int(11) NOT NULL DEFAULT 1,
  `occasion` varchar(100) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','confirmed','rejected','cancelled','paid') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `payment_status` enum('pending','paid','refunded','failed') DEFAULT NULL COMMENT 'Payment status for reservation',
  `payment_method` enum('cash','gcash','other') DEFAULT NULL COMMENT 'Payment method used',
  `deposit_amount` decimal(10,2) DEFAULT NULL COMMENT 'Deposit amount paid',
  `payment_reference` varchar(255) DEFAULT NULL COMMENT 'Payment reference/transaction ID',
  `payment_transaction_id` int(11) DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL COMMENT 'When payment was completed'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reservations`
--

INSERT INTO `reservations` (`id`, `transaction_number`, `bar_id`, `table_id`, `customer_user_id`, `guest_name`, `guest_email`, `guest_phone`, `reservation_date`, `reservation_time`, `party_size`, `occasion`, `notes`, `status`, `created_at`, `payment_status`, `payment_method`, `deposit_amount`, `payment_reference`, `payment_transaction_id`, `paid_at`) VALUES
(1, NULL, 11, 1, 34, NULL, NULL, NULL, '2026-03-01', '19:00:00', 2, NULL, NULL, 'approved', '2026-02-13 14:52:04', NULL, NULL, NULL, NULL, NULL, NULL),
(2, NULL, 11, 2, 34, NULL, NULL, NULL, '2026-03-01', '19:00:00', 2, NULL, 'Test booking gusto ko may eababa na malake pwet', 'rejected', '2026-02-13 14:58:07', NULL, NULL, NULL, NULL, NULL, NULL),
(3, NULL, 11, 1, 38, NULL, NULL, NULL, '2026-02-28', '21:46:00', 2, NULL, NULL, 'cancelled', '2026-02-28 21:46:18', NULL, NULL, NULL, NULL, NULL, NULL),
(4, NULL, 11, 2, 38, NULL, NULL, NULL, '2026-02-28', '21:46:00', 2, NULL, NULL, 'cancelled', '2026-02-28 21:46:36', NULL, NULL, NULL, NULL, NULL, NULL),
(5, NULL, 11, 1, 38, NULL, NULL, NULL, '2026-03-12', '21:50:00', 2, NULL, NULL, 'cancelled', '2026-03-12 21:50:47', NULL, NULL, NULL, NULL, NULL, NULL),
(6, NULL, 11, 2, 66, NULL, NULL, NULL, '2026-11-12', '12:12:00', 2, NULL, NULL, 'rejected', '2026-03-18 18:09:02', NULL, NULL, NULL, NULL, NULL, NULL),
(7, NULL, 11, 2, 66, NULL, NULL, NULL, '2026-12-12', '12:12:00', 2, NULL, NULL, 'rejected', '2026-03-18 18:10:00', NULL, NULL, NULL, NULL, NULL, NULL),
(8, NULL, 11, 2, 66, NULL, NULL, NULL, '2026-12-12', '13:12:00', 2, NULL, NULL, 'confirmed', '2026-03-18 18:17:13', 'paid', NULL, NULL, NULL, 8, '2026-03-18 18:17:16'),
(9, NULL, 11, 4, 38, NULL, NULL, NULL, '2026-01-30', '16:20:00', 2, NULL, '1234', 'rejected', '2026-03-18 18:21:38', 'pending', NULL, NULL, NULL, 9, NULL),
(10, NULL, 11, 2, 38, NULL, NULL, NULL, '2026-03-18', '19:26:00', 2, NULL, 'Order: Red Horse Beer x1, gin bulag x1, bulag x1', 'rejected', '2026-03-18 19:26:32', 'pending', NULL, NULL, NULL, 10, NULL),
(11, NULL, 11, 4, 38, NULL, NULL, NULL, '2026-03-20', '20:27:00', 2, NULL, 'Order: Red Horse Beer x1, gin bulag x1, bulag x1', 'rejected', '2026-03-18 19:27:52', 'pending', NULL, NULL, NULL, 11, NULL),
(12, NULL, 11, 2, 38, NULL, NULL, NULL, '2026-03-29', '20:01:00', 2, NULL, 'Order: Red Horse Beer x1, gin bulag x1, bulag x1', 'rejected', '2026-03-18 20:01:24', 'pending', NULL, NULL, NULL, 12, NULL),
(13, NULL, 11, 2, 38, NULL, NULL, NULL, '2026-03-29', '04:11:00', 2, NULL, 'Order: Red Horse Beer x1, gin bulag x1, bulag x1', 'rejected', '2026-03-18 20:10:41', 'pending', NULL, NULL, NULL, 13, NULL),
(14, NULL, 11, 3, 38, NULL, NULL, NULL, '2026-03-24', '20:29:00', 2, NULL, 'Order: Red Horse Beer x2, gin bulag x5, bulag x1', 'rejected', '2026-03-19 13:29:33', 'pending', 'gcash', 446.00, 'RES-1773926973397-WKVXLU', 14, NULL),
(15, NULL, 11, 2, 38, NULL, NULL, NULL, '2026-03-23', '21:00:00', 2, NULL, 'Order: Red Horse Beer x1, gin bulag x1, bulag x1', 'rejected', '2026-03-19 14:15:34', 'pending', 'gcash', 567.00, 'RES-1773929734485-TXICIP', 15, NULL),
(16, NULL, 11, 4, 38, NULL, NULL, NULL, '2026-03-31', '20:00:00', 2, NULL, 'Order: Red Horse Beer x1, gin bulag x1, bulag x1', 'rejected', '2026-03-19 14:22:17', 'pending', 'gcash', 767.00, 'RES-1773930137971-IUP6BI', 16, NULL),
(17, NULL, 11, 2, 38, NULL, NULL, NULL, '2026-03-19', '23:00:00', 2, NULL, 'Order: gin bulag x1, Red Horse Beer x1, bulag x1', 'rejected', '2026-03-19 14:28:31', 'pending', 'gcash', 567.00, 'RES-1773930511884-FF0QH1', 17, NULL),
(18, NULL, 11, 2, 38, NULL, NULL, NULL, '2026-03-24', '20:00:00', 2, NULL, 'Order: bulag x1, gin bulag x1, Red Horse Beer x1', 'confirmed', '2026-03-19 14:31:44', 'paid', 'gcash', 567.00, 'RES-1773930704733-PQM6J6', 18, '2026-03-19 14:40:02'),
(19, NULL, 11, 4, 38, NULL, NULL, NULL, '2026-03-24', '20:00:00', 2, NULL, 'Order: bulag x1, gin bulag x1, Red Horse Beer x1', 'confirmed', '2026-03-19 14:57:47', 'paid', '', 767.00, 'RES-1773932267815-H8B7WI', 19, '2026-03-19 14:57:51'),
(20, NULL, 11, 3, 38, NULL, NULL, NULL, '2026-03-29', '23:00:00', 2, NULL, 'Order: Red Horse Beer x1, gin bulag x1, bulag x1', 'confirmed', '2026-03-19 16:21:10', 'paid', 'gcash', 167.00, 'RES-1773937270643-7K1YBY', 20, '2026-03-19 16:21:13'),
(21, NULL, 11, 2, 38, NULL, NULL, NULL, '2026-03-22', '19:00:00', 2, NULL, 'Order: bulag x9', 'confirmed', '2026-03-19 16:26:44', 'paid', 'gcash', 904.00, 'RES-1773937604170-EKAJEK', 21, '2026-03-19 16:43:21'),
(22, NULL, 11, 3, 38, NULL, NULL, NULL, '2026-03-31', '20:00:00', 2, NULL, 'Order: Red Horse Beer x2, gin bulag x2, bulag x1', 'confirmed', '2026-03-19 16:28:44', 'paid', 'gcash', 278.00, 'RES-1773937724091-9TARUG', 22, '2026-03-19 16:28:47'),
(23, NULL, 11, 2, 38, NULL, NULL, NULL, '2026-04-13', '19:00:00', 2, NULL, NULL, 'confirmed', '2026-03-19 16:45:44', 'paid', 'gcash', 400.00, 'RES-1773938744232-11BM2B', 23, '2026-03-19 16:45:48'),
(24, NULL, 11, 4, 38, NULL, NULL, NULL, '2026-04-29', '19:00:00', 2, NULL, NULL, 'confirmed', '2026-03-19 16:53:15', 'paid', 'gcash', 600.00, 'RES-1773939195378-6Y6VHV', 24, '2026-03-19 16:53:18'),
(25, NULL, 11, 4, 38, NULL, NULL, NULL, '2026-03-22', '19:00:00', 2, NULL, 'Order: Red Horse Beer x1, gin bulag x1, bulag x15', 'confirmed', '2026-03-19 17:49:12', 'paid', 'gcash', 1551.00, 'RES-1773942552442-AGJXVH', 25, '2026-03-19 17:49:16'),
(26, 'RES-20260320-TPPPYE', 11, 3, 38, NULL, NULL, NULL, '2026-03-22', '19:00:00', 2, NULL, 'Order: Red Horse Beer x1, gin bulag x1, bulag x15', 'confirmed', '2026-03-19 19:46:04', 'paid', 'gcash', 951.00, 'RES-1773949564646-FH5DSN', 26, '2026-03-19 19:46:10'),
(27, 'RES-20260322-BCL8Z5', 11, 1, 66, NULL, NULL, NULL, '2026-03-24', '20:00:00', 2, NULL, 'Order: gin bulag x1, bulag x1', 'confirmed', '2026-03-21 22:57:34', 'paid', 'gcash', 612.00, 'RES-1774133854163-MDP33W', 27, '2026-03-21 22:57:37'),
(28, 'RES-20260322-53GTLN', 11, 1, 66, NULL, NULL, NULL, '2026-03-24', '20:00:00', 2, NULL, 'Order: gin bulag x1, bulag x1 [auto-cancelled: duplicate slot]', 'cancelled', '2026-03-21 22:58:47', 'paid', 'gcash', 612.00, 'RES-1774133928202-JW0SKQ', 28, '2026-03-21 22:58:52'),
(29, 'RES-20260322-QJ3PPW', 11, 4, 66, NULL, NULL, NULL, '2026-03-24', '20:00:00', 2, NULL, 'Order: gin bulag x1, bulag x1 [auto-cancelled: duplicate slot]', 'cancelled', '2026-03-22 01:33:38', 'paid', 'gcash', 712.00, 'RES-1774143218843-8MY8BA', 29, '2026-03-22 01:33:42'),
(30, 'RES-20260322-YDQBEH', 11, 4, 66, NULL, NULL, NULL, '2026-03-24', '20:00:00', 2, NULL, 'Order: gin bulag x1, bulag x1 [auto-cancelled: duplicate slot]', 'cancelled', '2026-03-22 01:34:41', 'paid', 'gcash', 712.00, 'RES-1774143281556-R5V5QV', 30, '2026-03-22 01:34:45'),
(31, 'RES-20260322-6WUW54', 11, 1, 66, NULL, NULL, NULL, '2026-03-24', '20:00:00', 2, NULL, 'Order: gin bulag x1, bulag x1, Red Horse Beer x1', 'confirmed', '2026-03-22 14:15:18', 'paid', 'gcash', 667.00, 'RES-1774188918898-D7UTFS', 31, '2026-03-22 14:15:22'),
(32, 'RES-20260322-46NGE5', 11, 1, 66, NULL, NULL, NULL, '2026-03-24', '20:00:00', 2, NULL, 'Order: gin bulag x1, bulag x1', 'rejected', '2026-03-22 14:19:10', 'pending', 'gcash', 612.00, 'RES-1774189150636-72DK6U', 32, NULL),
(33, 'RES-20260322-QLHFWZ', 11, 1, 66, NULL, NULL, NULL, '2026-03-24', '20:00:00', 2, NULL, 'Order: gin bulag x1, bulag x1', 'approved', '2026-03-22 14:24:51', 'pending', 'gcash', 612.00, 'RES-1774189491045-OGDNF2', 33, NULL),
(34, 'RES-20260322-BQX7PE', 11, 1, 38, NULL, NULL, NULL, '2026-03-23', '19:00:00', 2, NULL, 'Order: gin bulag x1, bulag x1, Red Horse Beer x1', 'confirmed', '2026-03-22 14:26:43', 'paid', 'gcash', 667.00, 'RES-1774189603630-1A7M7B', 34, '2026-03-22 14:26:46'),
(35, 'RES-20260322-JE2UFQ', 11, 2, 38, NULL, NULL, NULL, '2026-03-23', '19:00:00', 2, NULL, 'Order: gin bulag x1, bulag x1, Red Horse Beer x1', 'confirmed', '2026-03-22 14:30:29', 'paid', 'gcash', 567.00, 'RES-1774189829150-8EKFR0', 35, '2026-03-22 14:30:32'),
(36, 'RES-20260322-6QSYP4', 11, 4, 38, NULL, NULL, NULL, '2026-03-23', '19:00:00', 5, NULL, 'Order: gin bulag x1, bulag x1, Red Horse Beer x1', 'confirmed', '2026-03-22 14:54:15', 'paid', 'gcash', 767.00, 'RES-1774191255698-3V5C4I', 36, '2026-03-22 14:54:19'),
(37, 'RES-20260322-2TL8K8', 11, 3, 38, NULL, NULL, NULL, '2026-03-23', '19:00:00', 5, NULL, 'Order: gin bulag x1, bulag x22', 'confirmed', '2026-03-22 15:52:40', 'paid', 'gcash', 1288.00, 'RES-1774194760713-78CL2L', 37, '2026-03-22 15:52:44'),
(38, 'RES-20260323-DS2WHD', 11, 4, 38, NULL, NULL, NULL, '2026-03-23', '20:00:00', 5, NULL, 'Order: gin bulag x1', 'confirmed', '2026-03-22 16:27:45', 'paid', 'gcash', 656.00, 'RES-1774196865064-D9SN3U', 38, '2026-03-22 16:27:49');

-- --------------------------------------------------------

--
-- Table structure for table `reservation_items`
--

CREATE TABLE `reservation_items` (
  `id` int(11) NOT NULL,
  `reservation_id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `menu_item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reservation_items`
--

INSERT INTO `reservation_items` (`id`, `reservation_id`, `bar_id`, `menu_item_id`, `quantity`, `unit_price`, `created_at`) VALUES
(1, 25, 11, 2, 1, 55.00, '2026-03-19 17:49:12'),
(2, 25, 11, 1, 1, 56.00, '2026-03-19 17:49:12'),
(3, 25, 11, 3, 15, 56.00, '2026-03-19 17:49:12'),
(4, 26, 11, 2, 1, 55.00, '2026-03-19 19:46:04'),
(5, 26, 11, 1, 1, 56.00, '2026-03-19 19:46:04'),
(6, 26, 11, 3, 15, 56.00, '2026-03-19 19:46:04'),
(7, 27, 11, 1, 1, 56.00, '2026-03-21 22:57:34'),
(8, 27, 11, 3, 1, 56.00, '2026-03-21 22:57:34'),
(9, 28, 11, 1, 1, 56.00, '2026-03-21 22:58:47'),
(10, 28, 11, 3, 1, 56.00, '2026-03-21 22:58:47'),
(11, 29, 11, 1, 1, 56.00, '2026-03-22 01:33:38'),
(12, 29, 11, 3, 1, 56.00, '2026-03-22 01:33:38'),
(13, 30, 11, 1, 1, 56.00, '2026-03-22 01:34:41'),
(14, 30, 11, 3, 1, 56.00, '2026-03-22 01:34:41'),
(15, 31, 11, 1, 1, 56.00, '2026-03-22 14:15:18'),
(16, 31, 11, 3, 1, 56.00, '2026-03-22 14:15:18'),
(17, 31, 11, 2, 1, 55.00, '2026-03-22 14:15:18'),
(18, 32, 11, 1, 1, 56.00, '2026-03-22 14:19:10'),
(19, 32, 11, 3, 1, 56.00, '2026-03-22 14:19:10'),
(20, 33, 11, 1, 1, 56.00, '2026-03-22 14:24:51'),
(21, 33, 11, 3, 1, 56.00, '2026-03-22 14:24:51'),
(22, 34, 11, 1, 1, 56.00, '2026-03-22 14:26:43'),
(23, 34, 11, 3, 1, 56.00, '2026-03-22 14:26:43'),
(24, 34, 11, 2, 1, 55.00, '2026-03-22 14:26:43'),
(25, 35, 11, 1, 1, 56.00, '2026-03-22 14:30:29'),
(26, 35, 11, 3, 1, 56.00, '2026-03-22 14:30:29'),
(27, 35, 11, 2, 1, 55.00, '2026-03-22 14:30:29'),
(28, 36, 11, 1, 1, 56.00, '2026-03-22 14:54:15'),
(29, 36, 11, 3, 1, 56.00, '2026-03-22 14:54:15'),
(30, 36, 11, 2, 1, 55.00, '2026-03-22 14:54:15'),
(31, 37, 11, 1, 1, 56.00, '2026-03-22 15:52:40'),
(32, 37, 11, 3, 22, 56.00, '2026-03-22 15:52:40'),
(33, 38, 11, 1, 1, 56.00, '2026-03-22 16:27:45');

-- --------------------------------------------------------

--
-- Table structure for table `reviews`
--

CREATE TABLE `reviews` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `rating` tinyint(3) UNSIGNED NOT NULL CHECK (`rating` >= 1 and `rating` <= 5),
  `comment` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `reviews`
--

INSERT INTO `reviews` (`id`, `bar_id`, `customer_id`, `rating`, `comment`, `created_at`, `updated_at`) VALUES
(1, 11, 38, 3, 'kaurat ang aasim ng mga tao', '2026-03-05 02:08:00', '2026-03-06 06:59:42');

-- --------------------------------------------------------

--
-- Table structure for table `review_responses`
--

CREATE TABLE `review_responses` (
  `id` int(11) NOT NULL,
  `review_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'bar owner / manager who responded',
  `response` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `review_responses`
--

INSERT INTO `review_responses` (`id`, `review_id`, `user_id`, `response`, `created_at`, `updated_at`) VALUES
(6, 1, 29, 'asdasdkjgndghn', '2026-03-17 18:21:40', '2026-03-22 00:02:20');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `description`, `created_at`) VALUES
(1, 'ADMIN', 'System administrator', '2026-02-12 06:37:17'),
(2, 'HR', 'Human resources staff', '2026-02-12 06:37:17'),
(3, 'EMPLOYEE', 'Basic staff. Personal data only.', '2026-02-12 06:37:17'),
(4, 'CUSTOMER', 'Customer user for public app.', '2026-02-12 06:37:17'),
(5, 'STAFF', 'General staff user', '2026-02-12 06:47:45'),
(6, 'SUPER_ADMIN', 'Platform-wide control (future).', '2026-02-12 06:57:37'),
(7, 'BAR_OWNER', 'Full control of their bar/branch. All modules.', '2026-02-12 06:57:37'),
(8, 'CASHIER', 'Cashier role under a bar', '2026-02-12 06:57:37'),
(9, 'MANAGER', 'Supervises staff. Team-level data depending on permissions.', '2026-03-08 19:10:16');

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `role_permissions`
--

INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(3, 1),
(3, 8),
(3, 11),
(3, 13),
(3, 14),
(3, 27),
(3, 29),
(3, 30),
(3, 31),
(3, 34),
(3, 37),
(3, 39),
(7, 1),
(7, 2),
(7, 3),
(7, 4),
(7, 5),
(7, 6),
(7, 7),
(7, 8),
(7, 9),
(7, 10),
(7, 11),
(7, 12),
(7, 13),
(7, 14),
(7, 15),
(7, 16),
(7, 17),
(7, 18),
(7, 19),
(7, 20),
(7, 21),
(7, 22),
(7, 23),
(7, 24),
(7, 25),
(7, 26),
(7, 27),
(7, 28),
(7, 29),
(7, 30),
(7, 31),
(7, 32),
(7, 33),
(7, 34),
(7, 35),
(7, 36),
(7, 37),
(7, 38),
(7, 39),
(7, 40),
(7, 41),
(7, 42),
(7, 43),
(7, 44),
(7, 45),
(7, 46),
(7, 47),
(7, 48),
(9, 1),
(9, 2),
(9, 3),
(9, 4),
(9, 6),
(9, 8),
(9, 9),
(9, 11),
(9, 12),
(9, 13),
(9, 14),
(9, 15),
(9, 16),
(9, 17),
(9, 18),
(9, 19),
(9, 20),
(9, 21),
(9, 22),
(9, 23),
(9, 25),
(9, 27),
(9, 28),
(9, 29),
(9, 30),
(9, 31),
(9, 32),
(9, 33),
(9, 34),
(9, 35),
(9, 36),
(9, 37),
(9, 38),
(9, 39),
(9, 40),
(9, 41),
(9, 42),
(9, 43),
(9, 44),
(9, 45),
(9, 46),
(9, 47),
(9, 48);

-- --------------------------------------------------------

--
-- Table structure for table `sales`
--

CREATE TABLE `sales` (
  `id` int(11) NOT NULL,
  `bar_id` int(11) NOT NULL,
  `item_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `sale_date` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sales`
--

INSERT INTO `sales` (`id`, `bar_id`, `item_id`, `quantity`, `total_amount`, `sale_date`) VALUES
(1, 11, 1, 5, 275.00, '2026-02-14 01:01:27'),
(2, 11, 2, 2, 110.00, '2026-02-14 01:35:37'),
(3, 11, 2, 10, 550.00, '2026-02-20 03:14:31'),
(4, 11, 2, 200, 11000.00, '2026-02-20 03:15:00'),
(5, 11, 4, 1, 56.00, '2026-02-26 00:14:40'),
(6, 11, 4, 2, 112.00, '2026-02-26 01:22:37'),
(7, 11, 3, 4, 224.00, '2026-02-26 01:22:48'),
(8, 11, 4, 1, 56.00, '2026-03-06 06:05:46'),
(9, 11, 3, 5, 280.00, '2026-03-06 06:05:46'),
(10, 11, 4, 1, 56.00, '2026-03-06 06:43:42'),
(11, 11, 3, 1, 56.00, '2026-03-06 06:44:29'),
(12, 11, 4, 1, 56.00, '2026-03-06 06:47:36'),
(13, 11, 4, 1, 56.00, '2026-03-06 07:09:51'),
(14, 11, 4, 2, 112.00, '2026-03-06 07:13:21'),
(15, 11, 3, 2, 112.00, '2026-03-06 07:13:21'),
(16, 11, 4, 1, 56.00, '2026-03-06 07:20:22'),
(17, 11, 4, 1, 56.00, '2026-03-06 07:21:39'),
(18, 11, 4, 1, 56.00, '2026-03-06 07:25:01'),
(19, 11, 4, 1, 56.00, '2026-03-06 07:27:13'),
(20, 11, 3, 1, 56.00, '2026-03-06 07:27:13'),
(21, 11, 4, 1, 56.00, '2026-03-06 07:30:38'),
(22, 11, 4, 1, 56.00, '2026-03-06 07:32:50'),
(23, 11, 4, 1, 56.00, '2026-03-06 07:41:07'),
(24, 11, 4, 1, 56.00, '2026-03-07 01:43:57'),
(25, 11, 3, 5, 280.00, '2026-03-07 01:44:45'),
(26, 11, 4, 1, 56.00, '2026-03-07 01:48:39'),
(27, 11, 3, 1, 56.00, '2026-03-07 02:44:52'),
(28, 11, 4, 1, 56.00, '2026-03-07 02:44:52'),
(29, 11, 3, 1, 56.00, '2026-03-07 03:09:03'),
(30, 11, 4, 8, 448.00, '2026-03-07 03:09:03'),
(31, 11, 4, 1, 56.00, '2026-03-07 03:09:22'),
(32, 11, 4, 1, 56.00, '2026-03-07 03:23:48'),
(33, 11, 3, 1, 56.00, '2026-03-07 03:23:48'),
(34, 11, 4, 1, 56.00, '2026-03-07 03:25:21'),
(35, 11, 3, 1, 56.00, '2026-03-07 03:25:21'),
(36, 11, 4, 1, 56.00, '2026-03-07 03:26:36'),
(37, 11, 4, 1, 56.00, '2026-03-13 06:53:50'),
(38, 11, 3, 3, 168.00, '2026-03-13 06:54:12'),
(39, 11, 4, 1, 56.00, '2026-03-14 04:22:27'),
(40, 11, 3, 1, 56.00, '2026-03-14 04:22:27'),
(41, 11, 2, 5, 275.00, '2026-03-14 04:22:27'),
(42, 11, 4, 4, 224.00, '2026-03-17 23:48:54'),
(43, 11, 2, 5, 275.00, '2026-03-17 23:48:54');

-- --------------------------------------------------------

--
-- Table structure for table `sss_contribution_table`
--

CREATE TABLE `sss_contribution_table` (
  `id` int(11) NOT NULL,
  `min_salary` decimal(10,2) NOT NULL COMMENT 'Minimum monthly salary for this bracket',
  `max_salary` decimal(10,2) DEFAULT NULL COMMENT 'Maximum monthly salary (NULL for highest bracket)',
  `employee_share` decimal(10,2) NOT NULL COMMENT 'Employee contribution amount',
  `employer_share` decimal(10,2) NOT NULL COMMENT 'Employer contribution amount',
  `total_contribution` decimal(10,2) NOT NULL COMMENT 'Total SSS contribution',
  `year` int(4) NOT NULL DEFAULT 2024,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='SSS contribution table based on monthly salary';

--
-- Dumping data for table `sss_contribution_table`
--

INSERT INTO `sss_contribution_table` (`id`, `min_salary`, `max_salary`, `employee_share`, `employer_share`, `total_contribution`, `year`, `is_active`) VALUES
(1, 0.00, 4249.99, 180.00, 380.00, 560.00, 2024, 1),
(2, 4250.00, 4749.99, 202.50, 427.50, 630.00, 2024, 1),
(3, 4750.00, 5249.99, 225.00, 475.00, 700.00, 2024, 1),
(4, 5250.00, 5749.99, 247.50, 522.50, 770.00, 2024, 1),
(5, 5750.00, 6249.99, 270.00, 570.00, 840.00, 2024, 1),
(6, 6250.00, 6749.99, 292.50, 617.50, 910.00, 2024, 1),
(7, 6750.00, 7249.99, 315.00, 665.00, 980.00, 2024, 1),
(8, 7250.00, 7749.99, 337.50, 712.50, 1050.00, 2024, 1),
(9, 7750.00, 8249.99, 360.00, 760.00, 1120.00, 2024, 1),
(10, 8250.00, 8749.99, 382.50, 807.50, 1190.00, 2024, 1),
(11, 8750.00, 9249.99, 405.00, 855.00, 1260.00, 2024, 1),
(12, 9250.00, 9749.99, 427.50, 902.50, 1330.00, 2024, 1),
(13, 9750.00, 10249.99, 450.00, 950.00, 1400.00, 2024, 1),
(14, 10250.00, 10749.99, 472.50, 997.50, 1470.00, 2024, 1),
(15, 10750.00, 11249.99, 495.00, 1045.00, 1540.00, 2024, 1),
(16, 11250.00, 11749.99, 517.50, 1092.50, 1610.00, 2024, 1),
(17, 11750.00, 12249.99, 540.00, 1140.00, 1680.00, 2024, 1),
(18, 12250.00, 12749.99, 562.50, 1187.50, 1750.00, 2024, 1),
(19, 12750.00, 13249.99, 585.00, 1235.00, 1820.00, 2024, 1),
(20, 13250.00, 13749.99, 607.50, 1282.50, 1890.00, 2024, 1),
(21, 13750.00, 14249.99, 630.00, 1330.00, 1960.00, 2024, 1),
(22, 14250.00, 14749.99, 652.50, 1377.50, 2030.00, 2024, 1),
(23, 14750.00, 15249.99, 675.00, 1425.00, 2100.00, 2024, 1),
(24, 15250.00, 15749.99, 697.50, 1472.50, 2170.00, 2024, 1),
(25, 15750.00, 16249.99, 720.00, 1520.00, 2240.00, 2024, 1),
(26, 16250.00, 16749.99, 742.50, 1567.50, 2310.00, 2024, 1),
(27, 16750.00, 17249.99, 765.00, 1615.00, 2380.00, 2024, 1),
(28, 17250.00, 17749.99, 787.50, 1662.50, 2450.00, 2024, 1),
(29, 17750.00, 18249.99, 810.00, 1710.00, 2520.00, 2024, 1),
(30, 18250.00, 18749.99, 832.50, 1757.50, 2590.00, 2024, 1),
(31, 18750.00, 19249.99, 855.00, 1805.00, 2660.00, 2024, 1),
(32, 19250.00, 19749.99, 877.50, 1852.50, 2730.00, 2024, 1),
(33, 19750.00, 29999.99, 900.00, 1900.00, 2800.00, 2024, 1),
(34, 30000.00, NULL, 1125.00, 2375.00, 3500.00, 2024, 1),
(35, 0.00, 4249.99, 180.00, 380.00, 560.00, 2024, 1),
(36, 4250.00, 4749.99, 202.50, 427.50, 630.00, 2024, 1),
(37, 4750.00, 5249.99, 225.00, 475.00, 700.00, 2024, 1),
(38, 5250.00, 5749.99, 247.50, 522.50, 770.00, 2024, 1),
(39, 5750.00, 6249.99, 270.00, 570.00, 840.00, 2024, 1),
(40, 6250.00, 6749.99, 292.50, 617.50, 910.00, 2024, 1),
(41, 6750.00, 7249.99, 315.00, 665.00, 980.00, 2024, 1),
(42, 7250.00, 7749.99, 337.50, 712.50, 1050.00, 2024, 1),
(43, 7750.00, 8249.99, 360.00, 760.00, 1120.00, 2024, 1),
(44, 8250.00, 8749.99, 382.50, 807.50, 1190.00, 2024, 1),
(45, 8750.00, 9249.99, 405.00, 855.00, 1260.00, 2024, 1),
(46, 9250.00, 9749.99, 427.50, 902.50, 1330.00, 2024, 1),
(47, 9750.00, 10249.99, 450.00, 950.00, 1400.00, 2024, 1),
(48, 10250.00, 10749.99, 472.50, 997.50, 1470.00, 2024, 1),
(49, 10750.00, 11249.99, 495.00, 1045.00, 1540.00, 2024, 1),
(50, 11250.00, 11749.99, 517.50, 1092.50, 1610.00, 2024, 1),
(51, 11750.00, 12249.99, 540.00, 1140.00, 1680.00, 2024, 1),
(52, 12250.00, 12749.99, 562.50, 1187.50, 1750.00, 2024, 1),
(53, 12750.00, 13249.99, 585.00, 1235.00, 1820.00, 2024, 1),
(54, 13250.00, 13749.99, 607.50, 1282.50, 1890.00, 2024, 1),
(55, 13750.00, 14249.99, 630.00, 1330.00, 1960.00, 2024, 1),
(56, 14250.00, 14749.99, 652.50, 1377.50, 2030.00, 2024, 1),
(57, 14750.00, 15249.99, 675.00, 1425.00, 2100.00, 2024, 1),
(58, 15250.00, 15749.99, 697.50, 1472.50, 2170.00, 2024, 1),
(59, 15750.00, 16249.99, 720.00, 1520.00, 2240.00, 2024, 1),
(60, 16250.00, 16749.99, 742.50, 1567.50, 2310.00, 2024, 1),
(61, 16750.00, 17249.99, 765.00, 1615.00, 2380.00, 2024, 1),
(62, 17250.00, 17749.99, 787.50, 1662.50, 2450.00, 2024, 1),
(63, 17750.00, 18249.99, 810.00, 1710.00, 2520.00, 2024, 1),
(64, 18250.00, 18749.99, 832.50, 1757.50, 2590.00, 2024, 1),
(65, 18750.00, 19249.99, 855.00, 1805.00, 2660.00, 2024, 1),
(66, 19250.00, 19749.99, 877.50, 1852.50, 2730.00, 2024, 1),
(67, 19750.00, 29999.99, 900.00, 1900.00, 2800.00, 2024, 1),
(68, 30000.00, NULL, 1125.00, 2375.00, 3500.00, 2024, 1);

-- --------------------------------------------------------

--
-- Table structure for table `subscriptions`
--

CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL,
  `bar_owner_id` int(11) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `status` enum('pending','active','cancelled','expired','past_due','rejected') NOT NULL DEFAULT 'pending',
  `starts_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL COMMENT 'gcash, maya, card, manual',
  `payment_reference` varchar(255) DEFAULT NULL,
  `paymongo_payment_id` varchar(255) DEFAULT NULL,
  `paymongo_source_id` varchar(255) DEFAULT NULL,
  `checkout_url` text DEFAULT NULL,
  `amount_paid` decimal(10,2) DEFAULT 0.00,
  `auto_renew` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `subscriptions`
--

INSERT INTO `subscriptions` (`id`, `bar_owner_id`, `plan_id`, `status`, `starts_at`, `expires_at`, `cancelled_at`, `payment_method`, `payment_reference`, `paymongo_payment_id`, `paymongo_source_id`, `checkout_url`, `amount_paid`, `auto_renew`, `created_at`, `updated_at`) VALUES
(1, 14, 2, 'cancelled', '2026-03-14 20:58:22', '2026-04-13 20:58:22', '2026-03-17 16:56:03', 'gcash', '54654464654', NULL, NULL, NULL, 499.00, 1, '2026-03-14 20:58:22', '2026-03-17 16:56:03'),
(2, 14, 3, 'cancelled', '2026-03-17 16:53:22', NULL, '2026-03-17 16:56:03', 'gcash', 'SUB-1773766401866-0H1XK6', NULL, 'src_12y27speAiy7gRN1dTRQ6xqD', 'https://secure-authentication.paymongo.com/sources?id=src_12y27speAiy7gRN1dTRQ6xqD', 1499.00, 1, '2026-03-17 16:53:22', '2026-03-17 16:56:03'),
(3, 14, 2, 'cancelled', '2026-03-17 16:56:12', NULL, '2026-03-17 16:56:49', 'gcash', 'SUB-1773766572555-97KSKM', NULL, 'src_48ih3wmz3kiLSnTj3QQiZHMG', 'https://secure-authentication.paymongo.com/sources?id=src_48ih3wmz3kiLSnTj3QQiZHMG', 499.00, 1, '2026-03-17 16:56:12', '2026-03-17 16:56:49'),
(4, 14, 2, 'cancelled', '2026-03-17 16:56:51', NULL, '2026-03-17 16:57:16', 'gcash', 'SUB-1773766611711-PDC65J', NULL, 'src_ufMRj2qkXJGQPMGrA1xCggFk', 'https://secure-authentication.paymongo.com/sources?id=src_ufMRj2qkXJGQPMGrA1xCggFk', 499.00, 1, '2026-03-17 16:56:51', '2026-03-17 16:57:16'),
(5, 14, 2, 'cancelled', '2026-03-17 17:04:05', NULL, '2026-03-17 17:09:57', 'gcash', 'SUB-1773767045672-EVBLWI', NULL, 'src_SXkM966ChsPHqA3HpWhMZ5Yj', 'https://secure-authentication.paymongo.com/sources?id=src_SXkM966ChsPHqA3HpWhMZ5Yj', 499.00, 1, '2026-03-17 17:04:05', '2026-03-17 17:09:57'),
(6, 14, 2, 'cancelled', '2026-03-17 17:10:05', '2026-04-16 17:10:05', '2026-03-17 17:10:33', 'paymaya', 'SUB-1773767401044-V0V5LM', NULL, 'src_txtrnEFHcGRVFZjBXfEZiwq5', 'https://secure-authentication.paymongo.com/sources?id=src_txtrnEFHcGRVFZjBXfEZiwq5', 499.00, 1, '2026-03-17 17:10:01', '2026-03-17 17:10:33'),
(7, 14, 2, 'cancelled', '2026-03-17 17:11:07', '2026-04-16 17:11:07', '2026-03-17 20:32:15', 'gcash', 'SUB-1773767463952-AS17TC', NULL, 'src_dWHqjF29qRATDGpUUYb4Rg6K', 'https://secure-authentication.paymongo.com/sources?id=src_dWHqjF29qRATDGpUUYb4Rg6K', 499.00, 1, '2026-03-17 17:11:04', '2026-03-17 20:32:15'),
(8, 14, 4, 'active', '2026-03-17 20:32:15', '2026-04-16 20:32:15', NULL, 'paymaya', 'SUB-1773779531620-G5L18U', NULL, 'src_H3Hig1tNwdEaBN1WTzv2XcqJ', 'https://secure-authentication.paymongo.com/sources?id=src_H3Hig1tNwdEaBN1WTzv2XcqJ', 4999.00, 1, '2026-03-17 20:32:11', '2026-03-17 20:32:15');

-- --------------------------------------------------------

--
-- Table structure for table `subscription_payments`
--

CREATE TABLE `subscription_payments` (
  `id` int(11) NOT NULL,
  `subscription_id` int(11) NOT NULL,
  `payment_transaction_id` int(11) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  `paymongo_payment_id` varchar(255) DEFAULT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `subscription_payments`
--

INSERT INTO `subscription_payments` (`id`, `subscription_id`, `payment_transaction_id`, `amount`, `status`, `paymongo_payment_id`, `paid_at`, `created_at`, `updated_at`) VALUES
(1, 2, 1, 1499.00, 'pending', 'src_12y27speAiy7gRN1dTRQ6xqD', NULL, '2026-03-17 16:53:23', '2026-03-17 16:53:23'),
(2, 3, 2, 499.00, 'pending', 'src_48ih3wmz3kiLSnTj3QQiZHMG', NULL, '2026-03-17 16:56:12', '2026-03-17 16:56:12'),
(3, 4, 3, 499.00, 'pending', 'src_ufMRj2qkXJGQPMGrA1xCggFk', NULL, '2026-03-17 16:56:51', '2026-03-17 16:56:51'),
(4, 5, 4, 499.00, 'pending', 'src_SXkM966ChsPHqA3HpWhMZ5Yj', NULL, '2026-03-17 17:04:05', '2026-03-17 17:04:05'),
(5, 6, 5, 499.00, 'paid', 'src_txtrnEFHcGRVFZjBXfEZiwq5', '2026-03-17 17:10:05', '2026-03-17 17:10:01', '2026-03-17 17:10:05'),
(6, 7, 6, 499.00, 'paid', 'src_dWHqjF29qRATDGpUUYb4Rg6K', '2026-03-17 17:11:07', '2026-03-17 17:11:04', '2026-03-17 17:11:07'),
(7, 8, 7, 4999.00, 'paid', 'src_H3Hig1tNwdEaBN1WTzv2XcqJ', '2026-03-17 20:32:15', '2026-03-17 20:32:11', '2026-03-17 20:32:15');

-- --------------------------------------------------------

--
-- Table structure for table `subscription_plans`
--

CREATE TABLE `subscription_plans` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL COMMENT 'free, basic, premium, enterprise',
  `display_name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `billing_period` enum('monthly','yearly','lifetime') DEFAULT 'monthly',
  `max_bars` int(11) NOT NULL DEFAULT 1 COMMENT 'max bars allowed under this plan',
  `max_events` int(11) DEFAULT NULL COMMENT 'NULL = unlimited',
  `max_promotions` int(11) DEFAULT NULL COMMENT 'NULL = unlimited',
  `features` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'JSON array of feature flags',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `subscription_plans`
--

INSERT INTO `subscription_plans` (`id`, `name`, `display_name`, `description`, `price`, `billing_period`, `max_bars`, `max_events`, `max_promotions`, `features`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
(1, 'free', 'Free', 'Basic listing with 1 bar', 0.00, 'monthly', 1, 2, 1, NULL, 1, 0, '2026-03-05 19:29:30', '2026-03-05 19:29:30'),
(2, 'basic', 'Basic', 'Up to 3 bars with more events and promotions', 499.00, 'monthly', 3, 10, 5, NULL, 1, 1, '2026-03-05 19:29:30', '2026-03-05 19:29:30'),
(3, 'premium', 'Premium', 'Up to 10 bars with unlimited events', 1499.00, 'monthly', 10, NULL, NULL, NULL, 1, 2, '2026-03-05 19:29:30', '2026-03-05 19:29:30'),
(4, 'enterprise', 'Enterprise', 'Unlimited bars and all features', 4999.00, 'monthly', 999, NULL, NULL, NULL, 1, 3, '2026-03-05 19:29:30', '2026-03-05 19:29:30');

-- --------------------------------------------------------

--
-- Table structure for table `suspicious_logins`
--

CREATE TABLE `suspicious_logins` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `email_attempt` varchar(120) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `reason` varchar(120) NOT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone_number` varchar(20) DEFAULT NULL,
  `phone_verified` tinyint(1) DEFAULT 0,
  `phone_verification_code` varchar(6) DEFAULT NULL,
  `phone_verification_expires` datetime DEFAULT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'customer',
  `role_id` int(11) DEFAULT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `newsletter` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1,
  `is_banned` tinyint(1) NOT NULL DEFAULT 0,
  `banned_at` datetime DEFAULT NULL,
  `banned_by` int(11) DEFAULT NULL,
  `ban_reason` varchar(500) DEFAULT NULL,
  `bar_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password`, `phone_number`, `phone_verified`, `phone_verification_code`, `phone_verification_expires`, `profile_picture`, `date_of_birth`, `role`, `role_id`, `is_verified`, `newsletter`, `created_at`, `updated_at`, `is_active`, `is_banned`, `banned_at`, `banned_by`, `ban_reason`, `bar_id`) VALUES
(1, 'Admin', 'User', 'admin@tpg.com', '$2b$10$Q7x08tM6t9Hf4.7LNUHu1e/SyYNPtMMIULcfIljCkEs1SyO/n89bq', '09123456789', 0, NULL, NULL, 'https://picsum.photos/seed/a68e0fab70bd78c7040345f53e8cb3fd/200/200.jpg', NULL, 'admin', 7, 0, 0, '2026-01-16 22:50:57', '2026-02-12 06:59:34', 1, 0, NULL, NULL, NULL, NULL),
(2, 'Bar', 'Owner', 'barowner@tpg.com', '$2y$10$zXGOoGaKYUfcKnJH07VECeCifyzUMH3WRP/S.Xu9rFweK5MQ77LYS', '09123456788', 0, NULL, NULL, 'https://picsum.photos/seed/e1e8b39fb2a73bd34ea73287a8e87381/200/200.jpg', NULL, 'bar_owner', 7, 0, 0, '2026-01-16 22:50:57', '2026-02-12 06:59:34', 1, 0, NULL, NULL, NULL, NULL),
(3, 'Regular', 'User', 'user@tpg.com', '$2y$10$l/gmVyWepCjbFwsy8yF77OB8Bef4dedN73z67R63xSqaoqL4Rqvu.', '09123456787', 0, NULL, NULL, 'https://picsum.photos/seed/da8fe352362d5709e448f2c57ac8552c/200/200.jpg', NULL, 'customer', 4, 0, 1, '2026-01-16 22:51:21', '2026-02-12 07:10:51', 1, 0, NULL, NULL, NULL, NULL),
(13, 'Super', 'Admin', 'superadmin@tpg.com', '$2y$10$0BLS5JXEjPnwkNMqj9ko3.lPRKA3m7PhChXBo.Vgq13Ycm59DaEra', NULL, 0, NULL, NULL, 'https://picsum.photos/seed/superadmin/200/200.jpg', NULL, 'admin', 7, 1, 0, '2026-01-23 20:49:11', '2026-02-12 06:59:34', 1, 0, NULL, NULL, NULL, NULL),
(14, 'Juan Dela Cruz', 'Owner', 'juan@tropicalbar.com', '$2y$10$qKvYoQCLmLbEq7zGjPmUNesm4D8TnHpiuXF6HoneV8sTgWyww1EeS', NULL, 0, NULL, NULL, NULL, NULL, 'bar_owner', 7, 0, 0, '2026-01-24 02:54:19', '2026-02-12 06:59:34', 1, 0, NULL, NULL, NULL, NULL),
(15, 'Maria Santos', 'Owner', 'maria@sunsetlounge.com', '$2y$10$tdnTxjN3ySGApp8U8NBzk.GWu1ntWUyb6snLoO8Hze7XehvThnQOG', NULL, 0, NULL, NULL, NULL, NULL, 'bar_owner', 7, 0, 0, '2026-01-24 02:54:20', '2026-02-12 06:59:34', 1, 0, NULL, NULL, NULL, NULL),
(16, 'Pedro Reyes', 'Owner', 'pedro@oceanview.com', '$2y$10$V.jeXy4GCRzxSdiT2JT9v.hkytsxCNdHS1uTDzFkzudwBuajmvuyy', NULL, 0, NULL, NULL, NULL, NULL, 'bar_owner', 7, 0, 0, '2026-01-24 02:54:20', '2026-02-12 06:59:34', 1, 0, NULL, NULL, NULL, NULL),
(19, 'Asley Kerby', 'Montejo', 'montejokerby30@gmail.com', '$2y$10$LJhh9HxEdptHphoY90qPB.OQq7urUi/RLBB9DISHL4cWhhpC9EUFu', '+639569370220', 0, NULL, NULL, 'https://picsum.photos/seed/712982771c4394a59461ad3a1158c581/200/200.jpg', '2005-05-30', 'bar_owner', 7, 1, 1, '2026-01-27 04:50:06', '2026-02-27 19:00:16', 1, 0, NULL, NULL, NULL, NULL),
(20, 'Asley Kerby', 'Montejo', 'montejo.asleykerby@ncst.edu.ph', '$2y$10$itoVDy7wZmmTQl.X8xV1A.kmg9wVa4IPpeekP8srh7Zoc/mKePRCi', '', 0, NULL, NULL, 'uploads/avatars/avatar_20_1769619891.jpg', '2005-05-30', 'customer', 4, 1, 0, '2026-01-27 14:50:25', '2026-02-12 07:10:51', 1, 0, NULL, NULL, NULL, NULL),
(21, 'Clarence', 'Gamilo', 'gamilocalrence4@gmail.com', '$2y$10$4YVUMJdzxLM4QFs5UcWh5..w6DHQpTp5cVAAb/3E5skAwgxPAAg/O', '', 0, NULL, NULL, 'https://picsum.photos/seed/a8708f3430e62aa8752090623fcd0390/200/200.jpg', '2004-05-27', 'customer', 4, 0, 1, '2026-01-27 17:11:03', '2026-02-12 07:10:51', 1, 0, NULL, NULL, NULL, NULL),
(22, 'Asley Kerby', 'Montejo', 'montejoasley13@gmail.com', '$2y$10$aEHNeIx2tnT2AGqYqb5jguLe9pyHf8msBZqh1QNCX2LHeJ680QnQC', '+639569370220', 0, NULL, NULL, 'https://lh3.googleusercontent.com/a/ACg8ocJgKmhR0zCjPAPMQt0EcgIDX7523Pu4KjWkbs3cxC8uUEyKZW7-=s96-c', '2005-05-30', 'bar_owner', 7, 1, 1, '2026-01-28 16:45:36', '2026-03-05 19:53:23', 1, 0, NULL, NULL, NULL, 10),
(23, 'Clarence', 'Test', 'clarence@test.com', '$2b$10$ERiRnqPU6ZSdAN0zkNcMROMn2lPPiRTyGU8UHvn3YnZMBiE/YQBAu', '09171234567', 0, NULL, NULL, NULL, NULL, 'customer', 4, 0, 0, '2026-02-05 17:04:04', '2026-03-18 16:38:14', 1, 0, NULL, NULL, NULL, NULL),
(29, 'Clarence', 'Gamilulu', 'juan.owner1234243@tpg.com', '$2b$10$rRGUhB/AdlV2YmzT3WxmouJM9kdbMVqzjgcobb8L.d2pXE64sFaAu', '09123456789', 0, NULL, NULL, 'uploads/profiles/user_29_1772047644149.jpg', '2004-12-30', 'bar_owner', 7, 0, 0, '2026-02-06 15:42:56', '2026-03-21 20:44:03', 1, 0, NULL, NULL, NULL, 11),
(34, 'Juan', 'Dela Cruz', 'juan.customer@gmail.com', '$2b$10$FAarXYtY6NpivcFTwyVDsuCdLPM84BeaDNrlf3ou9Dth8jWyfbd5y', '09123456789', 0, NULL, NULL, NULL, NULL, 'customer', 4, 0, 0, '2026-02-13 14:46:40', '2026-03-13 14:09:28', 1, 0, NULL, NULL, NULL, NULL),
(36, 'TPG', 'Super Admin', 'tpgsuperadmin@gmail.com', '$2b$10$hXDWEj3sWo.XRUMCm40aSeh.MX/wCNSk9a.gp/PjgnizNbOWOd9Yi', NULL, 0, NULL, NULL, NULL, NULL, 'super_admin', 6, 0, 0, '2026-02-27 18:28:09', '2026-02-27 18:28:09', 1, 0, NULL, NULL, NULL, NULL),
(37, 'ckarence', 'gamilo', 'clarencebossing@gmail.com', '$2b$10$TH6558gsW76YQEw/i3Wib.mmizQw/tasmmGWPSWN7l44fGA.DoRZO', '09123456789', 0, NULL, NULL, NULL, NULL, 'bar_owner', 7, 0, 0, '2026-02-27 20:39:29', '2026-02-27 20:42:32', 1, 0, NULL, NULL, NULL, 12),
(38, 'clarene', 'gamilooww', 'clarencecustomer@gmail.com', '$2b$10$1W3OrFNznv8RdMIzpPBoUuKOyf6YHoUIvU3snRzIXjmkAUlEhRU6i', NULL, 0, NULL, NULL, 'uploads/profiles/user_38_1772314478970.jpg', NULL, 'customer', 4, 0, 0, '2026-02-28 20:50:04', '2026-03-21 20:35:24', 1, 0, NULL, NULL, NULL, NULL),
(39, 'eduard', 'hernanddez', 'hernandez@gmail.com', '$2b$10$HJcLA9RZSprvvI0LL4npCuiG63rj/3NtfQOvbRdDwwKCzDsa1TwPW', '0912345678', 0, NULL, NULL, NULL, NULL, 'bar_owner', 7, 0, 0, '2026-02-28 20:53:13', '2026-02-28 20:53:13', 1, 0, NULL, NULL, NULL, 13),
(40, 'System', 'Administrator', 'superadmin@system.com', '$2b$10$YQ7x08tM6t9Hf4.7LNUHu1e/SyYNPtMMIULcfIljCkEs1SyO/n89bq', NULL, 0, NULL, NULL, NULL, NULL, 'super_admin', 6, 1, 0, '2026-03-06 17:59:28', '2026-03-06 17:59:28', 1, 0, NULL, NULL, NULL, NULL),
(59, 'asley kerby', 'montejo', 'asleykerby12@gmail.com', '$2b$10$7lUoKaa2QlbnZWX8UU.Rs.d3MQZ5fb0rOLdtUAB91RMKn7ccW./Rq', '09123456789', 0, NULL, NULL, NULL, NULL, 'employee', 3, 0, 0, '2026-03-08 20:04:10', '2026-03-21 21:32:38', 1, 0, NULL, NULL, NULL, 11),
(60, 'clarence', 'gamilo', 'clarence@gmail.com', '$2b$10$KjuaHyxiMvvPbTDkVYO6ReL3Y71ZVh6IXJOQyMt8PrGu6hCUy3yxa', '09123456789', 0, NULL, NULL, NULL, NULL, 'employee', 3, 0, 0, '2026-03-08 20:05:28', '2026-03-21 21:32:38', 1, 0, NULL, NULL, NULL, 11),
(61, 'TPG', 'Super Admin', 'tpgsuperadmin1@gmail.com', '$2b$10$FSIEA6Zl7ubnvKIXAfxX1OGIPJM4/oW5oDvsXUjBgbaj02FjOtYGG', NULL, 0, NULL, NULL, NULL, NULL, 'super_admin', 6, 0, 0, '2026-03-12 23:25:10', '2026-03-12 23:25:10', 1, 0, NULL, NULL, NULL, NULL),
(62, 'clarence', 'gamilow', 'juanstaff@tpg.com', '$2b$10$jHhQbjRjz8i5znoNKHEpI.86CYG2Ryc9DlYVEZuVEx2LYKmlN88..', '09123456789', 0, NULL, NULL, NULL, NULL, 'employee', 3, 0, 0, '2026-03-17 14:43:12', '2026-03-21 21:32:38', 1, 0, NULL, NULL, NULL, 14),
(63, 'asdww', 'gamilo', 'juan@tpg.com', '$2b$10$XaHy4Xza3NISqjUS8hs7FemAlBLJHVDOSjrQ7z8SSboLN8c/dtGDO', '09123456789', 0, NULL, NULL, NULL, NULL, 'employee', 3, 0, 0, '2026-03-17 15:12:31', '2026-03-21 21:32:38', 1, 0, NULL, NULL, NULL, 11),
(64, 'Platform', 'Administrator', 'superadmin@platform.com', '$2b$10$reHJ08341c400CtZtfaNl.RV0Bh/YPlrSI3U2.JdBN5sB/11aD9Mq', NULL, 0, NULL, NULL, NULL, NULL, 'super_admin', 6, 1, 0, '2026-03-17 21:27:05', '2026-03-17 21:27:05', 1, 0, NULL, NULL, NULL, NULL),
(65, 'clarence', 'pogi', 'clarencecustomerr@gmail.com', '$2b$10$JnZLsyKAz8fHFRtrqZcIc.BXFPxx5RSCwv5yEv7BjgN0Od/u5XJDq', '', 0, NULL, NULL, NULL, NULL, 'customer', 4, 0, 0, '2026-03-18 17:53:46', '2026-03-21 20:35:24', 1, 0, NULL, NULL, NULL, NULL),
(66, 'asd', 'asd', 'clarence12@gmail.com', '$2b$10$Q.7qrSi80ptKs5zwaLWkH.zVkhlLdEWWHAlgHai3v13DJSldvkTcW', NULL, 0, NULL, NULL, 'uploads/profiles/user_66_1773859890276.jpg', NULL, 'customer', 4, 0, 0, '2026-03-18 17:56:03', '2026-03-21 20:35:24', 1, 0, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_permissions`
--

CREATE TABLE `user_permissions` (
  `user_id` int(11) NOT NULL,
  `permission_id` int(11) NOT NULL,
  `granted` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1 = granted, 0 = explicitly revoked',
  `granted_by` int(11) DEFAULT NULL COMMENT 'user_id of who assigned this',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_permissions`
--

INSERT INTO `user_permissions` (`user_id`, `permission_id`, `granted`, `granted_by`, `created_at`) VALUES
(59, 20, 1, 29, '2026-03-21 22:37:25'),
(59, 21, 1, 29, '2026-03-21 22:37:25'),
(59, 22, 1, 29, '2026-03-21 22:37:25'),
(59, 23, 1, 29, '2026-03-21 22:37:25'),
(59, 24, 1, 29, '2026-03-21 22:37:25'),
(59, 25, 1, 29, '2026-03-21 22:37:25'),
(59, 26, 1, 29, '2026-03-21 22:37:25'),
(59, 27, 1, 29, '2026-03-21 22:37:25'),
(59, 28, 1, 29, '2026-03-21 22:37:25'),
(59, 29, 1, 29, '2026-03-21 22:37:25'),
(59, 30, 1, 29, '2026-03-21 22:37:25'),
(59, 31, 1, 29, '2026-03-21 22:37:25'),
(59, 32, 1, 29, '2026-03-21 22:37:25'),
(59, 33, 1, 29, '2026-03-21 22:37:25'),
(59, 34, 1, 29, '2026-03-21 22:37:25'),
(59, 35, 1, 29, '2026-03-21 22:37:25'),
(59, 36, 1, 29, '2026-03-21 22:37:25'),
(59, 37, 1, 29, '2026-03-21 22:37:25'),
(59, 38, 1, 29, '2026-03-21 22:37:25'),
(59, 39, 1, 29, '2026-03-21 22:37:25'),
(59, 40, 1, 29, '2026-03-21 22:37:25');

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

CREATE TABLE `user_roles` (
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES
(1, 7),
(2, 7),
(3, 4),
(13, 7),
(14, 7),
(15, 7),
(16, 7),
(19, 7),
(20, 4),
(21, 4),
(22, 7),
(23, 4),
(29, 7),
(34, 4),
(36, 6),
(37, 7),
(38, 4),
(39, 7),
(40, 6),
(59, 3),
(59, 5),
(60, 2),
(60, 3),
(61, 6),
(62, 3),
(62, 5),
(63, 3),
(63, 5),
(64, 6),
(65, 4),
(66, 4);

-- --------------------------------------------------------

--
-- Table structure for table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user_sessions`
--

INSERT INTO `user_sessions` (`id`, `user_id`, `session_token`, `ip_address`, `user_agent`, `created_at`, `expires_at`, `is_active`) VALUES
(41, 13, '26e6a1f4197ed4e46368512e42b0738aaad61304201705e6dbf4aadfe36b9797', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-23 20:49:32', '2026-01-24 21:49:32', 1),
(42, 13, 'ac11f8fc9412a05f1569795161cec172a8b7a08aa98d71684525ebf0d5cc64a9', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-23 20:50:52', '2026-01-24 21:50:52', 1),
(44, 19, '91e37ba9b83dcc33f7c83e3e159850e348439c45748ac442a40ccd5f36f66971', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 04:53:33', '2026-01-28 05:53:33', 1),
(45, 19, '16deb550b9a793d72adb58a3f8a29398e191f6276f56a2b4a03e8cdcfea5d759', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 04:53:34', '2026-01-28 05:53:34', 1),
(46, 19, '28e3acec452234e76176a677e040c7f71223576c61bee9675a548f280306b379', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 04:53:35', '2026-01-28 05:53:35', 1),
(47, 19, '5e8f49982b82d7e780284234c4498fbe9efb288468d1e707cc748c0ac62a056d', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 04:53:36', '2026-01-28 05:53:36', 1),
(48, 19, 'e9a4f1d3a4a47d88052c569971f53f048951bf1576469ed171aae17329616096', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 04:53:38', '2026-01-28 05:53:38', 1),
(49, 19, '2544dcf3a3a2d60faa1d9de7909f4e3036a8a70f2e15fe1381d16a699c0dc6a0', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 05:02:42', '2026-01-28 06:02:42', 1),
(50, 19, '2bffaf37b0849c1180988c9cc43515409bf9c7fb8f19587c78dc2eb6abdc9333', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 05:02:45', '2026-01-28 06:02:45', 1),
(51, 19, '115a1a5d6d43f4763050263e0d6224f69fcd0e464ddc2e7701722deacac306c3', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 05:03:07', '2026-01-28 06:03:07', 1),
(52, 19, '26ea9fd627675ee0df7143f5f2383f61c50c6ee638a371c050f2ead3abcf4dd2', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 05:03:36', '2026-01-28 06:03:36', 1),
(53, 19, '42d7a49008d10e89d75b52cc69fbec437f0056b5fe49bba98da687d1a69e6248', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 05:05:35', '2026-01-28 06:05:35', 1),
(54, 19, '3620ab98fbfd397e1d970fab38e4bb35a78ba0893dd721a70dec247479b435a4', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 05:06:22', '2026-01-28 06:06:22', 1),
(55, 19, 'a8418c8fe985b4c36b6630d8cdc6b1837f545e4b62617c7bd2f2c026a186befd', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 05:07:44', '2026-01-28 06:07:44', 1),
(56, 19, '561c52276f99e92fcaa6666c5e10b905c602bd9e33f447b13c5b849d885f0745', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 05:09:48', '2026-01-28 06:09:48', 1),
(57, 19, '6ad1c8806415bd5a6cdec9409dec6d5acf9007dde6580150a1be4848133ba65d', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36', '2026-01-27 14:48:10', '2026-01-28 15:48:10', 1),
(58, 20, 'a1e091a2b2859d575bd1bc5f68582212f29f1a3cfc3f8c26ae4752d4ef3a3bf9', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0', '2026-01-27 14:50:25', '2026-01-28 15:50:25', 1),
(59, 21, 'f8f8de4724cb4c75c68bb46dde51961d0883c815d6a9dcae13e77d2f8a3877ff', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-27 17:11:20', '2026-01-28 18:11:20', 1),
(60, 21, '9f955ca21c95e4e5e04d709f53f52c224d6fdb3c4b4e0271f61eb7c2fbc0408f', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-27 17:18:29', '2026-01-28 18:18:29', 1),
(61, 19, 'f6948833a6d784ad55fdeed0dc43674226a2c51bb60c2047684db6dc47b6847d', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-27 17:27:38', '2026-01-28 18:27:38', 1),
(62, 19, 'd7f639e26e0405ba1cd0519945322da82ed3f8dbff0207aaaa14164a2ff931d4', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-27 17:40:28', '2026-01-28 18:40:28', 1),
(63, 20, '1a41213b3544b04de084a20ad61deb3e3fccab510bd029348f05728f917b68c4', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-28 15:52:25', '2026-01-29 16:52:25', 1),
(64, 20, 'd07f523e1dac44b4570acaf6aadee5c612e8aaa3a60e7fff2b35451b8b77b2bd', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-28 16:45:24', '2026-01-29 17:45:24', 1),
(65, 22, '2f02bc502d929e9b5f5ceda4254eefd0e4f97dc71a314730097d5bd50a3b7348', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-28 16:45:36', '2026-01-29 17:45:36', 1),
(66, 20, '599a1b96a4317a7615e99d33f8bd057d8e39d85786c840f010bc5795024c8360', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-28 16:47:22', '2026-01-29 17:47:22', 1),
(67, 20, '9bb69ae1841850d25dde64999e557e652397c48a5a876a8d81b57248d8c05c35', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-28 17:00:06', '2026-01-29 18:00:06', 1),
(68, 20, '7642f7b4546a011c7de66a8bc408832c7b757a7c531450eb8e31ee9d4d6a9aac', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-28 17:01:15', '2026-01-29 18:01:15', 1),
(69, 20, 'c27caccb98b760f0fdeb984634cd010bd40ce627cd9f99649c503ee1ed81d09c', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-28 17:05:21', '2026-01-29 18:05:21', 1),
(70, 20, '5779631325cb6244f262c00eaa64eea93ee1af74cc23f331b91ee2aaa48cb2eb', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-28 17:08:35', '2026-01-29 18:08:35', 1),
(72, 20, 'cfe4ed1026845965ce272751420dacdd30cbefef02c09e25bd1423aaf6eecb22', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-01-28 17:15:35', '2026-01-29 18:15:35', 1),
(80, 20, '0eece11cfc3960aecfeba32f50398818e873c99214b63202bb2e4b20c5b3507b', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0', '2026-02-01 19:59:00', '2026-02-02 20:59:00', 1),
(81, 19, '0b7b43990f382c0c798e8bdf0911d36b336617d18a22ad4e08f16c97b1578b91', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '2026-02-04 16:52:37', '2026-03-06 17:52:37', 1);

-- --------------------------------------------------------

--
-- Table structure for table `webhook_events`
--

CREATE TABLE `webhook_events` (
  `id` int(11) NOT NULL,
  `event_id` varchar(255) NOT NULL COMMENT 'PayMongo event ID',
  `event_type` varchar(100) NOT NULL COMMENT 'payment.paid, payment.failed, etc',
  `resource_type` varchar(50) NOT NULL,
  `resource_id` varchar(255) NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`payload`)),
  `processed` tinyint(1) NOT NULL DEFAULT 0,
  `processed_at` timestamp NULL DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure for view `menu_best_sellers`
--
DROP TABLE IF EXISTS `menu_best_sellers`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `menu_best_sellers`  AS SELECT `m`.`id` AS `menu_item_id`, `m`.`bar_id` AS `bar_id`, `m`.`menu_name` AS `menu_name`, `m`.`category` AS `category`, `m`.`selling_price` AS `selling_price`, count(`pli`.`id`) AS `total_orders`, sum(`pli`.`quantity`) AS `total_quantity_sold`, sum(`pli`.`line_total`) AS `total_revenue`, rank() over ( partition by `m`.`bar_id` order by sum(`pli`.`quantity`) desc) AS `sales_rank` FROM (`menu_items` `m` left join `payment_line_items` `pli` on(`pli`.`item_type` = 'menu' and lcase(`pli`.`item_name`) = lcase(`m`.`menu_name`) and `pli`.`metadata` like concat('%"bar_id":',`m`.`bar_id`,'%'))) WHERE `m`.`is_available` = 1 GROUP BY `m`.`id`, `m`.`bar_id`, `m`.`menu_name`, `m`.`category`, `m`.`selling_price` HAVING `total_orders` > 0 ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ai_verifications`
--
ALTER TABLE `ai_verifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`verification_status`),
  ADD KEY `idx_auto_approved` (`auto_approved`);

--
-- Indexes for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_emp_date` (`employee_user_id`,`work_date`),
  ADD KEY `idx_bar_date` (`bar_id`,`work_date`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bar_created` (`bar_id`,`created_at`),
  ADD KEY `idx_entity` (`entity`,`entity_id`),
  ADD KEY `idx_user_created` (`user_id`,`created_at`);

--
-- Indexes for table `bars`
--
ALTER TABLE `bars`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_bars_owner_id` (`owner_id`),
  ADD KEY `idx_bars_lifecycle_status` (`lifecycle_status`),
  ADD KEY `idx_bars_lat_lng` (`latitude`,`longitude`),
  ADD KEY `idx_bars_parent_bar_id` (`parent_bar_id`);

--
-- Indexes for table `bar_amenities`
--
ALTER TABLE `bar_amenities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_bar_amenity` (`bar_id`,`amenity`);

--
-- Indexes for table `bar_comment_reactions`
--
ALTER TABLE `bar_comment_reactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_comment_reaction` (`comment_id`,`user_id`,`reaction`),
  ADD KEY `idx_comment_reactions_comment` (`comment_id`),
  ADD KEY `idx_comment_reactions_user` (`user_id`);

--
-- Indexes for table `bar_comment_replies`
--
ALTER TABLE `bar_comment_replies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_comment_replies_comment` (`comment_id`),
  ADD KEY `idx_comment_replies_user` (`user_id`),
  ADD KEY `idx_comment_replies_parent` (`parent_reply_id`);

--
-- Indexes for table `bar_events`
--
ALTER TABLE `bar_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bar_id` (`bar_id`),
  ADD KEY `idx_bar_events_bar_date` (`bar_id`,`event_date`),
  ADD KEY `idx_bar_events_bar_archived` (`bar_id`,`archived_at`),
  ADD KEY `idx_bar_events_archived_at` (`archived_at`);

--
-- Indexes for table `bar_events_archive`
--
ALTER TABLE `bar_events_archive`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bar_events_archive_bar_archived` (`bar_id`,`archived_at`),
  ADD KEY `idx_bar_events_archive_original_event` (`original_event_id`),
  ADD KEY `idx_bar_events_archive_archived_by` (`archived_by_user_id`);

--
-- Indexes for table `bar_followers`
--
ALTER TABLE `bar_followers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_bar_user` (`bar_id`,`user_id`),
  ADD KEY `idx_user` (`user_id`);

--
-- Indexes for table `bar_owners`
--
ALTER TABLE `bar_owners`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `bar_posts`
--
ALTER TABLE `bar_posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bp_bar` (`bar_id`),
  ADD KEY `fk_bp_user` (`user_id`);

--
-- Indexes for table `bar_post_comments`
--
ALTER TABLE `bar_post_comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_post_comments_post` (`post_id`),
  ADD KEY `idx_post_comments_user` (`user_id`),
  ADD KEY `idx_post_comments_parent` (`parent_comment_id`),
  ADD KEY `idx_post_comments_status` (`status`);

--
-- Indexes for table `bar_post_likes`
--
ALTER TABLE `bar_post_likes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_post_like` (`post_id`,`user_id`),
  ADD KEY `idx_post_likes_post` (`post_id`),
  ADD KEY `idx_post_likes_user` (`user_id`);

--
-- Indexes for table `bar_reply_reactions`
--
ALTER TABLE `bar_reply_reactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_reply_reaction` (`reply_id`,`user_id`),
  ADD KEY `idx_reply_reactions_reply` (`reply_id`),
  ADD KEY `idx_reply_reactions_user` (`user_id`);

--
-- Indexes for table `bar_reviews`
--
ALTER TABLE `bar_reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bar_id` (`bar_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `bar_tables`
--
ALTER TABLE `bar_tables`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bar_tables_bar_id` (`bar_id`);

--
-- Indexes for table `bar_visits`
--
ALTER TABLE `bar_visits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `bar_id` (`bar_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `bir_tax_brackets`
--
ALTER TABLE `bir_tax_brackets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_year_active` (`year`,`is_active`);

--
-- Indexes for table `business_registrations`
--
ALTER TABLE `business_registrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_owner_email` (`owner_email`),
  ADD KEY `idx_br_status` (`status`),
  ADD KEY `idx_br_created` (`created_at`);

--
-- Indexes for table `comment_reactions`
--
ALTER TABLE `comment_reactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_comment_user` (`comment_id`,`user_id`),
  ADD KEY `fk_cre_user` (`user_id`);

--
-- Indexes for table `comment_replies`
--
ALTER TABLE `comment_replies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_cr_comment` (`comment_id`),
  ADD KEY `fk_cr_user` (`user_id`);

--
-- Indexes for table `customer_bar_bans`
--
ALTER TABLE `customer_bar_bans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_customer_bar_bans_bar_customer` (`bar_id`,`customer_id`),
  ADD KEY `idx_customer_bar_bans_customer` (`customer_id`);

--
-- Indexes for table `documents`
--
ALTER TABLE `documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_docs_bar_employee` (`bar_id`,`employee_user_id`),
  ADD KEY `idx_docs_bar_type` (`bar_id`,`doc_type`),
  ADD KEY `idx_docs_bar_active` (`bar_id`,`is_active`);

--
-- Indexes for table `document_recipients`
--
ALTER TABLE `document_recipients`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_doc_recipient` (`document_id`,`recipient_user_id`),
  ADD KEY `idx_recipient_user` (`recipient_user_id`),
  ADD KEY `idx_doc_sent` (`document_id`,`sent_at`);

--
-- Indexes for table `email_verifications`
--
ALTER TABLE `email_verifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `email` (`email`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `employee_deduction_settings`
--
ALTER TABLE `employee_deduction_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_employee_deduction` (`bar_id`,`user_id`),
  ADD KEY `idx_bar_user` (`bar_id`,`user_id`);

--
-- Indexes for table `employee_documents`
--
ALTER TABLE `employee_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bar_employee` (`bar_id`,`employee_user_id`),
  ADD KEY `fk_docs_employee` (`employee_user_id`),
  ADD KEY `fk_docs_uploader` (`uploaded_by`);

--
-- Indexes for table `employee_profiles`
--
ALTER TABLE `employee_profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_user_profile` (`user_id`),
  ADD KEY `idx_bar_id` (`bar_id`);

--
-- Indexes for table `event_comments`
--
ALTER TABLE `event_comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_event_comments_event_status` (`event_id`,`status`),
  ADD KEY `idx_event_comments_user` (`user_id`);

--
-- Indexes for table `event_comment_replies`
--
ALTER TABLE `event_comment_replies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_event_comment_replies_comment_status` (`event_comment_id`,`status`),
  ADD KEY `idx_event_comment_replies_event_status` (`event_id`,`status`),
  ADD KEY `idx_event_comment_replies_user` (`user_id`);

--
-- Indexes for table `event_likes`
--
ALTER TABLE `event_likes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_event_likes_event_user` (`event_id`,`user_id`),
  ADD KEY `idx_event_likes_user` (`user_id`);

--
-- Indexes for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inv_bar` (`bar_id`);

--
-- Indexes for table `leave_balances`
--
ALTER TABLE `leave_balances`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_balance` (`bar_id`,`employee_user_id`,`leave_type_id`,`year`),
  ADD KEY `idx_balance_employee` (`bar_id`,`employee_user_id`,`year`),
  ADD KEY `fk_balance_leave_type` (`leave_type_id`);

--
-- Indexes for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bar_status` (`bar_id`,`status`),
  ADD KEY `idx_employee` (`employee_user_id`),
  ADD KEY `fk_leave_decider` (`decided_by`),
  ADD KEY `idx_lr_bar_employee_user` (`bar_id`,`employee_user_id`),
  ADD KEY `idx_lr_bar_status` (`bar_id`,`status`),
  ADD KEY `fk_leave_requests_leave_type` (`leave_type_id`);

--
-- Indexes for table `leave_types`
--
ALTER TABLE `leave_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_leave_type_bar_code` (`bar_id`,`code`),
  ADD KEY `idx_leave_types_bar` (`bar_id`);

--
-- Indexes for table `menu_items`
--
ALTER TABLE `menu_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_bar_inventory` (`bar_id`,`inventory_item_id`),
  ADD KEY `idx_menu_bar` (`bar_id`,`is_available`),
  ADD KEY `idx_menu_inventory` (`inventory_item_id`),
  ADD KEY `idx_menu_best_seller` (`is_best_seller`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notif_user` (`user_id`,`is_read`);

--
-- Indexes for table `payment_line_items`
--
ALTER TABLE `payment_line_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payment_line_items_payment` (`payment_transaction_id`);

--
-- Indexes for table `payment_transactions`
--
ALTER TABLE `payment_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_payment_reference` (`reference_id`),
  ADD KEY `idx_payment_type_related` (`payment_type`,`related_id`),
  ADD KEY `idx_payment_user` (`user_id`),
  ADD KEY `idx_payment_status` (`status`),
  ADD KEY `idx_paymongo_intent` (`paymongo_payment_intent_id`),
  ADD KEY `idx_paymongo_source` (`paymongo_source_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_paid_at` (`paid_at`);

--
-- Indexes for table `payouts`
--
ALTER TABLE `payouts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payout_bar` (`bar_id`),
  ADD KEY `idx_payout_transaction` (`payment_transaction_id`),
  ADD KEY `idx_payout_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_processed_at` (`processed_at`),
  ADD KEY `idx_payouts_bar_owner` (`bar_owner_id`);

--
-- Indexes for table `payroll_deduction_audit`
--
ALTER TABLE `payroll_deduction_audit`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bar_user` (`bar_id`,`user_id`),
  ADD KEY `idx_changed_by` (`changed_by`);

--
-- Indexes for table `payroll_deduction_items`
--
ALTER TABLE `payroll_deduction_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payroll_item` (`payroll_item_id`),
  ADD KEY `idx_deduction_type` (`deduction_type`);

--
-- Indexes for table `payroll_items`
--
ALTER TABLE `payroll_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_item` (`payroll_run_id`,`user_id`),
  ADD KEY `idx_items_run` (`payroll_run_id`);

--
-- Indexes for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_payroll_period` (`bar_id`,`period_start`,`period_end`),
  ADD KEY `idx_payroll_bar_status` (`bar_id`,`status`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_permission_name` (`name`);

--
-- Indexes for table `philhealth_contribution_table`
--
ALTER TABLE `philhealth_contribution_table`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_year_active` (`year`,`is_active`);

--
-- Indexes for table `platform_announcements`
--
ALTER TABLE `platform_announcements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pa_active` (`is_active`),
  ADD KEY `idx_pa_window` (`starts_at`,`ends_at`),
  ADD KEY `fk_pa_created_by` (`created_by`);

--
-- Indexes for table `platform_audit_logs`
--
ALTER TABLE `platform_audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pal_actor` (`actor_user_id`),
  ADD KEY `idx_pal_target_bar` (`target_bar_id`),
  ADD KEY `idx_pal_action` (`action`),
  ADD KEY `idx_pal_created_at` (`created_at`);

--
-- Indexes for table `platform_feedback`
--
ALTER TABLE `platform_feedback`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_platform_feedback_user` (`user_id`),
  ADD KEY `idx_platform_feedback_status` (`status`),
  ADD KEY `idx_platform_feedback_created` (`created_at`);

--
-- Indexes for table `platform_settings`
--
ALTER TABLE `platform_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_setting_key` (`setting_key`);

--
-- Indexes for table `post_comments`
--
ALTER TABLE `post_comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pc_post` (`post_id`),
  ADD KEY `fk_pc_user` (`user_id`);

--
-- Indexes for table `post_likes`
--
ALTER TABLE `post_likes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_post_user` (`post_id`,`user_id`),
  ADD KEY `fk_pl_user` (`user_id`);

--
-- Indexes for table `pos_orders`
--
ALTER TABLE `pos_orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `table_id` (`table_id`),
  ADD KEY `staff_user_id` (`staff_user_id`),
  ADD KEY `idx_pos_orders_bar_date` (`bar_id`,`created_at`),
  ADD KEY `idx_pos_orders_status` (`bar_id`,`status`),
  ADD KEY `idx_pos_payment_transaction` (`payment_transaction_id`),
  ADD KEY `idx_pos_orders_payment_tx` (`payment_transaction_id`),
  ADD KEY `idx_pos_orders_payment_status` (`payment_status`);

--
-- Indexes for table `pos_order_items`
--
ALTER TABLE `pos_order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `menu_item_id` (`menu_item_id`),
  ADD KEY `inventory_item_id` (`inventory_item_id`);

--
-- Indexes for table `promotions`
--
ALTER TABLE `promotions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_promo_bar` (`bar_id`);

--
-- Indexes for table `reply_reactions`
--
ALTER TABLE `reply_reactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_reply_user` (`reply_id`,`user_id`),
  ADD KEY `fk_rre_user` (`user_id`);

--
-- Indexes for table `reservations`
--
ALTER TABLE `reservations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_reservation_txn` (`transaction_number`),
  ADD KEY `idx_res_bar_id` (`bar_id`),
  ADD KEY `idx_res_table_dt` (`table_id`,`reservation_date`,`reservation_time`),
  ADD KEY `idx_res_customer` (`customer_user_id`),
  ADD KEY `idx_reservations_payment_status` (`payment_status`),
  ADD KEY `idx_reservations_payment_method` (`payment_method`),
  ADD KEY `idx_reservations_bar_payment` (`bar_id`,`payment_status`),
  ADD KEY `idx_reservations_payment_tx` (`payment_transaction_id`),
  ADD KEY `idx_reservation_slot` (`table_id`,`reservation_date`,`reservation_time`,`status`);

--
-- Indexes for table `reservation_items`
--
ALTER TABLE `reservation_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ri_reservation` (`reservation_id`),
  ADD KEY `idx_ri_menu_item` (`menu_item_id`),
  ADD KEY `idx_ri_bar` (`bar_id`);

--
-- Indexes for table `reviews`
--
ALTER TABLE `reviews`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_customer_bar` (`customer_id`,`bar_id`),
  ADD KEY `idx_reviews_bar` (`bar_id`),
  ADD KEY `idx_reviews_customer` (`customer_id`),
  ADD KEY `idx_reviews_rating` (`bar_id`,`rating`);

--
-- Indexes for table `review_responses`
--
ALTER TABLE `review_responses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_rr_review` (`review_id`),
  ADD KEY `fk_rr_user` (`user_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`role_id`,`permission_id`),
  ADD KEY `fk_rp_perm` (`permission_id`);

--
-- Indexes for table `sales`
--
ALTER TABLE `sales`
  ADD PRIMARY KEY (`id`),
  ADD KEY `item_id` (`item_id`);

--
-- Indexes for table `sss_contribution_table`
--
ALTER TABLE `sss_contribution_table`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_year_active` (`year`,`is_active`);

--
-- Indexes for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sub_owner` (`bar_owner_id`),
  ADD KEY `idx_sub_plan` (`plan_id`);

--
-- Indexes for table `subscription_payments`
--
ALTER TABLE `subscription_payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_subpay_subscription` (`subscription_id`),
  ADD KEY `idx_subpay_transaction` (`payment_transaction_id`);

--
-- Indexes for table `subscription_plans`
--
ALTER TABLE `subscription_plans`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_plan_name` (`name`);

--
-- Indexes for table `suspicious_logins`
--
ALTER TABLE `suspicious_logins`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sl_user` (`user_id`),
  ADD KEY `idx_sl_created_at` (`created_at`),
  ADD KEY `idx_sl_reason` (`reason`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_bar_id` (`bar_id`),
  ADD KEY `fk_users_role_id` (`role_id`),
  ADD KEY `idx_users_is_banned` (`is_banned`),
  ADD KEY `idx_users_banned_by` (`banned_by`);

--
-- Indexes for table `user_permissions`
--
ALTER TABLE `user_permissions`
  ADD PRIMARY KEY (`user_id`,`permission_id`),
  ADD KEY `fk_up_perm` (`permission_id`);

--
-- Indexes for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD PRIMARY KEY (`user_id`,`role_id`),
  ADD KEY `fk_ur_role` (`role_id`);

--
-- Indexes for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `webhook_events`
--
ALTER TABLE `webhook_events`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_event_id` (`event_id`),
  ADD KEY `idx_event_type` (`event_type`),
  ADD KEY `idx_processed` (`processed`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ai_verifications`
--
ALTER TABLE `ai_verifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=621;

--
-- AUTO_INCREMENT for table `bars`
--
ALTER TABLE `bars`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `bar_amenities`
--
ALTER TABLE `bar_amenities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `bar_comment_reactions`
--
ALTER TABLE `bar_comment_reactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bar_comment_replies`
--
ALTER TABLE `bar_comment_replies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bar_events`
--
ALTER TABLE `bar_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `bar_events_archive`
--
ALTER TABLE `bar_events_archive`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bar_followers`
--
ALTER TABLE `bar_followers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `bar_owners`
--
ALTER TABLE `bar_owners`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `bar_posts`
--
ALTER TABLE `bar_posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `bar_post_comments`
--
ALTER TABLE `bar_post_comments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `bar_post_likes`
--
ALTER TABLE `bar_post_likes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `bar_reply_reactions`
--
ALTER TABLE `bar_reply_reactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bar_reviews`
--
ALTER TABLE `bar_reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bar_tables`
--
ALTER TABLE `bar_tables`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `bar_visits`
--
ALTER TABLE `bar_visits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bir_tax_brackets`
--
ALTER TABLE `bir_tax_brackets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `business_registrations`
--
ALTER TABLE `business_registrations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `comment_reactions`
--
ALTER TABLE `comment_reactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `comment_replies`
--
ALTER TABLE `comment_replies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_bar_bans`
--
ALTER TABLE `customer_bar_bans`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `documents`
--
ALTER TABLE `documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `document_recipients`
--
ALTER TABLE `document_recipients`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `email_verifications`
--
ALTER TABLE `email_verifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `employee_deduction_settings`
--
ALTER TABLE `employee_deduction_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `employee_documents`
--
ALTER TABLE `employee_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `employee_profiles`
--
ALTER TABLE `employee_profiles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `event_comments`
--
ALTER TABLE `event_comments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `event_comment_replies`
--
ALTER TABLE `event_comment_replies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `event_likes`
--
ALTER TABLE `event_likes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `inventory_items`
--
ALTER TABLE `inventory_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `leave_balances`
--
ALTER TABLE `leave_balances`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `leave_requests`
--
ALTER TABLE `leave_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `leave_types`
--
ALTER TABLE `leave_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `menu_items`
--
ALTER TABLE `menu_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_line_items`
--
ALTER TABLE `payment_line_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- AUTO_INCREMENT for table `payment_transactions`
--
ALTER TABLE `payment_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `payouts`
--
ALTER TABLE `payouts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `payroll_deduction_audit`
--
ALTER TABLE `payroll_deduction_audit`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `payroll_deduction_items`
--
ALTER TABLE `payroll_deduction_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `payroll_items`
--
ALTER TABLE `payroll_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=67;

--
-- AUTO_INCREMENT for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=66;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `philhealth_contribution_table`
--
ALTER TABLE `philhealth_contribution_table`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `platform_announcements`
--
ALTER TABLE `platform_announcements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `platform_audit_logs`
--
ALTER TABLE `platform_audit_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=56;

--
-- AUTO_INCREMENT for table `platform_feedback`
--
ALTER TABLE `platform_feedback`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `platform_settings`
--
ALTER TABLE `platform_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `post_comments`
--
ALTER TABLE `post_comments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `post_likes`
--
ALTER TABLE `post_likes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pos_orders`
--
ALTER TABLE `pos_orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `pos_order_items`
--
ALTER TABLE `pos_order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT for table `promotions`
--
ALTER TABLE `promotions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reply_reactions`
--
ALTER TABLE `reply_reactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `reservations`
--
ALTER TABLE `reservations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `reservation_items`
--
ALTER TABLE `reservation_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `reviews`
--
ALTER TABLE `reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `review_responses`
--
ALTER TABLE `review_responses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `sales`
--
ALTER TABLE `sales`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=44;

--
-- AUTO_INCREMENT for table `sss_contribution_table`
--
ALTER TABLE `sss_contribution_table`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=69;

--
-- AUTO_INCREMENT for table `subscriptions`
--
ALTER TABLE `subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `subscription_payments`
--
ALTER TABLE `subscription_payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `subscription_plans`
--
ALTER TABLE `subscription_plans`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `suspicious_logins`
--
ALTER TABLE `suspicious_logins`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=67;

--
-- AUTO_INCREMENT for table `user_sessions`
--
ALTER TABLE `user_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=82;

--
-- AUTO_INCREMENT for table `webhook_events`
--
ALTER TABLE `webhook_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `ai_verifications`
--
ALTER TABLE `ai_verifications`
  ADD CONSTRAINT `ai_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  ADD CONSTRAINT `fk_att_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_att_emp` FOREIGN KEY (`employee_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bars`
--
ALTER TABLE `bars`
  ADD CONSTRAINT `fk_bars_owner_id` FOREIGN KEY (`owner_id`) REFERENCES `bar_owners` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_amenities`
--
ALTER TABLE `bar_amenities`
  ADD CONSTRAINT `bar_amenities_ibfk_1` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_comment_reactions`
--
ALTER TABLE `bar_comment_reactions`
  ADD CONSTRAINT `bar_comment_reactions_ibfk_1` FOREIGN KEY (`comment_id`) REFERENCES `bar_post_comments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bar_comment_reactions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_comment_replies`
--
ALTER TABLE `bar_comment_replies`
  ADD CONSTRAINT `bar_comment_replies_ibfk_1` FOREIGN KEY (`comment_id`) REFERENCES `bar_post_comments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bar_comment_replies_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bar_comment_replies_ibfk_3` FOREIGN KEY (`parent_reply_id`) REFERENCES `bar_comment_replies` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_events`
--
ALTER TABLE `bar_events`
  ADD CONSTRAINT `bar_events_ibfk_1` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_events_archive`
--
ALTER TABLE `bar_events_archive`
  ADD CONSTRAINT `fk_bar_events_archive_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bar_events_archive_user` FOREIGN KEY (`archived_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `bar_followers`
--
ALTER TABLE `bar_followers`
  ADD CONSTRAINT `fk_bf_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bf_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_owners`
--
ALTER TABLE `bar_owners`
  ADD CONSTRAINT `bar_owners_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_posts`
--
ALTER TABLE `bar_posts`
  ADD CONSTRAINT `fk_bp_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_post_comments`
--
ALTER TABLE `bar_post_comments`
  ADD CONSTRAINT `bar_post_comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `bar_posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bar_post_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bar_post_comments_ibfk_3` FOREIGN KEY (`parent_comment_id`) REFERENCES `bar_post_comments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_post_likes`
--
ALTER TABLE `bar_post_likes`
  ADD CONSTRAINT `bar_post_likes_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `bar_posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bar_post_likes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_reply_reactions`
--
ALTER TABLE `bar_reply_reactions`
  ADD CONSTRAINT `bar_reply_reactions_ibfk_1` FOREIGN KEY (`reply_id`) REFERENCES `bar_comment_replies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bar_reply_reactions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_reviews`
--
ALTER TABLE `bar_reviews`
  ADD CONSTRAINT `bar_reviews_ibfk_1` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bar_reviews_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_tables`
--
ALTER TABLE `bar_tables`
  ADD CONSTRAINT `fk_bar_tables_bar_id` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bar_visits`
--
ALTER TABLE `bar_visits`
  ADD CONSTRAINT `bar_visits_ibfk_1` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bar_visits_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `comment_reactions`
--
ALTER TABLE `comment_reactions`
  ADD CONSTRAINT `fk_cre_comment` FOREIGN KEY (`comment_id`) REFERENCES `post_comments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cre_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `comment_replies`
--
ALTER TABLE `comment_replies`
  ADD CONSTRAINT `fk_cr_comment` FOREIGN KEY (`comment_id`) REFERENCES `post_comments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `customer_bar_bans`
--
ALTER TABLE `customer_bar_bans`
  ADD CONSTRAINT `fk_customer_bar_bans_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_customer_bar_bans_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `document_recipients`
--
ALTER TABLE `document_recipients`
  ADD CONSTRAINT `fk_docrecip_doc` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_docrecip_user` FOREIGN KEY (`recipient_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `email_verifications`
--
ALTER TABLE `email_verifications`
  ADD CONSTRAINT `email_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `employee_documents`
--
ALTER TABLE `employee_documents`
  ADD CONSTRAINT `fk_docs_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_docs_employee` FOREIGN KEY (`employee_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_docs_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `employee_profiles`
--
ALTER TABLE `employee_profiles`
  ADD CONSTRAINT `fk_emp_profile_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_emp_profile_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `event_comments`
--
ALTER TABLE `event_comments`
  ADD CONSTRAINT `fk_event_comments_event` FOREIGN KEY (`event_id`) REFERENCES `bar_events` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_event_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `event_comment_replies`
--
ALTER TABLE `event_comment_replies`
  ADD CONSTRAINT `fk_event_comment_replies_comment` FOREIGN KEY (`event_comment_id`) REFERENCES `event_comments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_event_comment_replies_event` FOREIGN KEY (`event_id`) REFERENCES `bar_events` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_event_comment_replies_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `event_likes`
--
ALTER TABLE `event_likes`
  ADD CONSTRAINT `fk_event_likes_event` FOREIGN KEY (`event_id`) REFERENCES `bar_events` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_event_likes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD CONSTRAINT `fk_inv_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `leave_balances`
--
ALTER TABLE `leave_balances`
  ADD CONSTRAINT `fk_balance_leave_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`);

--
-- Constraints for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD CONSTRAINT `fk_leave_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_leave_decider` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_leave_emp` FOREIGN KEY (`employee_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_leave_requests_leave_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`);

--
-- Constraints for table `menu_items`
--
ALTER TABLE `menu_items`
  ADD CONSTRAINT `fk_menu_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_menu_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payment_line_items`
--
ALTER TABLE `payment_line_items`
  ADD CONSTRAINT `fk_payment_line_items_payment_tx` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payouts`
--
ALTER TABLE `payouts`
  ADD CONSTRAINT `fk_payout_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_payout_transaction` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_payouts_bar_owner` FOREIGN KEY (`bar_owner_id`) REFERENCES `bar_owners` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payroll_items`
--
ALTER TABLE `payroll_items`
  ADD CONSTRAINT `fk_items_run` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs` (`id`);

--
-- Constraints for table `platform_announcements`
--
ALTER TABLE `platform_announcements`
  ADD CONSTRAINT `fk_pa_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `platform_audit_logs`
--
ALTER TABLE `platform_audit_logs`
  ADD CONSTRAINT `fk_pal_actor_user` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_pal_target_bar` FOREIGN KEY (`target_bar_id`) REFERENCES `bars` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `platform_feedback`
--
ALTER TABLE `platform_feedback`
  ADD CONSTRAINT `platform_feedback_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `post_comments`
--
ALTER TABLE `post_comments`
  ADD CONSTRAINT `fk_pc_post` FOREIGN KEY (`post_id`) REFERENCES `bar_posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `post_likes`
--
ALTER TABLE `post_likes`
  ADD CONSTRAINT `fk_pl_post` FOREIGN KEY (`post_id`) REFERENCES `bar_posts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `pos_orders`
--
ALTER TABLE `pos_orders`
  ADD CONSTRAINT `fk_pos_orders_payment_tx` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `pos_orders_ibfk_1` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pos_orders_ibfk_2` FOREIGN KEY (`table_id`) REFERENCES `bar_tables` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `pos_orders_ibfk_3` FOREIGN KEY (`staff_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `pos_order_items`
--
ALTER TABLE `pos_order_items`
  ADD CONSTRAINT `pos_order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `pos_orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pos_order_items_ibfk_2` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`),
  ADD CONSTRAINT `pos_order_items_ibfk_3` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`);

--
-- Constraints for table `promotions`
--
ALTER TABLE `promotions`
  ADD CONSTRAINT `fk_promo_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `reply_reactions`
--
ALTER TABLE `reply_reactions`
  ADD CONSTRAINT `fk_rre_reply` FOREIGN KEY (`reply_id`) REFERENCES `comment_replies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rre_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `reservations`
--
ALTER TABLE `reservations`
  ADD CONSTRAINT `fk_res_bar_id` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_res_customer_user_id` FOREIGN KEY (`customer_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_res_table_id` FOREIGN KEY (`table_id`) REFERENCES `bar_tables` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_reservations_payment_tx` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `reservation_items`
--
ALTER TABLE `reservation_items`
  ADD CONSTRAINT `fk_ri_menu_item` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ri_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `reviews`
--
ALTER TABLE `reviews`
  ADD CONSTRAINT `fk_reviews_bar` FOREIGN KEY (`bar_id`) REFERENCES `bars` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_reviews_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `review_responses`
--
ALTER TABLE `review_responses`
  ADD CONSTRAINT `fk_rr_review` FOREIGN KEY (`review_id`) REFERENCES `reviews` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD CONSTRAINT `fk_rp_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sales`
--
ALTER TABLE `sales`
  ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`);

--
-- Constraints for table `subscriptions`
--
ALTER TABLE `subscriptions`
  ADD CONSTRAINT `fk_sub_owner` FOREIGN KEY (`bar_owner_id`) REFERENCES `bar_owners` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_sub_plan` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans` (`id`);

--
-- Constraints for table `subscription_payments`
--
ALTER TABLE `subscription_payments`
  ADD CONSTRAINT `fk_subpay_subscription` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_subpay_transaction` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transactions` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `suspicious_logins`
--
ALTER TABLE `suspicious_logins`
  ADD CONSTRAINT `fk_sl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_banned_by` FOREIGN KEY (`banned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_users_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_permissions`
--
ALTER TABLE `user_permissions`
  ADD CONSTRAINT `fk_up_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
