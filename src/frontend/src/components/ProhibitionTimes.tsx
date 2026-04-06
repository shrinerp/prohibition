import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  PROHIBITION_STORIES,
  extractGameHeadlines,
  getStoriesForYear,
  type GameMessage,
  type ProhibitionStory,
} from '../data/prohibitionTimes'

interface ProhibitionTimesProps {
  gameId: string
  currentSeason: number
  onClose?: () => void
  isOverlay?: boolean
}

// Deterministic shuffle seeded by season so the page stays stable during a turn
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr]
  let s = seed
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function seasonToDateline(season: number): { year: number; month: string; vol: number } {
  // 52 seasons = 13 years (1920–1933), 4 seasons per year, 3 months per season
  const year = 1920 + Math.floor((season - 1) / 4)
  const monthIdx = ((season - 1) % 4) * 3  // 0, 3, 6, 9
  return { year, month: MONTH_NAMES[monthIdx], vol: season }
}

const TYPE_LABEL: Record<string, string> = {
  news: 'News',
  opinion: 'Opinion',
  ad: 'Advertisement',
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProhibitionTimes({ gameId, currentSeason, onClose, isOverlay }: ProhibitionTimesProps) {
  const [systemMessages, setSystemMessages] = useState<GameMessage[]>([])
  const hasFetched = useRef(false)
  const [storyIndex, setStoryIndex] = useState(0)

  // Fetch recent system messages once on mount
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetch(`/api/games/${gameId}/messages?since=0`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.success && Array.isArray(data.data?.messages)) {
          setSystemMessages(
            (data.data.messages as GameMessage[]).filter(m => m.isSystem)
          )
        }
      })
      .catch(() => {})
  }, [gameId])

  const { year, month, vol } = seasonToDateline(currentSeason)

  // Build ordered story list for this edition
  const stories = useMemo(() => {
    const newsPool = seededShuffle(getStoriesForYear(year, ['news']), currentSeason * 17)
    const opinionPool = seededShuffle(
      PROHIBITION_STORIES.filter(s => s.type === 'opinion'),
      currentSeason * 31
    )
    const adPool = seededShuffle(
      PROHIBITION_STORIES.filter(s => s.type === 'ad'),
      currentSeason * 47
    )
    const gameEvents = extractGameHeadlines(systemMessages, currentSeason)

    const banner = newsPool.find(s => s.size === 'banner') ?? newsPool[0]
    const features = newsPool.filter(s => s !== banner && s.size !== 'brief').slice(0, 2)
    const briefs = newsPool.filter(s => s !== banner && !features.includes(s) && s.size === 'brief').slice(0, 3)
    const opinion = opinionPool[0] ?? null
    const ads = adPool.slice(0, 2)

    // Order: game events first, then banner, features, briefs, opinion, ads
    const list: ProhibitionStory[] = [
      ...gameEvents,
      ...(banner ? [banner] : []),
      ...features,
      ...briefs,
      ...(opinion ? [opinion] : []),
      ...ads,
    ]
    return list
  }, [year, currentSeason, systemMessages])

  const total = stories.length
  const story = stories[storyIndex] ?? null

  // Reset when season changes
  useEffect(() => { setStoryIndex(0) }, [currentSeason])

  const prev = useCallback(() => setStoryIndex(i => (i - 1 + total) % total), [total])
  const next = useCallback(() => setStoryIndex(i => (i + 1) % total), [total])

  const inner = (
    <div
      className="flex flex-col bg-amber-50 text-stone-900"
      style={{ filter: 'sepia(0.18)', height: '100%' }}
    >
      {/* Waiting banner — only shown in inline (non-overlay) mode */}
      {!isOverlay && (
        <div className="bg-stone-800 text-amber-100 text-center py-1.5 px-4 flex-shrink-0">
          <p className="text-xs font-serif tracking-widest uppercase">
            ✦ Waiting for your turn — catch up on the news ✦
          </p>
        </div>
      )}

      {/* Masthead */}
      <div className="border-b-4 border-double border-stone-800 px-4 pt-3 pb-2 text-center flex-shrink-0 relative">
        {(isOverlay || onClose) && (
          <button
            onClick={onClose}
            className="absolute top-3 right-4 text-stone-600 hover:text-stone-900 text-xl font-bold leading-none cursor-pointer"
            aria-label="Close newspaper"
          >✕</button>
        )}
        <p className="text-xs tracking-[0.3em] uppercase text-stone-600 font-serif border-b border-stone-700 mb-1 pb-1">
          Est. 1920 · Chicago, Ill.
        </p>
        <h1 className="font-serif text-3xl font-black tracking-wider uppercase text-stone-900 leading-none my-1">
          The Prohibition Times
        </h1>
        <div className="border-t border-stone-700 mt-1 pt-1 flex justify-between items-center text-xs font-serif text-stone-600">
          <span>Vol. {vol}, No. {currentSeason}</span>
          <span className="font-bold">{month} {year}</span>
          <span>One Cent</span>
        </div>
      </div>

      {/* Story content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {story ? (
          <div className="max-w-2xl mx-auto">
            {/* Section label */}
            <p className="font-serif text-xs font-black uppercase tracking-[0.3em] text-stone-500 mb-3 border-b border-stone-300 pb-1">
              {TYPE_LABEL[story.type] ?? story.type}
            </p>

            {/* Image */}
            {story.imageUrl && (
              <img
                src={story.imageUrl}
                alt={story.headline}
                className="w-full max-h-64 object-cover mb-4"
                style={{ filter: 'sepia(1) contrast(0.85) brightness(0.88)' }}
                referrerPolicy="no-referrer"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}

            {/* Published date */}
            {story.publishedDate && (
              <p className="font-serif text-xs text-stone-500 mb-2 italic">{story.publishedDate}</p>
            )}

            {/* Headline */}
            <h2 className="font-serif text-2xl font-black leading-tight uppercase tracking-wide text-stone-900 mb-2">
              {story.headline}
            </h2>

            {/* Subheadline */}
            {story.subheadline && (
              <p className="font-serif text-base italic text-stone-700 mb-3 border-b border-stone-300 pb-3">
                {story.subheadline}
              </p>
            )}

            {/* Author pull-out (opinion pieces) */}
            {story.author && (
              <div className="flex items-start gap-3 mb-4 pb-4 border-b-2 border-double border-stone-400">
                {story.authorImageUrl && (
                  <img
                    src={story.authorImageUrl}
                    alt={story.author}
                    className="w-16 h-16 object-cover flex-shrink-0 rounded-sm"
                    style={{ filter: 'sepia(0.9) contrast(0.9) brightness(0.92)' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <div className="flex flex-col justify-center">
                  <p className="font-serif text-xs font-black uppercase tracking-widest text-stone-500 mb-0.5">By the Author</p>
                  <p className="font-serif text-sm font-bold text-stone-800 leading-snug">{story.author}</p>
                </div>
              </div>
            )}

            {/* Body */}
            <p className="text-sm leading-relaxed text-stone-800 font-serif">{story.body}</p>

            {/* Source link */}
            {story.sourceUrl && (
              <a
                href={story.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-stone-500 hover:text-stone-700 underline mt-3 inline-block"
              >
                Read more →
              </a>
            )}
          </div>
        ) : (
          <p className="text-center text-stone-500 font-serif italic mt-8">No stories today.</p>
        )}
      </div>

      {/* Navigation footer */}
      <div className="flex-shrink-0 border-t-2 border-double border-stone-700 px-4 py-2 flex items-center justify-between bg-amber-50/80">
        <button
          onClick={prev}
          disabled={total <= 1}
          className="font-serif text-sm text-stone-600 hover:text-stone-900 font-bold px-3 py-1 border border-stone-400 hover:border-stone-700 transition-colors disabled:opacity-30 disabled:cursor-default cursor-pointer"
        >
          ← Prev
        </button>
        <p className="text-xs font-serif text-stone-500 italic text-center">
          {total > 0 ? `${storyIndex + 1} of ${total}` : '—'} · "All the news that's fit to distill"
        </p>
        <button
          onClick={next}
          disabled={total <= 1}
          className="font-serif text-sm text-stone-600 hover:text-stone-900 font-bold px-3 py-1 border border-stone-400 hover:border-stone-700 transition-colors disabled:opacity-30 disabled:cursor-default cursor-pointer"
        >
          Next →
        </button>
      </div>
    </div>
  )

  if (isOverlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative w-full max-w-2xl" style={{ height: '80vh' }}>
          {inner}
        </div>
      </div>
    )
  }

  return <div style={{ height: '100%' }}>{inner}</div>
}
