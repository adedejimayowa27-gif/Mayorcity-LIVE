# Testing checklist

This is a vanilla HTML/CSS/JS project with no test framework in the build
(per the original project constraints — no extra dependencies unless
genuinely necessary). This checklist replaces automated tests: run through
it manually before every real launch or major change, on both desktop and
a real phone.

Check off what passes; anything that fails is a bug to fix before launch.

## Auth (Batch 2)

- [ ] Sign up with a new email → confirmation email arrives → clicking it
      lands on `/signin.html` on your real domain (not localhost)
- [ ] Sign in with correct credentials succeeds
- [ ] Sign in with wrong password shows a clear error, not a crash
- [ ] Forgot password → email arrives → reset link works → new password
      lets you sign in
- [ ] Signing out clears the session (navbar shows "Sign in" again)
- [ ] Visiting `/dashboard.html` while signed out redirects to `/signin.html`

## Events (Batch 3)

- [ ] Create an event from the dashboard with each category
- [ ] Event appears in "Your events" immediately
- [ ] Event appears on the public `/events.html` listing (while status is
      `scheduled`)
- [ ] Filtering by "Live now" / "Upcoming" on `/events.html` works
- [ ] Cancelling an event removes it from the public listing
- [ ] Deleting an event removes it everywhere

## Live broadcasting (Batch 4–7)

- [ ] "Go live" on an event requests camera/mic permission and shows a
      local preview
- [ ] Clicking "Go live" flips the event to live — check `/event.html` in
      a **separate, signed-out** browser/incognito window and confirm
      video appears within a few seconds, with no manual refresh
- [ ] Viewer count on both the host and viewer pages updates as you open/
      close more viewer tabs
- [ ] Switching camera/microphone in the Settings tab actually switches
      the feed without disconnecting
- [ ] "End broadcast" asks for confirmation, then disconnects viewers and
      shows "This broadcast has ended" on their end
- [ ] Programme graphic and (for football events) the scoreboard show up
      on the viewer's screen within a second of the host changing them
- [ ] Chat: messages sent by a signed-out viewer and by the signed-in host
      both appear on both sides in real time
- [ ] Host can delete a chat message and it disappears for viewers too

## Cross-device / responsive

- [ ] Landing page, events listing, and event detail all work with no
      horizontal scrolling on a real phone (not just a resized desktop
      browser window)
- [ ] Mobile nav menu opens/closes correctly
- [ ] Broadcasting from an actual phone (not just desktop webcam) works —
      camera permission prompts, orientation, etc.

## Admin (Batch 9)

- [ ] A non-admin visiting `/admin.html` gets redirected to `/dashboard.html`,
      not shown an error or blank page
- [ ] Admin stats (total events, live now, total users, messages) match
      what you'd expect from your test data
- [ ] Admin can cancel someone else's event
- [ ] Admin can promote another user to admin, and that user then sees the
      Admin link on their own dashboard after refreshing

## Security (Batch 10)

- [ ] Try entering `<script>alert(1)</script>` as an event title,
      description, chat message, and scoreboard team name — confirm it
      displays as literal text everywhere (landing, dashboard, viewer
      page, admin tables), never executes
- [ ] Confirm `.env` is NOT committed to your Git repository
- [ ] Confirm `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` only exist in
      Netlify's environment variables, never in any file in the repo
- [ ] Open browser DevTools → Network tab while using the site — confirm
      no API keys or secrets appear in any request/response body other
      than the Supabase publishable key and LiveKit URL (both expected)

## General

- [ ] No errors in the browser console on any page, signed in or out
- [ ] No broken links (check every nav link, footer link, and button)
- [ ] Every page has a sensible `<title>` (check the browser tab)
