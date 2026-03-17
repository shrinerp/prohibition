import { applyHeatModifier, getCharacter } from './characters'
import { rollDice } from './movement'

export type HeatEvent =
  | 'cargo_travel'
  | 'double_cross_success'
  | 'double_cross_fail'
  | 'hostile_takeover'
  | 'run_fail'

export type PopulationTier = 'small' | 'medium' | 'large' | 'major'

export interface EncounterContext {
  currentHeat: number
  alcoholUnits: number
  cashOnHand: number
}

export interface SubmitResult {
  alcoholSeized: number
  cashSeized: number
  heatDelta: number
}

export interface RunResult {
  escaped: boolean
  jailSeasons: number
  heatDelta: number
}

export interface BribeResult {
  cashPaid: number
  cleared: boolean
}

/** Canonical heat deltas for each event */
export const HEAT_CHANGES = {
  cargoTravel:        1,
  doubleCrossSuccess: 8,
  doubleCrossFail:    15,
  hostileTakeover:    10,
  runFail:            25,
  naturalDecay:       -3,   // automatic per season
  idleDecay:          -5,   // per idle season
  moneyLaunder:       -25   // Social Club money laundering
} as const

/** Heat added per distillery tier per season */
export const TIER_PASSIVE_HEAT: Record<number, number> = { 1: 0, 2: 1, 3: 1, 4: 2, 5: 4 }

/** Bribe multiplier by city size */
const TIER_BRIBE_MULTIPLIER: Record<PopulationTier, number> = {
  small:  1.0,
  medium: 1.5,
  large:  2.5,
  major:  4.0
}

/**
 * Delta to add to heat for a specific event.
 * Applies character heat multiplier (Priest/Nun −25%).
 */
export function calculateHeatIncrease(event: HeatEvent, characterClass: string): number {
  const base: Record<HeatEvent, number> = {
    cargo_travel:         HEAT_CHANGES.cargoTravel,
    double_cross_success: HEAT_CHANGES.doubleCrossSuccess,
    double_cross_fail:    HEAT_CHANGES.doubleCrossFail,
    hostile_takeover:     HEAT_CHANGES.hostileTakeover,
    run_fail:             HEAT_CHANGES.runFail
  }
  const raw = applyHeatModifier(characterClass, base[event])
  return Math.min(100, Math.max(0, raw))
}

/**
 * Heat lost per season.
 * Priest/Nun decay 2×; money laundering adds an extra 25-point drop.
 */
export function calculateHeatDecay(characterClass: string, laundering: boolean): number {
  const char = getCharacter(characterClass)
  const decayMultiplier = char?.modifiers.heatDecayMultiplier ?? 1.0
  let decay = Math.abs(HEAT_CHANGES.idleDecay) * decayMultiplier
  if (laundering) decay += Math.abs(HEAT_CHANGES.moneyLaunder)
  return Math.floor(decay)
}

/**
 * Returns true if a police encounter occurs.
 * Formula: Random(0,100) < currentHeat
 */
export function rollPoliceEncounter(currentHeat: number): boolean {
  return Math.random() * 100 < currentHeat
}

/**
 * Resolve a Submit choice.
 * Low heat (<30): nothing found.
 * High heat (>=50): seize all alcohol + 50% cash.
 * Mid heat (30-49): seize half alcohol, no cash.
 */
export function resolveSubmit(currentHeat: number, alcoholUnits: number, cashOnHand: number): SubmitResult {
  if (currentHeat < 30) {
    return { alcoholSeized: 0, cashSeized: 0, heatDelta: -5 }
  }
  if (currentHeat >= 50) {
    return {
      alcoholSeized: alcoholUnits,
      cashSeized:    alcoholUnits > 0 ? Math.floor(cashOnHand * 0.5) : 0,
      heatDelta:     -10
    }
  }
  return { alcoholSeized: Math.floor(alcoholUnits / 2), cashSeized: 0, heatDelta: -5 }
}

/** Resolve a spot Bribe — pay and go. */
export function resolveBribe(bribeCost: number): BribeResult {
  return { cashPaid: bribeCost, cleared: true }
}

/**
 * Resolve a Run attempt.
 * Roll 2d6: beat 8 → escape (heat +5 for the chase), fail → Jail 2 seasons (+30 heat).
 */
export function resolveRun(roll: number): RunResult {
  if (roll > 8) {
    return { escaped: true, jailSeasons: 0, heatDelta: 5 }
  }
  return { escaped: false, jailSeasons: 2, heatDelta: HEAT_CHANGES.runFail }
}

/**
 * One-time spot bribe cost: scales with current heat and city size.
 */
export function calculateSpotBribeCost(currentHeat: number, tier: PopulationTier): number {
  const base = 50 + currentHeat * 2
  return Math.floor(base * TIER_BRIBE_MULTIPLIER[tier])
}

/**
 * Long-term city bribe cost: more expensive than spot, scales with city size.
 * Lasts 4 seasons (6 for Vixen — applied externally via applyBribeDuration).
 */
export function calculateLongTermBribeCost(tier: PopulationTier): number {
  const base = 500
  return Math.floor(base * TIER_BRIBE_MULTIPLIER[tier])
}
