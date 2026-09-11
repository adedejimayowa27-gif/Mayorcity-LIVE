// Reusable toast notification system. Call initToastRegion() once per page,
// then showToast(...) from anywhere (form handlers, future API calls, etc).

let regionEl = null;

export function initToastRegion() {
  if (regionEl) return regionEl;
  regionEl = document.createElement('div');
  regionEl.className = 'toast-region';
  regionEl.setAttribute('role', 'status');
  regionEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(regionEl);
  return regionEl;
}

/**
 * @param {string} message
 * @param {{ title?: string, variant?: 'default' | 'success' | 'error', duration?: number }} [options]
 */
export function showToast(message, options = {}) {
  const { title, variant = 'default', duration = 4000 } = options;
  const region = initToastRegion();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.dataset.variant = variant;
  toast.innerHTML = `
    <div>
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-message">${message}</div>
    </div>
  `;

  region.appendChild(toast);

  window.setTimeout(() => {
    toast.style.transition = `opacity ${duration > 0 ? '160ms' : '0ms'} ease`;
    toast.style.opacity = '0';
    window.setTimeout(() => toast.remove(), 180);
  }, duration);
}
