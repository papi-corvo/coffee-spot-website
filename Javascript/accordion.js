export function initAccordion(root = document) {
  const buttons = root.querySelectorAll('.menu-icon-btn');

  buttons.forEach((button) => {
    const listId = button.getAttribute('aria-controls');
    const list = listId ? document.getElementById(listId) : null;
    const badge = button.querySelector('.icon-badge');
    const menuItem = button.closest('.menu-item');
    const hint = menuItem?.querySelector('.menu-hint');

    if (!list) return;

    const sync = (open) => {
      list.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
      if (badge) badge.textContent = open ? '–' : '+';
      if (hint) hint.textContent = open ? 'Tap to hide' : 'Tap to view';
    };

    sync(list.classList.contains('open'));

    button.addEventListener('click', () => {
      sync(!list.classList.contains('open'));
    });
  });
}
