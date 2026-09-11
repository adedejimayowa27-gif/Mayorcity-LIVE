// Small markup-generating functions shared across the platform. Later
// batches (event lists, dashboards, live viewer pages) call these with
// real data instead of re-inventing the markup, which is how the same
// visual language stays consistent as features are added.

export function createLiveBadge(label = 'Live') {
  return `
    <span class="badge badge-live">
      <span class="dot" aria-hidden="true"></span>
      ${label}
    </span>
  `;
}

/**
 * @param {{ title: string, category: string, viewers?: number, isLive?: boolean }} event
 */
export function createEventCard(event) {
  const { title, category, viewers, isLive } = event;
  return `
    <article class="card card-hover">
      ${isLive ? createLiveBadge() : `<span class="badge">${category}</span>`}
      <h3 class="card-title" style="margin-top: var(--space-4)">${title}</h3>
      <p class="card-body">${category}${viewers ? ` &middot; ${viewers} watching` : ''}</p>
    </article>
  `;
}

export function createLoadingState(message = 'Loading') {
  return `
    <div class="state" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p class="state-body">${message}</p>
    </div>
  `;
}

export function createEmptyState({ title, body }) {
  return `
    <div class="state">
      <div class="state-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="5" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4" />
          <path d="M3 8h14" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </div>
      <p class="state-title">${title}</p>
      <p class="state-body">${body}</p>
    </div>
  `;
}

export function createErrorState({ title = 'Something went wrong', body, onRetry }) {
  return `
    <div class="state" data-variant="error" role="alert">
      <div class="state-icon" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="1.4" />
          <path d="M10 6.5v4M10 13v.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </div>
      <p class="state-title">${title}</p>
      <p class="state-body">${body}</p>
      ${onRetry ? `<button class="btn btn-secondary" type="button" data-retry>Try again</button>` : ''}
    </div>
  `;
}
