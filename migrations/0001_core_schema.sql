-- Core schema for Prohibition game
-- Migration 0001: all tables

-- Users & auth
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,  -- YYYY-MM-DD, for age gate
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,           -- UUID
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Games
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,           -- UUID
  invite_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'lobby',  -- lobby | active | ended
  current_player_index INTEGER NOT NULL DEFAULT 0,
  current_season INTEGER NOT NULL DEFAULT 1,  -- 1-52
  turn_deadline TEXT,            -- ISO timestamp, 24h window
  volatility_index REAL NOT NULL DEFAULT 1.0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- City pool (seeded with all 50 cities)
CREATE TABLE IF NOT EXISTS city_pool (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  region TEXT NOT NULL,          -- Midwest | East Coast | South | West Coast | West
  historical_role TEXT NOT NULL,
  primary_alcohol TEXT NOT NULL,
  population_tier TEXT NOT NULL, -- small | medium | large | major
  is_coastal INTEGER NOT NULL DEFAULT 0,
  bribe_cost_multiplier REAL NOT NULL DEFAULT 1.0
);

-- Cities active in a specific game (subset of city_pool)
CREATE TABLE IF NOT EXISTS game_cities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  city_pool_id INTEGER NOT NULL REFERENCES city_pool(id),
  demand_index REAL NOT NULL DEFAULT 1.0,  -- 0.5 - 2.0
  owner_player_id INTEGER,       -- NULL = neutral
  bribe_player_id INTEGER,       -- player who placed long-term bribe
  bribe_expires_season INTEGER,  -- season when bribe decays
  UNIQUE(game_id, city_pool_id)
);

-- Roads between game_cities
CREATE TABLE IF NOT EXISTS roads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  from_city_id INTEGER NOT NULL REFERENCES game_cities(id),
  to_city_id INTEGER NOT NULL REFERENCES game_cities(id),
  distance_value INTEGER NOT NULL  -- dice cost to traverse
);

-- Players in a game
CREATE TABLE IF NOT EXISTS game_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),  -- NULL = NPC
  turn_order INTEGER NOT NULL,   -- 0-4
  character_class TEXT NOT NULL,
  is_npc INTEGER NOT NULL DEFAULT 0,
  home_city_id INTEGER REFERENCES game_cities(id),
  current_city_id INTEGER REFERENCES game_cities(id),
  vehicle TEXT NOT NULL DEFAULT 'workhorse',  -- roadster | truck | workhorse | whiskey_runner
  cash REAL NOT NULL DEFAULT 200.0,
  heat INTEGER NOT NULL DEFAULT 0,  -- 0-100
  jail_until_season INTEGER,     -- NULL = not in jail
  adjustment_cards INTEGER NOT NULL DEFAULT 3,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(game_id, turn_order)
);

-- Alcohol inventory per player
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  alcohol_type TEXT NOT NULL,    -- moonshine | vodka | rum | bourbon | gin | whiskey | beer | rye | scotch | tequila | brandy | wine | vermouth | malort
  quantity INTEGER NOT NULL DEFAULT 0,
  UNIQUE(player_id, alcohol_type)
);

-- Distilleries owned by players
CREATE TABLE IF NOT EXISTS distilleries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  city_id INTEGER NOT NULL REFERENCES game_cities(id),
  tier INTEGER NOT NULL DEFAULT 1,  -- 1-5
  still_number INTEGER NOT NULL,    -- 1-3 (max 3 stills)
  purchase_price REAL NOT NULL,
  UNIQUE(player_id, still_number)
);

-- Market prices per city per season
CREATE TABLE IF NOT EXISTS market_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  city_id INTEGER NOT NULL REFERENCES game_cities(id),
  season INTEGER NOT NULL,
  alcohol_type TEXT NOT NULL,
  price REAL NOT NULL,
  UNIQUE(game_id, city_id, season, alcohol_type)
);

-- Heat meters (tracked on game_players.heat, this table logs history)
CREATE TABLE IF NOT EXISTS heat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  heat_change INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Jail sentences
CREATE TABLE IF NOT EXISTS jail_sentences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  sentenced_season INTEGER NOT NULL,
  release_season INTEGER NOT NULL,
  reason TEXT NOT NULL           -- standard | violent
);

-- Turn log
CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES game_players(id),
  season INTEGER NOT NULL,
  actions TEXT NOT NULL,         -- JSON array of actions taken
  skipped INTEGER NOT NULL DEFAULT 0,
  resolved_at TEXT DEFAULT (datetime('now'))
);

-- Year events (drawn at season 1 of each year)
CREATE TABLE IF NOT EXISTS year_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,         -- 1920-1933
  event_key TEXT NOT NULL,       -- great_depression | police_crackdown | etc.
  effect TEXT NOT NULL           -- JSON description of effect
);

-- NPC state (for scripted syndicate logic)
CREATE TABLE IF NOT EXISTS npc_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE UNIQUE,
  last_action TEXT,              -- upgrade | expand | aggress | sell
  wealth_decay_counter INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_cities_game ON game_cities(game_id);
CREATE INDEX IF NOT EXISTS idx_roads_game ON roads(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_game ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_inventory_player ON inventory(player_id);
CREATE INDEX IF NOT EXISTS idx_turns_game_season ON turns(game_id, season);
CREATE INDEX IF NOT EXISTS idx_market_prices_city_season ON market_prices(city_id, season);
