import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

interface TimingPlayer {
  playerId: number; name: string
  avgSeconds: number; maxSeconds: number; totalSeconds: number; turnCount: number
}

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
  missionsCompleted?: number
  missionsFailed?: number
  missionPenalty?: number
}

const PLACE_LABELS: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH', 5: '5TH' }
const PLACE_FLAVOUR: Record<number, string> = {
  1: 'You built the greatest empire of the Prohibition era.',
  2: 'A formidable operation — but one step short of the throne.',
  3: 'Respectable. The law never caught you.',
  4: 'You survived. Many didn\'t.',
  5: 'The streets ate better bootleggers.',
}

const COMPONENT_LABELS: Array<{ key: keyof PlayerNetWorth['components']; label: string; color: string; bar: string }> = [
  { key: 'cash',         label: 'Cash',    color: 'text-green-400',  bar: 'bg-green-500' },
  { key: 'inventory',    label: 'Cargo',   color: 'text-amber-400',  bar: 'bg-amber-500' },
  { key: 'distilleries', label: 'Stills',  color: 'text-orange-400', bar: 'bg-orange-500' },
  { key: 'vehicles',     label: 'Fleet',   color: 'text-blue-400',   bar: 'bg-blue-500' },
  { key: 'cities',       label: 'Cities',  color: 'text-purple-400', bar: 'bg-purple-500' },
]

const RANK_STYLES: Record<number, { medal: string; ring: string; nameColor: string }> = {
  1: { medal: '🥇', ring: 'border-amber-400 shadow-[0_0_32px_rgba(251,191,36,0.3)]', nameColor: 'text-amber-300' },
  2: { medal: '🥈', ring: 'border-stone-400 shadow-[0_0_16px_rgba(180,180,180,0.2)]', nameColor: 'text-stone-200' },
  3: { medal: '🥉', ring: 'border-orange-700', nameColor: 'text-orange-300' },
}

