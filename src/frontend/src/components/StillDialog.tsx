import React from 'react'

interface TierSpec {
  name: string
  baseOutput: number
  heatPerSeason: number
  cost: number
}

const TIER_IMAGES: Record<number, string> = {
  1: '/stills/tier1.png',
  2: '/stills/tier2.png',
  3: '/stills/tier3.png',
  4: '/stills/tier4.png',
  5: '/stills/tier5.png',
}

const TIERS: Record<number, TierSpec> = {
  1: { name: 'Stills',              baseOutput: 2,  heatPerSeason: 1,  cost: 200  },
  2: { name: 'Filters & Barrels',   baseOutput: 4,  heatPerSeason: 2,  cost: 500  },
  3: { name: 'Aging Tanks',         baseOutput: 7,  heatPerSeason: 4,  cost: 1000 },
  4: { name: 'Botanical Infusers',  baseOutput: 11, heatPerSeason: 7,  cost: 2000 },
  5: { name: 'Master Distillery',   baseOutput: 17, heatPerSeason: 12, cost: 4000 },
}

// Hillbilly gets 20% upgrade cost discount (mirrors server-side applyUpgradeCostModifier)
function upgradeCost(targetTier: number, characterClass: string): number {
  const base = TIERS[targetTier]?.cost ?? 0
  if (characterClass === 'hillbilly') return Math.floor(base * 0.8)
  return base
}

interface Distillery {
  id: number
  cityId: number
  tier: number
  primaryAlcohol: string
  cityName: string
}

interface StillDialogProps {
  distilleries: Distillery[]
  currentCityId: number | null
  characterClass: string
  cash: number
  onUpgrade: (cityId: number) => void
  onClose: () => void
}

function TierBar({ tier }: { tier: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`h-1.5 w-5 rounded-sm ${i < tier ? 'bg-amber-500' : 'bg-stone-700'}`} />
      ))}
    </div>
  )
}

export default function StillDialog({
  distilleries, currentCityId, characterClass, cash, onUpgrade, onClose
}: StillDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-[420px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider">Operations</p>
            <p className="text-amber-300 font-bold">Upgrade Still</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          <p className="text-xs text-stone-500">
            Cash: <span className="text-green-400 font-bold">${cash.toLocaleString()}</span>
          </p>

          {distilleries.length === 0 && (
            <p className="text-stone-500 text-sm italic">You have no distilleries.</p>
          )}

          {distilleries.map(d => {
            const current   = TIERS[d.tier]
            const next      = TIERS[d.tier + 1]
            const cost      = next ? upgradeCost(d.tier + 1, characterClass) : 0
            const isHere    = d.cityId === currentCityId
            const canAfford = cash >= cost
            const maxTier   = d.tier >= 5

            return (
              <div key={d.id} className={`rounded border overflow-hidden ${isHere ? 'border-amber-700' : 'border-stone-700'}`}>
                {/* Tier image — next tier if upgradeable, current if maxed */}
                <div className="relative h-44 bg-stone-800 overflow-hidden">
                  <img
                    src={TIER_IMAGES[maxTier ? d.tier : d.tier + 1]}
                    alt={maxTier ? `Tier ${d.tier}` : `Tier ${d.tier + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: 'sepia(0.55) contrast(1.1) brightness(0.85)' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

                  {/* City label top-left */}
                  <div className="absolute top-2 left-3">
                    <p className="text-amber-300 text-xs font-bold drop-shadow">⌂ {d.cityName}</p>
                    <p className="text-stone-300 text-[10px] capitalize drop-shadow">{d.primaryAlcohol}</p>
                  </div>

                  {/* Tier badge top-right */}
                  {maxTier ? (
                    <div className="absolute top-2 right-2 bg-amber-700/80 text-amber-200 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded">Max</div>
                  ) : (
                    <div className="absolute top-2 right-2 bg-black/60 text-stone-300 text-[10px] px-1.5 py-0.5 rounded">
                      Tier {d.tier} → <span className="text-amber-300 font-bold">{d.tier + 1}</span>
                    </div>
                  )}
                  {!isHere && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-stone-400 text-[10px] px-1.5 py-0.5 rounded italic">not here</div>
                  )}
                </div>

                {/* Stats + upgrade button */}
                <div className="p-3 space-y-2 bg-stone-800">
                  <div className="flex justify-between text-xs text-stone-500">
                    <span>Output: <span className="text-green-400 font-semibold">{current?.baseOutput} u/season</span></span>
                    <span>Heat: <span className="text-red-400">+{current?.heatPerSeason}/season</span></span>
                  </div>
                  <TierBar tier={d.tier} />

                  {maxTier ? (
                    <p className="text-xs text-amber-600 font-bold uppercase text-center pt-1">Master Distillery — fully upgraded</p>
                  ) : (
                    <div className="space-y-1 border-t border-stone-700 pt-2">
                      <div className="flex justify-between text-xs text-stone-500">
                        <span>After upgrade: <span className="text-green-300">{next?.baseOutput} u/season</span></span>
                        <span>Heat: <span className="text-red-300">+{next?.heatPerSeason}/season</span></span>
                      </div>
                      {characterClass === 'hillbilly' && (
                        <p className="text-xs text-amber-600">Hillbilly discount applied (−20%)</p>
                      )}
                      <button
                        disabled={!isHere || !canAfford}
                        onClick={() => { onUpgrade(d.cityId); onClose() }}
                        className="w-full mt-1 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 font-bold text-sm rounded uppercase tracking-wide transition"
                      >
                        {!isHere ? 'Must be at this city' : `Upgrade — $${cost.toLocaleString()}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
