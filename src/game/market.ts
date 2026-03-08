import { getCharacter, applySellPriceModifier } from './characters'

export interface MarketPrice {
  cityId: number
  alcoholType: string
  price: number
  demandIndex: number
}

export interface YearEvent {
  id: string
  name: string
  description: string
  priceMultiplier?: number   // multiply all city prices (e.g. 0.7 = Great Depression)
  heatDelta?: number         // flat heat added citywide (e.g. 20 = Police Crackdown)
  productionBonus?: number   // flat production units bonus per still
}

/** Base sell value per alcohol type (in dollars per unit) */
export const ALCOHOL_BASE_VALUES: Record<string, number> = {
  moonshine: 10,
  vodka:     18,
  rum:       20,
  bourbon:   30,
  gin:       30
}

/** Historical event cards drawn at season 1 of each year */
export const YEAR_EVENTS: YearEvent[] = [
  {
    id: 'great_depression',
    name: 'The Great Depression',
    description: 'Economic collapse — all city alcohol prices drop 30%.',
    priceMultiplier: 0.7
  },
  {
    id: 'police_crackdown',
    name: 'Police Crackdown',
    description: 'Authorities intensify raids — +20 Heat in every city.',
    heatDelta: 20
  },
  {
    id: 'border_closure',
    name: 'Border Closure',
    description: 'Import routes disrupted — prices for imported spirits rise 25%.',
    priceMultiplier: 1.25
  },
  {
    id: 'repeal_rumor',
    name: 'Repeal Rumor',
    description: 'Whispers of Prohibition ending — demand surges, prices +20%.',
    priceMultiplier: 1.2
  },
  {
    id: 'treasury_raid',
    name: 'Treasury Raid',
    description: 'Federal agents raid major suppliers — +15 Heat everywhere.',
    heatDelta: 15
  },
  {
    id: 'bumper_harvest',
    name: 'Bumper Harvest',
    description: 'Grain surplus floods the market — prices drop 15%.',
    priceMultiplier: 0.85
  },
  {
    id: 'speakeasy_boom',
    name: 'Speakeasy Boom',
    description: 'Underground bars proliferate — demand spikes, prices +30%.',
    priceMultiplier: 1.3
  },
  {
    id: 'labor_strike',
    name: 'Labor Strike',
    description: 'Transport workers walk out — production halted, +4 units per still.',
    productionBonus: 4
  },
  {
    id: 'women_temperance',
    name: "Women's Temperance March",
    description: 'Public pressure rises — +25 Heat citywide.',
    heatDelta: 25
  },
  {
    id: 'mild_winter',
    name: 'Mild Winter',
    description: 'Easy travel conditions — no effect this year.',
    priceMultiplier: 1.0
  }
]

/**
 * Calculate the sale price for alcohol in a city.
 * Formula: basePrice × distance × demandIndex, floored.
 */
export function calculateCityPrice(
  basePrice: number,
  distance: number,
  demandIndex: number
): number {
  return Math.floor(basePrice * distance * demandIndex)
}

/**
 * Apply character sell modifiers to a city price.
 * - Pharmacist: 1.5× when selling moonshine ("Medicinal Spirits")
 * - Socialite: 1.15× on any type
 */
export function applySellModifier(
  price: number,
  characterClass: string,
  alcoholType: string
): number {
  const char = getCharacter(characterClass)
  if (!char) return price

  // Pharmacist sells moonshine as Medicinal Spirits at medicinalPriceMultiplier
  if (characterClass === 'pharmacist' && alcoholType === 'moonshine') {
    return Math.floor(price * char.modifiers.medicinalPriceMultiplier)
  }

  return Math.round(applySellPriceModifier(characterClass, price))
}

/**
 * If more than 1 player vehicle is present in the city, prices drop 50%.
 */
export function applyCompetitionPenalty(price: number, playerCount: number): number {
  if (playerCount > 1) return Math.floor(price * 0.5)
  return price
}

/** Draw a random year event card */
export function rollYearEvent(): YearEvent {
  return YEAR_EVENTS[Math.floor(Math.random() * YEAR_EVENTS.length)]
}

/**
 * Apply a year event's price multiplier to a base price.
 * Returns price unchanged if the event has no priceMultiplier.
 */
export function applyYearEvent(price: number, event: YearEvent): number {
  if (event.priceMultiplier === undefined) return price
  return Math.floor(price * event.priceMultiplier)
}

/**
 * Generate a Global Volatility Index for the year: a random float in [0.7, 1.3].
 */
export function generateVolatilityIndex(): number {
  return 0.7 + Math.random() * 0.6
}
