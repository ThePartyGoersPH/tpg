-- ==========================================================
-- Super Admin notification read state (per admin)
-- Date: 2026-10-07
-- Notes:
--   - Additive only, no existing data touched
--   - notification_key matches the synthetic ids built in
--     GET /super-admin/notifications (e.g. 'registration-5',
--     'feedback-3', 'pending-payouts', 'flagged-posts',
--     'flagged-comments')
--   - Keys are synthetic and stable while the underlying item
--     is still pending; rows for actioned (disappeared) items
--     are harmless leftovers
-- ==========================================================

CREATE TABLE IF NOT EXISTS super_admin_notification_reads (
  notification_key VARCHAR(64) NOT NULL,
  admin_user_id INT NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_key, admin_user_id),
  KEY idx_sa_notif_reads_admin (admin_user_id),
  CONSTRAINT fk_sa_notif_reads_admin
    FOREIGN KEY (admin_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
