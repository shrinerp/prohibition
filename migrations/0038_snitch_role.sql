-- Snitch mechanic: player role, jail history, federal bribe tracking, pending sightings
ALTER TABLE game_players ADD COLUMN role TEXT NOT NULL DEFAULT 'bootlegger';
ALTER TABLE game_players ADD COLUMN jailed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_players ADD COLUMN federal_bribe_expires_season INTEGER;
ALTER TABLE game_players ADD COLUMN pending_sightings TEXT;
