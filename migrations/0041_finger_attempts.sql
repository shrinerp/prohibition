-- Snitch mechanic: finger attempts by bootleggers trying to expose snitches
CREATE TABLE finger_attempts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id     INTEGER NOT NULL,
  accuser_id  INTEGER NOT NULL,
  target_id   INTEGER NOT NULL,
  season      INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id)
);
