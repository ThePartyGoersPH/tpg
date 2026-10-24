require('dotenv').config();
const pool = require('../config/database');

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function fkExists(tableName, constraintName) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
     LIMIT 1`,
    [tableName, constraintName]
  );
  return rows.length > 0;
}

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      cashier_id INT NOT NULL,
      bar_id INT NOT NULL,
      opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      expected_cash DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      actual_cash DECIMAL(12,2) NULL,
      difference DECIMAL(12,2) NULL,
      status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
      close_status ENUM('BALANCED','SHORT','OVER') NULL,
      alert_flag TINYINT(1) NOT NULL DEFAULT 0,
      open_marker TINYINT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NULL DEFAULT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_shifts_cashier (cashier_id),
      KEY idx_shifts_bar (bar_id),
      KEY idx_shifts_status (status),
      UNIQUE KEY uniq_shift_open_per_cashier (cashier_id, open_marker)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cash_transactions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      shift_id BIGINT UNSIGNED NOT NULL,
      type ENUM('CASH_IN','CASH_OUT') NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      reason VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_cash_tx_shift (shift_id),
      KEY idx_cash_tx_type (type),
      CONSTRAINT fk_cash_transactions_shift
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (!(await columnExists('pos_orders', 'shift_id'))) {
    await pool.query('ALTER TABLE pos_orders ADD COLUMN shift_id BIGINT UNSIGNED NULL AFTER staff_user_id');
    console.log('Added pos_orders.shift_id');
  } else {
    console.log('pos_orders.shift_id already exists');
  }

  if (!(await indexExists('pos_orders', 'idx_pos_orders_shift_id'))) {
    await pool.query('ALTER TABLE pos_orders ADD INDEX idx_pos_orders_shift_id (shift_id)');
    console.log('Added idx_pos_orders_shift_id');
  } else {
    console.log('idx_pos_orders_shift_id already exists');
  }

  if (!(await fkExists('pos_orders', 'fk_pos_orders_shift'))) {
    try {
      await pool.query(
        'ALTER TABLE pos_orders ADD CONSTRAINT fk_pos_orders_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL'
      );
      console.log('Added fk_pos_orders_shift');
    } catch (error) {
      console.log('Skipped fk_pos_orders_shift:', error.message);
    }
  } else {
    console.log('fk_pos_orders_shift already exists');
  }

  console.log('POS cash shift migration complete');
}

run()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
