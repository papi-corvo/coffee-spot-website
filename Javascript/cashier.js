/* =====================================================================
   CASHIER VIEW — cashier.js
   Load at the bottom of cashier.html:
     <script src="Javascript/cashier.js" defer></script>
   Everything is wrapped in (() => { ... })() so none of these names
   can collide with your other scripts (app.js, main.js ...).
   Pattern used throughout:  change the DATA -> saveOrders() -> render.
   ===================================================================== */
(() => {
  'use strict';

  /* ---------- STEP 1 · Data ----------
     Order shape the cashier expects. Match your customer view to this,
     or convert in loadOrders(). */
  const STORAGE_KEY = 'cs_orders';
  const receiverName = sessionStorage.getItem('cs_receiver_name');
if (!receiverName) {
  document.getElementById('orderStartOverlay').classList.remove('is-hidden');
  document.body.classList.add('order-setup-active');
  return;                       // stop checkout, ask for the name
}
  const SAMPLE_ORDERS = [
  { id: 'A-1042', receiverName: 'Ana Reyes', type: 'Dine-in', payPref: 'Cash', time: '9:14 AM', status: 'new', note: '',
    items: [{ name: 'Cafe Latte', size: 'Medium', price: 120, qty: 2 }, { name: 'Cinnamon Roll', size: 'Regular', price: 140, qty: 1 }] },
  { id: 'A-1043', receiverName: 'Ben Torres', type: 'Take-out', payPref: 'GCash', time: '9:16 AM', status: 'new', note: 'extra hot',
    items: [{ name: 'Dirty Matcha', size: 'Large', price: 180, qty: 1 }] },
  ];
  const MENU = {                       // used by "Add item"; replace with your real menu
    'Cafe Americano': { Medium: 110, Large: 120 },
    'Cafe Latte': { Medium: 120, Large: 130 },
    'Dirty Matcha': { Medium: 150, Large: 180 },
    'Cinnamon Roll': { Regular: 140 },
  };
  const DISCOUNT_RATE = { regular: 0, pwd: 0.20, senior: 0.20 };   // confirm real rules/VAT with your accountant

  /* ---------- STEP 2 · Helpers + state ---------- */
  const $ = (id) => document.getElementById(id);
  const peso = (n) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // esc(): customer names/notes are untrusted text. Escape before putting them in innerHTML.
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const checked = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
  const subtotal = (o) => o.items.reduce((s, i) => s + i.price * i.qty, 0);
  const receiver = (o) => o.receiverName || receiver(o) || 'No name';

  // loadOrders/saveOrders are the ONLY places that know where orders live.
  // To use a server later, swap these two (fetch / WebSocket) and nothing else changes.
  function loadOrders() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(SAMPLE_ORDERS); }
    catch { return structuredClone(SAMPLE_ORDERS); }
  }
  function saveOrders() { localStorage.setItem(STORAGE_KEY, JSON.stringify(orders)); }

  let orders = loadOrders();
  let tab = 'new';          // which queue tab is open
  let current = null;       // the order being edited
  let voidKind = 'void';    // 'void' or 'reject'

  /* ---------- STEP 3 · Queue + tabs ---------- */
  function renderQueue() {
    const box = $('cxQueueList');
    const list = orders.filter((o) => o.status === tab);
    box.replaceChildren();
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'cx-empty';
      p.textContent = 'No orders here.';
      box.append(p);
      return;
    }
    list.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cx-ticket';
      if (current && current.id === o.id) b.setAttribute('aria-current', 'true');
      b.innerHTML = `<b>${esc(o.id)}</b> · ${esc(o.receiverName || o.customer || 'No name')}.<small>${esc(o.type)} · ${o.items.length} item(s) · ${peso(subtotal(o))} · ${esc(o.time)}</small>`;
      b.addEventListener('click', () => selectOrder(o.id));
      box.append(b);
    });
  }
  function syncTabs() {
    document.querySelectorAll('.cx-tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.status === tab)));
  }
  document.querySelectorAll('.cx-tab').forEach((t) => t.addEventListener('click', () => {
    tab = t.dataset.status; syncTabs(); renderQueue();
  }));
  $('cxRefreshQueue').addEventListener('click', () => { orders = loadOrders(); renderQueue(); });

  /* ---------- STEP 4 · Show the selected order ---------- */
  function resetCheckout(o) {
    document.querySelector('input[name="cxDiscount"][value="regular"]').checked = true;
    ['cxDiscountId', 'cxDiscountName', 'cxCashIn', 'cxRefNo'].forEach((id) => { $(id).value = ''; });
    // pre-select the payment method the customer chose
    const r = document.querySelector(`input[name="cxPayment"][value="${String(o.payPref).toLowerCase()}"]`);
    if (r) { r.checked = true; r.dispatchEvent(new Event('change')); }
  }
  function selectOrder(id) {
    current = orders.find((o) => o.id === id) || null;
    if (current) resetCheckout(current);
    renderOrder(); renderQueue();
  }
  function renderOrder() {
    const o = current, has = !!o, editable = has && o.status !== 'done';

    // show/hide pieces with the hidden attribute (cashier.css makes [hidden] work)
    $('cxEmptyState').hidden = has;
    ['cxItemsTable', 'cxOrderMeta', 'cxNoteBox', 'cxOrderStatus'].forEach((id) => { $(id).hidden = !has; });
    $('cxAddBar').hidden = !editable;
    $('cxAcceptRow').hidden = !(has && o.status === 'new');

    // enable/disable action buttons
    $('cxPayBtn').disabled = !editable || !o.items.length;
    $('cxVoidBtn').disabled = !editable;
    $('cxPrintBtn').disabled = !has;

    if (has) {
      $('cxOrderTitle').textContent = `Order ${o.id}`;
      $('cxOrderStatus').textContent = { new: 'New', accepted: 'Accepted', done: 'Done' }[o.status];
      $('cxCustomer').textContent = o.receiverName || o.customer || 'No name';
      $('cxOrderType').textContent = o.type;
      $('cxPayPref').textContent = o.payPref;
      $('cxReceived').textContent = o.time;
      $('cxOrderNote').value = o.note || '';
      $('cxOrderNote').disabled = !editable;
      $('cxItemsBody').innerHTML = o.items.map((it, i) => `
        <tr>
          <td>${esc(it.name)}</td>
          <td>${esc(it.size)}</td>
          <td>
            <div class="cx-stepper">
              <button type="button" data-i="${i}" data-d="-1" aria-label="Decrease" ${editable ? '' : 'disabled'}>−</button>
              <input value="${it.qty}" readonly aria-label="Quantity">
              <button type="button" data-i="${i}" data-d="1" aria-label="Increase" ${editable ? '' : 'disabled'}>+</button>
            </div>
          </td>
          <td class="cx-num">${peso(it.price)}</td>
          <td class="cx-num">${peso(it.price * it.qty)}</td>
          <td><button type="button" class="cx-btn" data-rm="${i}" aria-label="Remove ${esc(it.name)}" ${editable ? '' : 'disabled'}>✕</button></td>
        </tr>`).join('');
    } else {
      $('cxOrderTitle').textContent = 'No order selected';
    }
    recalc();
  }

  // Event delegation: ONE listener on the table body handles every row's buttons.
  $('cxItemsBody').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !current) return;
    if (b.dataset.d) {
      const it = current.items[Number(b.dataset.i)];
      it.qty = Math.max(1, it.qty + Number(b.dataset.d));
    }
    if (b.dataset.rm) current.items.splice(Number(b.dataset.rm), 1);
    saveOrders(); renderOrder(); renderQueue();
  });
  $('cxOrderNote').addEventListener('input', (e) => { if (current) { current.note = e.target.value; saveOrders(); } });

  /* ---------- STEP 5 · Totals, discount, change ---------- */
  function totals() {
    const sub = current ? subtotal(current) : 0;
    const disc = Math.round(sub * DISCOUNT_RATE[checked('cxDiscount')] * 100) / 100;
    return { sub, disc, total: sub - disc };
  }
  function recalc() {
    const { sub, disc, total } = totals();
    const d = checked('cxDiscount');
    $('cxSubtotal').textContent = peso(sub);
    $('cxDiscountLabel').textContent = d === 'regular' ? 'Discount' : `${d === 'pwd' ? 'PWD' : 'Senior'} discount (20%)`;
    $('cxDiscountAmount').textContent = '−' + peso(disc);
    $('cxTotal').textContent = peso(total);
    $('cxIdFields').hidden = d === 'regular';            // ID fields only for PWD / Senior

    const cash = Number($('cxCashIn').value) || 0;
    $('cxChange').textContent = peso(Math.max(0, cash - total));

    const steps = [...new Set([50, 100, 500, 1000].map((n) => Math.ceil(total / n) * n))].filter((v) => v >= total && v > 0);
    $('cxQuickCash').innerHTML = steps.map((v) => `<button type="button" data-cash="${v}">${peso(v)}</button>`).join('');
  }
  document.querySelectorAll('input[name="cxDiscount"]').forEach((r) => r.addEventListener('change', recalc));
  $('cxCashIn').addEventListener('input', recalc);
  $('cxQuickCash').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cash]');
    if (b) { $('cxCashIn').value = b.dataset.cash; recalc(); }
  });
  document.querySelectorAll('input[name="cxPayment"]').forEach((r) => r.addEventListener('change', () => {
    const cash = checked('cxPayment') === 'cash';
    $('cxCashFields').hidden = !cash;                    // cash box for cash, reference no. for GCash/Maya
    $('cxRefField').hidden = cash;
  }));

  /* ---------- STEP 6 · Add item dialog ---------- */
  function fillSizes() {
    $('cxAddSize').innerHTML = Object.entries(MENU[$('cxAddItem').value])
      .map(([s, p]) => `<option value="${esc(s)}">${esc(s)} — ${peso(p)}</option>`).join('');
  }
  $('cxAddItemBtn').addEventListener('click', () => {
    $('cxAddItem').innerHTML = Object.keys(MENU).map((n) => `<option>${esc(n)}</option>`).join('');
    fillSizes();
    $('cxAddDialog').showModal();
  });
  $('cxAddItem').addEventListener('change', fillSizes);
  // A <form method="dialog"> closes the dialog and puts the clicked button's value in returnValue.
  $('cxAddDialog').addEventListener('close', () => {
    const ok = $('cxAddDialog').returnValue === 'add';
    $('cxAddDialog').returnValue = '';
    if (!ok || !current) return;
    const name = $('cxAddItem').value, size = $('cxAddSize').value;
    const qty = Math.max(1, Number($('cxAddQty').value) || 1);
    const found = current.items.find((i) => i.name === name && i.size === size);
    if (found) found.qty += qty; else current.items.push({ name, size, price: MENU[name][size], qty });
    saveOrders(); renderOrder(); renderQueue();
  });

  /* ---------- STEP 7 · Accept, reject, void, pay ----------
     Each change updates the order, saves, then re-renders.
     Backend hook: send the order to your server right where saveOrders() is called. */
  $('cxAcceptBtn').addEventListener('click', () => {
    current.status = 'accepted';
    saveOrders(); tab = 'accepted'; syncTabs(); renderOrder(); renderQueue();
  });
  function openVoid(kind) {
    voidKind = kind;
    $('cxVoidTitle').textContent = kind === 'reject' ? 'Reject order' : 'Void order';
    $('cxVoidDialog').showModal();
  }
  $('cxRejectBtn').addEventListener('click', () => openVoid('reject'));
  $('cxVoidBtn').addEventListener('click', () => openVoid('void'));
  $('cxVoidDialog').addEventListener('close', () => {
    const ok = $('cxVoidDialog').returnValue === 'confirm';
    $('cxVoidDialog').returnValue = '';
    if (!ok || !current) return;
    // keep the record (audit trail) instead of deleting it
    Object.assign(current, { status: voidKind === 'reject' ? 'rejected' : 'voided', reason: $('cxVoidReason').value });
    saveOrders(); current = null; renderOrder(); renderQueue();
  });

  $('cxPayBtn').addEventListener('click', () => {
    const d = checked('cxDiscount'), method = checked('cxPayment'), t = totals();
    if (d !== 'regular' && !$('cxDiscountId').value.trim()) return alert("Enter the customer's ID number for the discount.");
    if (method === 'cash' && (Number($('cxCashIn').value) || 0) < t.total) return alert('Cash received is less than the total.');
    if (method !== 'cash' && !$('cxRefNo').value.trim()) return alert('Enter the payment reference number.');
    Object.assign(current, {
      status: 'done',
      discount: { type: d, id: $('cxDiscountId').value.trim(), name: $('cxDiscountName').value.trim() },
      payment: { method, cash: Number($('cxCashIn').value) || 0, ref: $('cxRefNo').value.trim() },
      totals: t,
      paidAt: new Date().toISOString(),
    });
    saveOrders(); renderOrder(); renderQueue();
  });
  $('cxPrintBtn').addEventListener('click', () => window.print());

  /* ---------- STEP 8 · Start up + live updates ----------
     The "storage" event fires when ANOTHER tab (e.g. your customer page) writes
     to localStorage, so new orders can appear without pressing Refresh. */
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    orders = loadOrders();
    if (current) current = orders.find((o) => o.id === current.id) || null;
    renderOrder(); renderQueue();
  });

  syncTabs(); renderQueue(); renderOrder();
})();