import { initToastRegion, showToast } from '../components/toast.js';
import { isValidEmail, setButtonLoading } from '../utils/dom.js';
import { signUpWithEmail, getSession } from '../services/authService.js';

initToastRegion();

const form = document.getElementById('signup-form');
const name = document.getElementById('name');
const email = document.getElementById('email');
const password = document.getElementById('password');
const submitBtn = form.querySelector('button[type="submit"]');

getSession().then(({ session }) => {
  if (session) window.location.href = '/dashboard.html';
});

function setFieldError(fieldId, errorId, hasError) {
  document.getElementById(fieldId).classList.toggle('field-error', hasError);
  document.getElementById(errorId).hidden = !hasError;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const nameValid = name.value.trim().length > 0;
  const emailValid = isValidEmail(email.value);
  const passwordValid = password.value.length >= 8;

  setFieldError('name-field', 'name-error', !nameValid);
  setFieldError('email-field', 'email-error', !emailValid);
  setFieldError('password-field', 'password-error', !passwordValid);

  if (!nameValid || !emailValid || !passwordValid) return;

  setButtonLoading(submitBtn, true, 'Creating account…');

  const { error, needsEmailConfirmation } = await signUpWithEmail({
    name: name.value.trim(),
    email: email.value.trim(),
    password: password.value
  });

  setButtonLoading(submitBtn, false);

  if (error) {
    showToast(error, { title: 'Couldn\u2019t create account', variant: 'error' });
    return;
  }

  if (needsEmailConfirmation) {
    showToast('Check your inbox for a confirmation link before signing in.', {
      title: 'Almost there',
      variant: 'success',
      duration: 7000
    });
    form.reset();
    return;
  }

  showToast('Account created.', { variant: 'success' });
  window.location.href = '/dashboard.html';
});
