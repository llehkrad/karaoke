# CLAUDE.md — Sing! by everythingLah

Context for any Claude Code session working on this repo.

## What this is

**Sing! by everythingLah** — a multi-device karaoke party app, branded
under the `everythinglah.com` umbrella (intended home:
`sing.everythinglah.com`). One screen (TV/laptop) shows the QR code and the
currently playing video; guests scan it with their phones to search
YouTube, pick a karaoke version, set a pitch, and queue it up.

The app was built and developed under the working name "Karaoke" — you may
still see `karaoke` in internal identifiers (npm package names were
`karaoke-client`/`karaoke-server`, now `sing-client`/`sing-server`; the git
repo, local folder names, and some storage-key/event-name internals still
say `karaoke` — these are cosmetic/internal and safe to leave unless asked
to change them). User-facing text (page titles, headings, brand lockup)
says "Sing!".

Full architecture and setup instructions are in `README.md` and
`DEPLOYMENT.md` at the repo root — read those first.

## ⚠️ Working tree is uncommitted

As of this handoff, **everything described below beyond commit `c477021`
is sitting uncommitted in the working tree** (`git status` shows ~37
changed/new files, +1300/-350 lines vs. the last commit). Nothing since
"Detect the Chrome extension on Host Display and prompt if missing" has
been committed. Before deploying or doing anything git-destructive,
review and commit this work — don't assume it's already on a branch
anywhere.

## Design system

