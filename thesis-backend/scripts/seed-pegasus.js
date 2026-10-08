// Seed script: Pegasus Bar (bar_id 65) — menu items, inventory stocks,
// packages, and tables with sample photos.
// Run with: node scripts/seed-pegasus.js
// Idempotent: re-running updates existing rows instead of duplicating.

const mysql = require('mysql2/promise');

const BAR_ID = 65;
const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

// --- Inventory: existing rows get photos; new rows back new menu items ---
const INVENTORY_IMAGES = {
  'Absolut Vodka 750ml': IMG('photo-1551024709-8f23befc6f87'),
  'Jose Cuervo Tequila 700ml': IMG('photo-1470337458703-46ad1756a187'),
  'Heineken Cases (24s)': IMG('photo-1436076863939-06870fe779c2'),
  'Lime / Lemon Juice': IMG('photo-1551538827-9c037cb4f32a'),
  'Tonic Water': IMG('photo-1536935338788-846bb9981813'),
  'Pork Sisig Mix 1kg': IMG('photo-1544025162-d76694265947'),
  'Chicken Wings 2kg': IMG('photo-1527477396000-e27163b501c2'),
  'Tortilla Chips 500g': IMG('photo-1513456852971-30c0b8199d4d'),
  'Jack Daniels Whiskey 750ml': IMG('photo-1569529465841-dfecdab7503b'),
};

const NEW_INVENTORY = [
  { name: 'Margarita Mix 1L', unit: 'Liter', stock_qty: 18, reorder_level: 4, cost_price: 220.00, is_perishable: 1, shelf_life_days: 60, image: IMG('photo-1514362545857-3bc16c4c7d1b') },
  { name: 'Orange Juice 1L', unit: 'Liter', stock_qty: 22, reorder_level: 5, cost_price: 140.00, is_perishable: 1, shelf_life_days: 21, image: IMG('photo-1497534446932-c925b458314e') },
  { name: 'San Miguel Pale Pilsen Case', unit: 'Case (12 bottles)', stock_qty: 10, reorder_level: 3, cost_price: 950.00, is_perishable: 0, shelf_life_days: 365, image: IMG('photo-1608270586620-248524c67de9') },
  { name: 'Corona Extra Bucket (6s)', unit: 'Bucket', stock_qty: 12, reorder_level: 4, cost_price: 720.00, is_perishable: 0, shelf_life_days: 365, image: IMG('photo-1567696911980-2eed69a46042') },
  { name: 'Hennessy VS 700ml', unit: 'Bottle', stock_qty: 6, reorder_level: 2, cost_price: 2800.00, is_perishable: 0, shelf_life_days: 3650, image: IMG('photo-1527281400683-1aae777175f8') },
  { name: 'Jose Cuervo Especial 750ml', unit: 'Bottle', stock_qty: 9, reorder_level: 3, cost_price: 1250.00, is_perishable: 0, shelf_life_days: 3650, image: IMG('photo-1470337458703-46ad1756a187') },
  { name: 'Shrimp Gambas 1kg', unit: 'Kilogram', stock_qty: 8, reorder_level: 2, cost_price: 520.00, is_perishable: 1, shelf_life_days: 4, image: IMG('photo-1559742811-822873691df8') },
  { name: 'Potato Fries 2kg', unit: 'Kilogram', stock_qty: 14, reorder_level: 4, cost_price: 260.00, is_perishable: 1, shelf_life_days: 30, image: IMG('photo-1541592106381-b31e9677c0e5') },
];

