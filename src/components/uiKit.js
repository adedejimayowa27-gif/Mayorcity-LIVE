// Small markup-generating functions shared across the platform. Later
// batches (event lists, dashboards, live viewer pages) call these with
// real data instead of re-inventing the markup, which is how the same
// visual language stays consistent as features are added.

import { escapeHtml } from '../utils/dom.js';
import { serverNow } from '../utils/serverTime.js';

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
      ${isLive ? createLiveBadge() : `<span class="badge">${escapeHtml(category)}</span>`}
      <h3 class="card-title" style="margin-top: var(--space-4)">${escapeHtml(title)}</h3>
      <p class="card-body">${escapeHtml(category)}${viewers ? ` &middot; ${viewers} watching` : ''}</p>
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

/**
 * Renders the on-video overlay graphic (programme lower-third or football
 * scoreboard) from an event's `overlay` JSON field. Used identically by the
 * host's own preview (broadcast.html) and every viewer (event.html), so
 * what the host sees is exactly what the audience sees.
 * @param {{ type?: 'programme' | 'scoreboard', visible?: boolean, programme?: object, scoreboard?: object } | null} overlay
 */

/* ---- Match clock ------------------------------------------------------
   The clock is stored as plain numbers inside overlay.scoreboard.clock:
     { period: 'PRE'|'1H'|'HT'|'2H'|'FT', running, baseSeconds, startedAt, halfLength, visible }
   Nothing ticks in the database — every screen works out the current time
   itself from baseSeconds + (now - startedAt), so host and viewers agree. */

export function getClockElapsedSeconds(clock, now = serverNow()) {
  if (!clock) return 0;
  const base = Number(clock.baseSeconds) || 0;
  if (!clock.running || !clock.startedAt) return Math.max(0, base);
  return Math.max(0, base + (now - clock.startedAt) / 1000);
}

/** "12:05", "45+2'" for stoppage time, or "HT" / "FT". */
export function formatMatchClock(clock, now = serverNow()) {
  if (!clock || clock.period === 'PRE') return '';
  if (clock.period === 'HT') return 'HT';
  if (clock.period === 'FT') return 'FT';

  const elapsed = Math.floor(getClockElapsedSeconds(clock, now));
  const half = Math.max(1, Number(clock.halfLength) || 45);
  const cap = (clock.period === '2H' ? half * 2 : half) * 60;

  if (elapsed >= cap) {
    const added = Math.floor((elapsed - cap) / 60) + 1;
    return `${cap / 60}+${added}'`;
  }
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** data-* attributes that let the shared ticker keep an element up to date. */
export function clockDataAttrs(clock) {
  if (!clock) return '';
  return `data-clock="1" data-clock-period="${clock.period}" data-clock-running="${clock.running ? 1 : 0}" data-clock-base="${Number(clock.baseSeconds) || 0}" data-clock-start="${Number(clock.startedAt) || 0}" data-clock-half="${Number(clock.halfLength) || 45}"`;
}

function tickClocks() {
  document.querySelectorAll('[data-clock]').forEach((el) => {
    const text = formatMatchClock({
      period: el.dataset.clockPeriod,
      running: el.dataset.clockRunning === '1',
      baseSeconds: Number(el.dataset.clockBase),
      startedAt: Number(el.dataset.clockStart),
      halfLength: Number(el.dataset.clockHalf)
    });
    if (el.textContent !== text) el.textContent = text;
  });
}

if (typeof window !== 'undefined' && !window.__mayorcityClockTicker) {
  window.__mayorcityClockTicker = window.setInterval(tickClocks, 500);
}

/* ---- Goal alert ---------------------------------------------------------
   The host stamps overlay.scoreboard.goal = { id, team, name, at } whenever a
   score goes up. Every screen shows the banner once, for about 6 seconds, and
   ignores goals that are already old (e.g. a viewer joining late). */

const goalSeen = new Map();
const GOAL_SHOWN_MS = 6000;

function renderGoalBanner(scoreboard) {
  const goal = scoreboard?.goal;
  if (!goal || !goal.id) return '';

  const age = serverNow() - goal.at;
  if (age > 8000 || age < -3000) return '';

  if (!goalSeen.has(goal.id)) goalSeen.set(goal.id, Date.now());
  const shown = Date.now() - goalSeen.get(goal.id);
  if (shown > GOAL_SHOWN_MS) return '';

  const { teamA = 'Team A', teamB = 'Team B', scoreA = 0, scoreB = 0 } = scoreboard;
  return `
    <div class="overlay-goal" role="status" style="animation-delay: -${shown}ms">
      <div class="overlay-goal-title">GOAL!</div>
      <div class="overlay-goal-team">${escapeHtml(goal.name || '')}</div>
      <div class="overlay-goal-score">${escapeHtml(teamA)} ${scoreA} &ndash; ${scoreB} ${escapeHtml(teamB)}</div>
    </div>
  `;
}

function renderMainOverlayHtml(overlay) {
  if (!overlay || !overlay.visible || !overlay.type) return '';

  if (overlay.type === 'programme') {
    const { heading = '', subheading = '' } = overlay.programme || {};
    if (!heading && !subheading) return '';
    return `
      <div class="overlay-programme">
        ${heading ? `<div class="overlay-programme-heading">${escapeHtml(heading)}</div>` : ''}
        ${subheading ? `<div class="overlay-programme-subheading">${escapeHtml(subheading)}</div>` : ''}
      </div>
    `;
  }

  if (overlay.type === 'scoreboard') {
    const { teamA = 'Team A', teamB = 'Team B', scoreA = 0, scoreB = 0, clock } = overlay.scoreboard || {};
    const clockText = clock && clock.visible !== false ? formatMatchClock(clock) : '';
    const clockHtml = clockText
      ? `<span class="overlay-scoreboard-clock" ${clockDataAttrs(clock)}>${escapeHtml(clockText)}</span>`
      : '';
    return `
      <div class="overlay-scoreboard">
        <span class="overlay-scoreboard-team">${escapeHtml(teamA)}</span>
        <span class="overlay-scoreboard-score">${scoreA}</span>
        <span class="overlay-scoreboard-dash">&ndash;</span>
        <span class="overlay-scoreboard-score">${scoreB}</span>
        <span class="overlay-scoreboard-team">${escapeHtml(teamB)}</span>
        ${clockHtml}
      </div>
      ${renderGoalBanner(overlay.scoreboard)}
    `;
  }

  return '';
}

/** Presenter lower-third / "Speaking now" badge. Shown independently of the
 *  programme graphic or scoreboard, so it can sit alongside either. */
function renderPresenterHtml(overlay) {
  const presenter = overlay?.presenter;
  if (!presenter || !presenter.visible || !presenter.name) return '';

  const speaking = presenter.mode !== 'presenter';
  const stacked = overlay.visible && overlay.type === 'programme' ? ' overlay-presenter-raised' : '';

  return `
    <div class="overlay-presenter${stacked}">
      ${
        speaking
          ? '<div class="overlay-presenter-label"><span class="overlay-presenter-dot" aria-hidden="true"></span>Speaking now</div>'
          : ''
      }
      <div class="overlay-presenter-name">${escapeHtml(presenter.name)}</div>
      ${presenter.role ? `<div class="overlay-presenter-role">${escapeHtml(presenter.role)}</div>` : ''}
    </div>
  `;
}

export function renderOverlayHtml(overlay) {
  if (!overlay) return '';
  return renderMainOverlayHtml(overlay) + renderPresenterHtml(overlay);
}
