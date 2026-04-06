-- Prevent duplicate city_pool entries from re-seeding
CREATE UNIQUE INDEX IF NOT EXISTS city_pool_name_state ON city_pool(name, state);
