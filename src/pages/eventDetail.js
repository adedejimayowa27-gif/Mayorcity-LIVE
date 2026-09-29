import { syncServerTime } from '../utils/serverTime.js';
import { initNavbar } from '../components/navbar.js';
import { initFooter } from '../components/footer.js';
import { initToastRegion, showToast } from '../components/toast.js';
import { getEventById, EVENT_CATEGORIES, subscribeToEvent } from '../services/eventsService.js';
import { getSession } from '../services/authService.js';
import { connectAsViewer, RoomEvent } from '../services/broadcastService.js';
import { createLoadingState, createErrorState, createLiveBadge, renderOverlayHtml } from '../components/uiKit.js';
import { initChatPanel } from '../components/chatPanel.js';
import { escapeHtml } from '../utils/dom.js';
import { lockLandscape, unlockOrientation } from '../utils/orientation.js';

initNavbar();
initFooter();
initToastRegion();
syncServerTime();

const content = document.getElementById('event-detail-content');

let unsubscribeRealtime = null;
let viewerRoom = null;
let currentStatus = null;
let viewerAudioEls = [];
const attachedTrackSids = new Set();
let currentEventId = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let intentionalDisconnect = false;
let isConnecting = false;
let noVideoTimer = null;

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

// Full rebuild of the monitor + video element. Only called on the initial
// load and when status actually changes (scheduled -> live -> ended) —
// NOT on every overlay update, which would otherwise tear down the live
// video track each time a host adjusts a scoreboard.
function renderEvent(event) {
  currentStatus = event.status;

  document.title = `${event.title} — Mayorcity LIVE`;
  document.getElementById('meta-description').setAttribute(
    'content',
    event.description || `${event.title} on Mayorcity LIVE.`
  );

  const badge = event.status === 'live' ? createLiveBadge() : `<span class="badge">${categoryLabel(event.category)}</span>`;

  content.innerHTML = `
    <div class="hero-monitor" style="margin-top: var(--space-2); aspect-ratio: 16 / 9;">
      <video id="viewer-video" playsinline muted style="width:100%;height:100%;object-fit:contain;background:#000;display:none;"></video>
      <div class="hero-monitor-frame" id="monitor-frame"></div>

      <div class="hero-monitor-topbar">
        ${badge}
        <span class="hero-monitor-viewers" id="viewer-count" hidden></span>
      </div>

      <div class="hero-monitor-caption" id="monitor-caption">
        <h3>${escapeHtml(event.title)}</h3>
        <p>${categoryLabel(event.category)}</p>
      </div>

      <div class="monitor-overlay" id="monitor-overlay">${renderOverlayHtml(event.overlay)}</div>

      <div id="player-connecting" hidden></div>
      <div id="player-controls-region"></div>
    </div>
    <p class="event-detail-monitor-note" id="monitor-note">${monitorNote(event.status)}</p>

    <div class="event-detail-header">
      ${badge}
      <h1>${escapeHtml(event.title)}</h1>
      <div class="event-detail-meta">
        <span>${categoryLabel(event.category)}</span>
        <span>${formatScheduledFor(event.scheduled_for)}</span>
      </div>
    </div>

    ${event.description ? `<p class="event-detail-description">${escapeHtml(event.description)}</p>` : ''}
  `;

  if (event.status === 'ended') renderEndedScreen(event);

  if (event.status === 'live') {
    currentEventId = event.id;
    connectViewer(event.id);
  } else {
    disconnectViewer();
  }
}

// A proper "this broadcast has ended" screen instead of a blank player.
function renderEndedScreen(event) {
  const monitor = document.querySelector('.hero-monitor');
  if (!monitor) return;

  const board = event.overlay?.scoreboard;
  const showScore = board && (board.scoreA > 0 || board.scoreB > 0 || board.clock?.period === 'FT');
  const finalScore = showScore
    ? `<div class="ended-score">Final score: ${escapeHtml(board.teamA)} ${board.scoreA} &ndash; ${board.scoreB} ${escapeHtml(board.teamB)}</div>`
    : '';

  ['monitor-caption', 'monitor-overlay'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.getElementById('monitor-note')?.style.setProperty('display', 'none');

  monitor.insertAdjacentHTML(
    'beforeend',
    `
    <div class="ended-panel" role="status">
      <div class="ended-title">This broadcast has ended</div>
      <p class="ended-body">Thanks for watching ${escapeHtml(event.title)}.</p>
      ${finalScore}
      <a class="btn btn-primary" href="/events.html">Watch other broadcasts</a>
    </div>
  `
  );
}

// Lightweight update used for anything that isn't a status change —
// currently just the overlay — so the video element is never recreated.
function updateOverlayOnly(overlay) {
  const el = document.getElementById('monitor-overlay');
  if (el) el.innerHTML = renderOverlayHtml(overlay);
}

function showConnecting(message, { retry = false } = {}) {
  const el = document.getElementById('player-connecting');
  if (!el) return;
  el.hidden = false;
  el.className = 'player-connecting';
  el.innerHTML = `
    <div class="spinner" aria-hidden="true"></div>
    <span>${message}</span>
    ${retry ? '<button class="btn btn-secondary player-retry-btn" id="player-retry" type="button">Retry now</button>' : ''}
  `;
  document.getElementById('player-retry')?.addEventListener('click', retryNow);
}

function retryNow() {
  window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (currentEventId && currentStatus === 'live') connectViewer(currentEventId);
}

// Retries with a growing delay (2s, 4s, 8s, 16s, then every 30s) for as long
// as the broadcast is live, so a viewer on weak data recovers by themselves.
function scheduleReconnect(eventId) {
  if (reconnectTimer || currentStatus !== 'live') return;

  reconnectAttempts += 1;
  const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempts, 5));
  const offline = navigator.onLine === false;

  showConnecting(
    offline
      ? "You're offline. We'll reconnect as soon as your internet is back."
      : `Connection lost. Reconnecting in ${Math.round(delay / 1000)}s…`,
    { retry: true }
  );

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectViewer(eventId);
  }, delay);
}

