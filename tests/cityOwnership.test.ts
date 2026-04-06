import { describe, it, expect } from 'vitest'
import {
  calculateBuyPrice,
  calculateTakeoverPrice,
  calculateProtectionTax,
  calculateJazzPassiveIncome,
  canAffordPurchase,
  type OwnedCity
} from '../src/game/cityOwnership'

const smallCity: OwnedCity = {
  cityId: 1,
  populationTier: 'small',
  isCoastal: false,
  marketValue: 100,
  ownerId: null
}

const majorCoastalCity: OwnedCity = {
  cityId: 2,
  populationTier: 'major',
  isCoastal: true,
  marketValue: 500,
  ownerId: null
}

describe('calculateBuyPrice()', () => {
  it('returns base price for neutral small city', () => {
    const price = calculateBuyPrice(smallCity)
    expect(price).toBeGreaterThan(0)
  })

  it('major cities cost more than small cities', () => {
    expect(calculateBuyPrice(majorCoastalCity)).toBeGreaterThan(calculateBuyPrice(smallCity))
  })
})

describe('calculateTakeoverPrice()', () => {
  it('costs more than neutral buy price', () => {
    const buy = calculateBuyPrice(smallCity)
    const takeover = calculateTakeoverPrice(smallCity, 'bootlegger')
    expect(takeover).toBeGreaterThan(buy)
  })

  it('applies Pharmacist +25% takeover cost', () => {
    const base = calculateTakeoverPrice(smallCity, 'bootlegger')
    const pharma = calculateTakeoverPrice(smallCity, 'pharmacist')
    expect(pharma).toBeGreaterThanOrEqual(Math.floor(base * 1.25))
    expect(pharma).toBeLessThanOrEqual(Math.ceil(base * 1.25))
  })
})

describe('calculateProtectionTax()', () => {
  it('returns positive income per city', () => {
    const tax = calculateProtectionTax(smallCity, false)
    expect(tax).toBeGreaterThan(0)
  })

  it('returns 50% penalty when in jail', () => {
    const full = calculateProtectionTax(smallCity, false)
    const jailed = calculateProtectionTax(smallCity, true)
    expect(jailed).toBe(Math.floor(full * 0.5))
  })

  it('major city generates more tax than small city', () => {
    expect(calculateProtectionTax(majorCoastalCity, false)).toBeGreaterThan(
      calculateProtectionTax(smallCity, false)
    )
  })
})

describe('calculateJazzPassiveIncome()', () => {
  it('returns positive income for jazz singer in major city', () => {
    const income = calculateJazzPassiveIncome('jazz_singer', majorCoastalCity)
    expect(income).toBeGreaterThan(0)
  })

  it('returns 0 for non-jazz characters', () => {
    expect(calculateJazzPassiveIncome('bootlegger', majorCoastalCity)).toBe(0)
  })

  it('returns 0 for jazz singer in small city', () => {
    expect(calculateJazzPassiveIncome('jazz_singer', smallCity)).toBe(0)
  })
})

describe('canAffordPurchase()', () => {
  it('returns true when cash >= price', () => {
    expect(canAffordPurchase(500, 400)).toBe(true)
  })

  it('returns false when cash < price', () => {
    expect(canAffordPurchase(200, 400)).toBe(false)
  })
})
