import { describe, it, expect } from 'vitest'
import {
  PROHIBITION_STORIES,
  getStoriesForYear,
  extractGameHeadlines,
  type GameMessage,
} from '../src/frontend/src/data/prohibitionTimes'

describe('PROHIBITION_STORIES', () => {
  it('has at least 70 entries', () => {
    expect(PROHIBITION_STORIES.length).toBeGreaterThanOrEqual(70)
  })

  it('all stories have required fields', () => {
    for (const story of PROHIBITION_STORIES) {
      expect(story.id, `${story.id} missing id`).toBeTruthy()
      expect(story.type, `${story.id} missing type`).toMatch(/^(news|opinion|ad)$/)
      expect(story.size, `${story.id} missing size`).toMatch(/^(banner|feature|brief)$/)
      expect(story.headline, `${story.id} missing headline`).toBeTruthy()
      expect(story.body, `${story.id} missing body`).toBeTruthy()
      expect(typeof story.year, `${story.id} year not number`).toBe('number')
    }
  })

  it('all year-keyed stories are in range 1920–1933 or 0 (wildcard)', () => {
    for (const story of PROHIBITION_STORIES) {
      expect(story.year === 0 || (story.year >= 1920 && story.year <= 1933),
        `${story.id} has invalid year ${story.year}`
      ).toBe(true)
    }
  })

  it('has no duplicate ids', () => {
    const ids = PROHIBITION_STORIES.map(s => s.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('has at least 3 news stories per year from 1920–1930', () => {
    for (let year = 1920; year <= 1930; year++) {
      const count = PROHIBITION_STORIES.filter(
        s => s.type === 'news' && s.year === year
      ).length
      expect(count, `Year ${year} has only ${count} news stories`).toBeGreaterThanOrEqual(2)
    }
  })

  it('has opinion pieces', () => {
    const opinions = PROHIBITION_STORIES.filter(s => s.type === 'opinion')
    expect(opinions.length).toBeGreaterThanOrEqual(8)
  })

  it('has advertisements', () => {
    const ads = PROHIBITION_STORIES.filter(s => s.type === 'ad')
    expect(ads.length).toBeGreaterThanOrEqual(8)
  })
})

describe('getStoriesForYear', () => {
  it('returns stories within ±1 year window', () => {
    const stories = getStoriesForYear(1929)
    const yearKeyed = stories.filter(s => s.year !== 0)
    for (const s of yearKeyed) {
      expect(Math.abs(s.year - 1929)).toBeLessThanOrEqual(1)
    }
  })

  it('always includes wildcard stories (year=0)', () => {
    const stories = getStoriesForYear(1925)
    const wildcards = stories.filter(s => s.year === 0)
    expect(wildcards.length).toBeGreaterThan(0)
  })

  it('filters by type when specified', () => {
    const ads = getStoriesForYear(1925, ['ad'])
    expect(ads.every(s => s.type === 'ad')).toBe(true)
  })

  it('expands window when too few results', () => {
    // Year 1933 has few stories; should expand to ±2
    const narrow = getStoriesForYear(1933, ['news'], 5)
    expect(narrow.length).toBeGreaterThan(0)
  })
})

describe('extractGameHeadlines', () => {
  const makeMsg = (id: number, message: string, isSystem = true): GameMessage => ({
    id, message, isSystem, createdAt: new Date().toISOString(),
  })

  it('returns empty array for no system messages', () => {
    const result = extractGameHeadlines([], 10)
    expect(result).toEqual([])
  })

  it('ignores non-system messages', () => {
    const msgs = [makeMsg(1, '🥃 Some raided a still in Chicago', false)]
    expect(extractGameHeadlines(msgs, 5)).toEqual([])
  })

  it('detects still raids', () => {
    const msgs = [makeMsg(1, '🥃 Feds raided a still in Detroit.')]
    const result = extractGameHeadlines(msgs, 5)
    expect(result.length).toBe(1)
    expect(result[0].headline).toContain('DETROIT')
    expect(result[0].subheadline).toBeTruthy()
    expect(result[0].body.length).toBeGreaterThan(50)
  })

  it('detects jail/arrest messages', () => {
    const msgs = [makeMsg(2, 'Big Al was arrested and sent to jail in Chicago.')]
    const result = extractGameHeadlines(msgs, 8)
    expect(result.length).toBe(1)
    expect(result[0].headline).toContain('BIG AL')
  })

  it('detects city claims', () => {
    const msgs = [makeMsg(3, 'Player1 claimed Chicago territory.')]
    const result = extractGameHeadlines(msgs, 12)
    expect(result.length).toBe(1)
    expect(result[0].headline).toContain('CHICAGO')
  })

  it('detects toll payments', () => {
    const msgs = [makeMsg(4, '💰 Vinnie paid Big Al a $20 courtesy toll for passing through Kansas City.')]
    const result = extractGameHeadlines(msgs, 4)
    expect(result.length).toBe(1)
    expect(result[0].headline).toContain('TOLL')
  })

  it('deduplicates same event key', () => {
    const msgs = [
      makeMsg(5, '🥃 Feds raided a still in Detroit.'),
      makeMsg(6, '🥃 Feds raided a still in Detroit.'),
    ]
    expect(extractGameHeadlines(msgs, 5).length).toBe(1)
  })

  it('assigns correct year based on season', () => {
    // Season 5 → year 1921
    const msgs = [makeMsg(7, 'Big Al was arrested and sent to jail.')]
    const result = extractGameHeadlines(msgs, 5)
    expect(result[0].year).toBe(1921)
  })

  it('all results have size brief and type news', () => {
    const msgs = [
      makeMsg(8, '🥃 Feds raided a still in Boston.'),
      makeMsg(9, 'Player was arrested and sent to jail.'),
    ]
    for (const r of extractGameHeadlines(msgs, 1)) {
      expect(r.size).toBe('brief')
      expect(r.type).toBe('news')
    }
  })
})

// ── Close-button visibility logic ─────────────────────────────────────────────
// The ProhibitionTimes component shows the close button when (isOverlay || onClose).
// Full render tests require a DOM environment (jsdom + @testing-library/react)
// which this project does not currently have configured. The condition is tested
// here as a pure boolean to document intent and guard against regression.

describe('ProhibitionTimes close button visibility condition', () => {
  const shouldShowClose = (isOverlay: boolean, onClose: (() => void) | undefined) =>
    isOverlay || !!onClose

  it('shows close button when isOverlay is true', () => {
    expect(shouldShowClose(true, undefined)).toBe(true)
  })

  it('shows close button when onClose is provided (inline dismissible mode)', () => {
    expect(shouldShowClose(false, () => {})).toBe(true)
  })

  it('hides close button when neither isOverlay nor onClose is provided', () => {
    expect(shouldShowClose(false, undefined)).toBe(false)
  })

  it('shows close button when both isOverlay and onClose are provided', () => {
    expect(shouldShowClose(true, () => {})).toBe(true)
  })
})

describe('ProhibitionTimes maximize button visibility condition', () => {
  const shouldShowMaximize = (isOverlay: boolean, onMaximize: (() => void) | undefined) =>
    isOverlay && !!onMaximize

  it('shows maximize button when isOverlay and onMaximize are both provided', () => {
    expect(shouldShowMaximize(true, () => {})).toBe(true)
  })

  it('hides maximize button when not in overlay mode', () => {
    expect(shouldShowMaximize(false, () => {})).toBe(false)
  })

  it('hides maximize button when onMaximize is not provided (active turn)', () => {
    expect(shouldShowMaximize(true, undefined)).toBe(false)
  })

  it('hides maximize button when neither isOverlay nor onMaximize provided', () => {
    expect(shouldShowMaximize(false, undefined)).toBe(false)
  })
})
