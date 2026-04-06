export const ALCOHOL_EMOJI: Record<string, string> = {
  beer:      '🍺',
  wine:      '🍷',
  whiskey:   '🥃',
  bourbon:   '🥃',
  scotch:    '🥃',
  rye:       '🥃',
  gin:       '🍸',
  rum:       '🍹',
  vodka:     '🍸',
  moonshine: '🫙',
  tequila:   '🥂',
  brandy:    '🍷',
  vermouth:  '🍸',
  malort:    '😬',
}

export const STASH_SENSITIVITY = 1.0 // bump to increase all radii proportionally

export const PROXIMITY_RADIUS: Record<string, number> = {
  small:  0.10 * STASH_SENSITIVITY, // easiest — sparse small town
  medium: 0.08 * STASH_SENSITIVITY,
  large:  0.06 * STASH_SENSITIVITY,
  major:  0.04 * STASH_SENSITIVITY, // hardest — dense city grid
}

export const STASH_COST = 100
export const MAX_JAIL_SEASONS = 3

export const BOOBY_TRAP_HEAT_RATE   = 2    // $ per heat point
export const BOOBY_TRAP_JAIL_RATE   = 100  // $ per jail season
export const BOOBY_TRAP_PENALTY_PCT = 0.10 // 10% of cash penalty

export function boobytrapCost(heatSpike: number, jailSeasons: number, cashPenalty: number): number {
  return STASH_COST
    + BOOBY_TRAP_HEAT_RATE * heatSpike
    + BOOBY_TRAP_JAIL_RATE * Math.min(jailSeasons, MAX_JAIL_SEASONS)
    + Math.floor(BOOBY_TRAP_PENALTY_PCT * cashPenalty)
}

export function coordDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}
