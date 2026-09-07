import { Router } from "express";
import { createHash } from "node:crypto";
import { db } from "./db.js";
import {
  createRoom,
  getRoom,
  listRoomsForUser,
  addRoomMember,
  removeRoomMember,
  listRoomMembers,
} from "./rooms.js";
import { getFullState, getRecentHistory, getSongHistoryEntry } from "./queue.js";

export const router = Router();

function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

function verifyUser(username, password) {
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return null;
  const hash = hashPassword(password);
  if (hash !== user.password_hash) return null;
  return user;
}

function requireAuth(req, res, next) {
  const username = req.headers["x-username"] || req.query.username;
  if (!username) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    next();
  });
}

// Create a new room (session or permanent). Auth is optional here (Quick
// Party rooms are anonymous) — if an X-Username header is present and
// valid, it's used to auto-tie a power user to the permanent room they create.
router.post("/rooms", (req, res) => {
  try {
    const { type, slug } = req.body || {};
    const creatorUsername = req.headers["x-username"] || undefined;
    const room = createRoom({ type, slug, creatorUsername });
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
 * AUTHENTICATION
 * -----
 * Username + password login. Returns user info including role.
 * Client stores username in sessionStorage and sends as X-Username header.
 */
router.post("/admin/rooms/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Username and password required." });
  }

  const user = verifyUser(username, password);
  if (!user) {
    return res.status(401).json({ ok: false, error: "Invalid username or password." });
  }

  res.json({
    ok: true,
    username: user.username,
    role: user.role
  });
});

router.get("/admin/rooms", requireAuth, (req, res) => {
  const rooms = listRoomsForUser(req.user)
    .filter((room) => room.status !== "ended")
    .map((room) => {
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
 * USER MANAGEMENT (admin-only)
 * -----
 * Admin creates every account up front and assigns its role; there's no
 * self-service sign-up yet.
 */
router.get("/users", requireAdmin, (req, res) => {
  const users = db
    .prepare("SELECT username, role, created_at FROM users ORDER BY created_at ASC")
    .all();
  res.json(users);
});

router.post("/users", requireAdmin, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ error: "username, password, and role are required." });
  }
  if (role !== "admin" && role !== "power") {
    return res.status(400).json({ error: "role must be 'admin' or 'power'." });
  }
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    return res.status(400).json({ error: `Username "${username}" is already taken.` });
  }
  const hash = hashPassword(password);
  db.prepare(
    "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)"
  ).run(username, hash, role, Date.now());
  res.json({ username, role });
});

router.put("/users/:username", requireAdmin, (req, res) => {
  const { username } = req.params;
  const { password, role } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(404).json({ error: `User "${username}" not found.` });

  if (role !== undefined) {
    if (role !== "admin" && role !== "power") {
      return res.status(400).json({ error: "role must be 'admin' or 'power'." });
    }
    if (user.role === "admin" && role === "power") {
      const adminCount = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c;
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Can't demote the last remaining admin." });
      }
    }
    db.prepare("UPDATE users SET role = ? WHERE username = ?").run(role, username);
  }

  if (password) {
    db.prepare("UPDATE users SET password_hash = ? WHERE username = ?").run(hashPassword(password), username);
  }

  const updated = db.prepare("SELECT username, role, created_at FROM users WHERE username = ?").get(username);
  res.json(updated);
});

router.delete("/users/:username", requireAdmin, (req, res) => {
  const { username } = req.params;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(404).json({ error: `User "${username}" not found.` });

  if (username === req.user.username) {
    return res.status(400).json({ error: "You can't delete your own account." });
  }
  if (user.role === "admin") {
    const adminCount = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'admin'").get().c;
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Can't delete the last remaining admin." });
    }
  }

  // room_members has no enforced FK cascade in this codebase (better-sqlite3
  // doesn't turn PRAGMA foreign_keys on) -- clean it up explicitly.
  db.prepare("DELETE FROM room_members WHERE username = ?").run(username);
  db.prepare("DELETE FROM users WHERE username = ?").run(username);
  res.json({ ok: true });
});

/**
 * ROOM MEMBERSHIP (admin-only)
 * -----
 * Ties a power-user account to a permanent room so it shows up in their
 * "View All Rooms" list and they get full host control over it.
 */
router.get("/rooms/:roomId/members", requireAdmin, (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found." });
  res.json(listRoomMembers(room.id));
});

router.post("/rooms/:roomId/members", requireAdmin, (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found." });
  if (room.type !== "permanent") {
    return res.status(400).json({ error: "Only permanent rooms have members." });
  }
  const { username } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(404).json({ error: `User "${username}" not found.` });
  if (user.role !== "power") {
    return res.status(400).json({ error: "Only power-role users can be added as room members." });
  }
  addRoomMember(room.id, username);
  res.json(listRoomMembers(room.id));
});

router.delete("/rooms/:roomId/members/:username", requireAdmin, (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: "Room not found." });
  removeRoomMember(room.id, req.params.username);
  res.json(listRoomMembers(room.id));
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
