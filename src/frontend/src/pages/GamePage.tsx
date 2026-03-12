import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SvgMap, { type CityNode, type Road, type PlayerToken } from '../components/SvgMap'
import HeatMeter      from '../components/HeatMeter'
import InventoryPanel from '../components/InventoryPanel'
import MarketDialog   from '../components/MarketDialog'
import VehicleDialog  from '../components/VehicleDialog'
import StillDialog    from '../components/StillDialog'
import PoliceDialog   from '../components/PoliceDialog'
import BribeDialog      from '../components/BribeDialog'
import SeasonTimeline   from '../components/SeasonTimeline'
import JailOverlay      from '../components/JailOverlay'
import CityDetailDialog     from '../components/CityDetailDialog'
import CelebrationDialog, { type Celebration } from '../components/CelebrationDialog'
import NetWorthDialog from '../components/NetWorthDialog'
import ChatPanel from '../components/ChatPanel'

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

interface VehicleState {
  id: number; vehicleType: string; cityId: number; heat: number
  inventory: Array<{ alcohol_type: string; quantity: number }>
}

interface FullState {
  game: {
    status: string; currentSeason: number
    currentPlayerIndex: number; turnDeadline: string | null
    inviteCode: string; gameName: string | null; isHost: boolean
  }
  player: {
    id: number; turnOrder: number; characterClass: string
    cash: number; heat: number; jailUntilSeason: number | null
    currentCityId: number | null; homeCityId: number | null
    adjustmentCards: number
    vehicles: VehicleState[]
    distilleryCityIds: number[]
    bribedCityIds: number[]
    distilleries: Array<{ id: number; cityId: number; tier: number; primaryAlcohol: string; cityName: string }>
  }
  players: PlayerInfo[]
}

interface MapCity {
  id: number; name: string; lat: number; lon: number
  owner_player_id: number | null; claim_cost: number
  primary_alcohol: string; population_tier: string
}

const BASE_CLAIM_COST: Record<string, number> = { small: 500, medium: 1000, large: 1500, major: 2500 }
interface MapRoad  { from_city_id: number; to_city_id: number; distance_value: number }

// Apply character-class modifier to raw dice roll (mirrors server applyMovementModifier)
function applyCharModifier(roll: number, characterClass: string): number {
  if (characterClass === 'bootlegger') return roll + 2
  if (characterClass === 'hillbilly')  return Math.floor(roll * 0.9)
  return roll
}

const VEHICLE_MULT: Record<string, number> = {
  roadster: 1.2, truck: 0.8, workhorse: 1.0, whiskey_runner: 1.5
}

// Effective points for a single vehicle given its allocated budget
function vehicleEffectivePts(allocatedPoints: number, vehicleType: string): number {
  return Math.floor(allocatedPoints * (VEHICLE_MULT[vehicleType] ?? 1.0))
}

// ── Character carousel ─────────────────────────────────────────────────────
const CHARACTER_IMAGES: Record<string, string> = {
  priest_nun:   '/characters/priest_nun.png',
  hillbilly:    '/characters/hillbilly.png',
  gangster:     '/characters/gangster.png',
  vixen:        '/characters/vixen.png',
  pharmacist:   '/characters/pharmacist.png',
  jazz_singer:  '/characters/jazz_singer.png',
  bootlegger:   '/characters/bootlegger.png',
  socialite:    '/characters/socialite.png',
  union_leader: '/characters/union_leader.png',
  rum_runner:   '/characters/rum_runner.png',
}

function CharacterCarousel({
  characters, myClass, takenClasses, onSelect
}: {
  characters: Array<{ id: string; name: string; perk: string; drawback: string }>
  myClass: string
  takenClasses: Set<string>
  onSelect: (id: string) => void
}) {
  const initialIndex = Math.max(0, characters.findIndex(c => c.id === myClass))
  const [idx, setIdx] = React.useState(initialIndex)
  const char   = characters[idx]
  const isMine  = myClass === char.id
  const isTaken = takenClasses.has(char.id) && !isMine
  const imgSrc  = CHARACTER_IMAGES[char.id]

  function prev() { setIdx(i => (i - 1 + characters.length) % characters.length) }
  function next() { setIdx(i => (i + 1) % characters.length) }

  return (
    <div className="flex flex-col items-center gap-3" style={{ width: 620 }}>
      <p className="text-stone-400 text-xs uppercase tracking-wider">Choose Your Character</p>

      {/* Main card with flanking arrows */}
      <div className="flex items-center gap-3 w-full">
        {/* Left arrow */}
        <button onClick={prev}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-amber-600 text-amber-300 text-2xl flex items-center justify-center transition">
          ‹
        </button>

        {/* Card */}
        <div className={`flex-1 rounded-lg border-2 overflow-hidden transition ${
          isMine   ? 'border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.25)]'
          : isTaken ? 'border-stone-700'
                    : 'border-stone-600'
        }`}>
          <div className="relative" style={{ width: 512, height: 512 }}>
            {/* Portrait */}
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={char.name}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: 'sepia(0.35) contrast(1.05) brightness(0.97)' }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'linear-gradient(160deg,#2a2118 0%,#1a130b 100%)' }}>
                <svg viewBox="0 0 100 120" width="120" height="144" opacity="0.35">
                  <ellipse cx="50" cy="32" rx="22" ry="26" fill="#c8a96e"/>
                  <path d="M10 120 Q10 70 50 68 Q90 70 90 120Z" fill="#c8a96e"/>
                </svg>
              </div>
            )}

            {/* Bottom gradient + info overlay */}
            <div className="absolute inset-x-0 bottom-0 px-4 pt-16 pb-4"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)' }}>
              <p className="text-amber-300 font-bold text-lg leading-tight drop-shadow">{char.name}</p>
              <div className="mt-1.5 space-y-0.5">
                <p className="text-xs text-green-400 drop-shadow">✦ {char.perk}</p>
                {char.drawback !== 'None' && <p className="text-xs text-red-400 drop-shadow">✦ {char.drawback}</p>}
              </div>
              <button
                disabled={isTaken}
                onClick={() => onSelect(char.id)}
                className={`mt-3 w-full py-2 rounded font-bold text-sm uppercase tracking-wide transition ${
                  isMine   ? 'bg-amber-600 text-stone-900 cursor-default'
                  : isTaken ? 'bg-stone-800/80 text-stone-500 cursor-not-allowed opacity-50'
                            : 'bg-stone-800/80 hover:bg-amber-700 hover:text-amber-100 text-stone-200'
                }`}
              >
                {isMine ? '✓ Selected' : 'Select Character'}
              </button>
            </div>

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.45) 100%)' }} />

            {/* Counter */}
            <div className="absolute top-2 right-3 text-xs text-stone-400 tabular-nums bg-black/40 px-1.5 py-0.5 rounded">
              {idx + 1} / {characters.length}
            </div>

            {isTaken && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="text-stone-300 text-sm font-bold uppercase tracking-widest bg-black/70 px-4 py-2 rounded">Taken</span>
              </div>
            )}
          </div>
        </div>

        {/* Right arrow */}
        <button onClick={next}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-amber-600 text-amber-300 text-2xl flex items-center justify-center transition">
          ›
        </button>
      </div>
    </div>
  )
}

