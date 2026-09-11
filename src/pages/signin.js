import { initToastRegion, showToast } from '../components/toast.js';
import { isValidEmail } from '../utils/dom.js';
// Prepared for Batch 2: the Supabase client is already wired up and
// ready to import here once real auth logic is implemented.
// import { supabase } from '../lib/supabaseClient.js';

initToastRegion();

const form = document.getElementById('signin-form');
const email = document.getElementById('email');
const password = document.getElementById('password');

function setFieldError(fieldId, errorId, hasError) {
  document.getElementById(fieldId).classList.toggle('field-error', hasError);
  document.getElementById(errorId).hidden = !hasError;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const emailValid = isValidEmail(email.value);
  const passwordValid = password.value.trim().length > 0;

  setFieldError('email-field', 'email-error', !emailValid);
  setFieldError('password-field', 'password-error', !passwordValid);

  if (!emailValid || !passwordValid) return;

  // Batch 1 has no live authentication yet — this confirms the form
  // works end-to-end and hands off to Batch 2 for the real Supabase call.
  showToast('Sign-in will connect to your account in a future update.', {
    title: 'Not connected yet',
    variant: 'default'
  });
});
