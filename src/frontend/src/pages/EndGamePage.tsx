import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

interface Standing {
  rank: number
  playerName: string
  netWorth: number
  liquidCash: number
}

export default function EndGamePage() {
  const { id: gameId } = useParams<{ id: string }>()
  const [recap, setRecap]         = useState<string | null>(null)
  const [standings, setStandings] = useState<Standing[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!gameId) return
    fetch(`/api/games/${gameId}/recap`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          setRecap(data.data.recap)
        }
      })
      .finally(() => setLoading(false))
  }, [gameId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-stone-400 animate-pulse">Tallying fortunes…</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <h1 className="text-4xl font-black text-amber-400 uppercase tracking-widest text-center">
        Prohibition Ends
      </h1>
      <p className="text-stone-400 text-center">Winter 1933 — The 21st Amendment has passed.</p>

      {standings.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-amber-300 mb-4">Final Standings</h2>
          <ol className="space-y-2">
            {standings.map(s => (
              <li key={s.rank} className={`flex justify-between p-3 rounded ${s.rank === 1 ? 'bg-amber-900/40 border border-amber-600' : 'bg-stone-800'}`}>
                <span className="font-bold">
                  {s.rank === 1 ? '👑 ' : `${s.rank}. `}{s.playerName}
                </span>
                <span className="text-green-400 font-bold">${s.netWorth.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {recap && (
        <section>
          <h2 className="text-xl font-bold text-amber-300 mb-4">Secret History</h2>
          <div className="bg-stone-800 rounded p-6 prose prose-invert prose-amber max-w-none">
            <pre className="whitespace-pre-wrap text-stone-300 text-sm leading-relaxed font-sans">
              {recap}
            </pre>
          </div>
        </section>
      )}
    </div>
  )
}
