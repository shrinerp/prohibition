ALTER TABLE leaderboard_entries ADD COLUMN failed_missions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE leaderboard_entries ADD COLUMN seasons_jailed  INTEGER NOT NULL DEFAULT 0;
