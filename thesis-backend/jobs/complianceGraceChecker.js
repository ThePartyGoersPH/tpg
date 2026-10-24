const pool = require('../config/database');

/**
 * Compliance Grace Checker Job
 * A submitted registration keeps its bar visible to customers for 3 days while
 * the Super Admin reviews it. When that window lapses without approval the bar
 * is pulled from the customer app (hidden_incomplete) and the automatic action
 * is written to the audit trail.
 */

async function checkComplianceGrace() {
  console.log('[Compliance Grace Checker] Starting check...');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [expired] = await conn.query(
      `SELECT id, name
         FROM bars
        WHERE compliance_status = 'pending_review'
          AND temp_visible_until IS NOT NULL
          AND temp_visible_until <= NOW()
        FOR UPDATE`
    );

    if (!expired.length) {
      await conn.commit();
      console.log('[Compliance Grace Checker] No expired grace windows');
      return { success: true, hiddenCount: 0 };
    }

    const ids = expired.map((bar) => bar.id);
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await conn.query(
      `UPDATE bars
          SET compliance_status = 'hidden_incomplete'
        WHERE id IN (${placeholders})
          AND compliance_status = 'pending_review'`,
      ids
    );

    for (const bar of expired) {
      const message = `System auto-hid Bar ${bar.name} — requirements not completed within 3-day grace period`;
      await conn.query(
        `INSERT INTO audit_logs (bar_id, user_id, action, entity, entity_id, details)
         VALUES (?, 0, 'COMPLIANCE_AUTO_HIDE', 'bar', ?, ?)`,
        [bar.id, bar.id, JSON.stringify({ message, bar_name: bar.name, compliance_status: 'hidden_incomplete' })]
      );
      console.log(`[Compliance Grace Checker] Hid bar: ${bar.name} (#${bar.id})`);
    }

    await conn.commit();
    console.log(`[Compliance Grace Checker] Hidden ${result.affectedRows} bar(s)`);
    return { success: true, hiddenCount: result.affectedRows };
  } catch (err) {
    await conn.rollback();
    console.error('[Compliance Grace Checker] Error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { checkComplianceGrace };
