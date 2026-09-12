import { requireAuth } from '../utils/authGuard.js';
import { getEventById, updateEvent } from '../services/eventsService.js';
import { connectAsHost, RoomEvent } from '../services/broadcastService.js';
import { initToastRegion, showToast } from '../components/toast.js';
import { createErrorState, createLiveBadge, renderOverlayHtml } from '../components/uiKit.js';
import { createModal } from '../components/modal.js';
import { initChatPanel } from '../components/chatPanel.js';
import { setButtonLoading, escapeHtml } from '../utils/dom.js';

initToastRegion();

const shell = document.getElementById('broadcast-shell');
const endBroadcastModal = createModal(document.getElementById('end-broadcast-modal'));

let room = null;
let event = null;
let hostSession = null;
let chatPanelInstance = null;
let activeTab = 'overlays';
let liveTimerInterval = null;
let liveStartedAt = null;

// Local working copy of the overlay. Kept even when hidden, so toggling
// visibility off and back on doesn't lose typed-in team names/scores.
let overlayState = {
  type: null,
  visible: false,
  programme: { heading: '', subheading: '' },
  scoreboard: { teamA: 'Team A', teamB: 'Team B', scoreA: 0, scoreB: 0 }
};

function shareUrl(eventId) {
  return `${window.location.origin}/event.html?id=${eventId}`;
}

function qualityLabel(quality) {
  if (quality === 'excellent') return { text: 'Excellent', color: 'var(--color-success)' };
  if (quality === 'good') return { text: 'Good', color: 'var(--color-warning)' };
  if (quality === 'poor') return { text: 'Poor', color: 'var(--color-error)' };
  return { text: 'Checking…', color: 'var(--color-text-faint)' };
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function renderBroadcastUI() {
  const isLive = event.status === 'live';
  const isFootball = event.category === 'football';

  shell.innerHTML = `
    <div class="broadcast-header">
      <h1>${escapeHtml(event.title)}</h1>
      <p>This is your camera preview. Only you can see this until you go live.</p>
    </div>

    <div class="broadcast-stats">
      <div class="broadcast-stat">
        <span class="broadcast-stat-label">Status</span>
        <span class="broadcast-stat-value">${isLive ? 'Live' : 'Not live'}</span>
      </div>
      <div class="broadcast-stat">
        <span class="broadcast-stat-label">Watching</span>
        <span class="broadcast-stat-value" id="stat-viewers">0</span>
      </div>
      <div class="broadcast-stat">
        <span class="broadcast-stat-label">Duration</span>
        <span class="broadcast-stat-value" id="stat-duration">${isLive ? '00:00' : '—'}</span>
      </div>
      <div class="broadcast-stat">
        <span class="broadcast-stat-label">Connection</span>
        <span class="broadcast-stat-value" id="stat-quality"><span class="quality-dot" style="background:var(--color-text-faint)"></span>Checking…</span>
      </div>
    </div>

    <div class="control-centre-grid">
      <div>
        <div class="broadcast-monitor">
          <video id="local-preview" autoplay playsinline muted></video>
          <div class="broadcast-monitor-placeholder" id="monitor-placeholder">Camera is off</div>
          <div class="broadcast-monitor-badge" id="monitor-badge">
            ${isLive ? createLiveBadge() : ''}
          </div>
          <div class="monitor-overlay" id="host-monitor-overlay">${renderOverlayHtml(overlayState)}</div>
        </div>

        <div class="broadcast-controls">
          <button class="btn btn-secondary" type="button" id="toggle-camera">Start camera</button>
          <button class="btn btn-secondary" type="button" id="toggle-mic" disabled>Mute mic</button>
          ${
            isLive
              ? `<button class="btn btn-primary" type="button" id="end-broadcast">End broadcast</button>`
              : `<button class="btn btn-primary" type="button" id="go-live" disabled>Go live</button>`
          }
        </div>

        <div class="field">
          <label class="field-label" for="share-link">Viewer link</label>
          <div class="broadcast-share">
            <input class="input" type="text" id="share-link" readonly value="${shareUrl(event.id)}" />
            <button class="btn btn-secondary" type="button" id="copy-link">Copy</button>
          </div>
        </div>
      </div>

      <div>
        <div class="control-tabs" role="tablist">
          <button class="control-tab-btn" type="button" role="tab" data-tab="overlays" aria-selected="${activeTab === 'overlays'}">Overlays</button>
          <button class="control-tab-btn" type="button" role="tab" data-tab="chat" aria-selected="${activeTab === 'chat'}">Chat</button>
          <button class="control-tab-btn" type="button" role="tab" data-tab="settings" aria-selected="${activeTab === 'settings'}">Settings</button>
        </div>
        <div id="tab-panel"></div>
      </div>
    </div>
  `;

  renderTabPanel(isFootball);

  document.getElementById('toggle-camera').addEventListener('click', handleToggleCamera);
  document.getElementById('toggle-mic').addEventListener('click', handleToggleMic);
  document.getElementById('copy-link').addEventListener('click', handleCopyLink);

  document.getElementById('go-live')?.addEventListener('click', handleGoLive);
  document.getElementById('end-broadcast')?.addEventListener('click', () => endBroadcastModal.open());

  shell.querySelectorAll('.control-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      shell.querySelectorAll('.control-tab-btn').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      renderTabPanel(isFootball);
    });
  });

  updateHostViewerCount();
  if (isLive) startLiveTimer();
}

