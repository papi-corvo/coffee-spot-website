const crypto = require('crypto');
const { db } = require('./db');
const { AppError } = require('./errors');
const { resolveLine } = require('./menu');
const settings = require('./settings');

const MAX_QTY = 20, MAX_LINES = 50;
const NAME_RULE = /^\p{L}[\p{L}\p{M} .'-]{1,59}$/u;
const PHONE_RULE = /^09\d{9}$/;
const TYPES = { pickup: 'pickup', 'pick-up': 'pickup', 'pick up': 'pickup', delivery: 'delivery' };
const TYPE_LABEL = { pickup: 'Pick-up', delivery: 'Delivery' };
const PAY = ['cash', 'gcash', 'maya'];
const PAY_LABEL = { cash: 'Cash', gcash: 'GCash', maya: 'Maya' };

const STATUSES = ['pending', 'new', 'accepted', 'ready', 'done', 'rejected', 'voided'];
const EDITABLE = ['pending', 'new', 'accepted', 'ready'];          // items can change only in these
// 'done' is not listed: an order only becomes done by recording a payment (Step 4).
const TRANSITIONS = {
  pending: ['new', 'rejected', 'voided'],
  new: ['accepted', 'rejected', 'voided'],
  accepted: ['ready', 'voided'],
  ready: ['voided'],
  done: [], rejected: [], voided: [],
};

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const normCode = (c) => clean(c, 30).toUpperCase().replace(/^CS:/, '');

/* ---------- rounding: half a centavo rounds up ---------- */
const discountAmount = (subCentavos, rateBps) => Math.floor((subCentavos * rateBps + 5000) / 10000);

/* ---------- reading ---------- */
function rowByCode(code) {
  const row = db.prepare('SELECT * FROM orders WHERE code = ?').get(normCode(code));
  if (!row) throw new AppError('Order not found.', 404);
  return row;
}

function hydrate(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id), ph = ids.map(() => '?').join(',');
  const group = (list, key) => list.reduce((m, r) => { (m[r[key]] ||= []).push(r); return m; }, {});
  const q = (sql) => db.prepare(sql).all(...ids);

  const addr = Object.fromEntries(q(`SELECT * FROM delivery_addresses WHERE order_id IN (${ph})`).map((r) => [r.order_id, r]));
  const items = group(q(`SELECT * FROM order_items WHERE order_id IN (${ph}) ORDER BY id`), 'order_id');
  const opts = group(q(`SELECT o.* FROM order_item_options o JOIN order_items i ON i.id = o.order_item_id WHERE i.order_id IN (${ph}) ORDER BY o.id`), 'order_item_id');
  const disc = Object.fromEntries(q(`SELECT * FROM order_discounts WHERE order_id IN (${ph})`).map((r) => [r.order_id, r]));
  const pay = Object.fromEntries(q(`SELECT * FROM payments WHERE order_id IN (${ph})`).map((r) => [r.order_id, r]));
  const rec = Object.fromEntries(q(`SELECT * FROM receipts WHERE order_id IN (${ph})`).map((r) => [r.order_id, r]));

  return rows.map((o) => {
    const lines = (items[o.id] || []).map((it) => {
      const options = (opts[it.id] || []).map((x) => ({ name: x.name, price: x.price_centavos / 100 }));
      return {
        id: it.id, item: it.name, size: it.size, qty: it.quantity, price: it.unit_price_centavos / 100, options,
        name: options.length ? `${it.name} — ${options.map((x) => x.name).join(', ')}` : it.name,   // what the cart shows
      };
    });
    const subC = (items[o.id] || []).reduce((s, it) => s + it.unit_price_centavos * it.quantity, 0);
    const discC = disc[o.id] ? disc[o.id].amount_centavos : 0;
    const out = {
      id: o.code, status: o.status, channel: o.channel,
      type: TYPE_LABEL[o.order_type], receiverName: o.receiver_name, phone: o.phone,
      payPref: PAY_LABEL[o.pay_pref], note: o.note,
      time: new Date(o.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }),
      createdAt: o.created_at,
      address: addr[o.id] ? { fullName: addr[o.id].full_name, phone: addr[o.id].phone || '', street: addr[o.id].street,
                              barangay: addr[o.id].barangay, city: addr[o.id].city, notes: addr[o.id].notes || '' } : null,
      items: lines,
      totals: { sub: subC / 100, disc: discC / 100, total: (subC - discC) / 100 },
    };
    if (disc[o.id]) out.discount = { type: disc[o.id].type, id: disc[o.id].id_number, name: disc[o.id].name_on_id || '' };
    if (pay[o.id]) {
      out.payment = { method: pay[o.id].method, cash: (pay[o.id].tendered_centavos || 0) / 100, ref: pay[o.id].reference_no || '' };
      out.paidAt = pay[o.id].paid_at;
    }
    if (rec[o.id]) out.receiptNo = rec[o.id].receipt_no;
    return out;
  });
}

