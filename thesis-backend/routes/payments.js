const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const { requireBarOrderAccess } = require("../middlewares/requireBarOrder");
const paymongoService = require("../services/paymongoService");
const stripeService = require("../services/stripeService");
const platformSettings = require("../services/platformSettingsService");
const { logAudit, auditContext } = require("../utils/audit");
const { decryptField } = require("../services/fieldEncryption");
const { resolveMenuSaleUnits } = require("../services/inventoryUnits");

let _hasPaymentLineItemsTable = null;
let _hasReservationPaymentTransactionId = null;
let _hasSettlementColumns = null;
let _reservationPaymentStatusColumnType = null;
let _reservationPaymentMethodColumnType = null;
let _reservationStatusColumnType = null;
let _paymentTransactionStatusColumnType = null;
let _paymentLineItemTypeColumnType = null;

async function hasSettlementColumns(conn) {
  if (_hasSettlementColumns !== null) return _hasSettlementColumns;
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS found
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'payment_transactions'
       AND COLUMN_NAME IN ('settled_directly', 'settlement_rail')`
  );
  _hasSettlementColumns = Number(rows?.[0]?.found || 0) === 2;
  return _hasSettlementColumns;
}

/**
 * A payment that already settled straight to the bar owner (own PayMongo keys,
 * PayMongo child-merchant split, or a Stripe Connect destination charge) must
 * never produce a payout row — the platform does not hold those funds, so a
 * payout would pay the bar owner twice.
 */
function isSettledDirectly(payment) {
  if (Number(payment?.settled_directly || 0) === 1) return true;
  const metadata = safeParseJson(payment?.metadata) || {};
  if (String(metadata.provider || '').toLowerCase() === 'stripe') return true;
  const livePath = String(metadata.live_path || '').toLowerCase();
  if (livePath === 'owner_keys_direct' || livePath === 'child_split') return true;
  return Boolean(metadata.stripe_split);
}

/**
 * Resolve which PayMongo/Stripe credentials a stored transaction must be
 * re-read with. Live rails must never fall back to platform test keys, and
 * owner-key rails must use the bar owner's own key.
 */
async function resolvePaymentKeyContext(conn, payment) {
  const metadata = safeParseJson(payment?.metadata) || {};

  if (String(payment?.payment_provider || metadata.provider || '').toLowerCase() === 'stripe') {
    return { provider: 'stripe', keyMode: null, keyOverride: null };
  }

  const keyMode = String(metadata.paymongo_key_mode || '').toLowerCase() === 'live' ? 'live' : 'test';
  let keyOverride = null;
  if (keyMode === 'live' && payment?.bar_id) {
    const [[bar]] = await conn.query(
      "SELECT paymongo_live_secret_key FROM bars WHERE id = ? LIMIT 1",
      [payment.bar_id]
    );
    keyOverride = bar?.paymongo_live_secret_key
      ? decryptField(bar.paymongo_live_secret_key)
      : null;
  }

  // Fail closed. A payment that settled through the bar's own live key cannot be
  // re-read with platform credentials: the platform never saw it, so every call
  // would 404 — or worse, be looked up against the wrong account. Surface the
  // misconfiguration instead of silently querying the wrong ledger.
  const livePath = String(metadata.live_path || '').toLowerCase();
  if (livePath === 'owner_keys_direct' && !keyOverride) {
    throw new Error(
      `PayMongo live key for bar ${payment.bar_id} is not configured, cannot reconcile payment ${payment.reference_id || payment.id}`
    );
  }

  return { provider: 'paymongo', keyMode, keyOverride };
}

async function hasPaymentLineItemsTable(conn) {
  if (_hasPaymentLineItemsTable !== null) return _hasPaymentLineItemsTable;
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'payment_line_items'
     LIMIT 1`
  );
  _hasPaymentLineItemsTable = rows.length > 0;
  return _hasPaymentLineItemsTable;
}

async function hasReservationPaymentTransactionIdColumn(conn) {
  if (_hasReservationPaymentTransactionId !== null) return _hasReservationPaymentTransactionId;
  const [rows] = await conn.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'reservations'
       AND COLUMN_NAME = 'payment_transaction_id'
     LIMIT 1`
  );
  _hasReservationPaymentTransactionId = rows.length > 0;
  return _hasReservationPaymentTransactionId;
}

async function getColumnType(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows[0]?.COLUMN_TYPE || null;
}

async function getReservationPaymentStatusColumnType(conn) {
  if (_reservationPaymentStatusColumnType !== null) return _reservationPaymentStatusColumnType;
  _reservationPaymentStatusColumnType = await getColumnType(conn, 'reservations', 'payment_status');
  return _reservationPaymentStatusColumnType;
}

async function getReservationPaymentMethodColumnType(conn) {
  if (_reservationPaymentMethodColumnType !== null) return _reservationPaymentMethodColumnType;
  _reservationPaymentMethodColumnType = await getColumnType(conn, 'reservations', 'payment_method');
  return _reservationPaymentMethodColumnType;
}

async function getReservationStatusColumnType(conn) {
  if (_reservationStatusColumnType !== null) return _reservationStatusColumnType;
  _reservationStatusColumnType = await getColumnType(conn, 'reservations', 'status');
  return _reservationStatusColumnType;
}

async function getPaymentTransactionStatusColumnType(conn) {
  if (_paymentTransactionStatusColumnType !== null) return _paymentTransactionStatusColumnType;
  _paymentTransactionStatusColumnType = await getColumnType(conn, 'payment_transactions', 'status');
  return _paymentTransactionStatusColumnType;
}

async function getPaymentLineItemTypeColumnType(conn) {
  if (_paymentLineItemTypeColumnType !== null) return _paymentLineItemTypeColumnType;
  _paymentLineItemTypeColumnType = await getColumnType(conn, 'payment_line_items', 'item_type');
  return _paymentLineItemTypeColumnType;
}

function enumTypeHasValue(columnType, value) {
  const normalizedType = String(columnType || '').toLowerCase();
  const normalizedValue = String(value || '').toLowerCase();
  if (!normalizedType || !normalizedValue) return false;
  return normalizedType.includes(`'${normalizedValue}'`);
}

async function normalizeReservationPaymentStatusForStorage(conn, paymentStatus) {
  const normalized = String(paymentStatus || '').toLowerCase().trim();
  if (!normalized) return null;

  const columnType = await getReservationPaymentStatusColumnType(conn);
  if (!columnType) return normalized;
  if (enumTypeHasValue(columnType, normalized)) return normalized;
  if (normalized === 'partial' && enumTypeHasValue(columnType, 'paid')) return 'paid';
  if (normalized === 'cancelled' && enumTypeHasValue(columnType, 'failed')) return 'failed';
  if (enumTypeHasValue(columnType, 'pending')) return 'pending';
  return null;
}

async function normalizeReservationPaymentMethodForStorage(conn, paymentMethod) {
  const normalized = String(paymentMethod || '').toLowerCase().trim();
  if (!normalized) return null;

  const columnType = await getReservationPaymentMethodColumnType(conn);
  if (!columnType) return normalized;
  if (enumTypeHasValue(columnType, normalized)) return normalized;
  if (enumTypeHasValue(columnType, 'other')) return 'other';
  if (enumTypeHasValue(columnType, 'gcash')) return 'gcash';
  if (enumTypeHasValue(columnType, 'cash')) return 'cash';
  return null;
}

async function normalizeReservationStatusForStorage(conn, reservationStatus) {
  const normalized = String(reservationStatus || '').toLowerCase().trim();
  if (!normalized) return null;

  const columnType = await getReservationStatusColumnType(conn);
  if (!columnType) return normalized;
  if (enumTypeHasValue(columnType, normalized)) return normalized;
  if (normalized === 'cancelled' && enumTypeHasValue(columnType, 'rejected')) return 'rejected';
  if (enumTypeHasValue(columnType, 'pending')) return 'pending';
  return null;
}

async function normalizePaymentTransactionStatusForStorage(conn, paymentStatus) {
  const normalized = String(paymentStatus || '').toLowerCase().trim();
  if (!normalized) return null;

  const columnType = await getPaymentTransactionStatusColumnType(conn);
  if (!columnType) return normalized;
  if (enumTypeHasValue(columnType, normalized)) return normalized;
  if (normalized === 'cancelled' && enumTypeHasValue(columnType, 'failed')) return 'failed';
  if (normalized === 'failed' && enumTypeHasValue(columnType, 'cancelled')) return 'cancelled';
  if (normalized === 'pending' && enumTypeHasValue(columnType, 'pending')) return 'pending';
  if (enumTypeHasValue(columnType, 'failed')) return 'failed';
  if (enumTypeHasValue(columnType, 'pending')) return 'pending';
  if (enumTypeHasValue(columnType, 'paid')) return 'paid';
  return null;
}

function formatTo12HourTime(rawTime) {
  const t = String(rawTime || '').trim();
  if (!t) return '';

  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return t;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return t;

  const d = new Date(Date.UTC(2000, 0, 1, hour, minute, 0));
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

async function normalizePaymentLineItemTypeForStorage(conn, itemType) {
  const normalized = String(itemType || '').toLowerCase().trim() || 'other';

  const columnType = await getPaymentLineItemTypeColumnType(conn);
  if (!columnType) return normalized;
  if (enumTypeHasValue(columnType, normalized)) return normalized;
  if (enumTypeHasValue(columnType, 'other')) return 'other';
  return normalized;
}

function parseReservationOrderItems(notes) {
  if (!notes) return [];
  const m = String(notes).match(/Order:\s*(.+?)(?:\s*\|\|\s*Packages:|$)/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const qtyMatch = entry.match(/(.+?)\s*x\s*(\d+)$/i);
      if (!qtyMatch) return { name: entry, quantity: 1 };
      return {
        name: qtyMatch[1].trim(),
        quantity: Number(qtyMatch[2]) || 1,
      };
    });
}

function parseReservationPackageItems(notes) {
  if (!notes) return [];
  const m = String(notes).match(/Packages:\s*(.+)$/i);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const structuredMatch = entry.match(/^pkg_(\d+)::(.+?)\s*x\s*(\d+)$/i);
      if (structuredMatch) {
        return {
          package_id: Number(structuredMatch[1]) || null,
          name: structuredMatch[2].trim(),
          quantity: Number(structuredMatch[3]) || 1,
        };
      }

      const qtyMatch = entry.match(/(.+?)\s*x\s*(\d+)$/i);
      if (!qtyMatch) return { package_id: null, name: entry, quantity: 1 };
      return {
        package_id: null,
        name: qtyMatch[1].trim(),
        quantity: Number(qtyMatch[2]) || 1,
      };
    });
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

async function resolveMenuInventoryItemId(conn, barId, menuItemId, itemName) {
  if (Number(menuItemId) > 0) {
    const [[menuRow]] = await conn.query(
      `SELECT inventory_item_id
       FROM menu_items
       WHERE id = ? AND bar_id = ?
       LIMIT 1`,
      [menuItemId, barId]
    );
    if (menuRow?.inventory_item_id) return Number(menuRow.inventory_item_id);
  }

  if (!itemName) return null;

  const [[menuRowByName]] = await conn.query(
    `SELECT inventory_item_id
     FROM menu_items
     WHERE bar_id = ? AND LOWER(menu_name) = LOWER(?)
     ORDER BY id DESC
     LIMIT 1`,
    [barId, itemName]
  );

  return menuRowByName?.inventory_item_id ? Number(menuRowByName.inventory_item_id) : null;
}

async function resolveInventoryItemIdByName(conn, barId, itemName) {
  if (!itemName) return null;

  const [[row]] = await conn.query(
    `SELECT i.id AS inventory_item_id
     FROM inventory_items i
     LEFT JOIN menu_items m ON m.inventory_item_id = i.id AND m.bar_id = ?
     WHERE i.bar_id = ?
       AND (LOWER(i.name) = LOWER(?) OR LOWER(m.menu_name) = LOWER(?))
     ORDER BY CASE WHEN LOWER(m.menu_name) = LOWER(?) THEN 0 ELSE 1 END, i.id ASC
     LIMIT 1`,
    [barId, barId, itemName, itemName, itemName]
  );

  return row?.inventory_item_id ? Number(row.inventory_item_id) : null;
}

async function appendPackageInventoryDeductions(conn, barId, packageId, packageName, packageQuantity, totalsMap, coveredNames) {
  const qty = Number(packageQuantity || 0);
  if (!qty) return false;

  let pkg = null;

  if (Number(packageId) > 0) {
    const [[pkgRow]] = await conn.query(
      `SELECT id, name
       FROM bar_packages
       WHERE id = ? AND bar_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [packageId, barId]
    );
    pkg = pkgRow || null;
  }

  if (!pkg && packageName) {
    const [[pkgRowByName]] = await conn.query(
      `SELECT id, name
       FROM bar_packages
       WHERE bar_id = ? AND deleted_at IS NULL AND LOWER(name) = LOWER(?)
       ORDER BY id DESC
       LIMIT 1`,
      [barId, packageName]
    );
    pkg = pkgRowByName || null;
  }

  if (!pkg?.id) return false;

  const [inclusions] = await conn.query(
    `SELECT item_name, quantity
     FROM package_inclusions
     WHERE package_id = ?
     ORDER BY id ASC`,
    [pkg.id]
  );

  for (const inclusion of inclusions) {
    const inventoryItemId = await resolveInventoryItemIdByName(conn, barId, inclusion.item_name);
    if (!inventoryItemId) continue;
    const inclusionQty = Number(inclusion.quantity || 0) * qty;
    if (!inclusionQty) continue;
    totalsMap.set(inventoryItemId, (totalsMap.get(inventoryItemId) || 0) + inclusionQty);
  }

  if (coveredNames && pkg.name) {
    coveredNames.add(String(pkg.name).toLowerCase().trim());
  }

  return true;
}

