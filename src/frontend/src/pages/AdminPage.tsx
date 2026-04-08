import React, { useEffect, useState, useCallback } from 'react'

interface GameRow {
  id: string
  name: string
  status: string
  season: number
  seasonLabel: string
  playerCount: number
  createdAt: string
}

interface PlayerRow {
  id: number
  display_name: string | null
  character_class: string
  vehicle: string
  cash: number
  heat: number
  turn_order: number
  is_npc: number
  jail_until_season: number | null
  email: string | null
}

interface UserRow {
  id: number
  email: string
  created_at: string
  games_count: number
  last_seen_at: number | null
}

interface EditGameState {
  season: string
  status: string
  name: string
}

interface EditPlayerState {
  cash: string
  heat: string
  vehicle: string
  jailUntilSeason: string
}

const STATUS_COLORS: Record<string, string> = {
  lobby:  'bg-blue-900 text-blue-300',
  active: 'bg-green-900 text-green-300',
  ended:  'bg-stone-700 text-stone-400',
}

type Tab = 'games' | 'users' | 'analytics'

interface AnalyticsTotals {
  requests: number; bytes: number; cachedRequests: number
  cachedBytes: number; pageViews: number; threats: number; uniques: number
}
interface AnalyticsSeries {
  date: string; requests: number; bytes: number
  cachedRequests: number; pageViews: number; threats: number; uniques: number
}
interface AnalyticsData { totals: AnalyticsTotals; series: AnalyticsSeries[]; days: number }

function fmtBytes(b: number) {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB'
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB'
  return (b / 1e3).toFixed(0) + ' KB'
}

