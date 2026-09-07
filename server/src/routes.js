import { Router } from "express";
import { createRoom, getRoom, listRooms } from "./rooms.js";
import { getFullState, getRecentHistory, getSongHistoryEntry } from "./queue.js";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export const router = Router();

function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.adminToken;
  if (!ADMIN_PASSWORD || token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  next();
}

// Create a new room (session or permanent).
router.post("/rooms", (req, res) => {
  try {
    const { type, slug } = req.body || {};
    const room = createRoom({ type, slug });
    res.json({
      roomId: room.id,
      type: room.type,
      hostToken: room.host_token,
      joinPath: `/join/${room.id}`,
      hostPath: `/host/${room.id}?hostToken=${room.host_token}`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Public room info (used by the guest join page before it opens a socket).
router.get("/rooms/:roomId", (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found." });
  res.json({ id: room.id, type: room.type, status: room.status });
});

// Recent song history for a room (used to pre-fill "last used pitch" in the UI).
router.get("/rooms/:roomId/history", (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found." });
  res.json(getRecentHistory(room.id));
});

router.get("/rooms/:roomId/history/:videoId", (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found." });
  const entry = getSongHistoryEntry(room.id, req.params.videoId);
  res.json(entry || null);
});

/**
 * ADMIN
 * -----
 * A single shared password (ADMIN_PASSWORD env var) gates a control
 * surface that can see and steer every room. The login endpoint just
 * checks the password -- the client remembers it (sessionStorage) and
 * sends it back as X-Admin-Token on later requests, and as the hostToken
 * field on admin-initiated socket emits (rooms.js's verifyHost treats it
 * as a skeleton key valid for any room).
 */
router.post("/admin/rooms/login", (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ ok: false, error: "Admin access is not configured on this server." });
  }
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Incorrect password." });
  }
  res.json({ ok: true });
});

router.get("/admin/rooms", requireAdmin, (req, res) => {
  const rooms = listRooms().map((room) => {
    const state = getFullState(room.id);
    return {
      id: room.id,
      type: room.type,
      status: room.status,
      nowPlayingTitle: state?.nowPlaying?.title ?? null,
      queueLength: state?.queue?.length ?? 0,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    };
  });
  res.json(rooms);
});

/**
 * PITCH-SHIFTER BRIDGE
 * --------------------
 * The local pitch-shifter app running on the host PC polls this endpoint
 * (e.g. every 1-2 seconds) to learn what semitone value to apply right
 * now. This is intentionally a tiny, read-only, unauthenticated-by-design
 * endpoint (it only reveals a pitch number, nothing sensitive) so the
 * local tool can be a simple polling client with no socket/auth code.
 */
router.get("/rooms/:roomId/now-playing", (req, res) => {
  const state = getFullState(req.params.roomId);
  if (!state) return res.status(404).json({ error: "Room not found." });

  if (!state.nowPlaying) {
    return res.json({ playing: false });
  }

  res.json({
    playing: true,
    videoId: state.nowPlaying.video_id,
    title: state.nowPlaying.title,
    pitchSemitones: state.nowPlaying.pitch_semitones,
  });
});
