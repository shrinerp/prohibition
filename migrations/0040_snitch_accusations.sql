-- Snitch mechanic: accusations filed by snitches against specific players
CREATE TABLE snitch_accusations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    INTEGER NOT NULL,
  snitch_id  INTEGER NOT NULL,
  target_id  INTEGER NOT NULL,
  season     INTEGER NOT NULL,
  success    INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id)
);
