export function initAccordion() {
  const buttons = document.querySelectorAll('.menu-icon-btn');

  buttons.forEach((btn) => {
    const list = document.getElementById(btn.getAttribute('aria-controls'));
    const badge = btn.querySelector('.icon-badge');
    const hint = btn.closest('.menu-item').querySelector('.menu-hint');

    btn.addEventListener('click', () => {
      const isOpen = list.classList.toggle('open');
      badge.textContent = isOpen ? '–' : '+';
      hint.textContent = isOpen ? 'Tap to hide' : 'Tap to view';
    });
  });
}