import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { capture } from '../analytics'

interface GameEntry {
  id: string
  status: string
  current_season: number
  total_seasons: number
  invite_code: string
  game_name: string | null
  is_my_turn: number
}

interface PublicGame {
  id: string
  game_name: string | null
  total_seasons: number
  player_count: number
  max_players: number
  created_at: string
  host_name: string
}

interface LeaderboardEntry {
  user_id: number
  isYou: boolean
  player_name: string
  character_class: string
  rank: number
  net_worth: number
  total_seasons: number
  ended_at: string
  game_id: string
}

const SEASON_NAME_SETS: Record<number, string[]> = {
  1: [],
  2: ['Spring', 'Autumn'],
  3: ['Spring', 'Summer', 'Autumn'],
  4: ['Spring', 'Summer', 'Autumn', 'Winter'],
}

function getSeasonLabel(season: number, totalSeasons = 52): string {
  const seasonsPerYear = totalSeasons / 13
  const yearOffset  = Math.floor((season - 1) / seasonsPerYear)
  const seasonIndex = Math.round((season - 1) % seasonsPerYear)
  const names = SEASON_NAME_SETS[seasonsPerYear] ?? []
  const seasonName = names[seasonIndex] ? `${names[seasonIndex]} ` : ''
  return `${seasonName}${1921 + yearOffset}`
}

