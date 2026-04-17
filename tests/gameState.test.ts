/**
 * Tests for the GET /api/games/:id/state endpoint.
 *
 * Regression coverage: columns that were added to production outside of
 * the migration system (e.g. display_name) must be defined in a migration
 * file so staging and any fresh DB get the column automatically.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import worker from '../src/index'

const MIGRATIONS_DIR = join(__dirname, '../migrations')

// ── Helpers ────────────────────────────────────────────────────────────────

function allMigrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => readFileSync(join(MIGRATIONS_DIR, f), 'utf-8'))
    .join('\n')
}

/**
 * Build a D1 mock that responds from a queue of results.
 * Each entry is either { first: value } or { all: value[] }.
 * Responses are consumed in the order prepare() is called.
 */
function makeSequentialDb(responses: Array<{ first?: unknown; all?: unknown[] }>) {
  let idx = 0
  return {
    prepare: () => {
      const resp = responses[idx++] ?? { first: null, all: [] }
      return {
        bind: function () { return this },
        first: () => Promise.resolve(resp.first ?? null),
        all:   () => Promise.resolve({ results: resp.all ?? [] }),
        run:   () => Promise.resolve({ success: true }),
      }
    },
    batch: () => Promise.resolve([]),
  }
}

const BASE_ENV = {
  ENCRYPTION_KEY: 'test-key-32-chars-padded-xxxxxxxxx',
  MAILS_API_KEY: '',
  MAILS_ENDPOINT: '',
  THREEMAILS_API_KEY: '',
  VAPID_PUBLIC_KEY: '',
  VAPID_PRIVATE_KEY: '',
  VAPID_SUBJECT: '',
  CF_ZONE_ID: '',
  CF_API_TOKEN: '',
  ASSETS: { fetch: async () => new Response('', { status: 404 }) },
  EMAIL: { send: async () => ({ messageId: '' }) },
} as any

// ── Schema tests ───────────────────────────────────────────────────────────

describe('game_players schema migrations', () => {
  it('display_name column is defined in a migration file', () => {
    // Regression: display_name was once applied directly to production
    // without a migration, causing staging to be missing the column and
    // the state endpoint to return 500.
    const sql = allMigrationsSql()
    expect(sql).toMatch(/display_name/)
  })

  it('turn_started_at column is defined in a migration file', () => {
    const sql = allMigrationsSql()
    expect(sql).toMatch(/turn_started_at/)
  })
})

describe('GET /api/games/:id/state', () => {
  it('returns 401 without a session cookie', async () => {
    const db = makeSequentialDb([])
    const env = { ...BASE_ENV, PROHIBITIONDB: db as any }
    const res = await worker.fetch(
      new Request('http://localhost/api/games/test-game-id/state'),
      env,
      {} as any
    )
    expect(res.status).toBe(401)
  })

  it('returns success with players including turnStartedAt field', async () => {
    // Queue up DB responses in the order the state endpoint queries them:
    // 1. session lookup (via AuthService.validateSession → sessions table)
    // 2. game row
    // 3. player row (the requesting user)
    // 4. all players list
    // 5. vehicles for player
    // 6. distilleries for player
    // 7. bribed cities (skipped when no current_city_id)
    // 8. competitor stills (skipped when no vehicle cities)
    // 9. alliances
    // 10. traps (own) + current city trap
    // 11. missions
    // 12. completed missions count
    const db = makeSequentialDb([
      // AuthService.validateSession: find session
      { first: { user_id: 42, expires_at: new Date(Date.now() + 86400000).toISOString() } },
      // game row
      { first: {
        id: 'game-1', status: 'active', current_season: 3, total_seasons: 52,
        current_player_index: 0, turn_deadline: null, player_count: 2, max_players: 5,
        invite_code: 'ABCD123', host_user_id: 42, game_name: 'Test Game'
      }},
      // player row (requesting user)
      { first: {
        id: 1, turn_order: 0, character_class: 'bootlegger', cash: 500, heat: 10,
        jail_until_season: null, current_city_id: 1, home_city_id: 1, adjustment_cards: 3,
        pending_drinks: null, pending_trap: null, stuck_until_season: null,
        tutorial_seen: 1, total_cash_earned: 500, consecutive_clean_seasons: 2
      }},
      // all players list (includes display_name and turn_started_at)
      { all: [
        { id: 1, turn_order: 0, character_class: 'bootlegger', is_npc: 0,
          current_city_id: 1, cash: 500, display_name: 'Big Paulie',
          turn_started_at: '2026-04-10T12:00:00', email: 'test@example.com' },
        { id: 2, turn_order: 1, character_class: 'npc_merchant', is_npc: 1,
          current_city_id: 2, cash: 300, display_name: 'Big Al',
          turn_started_at: null, email: null },
      ]},
      // vehicles
      { all: [
        { id: 10, vehicle_type: 'workhorse', city_id: 1, heat: 0, stationary_since: 0, purchase_price: 200 }
      ]},
      // vehicle_inventory (for vehicle id 10)
      { all: [] },
      // distilleries
      { all: [] },
      // bribed cities
      { all: [] },
      // competitor stills (skipped — vehicle city ids are non-empty so this runs)
      { all: [] },
      // alliances
      { all: [] },
      // own traps
      { all: [] },
      // current city trap
      { first: null },
      // missions (held)
      { all: [] },
      // completed missions count
      { first: { count: 0 } },
    ])

    const env = { ...BASE_ENV, PROHIBITIONDB: db as any }

    const res = await worker.fetch(
      new Request('http://localhost/api/games/game-1/state', {
        headers: { Cookie: 'session=fake-session-token' }
      }),
      env,
      {} as any
    )

    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.success).toBe(true)
    expect(body.data.players).toHaveLength(2)

    // Verify turnStartedAt is present in the players array
    const human = body.data.players.find((p: any) => !p.isNpc)
    expect(human).toBeDefined()
    expect('turnStartedAt' in human).toBe(true)
    expect(human.turnStartedAt).toBe('2026-04-10T12:00:00')

    // NPC has null turnStartedAt
    const npc = body.data.players.find((p: any) => p.isNpc)
    expect(npc.turnStartedAt).toBeNull()

    // display_name is surfaced via the name field
    expect(human.name).toBe('Big Paulie')
  })
})
