import React from 'react'

interface HeatMeterProps {
  heat: number  // 0-100
}

export default function HeatMeter({ heat }: HeatMeterProps) {
  const pct = Math.min(100, Math.max(0, heat))
  const color = pct < 30 ? 'bg-green-500' : pct < 60 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-stone-400">
        <span className="uppercase tracking-wider">Heat</span>
        <span className="text-amber-400 font-bold">{pct}</span>
      </div>
      <div className="h-3 bg-stone-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