// ── Name input sub-component ───────────────────────────────────────────────
function NameInput({ currentName, onSave, label = 'Your Name', placeholder = 'Enter your name…' }: { currentName: string; onSave: (name: string) => void; label?: string; placeholder?: string }) {
  const [draft, setDraft] = React.useState(currentName)
  const [saved, setSaved] = React.useState(false)

  async function handleSave() {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === currentName) return
    await onSave(trimmed)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-3">
      <p className="text-stone-400 text-xs uppercase tracking-wider mb-2">{label}</p>
      <div className="flex gap-2">
        <input
          type="text"
          maxLength={30}
          value={draft}
          onChange={e => { setDraft(e.target.value); setSaved(false) }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder={placeholder}
          className="flex-1 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={handleSave}
          disabled={!draft.trim() || draft.trim() === currentName}
          className="px-2 py-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 text-xs font-bold rounded transition"
        >
          {saved ? '✓' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export default function GamePage() {
  const { id: gameId } = useParams<{ id: string }>()
  const nav = useNavigate()

  const [fullState,    setFullState]    = useState<FullState | null>(null)
  const [mapCities,    setMapCities]    = useState<MapCity[]>([])
  const [mapRoads,     setMapRoads]     = useState<MapRoad[]>([])
  const [marketPrices, setMarketPrices] = useState<Array<{ cityId: number; alcoholType: string; price: number }>>([])
  const [cityInventory, setCityInventory] = useState<Array<{ city_id: number; alcohol_type: string; quantity: number }>>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [moveMode,     setMoveMode]     = useState(false)
  const [diceRoll,     setDiceRoll]     = useState<number | null>(null)
  // Multi-vehicle movement state
  const [vehicleMoves, setVehicleMoves] = useState<Array<{ vehicleId: number; targetPath: number[]; allocatedPoints: number }>>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null)
  const [remainingBudget, setRemainingBudget] = useState(0)
  const [marketOpen,   setMarketOpen]   = useState(false)
  const [vehicleOpen,  setVehicleOpen]  = useState(false)
  const [cityDetailOpen, setCityDetailOpen] = useState(false)
  const [stillOpen,    setStillOpen]    = useState(false)
  const [bribeOpen,    setBribeOpen]    = useState(false)
  const [viewCityId,   setViewCityId]   = useState<number | null>(null)
  const [policeEncounter, setPoliceEncounter] = useState<{ bribeCost: number; populationTier: string; heat: number } | null>(null)
  const [leftOpen,  setLeftOpen]  = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [celebrationQueue, setCelebrationQueue] = useState<Celebration[]>([])
  const [distilleriesOpen, setDistilleriesOpen] = useState(false)
  const [vehiclesOpen, setVehiclesOpen] = useState(false)
  const [netWorthOpen, setNetWorthOpen] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!gameId) return
    try {
      const [stateRes, mapRes, marketRes] = await Promise.all([
        fetch(`/api/games/${gameId}/state`),
        fetch(`/api/games/${gameId}/map`),
        fetch(`/api/games/${gameId}/market`)
      ])
      if (stateRes.status === 401 || stateRes.status === 403) {
        nav(`/login?redirect=/games/${gameId}`)
        return
      }

      const stateData  = await stateRes.json()
      const mapData    = await mapRes.json()
      const marketData = await marketRes.json()

      if (stateData.success)  setFullState(stateData.data)
      if (mapData.success) {
        setMapCities(mapData.data.cities ?? [])
        setMapRoads(mapData.data.roads   ?? [])
        setCityInventory(mapData.data.cityInventory ?? [])
      }
      if (marketData.success) {
        setMarketPrices((marketData.data.prices ?? []).map((p: any) => ({
          cityId:        p.city_id,
          alcoholType:   p.alcohol_type,
          price:         p.price,
          primaryAlcohol: p.primary_alcohol
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
  // Fleet-level derived state
  const primaryVehicle = player?.vehicles?.[0] ?? null
  const cargoUsed = (player?.vehicles ?? []).reduce((s, v) => s + v.inventory.reduce((vs, i) => vs + i.quantity, 0), 0)
  const inventoryItems = (player?.vehicles ?? []).flatMap(v => v.inventory)
    .filter(i => i.quantity > 0)
    .map(i => ({ alcoholType: i.alcohol_type, units: i.quantity }))

  const homeCity = player?.homeCityId != null
    ? mapCities.find(c => c.id === player.homeCityId) ?? null
    : null
  const STILL_OUTPUT: Record<number, number> = { 1: 4, 2: 8, 3: 14, 4: 22, 5: 34 }
  const homeDistillery = (player?.distilleries ?? []).find(d => d.cityId === player?.homeCityId) ?? null
  const homeProduction = homeDistillery ? (STILL_OUTPUT[homeDistillery.tier] ?? 4) : 0

  // City stockpile: city_id → total units available
  const cityStockpileTotal = React.useMemo(() => {
    const m = new Map<number, number>()
    for (const row of cityInventory) {
      m.set(row.city_id, (m.get(row.city_id) ?? 0) + row.quantity)
    }
    return m
  }, [cityInventory])

  // Items available to pick up — only at cities where this player owns a distillery
  const canPickUpHere = player?.currentCityId != null &&
    (player.distilleryCityIds ?? []).includes(player.currentCityId)
  const currentCityStock = canPickUpHere
    ? cityInventory.filter(r => r.city_id === player?.currentCityId && r.quantity > 0)
    : []
  const CARGO_SLOTS: Record<string, number> = { workhorse: 16, roadster: 10, truck: 28, whiskey_runner: 6 }
  const cargoCapacity = (player?.vehicles ?? []).reduce((s, v) => s + (CARGO_SLOTS[v.vehicleType] ?? 16), 0)
  const cargoFree = cargoCapacity - cargoUsed

  // Market prices at current city, sorted highest first
  const currentCityPrices = marketPrices
    .filter(p => p.cityId === player?.currentCityId)
    .sort((a, b) => b.price - a.price)

  // Road cost lookup + adjacency list for movement tracking and reachability
  const { roadCosts, adjacency } = React.useMemo(() => {
    const roadCosts = new Map<string, number>()
    const adjacency = new Map<number, Array<{ cityId: number; cost: number }>>()
    for (const r of mapRoads) {
      roadCosts.set(`${r.from_city_id}-${r.to_city_id}`, r.distance_value)
      roadCosts.set(`${r.to_city_id}-${r.from_city_id}`, r.distance_value)
      if (!adjacency.has(r.from_city_id)) adjacency.set(r.from_city_id, [])
      if (!adjacency.has(r.to_city_id))   adjacency.set(r.to_city_id, [])
      adjacency.get(r.from_city_id)!.push({ cityId: r.to_city_id,   cost: r.distance_value })
      adjacency.get(r.to_city_id)!.push(  { cityId: r.from_city_id, cost: r.distance_value })
    }
    return { roadCosts, adjacency }
  }, [mapRoads])

  // Total effective movement budget (character modifier applied, no vehicle multiplier at pool level)
  const movementPoints = diceRoll != null
    ? applyCharModifier(diceRoll, player?.characterClass ?? '')
    : null

  const movementRemaining = movementPoints != null
    ? movementPoints - vehicleMoves.reduce((s, vm) => s + vm.allocatedPoints, 0)
    : null

  // For map highlighting: selected vehicle's reachable cities given remaining budget + its multiplier
  const selectedVehicle = player?.vehicles?.find(v => v.id === selectedVehicleId) ?? primaryVehicle

  // Dijkstra — all cities reachable for the selected vehicle within its effective budget
  const { reachableCityIds, reachableDistances } = React.useMemo<{ reachableCityIds: Set<number> | null; reachableDistances: Map<number, number> | null }>(() => {
    if (!moveMode || movementRemaining == null || movementRemaining < 0 || !selectedVehicle) return { reachableCityIds: null, reachableDistances: null }
    const fromId = selectedVehicle.cityId
    const selectedVehicleMove = vehicleMoves.find(vm => vm.vehicleId === selectedVehicle.id)
    const alreadyAllocated = selectedVehicleMove?.allocatedPoints ?? 0
    const effectiveBudget = vehicleEffectivePts(movementRemaining + alreadyAllocated, selectedVehicle.vehicleType)
    const dist = new Map<number, number>([[fromId, 0]])
    const queue: [number, number][] = [[0, fromId]]
    while (queue.length > 0) {
      queue.sort((a, b) => a[0] - b[0])
      const [cost, cityId] = queue.shift()!
      if (cost > (dist.get(cityId) ?? Infinity)) continue
      for (const { cityId: nId, cost: eCost } of adjacency.get(cityId) ?? []) {
        const nc = cost + eCost
        if (nc <= effectiveBudget && nc < (dist.get(nId) ?? Infinity)) {
          dist.set(nId, nc)
          queue.push([nc, nId])
        }
      }
    }
    const result = new Set<number>()
    for (const [cId] of dist) if (cId !== fromId) result.add(cId)
    return { reachableCityIds: result, reachableDistances: dist }
  }, [moveMode, movementRemaining, selectedVehicle, vehicleMoves, adjacency])

  // Dijkstra returning full path from fromId to toId
  function findShortestPath(fromId: number, toId: number): number[] | null {
    if (fromId === toId) return []
    const dist = new Map<number, number>([[fromId, 0]])
    const prev = new Map<number, number>()
    const queue: [number, number][] = [[0, fromId]]
    while (queue.length > 0) {
      queue.sort((a, b) => a[0] - b[0])
      const [cost, cityId] = queue.shift()!
      if (cost > (dist.get(cityId) ?? Infinity)) continue
      for (const { cityId: nId, cost: eCost } of adjacency.get(cityId) ?? []) {
        const nc = cost + eCost
        if (nc < (dist.get(nId) ?? Infinity)) {
          dist.set(nId, nc)
          prev.set(nId, cityId)
          queue.push([nc, nId])
        }
      }
    }
    if (!prev.has(toId)) return null
    const path: number[] = []
    let cur: number | undefined = toId
    while (cur !== undefined && cur !== fromId) { path.unshift(cur); cur = prev.get(cur) }
    return path
  }

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

  // Build tokens: current player's vehicles + other players' tokens at currentCityId
  const svgTokens: PlayerToken[] = [
    // Other players at their current city
    ...(fullState?.players ?? [])
      .filter(p => p.currentCityId != null && p.id !== player?.id)
      .map((p, _i) => {
        const i = (fullState?.players ?? []).findIndex(fp => fp.id === p.id)
        return { playerId: p.id, cityId: p.currentCityId!, color: PLAYER_COLORS[i % PLAYER_COLORS.length], isMe: false }
      }),
    // My vehicles — each as a separate token
    ...(player?.vehicles ?? []).map(v => {
      const myIndex = (fullState?.players ?? []).findIndex(p => p.id === player?.id)
      return { playerId: player!.id, cityId: v.cityId, color: PLAYER_COLORS[myIndex % PLAYER_COLORS.length], isMe: true }
    })
  ]

  // ── Actions ────────────────────────────────────────────────────────────────
  async function startGame() {
    setStarting(true)
    await fetch(`/api/games/${gameId}/start`, { method: 'POST' })
    fetchAll()
  }

  function rollToMove() {
    if (!player) return
    const numDice = player.vehicles.length + 1
    let rawTotal = 0
    for (let i = 0; i < numDice; i++) rawTotal += Math.ceil(Math.random() * 6)
    const effective = applyCharModifier(rawTotal, player.characterClass)
    setDiceRoll(rawTotal)
    setRemainingBudget(effective)
    setVehicleMoves(player.vehicles.map(v => ({ vehicleId: v.id, targetPath: [], allocatedPoints: 0 })))
    setSelectedVehicleId(player.vehicles[0]?.id ?? null)
    setMoveMode(true)
  }

  function cancelMove() {
    setMoveMode(false)
    setDiceRoll(null)
    setVehicleMoves([])
    setSelectedVehicleId(null)
    setRemainingBudget(0)
  }

  async function submitTurn(actions: unknown[], { refresh = true } = {}) {
    const res  = await fetch(`/api/games/${gameId}/turn`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(actions)
    })
    const data = await res.json()
    cancelMove()
    if (data.policeEncounter) {
      setPoliceEncounter(data.policeEncounter)
    }
    if (data.celebrations?.length) {
      setCelebrationQueue(prev => [...prev, ...data.celebrations])
    }
    if (refresh) fetchAll()
  }

  function handleCityClick(cityId: number) {
    if (!moveMode) {
      setViewCityId(prev => prev === cityId ? null : cityId)
      return
    }
    if (!selectedVehicle) return

    // Clicking the selected vehicle's city clears its route
    if (cityId === selectedVehicle.cityId) {
      setVehicleMoves(prev => prev.map(vm =>
        vm.vehicleId === selectedVehicle.id
          ? { ...vm, targetPath: [], allocatedPoints: 0 }
          : vm
      ))
      setRemainingBudget(movementPoints != null ? movementPoints - vehicleMoves.filter(vm => vm.vehicleId !== selectedVehicle.id).reduce((s, vm) => s + vm.allocatedPoints, 0) : 0)
      return
    }

    const fromId = selectedVehicle.cityId
    const path = findShortestPath(fromId, cityId)
    if (!path) return

    // Compute raw road cost (before vehicle multiplier)
    let rawCost = 0, cur = fromId
    for (const nId of path) { rawCost += roadCosts.get(`${cur}-${nId}`) ?? 0; cur = nId }

    // We need to find how many "raw" points to allocate such that effectivePts >= rawCost
    // effectivePts = floor(allocatedPoints × mult) >= rawCost => allocatedPoints >= ceil(rawCost / mult)
    const mult = VEHICLE_MULT[selectedVehicle.vehicleType] ?? 1.0
    const neededAlloc = Math.ceil(rawCost / mult)

    const newRemaining = movementPoints != null
      ? movementPoints - vehicleMoves.reduce((s, vm) => s + (vm.vehicleId === selectedVehicle.id ? 0 : vm.allocatedPoints), 0) - neededAlloc
      : 0

    if (newRemaining < 0) return  // can't afford

    setVehicleMoves(prev => prev.map(vm =>
      vm.vehicleId === selectedVehicle.id
        ? { ...vm, targetPath: path, allocatedPoints: neededAlloc }
        : vm
    ))
    setRemainingBudget(newRemaining)
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

    async function saveName(name: string) {
      await fetch(`/api/games/${gameId}/name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      fetchAll()
    }

    async function saveGameName(name: string) {
      await fetch(`/api/games/${gameId}/game-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      fetchAll()
    }

    const humanPlayers = (fullState?.players ?? []).filter(p => !p.isNpc)
    const allReady = humanPlayers.length > 0 && humanPlayers.every(p => p.characterClass && p.characterClass !== 'unselected')
    const iAmReady = myClass !== 'unselected'

    async function sendInvite(e: React.FormEvent) {
      e.preventDefault()
      const email = inviteEmail.trim()
      if (!email) return
      setInviteStatus('sending')
      try {
        const res = await fetch(`/api/games/${gameId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        const data = await res.json()
        if (data.success) {
          setInviteStatus('sent')
          setInviteEmail('')
          setTimeout(() => setInviteStatus('idle'), 3000)
        } else {
          setInviteStatus('error')
          setTimeout(() => setInviteStatus('idle'), 3000)
        }
      } catch {
        setInviteStatus('error')
        setTimeout(() => setInviteStatus('idle'), 3000)
      }
    }

    return (
      <div className="min-h-screen bg-stone-900 p-6 flex flex-col items-center gap-6">
        <h2 className="text-3xl font-bold text-amber-400">Speakeasy Lobby</h2>

        <div className="flex gap-6 flex-wrap justify-center">
          {/* Invite code + readiness panel */}
          <div className="flex flex-col gap-4 min-w-56">
            <div className="bg-stone-800 border border-stone-600 rounded p-4 text-center">
              <p className="text-stone-400 text-xs uppercase tracking-wider mb-1">Invite Code</p>
              <p className="text-2xl font-mono font-bold text-amber-300">{game.inviteCode}</p>
            </div>

            {/* Email invite — host only */}
            {game.isHost && (
              <div className="bg-stone-800 border border-stone-600 rounded p-3">
                <p className="text-stone-400 text-xs uppercase tracking-wider mb-2">Invite by Email</p>
                <form onSubmit={sendInvite} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="friend@email.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    disabled={inviteStatus === 'sending'}
                    className="flex-1 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
                    className="px-2 py-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 text-xs font-bold rounded transition flex-shrink-0"
                  >
                    {inviteStatus === 'sending' ? '…' : inviteStatus === 'sent' ? '✓' : 'Send'}
                  </button>
                </form>
                {inviteStatus === 'sent' && <p className="text-green-400 text-xs mt-1.5">Invite sent!</p>}
                {inviteStatus === 'error' && <p className="text-red-400 text-xs mt-1.5">Failed to send invite.</p>}
              </div>
            )}

            {/* Game name — editable by host, read-only for others */}
            {game.isHost ? (
              <NameInput
                currentName={game.gameName ?? ''}
                placeholder="Name your game…"
                onSave={saveGameName}
                label="Game Name"
              />
            ) : game.gameName ? (
              <div className="bg-stone-800 border border-stone-600 rounded p-3 text-center">
                <p className="text-stone-400 text-xs uppercase tracking-wider mb-0.5">Game</p>
                <p className="text-amber-300 font-bold">{game.gameName}</p>
              </div>
            ) : null}

            {/* Readiness panel */}
            <div className="bg-stone-800 border border-stone-600 rounded p-4">
              <p className="text-stone-400 text-xs uppercase tracking-wider mb-3">Players</p>
              {humanPlayers.map((p, i) => {
                const selected = p.characterClass && p.characterClass !== 'unselected'
                const isMe = p.id === player?.id
                return (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-stone-700 last:border-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-semibold truncate ${isMe ? 'text-amber-400' : 'text-stone-300'}`}>
                          {p.name}
                        </p>
                        {isMe && (
                          <button
                            onClick={() => setNameDialogOpen(true)}
                            className="text-xs text-stone-500 hover:text-amber-400 underline underline-offset-2 flex-shrink-0 transition"
                          >
                            change
                          </button>
                        )}
                      </div>
                      <p className={`text-xs truncate ${selected ? 'text-green-400' : 'text-stone-500 italic'}`}>
                        {selected ? p.characterClass!.replace(/_/g, ' ') : 'Choosing…'}
                      </p>
                    </div>
                    <span className={`text-lg flex-shrink-0 ${selected ? 'text-green-400' : 'text-stone-600'}`}>
                      {selected ? '✓' : '○'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Name change dialog */}
            {nameDialogOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setNameDialogOpen(false)}>
                <div className="bg-stone-800 border border-stone-600 rounded-lg p-6 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
                  <h3 className="text-amber-400 font-bold text-lg mb-4">Change Your Name</h3>
                  <NameInput
                    currentName={fullState?.players.find(p => p.id === player?.id)?.name ?? ''}
                    onSave={async (name) => { await saveName(name); setNameDialogOpen(false) }}
                    label="Display Name"
                    placeholder="Enter your name…"
                  />
                  <button
                    onClick={() => setNameDialogOpen(false)}
                    className="mt-3 w-full py-1.5 text-stone-500 hover:text-stone-300 text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!iAmReady && (
              <p className="text-amber-500 text-xs text-center">← Select your character to continue</p>
            )}

            {game.isHost ? (
              <button
                disabled={!allReady || starting}
                onClick={startGame}
                className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-stone-900 font-bold rounded uppercase tracking-wide transition"
                title={!allReady ? 'Waiting for all players to select a character' : ''}
              >
                {starting ? 'Starting…' : allReady ? 'Start Game' : 'Waiting for players…'}
              </button>
            ) : (
              <p className="text-stone-500 italic text-sm text-center">
                {iAmReady ? 'Ready — waiting for host to start…' : 'Select a character to get ready'}
              </p>
            )}
          </div>

          {/* Character carousel */}
          <CharacterCarousel
            characters={CHARACTERS}
            myClass={myClass}
            takenClasses={takenClasses}
            onSelect={selectCharacter}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="px-4 py-2 bg-stone-800 border-b border-stone-700 flex-shrink-0 flex items-center gap-3">
        <button
          onClick={() => nav('/games')}
          className="text-stone-500 hover:text-stone-200 text-xs uppercase tracking-wide transition flex-shrink-0"
          title="Back to game list"
        >
          ← Games
        </button>
        {game?.gameName && (
          <span className="text-amber-400 font-bold text-sm flex-shrink-0 hidden sm:block">{game.gameName}</span>
        )}
        <div className="flex-1 min-w-0">
          <SeasonTimeline
            seasonLabel={seasonLabel}
            currentPlayerName={currentPlayerName}
            isMyTurn={isMyTurn}
            turnOrder={turnOrderNames}
            currentTurnIndex={game?.currentPlayerIndex ?? 0}
            currentCityName={mapCities.find(c => c.id === player?.currentCityId)?.name}
            currentSeason={game?.currentSeason ?? 1}
          />
        </div>
        {fullState && player && (
          <ChatPanel
            gameId={gameId!}
            myTurnOrder={player.turnOrder}
            players={fullState.players
              .sort((a, b) => a.turnOrder - b.turnOrder)
              .map(p => ({ turnOrder: p.turnOrder, name: p.id === player.id ? 'You' : p.name, isYou: p.id === player.id }))}
            playerColors={PLAYER_COLORS}
          />
        )}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar */}
        <div className={`${leftOpen ? 'w-60' : 'w-8'} bg-stone-900 border-r border-stone-700 flex-shrink-0 transition-all duration-200 overflow-hidden relative flex flex-col`}>
          {/* Collapse toggle */}
          <button
            onClick={() => setLeftOpen(o => !o)}
            className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 w-6 h-12 flex items-center justify-center bg-stone-700 hover:bg-amber-700 border border-stone-600 hover:border-amber-500 rounded-r text-stone-300 hover:text-white text-sm font-bold transition shadow-md"
          >{leftOpen ? '‹' : '›'}</button>

          {leftOpen && (
            <div className="p-3 space-y-3 overflow-y-auto flex-1">
              {/* Character portrait */}
              {player && (() => {
                const charId = (player.characterClass && player.characterClass !== 'unselected') ? player.characterClass : null
                const imgSrc = isInJail
                  ? `/jail/${charId ?? 'gangster'}.png`
                  : `/characters/${charId ?? 'gangster'}.png`
                const label = charId ? charId.replace(/_/g, ' ') : 'Unknown'
                return (
                  <div className="relative rounded overflow-hidden bg-stone-800 border border-stone-600" style={{ height: 140 }}>
                    <img
                      src={imgSrc}
                      className="w-full h-full object-cover object-top"
                      style={{ filter: 'sepia(0.3) contrast(1.05) brightness(0.9)' }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                      <p className="text-amber-300 text-xs font-bold capitalize leading-tight">{label}</p>
                      {isInJail && <p className="text-red-400 text-xs leading-tight">Behind Bars · {jailSeasonsLeft} season{jailSeasonsLeft !== 1 ? 's' : ''}</p>}
                    </div>
                    {isInJail && (
                      <div className="absolute top-1.5 right-1.5 text-xs text-red-300 bg-red-900/80 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Jailed</div>
                    )}
                  </div>
                )
              })()}

              <HeatMeter heat={player?.heat ?? 0} />

              {homeCity && (() => {
                const otherDists = (player?.distilleries ?? []).filter(d => d.cityId !== player?.homeCityId)
                return (
                  <div className="bg-stone-800 border border-amber-800 rounded p-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-amber-500 uppercase tracking-wider flex items-center gap-1">
                        <span>⌂</span> Home Distillery
                      </p>
                      {otherDists.length > 0 && (
                        <button
                          onClick={() => setDistilleriesOpen(true)}
                          className="text-stone-400 hover:text-amber-300 text-xs underline underline-offset-2 transition"
                        >
                          +{otherDists.length} more
                        </button>
                      )}
                    </div>
                    <p className="text-amber-300 font-bold">{homeCity.name}</p>
                    <p className="text-stone-400 mt-1 capitalize">
                      Producing: <span className="text-green-400 font-semibold">{homeCity.primary_alcohol}</span>
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-stone-500">Tier {homeDistillery?.tier ?? 1}</span>
                      <span className="text-green-300 font-bold">+{homeProduction} units/season</span>
                    </div>
                    <div className="mt-1.5 flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-sm ${i < (homeDistillery?.tier ?? 1) ? 'bg-amber-500' : 'bg-stone-700'}`} />
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Distilleries popup */}
              {distilleriesOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDistilleriesOpen(false)}>
                  <div className="absolute inset-0 bg-black/60" />
                  <div className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-72 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700">
                      <p className="text-amber-300 font-bold text-sm">⚗ All Distilleries</p>
                      <button onClick={() => setDistilleriesOpen(false)} className="text-stone-500 hover:text-stone-200 text-lg leading-none">✕</button>
                    </div>
                    <div className="overflow-y-auto flex-1 p-3 space-y-2">
                      {(player?.distilleries ?? []).map(d => (
                        <div key={d.id} className={`rounded p-2 text-xs border ${d.cityId === player?.homeCityId ? 'border-amber-800 bg-stone-800' : 'border-stone-700 bg-stone-800'}`}>
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-stone-200">
                              {d.cityId === player?.homeCityId && <span className="text-amber-500 mr-1">⌂</span>}
                              {d.cityName}
                            </p>
                            <span className="text-stone-500">Tier {d.tier}</span>
                          </div>
                          <p className="text-stone-400 mt-0.5 capitalize">
                            <span className="text-green-400 font-semibold">{d.primaryAlcohol}</span>
                            {' · '}+{STILL_OUTPUT[d.tier] ?? 4} units/season
                          </p>
                          <div className="mt-1.5 flex gap-0.5">
                            {Array.from({ length: 5 }, (_, i) => (
                              <div key={i} className={`h-1 flex-1 rounded-sm ${i < d.tier ? (d.cityId === player?.homeCityId ? 'bg-amber-500' : 'bg-green-600') : 'bg-stone-700'}`} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <InventoryPanel
                items={inventoryItems}
                cargoCapacity={cargoCapacity}
                cargoUsed={cargoUsed}
                vehicleCount={player?.vehicles?.length ?? 1}
                onManageFleet={() => setVehiclesOpen(true)}
              />

              <div className="bg-stone-800 border border-stone-600 rounded p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-stone-400 uppercase tracking-wider">Cash</p>
                  <button
                    onClick={() => setNetWorthOpen(true)}
                    className="text-xs text-stone-500 hover:text-amber-300 underline underline-offset-2 transition"
                  >
                    Net Worth
                  </button>
                </div>
                <p className="text-2xl font-bold text-green-400">${(player?.cash ?? 0).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Net worth dialog */}
        {netWorthOpen && gameId && (
          <NetWorthDialog gameId={gameId} onClose={() => setNetWorthOpen(false)} />
        )}

        {/* Celebration dialog */}
        {celebrationQueue.length > 0 && (
          <CelebrationDialog
            celebration={celebrationQueue[0]}
            cityName={celebrationQueue[0].cityId != null
              ? mapCities.find(c => c.id === celebrationQueue[0].cityId)?.name
              : undefined}
            onClose={() => setCelebrationQueue(prev => prev.slice(1))}
          />
        )}

        {/* Police dialog */}
        {policeEncounter && (
          <PoliceDialog
            heat={policeEncounter.heat}
            bribeCost={policeEncounter.bribeCost}
            populationTier={policeEncounter.populationTier}
            totalCargo={cargoUsed}
            cash={player?.cash ?? 0}
            onSubmit={() => { submitTurn([{ type: 'police_resolve', choice: 'submit' }]); setPoliceEncounter(null) }}
            onBribe={() => { submitTurn([{ type: 'police_resolve', choice: 'bribe' }]); setPoliceEncounter(null) }}
            onRun={() => { submitTurn([{ type: 'police_resolve', choice: 'run' }]); setPoliceEncounter(null) }}
          />
        )}

        {/* Bribe dialog */}
        {bribeOpen && player?.currentCityId != null && (
          <BribeDialog
            cityName={mapCities.find(c => c.id === player.currentCityId)?.name ?? 'this city'}
            populationTier={mapCities.find(c => c.id === player.currentCityId)?.population_tier ?? 'small'}
            currentSeason={game?.currentSeason ?? 1}
            characterClass={player.characterClass}
            cash={player.cash}
            alreadyBribed={(player.bribedCityIds ?? []).includes(player.currentCityId)}
            onConfirm={() => submitTurn([{ type: 'bribe_official' }])}
            onClose={() => setBribeOpen(false)}
          />
        )}

        {/* Still dialog */}
        {stillOpen && (
          <StillDialog
            distilleries={player?.distilleries ?? []}
            currentCityId={player?.currentCityId ?? null}
            characterClass={player?.characterClass ?? ''}
            cash={player?.cash ?? 0}
            onUpgrade={(cityId) => submitTurn([{ type: 'upgrade_still', cityId }])}
            onClose={() => setStillOpen(false)}
          />
        )}

        {/* City detail dialog */}
        {cityDetailOpen && viewCityId != null && (() => {
          const city = mapCities.find(c => c.id === viewCityId)
          const ownerPlayer = city?.owner_player_id != null
            ? (fullState?.players ?? []).find(p => p.id === city.owner_player_id) ?? null
            : null
          const ownerColor = ownerPlayer
            ? PLAYER_COLORS[(fullState?.players ?? []).findIndex(p => p.id === ownerPlayer.id) % PLAYER_COLORS.length]
            : null
          return (
            <CityDetailDialog
              cityName={city?.name ?? ''}
              populationTier={city?.population_tier ?? 'small'}
              primaryAlcohol={city?.primary_alcohol ?? ''}
              ownerName={ownerPlayer ? (ownerPlayer.id === player?.id ? 'You' : ownerPlayer.name) : null}
              ownerColor={ownerColor}
              onClose={() => setCityDetailOpen(false)}
            />
          )
        })()}

        {/* Vehicles fleet dialog */}
        {vehiclesOpen && (
          <VehicleDialog
            vehicles={player?.vehicles ?? []}
            cash={player?.cash ?? 0}
            isMyTurn={isMyTurn}
            mapCities={mapCities}
            onBuy={(vehicleType) => submitTurn([{ type: 'buy_vehicle', vehicleId: vehicleType }])}
            onClose={() => setVehiclesOpen(false)}
          />
        )}

        {/* Market dialog */}
        {marketOpen && (() => {
          // Auto-detect vehicle at current city for market actions
          const vehicleAtCity = player?.vehicles?.find(v => v.cityId === player?.currentCityId) ?? null
          const marketVehicleId = vehicleAtCity?.id ?? null
          const marketCargoUsed = vehicleAtCity?.inventory.reduce((s, i) => s + i.quantity, 0) ?? 0
          const marketCargoSlots = CARGO_SLOTS[vehicleAtCity?.vehicleType ?? 'workhorse'] ?? 16
          const marketCargoFree = marketCargoSlots - marketCargoUsed
          const marketInventory = vehicleAtCity?.inventory
            .filter(i => i.quantity > 0)
            .map(i => ({ alcoholType: i.alcohol_type, units: i.quantity })) ?? []
          return (
            <MarketDialog
              cityName={mapCities.find(c => c.id === player?.currentCityId)?.name ?? 'Market'}
              prices={currentCityPrices}
              inventory={marketInventory}
              distilleryStock={currentCityStock}
              cash={player?.cash ?? 0}
              cargoFree={marketCargoFree}
              currentCityId={player?.currentCityId}
              onClose={() => setMarketOpen(false)}
              onAction={async (actions) => {
                // Inject vehicleId into each action
                const enriched = marketVehicleId != null
                  ? actions.map(a => ({ ...a, vehicleId: marketVehicleId }))
                  : actions
                await submitTurn(enriched, { refresh: false })
                fetchAll()
              }}
            />
          )
        })()}

        {/* Map area */}
        <div className="relative flex-1 min-w-0 overflow-hidden bg-stone-950">
          {isInJail && (
            <JailOverlay seasonsRemaining={jailSeasonsLeft} hasLawyerPerk={false} onPayLawyer={() => {}} characterClass={player?.characterClass} />
          )}
          {moveMode && diceRoll != null && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-stone-800 border border-amber-500 rounded px-4 py-2 text-sm text-amber-200 flex items-center gap-3">
              <span className="text-xl font-bold">🎲 {diceRoll}</span>
              <span className="text-stone-400">→</span>
              <span><strong className="text-amber-300">{movementPoints} pts</strong></span>
              {movementRemaining != null && (
                <span className="text-stone-400">· <strong className={movementRemaining >= 0 ? 'text-green-400' : 'text-red-400'}>{movementRemaining} remaining</strong></span>
              )}
              <span className="text-stone-500 text-xs">
                {selectedVehicle ? `Moving: ${selectedVehicle.vehicleType.replace(/_/g, ' ')}` : 'Select a vehicle'}
              </span>
            </div>
          )}
          {/* City background image — shown behind the map when a city is selected */}
          {viewCityId != null && (() => {
            const city = mapCities.find(c => c.id === viewCityId)
            if (!city) return null
            const slug = city.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
            return (
              <div className="absolute inset-0 z-0">
                <img
                  src={`/cities/${slug}.png`}
                  alt=""
                  className="w-full h-full object-cover"
                  style={{ filter: 'sepia(0.2) brightness(0.85) contrast(1.05)', opacity: 0.4, transition: 'opacity 0.4s' }}
                />
              </div>
            )
          })()}

          {/* City name overlay — bottom-left of map pane */}
          {viewCityId != null && (() => {
            const city = mapCities.find(c => c.id === viewCityId)
            if (!city) return null
            return (
              <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
                <p className="text-xs text-stone-400 uppercase tracking-widest leading-none mb-0.5">{city.population_tier} · {city.primary_alcohol}</p>
                <p className="text-2xl font-bold text-amber-200 drop-shadow-lg leading-tight"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>{city.name}</p>
              </div>
            )
          })()}

          <div className="p-2 h-full relative z-10">
            <SvgMap
              cities={svgCities}
              roads={svgRoads}
              playerTokens={svgTokens}
              currentCityId={player?.currentCityId ?? null}
              homeCityId={player?.homeCityId ?? null}
              selectedCityId={moveMode ? (selectedVehicle?.cityId ?? viewCityId) : viewCityId}
              reachableCityIds={reachableCityIds}
              pathCityIds={moveMode ? new Set(vehicleMoves.flatMap(vm => vm.targetPath)) : null}
              cityStockpiles={cityStockpileTotal}
              onCityClick={handleCityClick}
              transparent={viewCityId != null}
            />
          </div>
        </div>

        {/* Right sidebar */}
        <div className={`${rightOpen ? 'w-52' : 'w-8'} bg-stone-900 border-l border-stone-700 flex-shrink-0 transition-all duration-200 overflow-hidden relative flex flex-col`}>
          {/* Collapse toggle */}
          <button
            onClick={() => setRightOpen(o => !o)}
            className="absolute top-1/2 -translate-y-1/2 -left-3 z-20 w-6 h-12 flex items-center justify-center bg-stone-700 hover:bg-amber-700 border border-stone-600 hover:border-amber-500 rounded-l text-stone-300 hover:text-white text-sm font-bold transition shadow-md"
          >{rightOpen ? '›' : '‹'}</button>
        {rightOpen && <div className="p-3 pt-7 space-y-2 overflow-y-auto flex-1">
          {/* City info / fleet move panel */}
          {moveMode ? (
            <div className="space-y-2">
              <p className="text-xs text-stone-400 uppercase tracking-wider">Fleet</p>
              {(player?.vehicles ?? []).map(v => {
                const vm = vehicleMoves.find(m => m.vehicleId === v.id)
                const dest = vm?.targetPath?.length ? mapCities.find(c => c.id === vm.targetPath[vm.targetPath.length - 1])?.name : null
                const isSelected = selectedVehicleId === v.id
                return (
                  <div key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`rounded border p-2 cursor-pointer text-xs transition ${isSelected ? 'border-amber-500 bg-amber-900/20' : 'border-stone-700 bg-stone-800 hover:border-stone-500'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize text-stone-200">{v.vehicleType.replace(/_/g, ' ')}</span>
                      {vm?.allocatedPoints ? <span className="text-amber-300">{vm.allocatedPoints} pts</span> : null}
                    </div>
                    <div className="text-stone-500 mt-0.5">
                      {mapCities.find(c => c.id === v.cityId)?.name ?? `City ${v.cityId}`}
                      {dest && <span className="text-green-400"> → {dest}</span>}
                    </div>
                    {vm?.allocatedPoints ? (
                      <button onClick={(e) => { e.stopPropagation(); setVehicleMoves(prev => prev.map(m => m.vehicleId === v.id ? { ...m, targetPath: [], allocatedPoints: 0 } : m)) }}
                        className="mt-1 text-stone-600 hover:text-red-400 text-xs transition">
                        ✕ Clear
                      </button>
                    ) : null}
                  </div>
                )
              })}
              {reachableCityIds != null && reachableCityIds.size > 0 && (
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wider mb-1">Reachable</p>
                  <ul className="space-y-0.5">
                    {[...reachableCityIds]
                      .map(cId => ({ city: mapCities.find(c => c.id === cId), dist: reachableDistances?.get(cId) ?? 0 }))
                      .filter(x => x.city).sort((a, b) => a.dist - b.dist).slice(0, 6)
                      .map(({ city, dist }) => (
                        <li key={city!.id}
                          className="text-xs flex items-center justify-between gap-1 cursor-pointer hover:text-amber-300 text-stone-300"
                          onClick={() => handleCityClick(city!.id)}
                        >
                          <span>{city!.name}</span>
                          <span className="text-stone-500 tabular-nums">{dist}</span>
                        </li>
                      ))
                    }
                  </ul>
                </div>
              )}
            </div>
          ) : viewCityId != null ? (() => {
            const city  = mapCities.find(c => c.id === viewCityId)
            const ownerPlayer = city?.owner_player_id != null
              ? (fullState?.players ?? []).find(p => p.id === city.owner_player_id) ?? null
              : null
            const ownerColor = ownerPlayer
              ? PLAYER_COLORS[(fullState?.players ?? []).findIndex(p => p.id === ownerPlayer.id) % PLAYER_COLORS.length]
              : null
            const isMyCity   = city?.owner_player_id === player?.id
            const isAtCity   = player?.currentCityId === viewCityId
            const claimCost  = city
              ? (city.owner_player_id == null
                  ? (BASE_CLAIM_COST[city.population_tier] ?? 500)
                  : (city.claim_cost || BASE_CLAIM_COST[city.population_tier] || 500) * 2)
              : 0
            const canAffordClaim = (player?.cash ?? 0) >= claimCost
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-stone-400 uppercase tracking-wider">City Info</p>
                  <button onClick={() => setViewCityId(null)} className="text-stone-600 hover:text-stone-400 text-xs">✕</button>
                </div>
                <button onClick={() => setCityDetailOpen(true)} className="text-left w-full group">
                  <p className="text-amber-300 font-bold text-sm group-hover:text-amber-200 transition">{city?.name} <span className="text-stone-600 text-xs font-normal">ⓘ</span></p>
                </button>
                <p className="text-xs text-stone-500 capitalize">{city?.population_tier} · {city?.primary_alcohol}</p>
                {ownerPlayer ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ownerColor ?? '#888' }} />
                    <span style={{ color: ownerColor ?? '#888' }} className="font-semibold">
                      {ownerPlayer.id === player?.id ? 'You' : ownerPlayer.name}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-stone-600 italic">Neutral city</p>
                )}
                {isMyTurn && !isInJail && !moveMode && isAtCity && !isMyCity && (
                  <button
                    disabled={!canAffordClaim}
                    onClick={() => submitTurn([{ type: 'claim_city' }])}
                    className="w-full mt-1 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 text-amber-100 text-xs font-bold rounded uppercase tracking-wide transition"
                  >
                    {city?.owner_player_id != null ? '⚔ Take Over' : '🏴 Claim'} — ${claimCost.toLocaleString()}
                  </button>
                )}
              </div>
            )
          })() : (
            <p className="text-stone-600 text-xs italic">Click a city to view info</p>
          )}

          <hr className="border-stone-700" />
          <p className="text-xs text-stone-400 uppercase tracking-wider">Turn Actions</p>

          {isMyTurn && !isInJail ? (
            <>
              {moveMode ? (
                <div className="space-y-1">
                  {diceRoll != null && (
                    <div className="bg-stone-800 border border-stone-600 rounded p-2 text-center">
                      <p className="text-stone-400 text-xs uppercase tracking-wider">{(player?.vehicles?.length ?? 1) + 1}d6 Roll</p>
                      <p className="text-2xl font-bold text-amber-300">🎲 {diceRoll}</p>
                      <p className="text-xs text-stone-400">{movementPoints} pts budget</p>
                      {movementRemaining != null && (
                        <p className={`text-xs font-bold ${movementRemaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {movementRemaining} remaining
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => submitTurn([{ type: 'move', roll: diceRoll, vehicles: vehicleMoves.filter(vm => vm.targetPath.length > 0) }])}
                    className="w-full py-2 bg-green-700 hover:bg-green-600 text-white font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    Complete Turn
                  </button>
                  <button
                    onClick={() => submitTurn([{ type: 'stay' }])}
                    className="w-full py-2 border border-stone-600 hover:bg-stone-700 text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    Stay Put
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
                  <button
                    onClick={() => setMarketOpen(true)}
                    className="w-full py-2 border border-amber-600 hover:bg-amber-900 text-amber-400 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    🏪 Market
                  </button>
                  <button
                    onClick={() => setStillOpen(true)}
                    className="w-full py-2 border border-stone-600 hover:bg-stone-700 text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    ⚗️ Upgrade Still
                  </button>
                  <button
                    onClick={() => setBribeOpen(true)}
                    className="w-full py-2 border border-stone-600 hover:bg-stone-700 text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    💰 Bribe Official
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
          ) : isInJail ? (
            <div className="space-y-2">
              <p className="text-stone-500 text-sm italic">Serving time…</p>
              <p className="text-xs text-stone-600">{jailSeasonsLeft} season{jailSeasonsLeft !== 1 ? 's' : ''} remaining</p>
              <button
                onClick={() => submitTurn([{ type: 'stay' }])}
                className="w-full py-2 border border-stone-700 hover:bg-stone-800 text-stone-400 font-bold rounded uppercase tracking-wide text-sm transition"
              >
                End Turn
              </button>
            </div>
          ) : (
            <p className="text-stone-500 text-sm italic">Waiting for {currentPlayerName}</p>
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

        </div>}
        </div>
      </div>
    </div>
  )
}
