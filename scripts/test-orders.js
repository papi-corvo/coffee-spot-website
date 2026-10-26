/* Run:  node db/test-orders.js
   Tests the order functions in a temporary in-memory database (your real data is not touched).
   Every "ok" line is a rule working; a "FAIL" line shows exactly what broke. */
process.env.COFFEESPOT_DB = ':memory:';
const { db } = require('../src/db/db');
const realLog = console.log; console.log = () => {};          // hide the seed's own printout
require('./seed-menu');
console.log = realLog;
const orders = require('../src/db/orders');
const { getMenu } = require('../src/db/menu');

let failed = 0;
const ok = (label, cond, extra = '') => { if (!cond) failed++; console.log((cond ? 'ok   ' : 'FAIL ') + '- ' + label + (cond ? '' : '  ' + extra)); };
const fails = (label, fn, status, text) => {
  try { fn(); ok(label + ' (was accepted!)', false); }
  catch (e) { ok(label + `  [${e.status || '?'}: ${e.message}]`, e.status === status && (!text || e.message.includes(text)), e.stack); }
};
const person = { receiverName: 'Maria Santos', type: 'pickup' };
const latte = { item: 'Cafe Latte', variant: 'medium', qty: 2 };
const roll = { item: 'cinnamon-roll', qty: 1 };                 // slug works, single size needs no variant

console.log('--- menu ---');
const menu = getMenu();
ok('menu has 5 categories and 70 items', menu.categories.length === 5 && menu.categories.reduce((n, c) => n + c.items.length, 0) === 70);
const esp = menu.categories[0].items.find((i) => i.slug === 'espresso');
ok('Espresso large is "not available" (price null)', esp.variants.find((v) => v.code === 'large').price === null);

console.log('\n--- creating orders ---');
const o1 = orders.createOrder({ ...person, items: [latte, roll], note: ' less   ice ' });
ok('code looks like A-XXXXXXXX', /^A-[0-9A-F]{8}$/.test(o1.id), o1.id);
ok('status starts as new, type shows Pick-up', o1.status === 'new' && o1.type === 'Pick-up');
ok('total = 2 x 120 + 140 = 380 (priced by the server)', o1.totals.total === 380 && o1.totals.sub === 380);
ok('note is tidied', o1.note === 'less ice');
ok('items have name, size, price, qty like the cashier expects', o1.items[0].name === 'Cafe Latte' && o1.items[0].size === 'Medium' && o1.items[0].price === 120 && o1.items[0].qty === 2);
const tampered = orders.createOrder({ ...person, items: [{ ...latte, price: 1, unit_price: 1, total: 1 }], total: 1 });
ok('a price sent by the browser is ignored', tampered.totals.total === 240);

console.log('\n--- options and defaults ---');
const cap = orders.createOrder({ ...person, items: [{ item: 'Cappuccino', variant: 'medium', qty: 1 }] });
ok('Cappuccino gets its default (Hot)', cap.items[0].name === 'Cappuccino — Hot', cap.items[0].name);
const capI = orders.createOrder({ ...person, items: [{ item: 'Cappuccino', variant: 'large', qty: 1, options: ['Iced'] }] });
ok('Cappuccino iced, large = 150', capI.items[0].name === 'Cappuccino — Iced' && capI.items[0].price === 150);
const katsu = orders.createOrder({ ...person, items: [{ item: 'Katsu Burger', qty: 1, options: ['Fries', 'Bacon'] }] });
ok('Katsu Burger + Fries + Bacon = 178 + 45 + 35 = 258', katsu.items[0].price === 258 && katsu.items[0].name === 'Katsu Burger — Fries, Bacon', JSON.stringify(katsu.items[0]));
const wings = orders.createOrder({ ...person, items: [{ item: 'Chicken Wings', variant: 'w/rice-4pcs', qty: 1, options: ['Wings Sauce'] }] });
ok('Wings: default flavor + sauce = 200 + 20', wings.items[0].price === 220 && wings.items[0].options.length === 2, JSON.stringify(wings.items[0].options));
fails('two temperatures at once', () => orders.createOrder({ ...person, items: [{ item: 'Cappuccino', variant: 'medium', qty: 1, options: ['Hot', 'Iced'] }] }), 400, 'only one');
fails('an option the item does not have', () => orders.createOrder({ ...person, items: [{ item: 'Cafe Latte', variant: 'medium', qty: 1, options: ['Bacon'] }] }), 400, 'no option');