function renderTabPanel(isFootball) {
  const panel = document.getElementById('tab-panel');
  if (!panel) return;

  // Any previous chat subscription is no longer attached to a live DOM
  // node once we rewrite the panel below — tear it down first.
  chatPanelInstance?.destroy();
  chatPanelInstance = null;

  if (activeTab === 'chat') {
    panel.innerHTML = `<div id="host-chat-mount"></div>`;
    chatPanelInstance = initChatPanel({
      mountEl: document.getElementById('host-chat-mount'),
      eventId: event.id,
      session: hostSession,
      isHost: true
    });
    return;
  }

  if (activeTab === 'settings') {
    panel.innerHTML = `
      <div class="card">
        <div class="field device-field">
          <label class="field-label" for="camera-select">Camera</label>
          <select class="input" id="camera-select"><option>Loading devices…</option></select>
        </div>
        <div class="field device-field" style="margin-bottom: 0;">
          <label class="field-label" for="mic-select">Microphone</label>
          <select class="input" id="mic-select"><option>Loading devices…</option></select>
        </div>
      </div>
    `;
    populateDeviceOptions();
    return;
  }

  panel.innerHTML = `
    <div class="card overlay-panel">
      <div class="overlay-panel-header">
        <h2>Programme graphic</h2>
        <button class="btn btn-secondary" type="button" id="toggle-programme">
          ${overlayState.visible && overlayState.type === 'programme' ? 'Hide' : 'Show'}
        </button>
      </div>
      <div class="field">
        <label class="field-label" for="programme-heading">Heading</label>
        <input class="input" type="text" id="programme-heading" placeholder="e.g. Beyond the Classroom" value="${escapeHtml(overlayState.programme.heading)}" />
      </div>
      <div class="field" style="margin-bottom: 0;">
        <label class="field-label" for="programme-subheading">Subheading</label>
        <input class="input" type="text" id="programme-subheading" placeholder="e.g. Riverside Secondary School" value="${escapeHtml(overlayState.programme.subheading)}" />
      </div>
    </div>

    ${
      isFootball
        ? `
    <div class="card overlay-panel">
      <div class="overlay-panel-header">
        <h2>Scoreboard</h2>
        <button class="btn btn-secondary" type="button" id="toggle-scoreboard">
          ${overlayState.visible && overlayState.type === 'scoreboard' ? 'Hide' : 'Show'}
        </button>
      </div>

      <div class="dash-form-row" style="margin-bottom: var(--space-4);">
        <div class="field" style="margin-bottom: 0;">
          <label class="field-label" for="team-a-name">Team A</label>
          <input class="input" type="text" id="team-a-name" value="${escapeHtml(overlayState.scoreboard.teamA)}" />
        </div>
        <div class="field" style="margin-bottom: 0;">
          <label class="field-label" for="team-b-name">Team B</label>
          <input class="input" type="text" id="team-b-name" value="${escapeHtml(overlayState.scoreboard.teamB)}" />
        </div>
      </div>

      <div class="overlay-score-row">
        <span class="field-label">${escapeHtml(overlayState.scoreboard.teamA)} score</span>
        <div class="overlay-score-controls">
          <button class="overlay-score-btn" type="button" data-score="a" data-delta="-1" aria-label="Decrease Team A score">&minus;</button>
          <span class="overlay-score-value" id="score-a-value">${overlayState.scoreboard.scoreA}</span>
          <button class="overlay-score-btn" type="button" data-score="a" data-delta="1" aria-label="Increase Team A score">+</button>
        </div>
      </div>

      <div class="overlay-score-row" style="margin-bottom: 0;">
        <span class="field-label">${escapeHtml(overlayState.scoreboard.teamB)} score</span>
        <div class="overlay-score-controls">
          <button class="overlay-score-btn" type="button" data-score="b" data-delta="-1" aria-label="Decrease Team B score">&minus;</button>
          <span class="overlay-score-value" id="score-b-value">${overlayState.scoreboard.scoreB}</span>
          <button class="overlay-score-btn" type="button" data-score="b" data-delta="1" aria-label="Increase Team B score">+</button>
        </div>
      </div>
    </div>
    `
        : ''
    }
  `;

  wireOverlayControls(isFootball);
}

