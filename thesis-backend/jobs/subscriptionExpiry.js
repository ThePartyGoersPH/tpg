const pool = require("../config/database");
const { getActiveSubscription, isExpired } = require("../utils/subscription");

/**
 * Scheduled enforcement of subscription expiry.
 * For every active subscription whose expires_at is past the grace period,
 * mark it 'expired', downgrade the owner to free, and lock bars beyond the
 * free limit. Runs on a timer so expired plans cannot be kept alive by
 * simply not opening the subscription page.
 */
async function runSubscriptionExpiryCheck() {
  try {
    const [active] = await pool.query(
      `SELECT s.id, s.bar_owner_id, s.expires_at
       FROM subscriptions s
       WHERE s.status = 'active' AND s.expires_at IS NOT NULL`
    );

    let processed = 0;
    let downgraded = 0;

    for (const sub of active) {
      processed++;
      if (!isExpired(sub)) continue;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(
          "UPDATE subscriptions SET status = 'expired', cancelled_at = NOW() WHERE id = ?",
          [sub.id]
        );
        await conn.query(
          "UPDATE bar_owners SET subscription_tier = 'free', subscription_expires_at = NULL WHERE id = ?",
          [sub.bar_owner_id]
        );
        const [bars] = await conn.query(
          "SELECT id FROM bars WHERE owner_id = ? ORDER BY created_at ASC",
          [sub.bar_owner_id]
        );
        for (let i = 0; i < bars.length; i++) {
          const locked = i >= 1 ? 1 : 0;
          await conn.query("UPDATE bars SET is_locked = ? WHERE id = ?", [locked, bars[i].id]);
        }
        await conn.commit();
        downgraded++;
      } catch (err) {
        await conn.rollback();
        console.error("[EXPIRY] Failed to downgrade subscription", sub.id, err);
      } finally {
        conn.release();
      }
    }

    if (processed) {
      console.log(`[EXPIRY] Checked ${processed} active subscriptions, downgraded ${downgraded}.`);
    }
  } catch (err) {
    console.error("[EXPIRY] Subscription expiry check failed:", err);
  }
}

module.exports = { runSubscriptionExpiryCheck };