async function upsertPaymentLineItems(conn, paymentId, lineItems) {
  if (!(await hasPaymentLineItemsTable(conn))) return;
  await conn.query("DELETE FROM payment_line_items WHERE payment_transaction_id = ?", [paymentId]);
  for (const item of lineItems) {
    const storedItemType = await normalizePaymentLineItemTypeForStorage(conn, item.item_type);
    const metadata = item.metadata ? { ...item.metadata } : {};
    if (storedItemType !== item.item_type && item.item_type) {
      metadata.line_kind = item.item_type;
    }
    await conn.query(
      `INSERT INTO payment_line_items
       (payment_transaction_id, item_type, item_name, quantity, unit_price, line_total, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId,
        storedItemType,
        item.item_name,
        Number(item.quantity || 1),
        Number(item.unit_price || 0),
        Number(item.line_total || 0),
        Object.keys(metadata).length ? JSON.stringify(metadata) : null,
      ]
    );
  }
}

async function buildOrderLineItems(conn, orderId) {
  const [rows] = await conn.query(
    `SELECT item_name, quantity, unit_price, subtotal
     FROM pos_order_items
     WHERE order_id = ?
     ORDER BY id ASC`,
    [orderId]
  );

  return rows.map((r) => ({
    item_type: "menu",
    item_name: r.item_name,
    quantity: Number(r.quantity || 1),
    unit_price: Number(r.unit_price || 0),
    line_total: Number(r.subtotal || 0),
    metadata: null,
  }));
}

async function buildReservationLineItems(conn, reservation) {
  const lineItems = [];

  const tablePrice = Number(reservation.table_price || 0);
  if (tablePrice > 0) {
    lineItems.push({
      item_type: "table",
      item_name: reservation.table_number ? `Table #${reservation.table_number}` : "Table Reservation",
      quantity: 1,
      unit_price: tablePrice,
      line_total: tablePrice,
      metadata: {
        table_id: reservation.table_id,
        reservation_id: reservation.id,
      },
    });
  }

  // First try to fetch from reservation_items table
  const [riCheck] = await conn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation_items' LIMIT 1`
  );

  if (riCheck.length) {
    const [reservationItems] = await conn.query(
      `SELECT ri.menu_item_id, COALESCE(m.menu_name, CONCAT('Item #', ri.menu_item_id)) AS menu_name,
              ri.quantity, ri.unit_price,
              (ri.quantity * ri.unit_price) AS line_total
       FROM reservation_items ri
       LEFT JOIN menu_items m ON m.id = ri.menu_item_id
       WHERE ri.reservation_id = ?
       ORDER BY COALESCE(m.menu_name, 'zzz')`,
      [reservation.id]
    );

    for (const item of reservationItems) {
      lineItems.push({
        item_type: "menu",
        item_name: item.menu_name,
        quantity: Number(item.quantity || 1),
        unit_price: Number(item.unit_price || 0),
        line_total: Number(item.line_total || 0),
        metadata: {
          reservation_id: reservation.id,
          menu_item_id: item.menu_item_id,
        },
      });
    }

    // Supplement with any items from notes not already in results
    if (reservation.notes) {
      const coveredNames = new Set(lineItems.filter(i => i.item_type === 'menu').map(i => (i.item_name || '').toLowerCase().trim()));
      const parsedItems = parseReservationOrderItems(reservation.notes);
      for (const it of parsedItems) {
        if (coveredNames.has(it.name.toLowerCase().trim())) continue;
        const [menuRows] = await conn.query(
          `SELECT selling_price FROM menu_items WHERE bar_id = ? AND LOWER(menu_name) = LOWER(?) ORDER BY id DESC LIMIT 1`,
          [reservation.bar_id, it.name]
        );
        const unitPrice = Number(menuRows[0]?.selling_price || 0);
        if (unitPrice > 0) {
          lineItems.push({
            item_type: "menu",
            item_name: it.name,
            quantity: Number(it.quantity || 1),
            unit_price: unitPrice,
            line_total: unitPrice * Number(it.quantity || 1),
            metadata: { reservation_id: reservation.id },
          });
          coveredNames.add(it.name.toLowerCase().trim());
          continue;
        }

        const [[pkgRow]] = await conn.query(
          `SELECT id, name, price
           FROM bar_packages
           WHERE bar_id = ? AND deleted_at IS NULL AND LOWER(name) = LOWER(?)
           ORDER BY id DESC
           LIMIT 1`,
          [reservation.bar_id, it.name]
        );
        if (!pkgRow?.id) continue;

        lineItems.push({
          item_type: "package",
          item_name: pkgRow.name,
          quantity: Number(it.quantity || 1),
          unit_price: Number(pkgRow.price || 0),
          line_total: Number(pkgRow.price || 0) * Number(it.quantity || 1),
          metadata: {
            reservation_id: reservation.id,
            package_id: pkgRow.id,
          },
        });
        coveredNames.add(String(pkgRow.name || '').toLowerCase().trim());
      }

      const parsedPackages = parseReservationPackageItems(reservation.notes);
      for (const pkg of parsedPackages) {
        if (coveredNames.has(pkg.name.toLowerCase().trim())) continue;
        const [[pkgRow]] = await conn.query(
          `SELECT id, name, price
           FROM bar_packages
           WHERE bar_id = ? AND deleted_at IS NULL AND (id = ? OR LOWER(name) = LOWER(?))
           ORDER BY id DESC
           LIMIT 1`,
          [reservation.bar_id, Number(pkg.package_id || 0), pkg.name]
        );
        if (!pkgRow?.id) continue;

        lineItems.push({
          item_type: "package",
          item_name: pkgRow.name,
          quantity: Number(pkg.quantity || 1),
          unit_price: Number(pkgRow.price || 0),
          line_total: Number(pkgRow.price || 0) * Number(pkg.quantity || 1),
          metadata: {
            reservation_id: reservation.id,
            package_id: pkgRow.id,
          },
        });
        coveredNames.add(String(pkgRow.name || '').toLowerCase().trim());
      }
    }
  } else {
    // Fallback: parse from notes if reservation_items table doesn't exist
    const coveredNames = new Set();
    const parsedItems = parseReservationOrderItems(reservation.notes);
    for (const it of parsedItems) {
      const [menuRows] = await conn.query(
        `SELECT selling_price
         FROM menu_items
         WHERE bar_id = ? AND LOWER(menu_name) = LOWER(?)
         ORDER BY id DESC
         LIMIT 1`,
        [reservation.bar_id, it.name]
      );
      const unitPrice = Number(menuRows[0]?.selling_price || 0);
      lineItems.push({
        item_type: "menu",
        item_name: it.name,
        quantity: Number(it.quantity || 1),
        unit_price: unitPrice,
        line_total: unitPrice * Number(it.quantity || 1),
        metadata: {
          reservation_id: reservation.id,
        },
      });
      coveredNames.add(it.name.toLowerCase().trim());
    }

    const parsedPackages = parseReservationPackageItems(reservation.notes);
    for (const pkg of parsedPackages) {
      if (coveredNames.has(pkg.name.toLowerCase().trim())) continue;
      const [[pkgRow]] = await conn.query(
        `SELECT id, name, price
         FROM bar_packages
         WHERE bar_id = ? AND deleted_at IS NULL AND (id = ? OR LOWER(name) = LOWER(?))
         ORDER BY id DESC
         LIMIT 1`,
        [reservation.bar_id, Number(pkg.package_id || 0), pkg.name]
      );
      if (!pkgRow?.id) continue;

      lineItems.push({
        item_type: "package",
        item_name: pkgRow.name,
        quantity: Number(pkg.quantity || 1),
        unit_price: Number(pkgRow.price || 0),
        line_total: Number(pkgRow.price || 0) * Number(pkg.quantity || 1),
        metadata: {
          reservation_id: reservation.id,
          package_id: pkgRow.id,
        },
      });
    }
  }

  return lineItems;
}