const getOrder = (code) => hydrate([rowByCode(code)])[0];
const findOrder = (code) => { try { return getOrder(code); } catch (e) { if (e.status === 404) return null; throw e; } };

function listOrders({ status, limit = 500 } = {}) {
  const wanted = status ? [].concat(status) : [];
  for (const s of wanted) if (!STATUSES.includes(s)) throw new AppError(`Unknown status: ${s}.`);
  const where = wanted.length ? `WHERE status IN (${wanted.map(() => '?').join(',')})` : '';
  const rows = db.prepare(`SELECT * FROM (SELECT * FROM orders ${where} ORDER BY created_at DESC, id DESC LIMIT ?)
                           ORDER BY created_at ASC, id ASC`).all(...wanted, Math.min(Math.max(limit, 1), 1000));
  return hydrate(rows);
}

/* ---------- writing ---------- */
function validateHeader(input = {}) {
  const receiverName = clean(input.receiverName, 60);
  if (!NAME_RULE.test(receiverName)) throw new AppError('Please enter a valid name for the order.');
  const type = TYPES[clean(input.type, 20).toLowerCase()];
  if (!type) throw new AppError('Order type must be pick-up or delivery.');
  const payPref = clean(input.payPref, 10).toLowerCase() || 'cash';
  if (!PAY.includes(payPref)) throw new AppError('Payment must be cash, GCash or Maya.');

  let phone = clean(input.phone, 20), address = null;
  if (type === 'delivery') {
    const a = input.address || {};
    address = { fullName: clean(a.fullName, 80), phone: clean(a.phone, 20), street: clean(a.street, 160),
                barangay: clean(a.barangay, 80), city: clean(a.city, 80), notes: clean(a.notes, 300) };
    for (const [k, label] of [['fullName', 'full name'], ['street', 'street'], ['barangay', 'barangay'], ['city', 'city']])
      if (!address[k]) throw new AppError(`Delivery ${label} is required.`);
    if (address.phone && !PHONE_RULE.test(address.phone)) throw new AppError('Phone number must be 11 digits starting with 09.');
    phone = phone || address.phone;
  }
  if (phone && !PHONE_RULE.test(phone)) throw new AppError('Phone number must be 11 digits starting with 09.');
  return { receiverName, type, payPref, phone: phone || null, note: clean(input.note, 300), address };
}

