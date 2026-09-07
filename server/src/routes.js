import { Router } from "express";
import { createRoom, getRoom } from "./rooms.js";
import { getFullState, getRecentHistory, getSongHistoryEntry } from "./queue.js";

export const router = Router();

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
