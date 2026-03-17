-- Track what the current owner paid to claim the city (used to price hostile takeovers at 2x)
ALTER TABLE game_cities ADD COLUMN claim_cost INTEGER DEFAULT 0;
