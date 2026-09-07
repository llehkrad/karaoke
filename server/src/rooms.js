import { nanoid, customAlphabet } from "nanoid";
import { db } from "./db.js";

// Session room codes: short, human-typeable if needed (e.g. read aloud), avoids ambiguous chars.
const sessionCodeGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

// A single shared admin password (server/.env) acts as a skeleton key for
// verifyHost, valid for every room. Lets /admin control any room without
// ever needing to know that room's real per-room host_token.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function now() {
  return Date.now();
}

export function createRoom({ type, slug }) {
  if (type !== "session" && type !== "permanent") {
    throw new Error("type must be 'session' or 'permanent'");
  }

  let id;
  if (type === "permanent") {
    id = slug && slug.trim() ? slugify(slug) : `room-${nanoid(8)}`;
    const existing = db.prepare("SELECT id FROM rooms WHERE id = ?").get(id);
    if (existing) {
      throw new Error(`A permanent room with id "${id}" already exists.`);
    }
  } else {
    // Session rooms: keep generating until we find an unused code (astronomically rare collision).
    do {
      id = sessionCodeGen();
    } while (db.prepare("SELECT id FROM rooms WHERE id = ?").get(id));
  }

  const hostToken = nanoid(24);
  const ts = now();

  db.prepare(
    `INSERT INTO rooms (id, type, status, host_token, now_playing_id, created_at, updated_at)
     VALUES (?, ?, 'active', ?, NULL, ?, ?)`
  ).run(id, type, hostToken, ts, ts);

  return getRoom(id);
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `room-${nanoid(8)}`;
}

export function getRoom(id) {
  return db.prepare("SELECT * FROM rooms WHERE id = ?").get(id) || null;
}

export function verifyHost(id, hostToken) {
  if (!hostToken) return false;
  const room = getRoom(id);
  if (!room) return false;
  if (room.host_token === hostToken) return true;
  return Boolean(ADMIN_PASSWORD) && hostToken === ADMIN_PASSWORD;
}

export function listRooms() {
  return db.prepare("SELECT * FROM rooms ORDER BY updated_at DESC").all();
}

export function pauseRoom(id) {
  db.prepare("UPDATE rooms SET status = 'paused', updated_at = ? WHERE id = ?").run(now(), id);
  return getRoom(id);
}

export function resumeRoom(id) {
  db.prepare("UPDATE rooms SET status = 'active', updated_at = ? WHERE id = ?").run(now(), id);
  return getRoom(id);
}

export function endSessionRoom(id) {
  // Session rooms are fully torn down (cascades to queue_items via FK).
  db.prepare("DELETE FROM rooms WHERE id = ? AND type = 'session'").run(id);
}

export function setNowPlaying(roomId, queueItemId) {
  db.prepare("UPDATE rooms SET now_playing_id = ?, updated_at = ? WHERE id = ?").run(
    queueItemId,
    now(),
    roomId
  );
}
