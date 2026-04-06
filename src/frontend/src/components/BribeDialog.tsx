import React from 'react'

// Matches server-side calculateLongTermBribeCost + TIER_BRIBE_MULTIPLIER
const BRIBE_MULTIPLIER: Record<string, number> = {
  small: 1.0, medium: 1.5, large: 2.5, major: 4.0
}

function longTermBribeCost(populationTier: string): number {
  return Math.floor(500 * (BRIBE_MULTIPLIER[populationTier] ?? 1.0))
}

interface BribeDialogProps {
  cityName: string
  populationTier: string
  currentSeason: number
  characterClass: string
  cash: number
  alreadyBribed: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function BribeDialog({
  cityName, populationTier, currentSeason, characterClass,
  cash, alreadyBribed, onConfirm, onClose
}: BribeDialogProps) {
  const cost     = longTermBribeCost(populationTier)
  const duration = characterClass === 'vixen' ? 6 : 4
  const expiresAt = currentSeason + duration
  const canAfford = cash >= cost

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider">City Hall</p>
            <p className="text-amber-300 font-bold">{cityName}</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {alreadyBribed ? (
            <div className="rounded border border-green-800 bg-green-950/30 p-3 text-center">
              <p className="text-green-400 font-bold text-sm">✓ Officials already paid off here</p>
              <p className="text-stone-500 text-xs mt-1">Police won't stop you in {cityName} until the bribe expires.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <p className="text-stone-300">
                  Pay off the local police captain to look the other way.
                  You won't be stopped by police in <span className="text-amber-300 font-semibold">{cityName}</span> for the next{' '}
                  <span className="text-amber-300 font-semibold">{duration} seasons</span>.
                </p>
                {characterClass === 'vixen' && (
                  <p className="text-xs text-amber-600">Vixen perk: bribe lasts 6 seasons instead of 4.</p>
                )}
                <div className="rounded bg-stone-800 p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-400">City size</span>
                    <span className="text-stone-300 capitalize">{populationTier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Duration</span>
                    <span className="text-stone-300">Seasons {currentSeason + 1}–{expiresAt}</span>
                  </div>
                  <div className="flex justify-between border-t border-stone-700 pt-1 mt-1">
                    <span className="text-stone-400">Cost</span>
                    <span className={`font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                      ${cost.toLocaleString()}
                    </span>
                  </div>
                </div>
                {!canAfford && (
                  <p className="text-xs text-red-400">
                    Need ${(cost - cash).toLocaleString()} more cash.
                  </p>
                )}
              </div>

              <button
                disabled={!canAfford}
                onClick={() => { onConfirm(); onClose() }}
                className="w-full py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 font-bold rounded uppercase tracking-wide text-sm transition"
              >
                Pay ${cost.toLocaleString()}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
