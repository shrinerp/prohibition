import { describe, it, expect } from 'vitest'
import {
  DISTILLERY_TIERS,
  getBaseOutput,
  calculateSeasonalOutput,
  getUpgradeCost,
  getSellPrice,
  canAddStill,
  type Distillery
} from '../src/game/production'

describe('DISTILLERY_TIERS', () => {
  it('defines 5 tiers', () => {
    expect(Object.keys(DISTILLERY_TIERS)).toHaveLength(5)
  })

  it('each tier has name, baseOutput, heatPerSeason, cost', () => {
    for (const tier of Object.values(DISTILLERY_TIERS)) {
      expect(tier.name).toBeTruthy()
      expect(tier.baseOutput).toBeGreaterThan(0)
      expect(tier.heatPerSeason).toBeGreaterThanOrEqual(0)
      expect(tier.cost).toBeGreaterThan(0)
    }
  })

  it('higher tiers produce more than lower tiers', () => {
    expect(DISTILLERY_TIERS[2].baseOutput).toBeGreaterThan(DISTILLERY_TIERS[1].baseOutput)
    expect(DISTILLERY_TIERS[5].baseOutput).toBeGreaterThan(DISTILLERY_TIERS[3].baseOutput)
  })

  it('higher tiers cost more than lower tiers', () => {
    expect(DISTILLERY_TIERS[2].cost).toBeGreaterThan(DISTILLERY_TIERS[1].cost)
    expect(DISTILLERY_TIERS[5].cost).toBeGreaterThan(DISTILLERY_TIERS[3].cost)
  })

  it('higher tiers generate more passive heat', () => {
    expect(DISTILLERY_TIERS[3].heatPerSeason).toBeGreaterThanOrEqual(DISTILLERY_TIERS[1].heatPerSeason)
    expect(DISTILLERY_TIERS[5].heatPerSeason).toBeGreaterThan(DISTILLERY_TIERS[2].heatPerSeason)
  })
})

describe('getBaseOutput()', () => {
  it('returns the output for the given tier', () => {
    expect(getBaseOutput(1)).toBe(DISTILLERY_TIERS[1].baseOutput)
    expect(getBaseOutput(3)).toBe(DISTILLERY_TIERS[3].baseOutput)
  })

  it('returns 0 for unknown tier', () => {
    expect(getBaseOutput(99)).toBe(0)
  })
})

describe('getUpgradeCost()', () => {
  it('returns cost of the target tier', () => {
    expect(getUpgradeCost(2, 'bootlegger')).toBe(DISTILLERY_TIERS[2].cost)
  })

  it('applies Hillbilly -20% discount', () => {
    const base = DISTILLERY_TIERS[2].cost
    expect(getUpgradeCost(2, 'hillbilly')).toBe(Math.floor(base * 0.8))
  })

  it('returns 0 for tier 5 (max)', () => {
    expect(getUpgradeCost(6, 'bootlegger')).toBe(0)
  })
})

describe('getSellPrice()', () => {
  it('returns 50% of purchase price', () => {
    expect(getSellPrice(200)).toBe(100)
    expect(getSellPrice(300)).toBe(150)
  })
})

describe('canAddStill()', () => {
  it('returns true when player has fewer than 3 stills', () => {
    const stills: Distillery[] = [
      { id: 1, playerId: 1, cityId: 10, tier: 1, stillNumber: 1, purchasePrice: 100 }
    ]
    expect(canAddStill(stills)).toBe(true)
  })

  it('returns false when player already has 3 stills', () => {
    const stills: Distillery[] = [
      { id: 1, playerId: 1, cityId: 10, tier: 1, stillNumber: 1, purchasePrice: 100 },
      { id: 2, playerId: 1, cityId: 10, tier: 1, stillNumber: 2, purchasePrice: 100 },
      { id: 3, playerId: 1, cityId: 10, tier: 1, stillNumber: 3, purchasePrice: 100 }
    ]
    expect(canAddStill(stills)).toBe(false)
  })
})

describe('calculateSeasonalOutput()', () => {
  const baseStill: Distillery = {
    id: 1, playerId: 1, cityId: 10, tier: 1, stillNumber: 1, purchasePrice: 100
  }

  it('returns base output for a tier-1 still with neutral character', () => {
    const output = calculateSeasonalOutput([baseStill], 'bootlegger', false)
    expect(output).toBe(DISTILLERY_TIERS[1].baseOutput)
  })

  it('sums output across multiple stills', () => {
    const stills: Distillery[] = [
      { ...baseStill, stillNumber: 1 },
      { ...baseStill, id: 2, stillNumber: 2, tier: 2 }
    ]
    const expected = DISTILLERY_TIERS[1].baseOutput + DISTILLERY_TIERS[2].baseOutput
    expect(calculateSeasonalOutput(stills, 'bootlegger', false)).toBe(expected)
  })

  it('applies Vixen -10% production penalty', () => {
    const base = DISTILLERY_TIERS[1].baseOutput
    const output = calculateSeasonalOutput([baseStill], 'vixen', false)
    expect(output).toBe(Math.floor(base * 0.9))
  })

  it('applies Rum-Runner coastal double volume', () => {
    const base = DISTILLERY_TIERS[1].baseOutput
    const output = calculateSeasonalOutput([baseStill], 'rum_runner', true)
    expect(output).toBe(Math.floor(base * 2.0))
  })

  it('returns 0 for empty stills array', () => {
    expect(calculateSeasonalOutput([], 'bootlegger', false)).toBe(0)
  })
})
