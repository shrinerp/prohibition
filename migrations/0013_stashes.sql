CREATE TABLE city_stashes (
  id           INTEGER  PRIMARY KEY AUTOINCREMENT,
  game_id      TEXT     NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  city_id      INTEGER  NOT NULL REFERENCES game_cities(id) ON DELETE CASCADE,
  placer_id    INTEGER  NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  stash_type   TEXT     NOT NULL, -- 'money' | 'alcohol' | 'booby_trap' | 'note'
  coord_x      REAL     NOT NULL, -- normalised 0.0–1.0
  coord_y      REAL     NOT NULL,
  cash_amount  REAL,
  alcohol_type TEXT,
  alcohol_qty  INTEGER,
  heat_spike   INTEGER,
  jail_seasons INTEGER,
  cash_penalty REAL,
  note_text    TEXT,              -- max 140 chars
  retrieved_by INTEGER REFERENCES game_players(id),
  retrieved_at DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_city_stashes_game_city ON city_stashes(game_id, city_id);

ALTER TABLE game_messages ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;
