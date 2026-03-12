-- Fleet system: each player owns one or more vehicles, each with its own cargo

CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  game_id   TEXT    NOT NULL REFERENCES games(id),
  vehicle_type TEXT NOT NULL DEFAULT 'workhorse',
  city_id   INTEGER NOT NULL REFERENCES game_cities(id),
  heat      INTEGER NOT NULL DEFAULT 0,
  purchase_price INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicle_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id   INTEGER NOT NULL REFERENCES vehicles(id),
  alcohol_type TEXT    NOT NULL,
  quantity     INTEGER NOT NULL DEFAULT 0,
  UNIQUE(vehicle_id, alcohol_type)
);

-- Migrate: one vehicle row per existing player (using their current vehicle type + city)
INSERT INTO vehicles (player_id, game_id, vehicle_type, city_id, purchase_price)
SELECT gp.id, gp.game_id, gp.vehicle, gp.current_city_id, 0
FROM game_players gp WHERE gp.current_city_id IS NOT NULL;

-- Migrate: move pooled inventory to the player's first vehicle
INSERT OR IGNORE INTO vehicle_inventory (vehicle_id, alcohol_type, quantity)
SELECT v.id, i.alcohol_type, i.quantity
FROM inventory i
JOIN vehicles v ON v.player_id = i.player_id
WHERE i.quantity > 0;

DELETE FROM inventory;
