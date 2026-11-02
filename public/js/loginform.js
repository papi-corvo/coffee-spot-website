(() => {
  const form = document.getElementById('lgForm');
  const err = document.getElementById('lgError');
  const btn = document.getElementById('lgSubmit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;

    const employeeCode = document.getElementById('lgCode').value.trim();
    const pin = document.getElementById('lgPin').value;
    if (!employeeCode || !pin) {
      err.textContent = 'Enter your employee ID and PIN.';
      err.hidden = false;
      return;
    }

    btn.disabled = true;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCode, pin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      window.location.href = 'employeeView.html';
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      document.getElementById('lgPin').value = '';
    } finally {
      btn.disabled = false;
    }
  });
})();