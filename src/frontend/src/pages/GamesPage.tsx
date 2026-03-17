import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface GameEntry {
  id: string
  status: string
  current_season: number
  invite_code: string
  game_name: string | null
  is_my_turn: number
}

function getSeasonLabel(season: number): string {
  const years = Math.floor((season - 1) / 4)
  const quarter = (season - 1) % 4
  const seasons = ['Spring', 'Summer', 'Autumn', 'Winter']
  return `${seasons[quarter]} ${1920 + years}`
}

export default function GamesPage() {
  const nav = useNavigate()
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [games, setGames] = useState<GameEntry[]>([])
  const [timedOut, setTimedOut] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/games')
      .then(r => r.json())
      .then((data: { success: boolean; games: GameEntry[]; timedOutGames?: string[] }) => {
        if (data.success) {
          setGames(data.games)
          setTimedOut(data.timedOutGames ?? [])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function createGame() {
    setError('')
    const res = await fetch('/api/games', { method: 'POST' })
    const data = await res.json()
    if (data.success && data.gameId) {
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
      nav(`/games/${data.gameId}`)
    } else {
      setError(data.message ?? 'Failed to join game')
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen gap-8 p-8">
      <img src="/logo.png" alt="Prohibitioner" className="h-20 w-auto object-contain drop-shadow-lg" />
      <div className="w-full max-w-md flex items-center justify-between">
        <h2 className="text-3xl font-bold text-amber-400">Your Syndicate</h2>
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-xs text-stone-600 hover:text-stone-400 transition">Admin ›</a>
          <button
            onClick={async () => { await fetch('/auth/logout', { method: 'POST' }); window.location.href = '/' }}
            className="text-xs text-stone-600 hover:text-red-400 transition"
          >Sign Out</button>
        </div>
      </div>

      {/* Start / Join — primary actions */}
      <div className="w-full max-w-md space-y-4">
        <button
          onClick={createGame}
          className="w-full px-8 py-3 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide transition"
        >
          Start New Game
        </button>

        <div className="text-center text-stone-500 text-sm">— or join with invite code —</div>

        <form onSubmit={joinGame} className="flex gap-2">
          <input
            type="text"
            placeholder="Invite Code"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            className="flex-1 px-4 py-2 bg-stone-800 rounded border border-stone-600 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="px-6 py-2 border border-amber-600 hover:bg-amber-900 text-amber-400 font-bold rounded uppercase tracking-wide transition"
          >
            Join
          </button>
        </form>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      {/* Timed-out game notices */}
      {timedOut.map((name, i) => (
        <div
          key={i}
          className="w-full max-w-md bg-stone-800 border border-stone-600 rounded-lg px-4 py-3 flex items-start justify-between gap-3"
        >
          <p className="text-stone-400 text-sm">
            <span className="text-stone-300 font-semibold">{name}</span> was removed after 7 days of inactivity. Sorry about that.
          </p>
          <button
            onClick={() => setTimedOut(prev => prev.filter((_, j) => j !== i))}
            className="text-stone-600 hover:text-stone-400 text-lg leading-none shrink-0"
            aria-label="Dismiss"
          >×</button>
        </div>
      ))}

      {/* Active games list */}
      {!loading && games.filter(g => g.status !== 'ended').length > 0 && (
        <div className="w-full max-w-md space-y-3">
          <h3 className="text-xs text-stone-500 uppercase tracking-wider">Active Games</h3>
          {games.filter(g => g.status !== 'ended').map(g => (
            <button
              key={g.id}
              onClick={() => nav(`/games/${g.id}`)}
              className="w-full text-left bg-stone-800 border border-stone-700 hover:border-amber-600 rounded-lg p-4 transition group"
            >
              <div className="flex items-center justify-between">
                <div>
                  {g.game_name && (
                    <p className="text-amber-300 font-bold text-sm leading-tight">{g.game_name}</p>
                  )}
                  <p className="text-stone-400 text-xs uppercase tracking-wider mb-0.5">
                    {g.status === 'lobby' ? 'Lobby' : getSeasonLabel(g.current_season)}
                  </p>
                  {g.status === 'lobby' && (
                    <p className="text-stone-500 text-xs">
                      Invite: <span className="text-amber-400 font-mono font-bold">{g.invite_code}</span>
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {g.is_my_turn ? (
                    <span className="text-xs font-bold text-green-400 bg-green-900/40 px-2 py-0.5 rounded">
                      Your Turn
                    </span>
                  ) : (
                    <span className="text-xs text-stone-500">Waiting…</span>
                  )}
                  <p className="text-amber-400 text-xs mt-1 group-hover:text-amber-300">
                    Enter →
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && games.filter(g => g.status !== 'ended').length === 0 && (
        <p className="text-stone-500 text-sm italic">No active games. Start or join one below.</p>
      )}

      {/* Ended games */}
      {!loading && games.filter(g => g.status === 'ended').length > 0 && (
        <div className="w-full max-w-md space-y-3">
          <h3 className="text-xs text-stone-500 uppercase tracking-wider">Completed Games</h3>
          {games.filter(g => g.status === 'ended').map(g => (
            <button
              key={g.id}
              onClick={() => nav(`/games/${g.id}/end`)}
              className="w-full text-left bg-stone-900 border border-stone-800 hover:border-amber-800 rounded-lg p-4 transition group"
            >
              <div className="flex items-center justify-between">
                <div>
                  {g.game_name && (
                    <p className="text-stone-300 font-bold text-sm leading-tight">{g.game_name}</p>
                  )}
                  <p className="text-stone-600 text-xs uppercase tracking-wider">
                    Ended · {getSeasonLabel(g.current_season)}
                  </p>
                </div>
                <p className="text-amber-700 text-xs group-hover:text-amber-500">
                  View Results →
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  )
}
