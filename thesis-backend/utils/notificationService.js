/**
 * Centralized notification service.
 *
 * Every module (orders, HR, procurement, compliance, social/events, inventory,
 * reservations, attendance) should call `createNotification` instead of building
 * ad-hoc INSERT statements. This keeps the schema, recipient resolution, and
 * routing metadata consistent across the whole app.
 */
const pool = require("../config/database");

/**
 * Resolve the bar-team recipients (owner + manager/staff/employee/hr) for a bar.
 * Mirrors the legacy logic in routes/social.js getBarTeamNotificationRecipients.
 */
async function getBarTeamRecipients(barId) {
  const normalizedBarId = Number(barId);
  if (!normalizedBarId) return [];

  const [rows] = await pool.query(
    `SELECT DISTINCT recipient_id
     FROM (
        SELECT bo.user_id AS recipient_id
        FROM bars b
        JOIN bar_owners bo ON bo.id = b.owner_id
        WHERE b.id = ?
          AND bo.user_id IS NOT NULL

        UNION

        SELECT u.id AS recipient_id
        FROM users u
        LEFT JOIN roles r
          ON r.id = COALESCE(
            u.role_id,
            (SELECT id FROM roles WHERE UPPER(name) = UPPER(u.role) LIMIT 1)
          )
        WHERE u.bar_id = ?
          AND COALESCE(u.is_active, 1) = 1
          AND LOWER(COALESCE(r.name, u.role, '')) IN ('bar_owner', 'manager', 'staff', 'employee', 'hr')
      ) recipients
      WHERE recipient_id IS NOT NULL`,
    [normalizedBarId, normalizedBarId]
  );

  return rows
    .map((row) => Number(row.recipient_id || 0))
    .filter((id) => Number.isFinite(id) && id > 0);
}

/**
 * Create one notification per recipient.
 *
 * @param {Object} opts
 * @param {number|number[]} [opts.userIds]  Explicit recipients. If omitted, `barId` is used.
 * @param {number}          [opts.barId]    Used to resolve bar-team recipients when userIds is empty.
 * @param {string}          opts.type       Machine type, e.g. 'low_stock'.
 * @param {string}          opts.title
 * @param {string}          opts.message
 * @param {string}          [opts.referenceType]  Entity kind, e.g. 'inventory_item'.
 * @param {number}          [opts.referenceId]    Entity id.
 * @param {string}          [opts.category]  Grouping, e.g. 'inventory'.
 * @param {string}          [opts.action]   'navigate' | 'open_chat'.
 * @param {string}          [opts.targetRoute]  Route to navigate to, e.g. '/inventory?item=12'.
 * @param {object}          [opts.metadata]  Extra context (chat thread ids, etc.).
 * @param {number}          [opts.excludeUserId]  Recipient id to skip (e.g. the actor).
 */
async function createNotification(opts) {
  const {
    userIds,
    barId,
    type,
    title,
    message,
    referenceType = null,
    referenceId = null,
    category = null,
    action = "navigate",
    targetRoute = null,
    metadata = null,
    excludeUserId = null,
  } = opts;

  if (!type || !title || !message) {
    console.error("createNotification: missing required fields", opts);
    return [];
  }

  let recipients = Array.isArray(userIds)
    ? userIds.slice()
    : userIds != null
    ? [userIds]
    : [];

  if (recipients.length === 0 && barId) {
    recipients = await getBarTeamRecipients(barId);
  }

  if (excludeUserId != null) {
    recipients = recipients.filter((id) => Number(id) !== Number(excludeUserId));
  }

  recipients = recipients
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (recipients.length === 0) return [];

  const metaJson = metadata ? JSON.stringify(metadata) : null;
  const values = recipients.map((uid) => [
    uid,
    type,
    title,
    message,
    referenceType ? String(referenceType) : null,
    referenceId != null ? Number(referenceId) : null,
    category ? String(category) : null,
    action ? String(action) : "navigate",
    targetRoute ? String(targetRoute) : null,
    metaJson,
    0,
    new Date(),
  ]);

  try {
    await pool.query(
      `INSERT INTO notifications
       (user_id, type, title, message, reference_type, reference_id, category, action, target_route, metadata, is_read, created_at)
       VALUES ?`,
      [values]
    );
  } catch (err) {
    console.error("createNotification INSERT failed:", err);
    return [];
  }

  return recipients;
}

module.exports = { createNotification, getBarTeamRecipients };
