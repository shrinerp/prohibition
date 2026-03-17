import React, { useEffect, useState } from 'react'

interface PlayerNetWorth {
  playerId: number
  isYou: boolean
  isNpc: boolean
  name: string
  components: {
    cash: number
    inventory: number
    distilleries: number
    vehicles: number
    cities: number
  }
  total: number
}

interface NetWorthDialogProps {
  gameId: string
  onClose: () => void
}

const COMPONENT_LABELS: Array<{ key: keyof PlayerNetWorth['components']; label: string; color: string }> = [
  { key: 'cash',        label: 'Cash',         color: 'bg-green-500' },
  { key: 'inventory',   label: 'Cargo',        color: 'bg-amber-500' },
  { key: 'distilleries',label: 'Stills',       color: 'bg-orange-500' },
  { key: 'vehicles',    label: 'Fleet',        color: 'bg-blue-500' },
  { key: 'cities',      label: 'Cities',       color: 'bg-purple-500' },
]

export default function NetWorthDialog({ gameId, onClose }: NetWorthDialogProps) {
  const [players, setPlayers] = useState<PlayerNetWorth[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/games/${gameId}/networth`)
      .then(r => r.json())
      .then(d => { if (d.success) setPlayers(d.data.players) })
      .finally(() => setLoading(false))
  }, [gameId])

  const maxTotal = players[0]?.total ?? 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />

      <div
        className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-[480px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-700 flex-shrink-0">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider">Standings</p>
            <p className="text-amber-300 font-bold">Net Worth</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">✕</button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 px-5 py-2 border-b border-stone-800 flex-shrink-0 flex-wrap">
          {COMPONENT_LABELS.map(c => (
            <div key={c.key} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${c.color}`} />
              <span className="text-xs text-stone-400">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-stone-500 text-sm text-center py-6">Loading…</p>
          ) : (
            players.map((p, rank) => (
              <div key={p.playerId} className={`rounded-lg p-3 border ${p.isYou ? 'border-amber-600 bg-stone-800' : 'border-stone-700 bg-stone-800/60'}`}>
                {/* Name row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold w-5 text-center ${rank === 0 ? 'text-amber-400' : rank === 1 ? 'text-stone-300' : rank === 2 ? 'text-orange-700' : 'text-stone-600'}`}>
                      #{rank + 1}
                    </span>
                    <span className={`text-sm font-bold ${p.isYou ? 'text-amber-300' : 'text-stone-200'}`}>
                      {p.name}{p.isYou && <span className="text-xs text-stone-500 font-normal ml-1">(you)</span>}
                    </span>
                  </div>
                  <span className="text-green-400 font-bold tabular-nums">${p.total.toLocaleString()}</span>
                </div>

                {/* Stacked bar — width relative to leader so bars never overflow */}
                <div className="flex h-2.5 rounded overflow-hidden gap-px mb-2">
                  <div
                    className="flex h-full gap-px overflow-hidden rounded"
                    style={{ width: `${(p.total / maxTotal) * 100}%` }}
                  >
                    {COMPONENT_LABELS.map(c => {
                      const val = p.components[c.key]
                      const pct = p.total > 0 ? (val / p.total) * 100 : 0
                      if (pct < 0.5) return null
                      return (
                        <div
                          key={c.key}
                          className={`${c.color} opacity-80 h-full`}
                          style={{ width: `${pct}%` }}
                          title={`${c.label}: $${val.toLocaleString()}`}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Breakdown */}
                <div className="grid grid-cols-5 gap-1 text-center">
                  {COMPONENT_LABELS.map(c => (
                    <div key={c.key}>
                      <p className="text-stone-500 text-[10px]">{c.label}</p>
                      <p className="text-stone-300 text-xs tabular-nums">${p.components[c.key].toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