function wireOverlayControls(isFootball) {
  const headingInput = document.getElementById('programme-heading');
  const subheadingInput = document.getElementById('programme-subheading');

  headingInput.addEventListener('change', () => {
    overlayState.programme.heading = headingInput.value.trim();
    persistOverlay();
  });
  subheadingInput.addEventListener('change', () => {
    overlayState.programme.subheading = subheadingInput.value.trim();
    persistOverlay();
  });

  document.getElementById('toggle-programme').addEventListener('click', () => {
    const alreadyShowing = overlayState.visible && overlayState.type === 'programme';
    overlayState.type = alreadyShowing ? overlayState.type : 'programme';
    overlayState.visible = !alreadyShowing;
    persistOverlay();
    renderTabPanel(isFootball);
  });

  if (!isFootball) return;

  const teamAInput = document.getElementById('team-a-name');
  const teamBInput = document.getElementById('team-b-name');

  teamAInput.addEventListener('change', () => {
    overlayState.scoreboard.teamA = teamAInput.value.trim() || 'Team A';
    persistOverlay();
    renderTabPanel(isFootball);
  });
  teamBInput.addEventListener('change', () => {
    overlayState.scoreboard.teamB = teamBInput.value.trim() || 'Team B';
    persistOverlay();
    renderTabPanel(isFootball);
  });

  document.getElementById('toggle-scoreboard').addEventListener('click', () => {
    const alreadyShowing = overlayState.visible && overlayState.type === 'scoreboard';
    overlayState.type = alreadyShowing ? overlayState.type : 'scoreboard';
    overlayState.visible = !alreadyShowing;
    persistOverlay();
    renderTabPanel(isFootball);
  });

  document.querySelectorAll('[data-score]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const team = btn.dataset.score === 'a' ? 'scoreA' : 'scoreB';
      const delta = Number(btn.dataset.delta);
      overlayState.scoreboard[team] = Math.max(0, overlayState.scoreboard[team] + delta);
      document.getElementById(`score-${btn.dataset.score}-value`).textContent = overlayState.scoreboard[team];
      persistOverlay();
    });
  });
}

async function populateDeviceOptions() {
  const cameraSelect = document.getElementById('camera-select');
  const micSelect = document.getElementById('mic-select');

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((d) => d.kind === 'videoinput');
    const mics = devices.filter((d) => d.kind === 'audioinput');

    cameraSelect.innerHTML = cameras.length
      ? cameras.map((d, i) => `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`).join('')
      : '<option>No camera found</option>';

    micSelect.innerHTML = mics.length
      ? mics.map((d, i) => `<option value="${d.deviceId}">${d.label || `Microphone ${i + 1}`}</option>`).join('')
      : '<option>No microphone found</option>';

    cameraSelect.addEventListener('change', async () => {
      if (!room) return;
      await room.switchActiveDevice('videoinput', cameraSelect.value);
      showToast('Camera switched.', { variant: 'success' });
    });

    micSelect.addEventListener('change', async () => {
      if (!room) return;
      await room.switchActiveDevice('audioinput', micSelect.value);
      showToast('Microphone switched.', { variant: 'success' });
    });
  } catch {
    cameraSelect.innerHTML = '<option>Grant camera access to see devices</option>';
    micSelect.innerHTML = '<option>Grant microphone access to see devices</option>';
  }
}

async function handleToggleCamera(e) {
  const btn = e.currentTarget;
  const cameraOn = room.localParticipant.isCameraEnabled;
  setButtonLoading(btn, true, cameraOn ? 'Stopping…' : 'Starting…');

  try {
    await room.localParticipant.setCameraEnabled(!cameraOn);
  } catch (err) {
    showToast('Could not access your camera. Check your browser permissions.', {
      title: 'Camera error',
      variant: 'error'
    });
    setButtonLoading(btn, false);
    return;
  }

  const nowOn = room.localParticipant.isCameraEnabled;
  setButtonLoading(btn, false, nowOn ? 'Stop camera' : 'Start camera');
  document.getElementById('toggle-mic').disabled = !nowOn;
  document.getElementById('monitor-placeholder').style.display = nowOn ? 'none' : 'flex';

  const goLiveBtn = document.getElementById('go-live');
  if (goLiveBtn) goLiveBtn.disabled = !nowOn;

  if (nowOn) {
    await room.localParticipant.setMicrophoneEnabled(true);
    if (activeTab === 'settings') populateDeviceOptions();
  }
}

async function handleToggleMic(e) {
  const btn = e.currentTarget;
  const micEnabled = room.localParticipant.isMicrophoneEnabled;
  await room.localParticipant.setMicrophoneEnabled(!micEnabled);
  btn.textContent = micEnabled ? 'Unmute mic' : 'Mute mic';
}

