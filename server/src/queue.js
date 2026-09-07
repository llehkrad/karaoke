import { db } from "./db.js";
import { setNowPlaying } from "./rooms.js";

function now() {
  return Date.now();
}

export function getFullState(roomId) {
  const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId);
  if (!room) return null;

  const queue = db
    .prepare(
      `SELECT * FROM queue_items
       WHERE room_id = ? AND status = 'queued'
       ORDER BY position ASC`
    )
    .all(roomId);

  const nowPlaying = room.now_playing_id
    ? db.prepare("SELECT * FROM queue_items WHERE id = ?").get(room.now_playing_id)
    : null;

  return { room, queue, nowPlaying };
}

export function addToQueue(roomId, { videoId, title, thumbnail, channelTitle, pitch, addedBy }) {
  const ts = now();
  const maxPos = db
    .prepare("SELECT MAX(position) AS maxPos FROM queue_items WHERE room_id = ? AND status = 'queued'")
    .get(roomId).maxPos;
  const position = (maxPos ?? 0) + 1;

  const info = db
    .prepare(
      `INSERT INTO queue_items
         (room_id, video_id, title, thumbnail, channel_title, pitch_semitones, added_by, position, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`
    )
    .run(roomId, videoId, title, thumbnail || null, channelTitle || null, pitch || 0, addedBy || null, position, ts);

  const state = getFullState(roomId);

  // If nothing is currently playing, immediately promote this new item.
  if (!state.room.now_playing_id) {
    advanceQueue(roomId);
  }

  return info.lastInsertRowid;
}

/**
 * Live-adjusts the pitch of whatever's currently playing, without
 * re-queuing it. The pitch-shifter bridge endpoint and the Chrome
 * extension both read pitch_semitones fresh off nowPlaying on every
 * poll/state_update, so this takes effect for them automatically.
 */
export function updateNowPlayingPitch(roomId, semitones) {
  const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId);
  if (!room || !room.now_playing_id) return null;

  const clamped = Math.max(-12, Math.min(12, Math.round(semitones)));
  db.prepare("UPDATE queue_items SET pitch_semitones = ? WHERE id = ?").run(clamped, room.now_playing_id);

  return getFullState(roomId);
}

export function removeFromQueue(roomId, itemId) {
  db.prepare("DELETE FROM queue_items WHERE id = ? AND room_id = ? AND status = 'queued'").run(itemId, roomId);
}

export function shuffleQueue(roomId) {
  const items = db
    .prepare("SELECT id FROM queue_items WHERE room_id = ? AND status = 'queued'")
    .all(roomId);

  const ids = items.map((i) => i.id);
  // Fisher-Yates shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const update = db.prepare("UPDATE queue_items SET position = ? WHERE id = ?");
  const tx = db.transaction((orderedIds) => {
    orderedIds.forEach((id, idx) => update.run(idx + 1, id));
  });
  tx(ids);
}

/**
 * Called when the currently playing video finishes (reported by the host
 * display client), or when a song is added to an empty queue. Marks the
 * current item played (if any), records song history, and promotes the
 * next queued item (lowest position) to now-playing. If the queue is
 * empty, now_playing_id becomes null, which the host display renders as
 * the "please select a song" blank screen.
 */
export function advanceQueue(roomId) {
  const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(roomId);
  if (!room) return null;

  const ts = now();

  if (room.now_playing_id) {
    const finished = db.prepare("SELECT * FROM queue_items WHERE id = ?").get(room.now_playing_id);
    if (finished) {
      db.prepare("UPDATE queue_items SET status = 'played', played_at = ? WHERE id = ?").run(
        ts,
        finished.id
      );
      recordSongHistory(roomId, finished);
    }
  }

  const next = db
    .prepare(
      `SELECT * FROM queue_items
       WHERE room_id = ? AND status = 'queued'
       ORDER BY position ASC LIMIT 1`
    )
    .get(roomId);

  if (next) {
    db.prepare("UPDATE queue_items SET status = 'playing' WHERE id = ?").run(next.id);
    setNowPlaying(roomId, next.id);
  } else {
    setNowPlaying(roomId, null);
  }

  return getFullState(roomId);
}

function recordSongHistory(roomId, item) {
  const existing = db
    .prepare("SELECT * FROM song_history WHERE room_id = ? AND video_id = ?")
    .get(roomId, item.video_id);

  if (existing) {
    db.prepare(
      `UPDATE song_history
       SET last_pitch_semitones = ?, last_played_at = ?, play_count = play_count + 1, title = ?
       WHERE room_id = ? AND video_id = ?`
    ).run(item.pitch_semitones, Date.now(), item.title, roomId, item.video_id);
  } else {
    db.prepare(
      `INSERT INTO song_history (room_id, video_id, title, last_pitch_semitones, last_played_at, play_count)
       VALUES (?, ?, ?, ?, ?, 1)`
    ).run(roomId, item.video_id, item.title, item.pitch_semitones, Date.now());
  }
}

export function getSongHistoryEntry(roomId, videoId) {
  return db
    .prepare("SELECT * FROM song_history WHERE room_id = ? AND video_id = ?")
    .get(roomId, videoId);
}

export function getRecentHistory(roomId, limit = 20) {
  return db
    .prepare(
      `SELECT * FROM song_history WHERE room_id = ? ORDER BY last_played_at DESC LIMIT ?`
    )
    .all(roomId, limit);
}

export function updateItemPitch(roomId, itemId, semitones) {
  const clamped = Math.max(-12, Math.min(12, Math.round(semitones)));
  db.prepare("UPDATE queue_items SET pitch_semitones = ? WHERE id = ? AND room_id = ?").run(
    clamped,
    itemId,
    roomId
  );
}

export function reorderQueue(roomId, orderedItemIds) {
  const update = db.prepare("UPDATE queue_items SET position = ? WHERE id = ?");
  const tx = db.transaction((ids) => {
    ids.forEach((id, idx) => {
      update.run(idx + 1, id);
    });
  });
  tx(orderedItemIds);
}
