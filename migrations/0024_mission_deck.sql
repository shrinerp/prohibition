CREATE TABLE game_mission_deck (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  deck    TEXT NOT NULL DEFAULT '[]',
  discard TEXT NOT NULL DEFAULT '[]',
  UNIQUE(game_id)
);

CREATE TABLE player_missions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id          TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id        INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  card_id          INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'held',
  progress         TEXT NOT NULL DEFAULT '{}',
  assigned_season  INTEGER NOT NULL,
  completed_season INTEGER,
  reward_paid      INTEGER NOT NULL DEFAULT 0,
  penalty_paid     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_player_missions_game_player ON player_missions(game_id, player_id);
