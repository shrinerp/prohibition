import { applyTakeoverCostModifier } from './characters'

export type PopulationTier = 'small' | 'medium' | 'large' | 'major'

export interface OwnedCity {
  cityId: number
  populationTier: PopulationTier
  isCoastal: boolean
  marketValue: number   // current city market price (base for tax calculations)
  ownerId: number | null
}

/** Base city buy prices by population tier */
const BASE_BUY_PRICE: Record<PopulationTier, number> = {
  small:  500,
  medium: 1000,
  large:  2500,
  major:  6000
}

/** Protection tax rate as a fraction of market value */
const PROTECTION_TAX_RATE = 0.1

/** Takeover premium multiplier over the neutral buy price */
const TAKEOVER_PREMIUM = 1.5

/** Cities with population tier >= 'large' count as '>50k' for Jazz Singer income */
const JAZZ_INCOME_TIERS = new Set<PopulationTier>(['large', 'major'])
const JAZZ_INCOME_AMOUNT: Record<PopulationTier, number> = {
  small:  0,
  medium: 0,
  large:  50,
  major:  100
}

/**
 * Price to purchase a neutral city outright.
 */
export function calculateBuyPrice(city: OwnedCity): number {
  return BASE_BUY_PRICE[city.populationTier]
}

/**
 * Price to perform a Hostile Takeover of a rival-owned city.
 * = buyPrice × TAKEOVER_PREMIUM × characterTakeoverCostMultiplier
 */
export function calculateTakeoverPrice(city: OwnedCity, characterClass: string): number {
  const base = calculateBuyPrice(city) * TAKEOVER_PREMIUM
  return Math.floor(applyTakeoverCostModifier(characterClass, base))
}

/**
 * Protection Tax collected per owned city per season.
 * Based on PROTECTION_TAX_RATE × marketValue.
 * Jailed owners collect at 50% penalty.
 */
export function calculateProtectionTax(city: OwnedCity, ownerInJail: boolean): number {
  const full = Math.floor(city.marketValue * PROTECTION_TAX_RATE)
  return ownerInJail ? Math.floor(full * 0.5) : full
}

/**
 * Passive income for Jazz Singer in cities with population > 50k.
 * Returns 0 for all other characters, or small/medium cities.
 */
export function calculateJazzPassiveIncome(characterClass: string, city: OwnedCity): number {
  if (characterClass !== 'jazz_singer') return 0
  if (!JAZZ_INCOME_TIERS.has(city.populationTier)) return 0
  return JAZZ_INCOME_AMOUNT[city.populationTier]
}

/**
 * True when the player has enough cash for the purchase.
 */
export function canAffordPurchase(playerCash: number, price: number): boolean {
  return playerCash >= price
}
