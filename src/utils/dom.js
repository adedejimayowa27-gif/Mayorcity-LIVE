export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function on(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/** Basic, dependency-free email format check for client-side form validation. */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Toggles a submit button between its normal and loading label, and
 * disables it while a request is in flight — used by every auth form.
 */
export function setButtonLoading(button, isLoading, loadingText = 'Please wait…') {
  if (isLoading) {
    button.dataset.originalText = button.dataset.originalText || button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}
