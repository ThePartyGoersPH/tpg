const cron = require('node-cron');
const { checkPermitExpiry } = require('./permitExpiryChecker');
const { processNotificationPushQueue } = require('./notificationPushDispatcher');
const { checkInventorySpoilage } = require('./inventorySpoilageChecker');
const { checkComplianceGrace } = require('./complianceGraceChecker');

let lastPushSkipReason = null;

/**
 * Job Scheduler
 * Manages all scheduled background jobs
 */

function startScheduler() {
  console.log('[Scheduler] Starting background jobs...');

  // Try one pass on startup so queued notifications are flushed quickly.
  processNotificationPushQueue().then((result) => {
    if (result?.skipped && result.reason) {
      lastPushSkipReason = result.reason;
      console.warn(`[Scheduler] Initial push dispatch skipped: ${result.reason}`);
    }
  }).catch((err) => {
    console.error('[Scheduler] Initial push dispatch failed:', err);
  });

  // Try one pass on startup to align spoilage statuses immediately.
  checkInventorySpoilage().then((result) => {
    if (result?.skipped && result.reason) {
      console.warn(`[Scheduler] Initial spoilage detection skipped: ${result.reason}`);
    }
  }).catch((err) => {
    console.error('[Scheduler] Initial spoilage detection failed:', err);
  });

  // Try one pass on startup so a grace window that lapsed while the server
  // was down still hides the bar promptly.
  checkComplianceGrace().catch((err) => {
    console.error('[Scheduler] Initial compliance grace check failed:', err);
  });

  // Run permit expiry checker daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Running permit expiry check...');
    try {
      await checkPermitExpiry();
    } catch (err) {
      console.error('[Scheduler] Permit expiry check failed:', err);
    }
  }, {
    timezone: 'Asia/Manila'
  });

  // Run inventory spoilage checker daily at 1:30 AM (before permit check).
  cron.schedule('30 1 * * *', async () => {
    console.log('[Scheduler] Running inventory spoilage check...');
    try {
      await checkInventorySpoilage();
    } catch (err) {
      console.error('[Scheduler] Inventory spoilage check failed:', err);
    }
  }, {
    timezone: 'Asia/Manila'
  });

  // Dispatch push notifications every minute.
  cron.schedule('* * * * *', async () => {
    try {
      const result = await processNotificationPushQueue();
      if (result?.skipped) {
        if (result.reason && result.reason !== lastPushSkipReason) {
          console.warn(`[Scheduler] Push dispatch skipped: ${result.reason}`);
        }
        lastPushSkipReason = result.reason || lastPushSkipReason;
        return;
      }

      lastPushSkipReason = null;
      if (result && !result.skipped && result.processed > 0) {
        console.log(
          `[Scheduler] Push dispatch: processed=${result.processed}, sent=${result.sent}, failed=${result.failed}, deactivated_tokens=${result.deactivated_tokens}`
        );
      }
    } catch (err) {
      console.error('[Scheduler] Push dispatch failed:', err);
    }
  }, {
    timezone: 'Asia/Manila'
  });

  // Auto-hide bars whose 3-day compliance grace window has expired.
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkComplianceGrace();
    } catch (err) {
      console.error('[Scheduler] Compliance grace check failed:', err);
    }
  }, {
    timezone: 'Asia/Manila'
  });

  console.log('[Scheduler] Permit expiry checker scheduled (daily at 2:00 AM PHT)');
  console.log('[Scheduler] Inventory spoilage checker scheduled (daily at 1:30 AM PHT)');
  console.log('[Scheduler] Push dispatcher scheduled (every minute)');
  console.log('[Scheduler] Compliance grace checker scheduled (every 5 minutes)');
}

module.exports = { startScheduler };
