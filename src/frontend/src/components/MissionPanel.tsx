import React from 'react'
import { getMissionCardDisplay, type MissionCardDisplay } from '../data/missions'

interface HeldMission {
  id: number
  cardId: number
  progress: Record<string, unknown>
  assignedSeason: number
}

interface PlayerState {
  cash: number
  heat: number
  vehiclesOwned: number
  maxDistilleryTier: number
  totalCargoUnits: number
  cargoByType: Record<string, number>
  totalCashEarned: number
  consecutiveCleanSeasons: number
  citiesOwned: number
}

interface MissionPanelProps {
  missions: HeldMission[]
  onClose: () => void
  onDrawCard: () => void
  canDraw: boolean
  playerState?: PlayerState
}

const TIER_BADGE: Record<string, string> = {
  easy:       'text-amber-400 border-amber-600 bg-amber-900/40',
  medium:     'text-blue-400 border-blue-600 bg-blue-900/40',
  hard:       'text-red-400 border-red-600 bg-red-900/40',
  legendary:  'text-purple-400 border-purple-600 bg-purple-900/40',
}

const TIER_BORDER: Record<string, string> = {
  easy:       'border-amber-700',
  medium:     'border-blue-700',
  hard:       'border-red-800',
  legendary:  'border-purple-800',
}

const TIER_BAR: Record<string, string> = {
  easy: 'bg-amber-500', medium: 'bg-blue-500', hard: 'bg-red-500', legendary: 'bg-purple-500',
}

interface ProgressResult {
  current: number
  target: number
  fillPct: number
  label: string
}

function computeProgress(
  card: MissionCardDisplay,
  progressData: Record<string, unknown>,
  playerState?: PlayerState
): ProgressResult | null {
  const params = card.params as Record<string, number | string>
  const target = Number(params.target ?? params.count ?? 0)

  function simpleProgress(current: number): ProgressResult {
    return {
      current,
      target,
      fillPct: Math.min(100, Math.round((current / Math.max(1, target)) * 100)),
      label: `${current} / ${target}`,
    }
  }

  switch (card.objectiveType) {
    // ── Cumulative (always tracked via progressData) ──────────────────────────
    case 'total_sold_units': {
      const sold = (progressData.sold_units ?? {}) as Record<string, number>
      return simpleProgress(Object.values(sold).reduce((a, b) => a + b, 0))
    }
    case 'sold_units_of_type': {
      const sold = (progressData.sold_units ?? {}) as Record<string, number>
      return simpleProgress(sold[String(params.alcoholType)] ?? 0)
    }
    case 'officials_bribed':
      return simpleProgress(Number(progressData.officials_bribed) || 0)
    case 'cities_visited': {
      const visited = (progressData.visited_city_ids ?? []) as number[]
      return simpleProgress(visited.length)
    }
    case 'sabotages_completed':
      return simpleProgress(Number(progressData.sabotages_completed) || 0)

    // ── Snapshot (need playerState) ───────────────────────────────────────────
    case 'cash_gte':
      if (!playerState) return null
      return simpleProgress(playerState.cash)
    case 'cities_owned_gte':
      if (!playerState) return null
      return simpleProgress(playerState.citiesOwned)
    case 'vehicles_owned_gte':
      if (!playerState) return null
      return simpleProgress(playerState.vehiclesOwned)
    case 'distillery_tier_gte':
      if (!playerState) return null
      return simpleProgress(playerState.maxDistilleryTier)
    case 'total_cargo_units_gte':
      if (!playerState) return null
      return simpleProgress(playerState.totalCargoUnits)
    case 'cargo_units_of_type_gte': {
      if (!playerState) return null
      const current = playerState.cargoByType[String(params.alcoholType)] ?? 0
      return simpleProgress(current)
    }
    case 'heat_at_most': {
      if (!playerState) return null
      const current = playerState.heat
      const fillPct = current <= target ? 100 : Math.round((target / current) * 100)
      return { current, target, fillPct, label: `${current} / ≤ ${target}` }
    }
    case 'heat_at_least':
      if (!playerState) return null
      return simpleProgress(playerState.heat)
    case 'total_cash_earned':
      if (!playerState) return null
      return simpleProgress(playerState.totalCashEarned)
    case 'turns_without_arrest':
      if (!playerState) return null
      return simpleProgress(playerState.consecutiveCleanSeasons)

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
    case 'turns_without_arrest':  return `${params.target} clean seasons`
    case 'sabotages_completed':   return `Sabotage ${params.target} rivals`
    default:                      return card.objectiveType
  }
}

export default function MissionPanel({ missions, onClose, onDrawCard, canDraw, playerState }: MissionPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-[480px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider">Mission Cards</p>
            <p className="text-amber-300 font-bold">{missions.length}/3 held</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">✕</button>
        </div>

        {/* Card list */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {missions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-stone-400 text-sm">No missions held.</p>
              <p className="text-stone-600 text-xs mt-1">Draw a card to get started.</p>
            </div>
          ) : (
            missions.map(m => {
              const card = getMissionCardDisplay(m.cardId)
              if (!card) return null
              const prog = computeProgress(card, m.progress, playerState)
              return (
                <div key={m.id} className={`bg-stone-800 border rounded-lg overflow-hidden ${TIER_BORDER[card.tier]}`}>
                  <div className="px-3 pt-3 pb-1 flex items-start gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 flex-shrink-0 ${TIER_BADGE[card.tier]}`}>
                      {card.tier}
                    </span>
                    <p className="text-stone-100 font-bold text-sm leading-tight">{card.title}</p>
                  </div>

                  {/* Goal label — prominent, right after tier badge + title */}
                  <p className="px-3 pb-1 text-xs font-semibold text-stone-200">
                    Goal: <span className="text-amber-300">{objectiveLabel(card)}</span>
                  </p>

                  <div className="px-3 pb-1">
                    <p className="text-stone-300 text-xs leading-relaxed">{card.flavor}</p>
                  </div>

                  <div className="px-3 pb-2">
                    <p className="text-stone-400 text-xs italic leading-relaxed">{card.historyNote}</p>
                    <a href={card.wikiUrl} target="_blank" rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-400 text-xs transition">
                      Learn more →
                    </a>
                  </div>

                  {/* Progress bar */}
                  <div className="px-3 pb-2 space-y-1.5">
                    {prog !== null && (
                      <div>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-stone-400">{prog.label}</span>
                          <span className="text-stone-500">{prog.fillPct}%</span>
                        </div>
                        <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${TIER_BAR[card.tier]}`}
                            style={{ width: `${prog.fillPct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-3 pb-3 flex items-center justify-between">
                    <span className="text-green-400 font-bold text-sm">+${card.reward.toLocaleString()}</span>
                    <span className="text-amber-600 text-xs">⚠ costs ${card.reward.toLocaleString()} if unfinished</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-stone-700 flex-shrink-0">
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
