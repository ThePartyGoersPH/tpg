const { syncPerishableStatuses } = require('../services/inventorySpoilageService');

async function checkInventorySpoilage() {
  console.log('[Inventory Spoilage Checker] Starting daily spoilage detection...');

  try {
    const result = await syncPerishableStatuses();
    console.log(
      `[Inventory Spoilage Checker] Completed: scanned=${result.scanned}, updated=${result.updated}, normal=${result.counts.normal}, near_expiry=${result.counts.near_expiry}, spoiled=${result.counts.spoiled}`
    );
    return {
      success: true,
      ...result,
    };
  } catch (err) {
    if (err?.code === 'SCHEMA_NOT_READY') {
      console.warn(`[Inventory Spoilage Checker] Skipped: ${err.message}`);
      return {
        success: false,
        skipped: true,
        reason: 'schema_not_ready',
        message: err.message,
      };
    }

    console.error('[Inventory Spoilage Checker] Failed:', err);
    throw err;
  }
}

async function runInventorySpoilageCheck() {
  try {
    const result = await checkInventorySpoilage();
    console.log('[Inventory Spoilage Checker] Manual run completed:', result);
    return result;
  } catch (err) {
    console.error('[Inventory Spoilage Checker] Manual run failed:', err);
    throw err;
  }
}

module.exports = {
  checkInventorySpoilage,
  runInventorySpoilageCheck,
};
