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

interface ShameEntry {
  player_name: string
  character_class: string
  net_worth: number
  failed_missions: number
  seasons_jailed: number
  total_seasons: number
  ended_at: string
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

const SEASON_FILTERS = [13, 26, 52] as const
type SeasonFilter = typeof SEASON_FILTERS[number]

// ── Hall of Shame list view ──────────────────────────────────────────────────

function ShameListView() {
  const [filter, setFilter] = useState<SeasonFilter>(52)
  const [entries, setEntries] = useState<ShameEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/public/shame?seasons=${filter}`)
      .then(r => r.json())
      .then((d: { success: boolean; data?: { entries: ShameEntry[] } }) => {
        if (d.success && d.data) setEntries(d.data.entries)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [filter])

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="relative overflow-hidden border-b border-stone-800">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 to-stone-950" />
        <div className="relative max-w-3xl mx-auto px-6 py-12 text-center space-y-2">
          <img src="/logo.png" alt="Prohibition" className="h-16 w-auto mx-auto mb-4 drop-shadow-2xl" />
          <h1 className="text-4xl font-black uppercase tracking-widest text-amber-400">Wall of Shame</h1>
          <p className="text-stone-500 text-sm">Last-place finishers — no login required</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Season filter tabs */}
        <div className="flex gap-2">
          {SEASON_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 text-sm font-semibold rounded transition cursor-pointer ${
                filter === s
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200'
              }`}
            >
              {s} seasons
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-amber-400 animate-pulse text-center py-12 tracking-widest uppercase text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-stone-600 py-12">No completed {filter}-season games yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div
                key={e.player_name + e.ended_at}
                className="flex items-center gap-4 bg-stone-900 border border-stone-800 rounded-xl px-4 py-3"
              >
                <span className="text-stone-600 text-sm tabular-nums w-6 text-right flex-shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-stone-200 truncate">{e.player_name}</p>
                  <p className="text-stone-600 text-xs">{e.character_class} · {formatDate(e.ended_at)}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {e.failed_missions > 0 && (
                    <span className="text-red-500 text-xs" title={`${e.failed_missions} failed missions`}>
                      🃏 {e.failed_missions}
                    </span>
                  )}
                  {e.seasons_jailed > 0 && (
                    <span className="text-stone-500 text-xs" title={`${e.seasons_jailed} seasons jailed`}>
                      ⛓️ {e.seasons_jailed}
                    </span>
                  )}
                  <span className="text-red-400 font-black tabular-nums">${e.net_worth.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
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
