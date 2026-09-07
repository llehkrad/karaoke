# Karaoke Pitch Sync (Chrome extension)

Captures the Host Display browser tab's audio and pitch-shifts it in real
time to match whatever key was chosen for the currently playing song — no
virtual audio cable, no changing your PC's default playback device, no
separate desktop app running the whole party.

## How it works

- You click the extension's toolbar icon while the **Host Display** tab
  (`/host/<roomId>`) is open and focused, then click **Start Pitch Sync**.
- The extension captures that tab's audio (`chrome.tabCapture`), routes it
  through a real-time pitch-shift node
  ([SoundTouchJS](https://github.com/cutterbl/SoundTouchJS), running in an
  `AudioWorklet`), and plays the shifted audio back out — this is also what
  keeps the tab audible, since capturing a tab's audio silences its normal
  output until something re-connects it to the speakers.
- It opens its own Socket.IO connection straight to the karaoke server
  (the exact same `join_room` / `state_update` events the Host Display page
  itself uses) so it always knows the current song's chosen pitch the
  instant it changes — no polling.

## One-time setup

1. `npm install` (only needed if you're building fresh or bumping the
   pinned dependency versions — the built output in `lib/` is committed to
   git, so this step is skippable for normal use).

   > **Note:** if this folder lives inside a Google Drive–synced directory,
   > `npm install` can fail with `EPERM`/`EBADF` errors — Drive's sync
   > client fights npm's rapid file writes. If that happens, run
   > `npm install` in a plain local folder outside any synced directory,
   > then copy `node_modules` in, or just skip this step and use the
   > already-built `lib/` files.
2. `npm run build` (only needed after step 1 — regenerates `lib/`).
3. Open `chrome://extensions`, enable **Developer mode** (top right),
   click **Load unpacked**, and select this `extension/` folder.

## Using it

1. Start the karaoke web app (`server/` and `client/`, see the repo root
   `README.md`), create a room, and open the **Host Display** page.
2. Click the Karaoke Pitch Sync icon in Chrome's toolbar.
3. Enter the **Server URL** (e.g. `http://localhost:3001` for local dev,
   or wherever it's deployed — see `DEPLOYMENT.md`). The Room ID is
   filled in automatically from the tab's URL.
4. Click **Start Pitch Sync**. Chrome will briefly mute the tab, then
   audio resumes through the pitch-shift pipeline. The popup (and the
   toolbar badge) shows the current song title and key.
5. Click **Stop Pitch Sync** to release the tab and go back to normal
   playback.

## Troubleshooting

- **No sound after starting**: check `chrome://extensions` → this
  extension → "service worker" / "offscreen document" links for console
  errors. Most commonly this means the Server URL is wrong or the server
  isn't reachable from the browser (e.g. CORS — see below).
- **"Room not found" / connection errors**: confirm the Server URL and
  that the room is still open; the extension shows the exact server error
  message it receives.
- **Deploying to production**: if you tighten the server's
  `CORS_ORIGIN` env var away from `*` (recommended for a real deployment,
  see `server/.env.example`), you must also allow this extension's origin
  (`chrome-extension://<extension-id>`) in that CORS config, or its socket
  connection will be rejected. The extension ID is shown on
  `chrome://extensions` once loaded.

## Notes

- Requires Chrome 116+ (uses `chrome.runtime.getContexts` and
  `chrome.tabCapture.getMediaStreamId` cross-context support).
- [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) is licensed
  LGPL-2.1; it's consumed here as an unmodified vendored dependency
  (`lib/soundtouch-processor.js`, bundled into `lib/offscreen.bundle.js`),
  not statically linked into a compiled binary.
- The old Python/VB-Cable tool (`../pitch changer/`) is a separate,
  independent, still-fully-working tool — this extension doesn't replace
  or depend on it in any way; it's just no longer needed for this web app.
