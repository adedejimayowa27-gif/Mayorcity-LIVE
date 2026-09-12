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
  document.title = `${event.title} — Mayorcity LIVE`;
  document.getElementById('meta-description').setAttribute(
    'content',
    event.description || `${event.title} on Mayorcity LIVE.`
  );

  const badge = event.status === 'live' ? createLiveBadge() : `<span class="badge">${categoryLabel(event.category)}</span>`;

  content.innerHTML = `
    <div class="hero-monitor" style="margin-top: var(--space-2);">
      <video id="viewer-video" playsinline muted style="width:100%;height:100%;object-fit:cover;display:none;"></video>
      <div class="hero-monitor-frame" id="monitor-frame"></div>

      <div class="hero-monitor-topbar">
        ${badge}
        <span class="hero-monitor-viewers" id="viewer-count" hidden></span>
      </div>

      <div class="hero-monitor-caption" id="monitor-caption">
        <h3>${event.title}</h3>
        <p>${categoryLabel(event.category)}</p>
      </div>

      <div id="player-connecting" hidden></div>
      <div id="player-controls-region"></div>
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

function showConnecting(message) {
  const el = document.getElementById('player-connecting');
  if (!el) return;
  el.hidden = false;
  el.className = 'player-connecting';
  el.innerHTML = `<div class="spinner" aria-hidden="true"></div><span>${message}</span>`;
}

function hideConnecting() {
  const el = document.getElementById('player-connecting');
  if (el) el.hidden = true;
}

function updateViewerCount(room) {
  const el = document.getElementById('viewer-count');
  if (!el) return;
  const count = room.remoteParticipants.size;
  el.hidden = false;
  el.textContent = `${count} watching`;
}

function renderPlayerControls(videoEl) {
  const region = document.getElementById('player-controls-region');
  if (!region) return;

  region.innerHTML = `
    <button class="player-unmute-prompt" id="unmute-prompt" type="button">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 5v4h2.5L8 12V2L4.5 5H2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M10 4.5c1 1 1 4 0 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
      Tap to unmute
    </button>
    <div class="player-controls">
      <button class="player-control-btn" id="mute-toggle" type="button" aria-label="Mute or unmute">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 6v4h3l4 3V3L5 6H2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
      </button>
      <button class="player-control-btn" id="fullscreen-toggle" type="button" aria-label="Fullscreen">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
  `;

  const unmutePrompt = document.getElementById('unmute-prompt');
  const muteToggle = document.getElementById('mute-toggle');
  const fullscreenToggle = document.getElementById('fullscreen-toggle');

  function unmute() {
    videoEl.muted = false;
    unmutePrompt.style.display = 'none';
  }

  unmutePrompt.addEventListener('click', unmute);
  muteToggle.addEventListener('click', () => {
    videoEl.muted = !videoEl.muted;
    if (!videoEl.muted) unmutePrompt.style.display = 'none';
  });
  fullscreenToggle.addEventListener('click', () => {
    const container = videoEl.closest('.hero-monitor');
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen?.();
    }
  });
}

async function connectViewer(eventId) {
  if (viewerRoom) return; // already connected

  showConnecting('Connecting to the live stream…');

  try {
    viewerRoom = await connectAsViewer(eventId);
  } catch (err) {
    hideConnecting();
    const note = document.getElementById('monitor-note');
    if (note) note.textContent = "Couldn't connect to the live stream. Try refreshing the page.";
    return;
  }

  updateViewerCount(viewerRoom);

  viewerRoom.on(RoomEvent.ParticipantConnected, () => updateViewerCount(viewerRoom));
  viewerRoom.on(RoomEvent.ParticipantDisconnected, () => updateViewerCount(viewerRoom));

  viewerRoom.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind !== 'video') return;
    const videoEl = document.getElementById('viewer-video');
    const frame = document.getElementById('monitor-frame');
    const caption = document.getElementById('monitor-caption');
    const note = document.getElementById('monitor-note');
    if (!videoEl) return;

    track.attach(videoEl);
    videoEl.style.display = 'block';
    videoEl.play?.().catch(() => {});
    if (frame) frame.style.display = 'none';
    if (caption) caption.style.display = 'none';
    if (note) note.style.display = 'none';
    hideConnecting();
    renderPlayerControls(videoEl);
  });

  viewerRoom.on(RoomEvent.Reconnecting, () => showConnecting('Reconnecting…'));
  viewerRoom.on(RoomEvent.Reconnected, () => hideConnecting());
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
    const wasLive = document.getElementById('viewer-video')?.style.display === 'block';
    renderEvent(updatedEvent);
    if (updatedEvent.status === 'live' && !wasLive) {
      showToast(`${updatedEvent.title} just went live.`, { variant: 'success' });
    }
    if (updatedEvent.status === 'ended' && wasLive) {
      showToast('The host ended this broadcast.', { variant: 'default' });
    }
  });
}

window.addEventListener('beforeunload', () => {
  disconnectViewer();
  unsubscribeRealtime?.();
});

loadEvent();
