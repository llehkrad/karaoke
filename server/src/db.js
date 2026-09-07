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

CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  username            TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'power' CHECK (role IN ('admin', 'power')),
  created_at          INTEGER NOT NULL
);

-- Ties a power-user account to a permanent room they're allowed to manage.
-- Admin accounts always have full access to every room and are never
-- inserted here (see verifyHost / listRooms filtering).
CREATE TABLE IF NOT EXISTS room_members (
  room_id     TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  username    TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (room_id, username)
);
`);

// Initialize default admin user if none exists
const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!existingAdmin && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
  const crypto = await import("node:crypto");
  const hash = crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD).digest("hex");
  db.prepare("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)").run(
    process.env.ADMIN_USERNAME,
    hash,
    Date.now()
  );
}
