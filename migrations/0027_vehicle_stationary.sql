-- Track which season each vehicle arrived at its current city.
-- Used to enforce the 4-turn stationary limit (warning on turn 4, breakdown on turn 5).
ALTER TABLE vehicles ADD COLUMN stationary_since INTEGER NOT NULL DEFAULT 1;