const SEASON_NAME_SETS: Record<number, string[]> = {
  1: [],
  2: ['Spring', 'Autumn'],
  3: ['Spring', 'Summer', 'Autumn'],
  4: ['Spring', 'Summer', 'Autumn', 'Winter'],
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

function getSeasonLabel(season: number, totalSeasons = 52): string {
  const seasonsPerYear = totalSeasons / 13
  const yearOffset  = Math.floor((season - 1) / seasonsPerYear)
  const seasonIndex = Math.round((season - 1) % seasonsPerYear)
  const names = SEASON_NAME_SETS[seasonsPerYear] ?? []
  const seasonName = names[seasonIndex] ? `${names[seasonIndex]} ` : ''
  return `${seasonName}${1921 + yearOffset}`
}

export default function EndGamePage() {
  const { id: gameId } = useParams<{ id: string }>()
  const [players, setPlayers] = useState<PlayerNetWorth[]>([])
  const [recap, setRecap] = useState<string | null>(null)
  const [totalSeasons, setTotalSeasons] = useState(52)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [timing, setTiming] = useState<TimingPlayer[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!gameId) return
    const nwFetch = fetch(`/api/games/${gameId}/networth`)
      .then(r => r.json())
      .then((nw: { success: boolean; data?: { players: PlayerNetWorth[] }; message?: string }) => {
        if (nw.success && nw.data?.players?.length > 0) {
          setPlayers(nw.data.players)
        } else {
          setFetchError(`Standings unavailable: ${nw.message ?? JSON.stringify(nw)}`)
        }
      })
      .catch(err => setFetchError(`Failed to load results: ${err}`))
    const timingFetch = fetch(`/api/games/${gameId}/timing`)
      .then(r => r.json())
      .then((t: { success: boolean; players?: TimingPlayer[] }) => {
        if (t.success && t.players?.length) setTiming(t.players)
      })
      .catch(() => { /* timing optional */ })
    const rcFetch = fetch(`/api/games/${gameId}/recap`)
      .then(r => r.json())
      .then((rc: { success: boolean; data?: { recap: string } }) => {
        if (rc.success && rc.data?.recap) setRecap(rc.data.recap)
      })
      .catch(() => { /* recap optional */ })
    const stateFetch = fetch(`/api/games/${gameId}/state`)
      .then(r => r.json())
      .then((s: { success: boolean; game?: { totalSeasons?: number } }) => {
        if (s.success && s.game?.totalSeasons) setTotalSeasons(s.game.totalSeasons)
      })
      .catch(() => { /* fall back to 52 */ })
    Promise.all([nwFetch, rcFetch, stateFetch, timingFetch]).finally(() => setLoading(false))
  }, [gameId])

  const me = players.find(p => p.isYou)
  const myRank = me ? players.indexOf(me) + 1 : null
  const maxTotal = players[0]?.total ?? 1

  async function handleShare() {
    const url = `${window.location.origin}/results/${gameId}`
    const winner = players[0]
    const shareData = {
      title: 'Prohibitioner Results',
      text: winner
        ? `${winner.name} just won Prohibition with $${winner.total.toLocaleString()}! Check the final standings.`
        : 'Check out these Prohibition results!',
      url,
    }
    if (navigator.canShare?.(shareData)) {
      try { await navigator.share(shareData) } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-950">
        <p className="text-amber-400 animate-pulse text-lg tracking-widest uppercase">Tallying fortunes…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-stone-800">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-950/30 to-stone-950" />
        <div className="relative max-w-4xl mx-auto px-6 py-16 text-center space-y-4">
          <img src="/logo.png" alt="Prohibition" className="h-24 w-auto mx-auto mb-4 drop-shadow-2xl" />
          <h1 className="text-5xl font-black uppercase tracking-widest text-amber-400">
            Prohibition Ends
          </h1>
          <p className="text-stone-400 text-lg">{getSeasonLabel(totalSeasons, totalSeasons)} — The 21st Amendment has passed.</p>

          {/* Your placement */}
          {me && myRank && (
            <div className="mt-8 inline-block">
              <div className={`border-2 rounded-2xl px-10 py-6 ${RANK_STYLES[myRank]?.ring ?? 'border-stone-600'}`}>
                <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">You finished</p>
                <p className="text-7xl font-black text-amber-400 leading-none">
                  {PLACE_LABELS[myRank] ?? `${myRank}TH`}
                </p>
                <p className="text-stone-400 text-sm mt-2 italic max-w-xs mx-auto">
                  {PLACE_FLAVOUR[myRank] ?? 'The era is over.'}
                </p>
                <p className="text-green-400 font-bold text-2xl mt-3 tabular-nums">
                  ${me.total.toLocaleString()}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Final Standings */}
        <section>
          <h2 className="text-xs text-stone-500 uppercase tracking-widest mb-4">Final Standings</h2>
          <div className="space-y-3">
            {players.map((p, i) => {
              const rank = i + 1
              const style = RANK_STYLES[rank]
              return (
                <div
                  key={p.playerId}
                  className={`rounded-xl border p-4 ${
                    p.isYou
                      ? style?.ring ?? 'border-stone-600'
                      : 'border-stone-700 bg-stone-900/60'
                  } ${p.isYou ? 'bg-stone-900' : ''}`}
                >
                  {/* Name row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl leading-none">{style?.medal ?? `#${rank}`}</span>
                      <div>
                        <span className={`font-bold text-base ${style?.nameColor ?? 'text-stone-400'}`}>
                          {p.name}
                          {p.isYou && <span className="text-xs text-stone-500 font-normal ml-1.5">(you)</span>}
                          {p.isNpc && <span className="text-xs text-stone-600 font-normal ml-1.5">(NPC)</span>}
                        </span>
                      </div>
                    </div>
                    <span className="text-green-400 font-black text-xl tabular-nums">${p.total.toLocaleString()}</span>
                  </div>

                  {/* Stacked bar */}
                  <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3 bg-stone-800">
                    {COMPONENT_LABELS.map(c => {
                      const val = p.components[c.key]
                      const pct = (val / maxTotal) * 100
                      if (pct < 0.5) return null
                      return (
                        <div
                          key={c.key}
                          className={`${c.bar} opacity-80 transition-all`}
                          style={{ width: `${pct}%` }}
                          title={`${c.label}: $${val.toLocaleString()}`}
                        />
                      )
                    })}
                  </div>

                  {/* Breakdown */}
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {COMPONENT_LABELS.map(c => (
                      <div key={c.key} className="bg-stone-800/60 rounded p-1.5">
                        <p className="text-stone-500 text-[10px] uppercase tracking-wide">{c.label}</p>
                        <p className={`${c.color} text-xs font-bold tabular-nums`}>${p.components[c.key].toLocaleString()}</p>
                      </div>
                    ))}
                  </div>

                  {/* Mission summary */}
                  {((p.missionsCompleted ?? 0) + (p.missionsFailed ?? 0)) > 0 && (
                    <div className="mt-2 text-xs flex gap-4">
                      <span className="text-green-600">✦ {p.missionsCompleted ?? 0} missions complete</span>
                      {(p.missionsFailed ?? 0) > 0 && (
                        <span className="text-red-500">
                          ✦ {p.missionsFailed} failed (−${(p.missionPenalty ?? 0).toLocaleString()} deducted)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Total turn time */}
                  {(() => {
                    const t = timing.find(t => t.playerId === p.playerId)
                    if (!t) return null
                    return (
                      <div className="mt-2 text-xs text-stone-500">
                        ⏱ Total turn time: <span className="text-stone-400">{fmtDuration(t.totalSeconds)}</span>
                        <span className="ml-2 text-stone-600">avg {fmtDuration(t.avgSeconds)}/turn</span>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </section>

        {/* Turn Times */}
        {timing.length > 0 && (
          <section>
            <h2 className="text-xs text-stone-500 uppercase tracking-widest mb-4">Turn Times</h2>
            <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-700">
                    <th className="text-left px-4 py-2 text-stone-500 font-normal text-xs uppercase tracking-wide">Player</th>
                    <th className="text-right px-4 py-2 text-stone-500 font-normal text-xs uppercase tracking-wide">Avg Turn</th>
                    <th className="text-right px-4 py-2 text-stone-500 font-normal text-xs uppercase tracking-wide">Total</th>
                    <th className="text-right px-4 py-2 text-stone-500 font-normal text-xs uppercase tracking-wide">Slowest</th>
                    <th className="text-right px-4 py-2 text-stone-500 font-normal text-xs uppercase tracking-wide">Turns</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const maxTotal = Math.max(...timing.map(t => t.totalSeconds))
                    return timing.map((t, i) => {
                      const isSlowest = t.totalSeconds === maxTotal
                      return (
                        <tr key={t.playerId} className={`border-b border-stone-800 last:border-0 ${isSlowest ? 'bg-red-950/30' : ''}`}>
                          <td className="px-4 py-2">
                            {isSlowest && <span className="text-red-400 mr-1.5" title="Slowpoke">🐌</span>}
                            <span className={isSlowest ? 'text-red-400 font-bold' : 'text-stone-300'}>{t.name}</span>
                          </td>
                          <td className={`px-4 py-2 text-right tabular-nums ${i === 0 ? 'text-red-400 font-bold' : 'text-stone-400'}`}>
                            {fmtDuration(t.avgSeconds)}
                          </td>
                          <td className={`px-4 py-2 text-right tabular-nums ${isSlowest ? 'text-red-400 font-bold' : 'text-stone-500'}`}>
                            {fmtDuration(t.totalSeconds)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-stone-500">{fmtDuration(t.maxSeconds)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-stone-500">{t.turnCount}</td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Secret History */}
        {recap && (
          <section>
            <h2 className="text-xs text-stone-500 uppercase tracking-widest mb-4">Secret History</h2>
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-6">
              <pre className="whitespace-pre-wrap text-stone-300 text-sm leading-relaxed font-sans">
                {recap}
              </pre>
            </div>
          </section>
        )}

        {/* Back */}
        <div className="text-center pb-8 flex items-center justify-center gap-4">
          <Link
            to="/games"
            className="inline-block px-8 py-3 bg-amber-700 hover:bg-amber-600 text-amber-100 font-bold rounded uppercase tracking-wide transition"
          >
            ← Back to Games
          </Link>
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-300 text-sm rounded transition min-w-[140px]"
          >
            {copied ? '✓ Copied!' : 'Share Results →'}
          </button>
        </div>

      </div>
    </div>
  )
}