console.log('\n--- bad orders are refused ---');
fails('unknown item', () => orders.createOrder({ ...person, items: [{ item: 'Pizza', qty: 1 }] }), 400, 'Unknown menu item');
fails('size missing on a 2-size item', () => orders.createOrder({ ...person, items: [{ item: 'Cafe Latte', qty: 1 }] }), 400, 'choose a size');
fails('Espresso large (price null)', () => orders.createOrder({ ...person, items: [{ item: 'Espresso', variant: 'large', qty: 1 }] }), 409, 'not available');
db.prepare("UPDATE menu_items SET active = 0 WHERE slug = 'lychee'").run();
fails('item switched off (Lychee)', () => orders.createOrder({ ...person, items: [{ item: 'Lychee', variant: 'medium', qty: 1 }] }), 409, 'not available');
fails('quantity 0', () => orders.createOrder({ ...person, items: [{ ...latte, qty: 0 }] }), 400, 'Quantity');
fails('quantity 21', () => orders.createOrder({ ...person, items: [{ ...latte, qty: 21 }] }), 400, 'Quantity');
fails('no items', () => orders.createOrder({ ...person, items: [] }), 400, 'no items');
fails('name with symbols', () => orders.createOrder({ ...person, receiverName: '<b>x</b>', items: [latte] }), 400, 'valid name');
fails('blank name', () => orders.createOrder({ ...person, receiverName: '  ', items: [latte] }), 400, 'valid name');
fails('bad phone', () => orders.createOrder({ ...person, phone: '12345', items: [latte] }), 400, 'Phone');
fails('delivery without an address', () => orders.createOrder({ ...person, type: 'delivery', items: [latte] }), 400, 'Delivery full name');
ok('a refused order leaves nothing behind (nothing half-saved)', db.prepare('SELECT COUNT(*) n FROM orders').get().n === 6, String(db.prepare('SELECT COUNT(*) n FROM orders').get().n));

console.log('\n--- delivery ---');
const del = orders.createOrder({ receiverName: 'Ben Torres', type: 'Delivery', payPref: 'GCash', items: [latte],
  address: { fullName: 'Ben Torres', phone: '09171234567', street: 'House 12, Main St', barangay: 'Gulang-Gulang', city: 'Lucena City', notes: 'blue gate' } });
ok('address saved and returned, phone copied from the address', del.address.street === 'House 12, Main St' && del.phone === '09171234567' && del.type === 'Delivery' && del.payPref === 'GCash');

console.log('\n--- listing ---');
ok('list new orders, oldest first', orders.listOrders({ status: 'new' }).length === 7 && orders.listOrders({ status: 'new' })[0].id === o1.id);
ok('find by QR text "CS:A-..."', orders.getOrder('CS:' + o1.id.toLowerCase()).id === o1.id);
ok('findOrder returns null for an unknown code', orders.findOrder('A-00000000') === null);
fails('getOrder on an unknown code', () => orders.getOrder('A-00000000'), 404);
fails('unknown status filter', () => orders.listOrders({ status: 'hacked' }), 400);

console.log('\n--- cashier edits ---');
const edited = orders.replaceItems(o1.id, [{ item: 'Cafe Latte', variant: 'large', qty: 3 }]);
ok('items replaced and re-priced: 3 x 130 = 390', edited.totals.total === 390 && edited.items.length === 1);
fails('cannot remove every item', () => orders.replaceItems(o1.id, []), 400, 'no items');
ok('note can be changed', orders.setNote(o1.id, 'no sugar').note === 'no sugar');

console.log('\n--- status rules ---');
ok('new -> accepted', orders.setStatus(o1.id, 'accepted').status === 'accepted');
fails('accepted -> new (going back)', () => orders.setStatus(o1.id, 'new'), 409);
fails('"done" can only come from a payment', () => orders.setStatus(o1.id, 'done'), 400, 'payment');
ok('accepted -> ready', orders.setStatus(o1.id, 'ready').status === 'ready');
fails('voiding without a reason', () => orders.setStatus(o1.id, 'voided'), 400, 'reason');
ok('ready -> voided with a reason', orders.setStatus(o1.id, 'voided', { reason: 'Customer cancelled' }).status === 'voided');
fails('a voided order cannot be edited', () => orders.replaceItems(o1.id, [latte]), 409);
fails('a voided order cannot change status again', () => orders.setStatus(o1.id, 'accepted'), 409);
const hist = db.prepare('SELECT from_status f, to_status t, reason FROM status_history sh JOIN orders o ON o.id = sh.order_id WHERE o.code = ? ORDER BY sh.id').all(o1.id);
ok('every change is in the history', hist.map((h) => `${h.f}>${h.t}`).join(' ') === 'null>new new>accepted accepted>ready ready>voided', JSON.stringify(hist));
const rej = orders.createOrder({ ...person, items: [latte] });
ok('new -> rejected with a reason', orders.setStatus(rej.id, 'rejected', { reason: 'Out of stock' }).status === 'rejected');

console.log('\n--- totals and discounts ---');
const q0 = orders.createOrder({ ...person, items: [latte, roll] });
ok('regular: 380', orders.quoteTotals(q0.id).totalCentavos === 38000);
const pwd = orders.quoteTotals(q0.id, 'pwd');
ok('PWD 20%: discount 76.00, total 304.00', pwd.disc === 76 && pwd.total === 304 && pwd.rateBps === 2000);
ok('senior 20%: total 304.00', orders.quoteTotals(q0.id, 'senior').total === 304);
ok('rounding: 20% of 333.33 -> 66.67 (half a centavo rounds up)', orders.discountAmount(33333, 2000) === 6667);
ok('rounding: 20% of 100.05 -> 20.01', orders.discountAmount(10005, 2000) === 2001);
fails('unknown discount type', () => orders.quoteTotals(q0.id, 'vip'), 400);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);