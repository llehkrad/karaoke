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

export function createRoom({ type, slug, creatorUsername }) {
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

  // A power user who creates a permanent room is automatically tied to it
  // (otherwise they'd immediately lose it from "View All Rooms"). Admins
  // don't need a membership row since they already see/manage everything.
  if (type === "permanent" && creatorUsername) {
    const creator = db.prepare("SELECT * FROM users WHERE username = ?").get(creatorUsername);
    if (creator && creator.role === "power") {
      addRoomMember(id, creatorUsername);
    }
  }

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
  // Check if token matches the room's own per-room host token
  if (room.host_token === hostToken) return true;
  // Otherwise treat hostToken as a username: admins are a skeleton key
  // valid for any room; power users only for rooms they're tied to.
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(hostToken);
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "power") return isRoomMember(id, user.username);
  return false;
}

export function listRooms() {
  return db.prepare("SELECT * FROM rooms ORDER BY updated_at DESC").all();
}

// Rooms a given logged-in user should see in "View All Rooms": admins see
// everything; power users see every session room plus only the permanent
// rooms they're tied to.
export function listRoomsForUser(user) {
  const rooms = listRooms();
  if (user.role === "admin") return rooms;
  return rooms.filter((room) => room.type === "session" || isRoomMember(room.id, user.username));
}

export function addRoomMember(roomId, username) {
  db.prepare(
    "INSERT OR IGNORE INTO room_members (room_id, username, added_at) VALUES (?, ?, ?)"
  ).run(roomId, username, now());
}

export function removeRoomMember(roomId, username) {
  db.prepare("DELETE FROM room_members WHERE room_id = ? AND username = ?").run(roomId, username);
}

export function isRoomMember(roomId, username) {
  return !!db
    .prepare("SELECT 1 FROM room_members WHERE room_id = ? AND username = ?")
    .get(roomId, username);
}

export function listRoomMembers(roomId) {
  return db
    .prepare(
      `SELECT room_members.username, room_members.added_at
       FROM room_members WHERE room_members.room_id = ?
       ORDER BY room_members.added_at ASC`
    )
    .all(roomId);
}

export function pauseRoom(id) {
  db.prepare("UPDATE rooms SET status = 'paused', updated_at = ? WHERE id = ?").run(now(), id);
  return getRoom(id);
}

export function resumeRoom(id) {
  db.prepare("UPDATE rooms SET status = 'active', updated_at = ? WHERE id = ?").run(now(), id);
  return getRoom(id);
}

// Fully removes a room and its dependent rows. better-sqlite3 doesn't
// enforce FK cascades unless "PRAGMA foreign_keys = ON" is set (it isn't
// here), so queue_items/song_history are deleted explicitly rather than
// relying on the schema's ON DELETE CASCADE.
const deleteRoomTx = db.transaction((id) => {
  db.prepare("DELETE FROM queue_items WHERE room_id = ?").run(id);
  db.prepare("DELETE FROM song_history WHERE room_id = ?").run(id);
  db.prepare("DELETE FROM room_members WHERE room_id = ?").run(id);
  db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
});

export function endSessionRoom(id) {
  const room = getRoom(id);
  if (!room || room.type !== "session") return;
  deleteRoomTx(id);
}

// Permanent-room delete: same full teardown, freeing the slug for reuse.
export function deleteRoom(id) {
  deleteRoomTx(id);
}

export function setNowPlaying(roomId, queueItemId) {
  db.prepare("UPDATE rooms SET now_playing_id = ?, updated_at = ? WHERE id = ?").run(
    queueItemId,
    now(),
    roomId
  );
}
