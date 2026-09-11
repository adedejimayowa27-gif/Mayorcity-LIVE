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
├── signin.html                 Sign-in page
├── signup.html                 Create-account page
├── forgot-password.html        Password reset request page
├── reset-password.html         Password reset confirmation (from emailed link)
├── dashboard.html              Protected placeholder — proves auth end-to-end
├── netlify.toml                Netlify build config
├── vite.config.js              Multi-page build entries
├── .env.example                Template for local Supabase env vars
├── supabase/
│   └── schema.sql              Run once in the Supabase SQL editor (profiles table + RLS)
├── public/
│   └── favicon.svg
└── src/
    ├── main.js                 Landing page entry script
    ├── pages/
    │   ├── signin.js
    │   ├── signup.js
    │   ├── forgotPassword.js
    │   ├── resetPassword.js
    │   └── dashboard.js
    ├── components/              Reusable UI, shared across every page
    │   ├── navbar.js            Auth-aware: swaps sign-in/sign-out based on session
    │   ├── footer.js
    │   ├── toast.js
    │   ├── modal.js
    │   └── uiKit.js             LiveBadge, EventCard, Loading/Empty/Error states
    ├── services/
    │   └── authService.js      All Supabase Auth calls go through here
    ├── lib/
    │   └── supabaseClient.js    Single shared Supabase client
    ├── styles/
    │   ├── tokens.css           Design tokens — colors, type, spacing, radius, shadow
    │   ├── base.css             Reset + global element styles + accessibility defaults
    │   ├── components.css       Buttons, inputs, cards, badges, nav, modal, toast, states
    │   ├── landing.css          Landing-page-specific layout
    │   └── auth.css             Auth-page-specific layout
    └── utils/
        ├── dom.js               Small DOM + validation + button-loading helpers
        └── authGuard.js         requireAuth() — protects pages that need a session
```

Adding a new page (Batch 3+) means adding one `.html` file at the root, one
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

### Known gap to fill before launch

`index.html` references `/og-image.png` for social-share previews. That
image file isn't included in this batch — add a 1200×630 PNG at
`public/og-image.png` before going live.

## Roadmap

| Batch | Scope |
|---|---|
| 1 | Foundation, design system, public UI ✅ |
| 2 | Authentication and user system ✅ *(this repo)* |
| 3 | Events and broadcast management |
| 4 | LiveKit live video/audio broadcasting |
| 5 | Premium viewer experience |
| 6 | Broadcast overlays, programme graphics, football scoreboard |
| 7 | Broadcaster control centre |
| 8 | Realtime chat and audience engagement |
| 9 | Admin dashboard and analytics |
| 10 | Security, optimization, testing, production deployment |
