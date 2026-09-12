// All reads/writes to `profiles` go through this one module — same
// pattern as the other services.

import { supabase } from '../lib/supabaseClient.js';

export async function getProfile(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error) return { error: mapProfileError(error) };
  return { data };
}

/** Admin-only in practice: RLS only returns every row when the caller is an admin. */
export async function getAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) return { error: mapProfileError(error) };
  return { data };
}

/** Admin-only: RLS rejects this update for anyone whose own role isn't 'admin'. */
export async function setProfileRole(id, role) {
  const { data, error } = await supabase.from('profiles').update({ role }).eq('id', id).select().single();
  if (error) return { error: mapProfileError(error) };
  return { data };
}

function mapProfileError(error) {
  const message = error?.message ?? '';
  if (message.includes('row-level security')) return "You don't have permission to do that.";
  return message || 'Something went wrong. Please try again.';
}
