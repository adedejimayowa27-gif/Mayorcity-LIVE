// All reads/writes to the `events` table go through this one module —
// same pattern as authService.js. Dashboard forms, the public events list,
// and the event detail page all import from here rather than querying
// Supabase directly.

import { supabase } from '../lib/supabaseClient.js';

export const EVENT_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'class', label: 'Class' },
  { value: 'football', label: 'Football' },
  { value: 'church', label: 'Church' },
  { value: 'school', label: 'School event' },
  { value: 'conference', label: 'Conference / event' }
];

/**
 * @param {{ title: string, description?: string, category: string, scheduledFor?: string, hostId: string }} params
 */
export async function createEvent({ title, description, category, scheduledFor, hostId }) {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title,
      description: description || null,
      category,
      scheduled_for: scheduledFor || null,
      host_id: hostId
    })
    .select()
    .single();

  if (error) return { error: mapEventsError(error) };
  return { data };
}

/** Every event belonging to the current host, most recent first. Used by the dashboard. */
export async function getMyEvents(hostId) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('host_id', hostId)
    .order('created_at', { ascending: false });

  if (error) return { error: mapEventsError(error) };
  return { data };
}

/** Publicly visible (scheduled or live) events, soonest first. Used by the public events page. */
export async function getPublicEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .in('status', ['scheduled', 'live'])
    .order('scheduled_for', { ascending: true, nullsFirst: false });

  if (error) return { error: mapEventsError(error) };
  return { data };
}

export async function getEventById(id) {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
  if (error) return { error: mapEventsError(error) };
  return { data };
}

/** @param {string} id @param {Partial<{ title: string, description: string, category: string, status: string, scheduledFor: string }>} updates */
export async function updateEvent(id, updates) {
  const payload = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.scheduledFor !== undefined) payload.scheduled_for = updates.scheduledFor;
  if (updates.overlay !== undefined) payload.overlay = updates.overlay;

  const { data, error } = await supabase.from('events').update(payload).eq('id', id).select().single();
  if (error) return { error: mapEventsError(error) };
  return { data };
}

export async function deleteEvent(id) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return { error: mapEventsError(error) };
  return {};
}

/**
 * Subscribes to changes on a single event row (used by the viewer page so
 * it can switch to live video the moment a host goes live, with no
 * manual refresh). Returns an unsubscribe function.
 * @param {string} id
 * @param {(event: object) => void} onChange
 */
export function subscribeToEvent(id, onChange) {
  const channel = supabase
    .channel(`event-${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` },
      (payload) => onChange(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

function mapEventsError(error) {
  const message = error?.message ?? '';
  if (message.includes('row-level security')) {
    return "You don't have permission to do that.";
  }
  return message || 'Something went wrong. Please try again.';
}
