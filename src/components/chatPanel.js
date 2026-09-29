// Shared chat UI, mounted identically on event.html (viewers, who may not
// be signed in) and inside broadcast.html's control centre (the host,
// always signed in, with delete rights over their own event's chat).

import {
  getRecentMessages,
  sendMessage,
  deleteMessage,
  subscribeToChat,
  getSavedDisplayName,
  saveDisplayName
} from '../services/chatService.js';
import { escapeHtml } from '../utils/dom.js';
import { showToast } from './toast.js';

/**
 * @param {{
 *   mountEl: HTMLElement,
 *   eventId: string,
 *   session: import('@supabase/supabase-js').Session | null,
 *   isHost?: boolean
 * }} options
 * @returns {{ destroy: () => void }}
 */
let activeInstance = null;

export function initChatPanel({ mountEl, eventId, session, isHost = false }) {
  // Re-initialising (e.g. after a guest enters their name) must stop the
  // previous instance first, or its listeners and timers keep running.
  activeInstance?.destroy();

  let authorId = session?.user?.id || null;
  let authorName = session?.user?.user_metadata?.full_name || session?.user?.email || '';
  let needsNamePrompt = !authorId && !authorName;

  if (needsNamePrompt) {
    const saved = getSavedDisplayName();
    if (saved) {
      authorName = saved;
      needsNamePrompt = false;
    }
  }

  mountEl.innerHTML = `
    <div class="chat-panel">
      <div class="chat-messages" id="chat-messages" role="log" aria-live="polite"></div>
      ${
        needsNamePrompt
          ? `
        <form class="chat-name-form" id="chat-name-form">
          <input class="input" type="text" id="chat-name-input" placeholder="Enter a name to chat" maxlength="40" required />
          <button class="btn btn-primary" type="submit">Join chat</button>
        </form>
      `
          : `
        <form class="chat-input-row" id="chat-form">
          <input class="input" type="text" id="chat-input" placeholder="Say something…" maxlength="500" autocomplete="off" />
          <button class="btn btn-primary" type="submit" aria-label="Send">Send</button>
        </form>
      `
      }
    </div>
  `;

  const messagesEl = document.getElementById('chat-messages');

  function messageHtml(message) {
    const isMine = authorId && message.author_id === authorId;
    const time = new Date(message.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    return `
      <div class="chat-message" data-message-id="${message.id}" data-created-at="${message.created_at}">
        <div class="chat-message-meta">
          <span class="chat-message-author">${escapeHtml(message.author_name)}${isMine ? ' (you)' : ''}</span>
          <span class="chat-message-time">${time}</span>
          ${isHost ? `<button class="chat-message-delete" type="button" data-delete-id="${message.id}" aria-label="Delete message">&times;</button>` : ''}
        </div>
        <div class="chat-message-body">${escapeHtml(message.body)}</div>
      </div>
    `;
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendMessage(message) {
    // The same message can arrive twice (once from our own send, once from
    // the realtime feed) — only show it once.
    if (messagesEl.querySelector(`[data-message-id="${message.id}"]`)) return;
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;
    messagesEl.insertAdjacentHTML('beforeend', messageHtml(message));
    wireDeleteButton(message.id);
    if (nearBottom || message.author_id === authorId) scrollToBottom();
  }

  function removeMessage(id) {
    messagesEl.querySelector(`[data-message-id="${id}"]`)?.remove();
  }

  function wireDeleteButton(id) {
    if (!isHost) return;
    messagesEl.querySelector(`[data-delete-id="${id}"]`)?.addEventListener('click', async () => {
      const { error } = await deleteMessage(id);
      if (!error) removeMessage(id);
    });
  }

  function wireNameForm() {
    const form = document.getElementById('chat-name-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = document.getElementById('chat-name-input');
      const name = input.value.trim();
      if (!name) return;
      authorName = name;
      saveDisplayName(name);
      needsNamePrompt = false;
      initChatPanel({ mountEl, eventId, session, isHost });
    });
  }

  function wireChatForm() {
    const form = document.getElementById('chat-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = document.getElementById('chat-input');
      const body = input.value;
      if (!body.trim()) return;

      input.disabled = true;
      const { data, error } = await sendMessage({ eventId, authorId, authorName, body });
      input.disabled = false;

      if (error) {
        showToast(error, { title: "Couldn't send message", variant: 'error' });
        input.focus();
        return;
      }

      input.value = '';
      input.focus();
      // Show it straight away instead of waiting for the realtime feed.
      if (data) appendMessage(data);
    });
  }

  wireNameForm();
  wireChatForm();

  let unsubscribe = () => {};
  let pollTimer = null;
  let destroyed = false;

  // Realtime is the fast path, but it only works if the chat_messages table
  // is in Supabase's realtime publication. Polling guarantees everyone sees
  // every message (and deletions) within a few seconds either way.
  async function syncMessages() {
    const { data } = await getRecentMessages(eventId);
    if (!data || destroyed) return;

    const fetchedIds = new Set(data.map((m) => m.id));
    data.forEach(appendMessage);

    const oldestFetched = data.length ? new Date(data[0].created_at).getTime() : 0;
    messagesEl.querySelectorAll('[data-message-id]').forEach((el) => {
      const id = el.getAttribute('data-message-id');
      const createdAt = new Date(el.getAttribute('data-created-at')).getTime();
      if (!fetchedIds.has(id) && (data.length < 50 || createdAt >= oldestFetched)) el.remove();
    });
  }

  (async () => {
    const { data } = await getRecentMessages(eventId);
    if (destroyed) return;
    if (data) {
      messagesEl.innerHTML = data.map(messageHtml).join('');
      data.forEach((m) => wireDeleteButton(m.id));
      scrollToBottom();
    }

    unsubscribe = subscribeToChat(eventId, {
      onInsert: appendMessage,
      onDelete: removeMessage
    });

    pollTimer = window.setInterval(syncMessages, 4000);
  })();

  const instance = {
    destroy: () => {
      destroyed = true;
      window.clearInterval(pollTimer);
      unsubscribe();
      if (activeInstance === instance) activeInstance = null;
    }
  };
  activeInstance = instance;
  return instance;
}
