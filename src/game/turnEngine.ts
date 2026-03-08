export const SEASONS_PER_YEAR = 4
export const TOTAL_SEASONS    = 52   // 4 × 13 years (1920–1933)
export const TURN_DURATION_MS = 24 * 60 * 60 * 1000  // 24 hours

export type ResolutionStep =
  | 'intercepts'
  | 'police'
  | 'market_refresh'
  | 'npc_turns'
  | 'season_increment'
  | 'year_event'
  | 'protection_tax'

export type TurnAction =
  | { type: 'move';         targetPath: number[] }
  | { type: 'sell';         cityId: number; alcoholUnits: number }
  | { type: 'buy';          cityId: number; alcoholUnits: number }
  | { type: 'upgrade';      stillNumber: number }
  | { type: 'buy_city';     cityId: number }
  | { type: 'bribe_spot';   cityId: number }
  | { type: 'bribe_long';   cityId: number }
  | { type: 'double_cross'; targetPlayerId: number }
  | { type: 'skip' }

/**
 * True if the given season number is the first of its year.
 * Years start at seasons 1, 5, 9, … (1-indexed).
 */
export function isYearStart(season: number): boolean {
  return season > 0 && (season - 1) % SEASONS_PER_YEAR === 0
}

/** True when the game has reached or passed its final season. */
export function isGameOver(season: number): boolean {
  return season >= TOTAL_SEASONS
}

/**
 * Returns the index of the next player in the turn order, wrapping around.
 */
export function getNextPlayerIndex(currentIndex: number, playerCount: number): number {
  return (currentIndex + 1) % playerCount
}

/**
 * True when the turn window has expired (>24h since turnStartMs).
 */
export function isTurnExpired(turnStartMs: number, nowMs: number): boolean {
  return nowMs - turnStartMs >= TURN_DURATION_MS
}

/**
 * Return the ordered resolution pipeline steps for the current turn.
 * If `isYearStartSeason` is true, a year_event step is inserted after season_increment.
 */
export function buildResolutionSteps(isYearStartSeason: boolean): ResolutionStep[] {
  const steps: ResolutionStep[] = [
    'intercepts',
    'police',
    'market_refresh',
    'npc_turns',
    'season_increment'
  ]

  if (isYearStartSeason) {
    steps.push('year_event')
  }

  steps.push('protection_tax')
  return steps
}
