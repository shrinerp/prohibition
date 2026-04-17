-- Snitch mechanic: informants placed by snitches in cities to detect player movements
CREATE TABLE informants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    INTEGER NOT NULL,
  snitch_id  INTEGER NOT NULL,
  city_id    INTEGER,
  placed_at  INTEGER,
  FOREIGN KEY (game_id)   REFERENCES games(id),
  FOREIGN KEY (snitch_id) REFERENCES game_players(id)
);