function priceLines(items) {
  if (!Array.isArray(items) || !items.length) throw new AppError('The order has no items.');
  if (items.length > MAX_LINES) throw new AppError(`An order can have at most ${MAX_LINES} lines.`);

  return items.map((line) => {
    const qty = Number(line?.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new AppError(`Quantity must be a whole number from 1 to ${MAX_QTY}.`);
    
    return { ...resolveLine(line), qty };        // the price comes from the menu table, whatever the browser sent
  });
}

function insertLines(orderId, lines) {
  const addLine = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, size, unit_price_centavos, quantity) VALUES (?, ?, ?, ?, ?, ?)');
  const addOpt = db.prepare('INSERT INTO order_item_options (order_item_id, name, price_centavos) VALUES (?, ?, ?)');
  for (const l of lines) {
    const id = addLine.run(orderId, l.menuItemId, l.name, l.size, l.unitCentavos, l.qty).lastInsertRowid;
    for (const o of l.options) addOpt.run(id, o.name, o.centavos);
  }
}
const touch = (id) => db.prepare(`UPDATE orders SET updated_at = ${NOW} WHERE id = ?`).run(id);
const history = (orderId, from, to, staffId, reason) =>
  db.prepare('INSERT INTO status_history (order_id, from_status, to_status, staff_id, reason) VALUES (?, ?, ?, ?, ?)').run(orderId, from, to, staffId ?? null, reason || null);

function newCode() {
  for (let i = 0; i < 8; i++) {
    const code = 'A-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    if (!db.prepare('SELECT 1 FROM orders WHERE code = ?').get(code)) return code;
  }
  throw new AppError('Could not create an order code. Please try again.', 500);
}

function createOrder(input) {
  return db.transaction(() => {
    const h = validateHeader(input);
    const lines = priceLines(input?.items);
    const orderId = db.prepare(
      'INSERT INTO orders (code, status, order_type, receiver_name, phone, pay_pref, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(newCode(), 'new', h.type, h.receiverName, h.phone, h.payPref, h.note).lastInsertRowid;
    if (h.address) db.prepare('INSERT INTO delivery_addresses (order_id, full_name, phone, street, barangay, city, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(orderId, h.address.fullName, h.address.phone || null, h.address.street, h.address.barangay, h.address.city, h.address.notes || null);
    insertLines(orderId, lines);
    history(orderId, null, 'new', null, 'Order placed');
    return hydrate([db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)])[0];
  })();
}

function replaceItems(code, items, { staffId = null } = {}) {
  return db.transaction(() => {
    const o = rowByCode(code);
    if (!EDITABLE.includes(o.status)) throw new AppError(`A ${o.status} order can no longer be edited.`, 409);
    const lines = priceLines(items);              // also rejects an empty list: void the order instead
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(o.id);   // its options go with it
    insertLines(o.id, lines);
    touch(o.id);
    return hydrate([db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id)])[0];
  })();
}

function setNote(code, note) {
  const o = rowByCode(code);
  if (!EDITABLE.includes(o.status)) throw new AppError(`A ${o.status} order can no longer be edited.`, 409);
  db.prepare('UPDATE orders SET note = ? WHERE id = ?').run(clean(note, 300), o.id);
  touch(o.id);
  return getOrder(code);
}

function setStatus(code, to, { staffId = null, reason = null } = {}) {
  if (!STATUSES.includes(to)) throw new AppError(`Unknown status: ${to}.`);
  if (to === 'done') throw new AppError('An order is completed by recording its payment.');
  return db.transaction(() => {
    const o = rowByCode(code);
    if (!TRANSITIONS[o.status].includes(to)) throw new AppError(`An order cannot go from ${o.status} to ${to}.`, 409);
    if ((to === 'rejected' || to === 'voided') && !clean(reason, 120)) throw new AppError('A reason is required.');
    db.prepare(`UPDATE orders SET status = ?, updated_at = ${NOW} WHERE id = ?`).run(to, o.id);
    history(o.id, o.status, to, staffId, clean(reason, 120));
    return hydrate([db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id)])[0];
  })();
}

function quoteTotals(code, discountType = 'regular') {
  if (!['regular', 'pwd', 'senior'].includes(discountType)) throw new AppError('Discount must be regular, PWD or senior.');
  const o = rowByCode(code);
  const sub = db.prepare('SELECT COALESCE(SUM(unit_price_centavos * quantity), 0) AS s FROM order_items WHERE order_id = ?').get(o.id).s;
  const rateBps = discountType === 'regular' ? 0 : settings.getInt(`discount_${discountType}_bps`, 0);
  const disc = discountAmount(sub, rateBps);
  return { subCentavos: sub, discCentavos: disc, totalCentavos: sub - disc, rateBps,
           sub: sub / 100, disc: disc / 100, total: (sub - disc) / 100 };
}

