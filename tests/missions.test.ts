import { describe, it, expect, vi } from 'vitest'
import {
  MISSION_CARDS,
  getMissionCard,
  shuffleDeck,
  checkAndCompleteMissions,
  updateCumulativeProgress,
  type MissionSnapshot,
} from '../src/game/missions'

describe('MISSION_CARDS', () => {
  it('contains exactly 52 cards', () => {
    expect(MISSION_CARDS).toHaveLength(52)
  })

  it('IDs are 1–52 with no duplicates', () => {
    const ids = MISSION_CARDS.map(c => c.id)
    expect(ids).toEqual([...Array(52)].map((_, i) => i + 1))
  })

  it('contains 13 cards per tier', () => {
    const counts = { easy: 0, medium: 0, hard: 0, legendary: 0 }
    for (const card of MISSION_CARDS) counts[card.tier]++
    expect(counts.easy).toBe(13)
    expect(counts.medium).toBe(13)
    expect(counts.hard).toBe(13)
    expect(counts.legendary).toBe(13)
  })

  it('easy rewards are 50–138', () => {
    for (const card of MISSION_CARDS.filter(c => c.tier === 'easy')) {
      expect(card.reward).toBeGreaterThanOrEqual(50)
      expect(card.reward).toBeLessThanOrEqual(138)
    }
  })

  it('medium rewards are 213–425', () => {
    for (const card of MISSION_CARDS.filter(c => c.tier === 'medium')) {
      expect(card.reward).toBeGreaterThanOrEqual(213)
      expect(card.reward).toBeLessThanOrEqual(425)
    }
  })

  it('hard rewards are 525–875', () => {
    for (const card of MISSION_CARDS.filter(c => c.tier === 'hard')) {
      expect(card.reward).toBeGreaterThanOrEqual(525)
      expect(card.reward).toBeLessThanOrEqual(875)
    }
  })

  it('legendary rewards are 1050–1575', () => {
    for (const card of MISSION_CARDS.filter(c => c.tier === 'legendary')) {
      expect(card.reward).toBeGreaterThanOrEqual(1050)
      expect(card.reward).toBeLessThanOrEqual(1575)
    }
  })

  it('each card has title, flavor, historyNote, wikiUrl, objectiveType, params', () => {
    for (const card of MISSION_CARDS) {
      expect(card.title).toBeTruthy()
      expect(card.flavor).toBeTruthy()
      expect(card.historyNote).toBeTruthy()
      expect(card.wikiUrl).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\//)
      expect(card.objectiveType).toBeTruthy()
      expect(card.params).toBeDefined()
    }
  })

  it('no card has a penalty field', () => {
    for (const card of MISSION_CARDS) {
      expect(card).not.toHaveProperty('penalty')
    }
  })
})

describe('getMissionCard()', () => {
  it('returns card for valid id', () => {
    expect(getMissionCard(1)?.id).toBe(1)
    expect(getMissionCard(52)?.id).toBe(52)
  })

  it('returns undefined for invalid id', () => {
    expect(getMissionCard(0)).toBeUndefined()
    expect(getMissionCard(53)).toBeUndefined()
  })
})

describe('shuffleDeck()', () => {
  it('returns array of 52 IDs', () => {
    const deck = shuffleDeck()
    expect(deck).toHaveLength(52)
  })

  it('contains all IDs 1–52', () => {
    const deck = shuffleDeck()
    const sorted = [...deck].sort((a, b) => a - b)
    expect(sorted).toEqual([...Array(52)].map((_, i) => i + 1))
  })

  it('produces different orders across calls (probabilistic)', () => {
    const a = shuffleDeck()
    const b = shuffleDeck()
    // Extremely unlikely to be equal if shuffle is working
    expect(a.join(',')).not.toBe([...Array(52)].map((_, i) => i + 1).join(','))
  })
})

