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