The client is skinned per `design/melodyhub/CLAUDE.md` (the actual rules
file — read it before touching any client UI) and `design/melodyhub/tokens.css`
(the CSS custom properties `client/src/styles.css` is built on: one accent
`--accent: #6B66DE`, radius ladder 8/12/16/999, hairline-not-shadow at
rest, DM Sans 400/500/700). Host Display is deliberately kept on the dark
"stage" side of the system (it's a TV/kiosk screen); every other page is
light-canvas/white-card. **960px is the standard content width** across
every page (`.main-content`, `.guest-page`, the Landing lobby card) — if
you see something narrower or wider, it's very likely a bug, not intent
(see the CSS-cascade bugs noted below for why this kept happening).

## Roles & auth

Two account roles now: **admin** and **power** (was `admin`/`user`).
Login is username+password via `POST /api/admin/rooms/login`, returning
`{username, role}`; the client stores both in `sessionStorage` and sends
`X-Username` on subsequent REST calls (`requireAuth`/`requireAdmin`
middleware in `server/src/routes.js`). Socket actions use a `hostToken`
that's either the room's own per-room token, or a valid username — server
treats `role==='admin'` as a skeleton key valid for *any* room.

**Power users** are the "manage specific rooms" role, added this session:
- Only admin can create accounts (`/manage-users`, admin-only page) — no
  self-service sign-up. Admin can also edit a user's password/role and
  delete accounts there, with guards against self-deletion and
  deleting/demoting the *last* remaining admin (`PUT`/`DELETE
  /api/users/:username` in `routes.js`).
- A new `room_members` table (`server/src/db.js`) ties a power user to a
  specific *permanent* room. `listRoomsForUser` (`rooms.js`) — admins see
  every room; power users see every session room plus only the permanent
  rooms they're tied to. `verifyHost` checks membership for power users on
  every host-gated socket action.
- A power user who creates a permanent room is auto-tied to it as a
  member (otherwise they'd immediately lose visibility of their own room).
- Admin manages a room's power-user membership from Manage Room's "Power
  Users" section (admin-only, permanent rooms only) — add from a dropdown
  of existing power accounts, remove with a button.
- Session rooms have no membership concept — always visible to everyone
  logged in, matching their "no account needed" design.

## Page map (current)

- `/` — **Sing! Lobby** (Landing). Quick Party (session room, no login) +
  Persistent Room (admin/power, login required). Creating either now
  redirects to Manage Room, not Host Display.
- `/sing-host` — **Sing! Host** dashboard, lists rooms per `listRoomsForUser`.
- `/sing-host/:roomId` — **Manage Room**. Full playback/queue control.
  Reachable either by a logged-in admin/power user *or* an anonymous Quick
  Party host carrying the room's own `?hostToken=` — `SingHostRoom.jsx`
  branches on which. This used to be admin-only; it isn't anymore.
- `/sing-host/:roomId/join` — **Join Room**, new this session. Just the
  QR code + join link + copy button, split out of Manage Room (which now
  has a 3-button row: Open Host Display / Open Guest Page / Show Join QR).
- `/join/:roomId` — **Sing! Guest**. Search + Queue tabs (tab bar now sits
  right under the title, not docked to the bottom — see UI fixes below).
- `/host/:roomId?hostToken=` — **Host Display** (dark stage). Video +
  QR/idle state. **Only one can be "live" per room at a time** — see below.
- `/manage-users` — **Manage Users**, admin-only, new this session.

## Room lifecycle & deletion

Session rooms and permanent rooms both now get a **true hard delete**
(`deleteRoom`/`endSessionRoom` in `rooms.js`, both funnel through one
`deleteRoomTx` transaction). This was a real bug fixed this session:
permanent-room "delete" used to just flip `status='ended'` and leave the
row in place forever, permanently blocking that slug from ever being
reused. Deletion also explicitly cleans up `queue_items`, `song_history`,
and `room_members` for that room — **note that this codebase never runs
`PRAGMA foreign_keys = ON`**, so the `ON DELETE CASCADE` in the schema is
decorative; anything that deletes a room must clean up dependents by hand
or they orphan silently. Keep this in mind if you add another table that
references `rooms(id)`.

## Single active Host Display per room

Opening a second `/host/:roomId` tab now bumps the first one to a
"replaced" screen instead of both silently existing. Server-side:
`activeHostDisplays` (in-memory `Map<roomId, socketId>` in
`socketHandlers.js`), claimed via `claim_host_display`, which emits
`host_display_replaced` to whoever held it before. Cleared on disconnect.
This is per-server-process by design — a server restart just lets
whichever Host Display reconnects first reclaim the room.

## Song queue: list + reordering

The queue used to render as a responsive card grid (`.queue-list-items`
was sharing a `display: grid` rule with `.search-results`) — now it's
always a plain vertical list; the grid rule was split so only search
results keep the grid.

Two different reordering models, on purpose:
- **Manage Room** (admin/power): free-flow drag-and-drop, any item to any
  position. Uses a small hand-rolled hook, `client/src/useSortableList.js`
  — **not a library**. `@dnd-kit` was tried first but npm kept corrupting
  package files mid-install in this Google-Drive-synced folder (empty
  `package.json` after install, `TAR_ENTRY_ERROR` warnings) — if you want
  to add any npm dependency here, expect flaky installs and verify the
  installed files aren't truncated/corrupted before trusting them.
  `useSortableList` is Pointer-Events-based (touch-and-mouse both work,
  unlike native HTML5 drag-and-drop) with **window-level** move/up
  listeners — not listeners on the tiny drag-handle element itself, which
  was the original design and had a real bug: if the pointer slips off
  that small target mid-drag (easy on a touchscreen), pointerup never
  fires on it and the drag gets stuck "in progress" forever, silently
  freezing that list against any further server updates. Window-level
  listeners guarantee the drag always terminates.
- **Guest page**: NOT drag-and-drop (explicitly requested — a guest's
  free-flow dragging was built once and then reverted). Guests get ↑/↓
  arrows that only swap an owned song directly with their *own* adjacent
  song — i.e. if a guest has songs at queue positions 1 and 5, those two
  positions can trade places with each other, but nothing can land at 3
  or 4, and everyone else's relative order never changes. See
  `handleSwapOwnSong` in `GuestView.jsx`.

Server-side, `shuffle_queue` now requires a valid host token (previously
open to anyone). `reorder_queue` validates the token *if one is provided*
(the Manage Room path always sends one) but stays unauthenticated for the
guest path — consistent with this app's existing trust model, where
cut/remove/set-pitch on your own queued song were never server-verified
as actually "yours" either.

**Real bug fixed in `GuestView.jsx`**: it read `item.addedBy` (camelCase)
everywhere, but the server has always sent `added_by` (snake_case,
matching the SQLite column — see `queue.js`'s `getFullState`, which
returns raw rows with no camelCasing). This meant "is this my own song"
detection **never worked** — own-song highlighting, the pitch/delete
buttons, and the reorder arrows were all silently dead on every page load
before this session. Fixed throughout; double-check any *new* code that
touches queue items uses `added_by`, not `addedBy` (the one correct
`addedBy` reference left is the outgoing `add_to_queue` socket payload,
which the server destructures under that name).

Also added: a "Now Playing" row on the Guest queue tab. It didn't exist
before — the currently-playing item is deliberately excluded from
`state.queue` (see `getFullState`), so the Guest page had literally no
way to reach the already-wired `cut_song` feature. Fixed by rendering
`state.nowPlaying` separately, same pattern `QueueList.jsx` already used
on Manage Room.

## YouTube search filtering

`server/src/youtube.js` now passes `videoEmbeddable=true` to the Search
API — videos the uploader disabled embedding for never show up in search
results at all, instead of a guest finding out only when their turn comes
up (sometimes much later) that the song silently won't play. Zero extra
cost — same API call, no added quota/latency, an officially-supported
YouTube Search API filter param.

## Host Display playback reliability

Two related browser-security constraints surfaced this session, both
**not fixable from page code** — the fixes are about surfacing the
failure clearly instead of it happening silently:

1. **Autoplay policy**: a `play()` call that isn't triggered by a real
   click on *that exact page* gets silently blocked by the browser — this
   is exactly what a remote resume/restart from Manage Room, or
   autoplaying a new song, is. `HostView.jsx` now has a watchdog
   (`scheduleInteractionCheck`) that checks ~1.5s after any such attempt
   whether the player actually reached PLAYING/BUFFERING; if not, it (a)
   shows a "▶ Tap to play" overlay directly on Host Display — the only
   place a real click can unblock it — and (b) reports the status via a
   new `host_playback_status` socket event, relayed room-wide by the
   server, so Manage Room shows a warning banner instead of its own
   pause/resume/restart buttons silently doing nothing. *Do not* add
   persistent Pause/Restart buttons on Host Display itself — this was
   tried and explicitly reverted; the user wants Host Display kept to
   just the Fullscreen button, full stop.

2. **Fullscreen + tab capture**: confirmed live with the user — Chrome
   refuses `requestFullscreen()` while the pitch-sync extension's
   `chrome.tabCapture` is actively capturing that tab (Chrome won't let a
   captured tab hide the "this tab is being captured" indicator behind
   fullscreen). `toggleFullscreen()` now catches the rejected promise
   (previously unhandled → totally silent failure) and shows a message
   explaining the two real workarounds: stop Pitch Sync first, or run
   Chrome in OS-level kiosk mode (`chrome.exe --kiosk <host-url>`) instead
   of the in-page Fullscreen button, which sidesteps the whole conflict
   since it doesn't go through the Fullscreen API at all.

   Separately, also fixed a real CSS bug in `.host-video-frame:fullscreen`
   — it removed `max-width`/`aspect-ratio` without setting an explicit
   `width`/`height`, so the video frame's height collapsed to fit content
   instead of the screen even when fullscreen genuinely engaged (now sets
   `100vw`/`100vh`). And split `:fullscreen`/`:-webkit-full-screen` into
   **two separate rules** instead of one comma-separated selector — a
   browser that doesn't recognize one prefixed pseudo-class (Firefox
   doesn't know `:-webkit-full-screen`) drops the *entire* rule for a
   combined selector list, which was silently breaking fullscreen even in
   browsers that do support the standard `:fullscreen`.

## Chrome extension — packaging for the Web Store

`extension/` is built and load-unpacked-tested but **still not verified
end-to-end with real audio** (same caveat as before — needs a real
display). This session's work was entirely about *distributing* it as an
unlisted Chrome Web Store item, not the pitch-shifting logic itself:

- `manifest.json`'s `description` was 169 chars; Chrome Web Store caps it
  at 132 — trimmed.
- The upload zip must have `manifest.json` at its **root**, not nested in
  an `extension/` folder — build one with only the runtime files (`lib/`,
  `background.js`, `content-detect.js`, `offscreen.html`, `popup.html`,
  `popup.js`, `manifest.json`, `icons/`), not `src/`/`package.json`/
  `build.js`/`README.md`. PowerShell's `Compress-Archive` writes
  backslash path separators that some zip parsers reject — use .NET's
  `[System.IO.Compression.ZipFile]` API instead for forward slashes.
- Added `extension/icons/` (16/32/48/128px, simple purple mic glyph) —
  manifest previously had no `icons` key at all. One real gotcha:
  generating these via a browser's `canvas.toDataURL()` + passing the
  base64 string back through a long tool-response round-trip **silently
  corrupted the largest (128px) image** — same byte-length, garbled
  content, decompression failure. Worked around by extracting raw pixel
  data instead and building the PNG bytes directly; if you ever need to
  generate another image this way, avoid round-tripping a large base64
  string through a text channel — pull raw data and encode locally.
- Chrome Web Store's publish-readiness checklist also wants: a store
  screenshot (1280×800, JPEG or 24-bit PNG *no alpha* — built one as a
  mockup of the actual popup UI, not a live capture), permission
  justifications for each requested permission (drafted for
  activeTab/host permission/offscreen/storage/tabCapture — see chat
  history if you need the exact wording again), a "single purpose"
  description, and a "remote code" declaration — answer **No** to that
  one: everything (SoundTouchJS worklet, Socket.IO client) is bundled at
  build time via esbuild and shipped in the package, nothing is fetched
  from a remote origin at runtime.

## Known simplifications (worth revisiting)

- Host auth for anonymous Quick Party rooms is a token in the URL query
  string, not a real session system — fine for private use.
- No rate limiting on search or queue mutation actions.
- YouTube Data API free tier is quota-limited (~100 searches/day).
- Guest-facing queue actions (`remove_from_queue`, `set_item_pitch`,
  `cut_song`, the guest half of `reorder_queue`) are unauthenticated by
  design — the client only shows the buttons for a guest's own songs, but
  a raw socket call could act on anyone's. This predates this session and
  wasn't in scope to fix, but worth knowing before extending it further.
- `activeHostDisplays` (single-Host-Display tracking) is in-memory only —
  doesn't survive a server restart, and won't work across multiple server
  processes if this is ever horizontally scaled.
- SQLite dev DB at `server/data/karaoke.db` is gitignored and disposable
  — got reset mid-session when the `users.role` CHECK constraint changed
  (SQLite doesn't retroactively alter an existing table's constraints).
  A fresh AWS deploy starts with an empty DB regardless; this only matters
  for local dev continuity.

## Next steps

1. **Set up AWS Lightsail and deploy** — full walkthrough in
   `DEPLOYMENT.md`. Remember: nothing past commit `c477021` is committed
   yet (see the warning at the top of this file) — commit first, review
   `server/.env` isn't what gets pushed (secrets), and note `CORS_ORIGIN`
   needs the extension's `chrome-extension://<id>` origin added if it's
   ever tightened away from `*`.
2. Finish the Chrome Web Store unlisted listing (screenshot, permission
   justifications, and contact email verification are the pieces that
   still need a human — see the packaging section above) and submit for
   review.
3. Live-test `extension/` end-to-end with real audio on a real display —
   still hasn't happened.
4. Keep `pitch changer/` (the separate Python/VB-Cable tool, outside this
   repo) as-is — untouched, working, independent of everything above.
