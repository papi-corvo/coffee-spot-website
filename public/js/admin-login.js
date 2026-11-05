/* =====================================================================
   ADMIN LOGIN — admin-login.js
   ===================================================================== */
(() => {
  'use strict';

  const form = document.getElementById('adminLoginForm');
  const err = document.getElementById('adError');
  const btn = document.getElementById('adSubmit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;

    const email = document.getElementById('adEmail').value.trim();
    const password = document.getElementById('adPassword').value;

    if (!email || !password) {
      err.textContent = 'Please enter your email and password.';
      err.hidden = false;
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      
      // Success! Redirect to Admin Dashboard
      window.location.href = 'admin.html';

    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      document.getElementById('adPassword').value = '';
      btn.textContent = 'Sign in to Dashboard';
      btn.disabled = false;
    }
  });
})();