// Shared bulk-to-unit conversion helpers.
// Model: inventory stock_qty is stored in BASE units (bottles/pieces).
//   units_per_pack = how many base units one purchased pack holds (default 1).
// Menu items deduct units_per_sale base units per 1 ordered (default 1).

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Conversion ratio of an inventory row: base units per pack.
function packRatio(invRow) {
  return toPositiveNumber(invRow?.units_per_pack, 1);
}

// Base units deducted when `orderQty` of a menu item is sold.
function baseUnitsForSale(menuRow, orderQty) {
  const perSale = toPositiveNumber(menuRow?.units_per_sale, 1);
  return Number(orderQty || 0) * perSale;
}

function trimNum(n) {
  const v = Math.round(Number(n) * 100) / 100;
  return String(Number.isInteger(v) ? v : v);
}

// Human-readable stock, e.g. "3 Cases (36 bottles remaining)".
function formatAtomicStock(stockQty, invRow) {
  const total = Number(stockQty || 0);
  const ratio = packRatio(invRow);
  const pack = String(invRow?.pack_unit || '').trim();
  const base = String(invRow?.base_unit || invRow?.unit || '').trim();
  const plural = (word, n) => (n === 1 ? word : `${word}s`);
  if (ratio > 1 && pack) {
    const packs = Math.floor(total / ratio + 1e-9);
    if (packs < 1) return `${trimNum(total)} ${plural(base || 'unit', total)} available`;
    return `${trimNum(packs)} ${plural(pack, packs)} (${trimNum(total)} ${plural(base || 'unit', total)} remaining)`;
  }
  const label = base || 'units';
  return `${trimNum(total)} ${plural(label, total)} available`;
}

// Resolve a menu sale to its inventory deduction (ratio-aware).
// Returns { inventoryItemId, baseUnits } or null when unresolvable.
async function resolveMenuSaleUnits(conn, barId, menuItemId, itemName) {
  let menuRow = null;
  if (Number(menuItemId) > 0) {
    const [[row]] = await conn.query(
      `SELECT m.inventory_item_id, m.units_per_sale
       FROM menu_items m WHERE m.id = ? AND m.bar_id = ? LIMIT 1`,
      [menuItemId, barId]
    );
    menuRow = row || null;
  }
  if (!menuRow && itemName) {
    const [[rowByName]] = await conn.query(
      `SELECT m.inventory_item_id, m.units_per_sale
       FROM menu_items m WHERE m.bar_id = ? AND LOWER(m.menu_name) = LOWER(?)
       ORDER BY m.id DESC LIMIT 1`,
      [barId, itemName]
    );
    menuRow = rowByName || null;
  }
  if (!menuRow?.inventory_item_id) return null;
  return {
    inventoryItemId: Number(menuRow.inventory_item_id),
    unitsPerSale: toPositiveNumber(menuRow.units_per_sale, 1),
  };
}

// Infer a pack ratio for a brand-new item from explicit case markings in its
// name/unit ("24s", "24 bottles", "x12", "6-pack" → that many bottles).
// Returns null when nothing explicit is found (caller keeps 1:1).
function inferPackRatio(name, unit) {
  const text = `${unit || ''} ${name || ''}`.toLowerCase();
  const bottleCount = text.match(/(\d+)\s*bottles?/) || text.match(/[(\s]x\s*(\d+)\b/) ||
    text.match(/\b(\d+)s\b/) || text.match(/(\d+)\s*-?\s*pack/);
  const n = bottleCount ? Number(bottleCount[1]) : 0;
  if (!Number.isInteger(n) || n < 2 || n > 200) return null;
  const packWord = /\b(box|boxes)\b/.test(text) ? 'Box' : 'Case';
  return { packUnit: packWord, baseUnit: 'Bottle', ratio: n };
}
// Map a free-text PO unit to the inventory unit enum.
function mapPoUnitToEnum(rawUnit) {
  const v = String(rawUnit || '').trim().toLowerCase();
  const ENUM_UNITS = ['Bottle', 'Bucket', 'Case (12 bottles)', 'Glass', 'Liter', 'Kilogram', 'Piece'];
  const exact = ENUM_UNITS.find((u) => u.toLowerCase() === v);
  if (exact) return exact;
  if (v.includes('bottle')) return 'Bottle';
  if (v.includes('liter') || v.includes('litre') || v === 'l') return 'Liter';
  if (v.includes('kilo') || v === 'kg') return 'Kilogram';
  if (v.includes('glass')) return 'Glass';
  if (v.includes('bucket')) return 'Bucket';
  if (v.includes('case')) return 'Case (12 bottles)';
  return 'Piece';
}

function stockStatusFor(stockQty, reorderLevel) {
  const s = Number(stockQty || 0);
  if (s <= 0) return 'critical';
  if (s < Number(reorderLevel || 0)) return 'low';
  return 'normal';
}

module.exports = {
  toPositiveNumber,
  packRatio,
  baseUnitsForSale,
  trimNum,
  formatAtomicStock,
  resolveMenuSaleUnits,
  mapPoUnitToEnum,
  inferPackRatio,
  stockStatusFor,
};
