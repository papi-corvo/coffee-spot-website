/* Run:  node db/selftest.js
   Tries to break the rules on purpose, in a temporary in-memory database
   (your real data file is not touched). Every "ok" line means the database
   correctly refused bad data or accepted good data. */
process.env.COFFEESPOT_DB = ':memory:';
const { db } = require('../src/db/db');

let failed = 0;
const ok = (label, cond) => { if (!cond) failed++; console.log((cond ? 'ok   ' : 'FAIL ') + '- ' + label); };
const mustFail = (label, fn) => { try { fn(); ok(label + ' (was accepted!)', false); } catch (e) { ok(label, true); } };
const mustWork = (label, fn) => { try { fn(); ok(label, true); } catch (e) { ok(label + ' -> ' + e.message, false); } };

const newOrder = (code, status = 'new') =>
  db.prepare("INSERT INTO orders (code, status, order_type, receiver_name) VALUES (?, ?, 'pickup', 'Ana Reyes')").run(code, status).lastInsertRowid;

mustWork('valid order is accepted', () => newOrder('A-00000001'));
mustFail('unknown status is refused', () => newOrder('A-00000002', 'hacked'));
mustFail('duplicate order code is refused', () => newOrder('A-00000001'));
mustFail('empty receiver name is refused', () => db.prepare("INSERT INTO orders (code, order_type, receiver_name) VALUES ('A-3', 'pickup', '   ')").run());

const id = newOrder('A-00000010');
mustWork('order line with price + quantity', () => db.prepare("INSERT INTO order_items (order_id, name, size, unit_price_centavos, quantity) VALUES (?, 'Cafe Latte', 'Medium', 12000, 2)").run(id));
mustFail('quantity 0 is refused', () => db.prepare("INSERT INTO order_items (order_id, name, unit_price_centavos, quantity) VALUES (?, 'x', 100, 0)").run(id));
mustFail('line for a missing order is refused (foreign key)', () => db.prepare("INSERT INTO order_items (order_id, name, unit_price_centavos, quantity) VALUES (99999, 'x', 100, 1)").run());
mustFail('regular is not a discount type', () => db.prepare("INSERT INTO order_discounts (order_id, type, rate_bps, amount_centavos, id_number) VALUES (?, 'regular', 0, 0, 'x')").run(id));
mustFail('PWD discount without ID number is refused', () => db.prepare("INSERT INTO order_discounts (order_id, type, rate_bps, amount_centavos, id_number) VALUES (?, 'pwd', 2000, 4800, '')").run(id));

mustFail('cash payment with less cash than total is refused', () => db.prepare("INSERT INTO payments (order_id, method, amount_centavos, tendered_centavos) VALUES (?, 'cash', 24000, 20000)").run(id));
mustFail('GCash payment without reference number is refused', () => db.prepare("INSERT INTO payments (order_id, method, amount_centavos) VALUES (?, 'gcash', 24000)").run(id));
mustWork('valid cash payment', () => db.prepare("INSERT INTO payments (order_id, method, amount_centavos, tendered_centavos, change_centavos) VALUES (?, 'cash', 24000, 30000, 6000)").run(id));
mustFail('paying the same order twice is refused', () => db.prepare("INSERT INTO payments (order_id, method, amount_centavos, tendered_centavos) VALUES (?, 'cash', 24000, 24000)").run(id));

mustWork('receipt is created', () => db.prepare("INSERT INTO receipts (receipt_no, order_id, subtotal_centavos, total_centavos, snapshot_json) VALUES ('R-2026-000001', ?, 24000, 24000, '{}')").run(id));
mustFail('duplicate receipt number is refused', () => { const o = newOrder('A-00000011'); db.prepare("INSERT INTO receipts (receipt_no, order_id, subtotal_centavos, total_centavos, snapshot_json) VALUES ('R-2026-000001', ?, 1, 1, '{}')").run(o); });
mustFail('second receipt for the same order is refused', () => db.prepare("INSERT INTO receipts (receipt_no, order_id, subtotal_centavos, total_centavos, snapshot_json) VALUES ('R-2026-000002', ?, 1, 1, '{}')").run(id));

db.prepare("INSERT INTO menu_items (slug, name, category) VALUES ('espresso', 'Espresso', 'coffee')").run();
mustWork('menu variant with no price (not available)', () => db.prepare("INSERT INTO menu_variants (item_id, code, label, price_centavos) VALUES (1, 'large', 'Large', NULL)").run());

db.prepare('DELETE FROM payments').run(); db.prepare('DELETE FROM receipts').run();
db.prepare('DELETE FROM orders WHERE id = ?').run(id);
ok('deleting an order also deletes its lines', db.prepare('SELECT COUNT(*) n FROM order_items WHERE order_id = ?').get(id).n === 0);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);