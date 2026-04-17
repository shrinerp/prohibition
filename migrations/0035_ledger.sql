CREATE TABLE ledger_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id     TEXT    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id   INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  season      INTEGER NOT NULL,
  type        TEXT    NOT NULL,  -- sell | buy | bribe | claim_city | upgrade_still | buy_vehicle | police_cash | police_bribe | trap_penalty | toll_paid | toll_received | mission | jazz_income | vehicle_repair | sell_vehicle | sell_all
  amount      INTEGER NOT NULL,  -- positive = income, negative = expense
  description TEXT    NOT NULL,
  city_id     INTEGER,           -- game_cities.id (nullable)
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ledger_player ON ledger_entries(game_id, player_id, id DESC);
