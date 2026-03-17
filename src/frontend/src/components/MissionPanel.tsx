import React from 'react'
import { getMissionCardDisplay, type MissionCardDisplay } from '../data/missions'

interface HeldMission {
  id: number
  cardId: number
  progress: Record<string, unknown>
  assignedSeason: number
}

interface MissionPanelProps {
  missions: HeldMission[]
  onClose: () => void
  onDrawCard: () => void
  canDraw: boolean
}

const TIER_BADGE: Record<string, string> = {
  easy:       'text-amber-400 border-amber-600 bg-amber-900/40',
  medium:     'text-blue-400 border-blue-600 bg-blue-900/40',
  hard:       'text-red-400 border-red-600 bg-red-900/40',
  legendary:  'text-purple-400 border-purple-600 bg-purple-900/40',
}

const TIER_GLOW: Record<string, string> = {
  easy:       'border-amber-700',
  medium:     'border-blue-700',
  hard:       'border-red-800',
  legendary:  'border-purple-800',
}

function computeProgress(
  card: MissionCardDisplay,
  progressData: Record<string, unknown>
): { current: number; target: number } | null {
  const params = card.params as Record<string, number | string>
  const target = Number(params.target ?? params.count ?? 0)

  switch (card.objectiveType) {
    case 'total_sold_units': {
      const sold = (progressData.sold_units ?? {}) as Record<string, number>
      const current = Object.values(sold).reduce((a, b) => a + b, 0)
      return { current, target }
    }
    case 'sold_units_of_type': {
      const sold = (progressData.sold_units ?? {}) as Record<string, number>
      const current = sold[String(params.alcoholType)] ?? 0
      return { current, target }
    }
    case 'officials_bribed':
      return { current: Number(progressData.officials_bribed) || 0, target }
    case 'cities_visited': {
      const visited = (progressData.visited_city_ids ?? []) as number[]
      return { current: visited.length, target }
    }
    case 'sabotages_completed':
      return { current: Number(progressData.sabotages_completed) || 0, target }
    default:
      return null
  }
}

function objectiveLabel(card: MissionCardDisplay): string {
  const params = card.params as Record<string, number | string>
  switch (card.objectiveType) {
    case 'cash_gte':              return `Hold $${Number(params.target).toLocaleString()} cash`
    case 'cities_owned_gte':      return `Own ${params.target} cities`
    case 'vehicles_owned_gte':    return `Own ${params.target} vehicles`
    case 'distillery_tier_gte':   return `Reach Tier-${params.target} distillery`
    case 'total_cargo_units_gte': return `Carry ${params.target} cargo units`
    case 'cargo_units_of_type_gte': return `Carry ${params.target} ${params.alcoholType} units`
    case 'heat_at_most':          return `Heat ≤ ${params.target}`
    case 'heat_at_least':         return `Heat ≥ ${params.target}`
    case 'total_sold_units':      return `Sell ${params.target} total units`
    case 'sold_units_of_type':    return `Sell ${params.target} ${params.alcoholType} units`
    case 'total_cash_earned':     return `Earn $${Number(params.target).toLocaleString()} total`
    case 'officials_bribed':      return `Bribe ${params.target} officials`
    case 'cities_visited':        return `Visit ${params.target} cities`
    case 'turns_without_arrest':  return `${params.count} clean seasons`
    case 'sabotages_completed':   return `Sabotage ${params.target} rivals`
    default:                      return card.objectiveType
  }
}

export default function MissionPanel({ missions, onClose, onDrawCard, canDraw }: MissionPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative h-full w-80 bg-stone-900 border-l border-stone-700 flex flex-col overflow-hidden pointer-events-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wider">Mission Cards</p>
            <p className="text-sm text-stone-300 font-semibold">{missions.length}/3 held</p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-200 text-xl leading-none transition"
            aria-label="Close missions panel"
          >
            ×
          </button>
        </div>

        {/* Card list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {missions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-stone-500 text-sm italic">No missions held.</p>
              <p className="text-stone-600 text-xs mt-1">Draw a card to get started.</p>
            </div>
          ) : (
            missions.map(m => {
              const card = getMissionCardDisplay(m.cardId)
              if (!card) return null
              const prog = computeProgress(card, m.progress)
              const fillPct = prog ? Math.min(100, Math.round((prog.current / prog.target) * 100)) : null
              return (
                <div key={m.id} className={`bg-stone-800 border rounded-lg overflow-hidden ${TIER_GLOW[card.tier]}`}>
                  {/* Card header */}
                  <div className="px-3 pt-3 pb-1 flex items-start gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 flex-shrink-0 ${TIER_BADGE[card.tier]}`}>
                      {card.tier}
                    </span>
                    <p className="text-stone-100 font-bold text-sm leading-tight">{card.title}</p>
                  </div>

                  {/* Flavor */}
                  <div className="px-3 pb-1">
                    <p className="text-stone-300 text-xs leading-relaxed">"{card.flavor}"</p>
                  </div>

                  {/* History note */}
                  <div className="px-3 pb-2">
                    <p className="text-stone-400 text-xs italic leading-relaxed">{card.historyNote}</p>
                    <a
                      href={card.wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-400 text-xs transition"
                    >
                      Learn more →
                    </a>
                  </div>

                  {/* Objective + progress */}
                  <div className="px-3 pb-2 space-y-1.5">
                    <p className="text-stone-400 text-xs uppercase tracking-wide">{objectiveLabel(card)}</p>
                    {prog !== null && (
                      <div>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-stone-400">{prog.current} / {prog.target}</span>
                          <span className="text-stone-500">{fillPct}%</span>
                        </div>
                        <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              card.tier === 'easy' ? 'bg-amber-500' :
                              card.tier === 'medium' ? 'bg-blue-500' :
                              card.tier === 'hard' ? 'bg-red-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Reward / penalty */}
                  <div className="px-3 pb-3 flex items-center justify-between">
                    <span className="text-green-400 font-bold text-sm">+${card.reward.toLocaleString()}</span>
                    <span className="text-amber-600 text-xs">⚠ costs ${card.reward.toLocaleString()} if unfinished</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Draw card button */}
        <div className="px-3 py-3 border-t border-stone-700 flex-shrink-0">
          {canDraw ? (
            <button
              onClick={onDrawCard}
              className="w-full py-2 bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold rounded uppercase tracking-wide text-sm transition"
            >
              Draw Card
            </button>
          ) : missions.length >= 3 ? (
            <p className="text-center text-stone-500 text-xs italic">Holding maximum missions (3/3)</p>
          ) : (
            <p className="text-center text-stone-500 text-xs italic">Take your turn to draw a card</p>
          )}
        </div>
      </div>
    </div>
  )
}
