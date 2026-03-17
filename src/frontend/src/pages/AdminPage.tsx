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

export default function AdminPage() {
  const [games,        setGames]        = useState<GameRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [players,      setPlayers]      = useState<Record<string, PlayerRow[]>>({})
  const [editGame,     setEditGame]     = useState<{ id: string; state: EditGameState } | null>(null)
  const [editPlayer,   setEditPlayer]   = useState<{ gameId: string; player: PlayerRow; state: EditPlayerState } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'game' | 'player'; gameId: string; playerId?: number; label: string } | null>(null)
  const [saving, setSaving] = useState(false)

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

  useEffect(() => { fetchGames() }, [fetchGames])

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
    // Refresh players for this game
    setPlayers(prev => { const next = { ...prev }; delete next[editPlayer.gameId]; return next })
    fetchPlayers(editPlayer.gameId)
    setEditPlayer(null)
    setSaving(false)
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
            <span className="text-xs text-stone-500">{games.length} games total</span>
            <button
              onClick={fetchGames}
              className="px-3 py-1.5 text-xs bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded transition"
            >
              Refresh
            </button>
            <a href="/games" className="px-3 py-1.5 text-xs bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded transition">
              ← Back to Games
            </a>
          </div>
        </div>

        {/* Status filter tabs */}
        {(['all', 'active', 'lobby', 'ended'] as const).map(tab => {
          const count = tab === 'all' ? games.length : games.filter(g => g.status === tab).length
          return null // just showing all for now
        })}

        {/* Games table */}
        {games.length === 0 ? (
          <p className="text-stone-500 text-center py-12">No games found.</p>
        ) : (
          <div className="space-y-2">
            {games.map(game => (
              <div key={game.id} className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
                {/* Game row */}
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

                {/* Expanded players */}
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
