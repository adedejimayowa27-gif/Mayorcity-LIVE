import { initNavbar } from '../components/navbar.js';
import { initFooter } from '../components/footer.js';
import { initToastRegion, showToast } from '../components/toast.js';
import { getEventById, EVENT_CATEGORIES, subscribeToEvent } from '../services/eventsService.js';
import { connectAsViewer, RoomEvent } from '../services/broadcastService.js';
import { createLoadingState, createErrorState, createLiveBadge } from '../components/uiKit.js';

initNavbar();
initFooter();
initToastRegion();

const content = document.getElementById('event-detail-content');

let currentEvent = null;
let unsubscribeRealtime = null;
let viewerRoom = null;

function categoryLabel(value) {
  return EVENT_CATEGORIES.find((c) => c.value === value)?.label || value;
}

function formatScheduledFor(value) {
  if (!value) return 'Time to be announced';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
}

function monitorNote(status) {
  if (status === 'live') return 'Connecting to the live stream…';
  if (status === 'ended') return 'This broadcast has ended.';
  return 'Video will appear here once this broadcast goes live.';
}

function renderEvent(event) {
  currentEvent = event;

  document.title = `${event.title} — Mayorcity LIVE`;
  document.getElementById('meta-description').setAttribute(
    'content',
    event.description || `${event.title} on Mayorcity LIVE.`
  );

  const badge = event.status === 'live' ? createLiveBadge() : `<span class="badge">${categoryLabel(event.category)}</span>`;

  content.innerHTML = `
    <div class="hero-monitor" style="margin-top: var(--space-2);">
      <video id="viewer-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover;display:none;"></video>
      <div class="hero-monitor-frame" id="monitor-frame"></div>
      <div class="hero-monitor-topbar">
        ${badge}
      </div>
      <div class="hero-monitor-caption" id="monitor-caption">
        <h3>${event.title}</h3>
        <p>${categoryLabel(event.category)}</p>
      </div>
    </div>
    <p class="event-detail-monitor-note" id="monitor-note">${monitorNote(event.status)}</p>

    <div class="event-detail-header">
      ${badge}
      <h1>${event.title}</h1>
      <div class="event-detail-meta">
        <span>${categoryLabel(event.category)}</span>
        <span>${formatScheduledFor(event.scheduled_for)}</span>
      </div>
    </div>

    ${event.description ? `<p class="event-detail-description">${event.description}</p>` : ''}
  `;

  if (event.status === 'live') {
    connectViewer(event.id);
  } else {
    disconnectViewer();
  }
}

async function connectViewer(eventId) {
  if (viewerRoom) return; // already connected

  try {
    viewerRoom = await connectAsViewer(eventId);
  } catch (err) {
    const note = document.getElementById('monitor-note');
    if (note) note.textContent = "Couldn't connect to the live stream. Try refreshing the page.";
    return;
  }

  viewerRoom.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind !== 'video') return;
    const videoEl = document.getElementById('viewer-video');
    const frame = document.getElementById('monitor-frame');
    const caption = document.getElementById('monitor-caption');
    const note = document.getElementById('monitor-note');
    if (!videoEl) return;

    track.attach(videoEl);
    videoEl.style.display = 'block';
    if (frame) frame.style.display = 'none';
    if (caption) caption.style.display = 'none';
    if (note) note.style.display = 'none';
  });

  viewerRoom.on(RoomEvent.Disconnected, () => {
    viewerRoom = null;
  });
}

function disconnectViewer() {
  if (viewerRoom) {
    viewerRoom.disconnect();
    viewerRoom = null;
  }
}

async function loadEvent() {
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    content.innerHTML = createErrorState({
      title: 'No event specified',
      body: 'Go back to the events page and pick a broadcast to view.'
    });
    return;
  }

  content.innerHTML = createLoadingState('Loading event…');

  const { data, error } = await getEventById(id);

  if (error || !data) {
    content.innerHTML = createErrorState({
      title: 'Event not found',
      body: "This event may have been removed, or the link isn't correct."
    });
    return;
  }

  renderEvent(data);

  // Keeps this page in sync the moment the host goes live or ends the
  // broadcast, with no manual refresh needed.
  unsubscribeRealtime = subscribeToEvent(id, (updatedEvent) => {
    renderEvent(updatedEvent);
    if (updatedEvent.status === 'live') {
      showToast(`${updatedEvent.title} just went live.`, { variant: 'success' });
    }
  });
}

window.addEventListener('beforeunload', () => {
  disconnectViewer();
  unsubscribeRealtime?.();
});

loadEvent();
