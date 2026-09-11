// Netlify Function — the ONLY place LIVEKIT_API_KEY / LIVEKIT_API_SECRET
// are ever read. They live in Netlify's environment variables (Site
// settings → Environment variables), never in a VITE_-prefixed variable,
// which means they never ship to the browser.
//
// The frontend calls this at /.netlify/functions/create-livekit-token to
// get a short-lived token for a specific room, instead of ever holding a
// LiveKit credential itself.
//
// Batch 4 wires this up as infrastructure only — no page calls it yet.
// Batch 5+ (viewer experience) and the broadcaster control centre are what
// will actually call broadcastService.getBroadcastToken() from the UI.

import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return new Response(
      JSON.stringify({ error: 'LiveKit is not configured on this deployment yet.' }),
      { status: 503 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 });
  }

  const { roomName, role } = body;

  if (!roomName || typeof roomName !== 'string') {
    return new Response(JSON.stringify({ error: 'roomName is required.' }), { status: 400 });
  }

  if (role !== 'host' && role !== 'viewer') {
    return new Response(JSON.stringify({ error: "role must be 'host' or 'viewer'." }), { status: 400 });
  }

  // Identify the caller from their Supabase session (sent as a bearer
  // token) rather than trusting a client-supplied name — this is what
  // stops a viewer from requesting a 'host' (publish-capable) token for
  // someone else's event.
  const authHeader = req.headers.get('authorization') || '';
  const accessToken = authHeader.replace('Bearer ', '');

  let identity = `guest-${Math.random().toString(36).slice(2, 10)}`;
  let displayName = 'Guest';

  if (accessToken && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data.user) {
      identity = data.user.id;
      displayName = data.user.user_metadata?.full_name || data.user.email || 'User';
    } else if (role === 'host') {
      // No verified identity and this request wants publish rights — refuse.
      return new Response(JSON.stringify({ error: 'You must be signed in to broadcast.' }), { status: 401 });
    }
  } else if (role === 'host') {
    return new Response(JSON.stringify({ error: 'You must be signed in to broadcast.' }), { status: 401 });
  }

  // TODO (Batch 4b/7): verify `identity` is actually the host_id on the
  // `events` row for `roomName` before issuing a publish-capable token,
  // once the broadcaster control centre calls this with a real event id.

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: displayName,
    ttl: '4h'
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: role === 'host',
    canPublishData: true,
    canSubscribe: true
  });

  const jwt = await token.toJwt();

  return new Response(JSON.stringify({ token: jwt }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
