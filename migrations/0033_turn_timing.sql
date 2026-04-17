-- Track when a player's turn started (for duration calculation)
ALTER TABLE game_players ADD COLUMN turn_started_at TEXT;

-- Store how long each turn took (seconds)
ALTER TABLE turns ADD COLUMN duration_seconds INTEGER;

-- Store average turn duration in leaderboard snapshots
ALTER TABLE leaderboard_entries ADD COLUMN avg_turn_seconds INTEGER;
