import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

interface PublicPlayer {
  player_name: string
  character_class: string
  rank: number
  net_worth: number
  failed_missions: number
  seasons_jailed: number
  total_seasons: number
  ended_at: string
  game_name: string | null
}

interface GameEntry extends PublicPlayer {
  game_id: string
}

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Per-game standings view ──────────────────────────────────────────────────

function GameResultsView({ gameId }: { gameId: string }) {
  const [players, setPlayers] = useState<PublicPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/public/results/${gameId}`)
      .then(r => r.json())
      .then((d: { success: boolean; data?: { players: PublicPlayer[] }; message?: string }) => {
        if (d.success && d.data) setPlayers(d.data.players)
        else setError(d.message ?? 'Game not found')
      })
      .catch(() => setError('Failed to load results'))
      .finally(() => setLoading(false))
  }, [gameId])

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-950">
        <p className="text-amber-400 animate-pulse text-lg tracking-widest uppercase">Loading results…</p>
      </div>
    )
  }

  if (error || players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-950 gap-4">
        <p className="text-stone-400">{error ?? 'No results found.'}</p>
        <Link to="/shame" className="text-amber-500 hover:text-amber-400 text-sm underline">← Hall of Shame</Link>
      </div>
    )
  }

  const gameName = players[0].game_name ?? 'Game Results'
  const lastPlace = players[players.length - 1]

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="relative overflow-hidden border-b border-stone-800">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/30 to-stone-950" />
        <div className="relative max-w-3xl mx-auto px-6 py-12 text-center space-y-2">
          <img src="/logo.png" alt="Prohibition" className="h-16 w-auto mx-auto mb-4 drop-shadow-2xl" />
          <h1 className="text-4xl font-black uppercase tracking-widest text-amber-400">{gameName}</h1>
          <p className="text-stone-500 text-sm">{formatDate(players[0].ended_at)} · {players[0].total_seasons} seasons</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-xs text-stone-500 uppercase tracking-widest mb-4">Final Standings</h2>
          <div className="space-y-3">
            {players.map(p => (
              <div
                key={p.player_name + p.rank}
                className={`rounded-xl border p-4 ${
                  p.rank === 1
                    ? 'border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.2)] bg-stone-900'
                    : 'border-stone-700 bg-stone-900/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl leading-none">{RANK_MEDAL[p.rank] ?? `#${p.rank}`}</span>
                    <div>
                      <p className={`font-bold ${p.rank === 1 ? 'text-amber-300' : p.rank === 2 ? 'text-stone-200' : 'text-stone-400'}`}>
                        {p.player_name}
                      </p>
                      <p className="text-stone-600 text-xs">{p.character_class}</p>
                    </div>
                  </div>
                  <span className="text-green-400 font-black text-lg tabular-nums">${p.net_worth.toLocaleString()}</span>
                </div>
                {(p.failed_missions > 0 || p.seasons_jailed > 0) && (
                  <div className="mt-2 flex gap-4 text-xs">
                    {p.failed_missions > 0 && (
                      <span className="text-red-500">🃏 {p.failed_missions} failed mission{p.failed_missions !== 1 ? 's' : ''}</span>
                    )}
                    {p.seasons_jailed > 0 && (
                      <span className="text-stone-500">⛓️ {p.seasons_jailed} season{p.seasons_jailed !== 1 ? 's' : ''} jailed</span>
                    )}
                  </div>
                )}
                {p.rank === players.length && players.length > 1 && (
                  <p className="mt-1 text-xs text-stone-600 italic">🥴 The Fall Guy</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {lastPlace && players.length > 1 && (
          <section className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center">
            <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">Last Place</p>
            <p className="text-stone-300 font-bold">{lastPlace.player_name}</p>
            <p className="text-stone-600 text-xs mt-1">
              {lastPlace.failed_missions > 0 && `${lastPlace.failed_missions} failed mission${lastPlace.failed_missions !== 1 ? 's' : ''}` }
              {lastPlace.failed_missions > 0 && lastPlace.seasons_jailed > 0 && ' · '}
              {lastPlace.seasons_jailed > 0 && `${lastPlace.seasons_jailed} season${lastPlace.seasons_jailed !== 1 ? 's' : ''} behind bars`}
            </p>
          </section>
        )}

        <div className="flex items-center justify-center gap-4 pb-8">
          <Link to="/shame" className="px-6 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm rounded transition">
            ← Hall of Shame
          </Link>
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-300 text-sm rounded transition"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hall of Shame list view ──────────────────────────────────────────────────

function ShameListView() {
  const [entries, setEntries] = useState<GameEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/public/shame')
      .then(r => r.json())
      .then((d: { success: boolean; data?: { entries: GameEntry[] } }) => {
        if (d.success && d.data) setEntries(d.data.entries)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-950">
        <p className="text-amber-400 animate-pulse text-lg tracking-widest uppercase">Loading…</p>
      </div>
    )
  }

  // Group entries by game_id
  const gameIds = [...new Set(entries.map(e => e.game_id))]
  const gameGroups = gameIds.map(id => ({
    gameId: id,
    players: entries.filter(e => e.game_id === id),
  }))

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="relative overflow-hidden border-b border-stone-800">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 to-stone-950" />
        <div className="relative max-w-3xl mx-auto px-6 py-12 text-center space-y-2">
          <img src="/logo.png" alt="Prohibition" className="h-16 w-auto mx-auto mb-4 drop-shadow-2xl" />
          <h1 className="text-4xl font-black uppercase tracking-widest text-amber-400">Hall of Shame</h1>
          <p className="text-stone-500 text-sm">Recent games — no login required</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {gameGroups.length === 0 ? (
          <p className="text-center text-stone-600 py-12">No completed games in the last 30 days.</p>
        ) : (
          gameGroups.map(({ gameId, players }) => {
            const winner = players.find(p => p.rank === 1)
            const gameName = players[0]?.game_name ?? 'Unnamed Game'
            return (
              <Link
                key={gameId}
                to={`/results/${gameId}`}
                className="block bg-stone-900 border border-stone-700 hover:border-stone-500 rounded-xl p-4 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-stone-200">{gameName}</p>
                    <p className="text-stone-600 text-xs mt-0.5">{formatDate(players[0].ended_at)} · {players[0].total_seasons} seasons</p>
                  </div>
                  <span className="text-stone-500 text-xs">View →</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {players.map(p => (
                    <div key={p.player_name + p.rank} className="flex items-center gap-1.5 text-xs">
                      <span>{RANK_MEDAL[p.rank] ?? `#${p.rank}`}</span>
                      <span className={p.rank === 1 ? 'text-amber-300 font-semibold' : 'text-stone-400'}>{p.player_name}</span>
                      {p.failed_missions > 0 && <span className="text-red-600" title={`${p.failed_missions} failed missions`}>🃏</span>}
                      {p.seasons_jailed > 0 && <span className="text-stone-600" title={`${p.seasons_jailed} seasons jailed`}>⛓️</span>}
                    </div>
                  ))}
                </div>
                {winner && (
                  <p className="text-stone-600 text-xs mt-2">
                    Winner: <span className="text-amber-500">{winner.player_name}</span> · ${winner.net_worth.toLocaleString()}
                  </p>
                )}
              </Link>
            )
          })
        )}

        <div className="text-center pb-8">
          <Link to="/" className="text-stone-500 hover:text-stone-400 text-sm underline">← Home</Link>
        </div>
      </div>
    </div>
  )
}

// ── Router component ─────────────────────────────────────────────────────────

export default function ShamePage() {
  const { gameId } = useParams<{ gameId?: string }>()
  return gameId ? <GameResultsView gameId={gameId} /> : <ShameListView />
}
