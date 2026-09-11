import { initNavbar } from '../components/navbar.js';
import { initFooter } from '../components/footer.js';
import { initToastRegion } from '../components/toast.js';
import { getPublicEvents, EVENT_CATEGORIES } from '../services/eventsService.js';
import { createLoadingState, createEmptyState, createErrorState, createLiveBadge } from '../components/uiKit.js';

initNavbar();
initFooter();
initToastRegion();

const container = document.getElementById('events-container');
const filterButtons = Array.from(document.querySelectorAll('.events-filter-btn'));

let allEvents = [];
let activeFilter = new URLSearchParams(window.location.search).get('filter') || 'all';

function categoryLabel(value) {
  return EVENT_CATEGORIES.find((c) => c.value === value)?.label || value;
}

function formatScheduledFor(value) {
  if (!value) return 'Time to be announced';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function eventCardHtml(event) {
  const badge = event.status === 'live' ? createLiveBadge() : `<span class="badge">${categoryLabel(event.category)}</span>`;

  return `
    <a class="event-list-card" href="/event.html?id=${event.id}">
      <article class="card card-hover">
        ${badge}
        <h3 class="card-title" style="margin-top: var(--space-4);">${event.title}</h3>
        <p class="card-body">${event.description ? event.description : categoryLabel(event.category)}</p>
        <p class="dash-event-meta" style="margin-top: var(--space-3);">${formatScheduledFor(event.scheduled_for)}</p>
      </article>
    </a>
  `;
}

function render() {
  const filtered = activeFilter === 'all' ? allEvents : allEvents.filter((e) => e.status === activeFilter);

  if (filtered.length === 0) {
    container.innerHTML = createEmptyState({
      title: activeFilter === 'live' ? 'Nothing live right now' : 'No events to show',
      body: activeFilter === 'live'
        ? 'Check back soon, or browse upcoming events instead.'
        : 'New events will show up here as soon as they\u2019re scheduled.'
    });
    return;
  }

  container.innerHTML = `<div class="events-grid">${filtered.map(eventCardHtml).join('')}</div>`;
}

function setActiveFilter(filter) {
  activeFilter = filter;
  filterButtons.forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.filter === filter)));
  render();
}

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => setActiveFilter(btn.dataset.filter));
});

async function loadEvents() {
  container.innerHTML = createLoadingState('Loading events…');

  const { data, error } = await getPublicEvents();

  if (error) {
    container.innerHTML = createErrorState({ body: error, onRetry: true });
    container.querySelector('[data-retry]')?.addEventListener('click', loadEvents);
    return;
  }

  allEvents = data || [];
  setActiveFilter(activeFilter);
}

loadEvents();
