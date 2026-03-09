import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SvgMap, { type CityNode, type Road, type PlayerToken } from '../components/SvgMap'
import HeatMeter      from '../components/HeatMeter'
import InventoryPanel from '../components/InventoryPanel'
import MarketPanel    from '../components/MarketPanel'
import SeasonTimeline from '../components/SeasonTimeline'
import JailOverlay    from '../components/JailOverlay'

// ── Helpers ────────────────────────────────────────────────────────────────
const GAME_START_YEAR   = 1921
const SEASONS_PER_YEAR  = 4
const SEASON_NAMES      = ['Spring', 'Summer', 'Autumn', 'Winter'] as const

function getSeasonLabel(season: number): string {
  const yearOffset  = Math.floor((season - 1) / SEASONS_PER_YEAR)
  const seasonIndex = (season - 1) % SEASONS_PER_YEAR
  return `${SEASON_NAMES[seasonIndex]} ${GAME_START_YEAR + yearOffset}`
}

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#a855f7']

// ── Types ──────────────────────────────────────────────────────────────────
interface PlayerInfo {
  id: number; turnOrder: number; characterClass: string
  isNpc: boolean; currentCityId: number | null; name: string
}

interface FullState {
  game: {
    status: string; currentSeason: number
    currentPlayerIndex: number; turnDeadline: string | null
    inviteCode: string; isHost: boolean
  }
  player: {
    id: number; turnOrder: number; characterClass: string; vehicle: string
    cash: number; heat: number; jailUntilSeason: number | null
    currentCityId: number | null; homeCityId: number | null
    adjustmentCards: number
    inventory: Array<{ alcohol_type: string; quantity: number }>
  }
  players: PlayerInfo[]
}

interface MapCity { id: number; name: string; lat: number; lon: number; owner_player_id: number | null }
interface MapRoad  { from_city_id: number; to_city_id: number; distance_value: number }

// Mirror of the server-side calculateEffectiveMovement (characters.ts + movement.ts)
function calcMovementPoints(roll: number, characterClass: string, vehicle: string): number {
  let pts = roll
  if (characterClass === 'bootlegger')   pts += 2
  if (characterClass === 'hillbilly')    pts = Math.floor(pts * 0.9)
  const vehicleMult: Record<string, number> = {
    roadster: 1.2, truck: 0.8, workhorse: 1.0, whiskey_runner: 1.5
  }
  return Math.floor(pts * (vehicleMult[vehicle] ?? 1.0))
}