function payOrder(code, { method, tenderedCentavos, staffId, discountType = 'regular' } = {}) {
  return db.transaction(() => {
    const o = rowByCode(code);
    if (o.status === 'done') throw new AppError('This order is already paid.', 409);
    if (o.status === 'voided' || o.status === 'rejected') throw new AppError('Cannot pay a voided or rejected order.', 409);

    const totals = quoteTotals(o.code, discountType);
    const totalCentavos = totals.totalCentavos;

    // 1. Validate Payment
    if (method === 'cash' && tenderedCentavos < totalCentavos) {
      throw new AppError('Cash tendered is less than the total amount.');
    }
    const changeCentavos = method === 'cash' ? (tenderedCentavos - totalCentavos) : null;

    // ==========================================
    // NEW: RECEIPT GENERATION LOGIC
    // ==========================================
    const currentYear = new Date().getFullYear();
    
    // Get the current sequence for this year, or create it if it doesn't exist
    let seqRow = db.prepare('SELECT last_number FROM receipt_sequences WHERE year = ?').get(currentYear);
    if (!seqRow) {
      db.prepare('INSERT INTO receipt_sequences (year, last_number) VALUES (?, 0)').run(currentYear);
      seqRow = { last_number: 0 };
    }

    const nextNumber = seqRow.last_number + 1;
    
    // Update the sequence for the next order
    db.prepare('UPDATE receipt_sequences SET last_number = ? WHERE year = ?').run(nextNumber, currentYear);

    // Format: R-2026-000001 (Padded to 6 digits)
    const receiptNo = `R-${currentYear}-${String(nextNumber).padStart(6, '0')}`;

    // Create a JSON snapshot of the entire order for BIR compliance
    const shopSettings = settings.all(); // Gets your store name, TIN, address from the settings table
    const items = db.prepare('SELECT name, size, unit_price_centavos, quantity FROM order_items WHERE order_id = ?').all(o.id);
    
    const snapshot = {
      shop: shopSettings,
      receipt_no: receiptNo,
      order_code: o.code,
      date: new Date().toISOString(),
      cashier_id: staffId,
      items: items,
      totals: totals,
      payment: { method, tenderedCentavos, change: changeCentavos }
    };

    // Insert the receipt into the database
    db.prepare(`
      INSERT INTO receipts (
        receipt_no, order_id, issued_by, subtotal_centavos, discount_centavos, total_centavos, snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      receiptNo,
      o.id,
      staffId || null,
      totals.subCentavos,
      totals.discCentavos,
      totalCentavos,
      JSON.stringify(snapshot)
    );
    // ==========================================
    // END NEW RECEIPT LOGIC
    // ==========================================

    // 2. Insert into payments table
    db.prepare(`
      INSERT INTO payments (order_id, method, amount_centavos, tendered_centavos, change_centavos, staff_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(o.id, method, totalCentavos, tenderedCentavos || totalCentavos, changeCentavos, staffId || null);

    // 3. Update order status
    db.prepare(`UPDATE orders SET status = 'done', updated_at = ${NOW} WHERE id = ?`).run(o.id);
    
    // 4. Add to history
    history(o.id, o.status, 'done', staffId || null, 'Order paid');

    // 5. Return the hydrated order (which now includes the receiptNo)
    return hydrate([db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id)])[0];
  })();
}

module.exports = { createOrder, getOrder, findOrder, listOrders, replaceItems, setNote, setStatus, quoteTotals,
                   payOrder, discountAmount, STATUSES, EDITABLE, TRANSITIONS, MAX_QTY };