export default function GamesPage() {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const [inviteCode, setInviteCode] = useState(searchParams.get('invite') ?? '')
  const [error, setError] = useState('')
  const [games, setGames] = useState<GameEntry[]>([])
  const [timedOut, setTimedOut] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newGameSeasons, setNewGameSeasons] = useState(52)
  const [newGamePublic, setNewGamePublic] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [lbSeasons, setLbSeasons] = useState<13 | 26 | 52>(52)
  const [leftTab, setLeftTab] = useState<'new' | 'leaderboard'>('new')
  const [publicGames, setPublicGames] = useState<PublicGame[]>([])

  useEffect(() => {
    fetch('/api/games')
      .then(r => r.json())
      .then((data: { success: boolean; games: GameEntry[]; timedOutGames?: string[]; isAdmin?: boolean }) => {
        if (data.success) {
          setGames(data.games)
          setTimedOut(data.timedOutGames ?? [])
          setIsAdmin(data.isAdmin ?? false)
          capture('page_view', { page: 'games', active_games: data.games.filter((g: GameEntry) => g.status !== 'ended').length })
        }
      })
      .finally(() => setLoading(false))

    fetch('/api/games/leaderboard')
      .then(r => r.json())
      .then((data: { success: boolean; entries?: LeaderboardEntry[] }) => {
        if (data.success && data.entries) setLeaderboard(data.entries)
      })
      .catch(() => {})

    fetch('/api/games/public')
      .then(r => r.json())
      .then((data: { success: boolean; games?: PublicGame[] }) => {
        if (data.success && data.games) setPublicGames(data.games)
      })
      .catch(() => {})
  }, [])

  async function createGame() {
    setError('')
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalSeasons: newGameSeasons, isPublic: newGamePublic })
    })
    const data = await res.json()
    if (data.success && data.gameId) {
      capture('game_created')
      nav(`/games/${data.gameId}`)
    } else {
      setError(data.message ?? 'Failed to create game')
    }
  }

  async function joinGame(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/games/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode })
    })
    const data = await res.json()
    if (data.success && data.gameId) {
      capture('game_joined', { via: 'invite_code' })
      nav(`/games/${data.gameId}`)
    } else {
      setError(data.message ?? 'Failed to join game')
    }
  }

  async function joinPublicGame(gameId: string) {
    setError('')
    const res = await fetch('/api/games/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId })
    })
    const data = await res.json()
    if (data.success && data.gameId) {
      capture('game_joined', { via: 'public_lobby' })
      nav(`/games/${data.gameId}`)
    } else {
      setError(data.message ?? 'Failed to join game')
    }
  }

  const activeGames = games.filter(g => g.status !== 'ended')
  const endedGames  = games.filter(g => g.status === 'ended')

  return (
    <div className="min-h-screen p-4 md:p-6">

      {/* App header — logo left, links right */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-6">
        <img src="/logo.png" alt="Prohibitioner" className="h-12 w-auto object-contain drop-shadow-lg" />
        <div className="flex items-center gap-4">
          <a href="/how-to-play" className="text-xs text-stone-600 hover:text-amber-400 transition cursor-pointer">How to Play ›</a>
          {isAdmin && <a href="/admin" className="text-xs text-stone-600 hover:text-stone-400 transition cursor-pointer">Admin ›</a>}
          <button
            onClick={async () => { await fetch('/auth/logout', { method: 'POST' }); window.location.href = '/' }}
            className="text-xs text-stone-600 hover:text-red-400 transition cursor-pointer"
          >Sign Out</button>
        </div>
      </div>

      {/* Two-column grid — stacks on mobile */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

        {/* Column 1 — Tabbed card: New Game / Leaderboard */}
        <div className="space-y-3">
          <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-stone-800">
              {(['new', 'leaderboard'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition cursor-pointer ${
                    leftTab === tab
                      ? 'text-amber-400 border-b-2 border-amber-500 -mb-px'
                      : 'text-stone-600 hover:text-stone-400'
                  }`}
                >
                  {tab === 'new' ? 'New Game' : 'Leaderboard'}
                </button>
              ))}
            </div>

            {leftTab === 'new' && (<>
              {/* Game length */}
              <div className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-stone-600">Game length</span>
                      <div className="relative group">
                        <span className="text-xs text-stone-700 hover:text-stone-500 cursor-default select-none">(?)</span>
                        <div className="absolute bottom-full left-0 mb-2 w-56 bg-stone-800 border border-stone-700 rounded p-2.5 text-xs text-stone-400 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                          The more seasons, the longer the game. Each season is one turn per player.
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-stone-600">
                      {getSeasonLabel(1, newGameSeasons)} – {getSeasonLabel(newGameSeasons, newGameSeasons)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {([13, 26, 52] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setNewGameSeasons(n)}
                        className={`flex-1 py-1 text-xs font-bold rounded transition border cursor-pointer ${
                          newGameSeasons === n
                            ? 'bg-amber-600 border-amber-500 text-stone-900'
                            : 'bg-stone-800 border-stone-600 text-stone-500 hover:border-amber-700 hover:text-amber-400'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Public/private toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-400 font-medium">Public lobby</p>
                    <p className="text-xs text-stone-600">Show in open games list</p>
                  </div>
                  <button
                    onClick={() => setNewGamePublic(v => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${newGamePublic ? 'bg-amber-500' : 'bg-stone-700'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${newGamePublic ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <button
                  onClick={createGame}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide transition text-sm cursor-pointer"
                >
                  Start New Game
                </button>
              </div>

              {/* Divider */}
              <div className="border-t border-stone-800 mx-4" />

              {/* Join section */}
              <div className="p-4 space-y-2">
                <p className="text-xs text-stone-600">Have an invite code?</p>
                <form onSubmit={joinGame} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code…"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value)}
                    className="flex-1 px-3 py-2 bg-stone-800 rounded border border-stone-700 focus:outline-none focus:border-amber-500 text-sm placeholder-stone-600"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 border border-stone-600 hover:border-amber-600 hover:text-amber-400 text-stone-400 font-bold rounded text-xs uppercase tracking-wide transition cursor-pointer"
                  >
                    Join
                  </button>
                </form>
              </div>
            </>)}

            {leftTab === 'leaderboard' && (
              <div className="p-4 space-y-3">
                {/* Season pills + help */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {([13, 26, 52] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setLbSeasons(n)}
                        className={`px-2 py-1 text-xs font-bold rounded transition border cursor-pointer ${
                          lbSeasons === n
                            ? 'bg-amber-600 border-amber-500 text-stone-900'
                            : 'bg-stone-800 border-stone-600 text-stone-500 hover:border-amber-700 hover:text-amber-400'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="relative group">
                    <span className="text-xs text-stone-700 hover:text-stone-500 cursor-default select-none">(?)</span>
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-stone-800 border border-stone-700 rounded p-2.5 text-xs text-stone-400 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 shadow-lg">
                      Scores are grouped by game length — 13-season games don&apos;t compete with 52-season games. Entries expire after 3 months.
                    </div>
                  </div>
                </div>

                {/* Entries */}
                {(() => {
                  const entries = leaderboard.filter(e => e.total_seasons === lbSeasons).slice(0, 5)
                  if (!entries.length) return (
                    <p className="text-stone-700 text-xs italic">No {lbSeasons}-season games in the last 3 months.</p>
                  )
                  return (
                    <div className="space-y-0">
                      {entries.map((e, i) => (
                        <div
                          key={`${e.game_id}-${e.user_id}`}
                          className={`flex items-center gap-2 py-2 border-b border-stone-800 last:border-0 ${e.isYou ? 'border-amber-900/30' : ''}`}
                        >
                          <span className="text-stone-600 text-xs tabular-nums w-4 shrink-0">{i + 1}</span>
                          <span className={`flex-1 text-xs font-medium truncate ${e.isYou ? 'text-amber-400' : 'text-stone-300'}`}>
                            {e.player_name}
                          </span>
                          <span className="text-stone-500 text-xs truncate shrink-0">{e.character_class.replace(/_/g, ' ')}</span>
                          <span className="text-green-500 text-xs font-bold tabular-nums shrink-0">
                            ${(e.net_worth / 1000).toFixed(1)}k
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Column 2 — Active & Completed Games */}
        <div className="space-y-3">

          {/* Timed-out notices */}
          {timedOut.map((name, i) => (
            <div
              key={i}
              className="bg-stone-800/60 border border-stone-700 rounded-lg px-3 py-2.5 flex items-start justify-between gap-3"
            >
              <p className="text-stone-500 text-xs">
                <span className="text-stone-400 font-semibold">{name}</span> was removed after 7 days of inactivity.
              </p>
              <button
                onClick={() => setTimedOut(prev => prev.filter((_, j) => j !== i))}
                className="text-stone-600 hover:text-stone-400 text-base leading-none shrink-0 cursor-pointer"
                aria-label="Dismiss"
              >×</button>
            </div>
          ))}

          {/* Active games */}
          <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-800">
              <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">Your Games</p>
            </div>
            {loading && (
              <p className="px-4 py-3 text-stone-700 text-xs italic">Loading…</p>
            )}
            {!loading && activeGames.length === 0 && (
              <p className="px-4 py-3 text-stone-700 text-xs italic">No active games — start one on the left.</p>
            )}
            {!loading && activeGames.map(g => (
              <button
                key={g.id}
                onClick={() => nav(`/games/${g.id}`)}
                className="w-full text-left px-4 py-3 border-b border-stone-800 last:border-0 hover:bg-stone-800/50 transition group cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-tight truncate ${g.game_name ? 'text-amber-300' : 'text-stone-300'}`}>
                      {g.game_name ?? (g.status === 'lobby' ? 'New Game' : getSeasonLabel(g.current_season, g.total_seasons))}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {g.status !== 'lobby' && (
                        <span className="text-xs text-stone-600">{getSeasonLabel(g.current_season, g.total_seasons)}</span>
                      )}
                      {g.status === 'lobby' && (
                        <span className="text-xs text-stone-600 font-mono">{g.invite_code}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {g.is_my_turn ? (
                      <span className="text-xs font-bold text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
                        Your Turn
                      </span>
                    ) : (
                      <span className="text-xs text-stone-600">Waiting…</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Open public lobbies */}
          {publicGames.length > 0 && (
            <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-800">
                <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">Open Games</p>
              </div>
              {publicGames.map(g => (
                <div
                  key={g.id}
                  className="px-4 py-3 border-b border-stone-800 last:border-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-300 truncate">
                      {g.game_name ?? `${g.host_name}'s Game`}
                    </p>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {g.total_seasons} seasons · {g.player_count}/{g.max_players} joined
                    </p>
                  </div>
                  <button
                    onClick={() => joinPublicGame(g.id)}
                    className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded text-xs uppercase tracking-wide transition cursor-pointer"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Completed games */}
          {!loading && endedGames.length > 0 && (
            <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-800">
                <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">Completed</p>
              </div>
              {endedGames.map(g => (
                <button
                  key={g.id}
                  onClick={() => nav(`/games/${g.id}/end`)}
                  className="w-full text-left px-4 py-3 border-b border-stone-800 last:border-0 hover:bg-stone-800/30 transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-400 truncate">
                        {g.game_name ?? getSeasonLabel(g.current_season, g.total_seasons)}
                      </p>
                      <p className="text-xs text-stone-700 mt-0.5">
                        Ended · {getSeasonLabel(g.current_season, g.total_seasons)}
                      </p>
                    </div>
                    <span className="text-xs text-stone-700 group-hover:text-amber-700 transition shrink-0">Results →</span>
                  </div>
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
