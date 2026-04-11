import React, { useState } from 'react'

interface HeatMeterProps {
  heat: number  // 0-100
}

export default function HeatMeter({ heat }: HeatMeterProps) {
  const pct = Math.min(100, Math.max(0, heat))
  const color = pct < 30 ? 'bg-green-500' : pct < 60 ? 'bg-yellow-500' : 'bg-red-500'
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs text-stone-400">
        <div className="flex items-center gap-1">
          <span className="uppercase tracking-wider">Heat</span>
          <button
            onClick={() => setShowHelp(v => !v)}
            className="w-4 h-4 rounded-full bg-stone-600 hover:bg-stone-500 text-stone-300 hover:text-white flex items-center justify-center text-[10px] font-bold leading-none transition"
            title="What is heat?"
          >
            ?
          </button>
        </div>
        <span className={`font-bold ${pct >= 60 ? 'text-red-400' : pct >= 30 ? 'text-yellow-400' : 'text-green-400'}`}>
          {pct}
        </span>
      </div>

      <div className="h-3 bg-stone-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Help popup — fixed overlay over the whole screen */}
      {showHelp && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHelp(false)} />
          <div
            className="relative w-full max-w-xl bg-stone-900 border border-stone-600 rounded-xl shadow-2xl text-xs overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-700">
              <span className="text-amber-300 font-bold uppercase tracking-wider text-sm">
                🌡️ Heat Explained
              </span>
              <button
                onClick={() => setShowHelp(false)}
                className="text-stone-500 hover:text-stone-200 text-lg leading-none transition"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Intro */}
              <p className="text-stone-300 leading-relaxed text-[13px]">
                Heat represents how closely the law is watching you. The higher it climbs, the more likely police will stop you when you move — and the harsher the consequences.
              </p>

              {/* Police stop thresholds */}
              <div>
                <p className="text-stone-400 font-semibold uppercase tracking-wider text-[10px] mb-2">Police stop consequences</p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-stone-500 text-[10px] uppercase tracking-wider">
                      <th className="text-left py-1 pr-4 font-semibold">Heat range</th>
                      <th className="text-left py-1 pr-4 font-semibold">Stop chance</th>
                      <th className="text-left py-1 font-semibold">What they take</th>
                    </tr>
                  </thead>
                  <tbody className="text-stone-300">
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4"><span className="text-green-400 font-bold">0 – 29</span></td>
                      <td className="py-1.5 pr-4">Low</td>
                      <td className="py-1.5 text-stone-400 italic">Nothing found</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4"><span className="text-yellow-400 font-bold">30 – 49</span></td>
                      <td className="py-1.5 pr-4">Moderate</td>
                      <td className="py-1.5">Half your cargo</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4"><span className="text-red-400 font-bold">50 – 100</span></td>
                      <td className="py-1.5 pr-4">High</td>
                      <td className="py-1.5">All cargo <span className="text-red-400">+</span> 50% cash</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* What raises heat */}
              <div>
                <p className="text-stone-400 font-semibold uppercase tracking-wider text-[10px] mb-2">What raises heat</p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-stone-500 text-[10px] uppercase tracking-wider">
                      <th className="text-left py-1 pr-4 font-semibold">Source</th>
                      <th className="text-left py-1 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-stone-300">
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Each city you own</td>
                      <td className="py-1.5 text-red-400 font-semibold">+1 minimum</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Each still tier 2+</td>
                      <td className="py-1.5 text-red-400 font-semibold">+1 minimum</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Moving with cargo</td>
                      <td className="py-1.5 text-red-400 font-semibold">+1 per move</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Hostile takeover / steal</td>
                      <td className="py-1.5 text-red-400 font-semibold">+10 – +15</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Sabotage a rival's still</td>
                      <td className="py-1.5 text-red-400 font-semibold">+10 × still tier</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Failed police run</td>
                      <td className="py-1.5 text-red-400 font-semibold">+25 immediately</td>
                    </tr>
                  </tbody>
                </table>
              </div>


              {/* What lowers heat */}
              <div>
                <p className="text-stone-400 font-semibold uppercase tracking-wider text-[10px] mb-2">What lowers heat faster</p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-stone-500 text-[10px] uppercase tracking-wider">
                      <th className="text-left py-1 pr-4 font-semibold">Action</th>
                      <th className="text-left py-1 font-semibold">Effect</th>
                    </tr>
                  </thead>
                  <tbody className="text-stone-300">
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Submit to police (low heat)</td>
                      <td className="py-1.5 text-green-400 font-semibold">−10, nothing seized</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Submit to police (mid heat)</td>
                      <td className="py-1.5 text-green-400 font-semibold">−15, half cargo seized</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Submit to police (high heat)</td>
                      <td className="py-1.5 text-green-400 font-semibold">−30, all cargo + 50% cash</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4">Bribe a city official</td>
                      <td className="py-1.5 text-green-400 font-semibold">No stops in that city</td>
                    </tr>
                    <tr className="border-t border-stone-800">
                      <td className="py-1.5 pr-4"><span className="text-purple-300 font-semibold">Priest / Nun</span> character</td>
                      <td className="py-1.5 text-green-400 font-semibold">Decay 2× faster (−16/season)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-stone-500 italic leading-relaxed border-t border-stone-700 pt-3 text-[11px]">
                Tip: bribe officials in cities you pass through regularly — it's the most reliable way to keep moving freely while growing your empire.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