function normalizePaymentRow(payment, lineItemsByPaymentId) {
  const items = lineItemsByPaymentId.get(payment.id) || [];
  const tableItem = items.find((i) => String((safeParseJson(i.metadata) || {}).line_kind || i.item_type || '').toLowerCase() === "table") || null;
  const menuItems = items.filter((i) => {
    const lineKind = String((safeParseJson(i.metadata) || {}).line_kind || i.item_type || '').toLowerCase();
    return lineKind === "menu" || lineKind === "package";
  });

  const totalFromLineItems = items.reduce((sum, i) => sum + Number(i.line_total || 0), 0);
  const paidAmount = Number(payment.amount || 0);
  const totalOrderAmount = totalFromLineItems > paidAmount ? totalFromLineItems : 0;
  const remainingBalance = totalOrderAmount > 0 ? Math.max(0, totalOrderAmount - paidAmount) : 0;

  return {
    ...payment,
    table_price: tableItem ? Number(tableItem.line_total || 0) : 0,
    menu_items: menuItems,
    line_items: items,
    ...(totalOrderAmount > 0 ? { total_order_amount: totalOrderAmount, remaining_balance: remainingBalance } : {}),
  };
}

async function createPayoutForPayment(conn, payment) {
  if (!payment.bar_id) return;

  // Direct rails already paid the bar owner through the provider.
  if (isSettledDirectly(payment)) return;

  const [existingPayout] = await conn.query(
    "SELECT id FROM payouts WHERE payment_transaction_id = ? LIMIT 1",
    [payment.id]
  );
  if (existingPayout.length) return;

  const [barRows] = await conn.query(
    "SELECT gcash_number, gcash_account_name, payout_enabled FROM bars WHERE id = ? LIMIT 1",
    [payment.bar_id]
  );
  if (!barRows.length) return;
  if (Number(barRows[0].payout_enabled || 0) !== 1) {
    console.warn(`PAYOUT_SKIPPED bar=${payment.bar_id} payment=${payment.id}: payouts disabled for this bar`);
    return;
  }

  const feePercentage = await platformSettings.getPlatformFeePercentage(conn);

  const grossAmount = Number(payment.amount || 0);
  const platformFeeAmount = (grossAmount * feePercentage) / 100;
  const netAmount = grossAmount - platformFeeAmount;

  const [ownerRows] = await conn.query(
    `SELECT bo.id AS owner_id
     FROM bars b
     LEFT JOIN bar_owners bo ON bo.id = b.owner_id
     WHERE b.id = ?
     LIMIT 1`,
    [payment.bar_id]
  );

  try {
    await conn.query(
      `INSERT INTO payouts
       (bar_id, bar_owner_id, payment_transaction_id, order_id, reservation_id, gross_amount,
        platform_fee, platform_fee_amount, net_amount, status, payout_method,
        gcash_number, gcash_account_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'gcash', ?, ?)`,
      [
        payment.bar_id,
        ownerRows[0]?.owner_id || null,
        payment.id,
        payment.payment_type === 'order' ? payment.related_id : null,
        payment.payment_type === 'reservation' ? payment.related_id : null,
        grossAmount,
        feePercentage,
        platformFeeAmount,
        netAmount,
        barRows[0].gcash_number || null,
        barRows[0].gcash_account_name || null,
      ]
    );
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return;
    throw err;
  }
}

