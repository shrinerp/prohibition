import React, { useEffect, useState } from 'react'

interface LedgerEntry {
  id: number
  season: number
  type: string
  amount: number
  description: string
  city_name: string | null
}

const TYPE_ICON: Record<string, string> = {
  sell:          '💰',
  sell_all:      '💰',
  buy:           '🛒',
  bribe:         '🤝',
  claim_city:    '🏙️',
  upgrade_still: '⚗️',
  buy_vehicle:   '🚗',
  police_cash:   '🚔',
  police_bribe:  '🚔',
  trap_penalty:  '🪤',
  toll_paid:     '💸',
  toll_received: '💵',
  mission:       '🎯',
  jazz_income:   '🎵',
  vehicle_repair:'🔧',
  sell_vehicle:  '🚗',
}

export default function LedgerDialog({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')

  useEffect(() => {
    fetch(`/api/games/${gameId}/ledger`)
      .then(r => r.json())
      .then(d => { if (d.success) setEntries(d.entries) })
      .finally(() => setLoading(false))
  }, [gameId])

  const filtered = filter === 'all' ? entries
    : filter === 'income' ? entries.filter(e => e.amount > 0)
    : entries.filter(e => e.amount < 0)

  const totalIncome  = entries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const totalExpense = entries.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />

      <div
        className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-[520px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-700 flex-shrink-0">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider">Transaction History</p>
            <p className="text-amber-300 font-bold">Ledger</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none cursor-pointer">✕</button>
        </div>

        {/* Summary + filter */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-stone-800 flex-shrink-0 gap-3">
          <div className="flex gap-4 text-xs">
            <span className="text-green-400">+${totalIncome.toLocaleString()} in</span>
            <span className="text-red-400">${totalExpense.toLocaleString()} out</span>
            <span className="text-stone-400 font-semibold">Net: ${(totalIncome + totalExpense).toLocaleString()}</span>
          </div>
          <div className="flex gap-1">
            {(['all', 'income', 'expense'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded text-xs capitalize cursor-pointer transition ${filter === f ? 'bg-amber-700 text-amber-100' : 'bg-stone-800 text-stone-400 hover:bg-stone-700'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Entries */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-stone-500 text-sm text-center py-8">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-stone-500 text-sm text-center py-8">No transactions yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-b border-stone-800 last:border-0 hover:bg-stone-800/40">
                    <td className="px-4 py-2 text-stone-500 tabular-nums text-xs w-10 text-right">{e.season}</td>
                    <td className="px-2 py-2 text-center w-7">{TYPE_ICON[e.type] ?? '·'}</td>
                    <td className="px-2 py-2 text-stone-300">
                      {e.description}
                      {e.city_name && (
                        <span className="text-stone-500 text-xs ml-1.5">· {e.city_name}</span>
                      )}
                    </td>
                    <td className={`px-4 py-2 text-right tabular-nums font-bold text-sm ${e.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {e.amount > 0 ? '+' : ''}${Math.abs(e.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
