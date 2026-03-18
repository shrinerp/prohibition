import React from 'react'
import { getMissionCardDisplay } from '../data/missions'

interface DrawnCardDialogProps {
  cardId: number
  onClose: () => void
}

const TIER_BADGE: Record<string, string> = {
  easy:      'text-amber-400 border-amber-600 bg-amber-900/40',
  medium:    'text-blue-400 border-blue-600 bg-blue-900/40',
  hard:      'text-red-400 border-red-600 bg-red-900/40',
  legendary: 'text-purple-400 border-purple-600 bg-purple-900/40',
}

const TIER_BORDER: Record<string, string> = {
  easy:      'border-amber-700',
  medium:    'border-blue-700',
  hard:      'border-red-800',
  legendary: 'border-purple-800',
}

function objectiveLabel(card: ReturnType<typeof getMissionCardDisplay>): string {
  if (!card) return ''
  const p = card.params as Record<string, number | string>
  switch (card.objectiveType) {
    case 'cash_gte':              return `Hold $${Number(p.target).toLocaleString()} cash`
    case 'cities_owned_gte':      return `Own ${p.target} cities`
    case 'vehicles_owned_gte':    return `Own ${p.target} vehicles`
    case 'distillery_tier_gte':   return `Reach Tier-${p.target} distillery`
    case 'total_cargo_units_gte': return `Carry ${p.target} cargo units`
    case 'cargo_units_of_type_gte': return `Carry ${p.target} ${p.alcoholType} units`
    case 'heat_at_most':          return `Heat ≤ ${p.target}`
    case 'heat_at_least':         return `Heat ≥ ${p.target}`
    case 'total_sold_units':      return `Sell ${p.target} total units`
    case 'sold_units_of_type':    return `Sell ${p.target} ${p.alcoholType} units`
    case 'total_cash_earned':     return `Earn $${Number(p.target).toLocaleString()} total`
    case 'officials_bribed':      return `Bribe ${p.target} officials`
    case 'cities_visited':        return `Visit ${p.target} cities`
    case 'turns_without_arrest':  return `${p.target} clean seasons`
    case 'sabotages_completed':   return `Sabotage ${p.target} rivals`
    default:                      return card.objectiveType
  }
}

export default function DrawnCardDialog({ cardId, onClose }: DrawnCardDialogProps) {
  const card = getMissionCardDisplay(cardId)
  if (!card) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />

      <div className={`relative bg-stone-900 border-2 rounded-xl shadow-2xl w-80 overflow-hidden ${TIER_BORDER[card.tier]}`}>
        {/* Header */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs text-stone-500 uppercase tracking-widest mb-2">Mission Drawn</p>
          <div className="flex items-start gap-2 mb-1">
            <span className={`text-xs font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 flex-shrink-0 ${TIER_BADGE[card.tier]}`}>
              {card.tier}
            </span>
            <p className="text-stone-100 font-bold text-base leading-tight">{card.title}</p>
          </div>
          <p className="text-xs font-semibold text-stone-200 mt-1">
            Goal: <span className="text-amber-300">{objectiveLabel(card)}</span>
          </p>
        </div>

        {/* Flavor */}
        <div className="px-4 py-2 border-t border-stone-800">
          <p className="text-stone-300 text-sm italic leading-relaxed">{card.flavor}</p>
        </div>

        {/* History note */}
        <div className="px-4 py-2 border-t border-stone-800">
          <p className="text-stone-400 text-xs leading-relaxed">{card.historyNote}</p>
          <a href={card.wikiUrl} target="_blank" rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-400 text-xs transition mt-1 inline-block">
            Learn more →
          </a>
        </div>

        {/* Reward */}
        <div className="px-4 py-3 border-t border-stone-800 flex items-center justify-between">
          <span className="text-green-400 font-bold">+${card.reward.toLocaleString()} on completion</span>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2 bg-amber-700 hover:bg-amber-600 text-stone-100 font-bold rounded uppercase tracking-wide text-sm transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
