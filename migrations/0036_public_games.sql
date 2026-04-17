ALTER TABLE games ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
CREATE INDEX games_public_lobby ON games(is_public, status) WHERE is_public = 1 AND status = 'lobby';
