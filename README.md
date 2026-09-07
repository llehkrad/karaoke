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
- **`client/`** — React frontend (Vite). Two views from the same codebase:
  - `/host/:roomId` — the display screen (QR code when idle, YouTube embed
    when a song is playing, auto-advances when it ends)
  - `/join/:roomId` — the guest's phone view (search, pitch picker, queue)

## Room types

- **Session room**: random code, exists only while the host keeps it open.
  Ending it deletes everything.
- **Permanent room**: a fixed slug/link that never changes. "Pausing" it
  keeps the room and song history intact in the database; resuming brings
  back the same link and remembers the last pitch used for each song.

## Important: pitch-shifting is NOT done in this app

YouTube's embedded player is a sandboxed cross-origin iframe — there's no
legitimate way for a web page to reach into its audio and process it, and
downloading/re-serving YouTube's audio to work around that would violate
YouTube's Terms of Service.

So this app only **stores and displays** the chosen pitch per song (via the
`/api/rooms/:roomId/now-playing` endpoint). The actual real-time pitch
shifting happens on the **host PC's system audio**, via the separate local
pitch-shifter tool (see the `pitch changer` project) — it's designed to poll
that endpoint and apply the pitch automatically. Wiring that polling loop
into the existing pitch-shifter app is the next step, not yet done as of
this build.

## Running locally

**Prerequisites**: Node.js 18+, a YouTube Data API v3 key (free from
[Google Cloud Console](https://console.cloud.google.com/apis/credentials) —
enable "YouTube Data API v3" on the project first).

```bash
# 1. Backend
cd server
cp .env.example .env
# edit .env and paste in your YOUTUBE_API_KEY
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
