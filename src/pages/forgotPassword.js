import { initToastRegion, showToast } from '../components/toast.js';
import { isValidEmail, setButtonLoading } from '../utils/dom.js';
import { sendPasswordReset } from '../services/authService.js';

initToastRegion();

const form = document.getElementById('forgot-password-form');
const email = document.getElementById('email');
const submitBtn = form.querySelector('button[type="submit"]');

function setFieldError(fieldId, errorId, hasError) {
  document.getElementById(fieldId).classList.toggle('field-error', hasError);
  document.getElementById(errorId).hidden = !hasError;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const emailValid = isValidEmail(email.value);
  setFieldError('email-field', 'email-error', !emailValid);
  if (!emailValid) return;

  setButtonLoading(submitBtn, true, 'Sending…');

  const { error } = await sendPasswordReset(email.value.trim());

  setButtonLoading(submitBtn, false);

  if (error) {
    showToast(error, { title: 'Couldn\u2019t send reset link', variant: 'error' });
    return;
  }

  showToast('If that email has an account, a reset link is on its way.', {
    title: 'Check your inbox',
    variant: 'success',
    duration: 7000
  });
  form.reset();
});
