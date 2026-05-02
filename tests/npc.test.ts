import { describe, it, expect } from 'vitest'
import {
  NPC_PRIORITY,
  applyWealthDecay,
  selectNpcAction,
  computeNpcTakeoverCost,
  type NpcState,
  type NpcAction
} from '../src/game/npc'

const baseNpc: NpcState = {
  playerId: 99,
  characterClass: 'gangster',
  cash: 1000,
  alcoholUnits: 5,
  distilleryTier: 1,
  stillCount: 1,
  ownedCityIds: [],
  currentCityId: 1,
  isInJail: false,
  heat: 20,
  season: 1
}

describe('NPC_PRIORITY', () => {
  it('defines the 4-step priority list in order', () => {
    expect(NPC_PRIORITY).toEqual(['upgrade', 'buy_city', 'double_cross', 'sell'])
  })
})

describe('applyWealthDecay()', () => {
  it('reduces cash by 30% every 4 seasons', () => {
    const decayed = applyWealthDecay({ ...baseNpc, season: 4 })
    expect(decayed.cash).toBe(700) // 1000 * 0.7
  })

  it('does NOT decay on non-multiples of 4', () => {
    const unchanged = applyWealthDecay({ ...baseNpc, season: 3 })
    expect(unchanged.cash).toBe(1000)
  })

  it('does NOT decay on season 0 (edge case)', () => {
    const unchanged = applyWealthDecay({ ...baseNpc, season: 0 })
    expect(unchanged.cash).toBe(1000)
  })
})

describe('selectNpcAction()', () => {
  it('returns "upgrade" when can afford upgrade and tier < 5', () => {
    const npc: NpcState = { ...baseNpc, cash: 5000, distilleryTier: 1 }
    const action = selectNpcAction(npc, true, false)
    expect(action).toBe('upgrade')
  })

  it('returns "buy_city" when cannot upgrade but neutral city is nearby and affordable', () => {
    // low tier (already max), no upgrade available → buy
    const npc: NpcState = { ...baseNpc, cash: 2000, distilleryTier: 5 }
    const action = selectNpcAction(npc, false, true)
    expect(action).toBe('buy_city')
  })

  it('returns "double_cross" when no upgrade/buy available but intercept possible', () => {
    const npc: NpcState = { ...baseNpc, cash: 100, distilleryTier: 5 }
    const action = selectNpcAction(npc, false, false, true)
    expect(action).toBe('double_cross')
  })

  it('returns "sell" as fallback', () => {
    const npc: NpcState = { ...baseNpc, cash: 0, distilleryTier: 5 }
    const action = selectNpcAction(npc, false, false, false)
    expect(action).toBe('sell')
  })

  it('returns "sell" when in jail', () => {
    const npc: NpcState = { ...baseNpc, isInJail: true }
    const action = selectNpcAction(npc, true, true, true)
    expect(action).toBe('sell')
  })
})

describe('computeNpcTakeoverCost()', () => {
  it('neutral city at tier 1 costs base claim price', () => {
    // medium = $1000, tier 1 = no upgrade premium
    expect(computeNpcTakeoverCost(0, 'medium', 1, true)).toBe(1000)
  })

  it('owned city at tier 1 costs 2× the stored cost', () => {
    // stored claim_cost = 1000 → 2 × 1000 = $2000
    expect(computeNpcTakeoverCost(1000, 'medium', 1, false)).toBe(2000)
  })

  it('owned city at tier 3 adds upgrade premium for tiers 2 and 3', () => {
    // stored = 1000, 2× = 2000; tier2 cost=500, tier3 cost=1000 → total 3500
    expect(computeNpcTakeoverCost(1000, 'medium', 3, false)).toBe(3500)
  })

  it('uses BASE_CLAIM when claim_cost is 0 (neutral city)', () => {
    // small BASE_CLAIM = 500, neutral → 500
    expect(computeNpcTakeoverCost(0, 'small', 1, true)).toBe(500)
  })

  it('owned city uses stored claim_cost (ignores BASE_CLAIM)', () => {
    // claim_cost = 1500, neutral=false → 2 × 1500 = 3000
    expect(computeNpcTakeoverCost(1500, 'large', 1, false)).toBe(3000)
  })
})
