import { requireAuth } from '../utils/authGuard.js';
import { signOut } from '../services/authService.js';
import {
  EVENT_CATEGORIES,
  createEvent,
  getMyEvents,
  updateEvent,
  deleteEvent
} from '../services/eventsService.js';
import { initToastRegion, showToast } from '../components/toast.js';
import { createLoadingState, createEmptyState, createErrorState, createLiveBadge } from '../components/uiKit.js';
import { setButtonLoading } from '../utils/dom.js';

initToastRegion();

const dashActions = document.getElementById('dash-actions');
const dashWelcome = document.getElementById('dash-welcome');
const eventsList = document.getElementById('events-list');
const form = document.getElementById('create-event-form');
const categorySelect = document.getElementById('event-category');
const submitBtn = form.querySelector('button[type="submit"]');

// Holds the confirmed session once init() resolves. Every handler below
// reads this rather than taking it as a parameter, since they're all
// wired up only after init() has already set it.
let session = null;

function formatScheduledFor(value) {
  if (!value) return 'No date set';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function categoryLabel(value) {
  return EVENT_CATEGORIES.find((c) => c.value === value)?.label || value;
}

function eventCardHtml(event) {
  const badge = event.status === 'live' ? createLiveBadge() : `<span class="badge">${categoryLabel(event.category)}</span>`;
  const isCancelled = event.status === 'cancelled';

  return `
    <article class="card dash-event-card" data-event-id="${event.id}">
      <div>
        ${badge}
        <h3 class="card-title" style="margin-top: var(--space-3);">${event.title}</h3>
        ${event.description ? `<p class="card-body">${event.description}</p>` : ''}
        <p class="dash-event-meta">${formatScheduledFor(event.scheduled_for)}${isCancelled ? ' &middot; Cancelled' : ''}</p>
      </div>
      <div class="dash-event-actions">
        ${
          event.status === 'scheduled'
            ? `<button class="btn btn-secondary" type="button" data-action="cancel">Cancel</button>`
            : ''
        }
        <button class="btn btn-ghost" type="button" data-action="delete">Delete</button>
      </div>
    </article>
  `;
}

async function loadEvents() {
  eventsList.innerHTML = createLoadingState('Loading your events…');

  const { data, error } = await getMyEvents(session.user.id);

  if (error) {
    eventsList.innerHTML = createErrorState({ body: error, onRetry: true });
    eventsList.querySelector('[data-retry]')?.addEventListener('click', loadEvents);
    return;
  }

  if (!data || data.length === 0) {
    eventsList.innerHTML = createEmptyState({
      title: 'No events yet',
      body: 'Create your first event above to see it here.'
    });
    return;
  }

  eventsList.innerHTML = `<div class="dash-events-list">${data.map(eventCardHtml).join('')}</div>`;

  eventsList.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
    btn.addEventListener('click', () => handleCancel(btn));
  });
  eventsList.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => handleDelete(btn));
  });
}

async function handleCancel(btn) {
  const card = btn.closest('[data-event-id]');
  const id = card.dataset.eventId;
  btn.disabled = true;

  const { error } = await updateEvent(id, { status: 'cancelled' });

  if (error) {
    showToast(error, { title: "Couldn't cancel event", variant: 'error' });
    btn.disabled = false;
    return;
  }

  showToast('Event cancelled.', { variant: 'success' });
  loadEvents();
}

async function handleDelete(btn) {
  const card = btn.closest('[data-event-id]');
  const id = card.dataset.eventId;

  if (!window.confirm('Delete this event? This can\u2019t be undone.')) return;

  btn.disabled = true;
  const { error } = await deleteEvent(id);

  if (error) {
    showToast(error, { title: "Couldn't delete event", variant: 'error' });
    btn.disabled = false;
    return;
  }

  showToast('Event deleted.', { variant: 'success' });
  loadEvents();
}

function setFieldError(fieldId, errorId, hasError) {
  document.getElementById(fieldId).classList.toggle('field-error', hasError);
  document.getElementById(errorId).hidden = !hasError;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const title = document.getElementById('event-title').value.trim();
  const description = document.getElementById('event-description').value.trim();
  const scheduledFor = document.getElementById('event-scheduled').value;
  const category = categorySelect.value;

  const titleValid = title.length > 0;
  setFieldError('title-field', 'title-error', !titleValid);
  if (!titleValid) return;

  setButtonLoading(submitBtn, true, 'Creating…');

  const { error } = await createEvent({
    title,
    description,
    category,
    scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
    hostId: session.user.id
  });

  setButtonLoading(submitBtn, false);

  if (error) {
    showToast(error, { title: "Couldn't create event", variant: 'error' });
    return;
  }

  showToast('Event created.', { variant: 'success' });
  form.reset();
  loadEvents();
});

// Everything that depends on a confirmed session lives inside this async
// function instead of at the top level, so the build doesn't rely on
// top-level await (unsupported in some build/browser targets).
async function init() {
  // Redirects to /signin.html if there's no session — everything below
  // only runs for a signed-in user.
  session = await requireAuth();
  const displayName = session.user?.user_metadata?.full_name || session.user?.email;

  dashActions.innerHTML = `<button class="btn btn-secondary" type="button" id="dash-sign-out">Sign out</button>`;
  document.getElementById('dash-sign-out').addEventListener('click', async () => {
    await signOut();
    window.location.href = '/';
  });

  dashWelcome.innerHTML = `
    <h1>Welcome, ${displayName}</h1>
    <p>Create an event below, then manage it here until broadcasting goes live in a future update.</p>
  `;

  categorySelect.innerHTML = EVENT_CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join('');

  loadEvents();
}

init();
