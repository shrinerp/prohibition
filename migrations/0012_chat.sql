CREATE TABLE game_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    TEXT    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id  INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  message    TEXT    NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX game_messages_poll ON game_messages(game_id, id);
