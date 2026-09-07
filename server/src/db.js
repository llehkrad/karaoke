import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "karaoke.db");

import fs from "node:fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS rooms (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('session', 'permanent')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  host_token      TEXT NOT NULL,
  now_playing_id  INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS queue_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id         TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  video_id        TEXT NOT NULL,
  title           TEXT NOT NULL,
  thumbnail       TEXT,
  channel_title   TEXT,
  pitch_semitones INTEGER NOT NULL DEFAULT 0,
  added_by        TEXT,
  position        REAL NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'played')),
  created_at      INTEGER NOT NULL,
  played_at       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_queue_room ON queue_items(room_id, status, position);

CREATE TABLE IF NOT EXISTS song_history (
  room_id             TEXT NOT NULL,
  video_id            TEXT NOT NULL,
  title               TEXT NOT NULL,
  last_pitch_semitones INTEGER NOT NULL DEFAULT 0,
  last_played_at      INTEGER,
  play_count          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, video_id)
);
`);
