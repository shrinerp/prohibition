-- Add pending police encounter state to game_players
ALTER TABLE game_players ADD COLUMN pending_police_encounter TEXT; -- JSON or NULL
