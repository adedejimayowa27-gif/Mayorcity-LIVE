# Mayorcity LIVE

A live broadcasting platform: someone at a location uses their phone's camera
and microphone to broadcast to an audience watching remotely — classes,
football matches, church programmes, school events, conferences and general
live broadcasts.

This repo currently contains **Batch 1** of a 10-batch build: the
foundation, design system and public-facing UI only. There is no live video,
chat, scoreboard, broadcaster controls, or admin dashboard yet — see
[Roadmap](#roadmap) below.

## Tech stack

- HTML, CSS, vanilla JavaScript (ES modules) — no React/Vue/framework
- [Vite](https://vitejs.dev) as the dev server and build tool
- [Supabase](https://supabase.com) for auth/data (foundation only in this batch)
- [Netlify](https://netlify.com) for hosting

## Getting started

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in your own Supabase project values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Only the **anon/public** key goes in this file. Never put a service-role key
in frontend code — `.env` is already git-ignored so your real keys are never
committed.

Then run the dev server:

```bash
npm run dev
```

### Set up the database

In your Supabase project, open **SQL Editor → New query**, paste the
contents of `supabase/schema.sql`, and run it. This creates a `profiles`
table (row-level-security enabled) and a trigger that creates a profile row
automatically whenever someone signs up.

By default, Supabase requires users to confirm their email before they can
sign in. You can turn this off for local testing in **Authentication →
Providers → Email → Confirm email**, but leave it on for production.

Build for production:

```bash
npm run build
npm run preview   # preview the production build locally
```

## Deploying to Netlify

`netlify.toml` is already configured: build command `npm run build`, publish
directory `dist`. Connect the repo in Netlify, then add the two
`VITE_SUPABASE_*` environment variables in **Site settings → Environment
variables** (do not commit them).

## Project structure

```
mayorcity-live/
├── index.html                  Landing page
├── events.html                 Public events listing (live + upcoming)
├── event.html                  Public event detail page
├── signin.html                 Sign-in page
├── signup.html                 Create-account page
├── forgot-password.html        Password reset request page
├── reset-password.html         Password reset confirmation (from emailed link)
├── dashboard.html              Signed-in: create/manage your events
├── broadcast.html              Host-only: full broadcaster control centre
├── admin.html                  Admin-only: platform stats, events, users
├── netlify.toml                Netlify build config + security headers
├── vite.config.js              Multi-page build entries
├── .env.example                Template for local Supabase/LiveKit env vars
├── TESTING.md                  Manual QA checklist (no test framework in this stack)
├── netlify/
│   └── functions/
│       └── create-livekit-token.mts   Mints LiveKit tokens server-side (secrets live here only)
├── supabase/
│   └── schema.sql              Run in the Supabase SQL editor (tables, RLS, constraints)
├── public/
│   ├── favicon.svg
│   ├── 404.html                 Self-contained (no /src/styles dependency — see file comment)
│   ├── robots.txt
│   └── sitemap.xml
└── src/
    ├── main.js                 Landing page entry script
    ├── pages/
    │   ├── signin.js
    │   ├── signup.js
    │   ├── forgotPassword.js
    │   ├── resetPassword.js
    │   ├── dashboard.js
    │   ├── events.js
    │   ├── eventDetail.js
    │   ├── broadcastPage.js
    │   └── adminPage.js
    ├── components/              Reusable UI, shared across every page
    │   ├── navbar.js            Auth-aware: swaps sign-in/sign-out based on session
    │   ├── footer.js
    │   ├── toast.js
    │   ├── modal.js
    │   ├── uiKit.js             LiveBadge, EventCard, Loading/Empty/Error states
    │   └── chatPanel.js         Shared chat UI (viewer page + host control centre)
    ├── services/
    │   ├── authService.js      All Supabase Auth calls go through here
    │   ├── profileService.js   Profile reads + admin role management
    │   ├── eventsService.js    All `events` table reads/writes go through here
    │   ├── chatService.js      All `chat_messages` reads/writes/Realtime go through here
    │   └── broadcastService.js LiveKit connection (connectAsHost/connectAsViewer) (not wired into UI yet)
    ├── lib/
    │   └── supabaseClient.js    Single shared Supabase client
    ├── styles/
    │   ├── tokens.css           Design tokens — colors, type, spacing, radius, shadow
    │   ├── base.css             Reset + global element styles + accessibility defaults
    │   ├── components.css       Buttons, inputs, cards, badges, nav, modal, toast, states
    │   ├── landing.css          Landing-page-specific layout
    │   ├── auth.css             Auth-page-specific layout
    │   ├── dashboard.css        Dashboard shell + events management layout
    │   ├── events.css           Public events listing + detail layout
    │   ├── broadcast.css        Host camera preview + controls layout
    │   ├── chat.css             Shared chat panel layout
    │   └── admin.css            Admin dashboard layout
    └── utils/
        ├── dom.js               Small DOM + validation + button-loading helpers
        └── authGuard.js         requireAuth() — protects pages that need a session
```

Adding a new page (Batch 5+) means adding one `.html` file at the root, one
entry in `vite.config.js`, and a matching file in `src/pages/` — nothing in
the existing structure needs to change.

## Design system

All color, typography, spacing, radius and shadow values live in
`src/styles/tokens.css` as CSS custom properties. Nothing else in the
codebase should hardcode a hex value or a pixel spacing figure — add a token
there first, then use it everywhere else via `var(--token-name)`.

## What's in Batch 1

- Global design system (tokens, base styles, component styles)
- Fully responsive landing page: hero, how it works, use cases, why-us, live
  event preview (static mock), final CTA
- Responsive navbar with a mobile menu
- Sign in, create account, and forgot password pages (UI only in Batch 1)
- Reusable components: buttons, inputs, cards, badges, toasts, modal,
  loading/empty/error states
- Accessibility basics: semantic HTML, visible focus states, skip link,
  reduced-motion support
- SEO foundation: titles, meta descriptions, Open Graph tags, favicon

## What's in Batch 2

- Real Supabase authentication: sign up (with email confirmation), sign in,
  sign out, forgot password, and password reset via the emailed link
- `authService.js` — every Supabase Auth call goes through this one module
- `authGuard.js` — `requireAuth()` protects any page that needs a session
- Auth-aware navbar: shows Sign in/Start broadcasting when logged out, an
  account badge + Sign out when logged in
- `dashboard.html` — a minimal protected placeholder that proves the whole
  auth flow works end-to-end (real dashboard content is Batch 3+)
- `supabase/schema.sql` — a `profiles` table with row-level security and a
  trigger that creates a profile automatically on sign-up

**Not included yet, by design:** LiveKit / live video, real-time chat,
football scoreboard, broadcaster controls, analytics, admin dashboard,
event/broadcast management, and social sign-in (Google/Apple etc.).

## What's in Batch 3

- `supabase/schema.sql` extended with an `events` table (RLS: hosts manage
  their own events, anyone can view scheduled/live ones)
- `eventsService.js` — create/read/update/delete events, all Supabase calls
  in one place
- Dashboard now has a real "Create an event" form and a "Your events" list
  (cancel/delete wired up)
- `events.html` — public listing of live/upcoming events with filter tabs
- `event.html` — public detail page for a single event (`?id=`), with a
  placeholder video panel (real video is Batch 4/5)
- Navbar's Live/Events links now point at these real pages instead of
  landing-page anchors

**Not included yet, by design:** LiveKit / live video, real-time chat,
football scoreboard, broadcaster controls, analytics, admin dashboard, and
social sign-in (Google/Apple etc.).

### Known gap to fill before launch

`index.html` references `/og-image.png` for social-share previews. That
image file isn't included in this batch — add a 1200×630 PNG at
`public/og-image.png` before going live.

## What's in Batch 4

- LiveKit client (`livekit-client`) and server SDK (`livekit-server-sdk`)
- `netlify/functions/create-livekit-token.mts` — the only place
  `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` are ever read, from Netlify's
  server-side environment variables, never shipped to the browser
- `broadcastService.js` — `connectAsHost()` / `connectAsViewer()`
- `broadcast.html` — the host's camera preview and controls: start camera,
  mute mic, go live, end broadcast, copy the viewer link. Only the event's
  own host can open it
- `event.html` now plays real video once an event is live, and switches
  from the placeholder monitor to the live stream automatically (via a
  Supabase Realtime subscription) — no page refresh needed
- **Viewers do not need an account.** Watching is anonymous; only creating
  and hosting an event requires signing in
- `supabase/schema.sql` now enables Realtime on the `events` table

### To actually use LiveKit

1. Create a project at [livekit.io](https://livekit.io) (or self-host) to get
   a project URL, API key, and API secret.
2. In Netlify: **Site settings → Environment variables**, add
   `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` (server-side only — do not
   prefix with `VITE_`).
3. In your local `.env` **and** in Netlify's environment variables, set
   `VITE_LIVEKIT_URL` to your LiveKit project's `wss://` URL (this one is
   fine to expose — it's not a secret).

## What's in Batch 5

- Real live viewer count on both the viewer page and the host's broadcast
  page, updating as people join/leave
- A "Connecting…" state while the stream loads, and a "Reconnecting…" state
  if the connection drops and recovers, instead of a frozen or blank player
- Player controls: mute/unmute (video starts muted so autoplay works in
  every browser, with a clear "Tap to unmute" prompt) and fullscreen
- Broadcast-ended handling: if the host ends the stream while you're
  watching, the player cleans up and the toast tells you what happened,
  instead of leaving a stuck video frame

## What's in Batch 6

- `events` table gains an `overlay` JSON column holding whichever graphic is
  currently showing
- Host controls on `broadcast.html`: a **programme graphic** (heading +
  subheading lower-third, for classes/church/school/conference events) and,
  for events in the **football** category, a live **scoreboard** (editable
  team names, tap +/- to change the score)
- The overlay renders identically on the host's own preview and every
  viewer's player — same markup, same data, updated instantly through the
  Realtime subscription already in place since Batch 4/5
- Overlay updates no longer rebuild the whole viewer page — only the
  overlay layer refreshes, so the live video keeps playing uninterrupted
  while a host adjusts a score

**Not included yet, by design (Batches 4–6):** recording/playback of past
broadcasts, picture-quality controls, multi-camera/co-host support,
real-time chat, and the dedicated broadcaster control centre (this batch's
`broadcast.html` is intentionally minimal — Batch 7 replaces it with the
full control centre).

## What's in Batch 7

`broadcast.html` is now the real broadcaster control centre, not a single
narrow column:

- Two-panel layout: video preview + controls on one side, tabbed
  **Overlays** / **Settings** panels on the other (dashboard's
  professional/efficient personality, as distinct from the public site's
  cinematic one — see Public UI vs Dashboard UI in the original brief)
- A stats bar: live status, viewer count, broadcast duration (starts
  counting the moment you go live), and a connection-quality indicator
  (Excellent/Good/Poor, from LiveKit's own quality signal)
- A **Settings** tab to pick which camera and microphone to broadcast from,
  and switch either mid-broadcast without disconnecting
- Ending a broadcast now asks for confirmation in a modal first (using the
  `modal.js` component from Batch 1) instead of ending immediately on one
  click

**Not included yet, by design:** recording/playback of past broadcasts,
picture-quality controls, multi-camera/co-host support, and real-time chat
(Batch 8).

## What's in Batch 8

- `chat_messages` table (RLS + Realtime) — one row per message, `author_id`
  nullable since viewers still don't need an account to chat
- `chatService.js` — send/read/delete messages, plus a Realtime
  subscription so new messages (and host deletions) appear instantly
- `chatPanel.js` — one shared chat component mounted on both `event.html`
  (viewers) and inside `broadcast.html`'s control centre (a new **Chat**
  tab, third alongside Overlays and Settings)
- Signed-in users chat under their profile name automatically; anonymous
  viewers are asked for a display name once, remembered for that browser
  session (not stored permanently)
- The host can delete any message in their own event's chat (a small
  &times; next to each message, host view only) — the only moderation tool
  in this batch; anyone can otherwise post, so treat this as a starting
  point, not a finished moderation system

**Not included yet, by design:** message reactions/emoji, muting or
banning a specific viewer, profanity filtering, and the admin-level
moderation/analytics tooling that's Batch 9.

## What's in Batch 9

- `is_admin()` SQL helper + RLS policies giving the `admin` role (already
  scaffolded on `profiles` since Batch 2) visibility into every event,
  every user, and every chat message — not just their own
- `admin.html` — stats (total events, live now, total users, total chat
  messages), a table of every event platform-wide with a Cancel action, and
  a table of every user with a Make admin / Remove admin toggle
- `profileService.js` (new) and `requireAdmin()` in `authGuard.js` — the
  admin page redirects any signed-in non-admin straight back to their
  regular dashboard, not to sign-in (they ARE signed in, just not an admin)
- `events.peak_viewers` — the highest concurrent viewer count a broadcast
  reached, recorded automatically while the host is live, shown in the
  admin events table
- Admins get an "Admin" link on their regular dashboard; everyone else
  doesn't see it at all

### Making your first admin

Every new account defaults to the `broadcaster` role. To promote yourself
(or anyone) to admin, run this once in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where id =
  (select id from auth.users where email = 'you@example.com');
```

**Not included yet, by design:** granular audit logs, per-event analytics
charts over time, exporting data, and email/notification tooling — this
batch is the moderation and visibility foundation, not a full BI dashboard.

## What's in Batch 10

- **Security fix:** event titles/descriptions, overlay text (programme
  graphic, scoreboard team names), chat messages, and profile names were
  being inserted as raw HTML in several places — a host or any signed-up
  user could have typed `<script>` into those fields and had it execute in
  other people's browsers (stored XSS). Every one of those spots now goes
  through `escapeHtml()` (`src/utils/dom.js`), and toasts are now built
  with real DOM nodes instead of `innerHTML` entirely
- Server-side length limits on event title/description (`schema.sql`),
  backing up the existing client-side checks — the client-side ones alone
  can be bypassed by anyone calling the Supabase API directly
- `netlify.toml`: security response headers (X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, a camera/microphone-scoped
  Permissions-Policy, and a Content-Security-Policy), plus long-lived
  cache headers for Vite's content-hashed build assets
- A real `public/404.html` instead of redirecting unknown paths to the
  homepage with a 404 status
- `public/robots.txt` and `public/sitemap.xml` — SEO foundation from
  Batch 1, finished
- `TESTING.md` — a manual QA checklist covering every batch, since this
  stack intentionally has no test framework (per the original "no
  unnecessary dependencies" constraint); run through it before any real
  launch

### Before you actually launch

1. Run through **every item in `TESTING.md`**, on a real phone as well as
   desktop.
2. Add a real `public/og-image.png` (1200×630) — noted as a gap since
   Batch 1, still not filled in.
3. Update the domain placeholders in `public/sitemap.xml` and
   `public/robots.txt` to your real domain.
4. If you ever self-host LiveKit instead of using livekit.cloud, update
   the `connect-src` line in `netlify.toml`'s Content-Security-Policy to
   match your LiveKit domain, or video/chat connections will be silently
   blocked by the browser.
5. Turn Supabase's email confirmation back on if you disabled it for
   testing (Authentication → Providers → Email → Confirm email), and set
   up a real SMTP provider (Resend/Postmark/SendGrid) instead of
   Supabase's rate-limited default sender — see the Batch 2 section above.

## Roadmap

| Batch | Scope |
|---|---|
| 1 | Foundation, design system, public UI ✅ |
| 2 | Authentication and user system ✅ |
| 3 | Events and broadcast management ✅ |
| 4 | LiveKit live video/audio broadcasting ✅ |
| 5 | Premium viewer experience ✅ |
| 6 | Broadcast overlays, programme graphics, football scoreboard ✅ |
| 7 | Broadcaster control centre ✅ |
| 8 | Realtime chat and audience engagement ✅ |
| 9 | Admin dashboard and analytics ✅ |
| 10 | Security, optimization, testing, production deployment ✅ *(this repo)* |

All 10 batches are complete. From here, further work is refinement and
real-world feedback rather than new foundational pieces — see "Not
included yet, by design" notes throughout this README for the specific
gaps left at each layer (recording/playback, co-hosts, moderation tooling,
analytics charts, etc.) if you want to keep building.
