(() => {
  // Registration is design-only for now. Set to true once /api/auth/register exists.
  const USE_BACKEND = false;

  const views = {
    login:    { el: document.getElementById('viewLogin'),    sub: 'Staff sign-in',        title: 'Coffee Spot | Staff Login',        first: 'lgCode' },
    register: { el: document.getElementById('viewRegister'), sub: 'Staff registration',   title: 'Coffee Spot | Staff Registration', first: 'rgName' }
  };
  const brandSub = document.getElementById('lgBrandSub');

  function showView(name) {
    for (const [key, v] of Object.entries(views)) v.el.hidden = key !== name;
    brandSub.textContent = views[name].sub;
    document.title = views[name].title;
    document.querySelectorAll('.lg-error, .lg-success').forEach((p) => { p.hidden = true; });
    document.getElementById(views[name].first).focus();
  }

  document.querySelectorAll('[data-view]').forEach((b) => {
    b.addEventListener('click', (e) => { e.preventDefault(); showView(b.dataset.view); });
  });

  /* ---------- SIGN IN ---------- */
  const lgForm = document.getElementById('lgForm');
  const lgErr = document.getElementById('lgError');
  const lgOk = document.getElementById('lgSuccess');
  const lgBtn = document.getElementById('lgSubmit');

  lgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    lgErr.hidden = true;
    lgOk.hidden = true;

    const employeeCode = document.getElementById('lgCode').value.trim();
    const pin = document.getElementById('lgPin').value;
    if (!employeeCode || !pin) {
      lgErr.textContent = 'Enter your employee ID and PIN.';
      lgErr.hidden = false;
      return;
    }

    lgBtn.disabled = true;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCode, pin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      window.location.href = '/cashier';
    } catch (ex) {
      lgErr.textContent = ex.message;
      lgErr.hidden = false;
      document.getElementById('lgPin').value = '';
    } finally {
      lgBtn.disabled = false;
    }
  });

  /* ---------- REGISTER ---------- */
  const rgForm = document.getElementById('rgForm');
  const rgErr = document.getElementById('rgError');
  const rgOk = document.getElementById('rgSuccess');
  const rgBtn = document.getElementById('rgSubmit');

  const rgFail = (msg) => { rgErr.textContent = msg; rgErr.hidden = false; };

  rgForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    rgErr.hidden = true;
    rgOk.hidden = true;

    const name = document.getElementById('rgName').value.trim();
    const employeeCode = document.getElementById('rgCode').value.trim();
    const pin = document.getElementById('rgPin').value;
    const pin2 = document.getElementById('rgPin2').value;

    if (!name || !employeeCode || !pin || !pin2) return rgFail('Fill in every field.');
    if (!/^\d{4,8}$/.test(pin)) return rgFail('PIN must be 4 to 8 digits.');
    if (pin !== pin2) {
      document.getElementById('rgPin2').value = '';
      return rgFail('PINs do not match.');
    }

    rgBtn.disabled = true;
    try {
      if (USE_BACKEND) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, employeeCode, pin })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed.');

        rgForm.reset();
        showView('login');
        document.getElementById('lgCode').value = employeeCode;
        lgOk.textContent = 'Account created. Sign in with your new PIN.';
        lgOk.hidden = false;
        document.getElementById('lgPin').focus();
      } else {
        await new Promise((r) => setTimeout(r, 400)); // fake delay for the preview
        rgOk.textContent = 'Preview only: form looks good. No account was saved.';
        rgOk.hidden = false;
        rgForm.reset();
      }
    } catch (ex) {
      rgFail(ex.message);
      document.getElementById('rgPin').value = '';
      document.getElementById('rgPin2').value = '';
    } finally {
      rgBtn.disabled = false;
    }
  });
})();