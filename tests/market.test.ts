import { describe, it, expect } from 'vitest'
import {
  ALCOHOL_BASE_VALUES,
  YEAR_EVENTS,
  calculateCityPrice,
  applySellModifier,
  applyCompetitionPenalty,
  rollYearEvent,
  applyYearEvent,
  generateVolatilityIndex,
  type MarketPrice,
  type YearEvent
} from '../src/game/market'

describe('ALCOHOL_BASE_VALUES', () => {
  it('defines moonshine, vodka, rum, bourbon, gin', () => {
    expect(ALCOHOL_BASE_VALUES.moonshine).toBeDefined()
    expect(ALCOHOL_BASE_VALUES.vodka).toBeDefined()
    expect(ALCOHOL_BASE_VALUES.rum).toBeDefined()
    expect(ALCOHOL_BASE_VALUES.bourbon).toBeDefined()
    expect(ALCOHOL_BASE_VALUES.gin).toBeDefined()
  })

  it('moonshine is cheapest, bourbon/gin are most expensive', () => {
    const vals = ALCOHOL_BASE_VALUES
    expect(vals.moonshine).toBeLessThan(vals.vodka)
    expect(vals.vodka).toBeLessThanOrEqual(vals.rum)
    expect(vals.bourbon).toBeGreaterThanOrEqual(vals.rum)
    expect(vals.gin).toBeGreaterThanOrEqual(vals.rum)
  })
})

describe('YEAR_EVENTS', () => {
  it('defines at least 8 distinct events', () => {
    expect(YEAR_EVENTS.length).toBeGreaterThanOrEqual(8)
  })

  it('each event has id, name, description, and at least one effect', () => {
    for (const event of YEAR_EVENTS) {
      expect(event.id).toBeTruthy()
      expect(event.name).toBeTruthy()
      expect(event.description).toBeTruthy()
      // must have at least one numeric effect
      const hasEffect = event.priceMultiplier !== undefined || event.heatDelta !== undefined || event.productionBonus !== undefined
      expect(hasEffect).toBe(true)
    }
  })
})

describe('calculateCityPrice()', () => {
  it('multiplies base price by distance and demand index', () => {
    // basePrice=10, distance=2, demandIndex=1.5 → 30
    expect(calculateCityPrice(10, 2, 1.5)).toBeCloseTo(30)
  })

  it('returns base price when distance=1 and demandIndex=1.0', () => {
    expect(calculateCityPrice(20, 1, 1.0)).toBeCloseTo(20)
  })

  it('floors the result', () => {
    // 10 * 1.5 * 1.3 = 19.5 → 19
    expect(calculateCityPrice(10, 1.5, 1.3)).toBe(19)
  })
})

describe('applySellModifier()', () => {
  it('returns base price for neutral character', () => {
    expect(applySellModifier(100, 'bootlegger', 'bourbon')).toBe(100)
  })

  it('applies Socialite +25% sell bonus', () => {
    expect(applySellModifier(100, 'socialite', 'bourbon')).toBeCloseTo(125)
  })

  it('applies Pharmacist 1.5× for medicinal spirits (moonshine)', () => {
    expect(applySellModifier(100, 'pharmacist', 'moonshine')).toBeCloseTo(150)
  })

  it('applies only generic sellPriceMultiplier for Pharmacist on non-moonshine', () => {
    // pharmacist has medicinal=1.5 for moonshine, but standard 1.0 sellPriceMultiplier for others
    expect(applySellModifier(100, 'pharmacist', 'bourbon')).toBeCloseTo(100)
  })
})

describe('applyCompetitionPenalty()', () => {
  it('returns price unchanged when only 1 player present', () => {
    expect(applyCompetitionPenalty(100, 1)).toBe(100)
  })

  it('drops price 50% when >1 player vehicles present', () => {
    expect(applyCompetitionPenalty(100, 2)).toBe(50)
    expect(applyCompetitionPenalty(200, 3)).toBe(100)
  })
})

describe('rollYearEvent()', () => {
  it('returns a valid year event', () => {
    const event = rollYearEvent()
    const ids = YEAR_EVENTS.map(e => e.id)
    expect(ids).toContain(event.id)
  })
})

describe('applyYearEvent()', () => {
  it('scales prices when event has priceMultiplier', () => {
    const event: YearEvent = { id: 'test', name: 'Test', description: 'x', priceMultiplier: 0.7 }
    expect(applyYearEvent(100, event)).toBe(70)
  })

  it('returns price unchanged when no priceMultiplier', () => {
    const event: YearEvent = { id: 'test', name: 'Test', description: 'x', heatDelta: 10 }
    expect(applyYearEvent(100, event)).toBe(100)
  })
})

describe('generateVolatilityIndex()', () => {
  it('returns a value between 0.7 and 1.3', () => {
    for (let i = 0; i < 20; i++) {
      const v = generateVolatilityIndex()
      expect(v).toBeGreaterThanOrEqual(0.7)
      expect(v).toBeLessThanOrEqual(1.3)
    }
  })
})