const NEW_MENU = [
  { menu_name: 'Margarita', category: 'Cocktails', selling_price: 300.00, menu_description: 'Classic tequila cocktail with lime and salted rim', inventory: 'Margarita Mix 1L', best: 0 },
  { menu_name: 'Tequila Sunrise', category: 'Cocktails', selling_price: 320.00, menu_description: 'Tequila, orange juice and grenadine sunrise', inventory: 'Orange Juice 1L', best: 0 },
  { menu_name: 'San Miguel Pale Pilsen', category: 'Beers', selling_price: 140.00, menu_description: 'Local classic pale pilsen, 330ml', inventory: 'San Miguel Pale Pilsen Case', best: 0 },
  { menu_name: 'Corona Extra', category: 'Beers', selling_price: 180.00, menu_description: 'Mexican lager served with lime, 355ml', inventory: 'Corona Extra Bucket (6s)', best: 0 },
  { menu_name: 'Hennessy VS', category: 'Spirits', selling_price: 380.00, menu_description: 'Premium cognac, 30ml pour', inventory: 'Hennessy VS 700ml', best: 0 },
  { menu_name: 'Jose Cuervo Tequila', category: 'Spirits', selling_price: 200.00, menu_description: 'Gold tequila shot with salt and lime', inventory: 'Jose Cuervo Especial 750ml', best: 0 },
  { menu_name: 'Sizzling Gambas', category: 'Pulutan', selling_price: 340.00, menu_description: 'Sizzling garlic shrimp in olive oil', inventory: 'Shrimp Gambas 1kg', best: 0 },
  { menu_name: 'Truffle Fries', category: 'Appetizers', selling_price: 220.00, menu_description: 'Crispy fries tossed in truffle oil and parmesan', inventory: 'Potato Fries 2kg', best: 0 },
];

const TABLES = [
  // Existing Table 1 keeps its slot; photo refreshed below.
  { table_number: 'Table 1', floor_assignment: 'Ground Floor', capacity: 5, table_size: 'Medium', price: 300.00, image: IMG('photo-1514933651103-005eec06c04b') },
  { table_number: 'Table 2', floor_assignment: 'Ground Floor', capacity: 4, table_size: 'Small', price: 200.00, image: IMG('photo-1414235077428-338989a2e8c0') },
  { table_number: 'VIP Table 1', floor_assignment: 'VIP Section', capacity: 10, table_size: 'Large', price: 1500.00, image: IMG('photo-1552566626-52f8b828add9') },
  { table_number: 'VIP Booth 1', floor_assignment: 'VIP Section', capacity: 8, table_size: 'Large', price: 1200.00, image: IMG('photo-1559339352-11d035aa65de') },
  { table_number: 'Deck Table 1', floor_assignment: 'Outdoor Deck', capacity: 6, table_size: 'Medium', price: 500.00, image: IMG('photo-1466978913421-dad2ebd01d17') },
  { table_number: 'Deck Table 2', floor_assignment: 'Outdoor Deck', capacity: 4, table_size: 'Small', price: 350.00, image: IMG('photo-1521017432531-fbd92d768814') },
];

async function upsertInventory(conn, item) {
  const [[row]] = await conn.query(
    'SELECT id FROM inventory_items WHERE bar_id = ? AND name = ? LIMIT 1',
    [BAR_ID, item.name]
  );
  if (row) {
    await conn.query(
      `UPDATE inventory_items SET unit = ?, stock_qty = ?, reorder_level = ?, cost_price = ?,
        is_active = 1, is_perishable = ?, shelf_life_days = ?, image_path = ?, status = 'normal', stock_status = 'normal'
       WHERE id = ?`,
      [item.unit, item.stock_qty, item.reorder_level, item.cost_price, item.is_perishable, item.shelf_life_days, item.image, row.id]
    );
    return row.id;
  }
  const [res] = await conn.query(
    `INSERT INTO inventory_items (bar_id, name, unit, stock_qty, reorder_level, cost_price, is_active,
      is_perishable, shelf_life_days, status, stock_status, image_path, created_at, date_added)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'normal', 'normal', ?, NOW(), NOW())`,
    [BAR_ID, item.name, item.unit, item.stock_qty, item.reorder_level, item.cost_price, item.is_perishable, item.shelf_life_days, item.image]
  );
  return res.insertId;
}

async function upsertMenu(conn, item, inventoryId, sortOrder) {
  const [[row]] = await conn.query(
    'SELECT id FROM menu_items WHERE bar_id = ? AND menu_name = ? LIMIT 1',
    [BAR_ID, item.menu_name]
  );
  if (row) {
    await conn.query(
      `UPDATE menu_items SET inventory_item_id = ?, menu_description = ?, selling_price = ?,
        category = ?, is_available = 1, sort_order = ?, is_best_seller = ?, updated_at = NOW() WHERE id = ?`,
      [inventoryId, item.menu_description, item.selling_price, item.category, sortOrder, item.best ? 1 : 0, row.id]
    );
    return row.id;
  }
  const [res] = await conn.query(
    `INSERT INTO menu_items (bar_id, inventory_item_id, menu_name, menu_description, selling_price,
      category, is_available, sort_order, is_best_seller, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NOW(), NOW())`,
    [BAR_ID, inventoryId, item.menu_name, item.menu_description, item.selling_price, item.category, sortOrder, item.best ? 1 : 0]
  );
  return res.insertId;
}

