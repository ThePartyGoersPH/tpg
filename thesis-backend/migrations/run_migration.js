require('dotenv').config();
const pool = require('../config/database');

async function run() {
  try {
    console.log('Running migration: add email verification token columns...');
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS email_verification_expires DATETIME DEFAULT NULL
    `);
    console.log('✓ Columns added (or already exist).');

    try {
      await pool.query(`
        ALTER TABLE users ADD INDEX idx_email_verification_token (email_verification_token)
      `);
      console.log('✓ Index added.');
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log('✓ Index already exists, skipping.');
      } else {
        throw e;
      }
    }

    console.log('\nMigration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