function fmtNum(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

export default function AdminPage() {
  const [tab,          setTab]          = useState<Tab>('games')
  const [games,        setGames]        = useState<GameRow[]>([])
  const [users,        setUsers]        = useState<UserRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [players,      setPlayers]      = useState<Record<string, PlayerRow[]>>({})
  const [editGame,     setEditGame]     = useState<{ id: string; state: EditGameState } | null>(null)
  const [editPlayer,   setEditPlayer]   = useState<{ gameId: string; player: PlayerRow; state: EditPlayerState } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'game' | 'player'; gameId: string; playerId?: number; label: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [analyticsDays, setAnalyticsDays] = useState<1 | 7 | 30>(7)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState('')

  const fetchGames = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/games')
      if (r.status === 403) { setError('Not authorized'); return }
      const d = await r.json()
      if (d.success) setGames(d.games)
    } catch { setError('Failed to load') }
    finally { setLoading(false) }
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/users')
      if (r.status === 403) { setError('Not authorized'); return }
      const d = await r.json()
      if (d.success) setUsers(d.users)
    } catch { setError('Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchGames() }, [fetchGames])

  useEffect(() => {
    if (tab === 'users' && users.length === 0) fetchUsers()
  }, [tab, users.length, fetchUsers])

  useEffect(() => {
    if (tab !== 'analytics') return
    setAnalyticsLoading(true)
    setAnalyticsError('')
    fetch(`/api/admin/analytics?days=${analyticsDays}`)
      .then(r => r.json())
      .then((d: { success: boolean; data?: AnalyticsData; message?: string }) => {
        if (d.success && d.data) setAnalytics(d.data)
        else setAnalyticsError(d.message ?? 'Failed to load analytics')
      })
      .catch(() => setAnalyticsError('Network error'))
      .finally(() => setAnalyticsLoading(false))
  }, [tab, analyticsDays])

  async function fetchPlayers(gameId: string) {
    if (players[gameId]) return
    const r = await fetch(`/api/admin/games/${gameId}/players`)
    const d = await r.json()
    if (d.success) setPlayers(prev => ({ ...prev, [gameId]: d.players }))
  }

  function toggleExpand(gameId: string) {
    if (expandedId === gameId) {
      setExpandedId(null)
    } else {
      setExpandedId(gameId)
      fetchPlayers(gameId)
    }
  }

  async function deleteGame(gameId: string) {
    setSaving(true)
    await fetch(`/api/admin/games/${gameId}`, { method: 'DELETE' })
    setGames(g => g.filter(x => x.id !== gameId))
    setConfirmDelete(null)
    setSaving(false)
  }

  async function deletePlayer(gameId: string, playerId: number) {
    setSaving(true)
    await fetch(`/api/admin/games/${gameId}/players/${playerId}`, { method: 'DELETE' })
    setPlayers(prev => ({ ...prev, [gameId]: (prev[gameId] ?? []).filter(p => p.id !== playerId) }))
    setConfirmDelete(null)
    setSaving(false)
  }

  async function saveGame() {
    if (!editGame) return
    setSaving(true)
    await fetch(`/api/admin/games/${editGame.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        season: Number(editGame.state.season),
        status: editGame.state.status,
        name:   editGame.state.name,
      })
    })
    await fetchGames()
    setEditGame(null)
    setSaving(false)
  }

  async function savePlayer() {
    if (!editPlayer) return
    setSaving(true)
    await fetch(`/api/admin/games/${editPlayer.gameId}/players/${editPlayer.player.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cash:            Number(editPlayer.state.cash),
        heat:            Number(editPlayer.state.heat),
        vehicle:         editPlayer.state.vehicle,
        jailUntilSeason: editPlayer.state.jailUntilSeason ? Number(editPlayer.state.jailUntilSeason) : null,
      })
    })
    setPlayers(prev => { const next = { ...prev }; delete next[editPlayer.gameId]; return next })
    fetchPlayers(editPlayer.gameId)
    setEditPlayer(null)
    setSaving(false)
  }

  function formatLastSeen(ts: number | null): string {
    if (!ts) return 'Never'
    const diff = Math.floor(Date.now() / 1000) - ts
    if (diff < 60)      return 'Just now'
    if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
    return new Date(ts * 1000).toLocaleDateString()
  }

  if (loading) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <p className="text-stone-400">Loading…</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <p className="text-red-400">{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-widest">Control Panel</p>
            <h1 className="text-2xl font-black text-amber-400">Game Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={tab === 'games' ? fetchGames : tab === 'users' ? fetchUsers : () => setAnalyticsDays(d => d)}
              className="px-3 py-1.5 text-xs bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded transition"
            >
              Refresh
            </button>
            <a href="/games" className="px-3 py-1.5 text-xs bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded transition">
              ← Back to Games
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-stone-800 mb-4">
          {(['games', 'users', 'analytics'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition border-b-2 -mb-px ${
                tab === t
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-stone-500 hover:text-stone-300'
              }`}
            >
              {t === 'games' ? `Games (${games.length})` : t === 'users' ? `Users (${users.length})` : 'Analytics'}
            </button>
          ))}
        </div>

        {/* ── Games tab ── */}
        {tab === 'games' && (
          games.length === 0 ? (
            <p className="text-stone-500 text-center py-12">No games found.</p>
          ) : (
            <div className="space-y-2">
              {games.map(game => (
                <div key={game.id} className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleExpand(game.id)}
                      className="text-stone-500 hover:text-amber-300 transition w-5 text-center flex-shrink-0"
                    >
                      {expandedId === game.id ? '▾' : '▸'}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-stone-100 truncate">{game.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-bold uppercase ${STATUS_COLORS[game.status]}`}>
                          {game.status}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-stone-500 mt-0.5">
                        <span>{game.seasonLabel}</span>
                        <span>·</span>
                        <span>{game.playerCount} players</span>
                        <span>·</span>
                        <span className="font-mono text-[10px]">{game.id.slice(0, 8)}</span>
                        <span>·</span>
                        <span>{new Date(game.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setEditGame({
                          id: game.id,
                          state: { season: String(game.season), status: game.status, name: game.name }
                        })}
                        className="px-2.5 py-1 text-xs bg-stone-700 hover:bg-stone-600 border border-stone-600 rounded transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ type: 'game', gameId: game.id, label: game.name })}
                        className="px-2.5 py-1 text-xs bg-red-950 hover:bg-red-900 border border-red-800 text-red-400 hover:text-red-200 rounded transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {expandedId === game.id && (
                    <div className="border-t border-stone-800 bg-stone-950">
                      {!players[game.id] ? (
                        <p className="text-xs text-stone-500 px-6 py-3">Loading players…</p>
                      ) : players[game.id].length === 0 ? (
                        <p className="text-xs text-stone-500 px-6 py-3 italic">No players.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-stone-600 uppercase tracking-wider border-b border-stone-800">
                              <th className="text-left px-6 py-2 font-normal">Player</th>
                              <th className="text-left px-3 py-2 font-normal">Class</th>
                              <th className="text-right px-3 py-2 font-normal">Cash</th>
                              <th className="text-right px-3 py-2 font-normal">Heat</th>
                              <th className="text-left px-3 py-2 font-normal">Vehicle</th>
                              <th className="text-left px-3 py-2 font-normal">Jail</th>
                              <th className="px-4 py-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {players[game.id].map(p => (
                              <tr key={p.id} className="border-b border-stone-800/50 hover:bg-stone-900/50">
                                <td className="px-6 py-2">
                                  <span className={p.is_npc ? 'text-stone-500 italic' : 'text-stone-200'}>
                                    {p.is_npc ? `NPC ${p.turn_order + 1}` : (p.display_name ?? p.email?.split('@')[0] ?? 'Player')}
                                  </span>
                                  {p.email && <span className="text-stone-600 ml-1">({p.email})</span>}
                                </td>
                                <td className="px-3 py-2 text-stone-400 capitalize">{p.character_class?.replace(/_/g, ' ')}</td>
                                <td className="px-3 py-2 text-right text-green-400 tabular-nums">${p.cash.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right">
                                  <span className={p.heat >= 75 ? 'text-red-400' : p.heat >= 40 ? 'text-amber-400' : 'text-stone-400'}>
                                    {p.heat}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-stone-400 capitalize">{p.vehicle?.replace(/_/g, ' ')}</td>
                                <td className="px-3 py-2 text-stone-500">
                                  {p.jail_until_season ? `S${p.jail_until_season}` : '—'}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex gap-1.5 justify-end">
                                    <button
                                      onClick={() => setEditPlayer({
                                        gameId: game.id,
                                        player: p,
                                        state: {
                                          cash: String(p.cash),
                                          heat: String(p.heat),
                                          vehicle: p.vehicle ?? 'workhorse',
                                          jailUntilSeason: p.jail_until_season ? String(p.jail_until_season) : '',
                                        }
                                      })}
                                      className="px-2 py-0.5 bg-stone-700 hover:bg-stone-600 rounded transition"
                                    >
                                      Edit
                                    </button>
                                    {!p.is_npc && (
                                      <button
                                        onClick={() => setConfirmDelete({
                                          type: 'player', gameId: game.id, playerId: p.id,
                                          label: p.display_name ?? p.email ?? `Player ${p.id}`
                                        })}
                                        className="px-2 py-0.5 bg-red-950 hover:bg-red-900 text-red-400 rounded transition"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Users tab ── */}
        {tab === 'users' && (
          users.length === 0 ? (
            <p className="text-stone-500 text-center py-12">No users found.</p>
          ) : (
            <div className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-stone-500 uppercase tracking-wider border-b border-stone-700">
                    <th className="text-left px-5 py-3 font-normal">Email</th>
                    <th className="text-right px-4 py-3 font-normal">Games</th>
                    <th className="text-left px-4 py-3 font-normal">Last Seen</th>
                    <th className="text-left px-4 py-3 font-normal">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                      <td className="px-5 py-2.5 text-stone-200">{u.email}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-stone-400">{u.games_count}</td>
                      <td className="px-4 py-2.5 text-stone-400">{formatLastSeen(u.last_seen_at)}</td>
                      <td className="px-4 py-2.5 text-stone-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {/* ── Analytics tab ── */}
        {tab === 'analytics' && (
          <div className="space-y-4">
            {/* Period selector + PostHog link */}
            <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {([1, 7, 30] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setAnalyticsDays(d)}
                  className={`px-4 py-1.5 text-sm font-semibold rounded transition cursor-pointer ${
                    analyticsDays === d
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200'
                  }`}
                >
                  {d === 1 ? '24h' : `${d}d`}
                </button>
              ))}
            </div>
            <a
              href="https://us.posthog.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-stone-500 hover:text-amber-400 transition"
            >
              PostHog →
            </a>
            </div>

            {analyticsLoading && (
              <p className="text-stone-400 animate-pulse py-8 text-center">Loading analytics…</p>
            )}

            {analyticsError && (
              <p className="text-red-400 py-8 text-center text-sm">{analyticsError}</p>
            )}

            {analytics && !analyticsLoading && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Requests',      value: fmtNum(analytics.totals.requests) },
                    { label: 'Bandwidth',     value: fmtBytes(analytics.totals.bytes) },
                    { label: 'Cache Hit',     value: analytics.totals.requests > 0 ? Math.round(analytics.totals.cachedRequests / analytics.totals.requests * 100) + '%' : '—' },
                    { label: 'Threats',       value: fmtNum(analytics.totals.threats) },
                  ].map(c => (
                    <div key={c.label} className="bg-stone-900 border border-stone-700 rounded-lg px-4 py-3">
                      <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">{c.label}</p>
                      <p className="text-xl font-black text-amber-400 tabular-nums">{c.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Page Views',       value: fmtNum(analytics.totals.pageViews) },
                    { label: 'Unique Visitors',  value: fmtNum(analytics.totals.uniques) },
                  ].map(c => (
                    <div key={c.label} className="bg-stone-900 border border-stone-700 rounded-lg px-4 py-3">
                      <p className="text-xs text-stone-500 uppercase tracking-widest mb-1">{c.label}</p>
                      <p className="text-xl font-black text-amber-400 tabular-nums">{c.value}</p>
                    </div>
                  ))}
                </div>

                {/* Breakdown table */}
                {analytics.series.length > 0 && (
                  <div className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-stone-500 uppercase tracking-wider border-b border-stone-700">
                          <th className="text-left px-4 py-2.5 font-normal">{analytics.days === 1 ? 'Hour' : 'Date'}</th>
                          <th className="text-right px-4 py-2.5 font-normal">Requests</th>
                          <th className="text-right px-4 py-2.5 font-normal">Bandwidth</th>
                          <th className="text-right px-4 py-2.5 font-normal">Cached</th>
                          <th className="text-right px-4 py-2.5 font-normal">Threats</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...analytics.series].reverse().map(row => (
                          <tr key={row.date} className="border-b border-stone-800/50 hover:bg-stone-800/30">
                            <td className="px-4 py-2 text-stone-300 tabular-nums">
                              {analytics.days === 1
                                ? new Date(row.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : new Date(row.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
                              }
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-stone-300">{fmtNum(row.requests)}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-stone-400">{fmtBytes(row.bytes)}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-stone-400">
                              {row.requests > 0 ? Math.round(row.cachedRequests / row.requests * 100) + '%' : '—'}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-stone-500">{row.threats}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Edit Game Modal ── */}
      {editGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setEditGame(null)}>
          <div className="bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-80 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-amber-400 font-bold">Edit Game</h2>

            <div className="space-y-3">
              <label className="block">
                <p className="text-xs text-stone-500 mb-1">Name</p>
                <input
                  type="text"
                  value={editGame.state.name}
                  onChange={e => setEditGame(g => g && ({ ...g, state: { ...g.state, name: e.target.value } }))}
                  className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </label>

              <label className="block">
                <p className="text-xs text-stone-500 mb-1">Season (1 = Spring 1921, 52 = Winter 1933)</p>
                <input
                  type="number"
                  min={1} max={100}
                  value={editGame.state.season}
                  onChange={e => setEditGame(g => g && ({ ...g, state: { ...g.state, season: e.target.value } }))}
                  className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </label>

              <label className="block">
                <p className="text-xs text-stone-500 mb-1">Status</p>
                <select
                  value={editGame.state.status}
                  onChange={e => setEditGame(g => g && ({ ...g, state: { ...g.state, status: e.target.value } }))}
                  className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="lobby">Lobby</option>
                  <option value="active">Active</option>
                  <option value="ended">Ended</option>
                </select>
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditGame(null)} className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 rounded text-sm transition">Cancel</button>
              <button onClick={saveGame} disabled={saving} className="flex-1 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 rounded text-sm font-bold transition">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Player Modal ── */}
      {editPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setEditPlayer(null)}>
          <div className="bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-80 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-amber-400 font-bold">Edit Player</h2>
            <p className="text-xs text-stone-500">{editPlayer.player.display_name ?? editPlayer.player.email ?? `Player ${editPlayer.player.id}`}</p>

            <div className="space-y-3">
              <label className="block">
                <p className="text-xs text-stone-500 mb-1">Cash</p>
                <input
                  type="number" min={0}
                  value={editPlayer.state.cash}
                  onChange={e => setEditPlayer(p => p && ({ ...p, state: { ...p.state, cash: e.target.value } }))}
                  className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </label>

              <label className="block">
                <p className="text-xs text-stone-500 mb-1">Heat (0–100)</p>
                <input
                  type="number" min={0} max={100}
                  value={editPlayer.state.heat}
                  onChange={e => setEditPlayer(p => p && ({ ...p, state: { ...p.state, heat: e.target.value } }))}
                  className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </label>

              <label className="block">
                <p className="text-xs text-stone-500 mb-1">Vehicle</p>
                <select
                  value={editPlayer.state.vehicle}
                  onChange={e => setEditPlayer(p => p && ({ ...p, state: { ...p.state, vehicle: e.target.value } }))}
                  className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="workhorse">Workhorse (Model T)</option>
                  <option value="roadster">Roadster</option>
                  <option value="truck">Delivery Truck</option>
                  <option value="whiskey_runner">Whiskey Runner</option>
                </select>
              </label>

              <label className="block">
                <p className="text-xs text-stone-500 mb-1">Jail Until Season (blank = not jailed)</p>
                <input
                  type="number" min={0}
                  value={editPlayer.state.jailUntilSeason}
                  onChange={e => setEditPlayer(p => p && ({ ...p, state: { ...p.state, jailUntilSeason: e.target.value } }))}
                  className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-1.5 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditPlayer(null)} className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 rounded text-sm transition">Cancel</button>
              <button onClick={savePlayer} disabled={saving} className="flex-1 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 rounded text-sm font-bold transition">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setConfirmDelete(null)}>
          <div className="bg-stone-900 border border-red-800 rounded-lg shadow-2xl w-80 p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-red-400 font-bold">Confirm Delete</h2>
            <p className="text-sm text-stone-300">
              {confirmDelete.type === 'game'
                ? <>Permanently delete game <span className="text-white font-bold">"{confirmDelete.label}"</span> and all its data? This cannot be undone.</>
                : <>Remove player <span className="text-white font-bold">"{confirmDelete.label}"</span> from this game? Their turns, inventory, and distilleries will be deleted.</>
              }
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 rounded text-sm transition">Cancel</button>
              <button
                disabled={saving}
                onClick={() => confirmDelete.type === 'game'
                  ? deleteGame(confirmDelete.gameId)
                  : deletePlayer(confirmDelete.gameId, confirmDelete.playerId!)
                }
                className="flex-1 py-2 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-red-100 rounded text-sm font-bold transition"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