async function deductInventoryForReservation(conn, reservationId, paymentId = null) {
  try {
    const [[reservation]] = await conn.query(
      `SELECT bar_id, notes, payment_transaction_id
       FROM reservations
       WHERE id = ?
       LIMIT 1`,
      [reservationId]
    );
    if (!reservation?.bar_id) return;

    const effectivePaymentId = Number(paymentId || reservation.payment_transaction_id || 0) || null;
    const inventoryTotals = new Map();
    const coveredNames = new Set();
    let usedPaymentLineItems = false;

    if (effectivePaymentId && (await hasPaymentLineItemsTable(conn))) {
      const [paymentItems] = await conn.query(
        `SELECT item_type, item_name, quantity, metadata
         FROM payment_line_items
         WHERE payment_transaction_id = ?
         ORDER BY id ASC`,
        [effectivePaymentId]
      );

      if (paymentItems.length) {
        usedPaymentLineItems = true;
        for (const item of paymentItems) {
          const metadata = safeParseJson(item.metadata) || {};
          const itemType = String(metadata.line_kind || item.item_type || '').toLowerCase();
          const itemName = String(item.item_name || '').trim();
          const qty = Number(item.quantity || 0);
          if (!qty) continue;

          if (itemType === 'menu') {
            const sale = await resolveMenuSaleUnits(conn, reservation.bar_id, metadata.menu_item_id, itemName);
            if (sale) {
              inventoryTotals.set(sale.inventoryItemId, (inventoryTotals.get(sale.inventoryItemId) || 0) + qty * sale.unitsPerSale);
            }
            if (itemName) coveredNames.add(itemName.toLowerCase().trim());
            continue;
          }

          if (itemType === 'package') {
            await appendPackageInventoryDeductions(conn, reservation.bar_id, metadata.package_id, itemName, qty, inventoryTotals, coveredNames);
            if (itemName) coveredNames.add(itemName.toLowerCase().trim());
          }
        }
      }
    }

    if (!usedPaymentLineItems) {
      const [riCheck] = await conn.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservation_items' LIMIT 1`
      );

      if (riCheck.length) {
        const [items] = await conn.query(
          `SELECT ri.menu_item_id, ri.quantity, COALESCE(m.menu_name, '') AS menu_name, m.inventory_item_id,
                  COALESCE(m.units_per_sale, 1) AS units_per_sale
           FROM reservation_items ri
           JOIN menu_items m ON m.id = ri.menu_item_id
           WHERE ri.reservation_id = ? AND m.inventory_item_id IS NOT NULL`,
          [reservationId]
        );

        for (const item of items) {
          const inventoryItemId = Number(item.inventory_item_id || 0);
          const qty = Number(item.quantity || 0) * (Number(item.units_per_sale) > 0 ? Number(item.units_per_sale) : 1);
          if (!inventoryItemId || !qty) continue;
          inventoryTotals.set(inventoryItemId, (inventoryTotals.get(inventoryItemId) || 0) + qty);
          if (item.menu_name) coveredNames.add(String(item.menu_name).toLowerCase().trim());
        }
      }
    }

    const parsedItems = parseReservationOrderItems(reservation.notes);
    for (const item of parsedItems) {
      const itemName = String(item.name || '').trim();
      const qty = Number(item.quantity || 0);
      if (!itemName || !qty || coveredNames.has(itemName.toLowerCase().trim())) continue;

      const sale = await resolveMenuSaleUnits(conn, reservation.bar_id, null, itemName);
      if (sale) {
        inventoryTotals.set(sale.inventoryItemId, (inventoryTotals.get(sale.inventoryItemId) || 0) + qty * sale.unitsPerSale);
        coveredNames.add(itemName.toLowerCase().trim());
        continue;
      }

      const matchedPackage = await appendPackageInventoryDeductions(conn, reservation.bar_id, null, itemName, qty, inventoryTotals, coveredNames);
      if (matchedPackage) {
        coveredNames.add(itemName.toLowerCase().trim());
      }
    }

    const parsedPackages = parseReservationPackageItems(reservation.notes);
    for (const pkg of parsedPackages) {
      const packageName = String(pkg.name || '').trim();
      const qty = Number(pkg.quantity || 0);
      if (!packageName || !qty || coveredNames.has(packageName.toLowerCase().trim())) continue;
      const matchedPackage = await appendPackageInventoryDeductions(conn, reservation.bar_id, pkg.package_id, packageName, qty, inventoryTotals, coveredNames);
      if (matchedPackage) {
        coveredNames.add(packageName.toLowerCase().trim());
      }
    }

    for (const [inventoryItemId, quantity] of inventoryTotals.entries()) {
      const [invRows] = await conn.query(
        "SELECT stock_qty, reorder_level FROM inventory_items WHERE id = ? LIMIT 1",
        [inventoryItemId]
      );
      if (!invRows.length) continue;

      const newStock = Math.max(0, Number(invRows[0].stock_qty) - Number(quantity));
      let status = "normal";
      if (newStock <= 0) status = "critical";
      else if (newStock < Number(invRows[0].reorder_level || 0)) status = "low";

      await conn.query(
        "UPDATE inventory_items SET stock_qty = ?, stock_status = ? WHERE id = ?",
        [newStock, status, inventoryItemId]
      );
    }
  } catch (err) {
    console.error("DEDUCT INVENTORY (reservation) WARNING:", err.message);
  }
}

async function deductInventoryForOrder(conn, orderId) {
  try {
    const [items] = await conn.query(
      `SELECT poi.menu_item_id, poi.quantity, m.inventory_item_id,
              COALESCE(m.units_per_sale, 1) AS units_per_sale
       FROM pos_order_items poi
       JOIN menu_items m ON m.id = poi.menu_item_id
       WHERE poi.order_id = ? AND m.inventory_item_id IS NOT NULL`,
      [orderId]
    );

    for (const item of items) {
      const [invRows] = await conn.query(
        "SELECT stock_qty, reorder_level FROM inventory_items WHERE id = ? LIMIT 1",
        [item.inventory_item_id]
      );
      if (!invRows.length) continue;

      const deductQty = Number(item.quantity) * (Number(item.units_per_sale) > 0 ? Number(item.units_per_sale) : 1);
      const newStock = Math.max(0, Number(invRows[0].stock_qty) - deductQty);
      let status = "normal";
      if (newStock <= 0) status = "critical";
      else if (newStock < Number(invRows[0].reorder_level || 0)) status = "low";

      await conn.query(
        "UPDATE inventory_items SET stock_qty = ?, stock_status = ? WHERE id = ?",
        [newStock, status, item.inventory_item_id]
      );
    }
  } catch (err) {
    console.error("DEDUCT INVENTORY (order) WARNING:", err.message);
  }
}

