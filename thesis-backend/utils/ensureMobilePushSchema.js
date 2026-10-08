const pool = require("../config/database");

let ensurePromise = null;

async function ensureMobilePushSchema(conn = pool) {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS mobile_push_tokens (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         user_id INT NOT NULL,
         token VARCHAR(512) NOT NULL,
         platform ENUM('android','ios','web','unknown') NOT NULL DEFAULT 'unknown',
         app_id VARCHAR(64) NOT NULL DEFAULT 'customer_app',
         is_active TINYINT(1) NOT NULL DEFAULT 1,
         last_seen_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_mobile_push_token_app (token, app_id),
         KEY idx_mobile_push_user_active (user_id, is_active)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await conn.query(
      `CREATE TABLE IF NOT EXISTS mobile_notification_push_log (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         notification_id INT NOT NULL,
         token_id BIGINT UNSIGNED NOT NULL,
         status ENUM('sent','failed','skipped') NOT NULL,
         error_message VARCHAR(255) NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_mobile_notif_token (notification_id, token_id),
         KEY idx_mobile_notif_log_status (status),
         KEY idx_mobile_notif_log_token (token_id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    return true;
  })().catch((err) => {
    ensurePromise = null;
    throw err;
  });

  return ensurePromise;
}

module.exports = {
  ensureMobilePushSchema,
};
