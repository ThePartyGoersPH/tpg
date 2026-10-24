const {
  getPerishableItemsByStatus,
  markInventoryWasted,
  getWastageSummary,
} = require('../services/inventorySpoilageService');
const { logAudit, auditContext } = require('../utils/audit');

function handleError(res, err, fallbackLabel) {
  if (err?.code === 'VALIDATION_ERROR') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err?.code === 'NOT_FOUND') {
    return res.status(404).json({ success: false, message: err.message });
  }
  if (err?.code === 'INSUFFICIENT_STOCK') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err?.code === 'SCHEMA_NOT_READY') {
    return res.status(503).json({ success: false, message: err.message });
  }

  console.error(`${fallbackLabel}:`, err);
  return res.status(500).json({ success: false, message: 'Server error' });
}

async function markWasted(req, res) {
  try {
    const barId = req.user?.bar_id;
    const userId = req.user?.id;
    if (!barId) {
      return res.status(400).json({ success: false, message: 'No bar_id on account' });
    }

    const { item_id, quantity, reason } = req.body || {};

    const result = await markInventoryWasted({
      barId,
      itemId: item_id,
      quantity,
      reason,
      loggedBy: userId,
    });

    logAudit(null, {
      bar_id: barId,
      user_id: userId,
      action: 'MARK_INVENTORY_WASTED',
      entity: 'wastage_logs',
      entity_id: result.wastage_log_id,
      details: {
        item_id: result.item_id,
        item_name: result.item_name,
        quantity_wasted: result.quantity_wasted,
        previous_stock_qty: result.previous_stock_qty,
        current_stock_qty: result.current_stock_qty,
        reason: result.reason,
      },
      ...auditContext(req),
    });

    return res.status(201).json({
      success: true,
      message: 'Inventory wastage logged successfully',
      data: result,
    });
  } catch (err) {
    return handleError(res, err, 'MARK WASTED ERROR');
  }
}

async function getNearExpiry(req, res) {
  try {
    const barId = req.user?.bar_id;
    if (!barId) {
      return res.status(400).json({ success: false, message: 'No bar_id on account' });
    }

    const items = await getPerishableItemsByStatus({
      barId,
      status: 'near_expiry',
    });

    return res.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (err) {
    return handleError(res, err, 'GET NEAR EXPIRY ERROR');
  }
}

async function getSpoiled(req, res) {
  try {
    const barId = req.user?.bar_id;
    if (!barId) {
      return res.status(400).json({ success: false, message: 'No bar_id on account' });
    }

    const items = await getPerishableItemsByStatus({
      barId,
      status: 'spoiled',
    });

    return res.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (err) {
    return handleError(res, err, 'GET SPOILED ERROR');
  }
}

async function getWastageSummaryHandler(req, res) {
  try {
    const barId = req.user?.bar_id;
    if (!barId) {
      return res.status(400).json({ success: false, message: 'No bar_id on account' });
    }

    const summary = await getWastageSummary({ barId });

    return res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    return handleError(res, err, 'GET WASTAGE SUMMARY ERROR');
  }
}

module.exports = {
  markWasted,
  getNearExpiry,
  getSpoiled,
  getWastageSummary: getWastageSummaryHandler,
};
