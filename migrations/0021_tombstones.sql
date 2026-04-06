-- Tombstones: notify players when their game is auto-deleted due to inactivity
CREATE TABLE game_tombstones (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_name  TEXT,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  seen       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_tombstones_user ON game_tombstones(user_id, seen);
