require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'tpg',
    multipleStatements: true,
  });

  try {
    console.log('Connected to database:', process.env.DB_NAME || 'tpg');
    console.log('Running migration: 20260326_tax_aware_ordering.sql ...');

    const sql = fs.readFileSync(path.join(__dirname, '20260326_tax_aware_ordering.sql'), 'utf8');
    await conn.query(sql);

    console.log('\n✅ Migration completed successfully!');
    console.log('   - bars table: tin, is_bir_registered, tax_type, tax_rate, tax_mode columns added');
    console.log('   - pos_orders table: customer_user_id, order_source, tax_amount, tax_type_snapshot, tax_rate_snapshot, or_number columns added');
    console.log('   - or_number_sequences table created');
    console.log('   - Index on pos_orders(customer_user_id, order_source) added');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
