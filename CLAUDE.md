# CLAUDE.md — Karaoke Web App

Context for any Claude Code session working on this repo.

## What this is

A multi-device karaoke party app. One screen (TV/laptop) shows the QR code
and the currently playing video; guests scan it with their phones to search
YouTube, pick a karaoke version, set a pitch, and queue it up.

Full architecture and setup instructions are in `README.md` and
`DEPLOYMENT.md` at the repo root — read those first.

## Design system

The client is skinned per `design/melodyhub/CLAUDE.md` (the actual rules
file — read it before touching any client UI) and `design/melodyhub/tokens.css`
(the CSS custom properties `client/src/styles.css` is built on: one accent
`--accent: #6B66DE`, radius ladder 8/12/16/999, hairline-not-shadow at
rest, DM Sans 400/500/700, no emoji). Host Display is deliberately kept on
the dark "stage" side of the system (it's a TV/kiosk screen); every other
page is light-canvas/white-card. See the "Re-skin the app with the
MelodyHub design system" commit for the full page-by-page mapping
rationale.

## Status as of this handoff

**Built and integration-tested** (via live socket connections, not just code
review):
- Room lifecycle: session rooms (random code, deleted on end) and permanent
  rooms (fixed slug, pause/resume, remembers song history + last-used pitch
  per song)
- YouTube search proxy (YouTube Data API v3)
- Queue engine: add/remove, Fisher-Yates shuffle, auto-advance on song end,
  auto-promotes a song to now-playing if the queue was empty
- Host-token authentication for host-only actions (pause/resume/skip/end)
- The "blank screen, no song queued" state when the queue empties
- Full React frontend: Landing (create room), Host Display (QR/video/idle
  states), Guest View (search, pitch-picker bottom sheet, queue list)
- Fullscreen button on the Host Display's video frame (uses the standard
  Fullscreen API on `.host-video-frame`) — **could not be verified in a
  live browser** (see below), but round-tripped fine via other tests.
- **Admin control panel** (`/admin`, `/admin/:roomId`) — a single shared
  `ADMIN_PASSWORD` (server/.env, required, no default) gates a dashboard
  listing every room and a per-room control page that live-adjusts the
  playing song's pitch, true in-place pause/resume, one-shot restart
  (seek to 0), skip, and the full up-next playlist with shuffle/remove
  (reuses `client/src/components/QueueList.jsx` and the existing
  `shuffle_queue`/`remove_from_queue` events as-is). `rooms.js`'s
  `verifyHost` now treats `ADMIN_PASSWORD` as a skeleton key valid for
  any room's `hostToken` checks, so admin actions reuse every existing
  host-gated socket event with no duplication, and a room's real
  `host_token` is never exposed to the admin UI — a "cast to TV" link is
  built client-side as `/host/:roomId?hostToken=<adminToken>` instead.
  Live pitch/pause/resume/restart are two brand-new socket events
  (`set_pitch`, `playback_control`); the latter is deliberately ephemeral
  (relayed, not persisted to the DB) since it's a live remote-control
  signal, not room state — a Host Display page reload loses the "paused"
  state, same category of caveat as other reconnect edge cases already
  in this app. **Fully integration-tested locally** (see below) —
  login, room listing, live pitch sync to both the Host Display and the
  playback pipeline, in-place pause verified by comparing frozen video
  frames over time, resume verified to continue from the same position
  (not restart), restart verified to seek to 0, skip/shuffle/remove all
  confirmed against a real multi-tab session.

**Built, not yet live-tested end-to-end:**

Real audio pitch-shifting, via **`extension/`** — a Chrome extension, not
part of `client`/`server`. YouTube's embed is a sandboxed cross-origin
iframe — a web page's own script has no legitimate way to reach into and
process its audio, and downloading/re-serving YouTube's audio to work
around that would violate YouTube's Terms of Service. But all of that
audio does play through exactly one browser tab (the Host Display), so:

- `extension/` uses `chrome.tabCapture` to capture just that tab's audio,
  runs it through a real-time pitch-shift `AudioWorklet`
  ([SoundTouchJS](https://github.com/cutterbl/SoundTouchJS),
  `@soundtouchjs/audio-worklet`, LGPL-2.1), and plays the shifted audio
  back out (this is also what keeps the tab audible — tabCapture mutes a
  tab's native output once captured).
- It opens its **own Socket.IO connection** directly to this server —
  the same `join_room`/`state_update` contract `client/src/pages/HostView.jsx`
  itself uses — so it learns the current song's `pitch_semitones` the
  instant it changes, no REST polling, and **no changes to `client/` or
  `server/` were needed** for this to work.
- Build/setup/usage: see `extension/README.md`.
- **Remaining work**: built and syntax-checked (`node build.js` runs
  clean, esbuild bundle verified), but not yet loaded into real Chrome —
  needs an end-to-end pass on a machine with an actual display: load
  unpacked, start the web app, create a room, queue a song with a
  non-zero pitch, open Host Display, Start Pitch Sync, confirm the key
  actually shifts audibly.
- **Production note**: if `CORS_ORIGIN` (see `server/.env.example`) is
  ever tightened away from `*`, the extension's origin
  (`chrome-extension://<id>`) must be added too, or its socket connection
  will be rejected by CORS.

The `/api/rooms/:roomId/now-playing` REST endpoint (`server/src/routes.js`)
and the **separate, independent local Python tool** (`pitch changer/`
folder, outside this repo — VB-Cable + `pylibrb`, system-wide audio
pitch-shifting for Windows) both still exist and both still work — the
Python tool even has its own "Sync pitch from web app" polling feature
that uses that same endpoint. Neither is used by or required for this app
anymore now that `extension/` exists; they're just untouched, standalone,
and still functional if ever needed.

**Fullscreen caveat**: the sandboxed browser used to test this session
rejects `requestFullscreen()` with `TypeError: Permissions check failed`
— confirmed to be that sandbox's iframe embedding lacking a `fullscreen`
Permissions-Policy allowance (`document.fullscreenEnabled` is `true`,
the call/ref/logic are all correct), not a bug in the code. Needs a
real top-level Chrome tab to actually verify the button works.

## Known simplifications (v1, worth revisiting)

- Host auth is a token in the URL query string, not a real login/session
  system — fine for private use, not hardened for a public-facing product
- No rate limiting on search or queue mutation actions
- YouTube Data API free tier is quota-limited (~100 searches/day) — fine for
  personal use, would need a paid tier or caching if this ever gets busier
- The "jump to an existing permanent room" box on the landing page doesn't
  restore host privileges without the saved `hostToken` — only useful for
  guests, not for a host who lost their bookmarked host link

## Suggested repo structure decision

This project (`server/` + `client/`) is one deployable unit and reasonably
stands alone as its own git repo. The Python pitch-shifter tool is a
separate, independent local Windows tool with its own lifecycle — likely
cleaner as its own repo rather than merged into this one, though that's a
judgment call if you want to consolidate later.
