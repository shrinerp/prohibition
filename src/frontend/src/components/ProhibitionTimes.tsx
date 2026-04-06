import React, { useEffect, useMemo, useRef, useState } from 'react'
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

// ── Story card sub-components ─────────────────────────────────────────────────

function BannerStory({ story }: { story: ProhibitionStory }) {
  return (
    <div className="border-b-2 border-stone-800 pb-3 mb-3">
      {story.imageUrl && (
        <img
          src={story.imageUrl}
          alt={story.headline}
          className="w-full h-40 object-cover mb-2"
          style={{ filter: 'sepia(1) contrast(0.85) brightness(0.88)' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <h2 className="font-serif text-lg font-black leading-tight uppercase tracking-wide text-stone-900 mb-1">
        {story.headline}
      </h2>
      {story.subheadline && (
        <p className="font-serif text-sm italic text-stone-700 mb-1">{story.subheadline}</p>
      )}
      <p className="text-xs leading-relaxed text-stone-800">{story.body}</p>
      {story.sourceUrl && (
        <a href={story.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-stone-500 hover:text-stone-700 underline mt-0.5 inline-block">
          Read more →
        </a>
      )}
    </div>
  )
}

function FeatureStory({ story }: { story: ProhibitionStory }) {
  return (
    <div className="border-b border-stone-600 pb-2 mb-2">
      {story.imageUrl && (
        <img
          src={story.imageUrl}
          alt={story.headline}
          className="w-full h-24 object-cover mb-1.5"
          style={{ filter: 'sepia(1) contrast(0.85) brightness(0.88)' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <h3 className="font-serif text-sm font-black leading-tight uppercase tracking-wide text-stone-900 mb-0.5">
        {story.headline}
      </h3>
      {story.subheadline && (
        <p className="font-serif text-xs italic text-stone-600 mb-0.5">{story.subheadline}</p>
      )}
      <p className="text-xs leading-relaxed text-stone-800">{story.body}</p>
      {story.sourceUrl && (
        <a href={story.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-stone-500 hover:text-stone-700 underline mt-0.5 inline-block">
          Read more →
        </a>
      )}
    </div>
  )
}

function BriefStory({ story }: { story: ProhibitionStory }) {
  return (
    <div className="border-b border-stone-400 pb-1.5 mb-1.5 last:border-b-0 last:pb-0 last:mb-0">
      <p className="font-serif text-xs font-black uppercase tracking-wide text-stone-900 leading-tight mb-0.5">
        {story.headline}
      </p>
      <p className="text-xs leading-relaxed text-stone-700">{story.body}</p>
    </div>
  )
}

function AdBox({ story }: { story: ProhibitionStory }) {
  return (
    <div className="border-2 border-stone-700 p-2 mb-2 bg-amber-100/60 text-center">
      <p className="font-serif text-xs font-black uppercase tracking-wider text-stone-900 leading-tight mb-1">
        {story.headline}
      </p>
      <p className="text-xs leading-snug text-stone-700 italic">{story.body}</p>
    </div>
  )
}

function OpinionBox({ story }: { story: ProhibitionStory }) {
  return (
    <div className="border border-stone-600 p-2 mb-2 bg-amber-50/80">
      <p className="font-serif text-xs font-black uppercase tracking-wide text-stone-800 mb-0.5 border-b border-stone-500 pb-0.5">
        Opinion
      </p>
      <p className="font-serif text-xs font-bold text-stone-900 leading-tight mb-0.5 italic">
        {story.headline}
      </p>
      {story.subheadline && (
        <p className="text-xs text-stone-600 italic mb-0.5">{story.subheadline}</p>
      )}
      <p className="text-xs leading-relaxed text-stone-700">{story.body}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProhibitionTimes({ gameId, currentSeason, onClose, isOverlay }: ProhibitionTimesProps) {
  const [systemMessages, setSystemMessages] = useState<GameMessage[]>([])
  const hasFetched = useRef(false)

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

  // Build edition — seeded by season for stability, randomised per season
  const edition = useMemo(() => {
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
    const ads = adPool.slice(0, 3)

    return { banner, features, briefs, opinion, ads, gameEvents }
  }, [year, currentSeason, systemMessages])

  const content = (
    <div
      className="bg-amber-50 text-stone-900 max-w-2xl w-full mx-auto rounded shadow-2xl overflow-hidden"
      style={{ filter: 'sepia(0.18)' }}
    >
      {/* Masthead */}
      <div className="border-b-4 border-double border-stone-800 px-4 pt-3 pb-2 text-center">
        {isOverlay && (
          <button
            onClick={onClose}
            className="absolute top-3 right-4 text-stone-600 hover:text-stone-900 text-xl font-bold leading-none"
            aria-label="Close newspaper"
          >✕</button>
        )}
        <div className="border-b border-stone-700 mb-1 pb-1">
          <p className="text-xs tracking-[0.3em] uppercase text-stone-600 font-serif">Est. 1920 · Chicago, Ill.</p>
        </div>
        <h1 className="font-serif text-3xl font-black tracking-wider uppercase text-stone-900 leading-none my-1">
          The Prohibition Times
        </h1>
        <div className="border-t border-stone-700 mt-1 pt-1 flex justify-between items-center text-xs font-serif text-stone-600">
          <span>Vol. {vol}, No. {currentSeason}</span>
          <span className="font-bold">{month} {year}</span>
          <span>One Cent</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex gap-3">

        {/* Main columns — left 2/3 */}
        <div className="flex-1 min-w-0">

          {/* Banner */}
          {edition.banner && <BannerStory story={edition.banner} />}

          {/* Two feature columns */}
          {edition.features.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-2">
              {edition.features.map(s => <FeatureStory key={s.id} story={s} />)}
            </div>
          )}

          {/* Local Dispatches — game events + briefs */}
          {(edition.gameEvents.length > 0 || edition.briefs.length > 0) && (
            <div className="border-t-2 border-stone-700 pt-2">
              <p className="font-serif text-xs font-black uppercase tracking-widest text-stone-700 mb-2 text-center border-b border-stone-500 pb-1">
                Local Dispatches
              </p>
              <div className="space-y-0">
                {edition.gameEvents.map(s => <BriefStory key={s.id} story={s} />)}
                {edition.briefs.map(s => <BriefStory key={s.id} story={s} />)}
              </div>
            </div>
          )}
        </div>

        {/* Right rail — ads + opinion */}
        <div className="w-36 flex-shrink-0 border-l border-stone-600 pl-3">
          <p className="font-serif text-xs font-black uppercase tracking-widest text-stone-600 mb-2 text-center">
            Notices
          </p>
          {edition.ads.map(s => <AdBox key={s.id} story={s} />)}
          {edition.opinion && (
            <OpinionBox story={edition.opinion} />
          )}
        </div>

      </div>

      {/* Footer rule */}
      <div className="border-t-2 border-double border-stone-700 px-4 py-1.5 text-center">
        <p className="text-xs font-serif text-stone-500 italic">
          "All the news that's fit to distill" · {month} {year}
        </p>
      </div>
    </div>
  )

  if (isOverlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative w-full max-w-2xl">
          {content}
        </div>
      </div>
    )
  }

  return content
}
