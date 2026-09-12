// All reads/writes to `chat_messages` go through this one module — same
// pattern as authService.js / eventsService.js.

import { supabase } from '../lib/supabaseClient.js';

const DISPLAY_NAME_KEY = 'mayorcity_chat_display_name';

/** Reads a previously-chosen anonymous display name for this browser session. */
export function getSavedDisplayName() {
  return window.sessionStorage.getItem(DISPLAY_NAME_KEY) || '';
}

export function saveDisplayName(name) {
  window.sessionStorage.setItem(DISPLAY_NAME_KEY, name);
}

/** Most recent messages for an event, oldest first (ready to render top-to-bottom). */
export async function getRecentMessages(eventId, limit = 50) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { error: mapChatError(error) };
  return { data: (data || []).reverse() };
}

/** @param {{ eventId: string, authorId?: string|null, authorName: string, body: string }} params */
export async function sendMessage({ eventId, authorId, authorName, body }) {
  const trimmed = body.trim();
  if (!trimmed) return { error: 'Message cannot be empty.' };
  if (trimmed.length > 500) return { error: 'Message is too long (500 characters max).' };

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      event_id: eventId,
      author_id: authorId || null,
      author_name: authorName.trim().slice(0, 40) || 'Guest',
      body: trimmed
    })
    .select()
    .single();

  if (error) return { error: mapChatError(error) };
  return { data };
}

/** Host-only: remove a message from their own event's chat. */
export async function deleteMessage(id) {
  const { error } = await supabase.from('chat_messages').delete().eq('id', id);
  if (error) return { error: mapChatError(error) };
  return {};
}

/**
 * Subscribes to new/deleted messages for an event's chat. Returns an
 * unsubscribe function.
 * @param {string} eventId
 * @param {{ onInsert?: (message: object) => void, onDelete?: (id: string) => void }} handlers
 */
export function subscribeToChat(eventId, { onInsert, onDelete } = {}) {
  const channel = supabase
    .channel(`chat-${eventId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
      (payload) => onInsert?.(payload.new)
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `event_id=eq.${eventId}` },
      (payload) => onDelete?.(payload.old.id)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/** Admin-only in practice: total chat messages across the whole platform, for the stats view. */
export async function getTotalMessageCount() {
  const { count, error } = await supabase.from('chat_messages').select('*', { count: 'exact', head: true });
  if (error) return { error: mapChatError(error) };
  return { count: count || 0 };
}

function mapChatError(error) {
  const message = error?.message ?? '';
  if (message.includes('row-level security')) return "You don't have permission to do that.";
  if (message.includes('chat_messages_body_check')) return 'Message is too long or empty.';
  if (message.includes('chat_messages_author_name_check')) return 'Name must be 1-40 characters.';
  return message || 'Something went wrong. Please try again.';
}
