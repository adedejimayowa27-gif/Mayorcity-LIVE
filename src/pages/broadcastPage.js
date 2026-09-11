import { requireAuth } from '../utils/authGuard.js';
import { getEventById, updateEvent } from '../services/eventsService.js';
import { connectAsHost, RoomEvent } from '../services/broadcastService.js';
import { initToastRegion, showToast } from '../components/toast.js';
import { createErrorState, createLiveBadge } from '../components/uiKit.js';
import { setButtonLoading } from '../utils/dom.js';

initToastRegion();

const shell = document.getElementById('broadcast-shell');

let room = null;
let event = null;
let cameraOn = false;

function shareUrl(eventId) {
  return `${window.location.origin}/event.html?id=${eventId}`;
}

function renderBroadcastUI() {
  const isLive = event.status === 'live';

  shell.innerHTML = `
    <div class="broadcast-header">
      <h1>${event.title}</h1>
      <p>This is your camera preview. Only you can see this until you go live.</p>
    </div>

    <div class="broadcast-monitor">
      <video id="local-preview" autoplay playsinline muted></video>
      <div class="broadcast-monitor-placeholder" id="monitor-placeholder">Camera is off</div>
      <div class="broadcast-monitor-badge" id="monitor-badge">
        ${isLive ? createLiveBadge() : ''}
      </div>
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
  `;

  document.getElementById('toggle-camera').addEventListener('click', handleToggleCamera);
  document.getElementById('toggle-mic').addEventListener('click', handleToggleMic);
  document.getElementById('copy-link').addEventListener('click', handleCopyLink);

  const goLiveBtn = document.getElementById('go-live');
  goLiveBtn?.addEventListener('click', handleGoLive);

  const endBtn = document.getElementById('end-broadcast');
  endBtn?.addEventListener('click', handleEndBroadcast);
}

async function handleToggleCamera(e) {
  const btn = e.currentTarget;
  setButtonLoading(btn, true, cameraOn ? 'Stopping…' : 'Starting…');

  try {
    await room.localParticipant.setCameraEnabled(!cameraOn);
    cameraOn = !cameraOn;
  } catch (err) {
    showToast('Could not access your camera. Check your browser permissions.', {
      title: 'Camera error',
      variant: 'error'
    });
    setButtonLoading(btn, false);
    return;
  }

  setButtonLoading(btn, false, cameraOn ? 'Stop camera' : 'Start camera');
  document.getElementById('toggle-mic').disabled = !cameraOn;
  document.getElementById('monitor-placeholder').style.display = cameraOn ? 'none' : 'flex';

  const goLiveBtn = document.getElementById('go-live');
  if (goLiveBtn) goLiveBtn.disabled = !cameraOn;

  if (cameraOn) {
    // Enable the mic alongside the camera by default; the host can mute after.
    await room.localParticipant.setMicrophoneEnabled(true);
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

async function handleEndBroadcast(e) {
  setButtonLoading(e.currentTarget, true, 'Ending…');
  const { error } = await updateEvent(event.id, { status: 'ended' });

  await room.localParticipant.setCameraEnabled(false);
  await room.disconnect();

  setButtonLoading(e.currentTarget, false);

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

function reattachVideo() {
  const videoEl = document.getElementById('local-preview');
  if (!videoEl) return;

  for (const pub of room.localParticipant.videoTrackPublications.values()) {
    if (pub.track) pub.track.attach(videoEl);
  }
}

async function init() {
  const session = await requireAuth();
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

  window.addEventListener('beforeunload', () => {
    room?.disconnect();
  });
}

init();
