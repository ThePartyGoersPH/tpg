const pool = require('../config/database');
const { isPushEnabled, sendPushToToken } = require('../utils/pushNotifications');
const { ensureMobilePushSchema } = require('../utils/ensureMobilePushSchema');

const DEFAULT_BATCH_SIZE = Number(process.env.PUSH_DISPATCH_BATCH_SIZE || 150);

function mapRouteForNotification(referenceType) {
  switch (String(referenceType || '').toLowerCase()) {
    case 'reservation':
    case 'reservation_payment':
      return '/reservations';
    case 'comment':
    case 'reply':
    case 'event':
      return '/events';
    default:
      return '/notifications';
  }
}

async function processNotificationPushQueue() {
  try {
    await ensureMobilePushSchema();
  } catch (err) {
    return {
      success: false,
      skipped: true,
      reason: 'push-schema-unavailable',
      error: String(err?.message || err),
    };
  }

  if (!isPushEnabled()) {
    return { success: false, skipped: true, reason: 'push-disabled' };
  }

  const limit = Number.isFinite(DEFAULT_BATCH_SIZE) && DEFAULT_BATCH_SIZE > 0
    ? DEFAULT_BATCH_SIZE
    : 150;

  const [rows] = await pool.query(
    `SELECT
       n.id AS notification_id,
       n.user_id,
       n.type,
       n.title,
       n.message,
       n.reference_id,
       n.reference_type,
       n.created_at,
       t.id AS token_id,
       t.token,
       t.platform,
       t.app_id
     FROM notifications n
     INNER JOIN mobile_push_tokens t
       ON t.user_id = n.user_id
      AND t.is_active = 1
      AND t.app_id = 'customer_app'
     LEFT JOIN mobile_notification_push_log l
       ON l.notification_id = n.id
      AND l.token_id = t.id
     WHERE l.id IS NULL
     ORDER BY n.created_at ASC, n.id ASC
     LIMIT ?`,
    [limit]
  );

  if (!rows.length) {
    return { success: true, skipped: false, processed: 0, sent: 0, failed: 0, deactivated_tokens: 0 };
  }

  let sent = 0;
  let failed = 0;
  let deactivatedTokens = 0;

  for (const row of rows) {
    const pushResult = await sendPushToToken(row.token, {
      title: row.title || 'Notification',
      body: row.message || '',
      data: {
        notification_id: row.notification_id,
        type: row.type,
        reference_type: row.reference_type,
        reference_id: row.reference_id,
        route: mapRouteForNotification(row.reference_type),
      },
    });

    if (pushResult.success) {
      sent += 1;
      await pool.query(
        `INSERT INTO mobile_notification_push_log
           (notification_id, token_id, status, error_message)
         VALUES (?, ?, 'sent', NULL)
         ON DUPLICATE KEY UPDATE status = VALUES(status), error_message = VALUES(error_message), created_at = CURRENT_TIMESTAMP`,
        [row.notification_id, row.token_id]
      );
      continue;
    }

    failed += 1;
    const status = pushResult.skipped ? 'skipped' : 'failed';
    await pool.query(
      `INSERT INTO mobile_notification_push_log
         (notification_id, token_id, status, error_message)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), error_message = VALUES(error_message), created_at = CURRENT_TIMESTAMP`,
      [
        row.notification_id,
        row.token_id,
        status,
        (pushResult.errorMessage || '').slice(0, 255) || null,
      ]
    );

    if (pushResult.invalidToken) {
      await pool.query(
        'UPDATE mobile_push_tokens SET is_active = 0 WHERE id = ?',
        [row.token_id]
      );
      deactivatedTokens += 1;
    }
  }

  return {
    success: true,
    skipped: false,
    processed: rows.length,
    sent,
    failed,
    deactivated_tokens: deactivatedTokens,
  };
}

module.exports = {
  processNotificationPushQueue,
};
