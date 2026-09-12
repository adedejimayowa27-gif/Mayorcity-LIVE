import { requireAdmin } from '../utils/authGuard.js';
import { signOut } from '../services/authService.js';
import { getAllEvents, updateEvent } from '../services/eventsService.js';
import { getAllProfiles, setProfileRole } from '../services/profileService.js';
import { getTotalMessageCount } from '../services/chatService.js';
import { initToastRegion, showToast } from '../components/toast.js';
import { createLoadingState, createErrorState } from '../components/uiKit.js';
import { escapeHtml } from '../utils/dom.js';

initToastRegion();

const shell = document.getElementById('admin-shell');
let adminSession = null;

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function statsHtml({ totalEvents, liveNow, totalUsers, totalMessages }) {
  return `
    <div class="admin-stats">
      <div class="card admin-stat-card">
        <div class="admin-stat-value">${totalEvents}</div>
        <div class="admin-stat-label">Total events</div>
      </div>
      <div class="card admin-stat-card">
        <div class="admin-stat-value">${liveNow}</div>
        <div class="admin-stat-label">Live now</div>
      </div>
      <div class="card admin-stat-card">
        <div class="admin-stat-value">${totalUsers}</div>
        <div class="admin-stat-label">Total users</div>
      </div>
      <div class="card admin-stat-card">
        <div class="admin-stat-value">${totalMessages}</div>
        <div class="admin-stat-label">Chat messages sent</div>
      </div>
    </div>
  `;
}

function eventsTableHtml(events) {
  if (events.length === 0) return '<p class="card-body">No events yet.</p>';

  const rows = events
    .map(
      (e) => `
    <tr data-event-id="${e.id}">
      <td>${escapeHtml(e.title)}</td>
      <td>${escapeHtml(e.profiles?.full_name || '—')}</td>
      <td>${e.category}</td>
      <td>${e.status}</td>
      <td>${e.peak_viewers || 0}</td>
      <td>${formatDate(e.created_at)}</td>
      <td>
        ${
          e.status === 'scheduled' || e.status === 'live'
            ? `<button class="btn btn-secondary" type="button" data-cancel-event="${e.id}">Cancel</button>`
            : '—'
        }
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Title</th><th>Host</th><th>Category</th><th>Status</th><th>Peak viewers</th><th>Created</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function usersTableHtml(profiles) {
  if (profiles.length === 0) return '<p class="card-body">No users yet.</p>';

  const rows = profiles
    .map(
      (p) => `
    <tr data-profile-id="${p.id}">
      <td>${escapeHtml(p.full_name || '—')}</td>
      <td>${escapeHtml(p.role)}</td>
      <td>${formatDate(p.created_at)}</td>
      <td>
        ${
          p.id === adminSession.user.id
            ? '<span style="color: var(--color-text-faint);">You</span>'
            : `<button class="btn btn-secondary" type="button" data-toggle-role="${p.id}" data-current-role="${p.role}">
                ${p.role === 'admin' ? 'Remove admin' : 'Make admin'}
              </button>`
        }
      </td>
    </tr>
  `
    )
    .join('');

  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr><th>Name</th><th>Role</th><th>Joined</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function loadDashboard() {
  shell.innerHTML = createLoadingState('Loading admin dashboard…');

  const [eventsResult, profilesResult, messageCountResult] = await Promise.all([
    getAllEvents(),
    getAllProfiles(),
    getTotalMessageCount()
  ]);

  if (eventsResult.error || profilesResult.error) {
    shell.innerHTML = createErrorState({
      title: "Couldn't load admin data",
      body: eventsResult.error || profilesResult.error
    });
    return;
  }

  const events = eventsResult.data || [];
  const profiles = profilesResult.data || [];

  shell.innerHTML = `
    <div class="dash-welcome">
      <h1>Admin dashboard</h1>
      <p>Platform-wide events, users, and moderation.</p>
    </div>

    ${statsHtml({
      totalEvents: events.length,
      liveNow: events.filter((e) => e.status === 'live').length,
      totalUsers: profiles.length,
      totalMessages: messageCountResult.count || 0
    })}

    <div class="admin-section">
      <h2>All events</h2>
      ${eventsTableHtml(events)}
    </div>

    <div class="admin-section">
      <h2>All users</h2>
      ${usersTableHtml(profiles)}
    </div>
  `;

  shell.querySelectorAll('[data-cancel-event]').forEach((btn) => {
    btn.addEventListener('click', () => handleCancelEvent(btn));
  });

  shell.querySelectorAll('[data-toggle-role]').forEach((btn) => {
    btn.addEventListener('click', () => handleToggleRole(btn));
  });
}

async function handleCancelEvent(btn) {
  const id = btn.dataset.cancelEvent;
  if (!window.confirm('Cancel this event? The host and any viewers will see it end immediately.')) return;

  btn.disabled = true;
  const { error } = await updateEvent(id, { status: 'cancelled' });

  if (error) {
    showToast(error, { title: "Couldn't cancel event", variant: 'error' });
    btn.disabled = false;
    return;
  }

  showToast('Event cancelled.', { variant: 'success' });
  loadDashboard();
}

async function handleToggleRole(btn) {
  const id = btn.dataset.toggleRole;
  const currentRole = btn.dataset.currentRole;
  const nextRole = currentRole === 'admin' ? 'broadcaster' : 'admin';

  if (!window.confirm(`${nextRole === 'admin' ? 'Grant' : 'Remove'} admin access for this user?`)) return;

  btn.disabled = true;
  const { error } = await setProfileRole(id, nextRole);

  if (error) {
    showToast(error, { title: "Couldn't update role", variant: 'error' });
    btn.disabled = false;
    return;
  }

  showToast('Role updated.', { variant: 'success' });
  loadDashboard();
}

async function init() {
  adminSession = await requireAdmin();

  const dashActions = document.querySelector('.dash-topbar-inner .btn-secondary');
  // Add a sign-out option alongside the existing "Back to dashboard" link.
  const signOutBtn = document.createElement('button');
  signOutBtn.className = 'btn btn-ghost';
  signOutBtn.type = 'button';
  signOutBtn.textContent = 'Sign out';
  signOutBtn.addEventListener('click', async () => {
    await signOut();
    window.location.href = '/';
  });
  dashActions?.insertAdjacentElement('beforebegin', signOutBtn);

  loadDashboard();
}

init();
