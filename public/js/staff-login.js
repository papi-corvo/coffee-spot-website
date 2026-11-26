(() => {
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
})();