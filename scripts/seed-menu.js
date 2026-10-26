/* =====================================================================
   db/seed-menu.js — loads db/menu-data.js (+ shop settings + a first staff row)
   into the database.   Run:  node db/seed-menu.js
   Safe to run again and again:
     * existing items are updated (prices, names, images), never duplicated
     * new items are added
     * items you remove from menu-data.js are switched off (active = 0), not deleted,
       because old orders may still point to them
     * descriptions/ingredients already stored are kept
   ===================================================================== */
const { db } = require('../src/db/db');
const menu = require('../src/db/menu-data');

// ---- sanity checks on the data file before touching the database ----
const slugs = new Set();
for (const m of menu) {
  if (slugs.has(m.slug)) throw new Error('Duplicate slug in menu-data.js: ' + m.slug);
  slugs.add(m.slug);
  for (const [code, label, price] of m.variants) {
    if (!code || !label) throw new Error(`${m.name}: a variant needs a code and a label`);
    if (price !== null && (!Number.isInteger(price) || price < 0)) throw new Error(`${m.name} / ${code}: price must be whole centavos or null`);
  }
}

const upsertItem = db.prepare(`
  INSERT INTO menu_items (slug, name, category, group_name, image, active, sort_order)
  VALUES (@slug, @name, @category, @group, @image, 1, @sort)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name, category = excluded.category, group_name = excluded.group_name,
    image = excluded.image, active = 1, sort_order = excluded.sort_order
  RETURNING id`);
const upsertVariant = db.prepare(`
  INSERT INTO menu_variants (item_id, code, label, price_centavos, sort_order) VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(item_id, code) DO UPDATE SET label = excluded.label, price_centavos = excluded.price_centavos, sort_order = excluded.sort_order`);
const insertOption = db.prepare(
  'INSERT INTO menu_options (item_id, group_name, kind, label, price_centavos, is_default, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');

const SETTINGS = {                       // only added if missing; never overwrites what you changed
  shop_name: 'Coffee Spot',
  shop_address: '2124 Tayabas - Lucena Road, Lucena City',
  shop_phone: '',
  shop_tin: '',
  vat_registered: '0',
  vat_rate_bps: '1200',                  // 1200 = 12.00%
  discount_pwd_bps: '2000',              // 2000 = 20.00%  (confirm real rules with your accountant)
  discount_senior_bps: '2000',
  receipt_footer: 'Thank you! Come again.',
};

db.transaction(() => {
  menu.forEach((m, i) => {
    const { id } = upsertItem.get({ slug: m.slug, name: m.name, category: m.category, group: m.group, image: m.image, sort: i + 1 });

    m.variants.forEach(([code, label, price], n) => upsertVariant.run(id, code, label, price, n));
    const keep = m.variants.map((v) => v[0]);                       // drop sizes that no longer exist
    db.prepare(`DELETE FROM menu_variants WHERE item_id = ? AND code NOT IN (${keep.map(() => '?').join(',')})`).run(id, ...keep);

    db.prepare('DELETE FROM menu_options WHERE item_id = ?').run(id);   // options have no outside references: rewrite them
    m.options.forEach(([group, kind, label, price, isDefault], n) => insertOption.run(id, group, kind, label, price, isDefault, n));
  });

  const all = [...slugs];
  db.prepare(`UPDATE menu_items SET active = 0 WHERE slug NOT IN (${all.map(() => '?').join(',')})`).run(...all);

  for (const [k, v] of Object.entries(SETTINGS)) db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(k, v);
  if (!db.prepare('SELECT 1 FROM staff LIMIT 1').get()) db.prepare("INSERT INTO staff (name, role) VALUES ('Maria S.', 'cashier')").run();
})();

console.log('Menu loaded.\n');
for (const r of db.prepare("SELECT category, COUNT(*) n FROM menu_items WHERE active = 1 GROUP BY category ORDER BY MIN(sort_order)").all())
  console.log('  ' + r.category.padEnd(10) + r.n + ' items');
const c = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
console.log(`\n  total: ${c('menu_items')} items, ${c('menu_variants')} sizes/prices, ${c('menu_options')} options, ${c('settings')} settings, ${c('staff')} staff`);