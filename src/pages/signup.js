import { initToastRegion, showToast } from '../components/toast.js';
import { isValidEmail } from '../utils/dom.js';
// import { supabase } from '../lib/supabaseClient.js';

initToastRegion();

const form = document.getElementById('signup-form');
const name = document.getElementById('name');
const email = document.getElementById('email');
const password = document.getElementById('password');

function setFieldError(fieldId, errorId, hasError) {
  document.getElementById(fieldId).classList.toggle('field-error', hasError);
  document.getElementById(errorId).hidden = !hasError;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const nameValid = name.value.trim().length > 0;
  const emailValid = isValidEmail(email.value);
  const passwordValid = password.value.length >= 8;

  setFieldError('name-field', 'name-error', !nameValid);
  setFieldError('email-field', 'email-error', !emailValid);
  setFieldError('password-field', 'password-error', !passwordValid);

  if (!nameValid || !emailValid || !passwordValid) return;

  showToast('Account creation will be enabled in a future update.', {
    title: 'Not connected yet',
    variant: 'default'
  });
});
