// utils/audit.js
// Reusable audit-logging helper.
// CRITICAL: every call is wrapped in try/catch so audit failures
// NEVER break the request that triggered them.

const pool = require("../config/database");

/**
 * Log an audit event. Safe to call anywhere — failures are silently
 * logged to stderr and never propagate to the caller.
 *
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} connOrPool
 *   A pool or connection to use. Pass `null` to use the default pool.
 * @param {Object} payload
 * @param {number}  payload.bar_id
 * @param {number}  payload.user_id
 * @param {string}  payload.action      e.g. "CREATE", "UPDATE", "DELETE", "LOGIN"
 * @param {string}  payload.entity      e.g. "user", "inventory_item", "payroll_run"
 * @param {number}  [payload.entity_id]
 * @param {Object}  [payload.details]   Any JSON-serialisable context
 * @param {string}  [payload.ip_address]
 * @param {string}  [payload.user_agent]
 */
async function logAudit(connOrPool, payload) {
  try {
    const {
      bar_id,
      user_id,
      action,
      entity,
      entity_id = null,
      details = null,
      ip_address = null,
      user_agent = null
    } = payload;

    // minimal validation — silently skip if required fields are missing
    if (!bar_id || !user_id || !action || !entity) return;

    const db = connOrPool || pool;

    const sql = `
      INSERT INTO audit_logs (bar_id, user_id, action, entity, entity_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      bar_id,
      user_id,
      action,
      entity,
      entity_id,
      details ? JSON.stringify(details) : null,
      ip_address,
      user_agent
    ];

    await db.query(sql, params);
  } catch (err) {
    // Log to stderr but NEVER throw — audit must not break business logic
    console.error("⚠️  Audit log failed (non-fatal):", err.message);
  }
}

/**
 * Log a platform-wide audit event (for super admin actions).
 * Similar to logAudit but for platform_audit_logs table.
 * 
 * @param {Object} payload
 * @param {number}  payload.actor_user_id
 * @param {string}  payload.action
 * @param {string}  payload.entity
 * @param {number}  [payload.entity_id]
 * @param {number}  [payload.target_bar_id]
 * @param {Object}  [payload.details]
 * @param {string}  [payload.ip_address]
 * @param {string}  [payload.user_agent]
 */
async function logPlatformAudit(payload) {
  try {
    const {
      actor_user_id,
      action,
      entity,
      entity_id = null,
      target_bar_id = null,
      details = null,
      ip_address = null,
      user_agent = null,
    } = payload;

    await pool.query(
      `INSERT INTO platform_audit_logs
       (actor_user_id, action, entity, entity_id, target_bar_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor_user_id,
        action,
        entity,
        entity_id,
        target_bar_id,
        details ? JSON.stringify(details) : null,
        ip_address,
        user_agent,
      ]
    );
  } catch (err) {
    // Non-fatal. Table may not exist yet before migration is applied.
    console.error("⚠️  Platform audit log failed (non-fatal):", err.message);
  }
}

/**
 * Convenience: extract ip + user-agent from an Express request object.
 * @param {import('express').Request} req
 * @returns {{ ip_address: string, user_agent: string }}
 */
function auditContext(req) {
  return {
    ip_address: req.ip || req.connection?.remoteAddress || null,
    user_agent: req.get ? req.get("user-agent") || null : null
  };
}

module.exports = { logAudit, logPlatformAudit, auditContext };
