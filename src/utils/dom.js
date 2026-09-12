export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function on(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/**
 * Escapes text before it's inserted into innerHTML — safe for use in BOTH
 * text content and HTML attribute values (e.g. value="${escapeHtml(x)}"),
 * since it also encodes quote characters that the textContent/innerHTML
 * round-trip trick alone would miss. MUST wrap any user-supplied string
 * (event titles/descriptions, overlay text, chat, profile names) before
 * it goes into a template literal assigned to innerHTML — otherwise a
 * value like `<script>` or `" onmouseover="...` typed into a form field
 * could execute in another viewer's browser.
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
