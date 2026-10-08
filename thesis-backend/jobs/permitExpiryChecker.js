const pool = require('../config/database');
const { sendEmail } = require('../utils/emailService');
const { createNotification } = require('../utils/notificationService');

/**
 * Permit Expiry Checker Job
 * Runs daily to check for expiring and expired permits
 * - Sends 30-day warning emails
 * - Flags expired permits
 */

async function checkPermitExpiry() {
  console.log('[Permit Expiry Checker] Starting daily check...');
  
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get current date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Calculate 30 days from now
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    // 1. Check for permits expiring in 30 days (send warning email)
    const [expiringSoon] = await conn.query(
      `SELECT b.id, b.name, b.permit_expiry_date, u.id AS owner_user_id, u.email, u.first_name, u.last_name
       FROM bars b
       JOIN bar_owners bo ON b.owner_id = bo.id
       JOIN users u ON bo.user_id = u.id
       WHERE b.permit_expiry_date = ?
         AND b.permit_status != 'expired'
         AND (b.permit_expiry_notified_at IS NULL 
              OR DATE(b.permit_expiry_notified_at) < ?)`,
      [thirtyDaysStr, todayStr]
    );

    console.log(`[Permit Expiry Checker] Found ${expiringSoon.length} permits expiring in 30 days`);

    for (const bar of expiringSoon) {
      try {
        // Send warning email
        const emailSent = await sendPermitExpiryWarning(bar);

        // Update bar status to 'expiring_soon'
        await conn.query(
          `UPDATE bars 
           SET permit_status = 'expiring_soon', 
               permit_expiry_notified_at = NOW()
           WHERE id = ?`,
          [bar.id]
        );

        // Log notification
        await conn.query(
          `INSERT INTO permit_expiry_notifications 
           (bar_id, notification_type, permit_expiry_date, email_sent, email_sent_at)
           VALUES (?, '30_day_warning', ?, ?, ?)`,
          [bar.id, bar.permit_expiry_date, emailSent ? 1 : 0, emailSent ? new Date() : null]
        );

        // In-app notification to the bar owner
        try {
          await createNotification({
            userIds: bar.owner_user_id,
            type: "permit_expiry_warning",
            title: "Permit Expiring in 30 Days",
            message: `Your business permit for ${bar.name} expires on ${bar.permit_expiry_date}. Renew it to avoid deactivation.`,
            referenceType: "bar",
            referenceId: bar.id,
            category: "compliance",
            action: "navigate",
            targetRoute: "/bar-management",
          });
        } catch (e) {
          console.error("[Permit Expiry Checker] owner notification failed:", e.message);
        }

        console.log(`[Permit Expiry Checker] Sent 30-day warning to bar: ${bar.name} (${bar.email})`);
      } catch (err) {
        console.error(`[Permit Expiry Checker] Error processing bar ${bar.id}:`, err);
      }
    }

    // 2. Check for permits that expired today (flag as expired)
    const [expiredToday] = await conn.query(
      `SELECT b.id, b.name, b.permit_expiry_date, u.id AS owner_user_id, u.email, u.first_name, u.last_name
       FROM bars b
       JOIN bar_owners bo ON b.owner_id = bo.id
       JOIN users u ON bo.user_id = u.id
       WHERE b.permit_expiry_date <= ?
         AND b.permit_status != 'expired'`,
      [todayStr]
    );

    console.log(`[Permit Expiry Checker] Found ${expiredToday.length} expired permits`);

    for (const bar of expiredToday) {
      try {
        // Update bar status to 'expired'
        await conn.query(
          `UPDATE bars 
           SET permit_status = 'expired', 
               permit_expired_flagged_at = NOW()
           WHERE id = ?`,
          [bar.id]
        );

        // Log notification
        await conn.query(
          `INSERT INTO permit_expiry_notifications 
           (bar_id, notification_type, permit_expiry_date, email_sent)
           VALUES (?, 'expired_flag', ?, 0)`,
          [bar.id, bar.permit_expiry_date]
        );

        // In-app notification to the bar owner
        try {
          await createNotification({
            userIds: bar.owner_user_id,
            type: "permit_expired",
            title: "Business Permit Expired",
            message: `Your business permit for ${bar.name} has expired. Renew it immediately to avoid deactivation.`,
            referenceType: "bar",
            referenceId: bar.id,
            category: "compliance",
            action: "navigate",
            targetRoute: "/bar-management",
          });
        } catch (e) {
          console.error("[Permit Expiry Checker] owner notification failed:", e.message);
        }

        console.log(`[Permit Expiry Checker] Flagged bar as expired: ${bar.name}`);
      } catch (err) {
        console.error(`[Permit Expiry Checker] Error flagging bar ${bar.id}:`, err);
      }
    }

    await conn.commit();
    console.log('[Permit Expiry Checker] Daily check completed successfully');
    
    return {
      success: true,
      expiringSoonCount: expiringSoon.length,
      expiredCount: expiredToday.length
    };
  } catch (err) {
    await conn.rollback();
    console.error('[Permit Expiry Checker] Error:', err);
    throw err;
  } finally {
    conn.release();
  }
}

async function sendPermitExpiryWarning(bar) {
  try {
    const expiryDate = new Date(bar.permit_expiry_date);
    const formattedDate = expiryDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailSubject = '⚠️ Business Permit Expiring Soon - Action Required';
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #CC0000, #8B0000); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .button { display: inline-block; background: #CC0000; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">⚠️ Permit Expiry Warning</h1>
          </div>
          <div class="content">
            <p>Dear ${bar.first_name} ${bar.last_name},</p>
            
            <div class="warning-box">
              <strong>⚠️ Important Notice:</strong> Your business permit for <strong>${bar.name}</strong> is expiring soon.
            </div>
            
            <p><strong>Expiry Date:</strong> ${formattedDate}</p>
            
            <p>To avoid deactivation of your bar listing, please:</p>
            <ol>
              <li>Renew your business permit with the appropriate government agency</li>
              <li>Upload your new permit document to your dashboard</li>
              <li>Update the expiry date in your bar settings</li>
            </ol>
            
            <p><strong>What happens if I don't renew?</strong></p>
            <ul>
              <li>On the expiry date, your bar will be flagged as "Permit Expired"</li>
              <li>The super admin may deactivate your listing</li>
              <li>Customers will not be able to view or book your bar</li>
            </ul>
            
            <center>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/bar-management" class="button">
                Update Permit Now
              </a>
            </center>
            
            <p>If you have already renewed your permit, please upload the new document as soon as possible.</p>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <p>Best regards,<br>The Bar Management Team</p>
          </div>
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(bar.email, emailSubject, emailHtml);
    return true;
  } catch (err) {
    console.error('[Permit Expiry Checker] Error sending email:', err);
    return false;
  }
}

// Manual trigger function (for testing or manual runs)
async function runPermitExpiryCheck() {
  try {
    const result = await checkPermitExpiry();
    console.log('[Permit Expiry Checker] Manual run completed:', result);
    return result;
  } catch (err) {
    console.error('[Permit Expiry Checker] Manual run failed:', err);
    throw err;
  }
}

module.exports = {
  checkPermitExpiry,
  runPermitExpiryCheck
};
