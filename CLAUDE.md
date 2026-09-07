# CLAUDE.md — Karaoke Web App

Context for any Claude Code session working on this repo.

## What this is

A multi-device karaoke party app. One screen (TV/laptop) shows the QR code
and the currently playing video; guests scan it with their phones to search
YouTube, pick a karaoke version, set a pitch, and queue it up.

Full architecture and setup instructions are in `README.md` and
`DEPLOYMENT.md` at the repo root — read those first.

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

**Built, not yet live-tested end-to-end:**

Real audio pitch-shifting. YouTube's embed is a sandboxed cross-origin
iframe — a web page has no legitimate way to reach into and process its
audio, and downloading/re-serving YouTube's audio to work around that would
violate YouTube's Terms of Service. So instead:

- This app only stores/displays the chosen pitch per song
- It exposes `GET /api/rooms/:roomId/now-playing` (see `server/src/routes.js`)
  returning `{ playing, videoId, title, pitchSemitones }` for whatever's
  currently playing
- There's a **separate local Python tool** (a real-time system-audio pitch
  shifter for Windows — see the `pitch changer` project/folder, not part of
  this repo) that processes whatever sound the host PC outputs, using
  VB-Cable (virtual audio device) + `pylibrb` (Rubber Band Library bindings)
  for genuine real-time pitch shifting
- That tool now has a "Sync pitch from web app" section: enter the server
  URL + room ID, click Start Sync, and it polls
  `/api/rooms/:roomId/now-playing` every ~1.5s, calling its existing
  `PitchEngine.set_semitones()` whenever the polled value changes. This
  bridges the web app's stored pitch value to actual audio processing on
  the host machine.
- **Remaining work**: this hasn't been tested against a live server yet —
  needs an end-to-end run (start the web app server, create a room, start
  the pitch shifter, hit Start Sync, queue a song with a non-zero pitch,
  confirm the key actually shifts).

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
