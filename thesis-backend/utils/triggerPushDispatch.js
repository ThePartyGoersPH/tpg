const { processNotificationPushQueue } = require('../jobs/notificationPushDispatcher');

let isDispatching = false;
let hasQueuedRun = false;

function triggerPushDispatch(reason = 'manual') {
  if (isDispatching) {
    hasQueuedRun = true;
    return;
  }

  isDispatching = true;

  setImmediate(async () => {
    try {
      const result = await processNotificationPushQueue();
      if (result && !result.skipped && result.processed > 0) {
        console.log(
          `[PushDispatch] reason=${reason} processed=${result.processed} sent=${result.sent} failed=${result.failed}`
        );
      }
    } catch (err) {
      console.error('[PushDispatch] Failed to process notification queue:', err?.message || err);
    } finally {
      isDispatching = false;
      if (hasQueuedRun) {
        hasQueuedRun = false;
        triggerPushDispatch('queued');
      }
    }
  });
}

module.exports = {
  triggerPushDispatch,
};
