import { getSeasonLabel } from '../services/notifications'

export interface PlayerEndState {
  playerId: number
  playerName: string
  liquidCash: number
  cityPropertyValue: number
  equipmentValue: number
  [key: string]: unknown  // allow extra fields (inventoryValue etc.) which are ignored
}

export interface PlayerStanding {
  playerId: number
  playerName: string
  netWorth: number
  liquidCash: number
  rank: number
}

export interface WinnerResult {
  winner: PlayerStanding
  standings: PlayerStanding[]
}

export type HistoryEntryType = 'double_cross' | 'jail' | 'takeover' | 'heat_peak' | 'game_end'

export interface GameHistoryEntry {
  season: number
  year: number
  type: HistoryEntryType
  description: string
}

const CITY_PROPERTY_MULTIPLIER = 1.2

/**
 * Net Worth = Liquid Cash + (City Property Value × 1.2) + Equipment Value
 * Inventory and still values are not counted.
 */
export function calculateNetWorth(player: PlayerEndState): number {
  return Math.floor(
    player.liquidCash +
    player.cityPropertyValue * CITY_PROPERTY_MULTIPLIER +
    player.equipmentValue
  )
}

/**
 * Rank all players by Net Worth (desc). Ties broken by liquid cash.
 */
export function determineWinner(players: PlayerEndState[]): WinnerResult {
  const standings: PlayerStanding[] = players
    .map(p => ({
      playerId:   p.playerId,
      playerName: p.playerName,
      netWorth:   calculateNetWorth(p),
      liquidCash: p.liquidCash,
      rank:       0
    }))
    .sort((a, b) => {
      if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth
      return b.liquidCash - a.liquidCash
    })
    .map((s, i) => ({ ...s, rank: i + 1 }))

  return { winner: standings[0], standings }
}

/**
 * Generate a "Secret History" markdown recap.
 * Includes key events grouped by year, then final standings.
 */
export function generateSecretHistory(
  entries: GameHistoryEntry[],
  players: PlayerEndState[]
): string {
  const { standings } = determineWinner(players)

  // Group events by year
  const byYear = new Map<number, GameHistoryEntry[]>()
  for (const entry of entries) {
    if (!byYear.has(entry.year)) byYear.set(entry.year, [])
    byYear.get(entry.year)!.push(entry)
  }

  const lines: string[] = ['# The Secret History of Prohibition']

  for (const [year, yearEntries] of Array.from(byYear.entries()).sort((a, b) => a[0] - b[0])) {
    lines.push(`\n## ${year}`)
    for (const e of yearEntries) {
      const label = getSeasonLabel(e.season)
      lines.push(`- **${label}**: ${e.description}`)
    }
  }

  lines.push('\n## Final Standings')
  for (const s of standings) {
    lines.push(
      `${s.rank}. **${s.playerName}** — Net Worth: $${s.netWorth.toLocaleString()} (Cash: $${s.liquidCash.toLocaleString()})`
    )
  }

  return lines.join('\n')
}
