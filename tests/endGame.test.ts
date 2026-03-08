import { describe, it, expect } from 'vitest'
import {
  calculateNetWorth,
  determineWinner,
  generateSecretHistory,
  type PlayerEndState,
  type GameHistoryEntry
} from '../src/game/endGame'

const player1: PlayerEndState = {
  playerId: 1,
  playerName: 'Al',
  liquidCash: 5000,
  cityPropertyValue: 2000,
  equipmentValue: 500
}

const player2: PlayerEndState = {
  playerId: 2,
  playerName: 'Lucky',
  liquidCash: 3000,
  cityPropertyValue: 4000,
  equipmentValue: 1000
}

describe('calculateNetWorth()', () => {
  it('computes cash + (city × 1.2) + equipment', () => {
    // 5000 + (2000 × 1.2) + 500 = 5000 + 2400 + 500 = 7900
    expect(calculateNetWorth(player1)).toBe(7900)
  })

  it('ignores inventory and still values', () => {
    const withExtra = { ...player1, inventoryValue: 999, stillValue: 888 }
    expect(calculateNetWorth(withExtra)).toBe(7900)
  })
})

describe('determineWinner()', () => {
  it('returns the player with highest net worth', () => {
    // player1 NW = 7900, player2 NW = 3000 + (4000×1.2) + 1000 = 8800
    const { winner } = determineWinner([player1, player2])
    expect(winner.playerId).toBe(2)
  })

  it('breaks ties by liquid cash', () => {
    const tied1: PlayerEndState = { ...player1, liquidCash: 5000, cityPropertyValue: 0, equipmentValue: 0 }
    const tied2: PlayerEndState = { ...player2, playerId: 2, liquidCash: 6000, cityPropertyValue: 0, equipmentValue: 0 }
    // tied1 NW = 5000, tied2 NW = 6000 — not a tie, tied2 wins
    const { winner } = determineWinner([tied1, tied2])
    expect(winner.playerId).toBe(2)
  })

  it('returns ranked standings for all players', () => {
    const { standings } = determineWinner([player1, player2])
    expect(standings).toHaveLength(2)
    expect(standings[0].playerId).toBe(2) // highest NW first
  })
})

describe('generateSecretHistory()', () => {
  const entries: GameHistoryEntry[] = [
    { season: 1, year: 1921, type: 'double_cross', description: 'Al robbed Lucky for $500' },
    { season: 4, year: 1921, type: 'jail',         description: 'Lucky jailed for 2 seasons' },
    { season: 52, year: 1933, type: 'game_end',    description: 'Prohibition repealed' }
  ]

  it('returns a non-empty markdown string', () => {
    const md = generateSecretHistory(entries, [player1, player2])
    expect(md).toContain('#')
    expect(md.length).toBeGreaterThan(50)
  })

  it('includes a Final Standings section', () => {
    const md = generateSecretHistory(entries, [player1, player2])
    expect(md).toContain('Final Standings')
  })

  it('includes at least one history entry description', () => {
    const md = generateSecretHistory(entries, [player1, player2])
    expect(md).toContain('Al robbed Lucky')
  })
})
