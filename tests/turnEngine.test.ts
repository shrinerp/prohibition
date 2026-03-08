import { describe, it, expect } from 'vitest'
import {
  TOTAL_SEASONS,
  SEASONS_PER_YEAR,
  isYearStart,
  isGameOver,
  getNextPlayerIndex,
  isTurnExpired,
  buildResolutionSteps
} from '../src/game/turnEngine'

describe('Season constants', () => {
  it('defines 52 total seasons over 13 years', () => {
    expect(TOTAL_SEASONS).toBe(52)
    expect(SEASONS_PER_YEAR).toBe(4)
    expect(TOTAL_SEASONS / SEASONS_PER_YEAR).toBe(13)
  })
})

describe('isYearStart()', () => {
  it('returns true for season 1 (first season of year 1)', () => {
    expect(isYearStart(1)).toBe(true)
  })

  it('returns true for season 5 (first season of year 2)', () => {
    expect(isYearStart(5)).toBe(true)
  })

  it('returns false for mid-year season', () => {
    expect(isYearStart(2)).toBe(false)
    expect(isYearStart(6)).toBe(false)
  })
})

describe('isGameOver()', () => {
  it('returns false before season 52', () => {
    expect(isGameOver(51)).toBe(false)
    expect(isGameOver(1)).toBe(false)
  })

  it('returns true at season 52', () => {
    expect(isGameOver(52)).toBe(true)
  })

  it('returns true beyond season 52', () => {
    expect(isGameOver(53)).toBe(true)
  })
})

describe('getNextPlayerIndex()', () => {
  it('increments to next player', () => {
    expect(getNextPlayerIndex(0, 4)).toBe(1)
    expect(getNextPlayerIndex(2, 4)).toBe(3)
  })

  it('wraps back to player 0 after last player', () => {
    expect(getNextPlayerIndex(3, 4)).toBe(0)
  })
})

describe('isTurnExpired()', () => {
  const now = new Date('2025-01-10T12:00:00Z').getTime()

  it('returns false when less than 24h have passed', () => {
    const turnStart = new Date('2025-01-10T00:00:00Z').getTime()
    expect(isTurnExpired(turnStart, now)).toBe(false)
  })

  it('returns true when more than 24h have passed', () => {
    const turnStart = new Date('2025-01-09T11:59:00Z').getTime()
    expect(isTurnExpired(turnStart, now)).toBe(true)
  })
})

describe('buildResolutionSteps()', () => {
  it('returns the ordered resolution pipeline', () => {
    const steps = buildResolutionSteps(false)
    expect(steps).toEqual([
      'intercepts',
      'police',
      'market_refresh',
      'npc_turns',
      'season_increment',
      'protection_tax'
    ])
  })

  it('includes year_event when it is the start of a year', () => {
    const steps = buildResolutionSteps(true)
    expect(steps).toContain('year_event')
    // year_event comes after season_increment
    const seIdx = steps.indexOf('season_increment')
    const yeIdx = steps.indexOf('year_event')
    expect(yeIdx).toBeGreaterThan(seIdx)
  })
})
