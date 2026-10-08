-- Check for triggers on users table
SHOW TRIGGERS WHERE `Table` = 'users';

-- Check for stored procedures that might be interfering
SHOW PROCEDURE STATUS WHERE Db = 'tpg';

-- Check for functions
SHOW FUNCTION STATUS WHERE Db = 'tpg';
