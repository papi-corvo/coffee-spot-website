(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const peso = (n) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const checked = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
  
  // The backend returns prices in pesos, so we just multiply.
  const subtotal = (o) => o.items.reduce((s, i) => s + i.price * i.qty, 0);

  // Frontend uses 20% for preview. The backend will calculate the exact amount on payment.
  const DISCOUNT_RATE = { regular: 0, pwd: 0.20, senior: 0.20 }; 

  let orders = [];
  let tab = 'new';
  let current = null;
  let voidKind = 'void';

  // ---------- FETCHING FROM API ----------
  async function fetchOrders() {
    try {
      const res = await fetch('/api/orders');

      if (res.status === 401) {
        window.location.href = '/loginform.html'; // Redirect to login if unauthorized
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      
      // Auto-switch tab if the current tab is empty but others have orders
      orders = data;
      
      // Update the currently selected order so the UI reflects backend changes
      if (current) {
        const updatedCurrent = orders.find(o => o.id === current.id);
        if (updatedCurrent) current = updatedCurrent;
        else current = null; // Order was deleted or no longer exists
      }
      
      renderQueue();
      renderOrder();
    } catch (err) {
      console.error(err);
    }
  }

  // Poll the server every 5 seconds for new orders
  setInterval(fetchOrders, 5000);

  // ---------- RENDERING ----------
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
      b.innerHTML = `<b>${esc(o.id)}</b> · ${esc(o.receiverName || 'No name')}.<small>${esc(o.type)} · ${o.items.length} item(s) · ${peso(subtotal(o))} · ${esc(o.time)}</small>`;
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
  
  $('cxRefreshQueue').addEventListener('click', fetchOrders);

  function resetCheckout(o) {
    document.querySelector('input[name="cxDiscount"][value="regular"]').checked = true;
    ['cxDiscountId', 'cxDiscountName', 'cxCashIn', 'cxRefNo'].forEach((id) => { $(id).value = ''; });
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

    $('cxEmptyState').hidden = has;
    ['cxItemsTable', 'cxOrderMeta', 'cxNoteBox', 'cxOrderStatus'].forEach((id) => { $(id).hidden = !has; });
    $('cxAddBar').hidden = !editable; // We will hide add item for now since DB doesn't support it via API yet
    $('cxAcceptRow').hidden = !(has && o.status === 'new');

    $('cxPayBtn').disabled = !editable || !o.items.length;
    $('cxVoidBtn').disabled = !editable;
    $('cxPrintBtn').disabled = !has;

    if (has) {
      $('cxOrderTitle').textContent = `Order ${o.id}`;
      $('cxOrderStatus').textContent = { new: 'New', accepted: 'Accepted', done: 'Done', voided: 'Voided', rejected: 'Rejected' }[o.status] || o.status;
      $('cxCustomer').textContent = o.receiverName || 'No name';
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
              <input value="${it.qty}" readonly aria-label="Quantity">
            </div>
          </td>
          <td class="cx-num">${peso(it.price)}</td>
          <td class="cx-num">${peso(it.price * it.qty)}</td>
          <td></td>
        </tr>`).join('');
    } else {
      $('cxOrderTitle').textContent = 'No order selected';
    }
    recalc();
  }

  $('cxOrderNote').addEventListener('input', (e) => { 
    if (current) { current.note = e.target.value; } // Local only for now
  });

  // ---------- TOTALS ----------
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
    $('cxIdFields').hidden = d === 'regular';

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
    $('cxCashFields').hidden = !cash;
    $('cxRefField').hidden = cash;
  }));

  // ---------- ACTIONS (ACCEPT, VOID, PAY) ----------
  
  // ACCEPT
  $('cxAcceptBtn').addEventListener('click', async () => {
    if (!current) return;
    try {
      const res = await fetch(`/api/orders/${current.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      tab = 'accepted'; syncTabs(); fetchOrders();
    } catch (e) { alert(e.message); }
  });

  // VOID / REJECT
  function openVoid(kind) {
    voidKind = kind;
    $('cxVoidTitle').textContent = kind === 'reject' ? 'Reject order' : 'Void order';
    $('cxVoidDialog').showModal();
  }
  $('cxRejectBtn').addEventListener('click', () => openVoid('reject'));
  $('cxVoidBtn').addEventListener('click', () => openVoid('void'));
  
  $('cxVoidDialog').addEventListener('close', async () => {
    const ok = $('cxVoidDialog').returnValue === 'confirm';
    $('cxVoidDialog').returnValue = '';
    if (!ok || !current) return;
    
    const status = voidKind === 'reject' ? 'rejected' : 'voided';
    try {
      const res = await fetch(`/api/orders/${current.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason: $('cxVoidReason').value || 'No reason provided' })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      current = null; renderOrder(); fetchOrders();
    } catch (e) { alert(e.message); }
  });

  // PAYMENT
  $('cxPayBtn').addEventListener('click', async () => {
    if (!current) return;
    const d = checked('cxDiscount'), method = checked('cxPayment'), t = totals();
    
    if (d !== 'regular' && !$('cxDiscountId').value.trim()) return alert("Enter the customer's ID number for the discount.");
    if (method === 'cash' && (Number($('cxCashIn').value) || 0) < t.total) return alert('Cash received is less than the total.');
    if (method !== 'cash' && !$('cxRefNo').value.trim()) return alert('Enter the payment reference number.');

    try {
      const res = await fetch(`/api/orders/${current.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: method,
          tenderedCentavos: Math.round((Number($('cxCashIn').value) || 0) * 100), // convert to centavos
          discountType: d
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert("✅ Payment successful! Order marked as done.");
      fetchOrders(); // This will update the UI and move it to the 'Done' tab
      $('cxPrintBtn').disabled = false; // Enable print
    } catch (e) {
      alert("Payment Failed: " + e.message);
    }
  });

  $('cxPrintBtn').addEventListener('click', () => window.print());

  // Startup
  syncTabs(); 
  fetchOrders();
})();