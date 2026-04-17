-- Per-turn use counters for bulk convenience actions
-- Reset to 0 when the player's turn advances (see turn engine)
ALTER TABLE game_players ADD COLUMN sell_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE game_players ADD COLUMN max_out_used INTEGER NOT NULL DEFAULT 0;
