// Vercel Function: the ONLY place LIVEKIT_API_KEY / LIVEKIT_API_SECRET are
// ever read. They live in Vercel's environment variables (Project Settings
// -> Environment Variables), never in a VITE_-prefixed variable, which means
// they never ship to the browser.
//
// The frontend calls this at /api/create-livekit-token to get a short-lived
// token for a specific room, instead of ever holding a LiveKit credential.

import { AccessToken } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

export async function POST(req) {
  const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
  const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return json({ error: 'LiveKit is not configured on this deployment yet.' }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const { roomName, role } = body;

  if (!roomName || typeof roomName !== 'string') {
    return json({ error: 'roomName is required.' }, 400);
  }

  if (role !== 'host' && role !== 'viewer') {
    return json({ error: "role must be 'host' or 'viewer'." }, 400);
  }

  // Identify the caller from their Supabase session (sent as a bearer
  // token) rather than trusting a client-supplied name — this is what
  // stops a viewer from requesting a 'host' (publish-capable) token.
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
      return json({ error: 'You must be signed in to broadcast.' }, 401);
    }
  } else if (role === 'host') {
    return json({ error: 'You must be signed in to broadcast.' }, 401);
  }

  // TODO: verify `identity` is actually the host_id on the `events` row for
  // `roomName` before issuing a publish-capable token.

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

  return json({ token: await token.toJwt() });
}
