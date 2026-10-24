const pool = require('../config/database');

// Single source of truth for platform-wide money settings. Previously each
// route re-read platform_settings with its own hardcoded fallback, so the
// platform fee silently diverged between payouts, financials and dashboards.
const DEFAULT_PLATFORM_FEE_PERCENTAGE = 5.0;

async function getSetting(key, fallback = null) {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1",
      [key]
    );
    const value = rows?.[0]?.setting_value;
    return value === null || value === undefined || value === '' ? fallback : value;
  } catch (err) {
    console.error(`Failed to load platform setting '${key}':`, err.message);
    return fallback;
  }
}

async function getPlatformFeePercentage(conn = pool) {
  const query = conn === pool
    ? getSetting('platform_fee_percentage')
    : conn.query("SELECT setting_value FROM platform_settings WHERE setting_key = 'platform_fee_percentage' LIMIT 1")
      .then(([rows]) => rows?.[0]?.setting_value ?? null)
      .catch((err) => {
        console.error("Failed to load platform fee percentage:", err.message);
        return null;
      });

  const raw = await query;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_PLATFORM_FEE_PERCENTAGE;
  return parsed;
}

async function isPaymentsEnabled() {
  const raw = await getSetting('payments_enabled', '1');
  return String(raw) === '1' || String(raw).toLowerCase() === 'true';
}

module.exports = {
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  getSetting,
  getPlatformFeePercentage,
  isPaymentsEnabled,
};
