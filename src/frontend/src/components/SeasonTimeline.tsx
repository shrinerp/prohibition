import React from 'react'

interface SeasonTimelineProps {
  seasonLabel: string
  currentPlayerName: string
  isMyTurn: boolean
  turnOrder: string[]
  currentTurnIndex: number
  currentCityName?: string
  currentSeason: number
  totalSeasons: number
}

export default function SeasonTimeline({
  seasonLabel,
  currentPlayerName,
  isMyTurn,
  currentCityName,
  currentSeason,
  totalSeasons,
}: SeasonTimelineProps) {
  const seasonsPerYear = totalSeasons / 13
  const pct     = Math.min(100, Math.round(((currentSeason - 1) / totalSeasons) * 100))
  // 13 segments = one per year (1921–1933)
  const filled  = Math.floor((currentSeason - 1) / seasonsPerYear)   // complete years elapsed
  const partial = ((currentSeason - 1) % seasonsPerYear) / seasonsPerYear  // fraction through current year

  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-1.5 space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-amber-400 font-bold text-sm">{seasonLabel}</span>
        {isMyTurn ? (
          <span className="text-green-400 text-xs font-bold uppercase animate-pulse">Your Turn</span>
        ) : (
          <span className="text-stone-400 text-xs">{currentPlayerName}&apos;s turn</span>
        )}
      </div>

      {/* Progress bar — 13 year-segments */}
      <div className="flex gap-0.5">
        {Array.from({ length: 13 }, (_, i) => {
          const isComplete = i < filled
          const isCurrent  = i === filled
          return (
            <div
              key={i}
              title={`${1921 + i}`}
              className="flex-1 h-1.5 rounded-sm overflow-hidden bg-stone-700"
            >
              <div
                className={`h-full ${isComplete ? 'bg-amber-500' : 'bg-amber-400'} transition-all duration-500`}
                style={{ width: isComplete ? '100%' : isCurrent ? `${partial * 100}%` : '0%' }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
