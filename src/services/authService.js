// All Supabase Auth calls go through this one module. Pages never call
// `supabase.auth.*` directly — that keeps auth logic in one place if the
// backend or auth provider ever changes, and keeps error handling
// consistent across sign in, sign up and password reset.

import { supabase } from '../lib/supabaseClient.js';

/**
 * @param {{ name: string, email: string, password: string }} params
 */
export async function signUpWithEmail({ name, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${window.location.origin}/signin.html`
    }
  });

  if (error) return { error: mapAuthError(error) };

  // If email confirmations are enabled on the Supabase project (the
  // default), `session` is null here and the user must click the link
  // sent to their inbox before they can sign in.
  const needsEmailConfirmation = !data.session;
  return { data, needsEmailConfirmation };
}

/**
 * @param {{ email: string, password: string }} params
 */
export async function signInWithEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: mapAuthError(error) };
  return { data };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { error: mapAuthError(error) };
  return {};
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`
  });
  if (error) return { error: mapAuthError(error) };
  return {};
}

/** Used on the reset-password page, after the user follows the emailed link. */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: mapAuthError(error) };
  return {};
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { error: mapAuthError(error) };
  return { session: data.session };
}

/** @param {(session: import('@supabase/supabase-js').Session | null) => void} callback */
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return data.subscription;
}

/** Turns Supabase's raw error messages into copy a user should actually see. */
function mapAuthError(error) {
  const message = error?.message ?? '';

  if (message.includes('Invalid login credentials')) {
    return 'That email or password is incorrect.';
  }
  if (message.includes('User already registered')) {
    return 'An account with this email already exists.';
  }
  if (message.includes('Password should be at least')) {
    return 'Password must be at least 8 characters.';
  }
  if (message.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return message || 'Something went wrong. Please try again.';
}
