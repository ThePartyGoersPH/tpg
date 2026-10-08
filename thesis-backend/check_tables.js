const pool = require('./config/database');

async function checkTables() {
  try {
    console.log('Checking if tables exist...');
    
    // Check inventory_requests table
    const [inventoryCheck] = await pool.query("SHOW TABLES LIKE 'inventory_requests'");
    console.log('inventory_requests table:', inventoryCheck.length > 0 ? '✅ EXISTS' : '❌ MISSING');
    
    // Check payroll_settings table
    const [payrollCheck] = await pool.query("SHOW TABLES LIKE 'payroll_settings'");
    console.log('payroll_settings table:', payrollCheck.length > 0 ? '✅ EXISTS' : '❌ MISSING');
    
    // Check if permit columns exist in bars table
    try {
      const [permitCheck] = await pool.query("DESCRIBE bars permit_expiry_date");
      console.log('bars.permit_expiry_date column: ✅ EXISTS');
    } catch (err) {
      console.log('bars.permit_expiry_date column: ❌ MISSING');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error checking tables:', err);
    process.exit(1);
  }
}

checkTables();
