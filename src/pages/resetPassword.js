import { initToastRegion, showToast } from '../components/toast.js';
import { setButtonLoading } from '../utils/dom.js';
import { updatePassword, getSession, onAuthStateChange } from '../services/authService.js';
import { createErrorState } from '../components/uiKit.js';

initToastRegion();

const content = document.getElementById('reset-password-content');
const form = document.getElementById('reset-password-form');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirm-password');
const submitBtn = form.querySelector('button[type="submit"]');

function setFieldError(fieldId, errorId, hasError) {
  document.getElementById(fieldId).classList.toggle('field-error', hasError);
  document.getElementById(errorId).hidden = !hasError;
}

function showInvalidLinkState() {
  content.innerHTML = createErrorState({
    title: 'This reset link has expired',
    body: 'Request a new password reset link and try again.'
  });
}

// Supabase's client parses the recovery token out of the URL and creates a
// temporary session automatically. If that never happens, the link was
// invalid or has already been used.
let sessionConfirmed = false;

onAuthStateChange((session) => {
  if (session) sessionConfirmed = true;
});

getSession().then(({ session }) => {
  if (session) sessionConfirmed = true;
});

window.setTimeout(() => {
  if (!sessionConfirmed) showInvalidLinkState();
}, 2500);

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const passwordValid = password.value.length >= 8;
  const matches = password.value === confirmPassword.value;

  setFieldError('password-field', 'password-error', !passwordValid);
  setFieldError('confirm-password-field', 'confirm-password-error', passwordValid && !matches);

  if (!passwordValid || !matches) return;

  setButtonLoading(submitBtn, true, 'Updating…');

  const { error } = await updatePassword(password.value);

  setButtonLoading(submitBtn, false);

  if (error) {
    showToast(error, { title: 'Couldn\u2019t update password', variant: 'error' });
    return;
  }

  showToast('Password updated. You can sign in now.', { variant: 'success' });
  window.location.href = '/signin.html';
});
