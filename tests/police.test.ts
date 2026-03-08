import { describe, it, expect } from 'vitest'
import {
  calculateHeatIncrease,
  calculateHeatDecay,
  rollPoliceEncounter,
  resolveSubmit,
  resolveBribe,
  resolveRun,
  calculateSpotBribeCost,
  calculateLongTermBribeCost,
  type EncounterContext,
  HEAT_CHANGES
} from '../src/game/police'

describe('HEAT_CHANGES', () => {
  it('defines all heat change constants', () => {
    expect(HEAT_CHANGES.cargoTravel).toBeGreaterThan(0)
    expect(HEAT_CHANGES.doubleCrossSuccess).toBeGreaterThan(0)
    expect(HEAT_CHANGES.doubleCrossFail).toBeGreaterThan(HEAT_CHANGES.doubleCrossSuccess)
    expect(HEAT_CHANGES.hostileTakeover).toBeGreaterThan(0)
    expect(HEAT_CHANGES.idleDecay).toBeLessThan(0)
    expect(HEAT_CHANGES.moneyLaunder).toBeLessThan(0)
    expect(HEAT_CHANGES.runFail).toBeGreaterThan(0)
  })
})

describe('calculateHeatIncrease()', () => {
  it('returns cargoTravel delta when moving with cargo', () => {
    const delta = calculateHeatIncrease('cargo_travel', 'bootlegger')
    expect(delta).toBe(HEAT_CHANGES.cargoTravel)
  })

  it('applies Priest/Nun heat reduction', () => {
    const base = calculateHeatIncrease('cargo_travel', 'bootlegger')
    const reduced = calculateHeatIncrease('cargo_travel', 'priest_nun')
    expect(reduced).toBeLessThan(base)
  })

  it('clamps result between 0 and 100', () => {
    const delta = calculateHeatIncrease('hostile_takeover', 'bootlegger')
    expect(delta).toBeGreaterThanOrEqual(0)
    expect(delta).toBeLessThanOrEqual(100)
  })
})

describe('calculateHeatDecay()', () => {
  it('returns idle decay for standard character', () => {
    const decay = calculateHeatDecay('bootlegger', false)
    expect(decay).toBe(Math.abs(HEAT_CHANGES.idleDecay))
  })

  it('doubles decay for Priest/Nun', () => {
    const standard = calculateHeatDecay('bootlegger', false)
    const fast = calculateHeatDecay('priest_nun', false)
    expect(fast).toBeGreaterThan(standard)
  })

  it('applies money launder bonus when laundering', () => {
    const normal = calculateHeatDecay('bootlegger', false)
    const laundered = calculateHeatDecay('bootlegger', true)
    expect(laundered).toBeGreaterThan(normal)
  })
})

describe('rollPoliceEncounter()', () => {
  it('returns true (encounter) when heat > 75', () => {
    // With heat = 100 the threshold is always exceeded
    let encounters = 0
    for (let i = 0; i < 20; i++) {
      if (rollPoliceEncounter(100)) encounters++
    }
    expect(encounters).toBe(20)
  })

  it('returns false (no encounter) when heat = 0', () => {
    for (let i = 0; i < 20; i++) {
      expect(rollPoliceEncounter(0)).toBe(false)
    }
  })
})

describe('resolveSubmit()', () => {
  it('no penalty when heat is low (<30)', () => {
    const result = resolveSubmit(20, 50, 10)
    expect(result.alcoholSeized).toBe(0)
    expect(result.cashSeized).toBe(0)
  })

  it('seizes all alcohol and 50% cash when heat is high (>=50)', () => {
    const result = resolveSubmit(80, 50, 200)
    expect(result.alcoholSeized).toBe(50)
    expect(result.cashSeized).toBe(100)
  })
})

describe('resolveBribe()', () => {
  it('returns the bribe cost as cash paid', () => {
    const result = resolveBribe(200)
    expect(result.cashPaid).toBe(200)
    expect(result.cleared).toBe(true)
  })
})

describe('resolveRun()', () => {
  it('escapes when roll > 8', () => {
    const result = resolveRun(9)
    expect(result.escaped).toBe(true)
    expect(result.jailSeasons).toBe(0)
  })

  it('goes to jail for 2 seasons when roll <= 8', () => {
    const result = resolveRun(6)
    expect(result.escaped).toBe(false)
    expect(result.jailSeasons).toBe(2)
  })
})

describe('calculateSpotBribeCost()', () => {
  it('returns a positive cost scaling with heat', () => {
    const low = calculateSpotBribeCost(20, 'small')
    const high = calculateSpotBribeCost(80, 'major')
    expect(high).toBeGreaterThan(low)
    expect(low).toBeGreaterThan(0)
  })
})

describe('calculateLongTermBribeCost()', () => {
  it('returns cost > spot bribe cost', () => {
    const spot = calculateSpotBribeCost(50, 'large')
    const longTerm = calculateLongTermBribeCost('large')
    expect(longTerm).toBeGreaterThan(spot)
  })

  it('scales with population tier', () => {
    const small = calculateLongTermBribeCost('small')
    const major = calculateLongTermBribeCost('major')
    expect(major).toBeGreaterThan(small)
  })
})