async function upsertTable(conn, t) {
  const [[row]] = await conn.query(
    'SELECT id FROM bar_tables WHERE bar_id = ? AND table_number = ? AND deleted_at IS NULL LIMIT 1',
    [BAR_ID, t.table_number]
  );
  if (row) {
    await conn.query(
      `UPDATE bar_tables SET floor_assignment = ?, capacity = ?, table_size = ?, price = ?,
        is_active = 1, manual_status = 'available', image_path = ? WHERE id = ?`,
      [t.floor_assignment, t.capacity, t.table_size, t.price, t.image, row.id]
    );
    return row.id;
  }
  const [res] = await conn.query(
    `INSERT INTO bar_tables (bar_id, table_number, floor_assignment, capacity, table_size, price, is_active, manual_status, image_path)
     VALUES (?, ?, ?, ?, ?, ?, 1, 'available', ?)`,
    [BAR_ID, t.table_number, t.floor_assignment, t.capacity, t.table_size, t.price, t.image]
  );
  return res.insertId;
}

(async () => {
  const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'tpg', multipleStatements: true });
  try {
    // 1. Photos for existing inventory rows
    for (const [name, image] of Object.entries(INVENTORY_IMAGES)) {
      await conn.query('UPDATE inventory_items SET image_path = ? WHERE bar_id = ? AND name = ?', [image, BAR_ID, name]);
    }
    console.log('Updated photos for existing inventory');

    // 2. New inventory + menu items
    let sort = 100;
    for (const item of NEW_INVENTORY) {
      await upsertInventory(conn, item);
    }
    console.log('Upserted new inventory');
    for (const m of NEW_MENU) {
      const [[inv]] = await conn.query('SELECT id FROM inventory_items WHERE bar_id = ? AND name = ? LIMIT 1', [BAR_ID, m.inventory]);
      if (!inv) throw new Error(`Missing inventory row: ${m.inventory}`);
      await upsertMenu(conn, m, inv.id, sort++);
    }
    console.log('Upserted new menu items');

    // 3. Tables with photos
    for (const t of TABLES) {
      await upsertTable(conn, t);
    }
    console.log('Upserted tables');

    // 4. VIP package: Table Required + assigned VIP tables
    await conn.query("UPDATE bar_packages SET requires_table = 1 WHERE bar_id = ? AND name = 'VIP Pegasus Night Package'", [BAR_ID]);
    const [[vip]] = await conn.query("SELECT id FROM bar_packages WHERE bar_id = ? AND name = 'VIP Pegasus Night Package' LIMIT 1", [BAR_ID]);
    if (vip) {
      const [vipTables] = await conn.query(
        "SELECT id FROM bar_tables WHERE bar_id = ? AND table_number IN ('VIP Table 1','VIP Booth 1') AND deleted_at IS NULL",
        [BAR_ID]
      );
      for (const t of vipTables) {
        await conn.query('INSERT IGNORE INTO package_tables (package_id, table_id) VALUES (?, ?)', [vip.id, t.id]);
      }
      console.log(`VIP package (${vip.id}) assigned ${vipTables.length} table(s)`);
    }

    // Summary
    const [[ic]] = await conn.query('SELECT COUNT(*) c FROM inventory_items WHERE bar_id = ?', [BAR_ID]);
    const [[mc]] = await conn.query('SELECT COUNT(*) c FROM menu_items WHERE bar_id = ?', [BAR_ID]);
    const [[tc]] = await conn.query('SELECT COUNT(*) c FROM bar_tables WHERE bar_id = ? AND deleted_at IS NULL', [BAR_ID]);
    const [[pc]] = await conn.query('SELECT COUNT(*) c FROM bar_packages WHERE bar_id = ? AND deleted_at IS NULL', [BAR_ID]);
    console.log(`Pegasus bar ${BAR_ID}: inventory=${ic.c} menu=${mc.c} tables=${tc.c} packages=${pc.c}`);
    console.log('SEED OK');
  } catch (e) {
    console.error('SEED ERROR:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
