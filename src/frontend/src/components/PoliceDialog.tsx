import React from 'react'

interface PoliceDialogProps {
  heat: number
  bribeCost: number
  populationTier: string
  totalCargo: number
  cash: number
  onSubmit: () => void
  onBribe: () => void
  onRun: () => void
}

function HeatBar({ heat }: { heat: number }) {
  const color = heat >= 70 ? 'bg-red-500' : heat >= 40 ? 'bg-orange-500' : 'bg-yellow-500'
  return (
    <div className="w-full bg-stone-700 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${heat}%` }} />
    </div>
  )
}

function outcomeText(heat: number, cargo: number): string {
  if (heat < 30) return 'Low heat — they probably won\'t find anything.'
  if (heat >= 50) return `High heat — expect to lose all ${cargo} units and half your cash.`
  return `Mid heat — they may seize about half your cargo (${Math.floor(cargo / 2)} units).`
}

export default function PoliceDialog({
  heat, bribeCost, populationTier, totalCargo, cash, onSubmit, onBribe, onRun
}: PoliceDialogProps) {
  const canAffordBribe = cash >= bribeCost

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative bg-stone-900 border-2 border-red-800 rounded-lg shadow-2xl w-96 flex flex-col animate-pulse-once">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-700 text-center">
          <p className="text-3xl mb-1">🚨</p>
          <p className="text-red-400 font-bold text-lg uppercase tracking-widest">Police Stop</p>
          <p className="text-stone-400 text-sm capitalize mt-0.5">{populationTier} city patrol</p>
        </div>

        {/* Heat */}
        <div className="px-5 py-3 border-b border-stone-700 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-stone-400 uppercase tracking-wider">Your Heat</span>
            <span className={`font-bold ${heat >= 70 ? 'text-red-400' : heat >= 40 ? 'text-orange-400' : 'text-yellow-400'}`}>
              {heat}/100
            </span>
          </div>
          <HeatBar heat={heat} />
          <p className="text-xs text-stone-500 italic">{outcomeText(heat, totalCargo)}</p>
        </div>

        {/* Choices */}
        <div className="p-5 space-y-3">
          {/* Submit */}
          <button
            onClick={onSubmit}
            className="w-full rounded border border-stone-600 bg-stone-800 hover:bg-stone-700 p-3 text-left transition"
          >
            <p className="font-bold text-stone-200 text-sm">🙏 Submit to Search</p>
            <p className="text-xs text-stone-500 mt-0.5">
              {heat < 30
                ? 'They find nothing. Heat −5.'
                : heat >= 50
                  ? `Seize all cargo + 50% cash. Heat −10.`
                  : `Seize ~half cargo. Heat −5.`}
            </p>
          </button>

          {/* Bribe */}
          <button
            disabled={!canAffordBribe}
            onClick={onBribe}
            className="w-full rounded border border-amber-700 bg-amber-950/40 hover:bg-amber-900/40 disabled:opacity-40 p-3 text-left transition"
          >
            <p className="font-bold text-amber-300 text-sm">💰 Bribe — ${bribeCost.toLocaleString()}</p>
            <p className="text-xs text-stone-500 mt-0.5">
              {canAffordBribe ? 'Pay to walk free. No heat change.' : `Need $${(bribeCost - cash).toLocaleString()} more cash.`}
            </p>
          </button>

          {/* Run */}
          <button
            onClick={onRun}
            className="w-full rounded border border-red-800 bg-red-950/30 hover:bg-red-900/30 p-3 text-left transition"
          >
            <p className="font-bold text-red-400 text-sm">💨 Make a Run For It</p>
            <p className="text-xs text-stone-500 mt-0.5">
              Roll 2d6. Beat 8 → escape (heat +5). Fail → jail 2 seasons (heat +30).
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
