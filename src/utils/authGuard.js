// Route guard for any page that requires a signed-in user. Call this at the
// top of a protected page's script. It resolves with the session once
// confirmed, or redirects to sign-in and never resolves (the navigation
// away makes further code moot).
//
// Batch 3+ dashboard pages should all start with this same call.

import { getSession, onAuthStateChange } from '../services/authService.js';
import { getProfile } from '../services/profileService.js';

export function requireAuth({ redirectTo = '/signin.html' } = {}) {
  return new Promise((resolve) => {
    let settled = false;

    getSession().then(({ session }) => {
      if (settled) return;
      if (session) {
        settled = true;
        resolve(session);
      } else {
        // Give onAuthStateChange a brief moment in case a session is still
        // being restored (e.g. right after a redirect), before giving up.
        window.setTimeout(() => {
          if (!settled) {
            settled = true;
            window.location.href = redirectTo;
          }
        }, 800);
      }
    });

    onAuthStateChange((session) => {
      if (settled) return;
      if (session) {
        settled = true;
        resolve(session);
      }
    });
  });
}

/**
 * Like requireAuth(), but also confirms the signed-in user's profile has
 * role 'admin' — otherwise sends them to the regular dashboard instead of
 * the sign-in page (they ARE signed in, just not an admin).
 */
export async function requireAdmin({ redirectTo = '/dashboard.html' } = {}) {
  const session = await requireAuth();

  const { data: profile, error } = await getProfile(session.user.id);

  if (error || !profile || profile.role !== 'admin') {
    window.location.href = redirectTo;
    return new Promise(() => {}); // Never resolves — navigation is already underway.
  }

  return session;
}
