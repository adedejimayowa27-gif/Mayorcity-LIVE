// Single shared Supabase client for the whole app.
// Every future batch (auth, events, chat, realtime) imports this same
// instance instead of creating its own — that's what makes swapping in
// real auth/data logic in later batches a non-breaking change.
//
// Only the public anon key is ever read here. The service-role key must
// never be imported into frontend code.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Non-fatal: Batch 1 has no real Supabase-backed features yet, so we
  // warn instead of throwing, and let the public UI keep working.
  console.warn(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and add your project credentials.'
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
);
