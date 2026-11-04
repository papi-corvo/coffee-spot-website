/* =====================================================================
   COFFEE SPOT RECEIPT — receipt.js
   ===================================================================== */
(() => {
  'use strict';

  const BUSINESS = {
    name: 'Coffee Spot',
    address: '2124 Tayabas - Lucena Road, Lucena City',
    phone: '',                       
    tin: '000-000-000-000',          
    website: '',
  };
  const CASHIER = 'Maria S.';        
  const VAT_REGISTERED = false;      
  const VAT_RATE = 0.12;
  const FOOTER_NOTE = 'Thank you! Come again.';

  const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const row = (l, r, cls = '') => `<div class="csr-row ${cls}"><span>${l}</span><span>${r}</span></div>`;
  const METHOD = { cash: 'Cash', gcash: 'GCash', maya: 'Maya' };
  const DISCOUNT = { pwd: 'PWD discount (20%)', senior: 'Senior discount (20%)' };

  function amounts(o) {
    if (o.totals) return o.totals;                       
    const sub = o.items.reduce((s, i) => s + i.price * i.qty, 0);
    return { sub, disc: 0, total: sub };                 
  }

  // ==========================================
  // 1. THERMAL PRINT BUILD LOGIC (Restored)
  // ==========================================
  function build(o) {
    const paid = o.status === 'done';
    const t = amounts(o);
    const when = new Date(o.paidAt || Date.now());
    const dateStr = when.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' });
    const name = o.receiverName || o.customer || 'No name';
    const a = o.address;

    const items = o.items.map((i) => `
      <div class="csr-item">
        <div>${esc(i.name)}</div>
        ${row(`${i.qty} x ${peso(i.price)} <span class="csr-muted">(${esc(i.size)})</span>`, peso(i.price * i.qty))}
      </div>`).join('');

    const discount = (paid && o.discount && o.discount.type !== 'regular') ? `
      ${row(DISCOUNT[o.discount.type] || 'Discount', '-' + peso(t.disc))}
      <div class="csr-muted csr-small">ID: ${esc(o.discount.id)}${o.discount.name ? ' · ' + esc(o.discount.name) : ''}</div>` : '';

    let vat = '';
    if (VAT_REGISTERED && paid) {
      const vatable = t.total / (1 + VAT_RATE);
      vat = `<hr>
        ${row('VATable sales', peso(vatable))}
        ${row('VAT (12%)', peso(t.total - vatable))}
        ${row('VAT-exempt', peso(0))}
        ${row('Zero-rated', peso(0))}`;
    }

    let payment = '';
    if (paid && o.payment) {
      const p = o.payment;
      payment = `<hr>
        ${row('Paid via', esc(METHOD[p.method] || p.method))}
        ${p.method === 'cash'
          ? row('Cash received', peso(p.cash)) + row('Change', peso(Math.max(0, p.cash - t.total)))
          : row('Reference no.', esc(p.ref))}`;
    }

    const delivery = (o.type === 'Delivery' && a) ? `
      <hr>
      <div class="csr-small">
        <div>Deliver to: ${esc(a.fullName)}${a.phone ? ' · ' + esc(a.phone) : ''}</div>
        <div>${esc(a.street)}, ${esc(a.barangay)}, ${esc(a.city)}</div>
        ${a.notes ? `<div class="csr-muted">Note: ${esc(a.notes)}</div>` : ''}
      </div>` : '';

    return `
      <div class="csr-center">
        <div class="csr-biz">${esc(BUSINESS.name)}</div>
        <div>${esc(BUSINESS.address)}</div>
        ${BUSINESS.phone ? `<div>${esc(BUSINESS.phone)}</div>` : ''}
        <div class="csr-muted">TIN: ${esc(BUSINESS.tin)}</div>
        <div class="csr-title">${paid ? 'RECEIPT' : 'ORDER SLIP — UNPAID'}</div>
      </div>
      <hr>
      ${paid && o.receiptNo ? row('Receipt no.', esc(o.receiptNo)) : ''}
      ${row('Order no.', esc(o.id))}
      ${row('Date', esc(dateStr))}
      ${row('Order type', esc(o.type))}
      ${row('Channel', 'Website')}
      ${row('Cashier', esc(CASHIER))}
      ${row('Name', esc(name))}
      ${delivery}
      <hr>
      ${items}
      ${o.note ? `<div class="csr-muted csr-small">Note: ${esc(o.note)}</div>` : ''}
      <hr>
      ${row('Subtotal', peso(t.sub))}
      ${discount}
      ${row('TOTAL', peso(t.total), 'csr-total')}
      ${vat}
      ${payment}
      <hr>
      <div class="csr-center">
        <div>${esc(FOOTER_NOTE)}</div>
        ${BUSINESS.website ? `<div class="csr-muted">${esc(BUSINESS.website)}</div>` : ''}
        ${paid ? '' : '<div class="csr-muted csr-small">Not a proof of payment.</div>'}
      </div>`;
  }

  function print(o) {
    if (!o) return;
    let el = document.getElementById('csReceipt');
    if (!el) {
      el = document.createElement('div');
      el.id = 'csReceipt';
      el.setAttribute('aria-hidden', 'true');
      document.body.append(el);
    }
    el.innerHTML = build(o);
    window.print();
  }

  // ==========================================
  // 2. GCASH-STYLE MODAL LOGIC
  // ==========================================
  function showModal(o, payMethodOverride) {
    if (!o) return;
    window.currentReceiptOrder = o; // Save for the print button
    
    const t = amounts(o);
    const when = new Date(o.paidAt || Date.now());

    // Populate Meta
    document.getElementById('rcpNo').textContent = o.receiptNo || 'N/A';
    document.getElementById('rcpOrderCode').textContent = o.id;
    document.getElementById('rcpDate').textContent = when.toLocaleString('en-PH');
    document.getElementById('rcpCashier').textContent = CASHIER;

    // Populate Items
    document.getElementById('rcpItems').innerHTML = o.items.map(i => `
      <div class="rcp-item">
        <span class="rcp-item-qty">${i.qty}x</span>
        <span class="rcp-item-name">${esc(i.name)} (${esc(i.size)})</span>
        <span>${peso(i.price * i.qty)}</span>
      </div>
    `).join('');

    // Populate Totals
    document.getElementById('rcpSubtotal').textContent = peso(t.sub);
    document.getElementById('rcpDiscount').textContent = '-' + peso(t.disc);
    document.getElementById('rcpTotal').textContent = peso(t.total);

    // Populate Payment
    if (o.payment) {
      const methodUsed = payMethodOverride || o.payment.method;
      document.getElementById('rcpPaymentMethod').textContent = (METHOD[methodUsed] || methodUsed).toUpperCase();
      
      const cashRow = document.getElementById('rcpCashRow');
      const changeRow = document.getElementById('rcpChangeRow');

      if (methodUsed === 'cash') {
        document.getElementById('rcpCash').textContent = peso(o.payment.cash);
        document.getElementById('rcpChange').textContent = peso(Math.max(0, o.payment.cash - t.total));
        cashRow.style.display = 'flex';
        changeRow.style.display = 'flex';
      } else {
        cashRow.style.display = 'none';
        changeRow.style.display = 'none';
      }
    }

    document.getElementById('receiptOverlay').hidden = false;
    document.getElementById('receiptModal').hidden = false;
  }

  function hideModal() {
    document.getElementById('receiptOverlay').hidden = true;
    document.getElementById('receiptModal').hidden = true;
  }

  // Expose functions
  window.CoffeeSpotReceipt = { build, print, showModal, hideModal };

  // Listeners
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('rcpCloseBtn')?.addEventListener('click', hideModal);
    document.getElementById('receiptOverlay')?.addEventListener('click', hideModal);
    
    document.getElementById('rcpPrintBtn')?.addEventListener('click', () => {
      if (window.currentReceiptOrder) {
        print(window.currentReceiptOrder);
      }
    });
    
    document.getElementById('rcpDownloadBtn')?.addEventListener('click', () => {
      const captureArea = document.getElementById('receiptCaptureArea');
      if (!captureArea || typeof html2canvas === 'undefined') return;
      
      html2canvas(captureArea).then(canvas => {
        const link = document.createElement('a');
        link.download = `Receipt-${document.getElementById('rcpOrderCode').textContent}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    });
  });

})();

// Lookup logic (keep as is)
(() => {
  const form = document.getElementById('cxLookupForm');
  if(!form) return;
  const input = document.getElementById('cxLookupInput');
  const btn = document.getElementById('cxLookupBtn');
  const out = document.getElementById('cxLookupResult');
  const go = async () => {
    const ref = input.value.trim();
    if (!ref) { out.textContent = 'Enter an order or receipt number.'; return; }
    out.textContent = 'Looking up…';
    try {
      const o = await CoffeeSpotAPI.receipt(ref);
      if (!o) { out.textContent = 'No order found for “' + ref + '”.'; return; }
      out.innerHTML = `Found <b>${o.id}</b> · ${o.status} ·
        <button type="button" class="cx-btn" id="cxReprint">Print receipt</button>`;
      document.getElementById('cxReprint').addEventListener('click', () => CoffeeSpotReceipt.print(o));
    } catch (e) { out.textContent = 'Lookup failed: ' + e.message; }
  };
  btn.addEventListener('click', go);
  form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
})();