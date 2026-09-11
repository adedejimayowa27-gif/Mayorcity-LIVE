// Generic modal controller. Markup for a specific modal lives wherever it's
// used; this just wires up open/close/focus/escape behaviour consistently.

export function createModal(overlayEl) {
  const dialog = overlayEl.querySelector('.modal');
  let lastFocused = null;

  function open() {
    lastFocused = document.activeElement;
    overlayEl.dataset.open = 'true';
    document.body.style.overflow = 'hidden';
    const focusable = dialog.querySelector('button, a, input, textarea, select');
    focusable?.focus();
  }

  function close() {
    overlayEl.dataset.open = 'false';
    document.body.style.overflow = '';
    lastFocused?.focus();
  }

  overlayEl.addEventListener('click', (event) => {
    if (event.target === overlayEl) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlayEl.dataset.open === 'true') close();
  });

  overlayEl.querySelectorAll('[data-modal-close]').forEach((btn) => {
    btn.addEventListener('click', close);
  });

  return { open, close };
}
