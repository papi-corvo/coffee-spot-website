/* =====================================================================
   admin.js — admin dashboard DRAFT. Runs on sample data.
   Every read/write goes through the `api` object below, so connecting the real
   backend later means replacing those few functions (see the "later:" comments).
   ===================================================================== */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ME = 1;                                   // the signed-in admin (comes from the Supabase login later)
  const CATS = { coffee: 'Coffee', soda: 'Italian soda', tea: 'Tea', pastries: 'Pastries', food: 'Food' };
  const STATUS = { active: 'Active', invited: 'Invited', inactive: 'Inactive' };

  /* ---------- sample data ---------- */
  const SAMPLE = {
    week: [['Fri', 17250], ['Sat', 19800], ['Sun', 0], ['Mon', 14200], ['Tue', 12850], ['Wed', 15900], ['Thu', 18450]],
    ordersToday: 62,
    top: [['Cafe Latte', 48], ['Dirty Matcha', 36], ['Cinnamon Roll', 31], ['Cafe Americano', 29], ['Chicken Wings', 22]],
    pay: [['Cash', 36], ['GCash', 18], ['Maya', 8]],
    orders: [
      { id: 'A-1E54D7C5', name: 'Maria Santos', type: 'Pick-up', total: 380, status: 'new', time: '9:14 AM' },
      { id: 'A-7C20B913', name: 'Ben Torres', type: 'Delivery', total: 250, status: 'accepted', time: '9:08 AM' },
      { id: 'A-3F9A02D4', name: 'Ana Reyes', type: 'Pick-up', total: 120, status: 'done', time: '8:55 AM' },
      { id: 'A-90B1E7AA', name: 'Carlo Dizon', type: 'Pick-up', total: 475, status: 'done', time: '8:41 AM' },
      { id: 'A-52D8C6F1', name: 'Liza Mendoza', type: 'Delivery', total: 330, status: 'voided', time: '8:30 AM' },
    ],
    employees: [
      { id: 1, name: 'Maria S.', email: 'maria@coffeespot.example', role: 'admin', status: 'active' },
      { id: 2, name: 'Jose Ramos', email: 'jose@coffeespot.example', role: 'cashier', status: 'active' },
      { id: 3, name: 'Ella Cruz', email: 'ella@coffeespot.example', role: 'cashier', status: 'invited' },
      { id: 4, name: 'Mark Lim', email: 'mark@coffeespot.example', role: 'cashier', status: 'inactive' },
    ],
    menu: [
      { slug: 'cafe-americano', name: 'Cafe Americano', category: 'coffee', price: 110, active: true },
      { slug: 'cafe-latte', name: 'Cafe Latte', category: 'coffee', price: 120, active: true },
      { slug: 'dirty-matcha', name: 'Dirty Matcha', category: 'coffee', price: 150, active: true },
      { slug: 'passion-fruit', name: 'Passion Fruit', category: 'soda', price: 100, active: true },
      { slug: 'lychee', name: 'Lychee', category: 'soda', price: 100, active: false },
      { slug: 'green-tea', name: 'Green Tea', category: 'tea', price: 100, active: true },
      { slug: 'blueberry-cheesecake', name: 'Blueberry Cheesecake', category: 'pastries', price: 165, active: true },
      { slug: 'cinnamon-roll', name: 'Cinnamon Roll', category: 'pastries', price: 140, active: true },
      { slug: 'chicken-wings', name: 'Chicken Wings', category: 'food', price: 200, active: true },
      { slug: 'katsu-burger', name: 'Katsu Burger', category: 'food', price: 178, active: true },
    ],
  };

  /* ---------- the ONLY place that knows where data comes from ---------- */
  const api = {
    stats: async () => {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return await res.json();
    },
    employees: async () => {
      const res = await fetch('/api/admin/employees');
      if (!res.ok) throw new Error('Failed to fetch employees');
      return await res.json();
    },
    menu: async () => {
      const res = await fetch('/api/admin/menu');
      if (!res.ok) throw new Error('Failed to fetch menu');
      return await res.json();
    },
    // These will be connected in the next phase:
    registerEmployee: async (e) => { console.log('TODO', e); }, 
    updateEmployee: async (id, patch) => { console.log('TODO', id, patch); },
    updateMenuItem: async (slug, patch) => { console.log('TODO', slug, patch); },
  };

  let toastTimer;
  function toast(msg) {
    const t = $('adToast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  /* ---------- overview ---------- */
  function renderOverview(d) {
    const today = d.week[d.week.length - 1][1], yesterday = d.week[d.week.length - 2][1];
    const delta = yesterday ? Math.round(((today - yesterday) / yesterday) * 100) : 0;
    const open = d.orders.filter((o) => ['new', 'accepted', 'ready'].includes(o.status)).length;
    $('adStats').innerHTML = [
      ['Sales today', peso(today), `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs yesterday`],
      ['Orders today', d.ordersToday, 'All channels'],
      ['Average order', peso(d.ordersToday ? (today / d.ordersToday) : 0), 'Per order'],
      ['Open orders', open, 'New, accepted or ready'],
    ].map(([l, v, n]) => `<article class="ad-card ad-stat"><span>${l}</span><strong>${v}</strong><small>${n}</small></article>`).join('');

    const max = Math.max(...d.week.map((w) => w[1]), 1);
    $('adBars').innerHTML = d.week.map(([day, v]) =>
      `<div class="ad-bar" title="${day}: ${peso(v)}"><i style="height:${Math.max((v / max) * 100, 3)}%"></i><span>${day}</span></div>`).join('');

    $('adTopItems').innerHTML = d.top.map(([n, c]) =>
      `<li><span>${esc(n)}</span><b>${c}</b><i style="width:${(c / d.top[0][1]) * 100}%"></i></li>`).join('');

    const total = d.pay.reduce((s, p) => s + p[1], 0);
    $('adPayMix').innerHTML =
      `<div class="ad-mix">${d.pay.map(([n, c], i) => `<i class="ad-mix-${i}" style="width:${(c / total) * 100}%" title="${n}"></i>`).join('')}</div>` +
      `<ul class="ad-legend">${d.pay.map(([n, c], i) => `<li><i class="ad-mix-${i}"></i>${n}<b>${Math.round((c / total) * 100)}%</b></li>`).join('')}</ul>`;

    $('adOrders').innerHTML = '<thead><tr><th>Order</th><th>Name</th><th>Type</th><th>Time</th><th class="ad-num">Total</th><th>Status</th></tr></thead><tbody>' +
      d.orders.map((o) => `<tr><td><b>${esc(o.id)}</b></td><td>${esc(o.name)}</td><td>${esc(o.type)}</td><td>${esc(o.time)}</td>` +
        `<td class="ad-num">${peso(o.total)}</td><td><span class="ad-badge" data-s="${o.status}">${esc(o.status)}</span></td></tr>`).join('') + '</tbody>';
  }

  /* ---------- employees ---------- */
  let employees = [];
  function renderEmployees() {
    const q = $('empSearch').value.trim().toLowerCase();
    const rows = employees.filter((e) => !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q));
    $('adEmployees').innerHTML = '<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>' +
      (rows.map((e) => {
        const me = e.id === ME;
        return `<tr>
          <td><b>${esc(e.name)}</b>${me ? ' <small>(you)</small>' : ''}</td>
          <td>${esc(e.email)}</td>
          <td><select class="ad-input ad-sm" data-role="${e.id}" ${me ? 'disabled' : ''} aria-label="Role for ${esc(e.name)}">
            <option value="cashier" ${e.role === 'cashier' ? 'selected' : ''}>Cashier</option>
            <option value="admin" ${e.role === 'admin' ? 'selected' : ''}>Admin</option></select></td>
          <td><span class="ad-badge" data-s="${e.status}">${STATUS[e.status]}</span></td>
          <td class="ad-num">${me ? '' : `<button class="ad-btn ad-sm" type="button" data-toggle="${e.id}">${e.status === 'inactive' ? 'Reactivate' : 'Deactivate'}</button>`}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="5" class="ad-empty">No employees found.</td></tr>') + '</tbody>';
  }

  $('empSearch').addEventListener('input', renderEmployees);
  $('adEmployees').addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-role]');
    if (!sel) return;
    await api.updateEmployee(Number(sel.dataset.role), { role: sel.value });
    toast('Role updated');
  });
  $('adEmployees').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    const emp = employees.find((x) => x.id === Number(btn.dataset.toggle));
    const next = emp.status === 'inactive' ? 'active' : 'inactive';
    await api.updateEmployee(emp.id, { status: next });
    renderEmployees();
    toast(next === 'active' ? `${emp.name} reactivated` : `${emp.name} deactivated`);
  });

  /* register employee */
  const NAME_RULE = /^\p{L}[\p{L}\p{M} .'-]{1,59}$/u;
  const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  $('empAdd').addEventListener('click', () => {
    $('empForm').reset();
    $('empError').textContent = '';
    $('empDialog').showModal();
    $('empName').focus();
  });
  $('empSave').addEventListener('click', async () => {
    const name = $('empName').value.replace(/\s+/g, ' ').trim();
    const email = $('empEmail').value.trim().toLowerCase();
    const role = $('empRole').value;
    const fail = (m) => { $('empError').textContent = m; };
    if (!NAME_RULE.test(name)) return fail('Enter the employee’s full name.');
    if (!EMAIL_RULE.test(email)) return fail('Enter a valid email address.');
    if (employees.some((e) => e.email.toLowerCase() === email)) return fail('That email is already registered.');
    $('empSave').disabled = true;
    try {
      await api.registerEmployee({ name, email, role });
      employees = await api.employees();
      renderEmployees();
      $('empDialog').close();
      toast(`Invitation sent to ${email}`);
    } catch (err) {
      fail(err.message || 'Could not register the employee.');
    } finally {
      $('empSave').disabled = false;
    }
  });

  /* ---------- menu ---------- */
  let menu = [];
  function renderMenu() {
    const q = $('menuFilter').value.trim().toLowerCase(), cat = $('menuCat').value;
    const rows = menu.filter((m) => (!cat || m.category === cat) && (!q || m.name.toLowerCase().includes(q)));
    $('adMenu').innerHTML = '<thead><tr><th>Item</th><th>Category</th><th class="ad-num">Price (base size)</th><th class="ad-num">Available</th></tr></thead><tbody>' +
      (rows.map((m) => `<tr>
        <td><b>${esc(m.name)}</b></td><td>${CATS[m.category]}</td>
        <td class="ad-num"><input class="ad-input ad-sm ad-price" type="number" min="0" step="0.01" value="${m.price}" data-price="${esc(m.slug)}" aria-label="Price of ${esc(m.name)}"></td>
        <td class="ad-num"><label class="ad-switch"><input type="checkbox" data-active="${esc(m.slug)}" ${m.active ? 'checked' : ''} aria-label="${esc(m.name)} available"><span></span></label></td>
      </tr>`).join('') || '<tr><td colspan="4" class="ad-empty">No items match.</td></tr>') + '</tbody>';
  }
  $('menuCat').innerHTML += Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('menuFilter').addEventListener('input', renderMenu);
  $('menuCat').addEventListener('change', renderMenu);
  $('adMenu').addEventListener('change', async (e) => {
    const price = e.target.closest('[data-price]'), act = e.target.closest('[data-active]');
    if (price) {
      const v = Number(price.value);
      if (!Number.isFinite(v) || v < 0) { renderMenu(); return toast('Enter a valid price'); }
      await api.updateMenuItem(price.dataset.price, { price: v });
      toast('Price saved');
    } else if (act) {
      await api.updateMenuItem(act.dataset.active, { active: act.checked });
      toast(act.checked ? 'Item is on the menu' : 'Item hidden from customers');
    }
  });

  /* ---------- views ---------- */
  const TITLES = { overview: 'Overview', employees: 'Employees', menu: 'Menu' };
  function show() {
    const view = TITLES[location.hash.slice(1)] ? location.hash.slice(1) : 'overview';
    document.querySelectorAll('.ad-view').forEach((s) => { s.hidden = s.id !== 'view-' + view; });
    document.querySelectorAll('.ad-link').forEach((a) => {
      const on = a.dataset.view === view;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('adTitle').textContent = TITLES[view];
  }
  window.addEventListener('hashchange', show);

    // 1. Function to load the dashboard data
  async function loadDashboardData() {
    try {
      // Only refresh stats if the Overview tab is currently visible
      if (!document.getElementById('view-overview').hidden) {
        renderOverview(await api.stats());
      }
    } catch (error) {
      console.error("Failed to refresh stats:", error);
    }
  }

  // 2. The Bouncer & Initial Load
  (async () => {
    try {
      // Check if we have a valid admin cookie
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('Not authorized');
      
      // Initial Load
      renderOverview(await api.stats());
      employees = await api.employees(); renderEmployees();
      menu = await api.menu(); renderMenu();
      show();

      // 3. The Auto-Refresh Timer (Every 30 seconds)
      setInterval(() => {
        // Smart Pause: If the browser tab is minimized/hidden, do nothing.
        if (document.hidden) return; 
        
        // Refresh the data
        loadDashboardData();
      }, 30000); // 30,000 milliseconds = 30 seconds
      
    } catch (error) {
      // If they don't have a token, or aren't an admin, kick them out!
      window.location.href = 'admin-login.html';
    }
  })();
})();