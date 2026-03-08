import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Verify migration files exist and contain expected table definitions
describe('D1 schema migrations', () => {
  const migration = readFileSync(join(__dirname, '../migrations/0001_core_schema.sql'), 'utf-8')
  const seed = readFileSync(join(__dirname, '../migrations/0002_seed_cities.sql'), 'utf-8')

  const expectedTables = [
    'users', 'sessions', 'games', 'city_pool', 'game_cities',
    'roads', 'game_players', 'inventory', 'distilleries',
    'market_prices', 'heat_history', 'jail_sentences',
    'turns', 'year_events', 'npc_state'
  ]

  it('defines all required tables', () => {
    for (const table of expectedTables) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
    }
  })

  it('defines indexes for performance-critical queries', () => {
    expect(migration).toContain('idx_sessions_user')
    expect(migration).toContain('idx_game_players_game')
    expect(migration).toContain('idx_turns_game_season')
    expect(migration).toContain('idx_market_prices_city_season')
  })

  it('seeds exactly 50 cities', () => {
    // Count value rows — each city starts with "  ('" on its own line
    const inserts = seed.match(/^\s+\('/gm) ?? []
    expect(inserts.length).toBe(50)
  })

  it('seed covers all 5 regions', () => {
    const regions = ['Midwest', 'East Coast', 'South', 'West Coast', 'West']
    for (const region of regions) {
      expect(seed).toContain(region)
    }
  })

  it('uses correct alcohol types from spec', () => {
    const alcohols = ['moonshine', 'vodka', 'rum', 'bourbon', 'gin', 'whiskey', 'beer', 'tequila']
    for (const alcohol of alcohols) {
      expect(seed).toContain(`'${alcohol}'`)
    }
  })

  it('games table has status, season, and turn_deadline columns', () => {
    expect(migration).toContain('status TEXT')
    expect(migration).toContain('current_season INTEGER')
    expect(migration).toContain('turn_deadline TEXT')
  })

  it('game_players table has heat and jail columns', () => {
    expect(migration).toContain('heat INTEGER')
    expect(migration).toContain('jail_until_season INTEGER')
  })
})
