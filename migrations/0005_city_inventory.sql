-- City-level alcohol stockpile: distilleries produce here each season
CREATE TABLE IF NOT EXISTS city_inventory (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id      TEXT    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  city_id      INTEGER NOT NULL REFERENCES game_cities(id),
  alcohol_type TEXT    NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(game_id, city_id, alcohol_type)
);

-- Seed one season of production for any distilleries that already exist
INSERT OR IGNORE INTO city_inventory (game_id, city_id, alcohol_type, quantity)
SELECT gp.game_id, d.city_id, cp.primary_alcohol, d.tier * 2
FROM distilleries d
JOIN game_players gp ON d.player_id = gp.id
JOIN game_cities  gc ON d.city_id   = gc.id
JOIN city_pool    cp ON gc.city_pool_id = cp.id;