async function markPaymentSuccess(conn, payment, paymongoPaymentId = null) {
  await conn.query(
    `UPDATE payment_transactions
     SET status = 'paid', paid_at = NOW(), paymongo_payment_id = COALESCE(?, paymongo_payment_id)
     WHERE id = ?`,
    [paymongoPaymentId, payment.id]
  );

  if (payment.payment_type === 'order') {
    await conn.query(
      "UPDATE pos_orders SET payment_status = 'paid', status = 'paid', completed_at = NOW() WHERE id = ?",
      [payment.related_id]
    );
    await deductInventoryForOrder(conn, payment.related_id);
  } else if (payment.payment_type === 'reservation') {
    const paidAmount = Number(payment.amount || 0);
    let newPaymentStatus = 'paid'; // safe default
    let shouldDeductInventory = true;

    try {
      const [[existingReservation]] = await conn.query(
        `SELECT payment_status
         FROM reservations
         WHERE id = ?
         LIMIT 1`,
        [payment.related_id]
      );
      shouldDeductInventory = !['partial', 'paid'].includes(String(existingReservation?.payment_status || '').toLowerCase());
    } catch (_) {}

    try {
      // Compute total from tables + reservation_items; fallback to payment_line_items
      let tableTotal = 0;
      try {
        const [[tableSumRow]] = await conn.query(
          `SELECT COALESCE(SUM(bt.price), 0) AS table_total
           FROM reservation_tables rt
           JOIN bar_tables bt ON bt.id = rt.table_id
           WHERE rt.reservation_id = ?`,
          [payment.related_id]
        );
        tableTotal = Number(tableSumRow?.table_total || 0);
      } catch (_) {}

      let itemsTotal = 0;
      try {
        const [[itemSumRow]] = await conn.query(
          `SELECT COALESCE(SUM(ri.quantity * ri.unit_price), 0) AS items_total
           FROM reservation_items ri
           WHERE ri.reservation_id = ?`,
          [payment.related_id]
        );
        itemsTotal = Number(itemSumRow?.items_total || 0);
      } catch (_) {}

      // Supplement with any items from notes not already represented in reservation_items
      try {
        const [[resNotes]] = await conn.query(
          `SELECT notes, bar_id FROM reservations WHERE id = ? LIMIT 1`,
          [payment.related_id]
        );
        if (resNotes?.notes) {
          const [dbItems] = await conn.query(
            `SELECT COALESCE(m.menu_name, '') AS menu_name
             FROM reservation_items ri2
             LEFT JOIN menu_items m ON m.id = ri2.menu_item_id
             WHERE ri2.reservation_id = ?`,
            [payment.related_id]
          );
          const dbNames = new Set(dbItems.map(i => (i.menu_name || '').toLowerCase().trim()).filter(Boolean));
          const parsedItems = parseReservationOrderItems(resNotes.notes);
          for (const it of parsedItems) {
            if (dbNames.has(it.name.toLowerCase().trim())) continue;
            const [menuRows] = await conn.query(
              `SELECT selling_price FROM menu_items WHERE bar_id = ? AND LOWER(menu_name) = LOWER(?) ORDER BY id DESC LIMIT 1`,
              [resNotes.bar_id, it.name]
            );
            const unitPrice = Number(menuRows[0]?.selling_price || 0);
            if (unitPrice > 0) itemsTotal += unitPrice * Number(it.quantity || 1);
          }
        }
      } catch (_) {}

      let computedTotal = tableTotal + itemsTotal;

      // Always consider payment_line_items total (captures full order breakdown from checkout)
      try {
        const [[pliSumRow]] = await conn.query(
          `SELECT COALESCE(SUM(line_total), 0) AS pli_total
           FROM payment_line_items
           WHERE payment_transaction_id = ?`,
          [payment.id]
        );
        computedTotal = Math.max(computedTotal, Number(pliSumRow?.pli_total || 0));
      } catch (_) {}

      let depositAmount = 0;
      try {
        const [[resRow]] = await conn.query(
          `SELECT deposit_amount FROM reservations WHERE id = ? LIMIT 1`,
          [payment.related_id]
        );
        depositAmount = Number(resRow?.deposit_amount || 0);
      } catch (_) {}

      const targetTotal = computedTotal > 0 ? computedTotal : depositAmount;
      newPaymentStatus = targetTotal > 0 && paidAmount < targetTotal ? 'partial' : 'paid';
    } catch (calcErr) {
      console.error('MARK_PAYMENT_CALC_ERR:', calcErr.message);
    }

    const storedPaymentStatus = await normalizeReservationPaymentStatusForStorage(conn, newPaymentStatus);

    await conn.query(
      "UPDATE reservations SET payment_status = ?, status = 'confirmed', paid_at = NOW() WHERE id = ?",
      [storedPaymentStatus, payment.related_id]
    );

    const [[reservationNotifRow]] = await conn.query(
      `SELECT r.customer_user_id, r.reservation_date, r.reservation_time, b.name AS bar_name
       FROM reservations r
       JOIN bars b ON b.id = r.bar_id
       WHERE r.id = ?
       LIMIT 1`,
      [payment.related_id]
    );

    if (reservationNotifRow?.customer_user_id) {
      const formattedDate = new Date(reservationNotifRow.reservation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const formattedTime = formatTo12HourTime(reservationNotifRow.reservation_time);
      const notifMessage = newPaymentStatus === 'partial'
        ? `Your reservation at ${reservationNotifRow.bar_name} for ${formattedDate} at ${formattedTime} is confirmed. Payment status: Partially Paid.`
        : `Your reservation at ${reservationNotifRow.bar_name} for ${formattedDate} at ${formattedTime} is confirmed. Payment status: Paid.`;

      const [notifUpdate] = await conn.query(
        `UPDATE notifications
         SET title = 'Reservation Confirmed', message = ?, is_read = 0
         WHERE user_id = ? AND reference_type = 'reservation' AND reference_id = ? AND type = 'reservation_confirmed'`,
        [notifMessage, reservationNotifRow.customer_user_id, payment.related_id]
      );

      if (!notifUpdate.affectedRows) {
        await conn.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, is_read, created_at)
           VALUES (?, 'reservation_confirmed', 'Reservation Confirmed', ?, ?, 'reservation', 0, NOW())`,
          [reservationNotifRow.customer_user_id, notifMessage, payment.related_id]
        );
      }
    }

    if (shouldDeductInventory) {
      await deductInventoryForReservation(conn, payment.related_id, payment.id);
    }
  }

  await createPayoutForPayment(conn, payment);
}

async function markPaymentFailed(conn, payment, reason) {
  const storedCancelledTxnStatus = await normalizePaymentTransactionStatusForStorage(conn, 'cancelled');
  await conn.query(
    "UPDATE payment_transactions SET status = ?, failed_reason = ? WHERE id = ?",
    [storedCancelledTxnStatus, reason || 'Payment cancelled', payment.id]
  );

  if (payment.payment_type === 'order') {
    await conn.query("UPDATE pos_orders SET payment_status = 'cancelled' WHERE id = ?", [payment.related_id]);
  } else if (payment.payment_type === 'reservation') {
    const storedCancelledPaymentStatus = await normalizeReservationPaymentStatusForStorage(conn, 'cancelled');
    const storedCancelledReservationStatus = await normalizeReservationStatusForStorage(conn, 'cancelled');

    if (storedCancelledReservationStatus) {
      await conn.query(
        "UPDATE reservations SET payment_status = ?, status = ? WHERE id = ? AND status NOT IN ('confirmed','cancelled','rejected')",
        [storedCancelledPaymentStatus, storedCancelledReservationStatus, payment.related_id]
      );
    } else {
      await conn.query(
        "UPDATE reservations SET payment_status = ? WHERE id = ? AND status NOT IN ('confirmed','cancelled','rejected')",
        [storedCancelledPaymentStatus, payment.related_id]
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER PAYMENT ENDPOINTS (Orders, Reservations)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /payments/create — Create payment for order or reservation
 * Body: { payment_type, related_id, amount, payment_method, bar_id }
 */
router.post(
  "/create",
  requireAuth,
  requireBarOrderAccess({
    getBarId: async (req) => {
      const type = String(req.body?.payment_type || "").toLowerCase();
      const relatedId = Number(req.body?.related_id);
      if (!relatedId) return NaN;
      if (type === "reservation") {
        const [[row]] = await pool.query(
          "SELECT bar_id FROM reservations WHERE id = ? LIMIT 1",
          [relatedId]
        );
        return row?.bar_id;
      }
      if (type === "order") {
        const [[row]] = await pool.query(
          "SELECT bar_id FROM pos_orders WHERE id = ? LIMIT 1",
          [relatedId]
        );
        return row?.bar_id;
      }
      return NaN;
    },
  }),
  async (req, res) => {
  const conn = await pool.getConnection();
  try {
    // Optional VAT snapshot from checkout (validated, stored on the
    // reservation row; mirrored here so payment records stand alone).
    const cleanTax = (v, max) => {
      if (v === undefined || v === null || v === '') return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= max ? n : NaN;
    };
    const taxRateIn = cleanTax(req.body.tax_rate, 100);
    const taxModeRaw = String(req.body.tax_mode || '').trim().toUpperCase();
    const taxModeIn = taxModeRaw === '' ? undefined : (['EXCLUSIVE', 'INCLUSIVE'].includes(taxModeRaw) ? taxModeRaw : NaN);
    const taxAmountIn = cleanTax(req.body.tax_amount, 1000000);
    const netSubtotalIn = cleanTax(req.body.net_subtotal, 1000000);
    if (Number.isNaN(taxRateIn) || Number.isNaN(taxModeIn) || Number.isNaN(taxAmountIn) || Number.isNaN(netSubtotalIn)) {
      return res.status(400).json({ success: false, message: "Invalid tax breakdown: tax_rate 0-100, tax_mode EXCLUSIVE/INCLUSIVE, amounts non-negative." });
    }
    const { payment_type, related_id, amount, payment_method, bar_id } = req.body;
    const userId = req.user.id;
    const relatedId = Number(related_id);
    const amountNum = Number(amount);

    // Validate input
    if (!payment_type || !['order', 'reservation'].includes(payment_type)) {
      return res.status(400).json({ success: false, message: "Invalid payment_type. Use 'order' or 'reservation'." });
    }
    if (!relatedId || !amountNum || amountNum <= 0) {
      return res.status(400).json({ success: false, message: "related_id and amount are required." });
    }
    if (!Number.isFinite(amountNum) || amountNum > 1_000_000) {
      return res.status(400).json({ success: false, message: "Invalid payment amount." });
    }
    if (!payment_method || !['gcash', 'paymaya', 'card'].includes(payment_method)) {
      return res.status(400).json({ success: false, message: "Invalid payment_method. Use 'gcash', 'paymaya', or 'card'." });
    }

    // Platform-wide kill switch (platform_settings.payments_enabled).
    if (!(await platformSettings.isPaymentsEnabled())) {
      return res.status(503).json({
        success: false,
        message: "Online payments are temporarily disabled. Please pay at the bar instead.",
      });
    }

    // Verify the order/reservation exists and belongs to this user
    let verifyQuery = "";
    let verifyParams = [];
    let record = null;
    let derivedBarId = Number(bar_id || 0) || null;

    if (payment_type === 'order') {
      verifyQuery = `SELECT id, bar_id, table_id, total_amount, status, payment_status
                     FROM pos_orders
                     WHERE id = ?
                     LIMIT 1`;
      verifyParams = [relatedId];
    } else if (payment_type === 'reservation') {
      verifyQuery = `SELECT r.id, r.bar_id, r.table_id, r.customer_user_id, r.status, r.payment_status, r.notes,
                            t.table_number, t.price AS table_price
                     FROM reservations r
                     LEFT JOIN bar_tables t ON t.id = r.table_id
                     WHERE r.id = ? AND r.customer_user_id = ?
                     LIMIT 1`;
      verifyParams = [relatedId, userId];
    }

    const [records] = await pool.query(verifyQuery, verifyParams);
    if (!records.length) {
      return res.status(404).json({ success: false, message: `${payment_type} not found or does not belong to you.` });
    }
    record = records[0];
    if (!derivedBarId) {
      derivedBarId = Number(record.bar_id || 0) || null;
    }

    // ── Stripe Connect test-mode rail (destination charge) ──
    // When STRIPE_TEST_MODE is on, verified bars settle via Stripe Connect:
    // the bar owner's share transfers straight to their Express account.
    // Fail closed for unverified bars (same rule as PayMongo splits).
    let stripeDestination = null;
    let stripeFeeAmount = 0;
    if (payment_type === 'reservation' && derivedBarId) {
      const stripeCfg = await stripeService.loadSettings();
      if (stripeCfg.testMode) {
        const [[sBar]] = await pool.query(
          `SELECT stripe_account_id, stripe_onboarding_status FROM bars WHERE id = ? LIMIT 1`,
          [derivedBarId]
        );
        const sActive = sBar?.stripe_account_id && sBar.stripe_onboarding_status === 'active';
        if (!sActive) {
          return res.status(403).json({
            success: false,
            message: "This bar is not set up for Stripe Connect test payments yet. The owner must complete Stripe onboarding first.",
          });
        }
        stripeDestination = sBar.stripe_account_id;
        stripeFeeAmount = Math.round((amountNum * (stripeCfg.feePercentage || 0)) / 100 * 100) / 100;
      }
    }

    // ── Marketplace split settlement (PayMongo Platforms) ──
    // Applies to customer reservation checkout (when not on the Stripe rail).
    // Per-bar mode decides keys + settlement:
    //  - live: requires verified child merchant → LIVE keys + split instruction
    //    (funds settle directly to the bar owner, fee remainder to parent).
    //  - test (default): requires test-connected flag → TEST keys, no split.
    // Fail closed: refuse rather than route money somewhere unintended.
    let splitInstruction = null;
    let splitChildMerchantId = null;
    let paymongoKeyMode = 'test';
    let paymongoKeyOverride = null;
    if (payment_type === 'reservation' && derivedBarId && !stripeDestination) {
      const platform = await paymongoService.loadPlatformSettings();
      // PayMongo mode rules always apply (test is the default): test requires
      // a test-connected bar, live additionally requires Platforms + verification.
      const [[barRow]] = await pool.query(
        `SELECT paymongo_mode, paymongo_test_connected,
                paymongo_child_merchant_id, paymongo_onboarding_status,
                paymongo_live_secret_key
         FROM bars WHERE id = ? LIMIT 1`,
        [derivedBarId]
      );
      {
        const mode = barRow?.paymongo_mode || 'test';
        if (mode === 'live') {
          // Preferred: the owner's own live keys (self-serve direct connection).
          // Charges go straight to their PayMongo account — no split needed
          // since funds never touch the platform at all.
          const storedOwnerKey = barRow?.paymongo_live_secret_key || null;
          if (storedOwnerKey) {
            const ownerKey = decryptField(storedOwnerKey);
            if (!ownerKey) {
              // Stored but unreadable. This bar intends to charge through its
              // own account, so dropping into the platform-split branch below
              // would settle money on the wrong ledger — refuse instead.
              console.error(
                `PAYMONGO_OWNER_KEY_UNREADABLE: bar ${derivedBarId} live key could not be decrypted — check PAYMONGO_FIELD_ENCRYPTION_KEY`
              );
              return res.status(503).json({
                success: false,
                message:
                  "This bar's PayMongo live key could not be read. Reconnect PayMongo Live Mode before accepting payments.",
              });
            }
            paymongoKeyMode = 'live';
            paymongoKeyOverride = ownerKey;
          } else {
            if (!platform.enabled) {
              return res.status(403).json({
                success: false,
                message: "Live payments are not enabled on this platform yet.",
              });
            }
            const verified = barRow
              && barRow.paymongo_child_merchant_id
              && barRow.paymongo_onboarding_status === 'verified';
            if (!verified) {
              return res.status(403).json({
                success: false,
                message: "This bar is not verified for live online payments yet. The owner must complete PayMongo onboarding first.",
              });
            }
            paymongoKeyMode = 'live';
            splitChildMerchantId = barRow.paymongo_child_merchant_id;
            splitInstruction = paymongoService.buildSplit({
              childMerchantId: splitChildMerchantId,
              feePercentage: platform.feePercentage,
              parentMerchantId: platform.parentMerchantId,
            });
          }
        } else {
          if (!barRow?.paymongo_test_connected) {
            return res.status(403).json({
              success: false,
              message: "This bar has not connected PayMongo Test Mode yet. The owner must connect it in Bar Management first.",
            });
          }
          paymongoKeyMode = 'test';
        }
      }
    }

    if (String(record.status || "").toLowerCase() === "cancelled") {
      return res.status(400).json({ success: false, message: "Cannot pay a cancelled record." });
    }

    // Check if payment already exists for this record
    const [existingPayments] = await pool.query(
      "SELECT id, status, checkout_url FROM payment_transactions WHERE payment_type = ? AND related_id = ? AND status IN ('pending', 'processing', 'paid') LIMIT 1",
      [payment_type, relatedId]
    );

    if (existingPayments.length) {
      const existing = existingPayments[0];
      if (existing.status === 'paid') {
        return res.status(400).json({ success: false, message: "This order/reservation is already paid." });
      }
      // Return existing pending payment
      return res.json({
        success: true,
        message: "Payment already created. Please complete the existing payment.",
        data: {
          payment_id: existing.id,
          status: existing.status,
          checkout_url: existing.checkout_url,
        },
      });
    }

    // Generate reference ID
    const referenceId = paymongoService.generateReferenceId(payment_type === 'order' ? 'ORD' : 'RES');

    // Create PayMongo source/payment
    let checkoutUrl = null;
    let paymongoSourceId = null;
    let paymongoPaymentIntentId = null;
    let paymongoCheckoutSessionId = null;
    let stripeCheckoutSessionId = null;

    // Shared redirect URLs (PayMongo sources/sessions + Stripe sessions)
    let successUrl = req.body.success_url || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success?ref=${referenceId}`;
    let failedUrl = req.body.failed_url || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/failed?ref=${referenceId}`;
    successUrl = successUrl.replace('{REFERENCE_ID}', referenceId);
    failedUrl = failedUrl.replace('{REFERENCE_ID}', referenceId);

    try {
      if (stripeDestination) {
        // Stripe Connect test rail: hosted Checkout Session with destination
        // charge (bar owner share) + application fee (platform share, maybe 0).
        // Same redirect UX as PayMongo — use test card 4242 4242 4242 4242.
        const session = await stripeService.createSplitCheckout({
          amount: amountNum,
          connectedAccountId: stripeDestination,
          feeAmount: stripeFeeAmount,
          reference: referenceId,
          successUrl,
          cancelUrl: failedUrl,
          description: `${payment_type === 'order' ? 'Order' : 'Reservation'} Payment #${relatedId}`,
          metadata: {
            payment_type, related_id: String(relatedId), bar_id: String(derivedBarId || ''),
            provider: 'stripe',
          },
        });
        checkoutUrl = session.url;
        stripeCheckoutSessionId = session.id;
      } else if (payment_method === 'gcash' || payment_method === 'paymaya') {
        const sourceType = payment_method === 'paymaya' ? 'grab_pay' : payment_method;

        // Use frontend-provided URLs or fallback to env (for backward compatibility)

        if (splitInstruction) {
          // Marketplace path: Sources don't support splits, so e-wallets go
          // through a Checkout Session carrying the split instruction.
          const session = await paymongoService.createSplitCheckoutSession({
            line_items: [{
              name: `${payment_type === 'order' ? 'Order' : 'Reservation'} Payment #${relatedId}`,
              amount: Math.round(amountNum * 100),
              quantity: 1,
              currency: 'PHP',
            }],
            payment_method_types: [payment_method],
            reference_number: referenceId,
            success_url: successUrl,
            cancel_url: failedUrl,
            description: `${payment_type === 'order' ? 'Order' : 'Reservation'} Payment #${relatedId}`,
            metadata: {
              payment_type, related_id: String(relatedId), bar_id: String(derivedBarId || ''),
              child_merchant_id: splitChildMerchantId || '',
            },
            split: splitInstruction,
            keyMode: paymongoKeyMode,
            keyOverride: paymongoKeyOverride,
          });
          checkoutUrl = session.attributes.checkout_url;
          paymongoCheckoutSessionId = session.id;
        } else {
          const source = await paymongoService.createSource(amount, sourceType, {
            description: `${payment_type === 'order' ? 'Order' : 'Reservation'} Payment #${relatedId}`,
            success_url: successUrl,
            failed_url: failedUrl,
          }, paymongoKeyMode, paymongoKeyOverride);
          checkoutUrl = source.attributes.redirect.checkout_url;
          paymongoSourceId = source.id;
        }
      } else if (payment_method === 'card') {
        const intent = splitInstruction
          ? await paymongoService.createSplitPaymentIntent(amount, {
              description: `${payment_type === 'order' ? 'Order' : 'Reservation'} Payment #${relatedId}`,
              custom_data: {
                payment_type, related_id: String(relatedId), bar_id: String(derivedBarId || ''),
                child_merchant_id: splitChildMerchantId || '',
              },
            }, splitInstruction, paymongoKeyMode, paymongoKeyOverride)
          : await paymongoService.createPaymentIntent(amount, {
              description: `${payment_type === 'order' ? 'Order' : 'Reservation'} Payment #${relatedId}`,
            }, paymongoKeyMode, paymongoKeyOverride);
        paymongoPaymentIntentId = intent.id;
        checkoutUrl = intent.attributes.next_action?.redirect?.url || null;
      }
    } catch (err) {
      console.error('PayMongo Error:', err.message);
      // The reservation already exists with payment_status='pending' at this
      // point, so the customer can safely retry — nothing was charged.
      return res.status(500).json({ success: false, message: err.message, can_retry: true });
    }

    await conn.beginTransaction();

    // Save payment transaction
    const settledDirectly = Boolean(
      stripeDestination || paymongoKeyOverride || splitInstruction
    );
    const settlementRail = stripeDestination
      ? 'stripe_connect'
      : paymongoKeyOverride
        ? 'owner_keys_direct'
        : splitInstruction
          ? 'child_split'
          : 'platform_collect';
    const storedPendingTxnStatus = await normalizePaymentTransactionStatusForStorage(conn, 'pending') || 'pending';

    const txnColumns = [
      'reference_id', 'payment_type', 'related_id', 'bar_id', 'user_id', 'amount',
      'status', 'payment_method', 'paymongo_payment_intent_id', 'paymongo_source_id',
      'paymongo_checkout_session_id', 'paymongo_child_merchant_id', 'split_json',
      'stripe_payment_intent_id', 'stripe_transfer_id', 'payment_provider',
    ];
    const txnParams = [
      referenceId,
      payment_type,
      relatedId,
      derivedBarId,
      userId,
      amountNum,
      storedPendingTxnStatus,
      payment_method,
      paymongoPaymentIntentId,
      paymongoSourceId,
      paymongoCheckoutSessionId,
      splitChildMerchantId,
      splitInstruction ? JSON.stringify(splitInstruction) : null,
      null,
      null,
      stripeDestination ? 'stripe' : 'paymongo',
    ];

    if (await hasSettlementColumns(conn)) {
      txnColumns.push('settled_directly', 'settlement_rail');
      txnParams.push(settledDirectly ? 1 : 0, settlementRail);
    }

    txnColumns.push('checkout_url', 'metadata');
    txnParams.push(
      checkoutUrl,
      JSON.stringify({
        user_agent: req.headers['user-agent'],
        provider: stripeDestination ? 'stripe' : 'paymongo',
        tax_breakdown: (taxRateIn !== undefined || taxModeIn !== undefined || taxAmountIn !== undefined || netSubtotalIn !== undefined)
          ? {
              tax_rate: taxRateIn ?? null,
              tax_mode: taxModeIn ?? null,
              tax_amount: taxAmountIn ?? 0,
              net_subtotal: netSubtotalIn ?? null,
            }
          : null,
        paymongo_key_mode: stripeDestination ? null : paymongoKeyMode,
        live_path: stripeDestination ? null : (paymongoKeyOverride ? 'owner_keys_direct' : (splitInstruction ? 'child_split' : 'test_rail')),
        stripe_split: stripeDestination ? {
          destination: stripeDestination,
          application_fee_amount: stripeFeeAmount,
          checkout_session_id: stripeCheckoutSessionId,
        } : null,
        split_settlement: splitInstruction ? {
          child_merchant_id: splitChildMerchantId,
          recipients: splitInstruction.recipients,
          transfer_to: splitInstruction.transfer_to || null,
        } : null,
        related_snapshot: {
          table_id: record.table_id || null,
          table_number: record.table_number || null,
          source_status: record.status || null,
          notes: record.notes || null,
        },
      })
    );

    const [result] = await conn.query(
      `INSERT INTO payment_transactions (${txnColumns.join(', ')})
       VALUES (${txnColumns.map(() => '?').join(', ')})`,
      txnParams
    );

    const paymentId = result.insertId;

    // Update order/reservation status to pending_payment
    if (payment_type === 'order') {
      await conn.query(
        "UPDATE pos_orders SET payment_status = 'pending', payment_transaction_id = ? WHERE id = ?",
        [paymentId, relatedId]
      );
    } else if (payment_type === 'reservation') {
      const storedPaymentMethod = await normalizeReservationPaymentMethodForStorage(conn, payment_method);
      const hasPaymentTxCol = await hasReservationPaymentTransactionIdColumn(conn);
      if (hasPaymentTxCol) {
        await conn.query(
          `UPDATE reservations
           SET payment_status = 'pending', payment_method = ?, deposit_amount = ?, payment_reference = ?, payment_transaction_id = ?
           WHERE id = ?`,
          [storedPaymentMethod, amountNum, referenceId, paymentId, relatedId]
        );
      } else {
        await conn.query(
          `UPDATE reservations
           SET payment_status = 'pending', payment_method = ?, deposit_amount = ?, payment_reference = ?
           WHERE id = ?`,
          [storedPaymentMethod, amountNum, referenceId, relatedId]
        );
      }
    }

    let lineItems = [];
    if (payment_type === "order") {
      lineItems = await buildOrderLineItems(conn, relatedId);
    } else if (payment_type === "reservation") {
      lineItems = await buildReservationLineItems(conn, record);
    }
    await upsertPaymentLineItems(conn, paymentId, lineItems);

    await conn.commit();

    logAudit(null, {
      bar_id: derivedBarId || null,
      user_id: userId,
      action: "CREATE_PAYMENT",
      entity: "payment_transactions",
      entity_id: paymentId,
        details: { payment_type, related_id: relatedId, amount: amountNum, payment_method, line_items_count: lineItems.length, provider: stripeDestination ? 'stripe' : 'paymongo' },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: "Payment created. Please complete the payment using the checkout URL.",
        data: {
          payment_id: paymentId,
          reference_id: referenceId,
          checkout_url: checkoutUrl,
          amount: amountNum,
          payment_method,
          provider: stripeDestination ? 'stripe' : 'paymongo',
        },
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    console.error("CREATE PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

/**
 * POST /payments/:reference_id/confirm — Confirm pending payment with PayMongo
 */
router.post("/:reference_id/confirm", requireAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { reference_id } = req.params;
    const userId = req.user.id;

    const [rows] = await conn.query(
      `SELECT *
       FROM payment_transactions
       WHERE reference_id = ? AND user_id = ?
       LIMIT 1`,
      [reference_id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const payment = rows[0];
    if (payment.status === 'paid') {
      await conn.beginTransaction();
      await markPaymentSuccess(conn, payment, payment.paymongo_payment_id || null);
      await conn.commit();
      return res.json({ success: true, message: "Payment already confirmed", data: { status: 'paid', reference_id } });
    }

    if (payment.status === 'cancelled' || payment.status === 'failed') {
      await conn.beginTransaction();
      await markPaymentFailed(conn, payment, payment.failed_reason || 'Payment cancelled');
      await conn.commit();
      return res.json({ success: false, message: 'Payment cancelled', data: { status: 'cancelled', reference_id } });
    }

    const keyContext = await resolvePaymentKeyContext(conn, payment);
    let externalStatus = null;
    let paymongoPaymentId = payment.paymongo_payment_id || null;

    if (payment.paymongo_source_id) {
      const source = await paymongoService.getSource(
        payment.paymongo_source_id,
        keyContext.keyMode,
        keyContext.keyOverride
      );
      externalStatus = source?.attributes?.status || null;
      
      if (externalStatus === 'chargeable') {
        try {
          const attached = await paymongoService.attachSourceToPayment(payment.paymongo_source_id, {
            amount: Math.round(Number(payment.amount || 0) * 100),
            description: `Payment for ${payment.payment_type} #${payment.related_id}`,
          }, keyContext.keyMode, keyContext.keyOverride);
          paymongoPaymentId = attached?.id || paymongoPaymentId;
          externalStatus = 'paid';
        } catch (attachErr) {
          console.warn('Attach source error (may already be consumed):', attachErr.message);
          if (attachErr.message?.includes('not chargeable')) {
            externalStatus = source?.attributes?.status === 'consumed' ? 'paid' : externalStatus;
          } else {
            throw attachErr;
          }
        }
      } else if (externalStatus === 'consumed' || externalStatus === 'paid') {
        externalStatus = 'paid';
      }
    } else if (payment.stripe_payment_intent_id) {
      const intent = await stripeService.getPaymentIntent(payment.stripe_payment_intent_id);
      const stripeStatus = String(intent?.status || '').toLowerCase();
      if (stripeStatus === 'succeeded') externalStatus = 'paid';
      else if (['canceled', 'requires_payment_method'].includes(stripeStatus)) externalStatus = 'failed';
      else if (intent?.status) externalStatus = 'pending';
    } else if (payment.paymongo_payment_intent_id) {
      const intent = await paymongoService.getPaymentIntent(
        payment.paymongo_payment_intent_id,
        keyContext.keyMode,
        keyContext.keyOverride
      );
      externalStatus = intent?.attributes?.status || null;
      if (externalStatus === 'succeeded') externalStatus = 'paid';
    }

    await conn.beginTransaction();

    if (externalStatus === 'paid') {
      await markPaymentSuccess(conn, payment, paymongoPaymentId);
      await conn.commit();
      return res.json({ success: true, message: "Payment confirmed", data: { status: 'paid', reference_id } });
    }

    if (externalStatus === 'failed' || externalStatus === 'expired' || externalStatus === 'inactive') {
      await markPaymentFailed(conn, payment, 'Payment cancelled');
      await conn.commit();
      return res.json({ success: false, message: 'Payment cancelled', data: { status: 'cancelled', reference_id } });
    }

    const storedPendingTxnStatus = await normalizePaymentTransactionStatusForStorage(conn, 'pending');
    await conn.query("UPDATE payment_transactions SET status = ? WHERE id = ?", [storedPendingTxnStatus, payment.id]);
    await conn.commit();
    return res.json({ success: false, message: "Payment still pending", data: { status: externalStatus || 'pending', reference_id } });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {}
    console.error("CONFIRM PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Failed to confirm payment" });
  } finally {
    conn.release();
  }
});

/**
 * POST /payments/cancel/:reference_id — Mark a pending payment as cancelled
 * Called when user lands on the PaymentFailed page (redirect from PayMongo)
 */
router.post("/cancel/:reference_id", requireAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { reference_id } = req.params;
    const userId = req.user.id;

    const [rows] = await conn.query(
      "SELECT * FROM payment_transactions WHERE reference_id = ? AND user_id = ? LIMIT 1",
      [reference_id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const payment = rows[0];

    // Don't cancel an already-paid payment
    if (payment.status === 'paid') {
      return res.json({ success: true, message: "Payment already paid", data: { status: 'paid' } });
    }

    // Already cancelled — no-op
    if (payment.status === 'cancelled' || payment.status === 'failed') {
      return res.json({ success: true, message: "Payment already cancelled", data: { status: 'cancelled' } });
    }

    await conn.beginTransaction();

    const storedCancelledTxnStatus = await normalizePaymentTransactionStatusForStorage(conn, 'cancelled');
    await conn.query(
      "UPDATE payment_transactions SET status = ?, failed_reason = 'Payment cancelled by user' WHERE id = ?",
      [storedCancelledTxnStatus, payment.id]
    );

    if (payment.payment_type === 'order') {
      await conn.query("UPDATE pos_orders SET payment_status = 'cancelled' WHERE id = ?", [payment.related_id]);
    } else if (payment.payment_type === 'reservation') {
      const storedCancelledStatus = await normalizeReservationPaymentStatusForStorage(conn, 'cancelled');
      const storedReservationStatus = await normalizeReservationStatusForStorage(conn, 'cancelled');
      if (storedReservationStatus) {
        await conn.query(
          "UPDATE reservations SET payment_status = ?, status = ? WHERE id = ? AND status IN ('pending','approved')",
          [storedCancelledStatus, storedReservationStatus, payment.related_id]
        );
      } else {
        await conn.query(
          "UPDATE reservations SET payment_status = ? WHERE id = ? AND status IN ('pending','approved')",
          [storedCancelledStatus, payment.related_id]
        );
      }
    }

    await conn.commit();
    return res.json({ success: true, message: "Payment cancelled", data: { status: 'cancelled', reference_id } });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error("CANCEL PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
});

/**
 * GET /payments/my/history — Get user's payment history with detailed breakdown
 */
router.get("/my/history", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, payment_type } = req.query;

    let where = "WHERE pt.user_id = ?";
    const params = [userId];

    if (status) {
      where += " AND pt.status = ?";
      params.push(status);
    }
    if (payment_type) {
      where += " AND pt.payment_type = ?";
      params.push(payment_type);
    }

    const [payments] = await pool.query(
       `SELECT pt.id, pt.reference_id, pt.payment_type, pt.related_id, pt.amount, pt.status, pt.payment_method,
               pt.paid_at, pt.created_at, pt.failed_reason,
               b.id AS bar_id, b.name AS bar_name,
               r.transaction_number, r.reservation_date, r.reservation_time, r.party_size, r.notes AS reservation_notes,
               r.status AS reservation_status, r.payment_status AS reservation_payment_status,
               r.tax_rate, r.tax_mode, r.tax_amount, r.net_subtotal,
               COALESCE(rt.table_number, ot.table_number) AS table_number,
              o.order_number, o.status AS order_status
       FROM payment_transactions pt
       LEFT JOIN bars b ON b.id = pt.bar_id
       LEFT JOIN reservations r ON pt.payment_type = 'reservation' AND pt.related_id = r.id
       LEFT JOIN bar_tables rt ON rt.id = r.table_id
       LEFT JOIN pos_orders o ON pt.payment_type = 'order' AND pt.related_id = o.id
       LEFT JOIN bar_tables ot ON ot.id = o.table_id
       ${where}
       ORDER BY pt.created_at DESC
       LIMIT 100`,
      params
    );

    let lineItemsByPaymentId = new Map();
    if (payments.length && (await hasPaymentLineItemsTable(pool))) {
      const ids = payments.map((p) => p.id);
      const placeholders = ids.map(() => "?").join(",");
      const [lineItems] = await pool.query(
        `SELECT payment_transaction_id, item_type, item_name, quantity, unit_price, line_total, metadata
         FROM payment_line_items
         WHERE payment_transaction_id IN (${placeholders})
         ORDER BY id ASC`,
        ids
      );
      lineItemsByPaymentId = lineItems.reduce((acc, item) => {
        if (!acc.has(item.payment_transaction_id)) acc.set(item.payment_transaction_id, []);
        acc.get(item.payment_transaction_id).push(item);
        return acc;
      }, new Map());
    }

    return res.json({ success: true, data: payments.map((p) => normalizePaymentRow(p, lineItemsByPaymentId)) });
  } catch (err) {
    console.error("GET PAYMENT HISTORY ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/**
 * GET /payments/:reference_id — Get payment status/details by reference
 */
router.get("/:reference_id", requireAuth, async (req, res) => {
  try {
    const { reference_id } = req.params;
    const userId = req.user.id;

    const [payments] = await pool.query(
      `SELECT pt.id, pt.reference_id, pt.payment_type, pt.related_id, pt.amount, pt.status, pt.payment_method,
              pt.checkout_url, pt.paid_at, pt.failed_reason, pt.created_at,
              b.id AS bar_id, b.name AS bar_name,
              r.reservation_date, r.reservation_time, r.party_size, r.notes AS reservation_notes,
              COALESCE(rt.table_number, ot.table_number) AS table_number,
              o.order_number
       FROM payment_transactions pt
       LEFT JOIN bars b ON b.id = pt.bar_id
       LEFT JOIN reservations r ON pt.payment_type = 'reservation' AND pt.related_id = r.id
       LEFT JOIN bar_tables rt ON rt.id = r.table_id
       LEFT JOIN pos_orders o ON pt.payment_type = 'order' AND pt.related_id = o.id
       LEFT JOIN bar_tables ot ON ot.id = o.table_id
       WHERE pt.reference_id = ? AND pt.user_id = ?
       LIMIT 1`,
      [reference_id, userId]
    );

    if (!payments.length) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const payment = payments[0];
    let lineItemsByPaymentId = new Map();
    if (await hasPaymentLineItemsTable(pool)) {
      const [lineItems] = await pool.query(
        `SELECT payment_transaction_id, item_type, item_name, quantity, unit_price, line_total, metadata
         FROM payment_line_items
         WHERE payment_transaction_id = ?
         ORDER BY id ASC`,
        [payment.id]
      );
      lineItemsByPaymentId.set(payment.id, lineItems);
    }

    const normalized = normalizePaymentRow(payment, lineItemsByPaymentId);

    // For reservation payments, compute the true total order amount and remaining balance
    if (payment.payment_type === 'reservation' && payment.related_id) {
      try {
        const [[tableSumRow]] = await pool.query(
          `SELECT COALESCE(SUM(bt.price), 0) AS table_total
           FROM reservation_tables rt
           JOIN bar_tables bt ON bt.id = rt.table_id
           WHERE rt.reservation_id = ?`,
          [payment.related_id]
        );
        const tableTotal = Number(tableSumRow?.table_total || 0);

        const [[itemSumRow]] = await pool.query(
          `SELECT COALESCE(SUM(ri.quantity * ri.unit_price), 0) AS items_total
           FROM reservation_items ri WHERE ri.reservation_id = ?`,
          [payment.related_id]
        );
        let itemsTotal = Number(itemSumRow?.items_total || 0);

        // Supplement with notes items not already in reservation_items
        if (payment.reservation_notes) {
          const [[resBar]] = await pool.query(
            `SELECT bar_id FROM reservations WHERE id = ? LIMIT 1`,
            [payment.related_id]
          );
          const [dbItems] = await pool.query(
            `SELECT COALESCE(m.menu_name, '') AS menu_name
             FROM reservation_items ri2
             LEFT JOIN menu_items m ON m.id = ri2.menu_item_id
             WHERE ri2.reservation_id = ?`,
            [payment.related_id]
          );
          const dbNames = new Set(dbItems.map(i => (i.menu_name || '').toLowerCase().trim()).filter(Boolean));
          const parsedItems = parseReservationOrderItems(payment.reservation_notes);
          for (const it of parsedItems) {
            if (dbNames.has(it.name.toLowerCase().trim())) continue;
            const [menuRows] = await pool.query(
              `SELECT selling_price FROM menu_items WHERE bar_id = ? AND LOWER(menu_name) = LOWER(?) ORDER BY id DESC LIMIT 1`,
              [resBar?.bar_id, it.name]
            );
            const unitPrice = Number(menuRows[0]?.selling_price || 0);
            if (unitPrice > 0) itemsTotal += unitPrice * Number(it.quantity || 1);
          }
        }

        const totalOrderAmount = tableTotal + itemsTotal;
        if (totalOrderAmount > 0) {
          normalized.total_order_amount = totalOrderAmount;
          normalized.remaining_balance = Math.max(0, totalOrderAmount - Number(payment.amount || 0));
        }
      } catch (_) {}
    }

    return res.json({ success: true, data: normalized });
  } catch (err) {
    console.error("GET PAYMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
module.exports.deductInventoryForReservation = deductInventoryForReservation;
module.exports.deductInventoryForOrder = deductInventoryForOrder;
module.exports.normalizeReservationPaymentStatusForStorage = normalizeReservationPaymentStatusForStorage;
module.exports.isSettledDirectly = isSettledDirectly;
module.exports.resolvePaymentKeyContext = resolvePaymentKeyContext;
module.exports.createPayoutForPayment = createPayoutForPayment;
