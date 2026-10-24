const pool = require('../config/database');

const REQUIRED_PERISHABLE_COLUMNS = [
  'is_perishable',
  'expiry_date',
  'shelf_life_days',
  'date_added',
  'status',
];

const REQUIRED_WASTAGE_COLUMNS = [
  'id',
  'item_id',
  'quantity_wasted',
  'reason',
  'date_logged',
  'logged_by',
];

const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000;
let schemaCache = null;
let schemaCacheAt = 0;

function createError(code, message, statusCode = 500) {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeStockStatus(stockQty, reorderLevel) {
  const qty = toNumber(stockQty, 0);
  const reorder = toNumber(reorderLevel, 0);
  if (qty <= 0) return 'critical';
  if (qty < reorder) return 'low';
  return 'normal';
}

async function getSpoilageSchemaStatus(conn = pool) {
  const now = Date.now();
  if (schemaCache && now - schemaCacheAt < SCHEMA_CACHE_TTL_MS) {
    return schemaCache;
  }

  const [inventoryColumns] = await conn.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'inventory_items'
       AND COLUMN_NAME IN (${REQUIRED_PERISHABLE_COLUMNS.map(() => '?').join(',')})`,
    REQUIRED_PERISHABLE_COLUMNS
  );

  const inventoryColumnSet = new Set(inventoryColumns.map((col) => col.COLUMN_NAME));
  const missingInventoryColumns = REQUIRED_PERISHABLE_COLUMNS.filter((col) => !inventoryColumnSet.has(col));

  const [wastageTables] = await conn.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'wastage_logs'`
  );

  const hasWastageTable = wastageTables.length > 0;

  let missingWastageColumns = [];
  if (hasWastageTable) {
    const [wastageColumns] = await conn.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'wastage_logs'
         AND COLUMN_NAME IN (${REQUIRED_WASTAGE_COLUMNS.map(() => '?').join(',')})`,
      REQUIRED_WASTAGE_COLUMNS
    );
    const wastageColumnSet = new Set(wastageColumns.map((col) => col.COLUMN_NAME));
    missingWastageColumns = REQUIRED_WASTAGE_COLUMNS.filter((col) => !wastageColumnSet.has(col));
  }

  schemaCache = {
    hasPerishableColumns: missingInventoryColumns.length === 0,
    missingInventoryColumns,
    hasWastageTable,
    hasWastageColumns: hasWastageTable && missingWastageColumns.length === 0,
    missingWastageColumns,
    ready: missingInventoryColumns.length === 0 && hasWastageTable && missingWastageColumns.length === 0,
  };
  schemaCacheAt = now;

  return schemaCache;
}

function assertSpoilageSchemaReady(schemaStatus) {
  if (schemaStatus.ready) return;

  const missingParts = [];
  if (!schemaStatus.hasPerishableColumns) {
    missingParts.push(...schemaStatus.missingInventoryColumns.map((col) => `inventory_items.${col}`));
  }
  if (!schemaStatus.hasWastageTable) {
    missingParts.push('wastage_logs table');
  }
  if (schemaStatus.hasWastageTable && !schemaStatus.hasWastageColumns) {
    missingParts.push(...schemaStatus.missingWastageColumns.map((col) => `wastage_logs.${col}`));
  }

  throw createError(
    'SCHEMA_NOT_READY',
    `Spoilage/wastage schema is not ready. Missing: ${missingParts.join(', ')}. Run migration 20260408_inventory_spoilage_wastage.sql first.`,
    503
  );
}

function normalizeStatusFilter(status) {
  const value = String(status || '').trim();
  if (value === 'near_expiry' || value === 'spoiled') {
    return value;
  }
  throw createError('VALIDATION_ERROR', 'status must be either near_expiry or spoiled', 400);
}

async function syncPerishableStatuses({ barId = null, conn = pool } = {}) {
  const schemaStatus = await getSpoilageSchemaStatus(conn);
  assertSpoilageSchemaReady(schemaStatus);

  const whereParts = ['is_perishable = 1', 'is_active = 1'];
  const params = [];
  if (barId) {
    whereParts.push('bar_id = ?');
    params.push(barId);
  }

  const whereClause = whereParts.join(' AND ');

  const [updateResult] = await conn.query(
    `UPDATE inventory_items
     SET status = CASE
       WHEN expiry_date IS NOT NULL AND CURDATE() >= expiry_date THEN 'spoiled'
       WHEN shelf_life_days IS NOT NULL
            AND DATEDIFF(CURDATE(), DATE(COALESCE(date_added, created_at, NOW()))) >= shelf_life_days THEN 'spoiled'
       WHEN expiry_date IS NOT NULL
            AND DATEDIFF(expiry_date, CURDATE()) BETWEEN 1 AND 2 THEN 'near_expiry'
       ELSE 'normal'
     END
     WHERE ${whereClause}`,
    params
  );

  const [statusRows] = await conn.query(
    `SELECT status, COUNT(*) AS count
     FROM inventory_items
     WHERE ${whereClause}
     GROUP BY status`,
    params
  );

  const counts = {
    normal: 0,
    near_expiry: 0,
    spoiled: 0,
  };

  for (const row of statusRows) {
    if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
      counts[row.status] = toNumber(row.count, 0);
    }
  }

  return {
    scanned: counts.normal + counts.near_expiry + counts.spoiled,
    updated: toNumber(updateResult.affectedRows, 0),
    counts,
  };
}

async function getPerishableItemsByStatus({ barId, status }) {
  if (!barId) {
    throw createError('VALIDATION_ERROR', 'barId is required', 400);
  }

  const statusFilter = normalizeStatusFilter(status);

  await syncPerishableStatuses({ barId, conn: pool });

  const orderByClause = statusFilter === 'near_expiry'
    ? 'days_to_expiry ASC, name ASC'
    : '(expiry_date IS NULL) ASC, expiry_date ASC, name ASC';

  const [rows] = await pool.query(
    `SELECT id,
            bar_id,
            name,
            unit,
            stock_qty,
            reorder_level,
            cost_price,
            stock_status,
            image_path,
            is_perishable,
            expiry_date,
            shelf_life_days,
            date_added,
            status,
            DATEDIFF(expiry_date, CURDATE()) AS days_to_expiry,
            CASE
              WHEN shelf_life_days IS NULL OR COALESCE(date_added, created_at) IS NULL THEN NULL
              ELSE GREATEST(shelf_life_days - DATEDIFF(CURDATE(), DATE(COALESCE(date_added, created_at))), 0)
            END AS shelf_life_days_left
     FROM inventory_items
     WHERE bar_id = ?
       AND is_active = 1
       AND is_perishable = 1
       AND status = ?
     ORDER BY ${orderByClause}`,
    [barId, statusFilter]
  );

  return rows;
}

async function markInventoryWasted({ barId, itemId, quantity, reason, loggedBy }) {
  if (!barId) throw createError('VALIDATION_ERROR', 'barId is required', 400);
  if (!loggedBy) throw createError('VALIDATION_ERROR', 'loggedBy is required', 400);

  const parsedItemId = Number(itemId);
  const parsedQty = Number(quantity);
  const parsedReason = String(reason || '').trim();

  if (!Number.isInteger(parsedItemId) || parsedItemId <= 0) {
    throw createError('VALIDATION_ERROR', 'item_id must be a positive integer', 400);
  }
  if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
    throw createError('VALIDATION_ERROR', 'quantity must be greater than 0', 400);
  }
  if (!parsedReason) {
    throw createError('VALIDATION_ERROR', 'reason is required', 400);
  }
  if (parsedReason.length > 255) {
    throw createError('VALIDATION_ERROR', 'reason must be 255 characters or less', 400);
  }

  const schemaStatus = await getSpoilageSchemaStatus(pool);
  assertSpoilageSchemaReady(schemaStatus);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [items] = await conn.query(
      `SELECT id,
              bar_id,
              name,
              stock_qty,
              reorder_level,
              cost_price,
              is_perishable,
              status
       FROM inventory_items
       WHERE id = ? AND bar_id = ?
       LIMIT 1
       FOR UPDATE`,
      [parsedItemId, barId]
    );

    if (!items.length) {
      throw createError('NOT_FOUND', 'Inventory item not found', 404);
    }

    const item = items[0];
    const currentStock = toNumber(item.stock_qty, 0);
    if (parsedQty > currentStock) {
      throw createError('INSUFFICIENT_STOCK', 'Wastage quantity exceeds current stock', 400);
    }

    const newStockQty = currentStock - parsedQty;
    const newStockStatus = computeStockStatus(newStockQty, item.reorder_level);

    let newSpoilageStatus = String(item.status || 'normal');
    const lowerReason = parsedReason.toLowerCase();
    if (Number(item.is_perishable) === 1 && (lowerReason.includes('spoil') || lowerReason.includes('expire'))) {
      newSpoilageStatus = 'spoiled';
    }

    await conn.query(
      `UPDATE inventory_items
       SET stock_qty = ?,
           stock_status = ?,
           status = ?
       WHERE id = ? AND bar_id = ?`,
      [newStockQty, newStockStatus, newSpoilageStatus, parsedItemId, barId]
    );

    const [insertResult] = await conn.query(
      `INSERT INTO wastage_logs (item_id, quantity_wasted, reason, date_logged, logged_by)
       VALUES (?, ?, ?, NOW(), ?)`,
      [parsedItemId, parsedQty, parsedReason, loggedBy]
    );

    await conn.commit();

    return {
      wastage_log_id: insertResult.insertId,
      item_id: parsedItemId,
      item_name: item.name,
      quantity_wasted: parsedQty,
      previous_stock_qty: currentStock,
      current_stock_qty: newStockQty,
      stock_status: newStockStatus,
      spoilage_status: newSpoilageStatus,
      reason: parsedReason,
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // no-op
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function getWastageSummary({ barId }) {
  if (!barId) {
    throw createError('VALIDATION_ERROR', 'barId is required', 400);
  }

  const schemaStatus = await getSpoilageSchemaStatus(pool);
  assertSpoilageSchemaReady(schemaStatus);

  const [weeklyRows] = await pool.query(
    `SELECT COALESCE(SUM(w.quantity_wasted), 0) AS total_wasted_quantity,
            COALESCE(COUNT(w.id), 0) AS total_wastage_entries,
            COALESCE(SUM(w.quantity_wasted * COALESCE(i.cost_price, 0)), 0) AS estimated_loss
     FROM wastage_logs w
     JOIN inventory_items i ON i.id = w.item_id
     WHERE i.bar_id = ?
       AND w.date_logged >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    [barId]
  );

  const [monthlyRows] = await pool.query(
    `SELECT COALESCE(SUM(w.quantity_wasted), 0) AS total_wasted_quantity,
            COALESCE(COUNT(w.id), 0) AS total_wastage_entries,
            COALESCE(SUM(w.quantity_wasted * COALESCE(i.cost_price, 0)), 0) AS estimated_loss
     FROM wastage_logs w
     JOIN inventory_items i ON i.id = w.item_id
     WHERE i.bar_id = ?
       AND w.date_logged >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [barId]
  );

  const [topRows] = await pool.query(
    `SELECT i.id AS item_id,
            i.name,
            i.unit,
            SUM(w.quantity_wasted) AS total_wasted_quantity,
            COALESCE(SUM(w.quantity_wasted * COALESCE(i.cost_price, 0)), 0) AS estimated_loss
     FROM wastage_logs w
     JOIN inventory_items i ON i.id = w.item_id
     WHERE i.bar_id = ?
       AND w.date_logged >= DATE_SUB(NOW(), INTERVAL 30 DAY)
     GROUP BY i.id, i.name, i.unit
     ORDER BY total_wasted_quantity DESC, estimated_loss DESC
     LIMIT 5`,
    [barId]
  );

  const weekly = weeklyRows[0] || {};
  const monthly = monthlyRows[0] || {};

  return {
    weekly: {
      total_wasted_quantity: toNumber(weekly.total_wasted_quantity, 0),
      total_wastage_entries: toNumber(weekly.total_wastage_entries, 0),
      estimated_loss: toNumber(weekly.estimated_loss, 0),
    },
    monthly: {
      total_wasted_quantity: toNumber(monthly.total_wasted_quantity, 0),
      total_wastage_entries: toNumber(monthly.total_wastage_entries, 0),
      estimated_loss: toNumber(monthly.estimated_loss, 0),
    },
    top_wasted_items: topRows.map((row) => ({
      item_id: row.item_id,
      name: row.name,
      unit: row.unit,
      total_wasted_quantity: toNumber(row.total_wasted_quantity, 0),
      estimated_loss: toNumber(row.estimated_loss, 0),
    })),
  };
}

function invalidateSchemaCache() {
  schemaCache = null;
  schemaCacheAt = 0;
}

module.exports = {
  getSpoilageSchemaStatus,
  syncPerishableStatuses,
  getPerishableItemsByStatus,
  markInventoryWasted,
  getWastageSummary,
  invalidateSchemaCache,
};
