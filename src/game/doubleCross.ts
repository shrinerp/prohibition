import { applyDoublerossModifier, getCharacter } from './characters'

export type CityTier = 'small' | 'medium' | 'large' | 'major'

export interface DoubleCrossTarget {
  cash: number
  alcoholUnits: number
  characterClass: string
  isInJail: boolean
  cityTier: CityTier
}

export interface DoubleCrossResult {
  allowed: boolean
  success?: boolean
  aggressorCashGain: number     // positive = gain, negative = loss
  aggressorAlcoholGain: number  // positive = gain, negative = loss
  victimCashLoss: number        // positive = victim loses this much cash
  victimAlcoholLoss: number     // positive = victim loses this much alcohol
  heatDelta: number             // heat added to aggressor
}

const BASE_SUCCESS_RATE = 0.5

/** Large/major city tiers where Union Leader bonus applies */
const LARGE_TIERS = new Set<CityTier>(['large', 'major'])

/**
 * Calculate the aggressor's success rate for a Double Cross.
 * Gangster: +15%. Union Leader (Big Mike): +20% in large/major cities.
 * Capped at 1.0.
 */
export function calculateSuccessRate(aggressorClass: string, cityTier: CityTier): number {
  let rate = BASE_SUCCESS_RATE

  // Union Leader bonus only applies in large/major cities
  if (aggressorClass === 'union_leader' && LARGE_TIERS.has(cityTier)) {
    rate = applyDoublerossModifier(aggressorClass, rate)
  } else if (aggressorClass !== 'union_leader') {
    rate = applyDoublerossModifier(aggressorClass, rate)
  }

  return Math.min(1.0, rate)
}

/**
 * Resolve a Double Cross attempt.
 *
 * @param aggressorClass  - attacker's character class
 * @param target          - victim info
 * @param success         - whether the attempt succeeded (caller provides the roll result)
 *
 * On success: aggressor gains 20% victim cash + 50% victim alcohol.
 * On failure: victim gains 20% aggressor inventory (modelled as negative gain for aggressor,
 *             using the aggressor's own cash/alcohol at a notional 500 cash / 10 units).
 */
export function resolveDoubleCross(
  aggressorClass: string,
  target: DoubleCrossTarget,
  success: boolean
): DoubleCrossResult {
  if (target.isInJail) {
    return {
      allowed: false,
      aggressorCashGain: 0,
      aggressorAlcoholGain: 0,
      victimCashLoss: 0,
      victimAlcoholLoss: 0,
      heatDelta: 0
    }
  }

  const victimChar = getCharacter(target.characterClass)
  const cashLossMultiplier = victimChar?.modifiers.cashLossOnRobMultiplier ?? 1.0

  if (success) {
    const cashGain    = Math.floor(target.cash * 0.2 * cashLossMultiplier)
    const alcoholGain = Math.floor(target.alcoholUnits * 0.5)
    return {
      allowed:             true,
      success:             true,
      aggressorCashGain:   cashGain,
      aggressorAlcoholGain: alcoholGain,
      victimCashLoss:      cashGain,
      victimAlcoholLoss:   alcoholGain,
      heatDelta:           10   // success heat penalty
    }
  } else {
    // Reverse: aggressor loses cash/alcohol to victim
    // Notional aggressor inventory used for the reverse calculation
    const aggressorNotionalCash    = 500
    const aggressorNotionalAlcohol = 10
    const cashLoss    = Math.floor(aggressorNotionalCash * 0.2)
    const alcoholLoss = Math.floor(aggressorNotionalAlcohol * 0.5)
    return {
      allowed:             true,
      success:             false,
      aggressorCashGain:   -cashLoss,
      aggressorAlcoholGain: -alcoholLoss,
      victimCashLoss:      -cashLoss,   // victim GAINS (negative loss)
      victimAlcoholLoss:   -alcoholLoss,
      heatDelta:           20   // failure heat penalty
    }
  }
}
