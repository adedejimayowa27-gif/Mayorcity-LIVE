import { requireAuth } from '../utils/authGuard.js';
import { signOut } from '../services/authService.js';
import { initToastRegion } from '../components/toast.js';
import { createEmptyState } from '../components/uiKit.js';

initToastRegion();

const dashActions = document.getElementById('dash-actions');
const dashContent = document.getElementById('dash-content');

// Redirects to /signin.html if there's no session — everything below only
// runs for a signed-in user.
const session = await requireAuth();

const displayName = session.user?.user_metadata?.full_name || session.user?.email;

dashActions.innerHTML = `<button class="btn btn-secondary" type="button" id="dash-sign-out">Sign out</button>`;
document.getElementById('dash-sign-out').addEventListener('click', async () => {
  await signOut();
  window.location.href = '/';
});

// This batch only proves the auth system end-to-end. Real dashboard
// content (events, broadcasts) arrives in Batch 3 and later.
dashContent.innerHTML = `
  <div style="text-align: center; margin-bottom: var(--space-6);">
    <h1 style="font-size: var(--text-xl); margin-bottom: var(--space-2);">Welcome, ${displayName}</h1>
    <p style="font-size: var(--text-sm); color: var(--color-text-muted);">You're signed in to Mayorcity LIVE.</p>
  </div>
  <div class="card">
    ${createEmptyState({
      title: 'Your dashboard is on its way',
      body: 'Event and broadcast management arrive in the next update. For now, this confirms your account is set up correctly.'
    })}
  </div>
`;