async function handleGoLive(e) {
  setButtonLoading(e.currentTarget, true, 'Going live…');
  const { data, error } = await updateEvent(event.id, { status: 'live' });
  setButtonLoading(e.currentTarget, false);

  if (error) {
    showToast(error, { title: "Couldn't go live", variant: 'error' });
    return;
  }

  event = data;
  showToast('You\u2019re live.', { variant: 'success' });
  renderBroadcastUI();
  reattachVideo();
}

async function confirmEndBroadcast() {
  const btn = document.getElementById('confirm-end-broadcast');
  setButtonLoading(btn, true, 'Ending…');

  const { error } = await updateEvent(event.id, { status: 'ended' });

  await room.localParticipant.setCameraEnabled(false);
  await room.disconnect();
  stopLiveTimer();

  setButtonLoading(btn, false);
  endBroadcastModal.close();

  if (error) {
    showToast(error, { title: "Couldn't end broadcast cleanly", variant: 'error' });
  } else {
    showToast('Broadcast ended.', { variant: 'success' });
  }

  window.location.href = '/dashboard.html';
}

function handleCopyLink() {
  const input = document.getElementById('share-link');
  input.select();
  navigator.clipboard?.writeText(input.value);
  showToast('Viewer link copied.', { variant: 'success' });
}

async function persistOverlay() {
  document.getElementById('host-monitor-overlay').innerHTML = renderOverlayHtml(overlayState);
  const { error } = await updateEvent(event.id, { overlay: overlayState });
  if (error) showToast(error, { title: "Couldn't update overlay", variant: 'error' });
}

function reattachVideo() {
  const videoEl = document.getElementById('local-preview');
  if (!videoEl) return;

  for (const pub of room.localParticipant.videoTrackPublications.values()) {
    if (pub.track) pub.track.attach(videoEl);
  }
}

function updateHostViewerCount() {
  const el = document.getElementById('stat-viewers');
  if (!el || !room) return;
  const count = room.remoteParticipants.size;
  el.textContent = count;

  if (event && count > (event.peak_viewers || 0)) {
    event.peak_viewers = count;
    updateEvent(event.id, { peakViewers: count });
  }
}

function updateQualityBadge(quality) {
  const el = document.getElementById('stat-quality');
  if (!el) return;
  const { text, color } = qualityLabel(quality);
  el.innerHTML = `<span class="quality-dot" style="background:${color}"></span>${text}`;
}

function startLiveTimer() {
  if (liveTimerInterval) return;
  liveStartedAt = liveStartedAt || Date.now();
  liveTimerInterval = window.setInterval(() => {
    const el = document.getElementById('stat-duration');
    if (el) el.textContent = formatDuration(Date.now() - liveStartedAt);
  }, 1000);
}

function stopLiveTimer() {
  if (liveTimerInterval) window.clearInterval(liveTimerInterval);
  liveTimerInterval = null;
}

async function init() {
  document.getElementById('confirm-end-broadcast').addEventListener('click', confirmEndBroadcast);

  const session = await requireAuth();
  hostSession = session;
  const eventId = new URLSearchParams(window.location.search).get('id');

  if (!eventId) {
    shell.innerHTML = createErrorState({
      title: 'No event specified',
      body: 'Go back to your dashboard and choose an event to broadcast.'
    });
    return;
  }

  const { data, error } = await getEventById(eventId);

  if (error || !data) {
    shell.innerHTML = createErrorState({ title: 'Event not found', body: 'This event may have been removed.' });
    return;
  }

  if (data.host_id !== session.user.id) {
    shell.innerHTML = createErrorState({
      title: "This isn't your event",
      body: 'Only the host who created an event can broadcast it.'
    });
    return;
  }

  if (data.status === 'ended' || data.status === 'cancelled') {
    shell.innerHTML = createErrorState({
      title: 'This event has already ended',
      body: 'Create a new event from your dashboard to broadcast again.'
    });
    return;
  }

  event = data;
  if (event.overlay) overlayState = { ...overlayState, ...event.overlay };

  renderBroadcastUI();

  try {
    room = await connectAsHost(event.id);
  } catch (err) {
    shell.innerHTML = createErrorState({
      title: "Couldn't connect",
      body: err.message || 'Broadcasting is not available right now.'
    });
    return;
  }

  room.on(RoomEvent.LocalTrackPublished, reattachVideo);
  room.on(RoomEvent.ParticipantConnected, updateHostViewerCount);
  room.on(RoomEvent.ParticipantDisconnected, updateHostViewerCount);
  room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
    if (participant === room.localParticipant) updateQualityBadge(quality);
  });

  window.addEventListener('beforeunload', () => {
    room?.disconnect();
  });
}

init();
