-- display_name was added directly to production without a migration.
-- Apply to staging and any fresh DB. Skip on production (column already exists).
ALTER TABLE game_players ADD COLUMN display_name TEXT;
