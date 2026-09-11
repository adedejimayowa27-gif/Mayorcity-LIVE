import { initToastRegion, showToast } from '../components/toast.js';
import { isValidEmail, setButtonLoading } from '../utils/dom.js';
import { signInWithEmail, getSession } from '../services/authService.js';

initToastRegion();

const form = document.getElementById('signin-form');
const email = document.getElementById('email');
const password = document.getElementById('password');
const submitBtn = form.querySelector('button[type="submit"]');

// If already signed in, don't show the sign-in form again.
getSession().then(({ session }) => {
  if (session) window.location.href = '/dashboard.html';
});

function setFieldError(fieldId, errorId, hasError) {
  document.getElementById(fieldId).classList.toggle('field-error', hasError);
  document.getElementById(errorId).hidden = !hasError;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const emailValid = isValidEmail(email.value);
  const passwordValid = password.value.trim().length > 0;

  setFieldError('email-field', 'email-error', !emailValid);
  setFieldError('password-field', 'password-error', !passwordValid);

  if (!emailValid || !passwordValid) return;

  setButtonLoading(submitBtn, true, 'Signing in…');

  const { error } = await signInWithEmail({ email: email.value.trim(), password: password.value });

  setButtonLoading(submitBtn, false);

  if (error) {
    showToast(error, { title: 'Couldn\u2019t sign in', variant: 'error' });
    return;
  }

  showToast('Signed in successfully.', { variant: 'success' });
  window.location.href = '/dashboard.html';
});
