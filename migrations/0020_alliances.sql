CREATE TABLE alliances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  requester_player_id INTEGER NOT NULL REFERENCES game_players(id),
  recipient_player_id INTEGER NOT NULL REFERENCES game_players(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | active | broken
  formed_season INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(game_id, requester_player_id, recipient_player_id)
);
CREATE INDEX IF NOT EXISTS idx_alliances_game ON alliances(game_id);

CREATE TABLE alliance_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alliance_id INTEGER NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alliance_chat_alliance ON alliance_chat(alliance_id);
