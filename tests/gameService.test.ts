import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GameService } from '../src/services/GameService'

const BASE_ENV = {
  PROHIBITIONDB: null as any,
  ENCRYPTION_KEY: '',
  MAILS_API_KEY: '',
  MAILS_ENDPOINT: ''
}

function makeDb(options: {
  gameRow?: unknown
  playerRows?: unknown[]
  cityPoolRows?: unknown[]
  firstResult?: unknown
} = {}) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(options.firstResult ?? options.gameRow ?? null),
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue({ results: options.playerRows ?? options.cityPoolRows ?? [] })
  }
  return {
    prepare: vi.fn().mockReturnValue(stmt),
    batch: vi.fn().mockResolvedValue([]),
    _stmt: stmt
  }
}

describe('GameService.createGame()', () => {
  it('returns a game id and invite code', async () => {
    const db = makeDb()
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.createGame(1)
    expect(result.success).toBe(true)
    expect(typeof result.gameId).toBe('string')
    expect(typeof result.inviteCode).toBe('string')
    expect(result.inviteCode!.length).toBeGreaterThan(4)
  })

  it('inserts into games table and adds creator as player 0', async () => {
    const db = makeDb()
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    await svc.createGame(42)
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO games'))
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO game_players'))
  })
})

describe('GameService.joinGame()', () => {
  it('returns error when game not found', async () => {
    const db = makeDb({ firstResult: null })
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.joinGame('bad-code', 99)
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/not found/i)
  })

  it('returns error when game is not in lobby status', async () => {
    const db = makeDb({ firstResult: { id: 'g1', status: 'active', player_count: 2 } })
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.joinGame('code123', 99)
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/already started/i)
  })

  it('returns error when game is full (5 players)', async () => {
    const db = makeDb({ firstResult: { id: 'g1', status: 'lobby', player_count: 5, max_players: 5 } })
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.joinGame('code123', 99)
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/full/i)
  })
})

describe('GameService.startGame()', () => {
  it('returns error when game not found', async () => {
    const db = makeDb({ firstResult: null })
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.startGame('missing-id', 1)
    expect(result.success).toBe(false)
  })

  it('returns error when caller is not host (turn_order != 0)', async () => {
    const db = makeDb({ firstResult: { id: 'g1', status: 'lobby', host_user_id: 99 } })
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.startGame('g1', 1) // userId=1 is not host
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/host/i)
  })

  it('returns error when game is already active', async () => {
    const db = makeDb({ firstResult: { id: 'g1', status: 'active', host_user_id: 1 } })
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: db as any })
    const result = await svc.startGame('g1', 1)
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/already started/i)
  })
})

describe('GameService.selectCities()', () => {
  it('selects between 15 and 20 cities from the pool', () => {
    const pool = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1, region: ['Midwest', 'East Coast', 'South', 'West Coast', 'West'][i % 5]
    }))
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: {} as any })
    const selected = svc.selectCities(pool as any)
    expect(selected.length).toBeGreaterThanOrEqual(15)
    expect(selected.length).toBeLessThanOrEqual(20)
  })

  it('always includes at least one city per region', () => {
    const regions = ['Midwest', 'East Coast', 'South', 'West Coast', 'West']
    const pool = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1, region: regions[i % 5]
    }))
    const svc = new GameService({ ...BASE_ENV, PROHIBITIONDB: {} as any })
    const selected = svc.selectCities(pool as any)
    for (const region of regions) {
      expect(selected.some(c => c.region === region)).toBe(true)
    }
  })
})