function clearViewerAudio() {
  viewerAudioEls.forEach((el) => el.remove());
  viewerAudioEls = [];
}

function hostHasVideo(room) {
  for (const participant of room.remoteParticipants.values()) {
    for (const pub of participant.trackPublications.values()) {
      if (pub.kind === 'video' && !pub.isMuted && pub.track) return true;
    }
  }
  return false;
}

window.addEventListener('offline', () => {
  if (currentStatus === 'live') showConnecting("You're offline. We'll reconnect as soon as your internet is back.");
});

window.addEventListener('online', () => {
  if (currentStatus === 'live' && !viewerRoom) retryNow();
});

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

  function applyMuted(muted) {
    videoEl.muted = muted; // the <video> carries no audio; sound comes from the <audio> elements
    viewerAudioEls.forEach((el) => {
      el.muted = muted;
      if (!muted) {
        el.volume = 1;
        el.play?.().catch(() => {});
      }
    });
    if (!muted) {
      // Browsers only allow sound after a tap — this runs inside one.
      viewerRoom?.startAudio?.().catch(() => {});
      unmutePrompt.hidden = true;
    }
    muteToggle.innerHTML = muted ? ICON_MUTED : ICON_UNMUTED;
    muteToggle.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }

  muteToggle.innerHTML = videoEl.muted ? ICON_MUTED : ICON_UNMUTED;
  if (!videoEl.muted) unmutePrompt.hidden = true;

  unmutePrompt.addEventListener('click', () => applyMuted(false));
  muteToggle.addEventListener('click', () => applyMuted(!videoEl.muted));

  fullscreenToggle.addEventListener('click', async () => {
    const container = videoEl.closest('.hero-monitor');
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement;

    if (fsElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      return;
    }
    if (container.classList.contains('is-pseudo-fullscreen')) {
      container.classList.remove('is-pseudo-fullscreen');
      unlockOrientation();
      return;
    }

    const request = container.requestFullscreen || container.webkitRequestFullscreen;
    if (request) {
      try {
        await request.call(container);
        lockLandscape();
        return;
      } catch {
        /* fall through to the fallbacks below */
      }
    }
    // No Fullscreen API (iPhone Safari). Don't use the native video player —
    // it would hide the scoreboard/programme overlays — fill the screen instead.
    container.classList.add('is-pseudo-fullscreen');
  });
}

const ICON_UNMUTED = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 6v4h3l4 3V3L5 6H2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M11.5 5.5c1 1.2 1 3.8 0 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const ICON_MUTED = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 6v4h3l4 3V3L5 6H2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M11 6l3 4M14 6l-3 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';

// Covers every way out of fullscreen (button, back gesture, Esc). Registered
// once, not on every render of the controls.
function onFullscreenChange() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) unlockOrientation();
}
document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);

