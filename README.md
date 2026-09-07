# Karaoke App

A multi-device karaoke party app. One screen (TV/laptop) shows the video and
a join QR code; guests scan it with their phones to search YouTube, pick a
karaoke version, set a pitch, and queue it up.

## How it works

```
┌─────────────┐        WebSocket (real-time state)        ┌──────────────┐
│ Host Display │ ◄─────────────────────────────────────────┤   Server     │
│ (TV/laptop)  │                                            │ (Node +      │
└──────┬───────┘        REST (song search, history)         │  Socket.IO + │
       │            ┌──────────────────────────────────────►│  SQLite)     │
       │ QR code    │                                       └──────┬───────┘
       ▼            │                                              │
┌─────────────┐     │                                              │ YouTube
│ Guest phones │ ────┘                                              │ Data API
│ (search/queue│                                                    ▼
│  /pitch)     │                                          (search results)
└─────────────┘
```

- **`server/`** — Node.js backend. Holds room/queue state in SQLite, serves
  YouTube search results (proxied through the YouTube Data API), and
  broadcasts live queue/now-playing updates to every connected client via
  Socket.IO.
- **`client/`** — React frontend (Vite). Views from the same codebase:
  - `/host/:roomId` — the display screen (QR code when idle, YouTube embed
    when a song is playing, auto-advances when it ends, fullscreen button)
  - `/join/:roomId` — the guest's phone view (search, pitch picker, queue)
  - `/admin`, `/admin/:roomId` — password-gated control panel: see all
    rooms, then live-adjust a room's pitch, pause/resume/restart/skip the
    current song, and manage the full playlist (shuffle/remove)

## Room types

- **Session room**: random code, exists only while the host keeps it open.
  Ending it deletes everything.
- **Permanent room**: a fixed slug/link that never changes. "Pausing" it
  keeps the room and song history intact in the database; resuming brings
  back the same link and remembers the last pitch used for each song.

## Pitch-shifting: the `extension/` Chrome extension

YouTube's embedded player is a sandboxed cross-origin iframe — there's no
legitimate way for a web page's own script to reach into its audio and
process it, and downloading/re-serving YouTube's audio to work around that
would violate YouTube's Terms of Service.

Since all of that audio ultimately plays through one browser tab (the Host
Display), **`extension/`** is a Chrome extension that captures just that
tab's audio (`chrome.tabCapture`) and pitch-shifts it in real time
in-browser — no virtual audio cable, no changing the PC's default playback
device. It opens its own Socket.IO connection to this same server to learn
the current song's chosen pitch the instant it changes. See
`extension/README.md` for setup and usage.

(There's also a separate, independent local Python tool — see the `pitch
changer` project, a sibling folder outside this repo — that pitch-shifts a
PC's *entire* system audio via a virtual audio cable. It predates the
extension and isn't used by or required for this app; it's kept around as
its own standalone tool.)

## Running locally

**Prerequisites**: Node.js 18+, a YouTube Data API v3 key (free from
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) —
enable "YouTube Data API v3" on the project first).

```bash
# 1. Backend
cd server
cp .env.example .env
# edit .env: paste in your YOUTUBE_API_KEY, and set ADMIN_PASSWORD to
# anything if you want the /admin control panel (leave blank to disable it)
npm install
npm start          # runs on http://localhost:3001

# 2. Frontend (separate terminal)
cd client
npm install
npm run dev         # runs on http://localhost:5173
```

Open `http://localhost:5173` to create a room. The host screen and guest
screen are both just pages in the same app — open the host link on one
device/tab, and the guest link (or QR code) on your phone.

## Known simplifications (v1)

- Host authentication is a simple token in the URL (`?hostToken=...`), not a
  real login system. Fine for a home/private setting; worth hardening if
  this is ever exposed somewhere less trusted.
- No rate limiting on search or queue actions yet.
- The "existing permanent room" box on the landing page lets you navigate to
  a host URL by room ID, but without the saved `hostToken` you won't have
  host controls (pause/skip) — bookmark your actual host link (with the
  token) instead of relying on that box for your own rooms.
- YouTube Data API's free quota is limited (~100 searches/day) — fine for
  personal use, worth knowing if this ever gets busier.

See `DEPLOYMENT.md` for how to put this on the public internet via AWS
Lightsail.