// ── Component ──────────────────────────────────────────────────────────────
export default function GamePage() {
  const { id: gameId } = useParams<{ id: string }>()
  const nav = useNavigate()

  const [fullState,    setFullState]    = useState<FullState | null>(null)
  const [mapCities,    setMapCities]    = useState<MapCity[]>([])
  const [mapRoads,     setMapRoads]     = useState<MapRoad[]>([])
  const [marketPrices, setMarketPrices] = useState<Array<{ cityId: number; alcoholType: string; price: number }>>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [moveMode,     setMoveMode]     = useState(false)
  const [movePath,     setMovePath]     = useState<number[]>([])
  const [diceRoll,     setDiceRoll]     = useState<number | null>(null)

  const fetchAll = useCallback(async () => {
    if (!gameId) return
    try {
      const [stateRes, mapRes, marketRes] = await Promise.all([
        fetch(`/api/games/${gameId}/state`),
        fetch(`/api/games/${gameId}/map`),
        fetch(`/api/games/${gameId}/market`)
      ])
      if (stateRes.status === 403) { nav('/games'); return }

      const stateData  = await stateRes.json()
      const mapData    = await mapRes.json()
      const marketData = await marketRes.json()

      if (stateData.success)  setFullState(stateData.data)
      if (mapData.success) {
        setMapCities(mapData.data.cities ?? [])
        setMapRoads(mapData.data.roads  ?? [])
      }
      if (marketData.success) {
        setMarketPrices((marketData.data.prices ?? []).map((p: any) => ({
          cityId:      p.city_id,
          alcoholType: p.alcohol_type,
          price:       p.price
        })))
      }
    } catch {
      setError('Failed to load game state')
    } finally {
      setLoading(false)
    }
  }, [gameId, nav])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 15_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  // ── Derived ────────────────────────────────────────────────────────────────
  const player  = fullState?.player
  const game    = fullState?.game
  const isMyTurn  = player !== undefined && game !== undefined && player.turnOrder === game.currentPlayerIndex
  const isInJail  = !!player?.jailUntilSeason && !!game && player.jailUntilSeason > game.currentSeason
  const seasonLabel       = game ? getSeasonLabel(game.currentSeason) : 'Spring 1921'
  const jailSeasonsLeft   = Math.max(0, (player?.jailUntilSeason ?? 0) - (game?.currentSeason ?? 0))
  const currentPlayerName = fullState?.players[game?.currentPlayerIndex ?? 0]?.name ?? '—'
  const turnOrderNames    = (fullState?.players ?? []).map(p => p.name)
  const cargoUsed = (player?.inventory ?? []).reduce((s, i) => s + i.quantity, 0)
  const inventoryItems = (player?.inventory ?? [])
    .filter(i => i.quantity > 0)
    .map(i => ({ alcoholType: i.alcohol_type, units: i.quantity }))

  // Road cost lookup for movement tracking
  const roadCosts = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const r of mapRoads) {
      m.set(`${r.from_city_id}-${r.to_city_id}`, r.distance_value)
      m.set(`${r.to_city_id}-${r.from_city_id}`, r.distance_value)
    }
    return m
  }, [mapRoads])

  const movementPoints = diceRoll != null
    ? calcMovementPoints(diceRoll, player?.characterClass ?? '', player?.vehicle ?? '')
    : null

  const movementUsed = React.useMemo(() => {
    if (!player?.currentCityId) return 0
    let used = 0, current = player.currentCityId
    for (const cityId of movePath) {
      used += roadCosts.get(`${current}-${cityId}`) ?? 0
      current = cityId
    }
    return used
  }, [movePath, roadCosts, player?.currentCityId])

  const movementRemaining = movementPoints != null ? movementPoints - movementUsed : null

  const svgCities: CityNode[] = mapCities.map(c => ({
    id:         c.id,
    name:       c.name,
    lat:        c.lat,
    lon:        c.lon,
    ownerColor: c.owner_player_id != null
      ? PLAYER_COLORS[(fullState?.players ?? []).findIndex(p => p.id === c.owner_player_id) % PLAYER_COLORS.length]
      : undefined
  }))

  const svgRoads: Road[] = mapRoads.map(r => ({
    fromCityId: r.from_city_id,
    toCityId:   r.to_city_id
  }))

  const svgTokens: PlayerToken[] = (fullState?.players ?? [])
    .filter(p => p.currentCityId != null)
    .map((p, i) => ({
      playerId: p.id,
      cityId:   p.currentCityId!,
      color:    PLAYER_COLORS[i % PLAYER_COLORS.length],
      isMe:     p.id === player?.id
    }))

  // ── Actions ────────────────────────────────────────────────────────────────
  async function startGame() {
    await fetch(`/api/games/${gameId}/start`, { method: 'POST' })
    fetchAll()
  }

  function rollToMove() {
    const roll = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6)
    setDiceRoll(roll)
    setMoveMode(true)
    setMovePath([])
  }

  function cancelMove() {
    setMoveMode(false)
    setMovePath([])
    setDiceRoll(null)
  }

  async function submitTurn(actions: unknown[]) {
    await fetch(`/api/games/${gameId}/turn`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(actions)
    })
    cancelMove()
    fetchAll()
  }

  function handleCityClick(cityId: number) {
    if (!moveMode || cityId === player?.currentCityId) return
    setMovePath(prev => {
      // Toggle: clicking the last city in path removes it
      if (prev.length > 0 && prev[prev.length - 1] === cityId) return prev.slice(0, -1)
      // Check we haven't already exceeded movement
      const current = prev.length > 0 ? prev[prev.length - 1] : player?.currentCityId
      if (!current) return prev
      const stepCost = roadCosts.get(`${current}-${cityId}`) ?? 0
      if (movementRemaining != null && stepCost > movementRemaining) return prev
      return [...prev, cityId]
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-stone-400 animate-pulse">Loading your empire…</p>
    </div>
  )
  if (error) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-red-400">{error}</p>
    </div>
  )

  // ── Lobby screen ───────────────────────────────────────────────────────────
  if (game?.status === 'lobby') {
    const CHARACTERS = [
      { id: 'priest_nun',   name: 'The Priest / Nun',           perk: '-25% Heat generation',          drawback: '-20% Cargo capacity' },
      { id: 'hillbilly',    name: 'The Hillbilly',               perk: '-20% Distillery upgrade costs', drawback: '-10% Movement roll' },
      { id: 'gangster',     name: 'The Gangster',                perk: '+15% Double Cross success',     drawback: '+20% Heat in owned cities' },
      { id: 'vixen',        name: 'The Vixen',                   perk: 'Bribes last 6 seasons',         drawback: '-10% Production volume' },
      { id: 'pharmacist',   name: 'The Pharmacist',              perk: 'Medicinal Spirits at 1.5×',     drawback: 'Takeover costs +25%' },
      { id: 'jazz_singer',  name: 'The Jazz Singer',             perk: 'Passive income in big cities',  drawback: 'Higher robbery losses' },
      { id: 'bootlegger',   name: 'The Bootlegger (Clyde)',      perk: 'All dice rolls +2 bonus',       drawback: 'None' },
      { id: 'socialite',    name: 'The Socialite (Eleanor)',     perk: '+15% sell price everywhere',    drawback: 'None' },
      { id: 'union_leader', name: 'The Union Leader (Big Mike)', perk: '+20% Double Cross in big cities', drawback: 'None' },
      { id: 'rum_runner',   name: 'The Rum-Runner (Capt. Morgan)', perk: 'Coastal cities produce 2×',  drawback: 'None' },
    ]
    const myClass = player?.characterClass ?? 'unselected'
    const takenClasses = new Set((fullState?.players ?? []).filter(p => p.id !== player?.id).map(p => p.characterClass))

    async function selectCharacter(id: string) {
      await fetch(`/api/games/${gameId}/character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterClass: id })
      })
      fetchAll()
    }

    return (
      <div className="min-h-screen bg-stone-900 p-6 flex flex-col items-center gap-6">
        <h2 className="text-3xl font-bold text-amber-400">Speakeasy Lobby</h2>

        <div className="flex gap-6 flex-wrap justify-center">
          {/* Invite code + player list */}
          <div className="flex flex-col gap-4 min-w-48">
            <div className="bg-stone-800 border border-stone-600 rounded p-4 text-center">
              <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Invite Code</p>
              <p className="text-2xl font-mono font-bold text-amber-300">{game.inviteCode}</p>
            </div>
            <div className="bg-stone-800 border border-stone-600 rounded p-4">
              <p className="text-stone-400 text-xs uppercase tracking-wider mb-2">Players</p>
              {(fullState?.players ?? []).map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 py-1 text-sm">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                  <span className={p.id === player?.id ? 'text-amber-400' : 'text-stone-300'}>{p.name}</span>
                  {p.characterClass && p.characterClass !== 'unselected' && (
                    <span className="text-stone-500 text-xs truncate">— {p.characterClass.replace(/_/g, ' ')}</span>
                  )}
                </div>
              ))}
            </div>
            {game.isHost ? (
              <button
                onClick={startGame}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide transition"
              >
                Start Game
              </button>
            ) : (
              <p className="text-stone-500 italic text-sm text-center">Waiting for host to start…</p>
            )}
          </div>

          {/* Character grid */}
          <div>
            <p className="text-stone-400 text-xs uppercase tracking-wider mb-3">Choose Your Character</p>
            <div className="grid grid-cols-2 gap-2 max-w-xl">
              {CHARACTERS.map(c => {
                const isMine  = myClass === c.id
                const isTaken = takenClasses.has(c.id)
                return (
                  <button
                    key={c.id}
                    disabled={isTaken && !isMine}
                    onClick={() => selectCharacter(c.id)}
                    className={[
                      'text-left rounded border p-3 transition',
                      isMine  ? 'border-amber-400 bg-amber-900/40'
                              : isTaken ? 'border-stone-700 bg-stone-800/50 opacity-40 cursor-not-allowed'
                                        : 'border-stone-600 bg-stone-800 hover:border-amber-600 hover:bg-stone-700'
                    ].join(' ')}
                  >
                    <p className="font-bold text-sm text-amber-300">{c.name}</p>
                    <p className="text-xs text-green-400 mt-0.5">✦ {c.perk}</p>
                    {c.drawback !== 'None' && <p className="text-xs text-red-400">✦ {c.drawback}</p>}
                    {isTaken && !isMine && <p className="text-xs text-stone-500 mt-0.5">Taken</p>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="px-4 py-2 bg-stone-800 border-b border-stone-700 flex-shrink-0">
        <SeasonTimeline
          seasonLabel={seasonLabel}
          currentPlayerName={currentPlayerName}
          isMyTurn={isMyTurn}
          turnOrder={turnOrderNames}
          currentTurnIndex={game?.currentPlayerIndex ?? 0}
        />
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar */}
        <div className="w-60 bg-stone-900 border-r border-stone-700 p-3 space-y-3 overflow-y-auto flex-shrink-0">
          <HeatMeter heat={player?.heat ?? 0} />

          {player?.characterClass && player.characterClass !== 'unselected' && (
            <div className="bg-stone-800 border border-stone-600 rounded p-2 text-xs">
              <p className="text-stone-400 uppercase tracking-wider mb-1">Character</p>
              <p className="text-amber-400 font-bold capitalize">{player.characterClass.replace(/_/g, ' ')}</p>
              <p className="text-stone-400 mt-1">Vehicle: <span className="text-amber-300 capitalize">{player.vehicle?.replace(/_/g, ' ')}</span></p>
            </div>
          )}

          <InventoryPanel items={inventoryItems} cargoCapacity={8} cargoUsed={cargoUsed} />
          <MarketPanel prices={marketPrices} currentCityId={player?.currentCityId ?? 0} />

          <div className="bg-stone-800 border border-stone-600 rounded p-3">
            <p className="text-xs text-stone-400 uppercase tracking-wider">Cash</p>
            <p className="text-2xl font-bold text-green-400">${(player?.cash ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Map area */}
        <div className="relative flex-1 min-w-0 overflow-hidden">
          {isInJail && (
            <JailOverlay seasonsRemaining={jailSeasonsLeft} hasLawyerPerk={false} onPayLawyer={() => {}} />
          )}
          {moveMode && diceRoll != null && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-stone-800 border border-amber-500 rounded px-4 py-2 text-sm text-amber-200 flex items-center gap-3">
              <span className="text-xl font-bold">🎲 {diceRoll}</span>
              <span className="text-stone-400">→</span>
              <span><strong className="text-amber-300">{movementPoints} pts</strong></span>
              {movementRemaining != null && movePath.length > 0 && (
                <span className="text-stone-400">· <strong className={movementRemaining < 0 ? 'text-red-400' : 'text-green-400'}>{movementRemaining} remaining</strong></span>
              )}
              <span className="text-stone-500 text-xs">Click cities to build path</span>
            </div>
          )}
          <div className="p-2 h-full">
            <SvgMap
              cities={svgCities}
              roads={svgRoads}
              playerTokens={svgTokens}
              currentCityId={player?.currentCityId ?? null}
              selectedCityId={moveMode && movePath.length > 0 ? movePath[movePath.length - 1] : null}
              onCityClick={moveMode ? handleCityClick : undefined}
            />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-52 bg-stone-900 border-l border-stone-700 p-3 space-y-2 overflow-y-auto flex-shrink-0">
          <p className="text-xs text-stone-400 uppercase tracking-wider">Turn Actions</p>

          {isMyTurn && !isInJail ? (
            <>
              {moveMode ? (
                <div className="space-y-1">
                  {diceRoll != null && (
                    <div className="bg-stone-800 border border-stone-600 rounded p-2 text-center">
                      <p className="text-stone-400 text-xs uppercase tracking-wider">Roll</p>
                      <p className="text-2xl font-bold text-amber-300">🎲 {diceRoll}</p>
                      <p className="text-xs text-stone-400">{movementPoints} movement pts</p>
                      {movementRemaining != null && (
                        <p className={`text-xs font-bold ${movementRemaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {movementRemaining} remaining
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    disabled={movePath.length === 0}
                    onClick={() => submitTurn([{ type: 'move', targetPath: movePath, roll: diceRoll }])}
                    className="w-full py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    Confirm Move
                  </button>
                  <button
                    onClick={cancelMove}
                    className="w-full py-1 text-stone-400 hover:text-stone-200 text-xs uppercase tracking-wide transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={rollToMove}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    🎲 Roll to Move
                  </button>
                  <button className="w-full py-2 border border-amber-600 hover:bg-amber-900 text-amber-400 font-bold rounded uppercase tracking-wide text-sm transition">
                    Buy / Sell
                  </button>
                  <button className="w-full py-2 border border-stone-600 hover:bg-stone-700 text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition">
                    Upgrade Still
                  </button>
                  <button className="w-full py-2 border border-stone-600 hover:bg-stone-700 text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition">
                    Bribe Official
                  </button>
                  <hr className="border-stone-700" />
                  <button
                    onClick={() => submitTurn([{ type: 'skip' }])}
                    className="w-full py-2 text-stone-500 hover:text-stone-300 text-xs uppercase tracking-wide transition"
                  >
                    End Turn (Skip)
                  </button>
                </>
              )}
            </>
          ) : (
            <p className="text-stone-500 text-sm italic">
              {isInJail ? 'Serving time…' : `Waiting for ${currentPlayerName}`}
            </p>
          )}

          {/* Player list */}
          {fullState && (
            <div className="pt-2 border-t border-stone-700 space-y-1">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Players</p>
              {fullState.players.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                  <span className={p.id === player?.id ? 'text-amber-400' : 'text-stone-400'}>
                    {p.name}{p.isNpc ? ' (NPC)' : ''}
                    {p.turnOrder === game?.currentPlayerIndex ? ' ●' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