async function connectViewer(eventId) {
  if (viewerRoom || isConnecting) return; // already connected / in progress

  isConnecting = true;
  intentionalDisconnect = false;
  currentEventId = eventId;

  showConnecting('Connecting to the live stream…');
  attachedTrackSids.clear();
  clearViewerAudio();

  try {
    viewerRoom = await connectAsViewer(eventId);
  } catch (err) {
    isConnecting = false;
    scheduleReconnect(eventId);
    return;
  }
  isConnecting = false;
  reconnectAttempts = 0;
  const room = viewerRoom;

  // If the host's video never shows up, say so instead of spinning forever.
  window.clearTimeout(noVideoTimer);
  noVideoTimer = window.setTimeout(() => {
    if (viewerRoom === room && !hostHasVideo(room)) {
      showConnecting("Waiting for the host's video… If this takes long, the host may have lost connection.");
    }
  }, 15000);

  updateViewerCount(viewerRoom);

  viewerRoom.on(RoomEvent.ParticipantConnected, () => updateViewerCount(viewerRoom));
  viewerRoom.on(RoomEvent.ParticipantDisconnected, () => updateViewerCount(viewerRoom));

  function handleTrack(track) {
    if (track.sid && attachedTrackSids.has(track.sid)) return;
    if (track.sid) attachedTrackSids.add(track.sid);

    const videoEl = document.getElementById('viewer-video');

    if (track.kind === 'audio') {
      const audioEl = track.attach();
      audioEl.autoplay = true;
      audioEl.muted = videoEl ? videoEl.muted : true;
      // Not display:none — some mobile browsers won't play hidden media.
      audioEl.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(audioEl);
      viewerAudioEls.push(audioEl);
      // Audio can arrive after the video; make sure controls exist either way.
      if (videoEl && !document.getElementById('mute-toggle')) renderPlayerControls(videoEl);
      return;
    }

    if (track.kind !== 'video') return;
    const frame = document.getElementById('monitor-frame');
    const caption = document.getElementById('monitor-caption');
    const note = document.getElementById('monitor-note');
    if (!videoEl) return;

    // Show the element before attaching so adaptive streaming sees a real,
    // visible size and requests the right quality layer straight away.
    videoEl.style.display = 'block';
    track.attach(videoEl);
    videoEl.play?.().catch(() => {});
    if (frame) frame.style.display = 'none';
    if (caption) caption.style.display = 'none';
    if (note) note.style.display = 'none';
    window.clearTimeout(noVideoTimer);
    hideConnecting();
    renderPlayerControls(videoEl);
  }

  viewerRoom.on(RoomEvent.TrackSubscribed, (track) => handleTrack(track));

  // The host's tracks may already have been subscribed by the time the
  // listener above was attached — pick those up too, otherwise the viewer
  // is stuck on "Connecting to the live stream…" forever.
  viewerRoom.remoteParticipants.forEach((participant) => {
    participant.trackPublications.forEach((pub) => {
      if (pub.track) handleTrack(pub.track);
    });
  });

  viewerRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
    const prompt = document.getElementById('unmute-prompt');
    if (prompt && viewerRoom && !viewerRoom.canPlaybackAudio) prompt.hidden = false;
  });

  viewerRoom.on(RoomEvent.Reconnecting, () => showConnecting('Your connection is weak. Reconnecting…'));
  viewerRoom.on(RoomEvent.Reconnected, () => {
    if (hostHasVideo(room)) hideConnecting();
  });

  // Host paused or lost their video.
  const onHostVideoGone = (pubOrTrack) => {
    if ((pubOrTrack?.kind ?? '') !== 'video') return;
    showConnecting("The host's video is paused. It will resume automatically.");
  };
  viewerRoom.on(RoomEvent.TrackMuted, onHostVideoGone);
  viewerRoom.on(RoomEvent.TrackUnsubscribed, (track) => onHostVideoGone(track));
  viewerRoom.on(RoomEvent.TrackUnmuted, (pub) => {
    if (pub?.kind === 'video') hideConnecting();
  });
  viewerRoom.on(RoomEvent.ParticipantDisconnected, () => {
    if (viewerRoom === room && !hostHasVideo(room)) {
      showConnecting('The host has lost connection. Waiting for them to come back…');
    }
  });

  viewerRoom.on(RoomEvent.Disconnected, () => {
    if (viewerRoom === room) viewerRoom = null;
    clearViewerAudio();
    if (!intentionalDisconnect && currentStatus === 'live') scheduleReconnect(eventId);
  });
}

function disconnectViewer() {
  intentionalDisconnect = true;
  window.clearTimeout(reconnectTimer);
  window.clearTimeout(noVideoTimer);
  reconnectTimer = null;
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

  const { session } = await getSession();
  initChatPanel({
    mountEl: document.getElementById('chat-mount'),
    eventId: id,
    session: session || null,
    isHost: false
  });

  // Keeps this page in sync the moment the host goes live, ends the
  // broadcast, or updates an overlay — with no manual refresh needed.
  unsubscribeRealtime = subscribeToEvent(id, (updatedEvent) => {
    if (updatedEvent.status !== currentStatus) {
      const wasLive = currentStatus === 'live';
      renderEvent(updatedEvent);
      if (updatedEvent.status === 'live' && !wasLive) {
        showToast(`${updatedEvent.title} just went live.`, { variant: 'success' });
      }
      if (updatedEvent.status === 'ended' && wasLive) {
        showToast('The host ended this broadcast.', { variant: 'default' });
      }
    } else {
      updateOverlayOnly(updatedEvent.overlay);
    }
  });
}

window.addEventListener('beforeunload', () => {
  disconnectViewer();
  unsubscribeRealtime?.();
});

loadEvent();