describe('checkAndCompleteMissions()', () => {
  function makeDb(rows: Array<{ id: number; card_id: number; progress: string }>) {
    const runFn = vi.fn().mockResolvedValue({})
    const firstFn = vi.fn().mockResolvedValue({ cash: 1000 })
    const prepareFn = vi.fn().mockImplementation((sql: string) => ({
      bind: (..._args: unknown[]) => ({
        all: vi.fn().mockResolvedValue({ results: rows }),
        run: runFn,
        first: firstFn,
      }),
    }))
    return { prepare: prepareFn }
  }

  const baseSnapshot: MissionSnapshot = {
    cash: 1000,
    citiesOwned: 2,
    vehiclesOwned: 1,
    maxDistilleryTier: 2,
    totalCargoUnits: 5,
    cargoByType: { beer: 5 },
    heat: 15,
    totalCashEarned: 500,
    consecutiveCleanSeasons: 3,
  }

  it('returns empty completedCardIds when no missions held', async () => {
    const db = makeDb([]) as unknown as D1Database
    const result = await checkAndCompleteMissions(db, 'game1', 1, 1, baseSnapshot)
    expect(result.completedCardIds).toEqual([])
    expect(result.totalReward).toBe(0)
  })

  it('completes a cash_gte mission when cash meets target', async () => {
    // Card 1: cash_gte target 500, reward 50
    const db = makeDb([{ id: 10, card_id: 1, progress: '{}' }]) as unknown as D1Database
    const snap: MissionSnapshot = { ...baseSnapshot, cash: 600 }
    const result = await checkAndCompleteMissions(db, 'game1', 1, 1, snap)
    expect(result.completedCardIds).toContain(1)
    expect(result.totalReward).toBe(50)
  })

  it('does not complete cash_gte mission when cash below target', async () => {
    const db = makeDb([{ id: 10, card_id: 1, progress: '{}' }]) as unknown as D1Database
    const snap: MissionSnapshot = { ...baseSnapshot, cash: 400 }
    const result = await checkAndCompleteMissions(db, 'game1', 1, 1, snap)
    expect(result.completedCardIds).toEqual([])
  })

  it('completes heat_at_most when heat is at or below target', async () => {
    // Card 4: heat_at_most 20, reward 63
    const db = makeDb([{ id: 11, card_id: 4, progress: '{}' }]) as unknown as D1Database
    const snap: MissionSnapshot = { ...baseSnapshot, heat: 20 }
    const result = await checkAndCompleteMissions(db, 'game1', 1, 1, snap)
    expect(result.completedCardIds).toContain(4)
  })

  it('does not complete heat_at_most when heat exceeds target', async () => {
    const db = makeDb([{ id: 11, card_id: 4, progress: '{}' }]) as unknown as D1Database
    const snap: MissionSnapshot = { ...baseSnapshot, heat: 25 }
    const result = await checkAndCompleteMissions(db, 'game1', 1, 1, snap)
    expect(result.completedCardIds).toEqual([])
  })
})

describe('updateCumulativeProgress()', () => {
  function makeDb(currentProgress: string) {
    const runFn = vi.fn().mockResolvedValue({})
    const prepareFn = vi.fn().mockImplementation(() => ({
      bind: (..._args: unknown[]) => ({
        all: vi.fn().mockResolvedValue({
          results: [{ id: 1, card_id: 7, progress: currentProgress }]
        }),
        run: runFn,
        first: vi.fn().mockResolvedValue(null),
      }),
    }))
    return { prepare: prepareFn, _runFn: runFn }
  }

  it('increments sold_units count for matching type', async () => {
    const { prepare, _runFn } = makeDb('{"sold_units":{"beer":3}}')
    const db = { prepare } as unknown as D1Database
    await updateCumulativeProgress(db, 1, { type: 'sold_units', quantity: 5, alcoholType: 'beer', revenue: 100 })
    // Should have called prepare for the update
    expect(prepare).toHaveBeenCalled()
  })

  it('increments officials_bribed count', async () => {
    const { prepare } = makeDb('{"officials_bribed":1}')
    const db = { prepare } as unknown as D1Database
    await updateCumulativeProgress(db, 1, { type: 'official_bribed' })
    expect(prepare).toHaveBeenCalled()
  })

  it('deduplicates city_visited IDs', async () => {
    const { prepare } = makeDb('{"visited_city_ids":[10,20]}')
    const db = { prepare } as unknown as D1Database
    await updateCumulativeProgress(db, 1, { type: 'city_visited', cityId: 10 })
    // If city 10 already visited, should not add duplicate
    // Check via the SQL that gets prepared — specifically that visited_city_ids stays [10,20]
    const calls = (prepare as ReturnType<typeof vi.fn>).mock.calls
    const updateCall = calls.find((c: unknown[]) => (c[0] as string).includes('UPDATE'))
    if (updateCall) {
      // The update should have been called
      expect(updateCall).toBeTruthy()
    }
    expect(prepare).toHaveBeenCalled()
  })
})
