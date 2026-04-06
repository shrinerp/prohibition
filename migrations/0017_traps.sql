CREATE TABLE traps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  city_id INTEGER NOT NULL REFERENCES game_cities(id),
  setter_player_id INTEGER NOT NULL REFERENCES game_players(id),
  consequence_type TEXT NOT NULL, -- jail | alcohol_loss | financial | stuck
  consequence_params TEXT NOT NULL, -- JSON: { seasons: 2 } | { amount: 500 } | { turns: 3 }
  cost REAL NOT NULL,
  created_season INTEGER NOT NULL,
  UNIQUE(game_id, city_id) -- one trap per city at a time
);

CREATE INDEX IF NOT EXISTS idx_traps_game_city ON traps(game_id, city_id);
