import React from 'react'

interface SeasonTimelineProps {
  seasonLabel: string        // e.g. "Spring 1924"
  currentPlayerName: string
  isMyTurn: boolean
  turnOrder: string[]        // player names in order
  currentTurnIndex: number
}

export default function SeasonTimeline({
  seasonLabel,
  currentPlayerName,
  isMyTurn,
  turnOrder,
  currentTurnIndex
}: SeasonTimelineProps) {
  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-amber-400 font-bold">{seasonLabel}</span>
        {isMyTurn ? (
          <span className="text-green-400 text-xs font-bold uppercase animate-pulse">Your Turn</span>
        ) : (
          <span className="text-stone-400 text-xs">{currentPlayerName}&apos;s turn</span>
        )}
      </div>
      <div className="flex gap-1">
        {turnOrder.map((name, i) => (
          <div
            key={i}
            title={name}
            className={`h-2 flex-1 rounded ${i === currentTurnIndex ? 'bg-amber-400' : 'bg-stone-600'}`}
          />
        ))}
      </div>
    </div>
  )
}
