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

/**
 * @param {{
 *   mountEl: HTMLElement,
 *   eventId: string,
 *   session: import('@supabase/supabase-js').Session | null,
 *   isHost?: boolean
 * }} options
 * @returns {{ destroy: () => void }}
 */
export function initChatPanel({ mountEl, eventId, session, isHost = false }) {
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
      <div class="chat-message" data-message-id="${message.id}">
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
    messagesEl.insertAdjacentHTML('beforeend', messageHtml(message));
    wireDeleteButton(message.id);
    scrollToBottom();
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
      const { error } = await sendMessage({ eventId, authorId, authorName, body });
      input.disabled = false;

      if (!error) {
        input.value = '';
        input.focus();
      }
    });
  }

  wireNameForm();
  wireChatForm();

  let unsubscribe = () => {};

  (async () => {
    const { data } = await getRecentMessages(eventId);
    if (data) {
      messagesEl.innerHTML = data.map(messageHtml).join('');
      data.forEach((m) => wireDeleteButton(m.id));
      scrollToBottom();
    }

    unsubscribe = subscribeToChat(eventId, {
      onInsert: appendMessage,
      onDelete: removeMessage
    });
  })();

  return {
    destroy: () => unsubscribe()
  };
}
