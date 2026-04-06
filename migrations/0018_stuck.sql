ALTER TABLE game_players ADD COLUMN stuck_until_season INTEGER; -- NULL = not stuck
ALTER TABLE game_players ADD COLUMN stuck_city_id INTEGER REFERENCES game_cities(id);
