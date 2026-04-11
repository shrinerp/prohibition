CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id         TEXT    NOT NULL,
  user_id         INTEGER NOT NULL,
  player_name     TEXT    NOT NULL,
  character_class TEXT    NOT NULL,
  rank            INTEGER NOT NULL,
  net_worth       INTEGER NOT NULL,
  total_seasons   INTEGER NOT NULL,
  ended_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(game_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_seasons ON leaderboard_entries(total_seasons, net_worth DESC);
