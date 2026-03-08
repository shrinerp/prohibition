import { getUpgradeCost } from './production'

export type NpcAction = 'upgrade' | 'buy_city' | 'double_cross' | 'sell'

export interface NpcState {
  playerId: number
  characterClass: string
  cash: number
  alcoholUnits: number
  distilleryTier: number    // 1-5
  stillCount: number        // 1-3
  ownedCityIds: number[]
  currentCityId: number
  isInJail: boolean
  heat: number              // 0-100
  season: number            // current game season (1-indexed)
}

/** NPC action priority order, evaluated top-down each season */
export const NPC_PRIORITY: NpcAction[] = ['upgrade', 'buy_city', 'double_cross', 'sell']

const WEALTH_DECAY_RATE    = 0.3   // 30% cash lost every 4 seasons
const WEALTH_DECAY_SEASONS = 4

/**
 * Apply NPC wealth decay every WEALTH_DECAY_SEASONS seasons.
 * Season 0 is excluded (pre-game); decay fires on seasons 4, 8, 12, …
 */
export function applyWealthDecay(npc: NpcState): NpcState {
  if (npc.season === 0 || npc.season % WEALTH_DECAY_SEASONS !== 0) return npc
  return { ...npc, cash: Math.floor(npc.cash * (1 - WEALTH_DECAY_RATE)) }
}

/**
 * Deterministic NPC action selection.
 *
 * Priority:
 * 1. Upgrade distillery — if affordable and not at max tier
 * 2. Buy nearest neutral city — if affordable and one is available
 * 3. Double Cross — if an intercept opportunity exists
 * 4. Sell — fallback (also forced when in jail)
 *
 * @param npc               - current NPC state
 * @param canUpgrade        - true if there is an upgrade available (tier < 5) that NPC can afford
 * @param neutralCityNearby - true if an unowned city is reachable and affordable
 * @param interceptPossible - true if a rival player is on the NPC's movement path
 */
export function selectNpcAction(
  npc: NpcState,
  canUpgrade: boolean,
  neutralCityNearby: boolean,
  interceptPossible = false
): NpcAction {
  if (npc.isInJail) return 'sell'

  if (canUpgrade && npc.distilleryTier < 5) return 'upgrade'
  if (neutralCityNearby) return 'buy_city'
  if (interceptPossible) return 'double_cross'
  return 'sell'
}
