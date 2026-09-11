import { initToastRegion, showToast } from '../components/toast.js';
import { isValidEmail } from '../utils/dom.js';
// import { supabase } from '../lib/supabaseClient.js';

initToastRegion();

const form = document.getElementById('forgot-password-form');
const email = document.getElementById('email');

function setFieldError(fieldId, errorId, hasError) {
  document.getElementById(fieldId).classList.toggle('field-error', hasError);
  document.getElementById(errorId).hidden = !hasError;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const emailValid = isValidEmail(email.value);
  setFieldError('email-field', 'email-error', !emailValid);

  if (!emailValid) return;

  showToast('Password reset emails will be enabled in a future update.', {
    title: 'Not connected yet',
    variant: 'default'
  });
});
