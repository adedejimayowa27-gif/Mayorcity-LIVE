// Keeps a small offset between this device's clock and the server's clock,
// so time-based features (match clock, goal alerts) agree on every screen.
// If the server can't be reached, the offset stays 0 and the device clock
// is used — the features still work, just without the correction.

let offsetMs = 0;
let syncedOnce = false;
let resyncTimer = null;

/** Current time, corrected to server time once a sync has succeeded. */
export function serverNow() {
  return Date.now() + offsetMs;
}

/** Measures the offset using a few round trips and keeps the most accurate one. */
export async function syncServerTime() {
  let best = null;

  for (let i = 0; i < 3; i += 1) {
    try {
      const sentAt = Date.now();
      const response = await fetch('/.netlify/functions/server-time', { cache: 'no-store' });
      const receivedAt = Date.now();
      if (!response.ok) continue;

      const { now } = await response.json();
      if (typeof now !== 'number') continue;

      const roundTrip = receivedAt - sentAt;
      const offset = now + roundTrip / 2 - receivedAt;
      // The fastest round trip is the least distorted by network delay.
      if (!best || roundTrip < best.roundTrip) best = { roundTrip, offset };
    } catch {
      /* offline or function not deployed — keep the previous offset */
    }
  }

  if (best) {
    offsetMs = best.offset;
    syncedOnce = true;
  }

  // Re-check every 5 minutes so long broadcasts don't drift.
  if (!resyncTimer) resyncTimer = window.setInterval(syncServerTime, 5 * 60 * 1000);
  return syncedOnce;
}
