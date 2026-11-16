(() => {
  'use strict';

  const MAX_PRICE = 10000; 

  const $ = (id) => document.getElementById(id);
  const peso = (n) => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ME = 1;                                   
  const CATS = { coffee: 'Coffee', soda: 'Italian soda', tea: 'Tea', pastries: 'Pastries', food: 'Food' };
  const STATUS = { active: 'Active', invited: 'Invited', inactive: 'Inactive' };

  const api = {
    stats: async () => { const res = await fetch('/api/admin/stats'); if (!res.ok) throw new Error('Failed'); return await res.json(); },
    employees: async () => { const res = await fetch('/api/admin/employees'); if (!res.ok) throw new Error('Failed'); return await res.json(); },
    menu: async () => { const res = await fetch('/api/admin/menu'); if (!res.ok) throw new Error('Failed'); return await res.json(); },
    registerEmployee: async (e) => { console.log('TODO', e); }, 
    updateEmployee: async (id, patch) => { console.log('TODO', id, patch); },
    updateMenuItem: async (slug, patch) => {
      const res = await fetch(`/api/admin/menu/${slug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error('Failed to update menu item');
      return await res.json();
    },
    updateVariants: async (slug, variants) => {
      const res = await fetch(`/api/admin/menu/${slug}/variants`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variants }) });
      if (!res.ok) throw new Error('Failed to update variants');
      return await res.json();
    },
    addMenuItem: async (payload) => {
      const res = await fetch('/api/admin/menu', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add menu item');
      }
      return await res.json();
    },
  };

  let toastTimer;
  function toast(msg) {
    const isVariantOpen = $('variantDialog')?.open;
    const isConfirmOpen = $('menuConfirmDialog')?.open;
    const isAddItemOpen = $('addItemDialog')?.open; // NEW

    let t;
    if (isVariantOpen) t = $('variantToast');
    else if (isConfirmOpen) t = $('confirmToast');
    else if (isAddItemOpen) t = $('addItemToast'); // NEW
    else t = $('adToast');
    
    if (!t) return;
    
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  function renderOverview(d) {
    const today = d.week[d.week.length - 1]?.[1] || 0, yesterday = d.week[d.week.length - 2]?.[1] || 0;
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

    const total = d.pay.reduce((s, p) => s + p[1], 0) || 1;
    $('adPayMix').innerHTML =
      `<div class="ad-mix">${d.pay.map(([n, c], i) => `<i class="ad-mix-${i}" style="width:${(c / total) * 100}%" title="${n}"></i>`).join('')}</div>` +
      `<ul class="ad-legend">${d.pay.map(([n, c], i) => `<li><i class="ad-mix-${i}"></i>${n}<b>${Math.round((c / total) * 100)}%</b></li>`).join('')}</ul>`;

    $('adOrders').innerHTML = '<thead><tr><th>Order</th><th>Name</th><th>Type</th><th>Time</th><th class="ad-num">Total</th><th>Status</th></tr></thead><tbody>' +
      d.orders.map((o) => `<tr><td><b>${esc(o.id)}</b></td><td>${esc(o.name)}</td><td>${esc(o.type)}</td><td>${esc(o.time)}</td>` +
        `<td class="ad-num">${peso(o.total)}</td><td><span class="ad-badge" data-s="${o.status}">${esc(o.status)}</span></td></tr>`).join('') + '</tbody>';
  }

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

  let menu = [];
  let currentMenuTab = 'all'; 

  function renderMenu() {
    const q = $('menuFilter').value.trim().toLowerCase();

    const filtered = menu.filter((m) => {
      const matchesSearch = !q || m.name.toLowerCase().includes(q);
      const matchesTab = currentMenuTab === 'all' || m.category === currentMenuTab;
      return matchesSearch && matchesTab;
    });

    const categoryData = {
      all: { label: 'All Items', icon: '' },
      coffee: { label: 'Coffee', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>' },
      soda: { label: 'Italian Soda', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4"/><path d="M19 6H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/><path d="M9 12h.01"/><path d="M15 16h.01"/><path d="M12 14h.01"/><path d="M7 16h.01"/><path d="M17 12h.01"/></svg>' },
      tea: { label: 'Tea', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 2c0 2-2 2-2 4"/><path d="M10 2c0 2-2 2-2 4"/><path d="M14 2c0 2-2 2-2 4"/></svg>' },
      pastries: { label: 'Pastries', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M6 20V8a6 6 0 0 1 12 0v12"/><path d="M6 12h12"/><path d="M6 16h12"/></svg>' },
      food: { label: 'Food Menu', icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>' }
    };

    let tabsHtml = '<div class="ad-tabs-bar">';
    Object.entries(categoryData).forEach(([key, data]) => {
      const activeClass = currentMenuTab === key ? 'is-active' : '';
      tabsHtml += `<button type="button" class="ad-tab-btn ${activeClass}" data-cat="${key}">${data.icon} <span>${data.label}</span></button>`;
    });
    tabsHtml += '</div>';

    let tableHtml = '<thead><tr><th>Item</th><th>Category</th><th class="ad-num">Price</th><th class="ad-num">Available</th></tr></thead><tbody>';

    if (filtered.length === 0) {
      tableHtml += '<tr><td colspan="4" class="ad-empty">No items match.</td></tr>';
    } else {
      filtered.forEach((m) => {
        const catLabel = categoryData[m.category] ? categoryData[m.category].label : m.category;
        tableHtml += `<tr>
          <td><b>${esc(m.name)}</b></td>
          <td>${catLabel}</td>
          <td class="ad-num" style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; border-bottom: none;">
            <input class="ad-input ad-sm ad-price" type="text" inputmode="decimal" value="${Number(m.price).toLocaleString('en-PH')}" data-price="${esc(m.slug)}" data-db-value="${m.price}" style="width: 85px; text-align: right;">
            <button type="button" class="ad-btn ad-btn--primary ad-sm" data-edit-variant="${esc(m.slug)}" style="padding: 0.4rem 0.6rem; font-size: 0.75rem; white-space: nowrap;">Sizes</button>
          </td>
          <td class="ad-num"><label class="ad-switch"><input type="checkbox" data-active="${esc(m.slug)}" ${m.active ? 'checked' : ''}><span></span></label></td>
        </tr>`;
      });
    }
    tableHtml += '</tbody>';

    const container = $('adMenu').parentElement; 
    container.innerHTML = tabsHtml + '<table class="ad-table" id="adMenu">' + tableHtml + '</table>';

    container.querySelectorAll('.ad-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentMenuTab = e.target.closest('.ad-tab-btn').dataset.cat;
        renderMenu(); 
      });
    });

    $('adMenu').addEventListener('change', async (e) => {
      const priceInput = e.target.closest('[data-price]');
      const toggleInput = e.target.closest('[data-active]');

      if (priceInput) {
        const rawValue = priceInput.value.replace(/,/g, '');
        const newPrice = Number(rawValue);
        const slug = priceInput.dataset.price;
        const item = menu.find((m) => m.slug === slug);

        if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice > MAX_PRICE) {
          toast(`Maximum price exceeded. Please enter an amount up to ₱${MAX_PRICE.toLocaleString('en-PH', { maximumFractionDigits: 2 })}.`);
          renderMenu(); 
          return;
        }

        if (item.price === newPrice) return;

        $('menuConfirmMessage').innerHTML = `Change base price of <strong>${item.name}</strong> from <strong>₱${item.price}</strong> to <strong>₱${newPrice}</strong>?`;
        $('menuConfirmDialog').showModal();

        $('menuConfirmOk').onclick = async () => {
          $('menuConfirmDialog').close();
          await api.updateMenuItem(slug, { price: newPrice });
          item.price = newPrice; 
          toast('Base price saved');
          renderMenu();
        };
        $('menuConfirmCancel').onclick = () => { $('menuConfirmDialog').close(); renderMenu(); };

      } else if (toggleInput) {
        const isAvailable = toggleInput.checked;
        const slug = toggleInput.dataset.active;
        const item = menu.find((m) => m.slug === slug);

        document.querySelector('#menuConfirmDialog .confirm-icon').style.background = isAvailable ? '#e3f3e8' : 'var(--caramel-light)';
        document.querySelector('#menuConfirmDialog .confirm-icon').style.color = isAvailable ? '#2f7650' : '#a6371d';
        $('menuConfirmMessage').innerHTML = isAvailable ? `Make <strong>${item.name}</strong> available to customers?` : `Hide <strong>${item.name}</strong> from the customer menu?`;
        $('menuConfirmDialog').showModal();

        $('menuConfirmOk').onclick = async () => {
          $('menuConfirmDialog').close();
          await api.updateMenuItem(slug, { active: isAvailable });
          item.active = isAvailable; 
          toast(isAvailable ? 'Item is on the menu' : 'Item hidden from customers');
          renderMenu();
        };
        $('menuConfirmCancel').onclick = () => { $('menuConfirmDialog').close(); renderMenu(); };
      }
    });
  }

  $('menuFilter').addEventListener('input', renderMenu);

  document.getElementById('view-menu').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit-variant]');
    if (!btn) return;

    const slug = btn.dataset.editVariant;
    const item = menu.find(m => m.slug === slug);
    if (!item || !item.variants || item.variants.length === 0) return toast('No variants found');

    $('variantItemName').textContent = `Edit Prices: ${item.name}`;
    const list = $('variantList');
    
    // Add data-db-value to the variant inputs!
    list.innerHTML = item.variants.map(v => `
      <div class="variant-row">
        <label>${v.label}</label>
        <input class="ad-price" type="text" inputmode="decimal" value="${v.price_centavos !== null ? Number(v.price).toLocaleString('en-PH') : ''}" data-id="${v.id}" data-db-value="${v.price}" placeholder="Not available">
      </div>
    `).join('');

    $('variantDialog').showModal();

    $('variantSave').onclick = () => {
      const inputs = list.querySelectorAll('input');
      const newVariants = Array.from(inputs).map(input => {
        const rawValue = input.value.replace(/,/g, '').trim();
        return {
          id: Number(input.dataset.id),
          price: rawValue === '' ? null : Number(rawValue)
        };
      });

      if (newVariants.some(v => v.price !== null && (!Number.isFinite(v.price) || v.price < 0 || v.price > MAX_PRICE))) {
        return toast(`Maximum price exceeded. Please enter an amount up to ₱${MAX_PRICE.toLocaleString('en-PH', { maximumFractionDigits: 2 })}.`);
      }

      $('variantDialog').close();
      
      document.querySelector('#menuConfirmDialog .confirm-icon').style.background = '#e0f2fe';
      document.querySelector('#menuConfirmDialog .confirm-icon').style.color = '#0284c7';
      $('menuConfirmMessage').innerHTML = `Are you sure you want to save the new prices for <strong>${item.name}</strong>?`;
      $('menuConfirmDialog').showModal();

      $('menuConfirmOk').onclick = async () => {
        $('menuConfirmDialog').close();
        try {
          $('variantSave').disabled = true;
          await api.updateVariants(slug, newVariants);
          
          item.variants.forEach(v => {
            const match = newVariants.find(nv => nv.id === v.id);
            if (match) {
              v.price = match.price;
              v.price_centavos = match.price === null ? null : Math.round(match.price * 100);
            }
          });
          
          const validPrices = item.variants.filter(v => v.price !== null).map(v => v.price);
          item.price = validPrices.length > 0 ? Math.min(...validPrices) : 0;

          toast('All prices saved');
          renderMenu(); 
        } catch (err) {
          toast(err.message || 'Failed to save prices');
        } finally {
          $('variantSave').disabled = false;
        }
      };

      $('menuConfirmCancel').onclick = () => {
        $('menuConfirmDialog').close();
        $('variantDialog').showModal(); 
      };
    };

    $('variantCancel').onclick = () => { $('variantDialog').close(); };
  });

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

  (async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('Not authorized');
      renderOverview(await api.stats());
      employees = await api.employees(); renderEmployees();
      menu = await api.menu(); renderMenu();
      show();
    } catch (error) {
      window.location.href = 'admin-login.html';
    }
  })();

  // =========================================
  // PRICE FORMATTING & RESTRICTIONS (CLEAN)
  // =========================================

  // 1. Handle keyboard input: Block invalid chars & handle Enter key
  document.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('ad-price')) {
      
      // Block letters and symbols
      if (['e', 'E', '+', '-'].includes(e.key)) {
        e.preventDefault();
        return;
      }

      // Handle Enter key (Confirm the input)
      if (e.key === 'Enter') {
        e.preventDefault(); // Stop the dialog from closing
        e.target.blur();    // Force the input to lose focus (triggers focusout validation)
      }
    }
  });

  // 2. Save original value & strip commas on focus
  document.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('ad-price')) {
      e.target.value = e.target.value.replace(/,/g, '');
    }
  });

  // 3. Sanitize characters while typing (no aggressive blocking)
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('ad-price')) {
      let cleanValue = e.target.value.replace(/[^0-9.]/g, '');
      const parts = cleanValue.split('.');
      if (parts.length > 2) {
        cleanValue = parts[0] + '.' + parts.slice(1).join('');
      }
      e.target.value = cleanValue;
    }
  });

  // 4. On focusout, check if it exceeds MAX_PRICE. If so, revert to DB value.
  document.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('ad-price')) {
      let rawValue = e.target.value.replace(/,/g, '').trim();
      
      if (rawValue === '') return; 

      let num = Number(rawValue);
      
      // Check if data-db-value exists (it won't for new items)
      const hasDbValue = e.target.dataset.dbValue !== undefined;
      const dbValue = hasDbValue ? Number(e.target.dataset.dbValue) : 0;

      // If it's over the limit or invalid, revert or clear
      if (isNaN(num) || num < 0 || num > MAX_PRICE) {
        if (hasDbValue) {
          e.target.value = dbValue.toLocaleString('en-PH', { maximumFractionDigits: 2 });
        } else {
          e.target.value = ''; // Clear it if it's a new item
        }
        toast(`Maximum price exceeded. Please enter an amount up to ₱${MAX_PRICE.toLocaleString('en-PH', { maximumFractionDigits: 2 })}.`);
      } else {
        // Format normally
        e.target.value = num.toLocaleString('en-PH', { maximumFractionDigits: 2 });
      }
    }
  });

  // =========================================
  // ADD NEW ITEM LOGIC
  // =========================================
  const addItemDialog = $('addItemDialog');
  const addItemError = $('addItemError');
  const addItemVariantsContainer = $('addItemVariantsContainer');

  // Helper to create a variant row with Category-Aware Pills
  function createVariantRow(label = '', category = 'coffee') {
    const row = document.createElement('div');
    row.className = 'variant-row';
    row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';

    // Mapping of categories to standard sizes
    const CATEGORY_SIZES = {
      coffee: ['Medium', 'Large'],
      soda: ['16oz', '22oz'],
      tea: ['Medium', 'Large'],
      pastries: ['Regular', 'Slice', 'Whole'],
      food: ['Solo', 'w/ Rice']
    };

    const sizes = CATEGORY_SIZES[category] || ['Regular'];
    let pillsHtml = '';
    
    sizes.forEach(size => {
      const isActive = size === label ? 'is-active' : '';
      pillsHtml += `<button type="button" class="size-pill ${isActive}" data-size="${size}">${size}</button>`;
    });
    
    // Add the "Other" pill
    const isCustom = label && !sizes.includes(label);
    pillsHtml += `<button type="button" class="size-pill ${isCustom ? 'is-active' : ''}" data-size="custom">Other</button>`;

    row.innerHTML = `
      <div style="flex: 1; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
        <div class="size-pill-group" style="display: flex; gap: 4px; flex-wrap: wrap;">
          ${pillsHtml}
        </div>
        <input type="hidden" data-variant-label value="${label}" required>
        <input type="text" class="ad-input custom-size-input" value="${isCustom ? label : ''}" placeholder="Type size..." style="display: ${isCustom ? 'block' : 'none'}; flex: 1;">
      </div>
      <input class="ad-input ad-price" type="text" inputmode="decimal" placeholder="Price" data-variant-price required style="width: 100px;">
      <button type="button" class="ad-btn ad-sm" style="padding: 0 0.6rem; color: var(--danger); border-color: var(--border); font-weight: bold; font-size: 1.1rem;" onclick="this.parentElement.remove()">×</button>
    `;

    // Event listeners for the pills
    const hiddenInput = row.querySelector('[data-variant-label]');
    const pillGroup = row.querySelector('.size-pill-group');
    const customInput = row.querySelector('.custom-size-input');

    pillGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.size-pill');
      if (!btn) return;

      pillGroup.querySelectorAll('.size-pill').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const size = btn.dataset.size;
      if (size === 'custom') {
         customInput.style.display = 'block';
         customInput.focus();
         hiddenInput.value = customInput.value;
      } else {
         customInput.style.display = 'none';
         hiddenInput.value = size;
      }
    });

    customInput.addEventListener('input', (e) => {
      hiddenInput.value = e.target.value;
    });

    return row;
  }

  // Helper to render Group Pills based on Category
  function renderGroupPills(category) {
    const uniqueGroups = [...new Set(
      menu
        .filter(m => m.category === category && m.group_name)
        .map(m => m.group_name)
    )];
    
    const container = $('groupPillsContainer');
    
    if (uniqueGroups.length === 0) {
      container.innerHTML = '<span style="font-size: 0.8rem; color: var(--ink-muted);">No existing groups for this category. Type one above to create it.</span>';
      return;
    }

    container.innerHTML = uniqueGroups.map(g => 
      `<button type="button" class="cat-pill" data-group="${esc(g)}">${esc(g)}</button>`
    ).join('');
  }

  // 1. Open Dialog & Set Smart Defaults
  $('btnAddItem').addEventListener('click', () => {
    $('addItemForm').reset();
    addItemError.textContent = '';
    
    // Populate Group Pills based on default category
    renderGroupPills($('addItemCategory').value);
    $('addItemGroup').value = ''; // Clear input on open

    // Reset variants with Smart Defaults based on category
    addItemVariantsContainer.innerHTML = '';
    const category = $('addItemCategory').value;
    
    if (['coffee', 'soda', 'tea'].includes(category)) {
      addItemVariantsContainer.appendChild(createVariantRow('Medium', category));
      addItemVariantsContainer.appendChild(createVariantRow('Large', category));
    } else {
      addItemVariantsContainer.appendChild(createVariantRow('Regular', category));
    }
    
    addItemDialog.showModal();
    $('addItemName').focus();
  });

  // Handle Category Pill Clicks
  document.querySelectorAll('.cat-pill[data-cat]').forEach(pill => {
    pill.addEventListener('click', (e) => {
      // Only target category pills for the active state, not group pills
      document.querySelectorAll('.cat-pill[data-cat]').forEach(p => p.classList.remove('is-active'));
      e.target.classList.add('is-active');
      
      const cat = e.target.dataset.cat;
      $('addItemCategory').value = cat;

      // Update Variants
      addItemVariantsContainer.innerHTML = '';
      if (['coffee', 'soda', 'tea'].includes(cat)) {
        addItemVariantsContainer.appendChild(createVariantRow('Medium', cat));
        addItemVariantsContainer.appendChild(createVariantRow('Large', cat));
      } else {
        addItemVariantsContainer.appendChild(createVariantRow('Regular', cat));
      }

      // Update Group Pills
      renderGroupPills(cat);
      $('addItemGroup').value = '';
    });
  });

  // Handle Group Pill Clicks & Manual Input
  $('groupPillsContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-pill');
    if (!btn) return;
    
    // Toggle active states
    $('groupPillsContainer').querySelectorAll('.cat-pill').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    
    // Update input
    $('addItemGroup').value = btn.dataset.group;
  });

  $('addItemGroup').addEventListener('input', () => {
    // If user types manually, remove active state from all pills
    $('groupPillsContainer').querySelectorAll('.cat-pill').forEach(b => b.classList.remove('is-active'));
  });

  // 2. Add Variant Row Manually
  $('btnAddVariantRow').addEventListener('click', () => {
    const currentCat = $('addItemCategory').value;
    addItemVariantsContainer.appendChild(createVariantRow('', currentCat));
  });

  // 3. Save New Item (With Confirmation)
  $('btnSaveNewItem').addEventListener('click', () => {
    const name = $('addItemName').value.trim();
    const image = $('addItemImage').value.trim();

    if (!name) return addItemError.textContent = 'Item name is required.';
    if (!image) return addItemError.textContent = 'Please upload a product image.';

    const variantRows = addItemVariantsContainer.querySelectorAll('.variant-row');
    const variants = [];
    
    for (const row of variantRows) {
      const label = row.querySelector('[data-variant-label]').value.trim();
      const priceRaw = row.querySelector('[data-variant-price]').value.replace(/,/g, '');
      const price = Number(priceRaw);

      if (!label) return addItemError.textContent = 'All sizes must have a name.';
      if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
        return addItemError.textContent = `Prices must be between 0.01 and ₱${MAX_PRICE.toLocaleString('en-PH')}.`;
      }
      variants.push({ label, price });
    }

    if (variants.length === 0) return addItemError.textContent = 'At least one size is required.';

    // Show Confirmation Dialog
    document.querySelector('#menuConfirmDialog .confirm-icon').style.background = '#e0f2fe';
    document.querySelector('#menuConfirmDialog .confirm-icon').style.color = '#0284c7';
    $('menuConfirmMessage').innerHTML = `Are you sure you want to add <strong>${esc(name)}</strong> to the menu?`;
    $('menuConfirmDialog').showModal();

    // If Confirmed, Fire the API
    $('menuConfirmOk').onclick = async () => {
      $('menuConfirmDialog').close();
      $('btnSaveNewItem').disabled = true;
      
      try {
        const category = $('addItemCategory').value;
        const group_name = $('addItemGroup').value.trim();
        const description = $('addItemDesc').value.trim();
        
        const payload = { name, category, group_name, description, image, variants };
        await api.addMenuItem(payload);
        
        addItemDialog.close();
        toast(`"${name}" added to menu`);
        
        menu = await api.menu(); 
        renderMenu();
      } catch (err) {
        addItemError.textContent = err.message;
      } finally {
        $('btnSaveNewItem').disabled = false;
      }
    };

    $('menuConfirmCancel').onclick = () => {
      $('menuConfirmDialog').close();
    };
  });

  // =========================================
  // 5. DRAG & DROP IMAGE UPLOAD
  // =========================================
  const uploadZone = $('uploadZone');
  const fileInput = $('addItemImageUpload');
  const uploadPreview = $('uploadPreview');
  const uploadZoneText = $('uploadZoneText');
  const hiddenImageInput = $('addItemImage');

  uploadZone.addEventListener('click', () => fileInput.click());

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('is-dragover');
  });

  uploadZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('is-dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('is-dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  async function handleFileUpload(file) {
    const validTypes = ['image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      return toast('Invalid format. Please upload a .jpg, .jpeg, or .png image.');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      uploadPreview.src = e.target.result;
      uploadPreview.style.display = 'block';
      uploadZoneText.textContent = 'Uploading...';
    };
    reader.readAsDataURL(file);

    // 1. Upload the image FIRST
    uploadZoneText.textContent = 'Uploading image...';
    const formData = new FormData();
    formData.append('image', pendingImageFile);
    formData.append('itemName', name); // Send the name so backend can slugify it

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      hiddenImageInput.value = data.imagePath;
      uploadZoneText.textContent = 'Image uploaded successfully ✓';
      uploadZoneText.style.color = 'var(--success, #2f7650)';

    } catch (err) {
      uploadZoneText.textContent = 'Upload failed. Click to try again.';
      uploadZoneText.style.color = 'var(--danger, #a6371d)';
      uploadPreview.style.display = 'none';
      hiddenImageInput.value = '';
      toast(err.message);
    }
  }
})();