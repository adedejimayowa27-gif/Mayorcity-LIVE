// Frontend LiveKit foundation. Nothing calls this yet in Batch 4 — the
// broadcaster control centre (Batch 7) and the viewer experience
// (Batch 5) are what will actually use connectAsHost/connectAsViewer.
// It exists now so those batches plug into an already-working connection
// layer instead of inventing one under deadline.
//
// LIVEKIT_API_KEY/SECRET are never imported here or anywhere in the
// frontend — only the room URL (public, not a secret) and a short-lived
// token fetched from the Netlify function are used client-side.

import { Room, RoomEvent } from 'livekit-client';
import { supabase } from '../lib/supabaseClient.js';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL;

/**
 * Requests a short-lived LiveKit token from the Netlify function.
 * @param {{ roomName: string, role: 'host' | 'viewer' }} params
 */
async function getBroadcastToken({ roomName, role }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const response = await fetch('/.netlify/functions/create-livekit-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify({ roomName, role })
  });

  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not get a broadcast token.');
  return body.token;
}

/**
 * Connects to an event's room as the host, with permission to publish
 * camera + microphone. Does not start publishing on its own — call
 * `room.localParticipant.setCameraEnabled(true)` etc. once connected.
 * @param {string} roomName Use the event's id so each event is its own room.
 */
export async function connectAsHost(roomName) {
  if (!LIVEKIT_URL) throw new Error('LiveKit is not configured (VITE_LIVEKIT_URL is missing).');

  const token = await getBroadcastToken({ roomName, role: 'host' });
  const room = new Room();
  await room.connect(LIVEKIT_URL, token);
  return room;
}

/**
 * Connects to an event's room as a viewer — subscribe-only, no publish
 * rights are granted by the token regardless of what the client asks for.
 * @param {string} roomName
 */
export async function connectAsViewer(roomName) {
  if (!LIVEKIT_URL) throw new Error('LiveKit is not configured (VITE_LIVEKIT_URL is missing).');

  const token = await getBroadcastToken({ roomName, role: 'viewer' });
  const room = new Room();
  await room.connect(LIVEKIT_URL, token);
  return room;
}

export { Room, RoomEvent };
