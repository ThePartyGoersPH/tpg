const pool = require("../config/database");

async function processNoShowReservations() {
  const [rows] = await pool.query(
    `SELECT r.id, r.customer_user_id, r.bar_id, b.name AS bar_name, r.reservation_date, r.reservation_time
     FROM reservations r
     JOIN bars b ON b.id = r.bar_id
     WHERE r.status = 'confirmed'
       AND r.checked_in_at IS NULL
       AND TIMESTAMP(CONCAT(r.reservation_date, ' ', r.reservation_time)) <= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
     ORDER BY r.reservation_date ASC, r.reservation_time ASC
     LIMIT 200`
  );

  for (const r of rows) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [current] = await conn.query(
        "SELECT id, status, checked_in_at FROM reservations WHERE id = ? FOR UPDATE",
        [r.id]
      );
      if (!current.length) {
        await conn.rollback();
        continue;
      }

      if (current[0].status !== "confirmed" || current[0].checked_in_at) {
        await conn.rollback();
        continue;
      }

      await conn.query(
        "UPDATE reservations SET status = 'no_show', no_show_at = NOW() WHERE id = ?",
        [r.id]
      );

      if (r.customer_user_id) {
        const [existingNotif] = await conn.query(
          `SELECT id FROM notifications
           WHERE user_id = ? AND type = 'reservation_no_show'
             AND reference_type = 'reservation' AND reference_id = ?
           LIMIT 1`,
          [r.customer_user_id, r.id]
        );

        if (!existingNotif.length) {
          await conn.query(
            `INSERT INTO notifications (user_id, title, message, type, is_read, reference_id, reference_type, created_at)
             VALUES (?, ?, ?, 'reservation_no_show', 0, ?, 'reservation', NOW())`,
            [
              r.customer_user_id,
              "Reservation Cancelled (No Show)",
              `Your reservation at ${r.bar_name} was cancelled due to no-show.`,
              r.id
            ]
          );
        }
      }

      await conn.commit();
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      console.error("NO SHOW PROCESS ERROR:", err);
    } finally {
      conn.release();
    }
  }

  return rows.length;
}

module.exports = { processNoShowReservations };
