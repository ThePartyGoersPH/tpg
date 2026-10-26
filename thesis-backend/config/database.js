const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
  database: process.env.NODE_ENV === 'production'
    ? (process.env.DB_NAME_ONLINE || process.env.DB_NAME || 'partygoers_online_db')
    : (process.env.DB_NAME_LOCAL || process.env.DB_NAME || 'partygoers_local_db'),
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10000, // fail fast instead of hanging forever on an unreachable DB
  timezone: 'Z', // Store timestamps in UTC for consistent frontend display
});

module.exports = pool;
