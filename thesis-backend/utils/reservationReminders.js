const pool = require('../config/database');

/**
 * Send reminder notifications for reservations happening today
 * This should be called every 4 hours via a cron job or scheduler
 */
async function sendTodayReservationReminders() {
  try {
    console.log('[RESERVATION REMINDERS] Starting to check today\'s reservations...');
    
    // Get all reservations for today that are approved or paid
    const [reservations] = await pool.query(
      `SELECT 
        r.id,
        r.customer_user_id,
        r.bar_id,
        r.reservation_date,
        r.reservation_time,
        r.transaction_number,
        b.name AS bar_name,
        t.table_number
       FROM reservations r
       JOIN bars b ON r.bar_id = b.id
       LEFT JOIN bar_tables t ON r.table_id = t.id
       WHERE r.reservation_date = CURDATE()
         AND r.status IN ('approved', 'paid')
       ORDER BY r.reservation_time ASC`
    );

    if (reservations.length === 0) {
      console.log('[RESERVATION REMINDERS] No reservations found for today.');
      return { success: true, sent: 0 };
    }

    console.log(`[RESERVATION REMINDERS] Found ${reservations.length} reservation(s) for today.`);

    let sentCount = 0;
    const now = new Date();
    const currentHour = now.getHours();

    for (const reservation of reservations) {
      try {
        // Parse reservation time (format: HH:MM:SS)
        const [resHour] = reservation.reservation_time.split(':').map(Number);
        const hoursUntil = resHour - currentHour;

        // Only send reminder if reservation is within next 4 hours or has passed but is still today
        // This ensures reminders are sent at 4-hour intervals throughout the day
        if (hoursUntil >= 0 && hoursUntil <= 4) {
          // Check if we already sent a reminder in the last 3.5 hours to avoid duplicates
          const [existingNotif] = await pool.query(
            `SELECT id FROM notifications 
             WHERE user_id = ? 
               AND type = 'reservation_reminder'
               AND related_id = ?
               AND created_at >= DATE_SUB(NOW(), INTERVAL 210 MINUTE)
             LIMIT 1`,
            [reservation.customer_user_id, reservation.id]
          );

          if (existingNotif.length > 0) {
            console.log(`[RESERVATION REMINDERS] Skipping reservation #${reservation.id} - reminder already sent recently.`);
            continue;
          }

          const formattedTime = reservation.reservation_time.slice(0, 5);
          const tableInfo = reservation.table_number ? ` at Table #${reservation.table_number}` : '';
          
          let message;
          if (hoursUntil === 0) {
            message = `Your reservation at ${reservation.bar_name}${tableInfo} is happening now!`;
          } else if (hoursUntil === 1) {
            message = `Reminder: Your reservation at ${reservation.bar_name}${tableInfo} is in 1 hour at ${formattedTime}.`;
          } else {
            message = `Reminder: Your reservation at ${reservation.bar_name}${tableInfo} is in ${hoursUntil} hours at ${formattedTime}.`;
          }

          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
            [
              reservation.customer_user_id,
              'reservation_reminder',
              'Reservation Reminder',
              message,
              reservation.id,
              'reservation'
            ]
          );

          // Mirror email at most ~once a day per reservation (checked via the
          // audit trail), so the 4-hour scheduler never spams the inbox.
          try {
            const [[mailed]] = await pool.query(
              `SELECT id FROM platform_audit_logs
               WHERE action = 'EMAIL_SENT'
                 AND entity_id = ?
                 AND details LIKE '%"event":"reservation_reminder"%'
                 AND created_at >= DATE_SUB(NOW(), INTERVAL 20 HOUR)
               LIMIT 1`,
              [reservation.customer_user_id]
            );
            if (!mailed) {
              const { notifyCustomer } = require("./notifyCustomer");
              const tableInfo = reservation.table_number ? ` at Table #${reservation.table_number}` : '';
              await notifyCustomer(reservation.customer_user_id, "reservation_reminder", {
                barName: reservation.bar_name,
                when: `today at ${formattedTime}${tableInfo}`,
              });
            }
          } catch (_) {}

          sentCount++;
          console.log(`[RESERVATION REMINDERS] Sent reminder for reservation #${reservation.id} (${hoursUntil}h until)`);
        }
      } catch (err) {
        console.error(`[RESERVATION REMINDERS] Error sending reminder for reservation #${reservation.id}:`, err);
      }
    }

    console.log(`[RESERVATION REMINDERS] Completed. Sent ${sentCount} reminder(s).`);
    return { success: true, sent: sentCount };
  } catch (err) {
    console.error('[RESERVATION REMINDERS] Error in sendTodayReservationReminders:', err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendTodayReservationReminders };
