-- Migration: Fix Timezone to Asia/Manila (UTC+8)
-- Date: 2026-03-07
-- Description: Configure MySQL to use Philippine timezone and fix existing timestamp data

-- =====================================================
-- PART 1: SET MYSQL TIMEZONE TO ASIA/MANILA
-- =====================================================

-- Set global timezone to +08:00 (Asia/Manila)
SET GLOBAL time_zone = '+08:00';

-- Set session timezone to +08:00
SET time_zone = '+08:00';

-- Verify timezone settings
SELECT @@global.time_zone AS global_timezone;
SELECT @@session.time_zone AS session_timezone;
SELECT NOW() AS current_time_manila;
SELECT UTC_TIMESTAMP();

-- =====================================================
-- PART 2: ANALYZE EXISTING TIMESTAMP DATA
-- =====================================================

-- Check sample POS orders to see current timestamps
SELECT 
    'POS Orders Sample' AS table_name,
    id,
    order_number,
    created_at,
    CONVERT_TZ(created_at, '+00:00', '+08:00') AS created_at_manila,
    completed_at,
    CONVERT_TZ(completed_at, '+00:00', '+08:00') AS completed_at_manila
FROM pos_orders
ORDER BY created_at DESC
LIMIT 5;

-- Check attendance logs
SELECT 
    'Attendance Logs Sample' AS table_name,
    id,
    work_date,
    time_in,
    CONVERT_TZ(time_in, '+00:00', '+08:00') AS time_in_manila,
    time_out,
    CONVERT_TZ(time_out, '+00:00', '+08:00') AS time_out_manila
FROM attendance_logs
ORDER BY time_in DESC
LIMIT 5;

-- =====================================================
-- PART 3: FIX EXISTING TIMESTAMPS (OPTIONAL)
-- =====================================================
-- WARNING: Only run this if your existing data is stored in UTC
-- and you want to convert it to Philippine time.
-- This will ADD 8 hours to all existing timestamps.

-- UNCOMMENT THE FOLLOWING QUERIES ONLY IF NEEDED:

-- Fix POS orders timestamps
-- UPDATE pos_orders 
-- SET 
--     created_at = CONVERT_TZ(created_at, '+00:00', '+08:00'),
--     updated_at = CONVERT_TZ(updated_at, '+00:00', '+08:00'),
--     completed_at = IF(completed_at IS NOT NULL, CONVERT_TZ(completed_at, '+00:00', '+08:00'), NULL),
--     cancelled_at = IF(cancelled_at IS NOT NULL, CONVERT_TZ(cancelled_at, '+00:00', '+08:00'), NULL)
-- WHERE created_at < NOW();

-- Fix attendance logs timestamps
-- UPDATE attendance_logs
-- SET
--     time_in = IF(time_in IS NOT NULL, CONVERT_TZ(time_in, '+00:00', '+08:00'), NULL),
--     time_out = IF(time_out IS NOT NULL, CONVERT_TZ(time_out, '+00:00', '+08:00'), NULL),
--     created_at = CONVERT_TZ(created_at, '+00:00', '+08:00')
-- WHERE created_at < NOW();

-- Fix reservations timestamps
-- UPDATE reservations
-- SET
--     reservation_date = IF(reservation_date IS NOT NULL, CONVERT_TZ(reservation_date, '+00:00', '+08:00'), NULL),
--     created_at = CONVERT_TZ(created_at, '+00:00', '+08:00'),
--     updated_at = CONVERT_TZ(updated_at, '+00:00', '+08:00')
-- WHERE created_at < NOW();

-- Fix audit logs timestamps
-- UPDATE audit_logs
-- SET created_at = CONVERT_TZ(created_at, '+00:00', '+08:00')
-- WHERE created_at < NOW();

-- Fix sales timestamps
-- UPDATE sales
-- SET 
--     sale_date = IF(sale_date IS NOT NULL, CONVERT_TZ(sale_date, '+00:00', '+08:00'), NULL),
--     created_at = CONVERT_TZ(created_at, '+00:00', '+08:00')
-- WHERE created_at < NOW();

-- =====================================================
-- PART 4: VERIFICATION
-- =====================================================

-- Verify POS orders now show correct Philippine time
SELECT 
    'Verification: POS Orders' AS check_name,
    COUNT(*) AS total_orders,
    MIN(created_at) AS earliest_order,
    MAX(created_at) AS latest_order,
    DATE(MAX(created_at)) AS latest_order_date
FROM pos_orders;

-- Verify attendance logs
SELECT 
    'Verification: Attendance' AS check_name,
    COUNT(*) AS total_logs,
    MIN(time_in) AS earliest_punch,
    MAX(time_in) AS latest_punch
FROM attendance_logs;

-- =====================================================
-- NOTES FOR DEPLOYMENT
-- =====================================================
-- 1. The MySQL connection pool is now configured with timezone: '+08:00'
-- 2. Node.js process timezone is set to 'Asia/Manila'
-- 3. All new timestamps will automatically use Philippine time
-- 4. Existing timestamps may need conversion (see PART 3 above)
-- 5. Test thoroughly before running timestamp conversion queries

-- =====================================================
-- TESTING QUERY
-- =====================================================
-- Use this to test if timezone is working correctly:
-- INSERT INTO pos_orders (bar_id, staff_user_id, order_number, status, subtotal, total_amount, created_at)
-- VALUES (11, 29, 'TEST-TIMEZONE-001', 'pending', 100.00, 100.00, NOW());
-- 
-- Then check:
-- SELECT order_number, created_at, DATE(created_at) AS order_date FROM pos_orders WHERE order_number = 'TEST-TIMEZONE-001';
-- 
-- The created_at should match your current Philippine time.
