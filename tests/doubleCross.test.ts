import { describe, it, expect } from 'vitest'
import {
  calculateSuccessRate,
  resolveDoubleCross,
  type DoubleCrossTarget
} from '../src/game/doubleCross'

const neutralTarget: DoubleCrossTarget = {
  cash: 1000,
  alcoholUnits: 20,
  characterClass: 'bootlegger',
  isInJail: false,
  cityTier: 'small'
}

describe('calculateSuccessRate()', () => {
  it('base success rate is 50%', () => {
    expect(calculateSuccessRate('bootlegger', 'small')).toBeCloseTo(0.5)
  })

  it('Gangster gets same rate as any other class (bonus removed)', () => {
    const base = calculateSuccessRate('bootlegger', 'small')
    const gangster = calculateSuccessRate('gangster', 'small')
    expect(gangster).toBeCloseTo(base)
  })

  it('Union Leader gets same rate in large city (bonus removed)', () => {
    const base = calculateSuccessRate('bootlegger', 'large')
    const ul = calculateSuccessRate('union_leader', 'large')
    expect(ul).toBeCloseTo(base)
  })

  it('Union Leader rate is same in small city', () => {
    const base = calculateSuccessRate('bootlegger', 'small')
    const ul = calculateSuccessRate('union_leader', 'small')
    expect(ul).toBeCloseTo(base)
  })

  it('success rate is capped at 1.0', () => {
    // Even with large bonus, should not exceed 1.0
    const rate = calculateSuccessRate('gangster', 'large')
    expect(rate).toBeLessThanOrEqual(1.0)
  })
})

describe('resolveDoubleCross()', () => {
  it('returns failure when target is in jail', () => {
    const result = resolveDoubleCross('bootlegger', { ...neutralTarget, isInJail: true }, true)
    expect(result.allowed).toBe(false)
  })

  it('on success: aggressor gains 20% cash and 50% alcohol', () => {
    const result = resolveDoubleCross('bootlegger', neutralTarget, true)
    expect(result.aggressorCashGain).toBe(200)   // 20% of 1000
    expect(result.aggressorAlcoholGain).toBe(10)  // 50% of 20
    expect(result.heatDelta).toBe(10)             // success penalty
  })

  it('on failure: victim gains 20% aggressor cash and 50% aggressor alcohol', () => {
    const aggressor = { cash: 500, alcoholUnits: 10 }
    const result = resolveDoubleCross('bootlegger', neutralTarget, false)
    // failure means aggressor LOSES — these are negative for aggressor
    expect(result.aggressorCashGain).toBeLessThan(0)
    expect(result.aggressorAlcoholGain).toBeLessThan(0)
    expect(result.heatDelta).toBe(20)  // failure heat penalty
  })

  it('Jazz Singer victim loses same cash as any other class (no special multiplier)', () => {
    const jazzTarget = { ...neutralTarget, characterClass: 'jazz_singer' }
    const normalResult = resolveDoubleCross('bootlegger', neutralTarget, true)
    const jazzResult = resolveDoubleCross('bootlegger', jazzTarget, true)
    expect(Math.abs(jazzResult.victimCashLoss)).toBe(Math.abs(normalResult.victimCashLoss))
  })
})
