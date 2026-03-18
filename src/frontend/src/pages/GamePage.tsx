import React, { useEffect, useState, useCallback, useRef } from 'react'
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
import CityMapDialog from '../components/CityMapDialog'
import DrinkDialog from '../components/DrinkDialog'
import TrapDialog from '../components/TrapDialog'
import AlliancePanel from '../components/AlliancePanel'
import TutorialOverlay from '../components/TutorialOverlay'
import WelcomeDialog   from '../components/WelcomeDialog'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import MissionPanel      from '../components/MissionPanel'
import DrawnCardDialog  from '../components/DrawnCardDialog'

// ── Helpers ────────────────────────────────────────────────────────────────
const ALCOHOL_EMOJI: Record<string, string> = {
  beer: '🍺', wine: '🍷', whiskey: '🥃', bourbon: '🥃', scotch: '🥃', rye: '🥃',
  gin: '🍸', rum: '🍹', vodka: '🍸', moonshine: '🫙', tequila: '🥂',
  brandy: '🍷', vermouth: '🍸', malort: '😬',
}

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
  id: number; vehicleType: string; cityId: number; heat: number; cargoSlots?: number
  inventory: Array<{ alcohol_type: string; quantity: number }>
}

interface FullState {
  game: {
    status: string; currentSeason: number
    currentPlayerIndex: number; turnDeadline: string | null
    inviteCode: string; gameName: string | null; isHost: boolean; maxPlayers: number
  }
  player: {
    id: number; turnOrder: number; characterClass: string
    cash: number; heat: number; jailUntilSeason: number | null
    currentCityId: number | null; homeCityId: number | null
    adjustmentCards: number
    stuckUntilSeason: number | null
    tutorialSeen: boolean
    currentCityCompetitorStill: { tier: number; ownerPlayerId: number } | null
    currentCityHasTrap: boolean
    myTraps: Array<{ cityId: number; consequenceType: string; cityName: string }>
    pendingDrinks: Array<{ senderName: string; alcoholType: string }>
    pendingTrap: { setterName: string; consequenceType: string; cityName: string; params: Record<string, number> } | null
    vehicles: VehicleState[]
    distilleryCityIds: number[]
    bribedCityIds: number[]
    distilleries: Array<{ id: number; cityId: number; tier: number; primaryAlcohol: string; cityName: string }>
    missions: Array<{ id: number; cardId: number; progress: Record<string, unknown>; assignedSeason: number }>
    totalCashEarned: number
    consecutiveCleanSeasons: number
  }
  vehiclePrices: Record<string, number>
  players: PlayerInfo[]
  alliances: Array<{
    id: number; status: 'pending' | 'active'; formedSeason: number | null
    partnerPlayerId: number; partnerName: string; iRequested: boolean
  }>
}

interface MapCity {
  id: number; name: string; lat: number; lon: number
  owner_player_id: number | null; claim_cost: number
  primary_alcohol: string; population_tier: string
}

const BASE_CLAIM_COST: Record<string, number> = { small: 500, medium: 1000, large: 1500, major: 2500 }

const CHARACTER_DISPLAY: Record<string, { name: string; perk: string; drawback: string }> = {
  priest_nun:   { name: 'The Priest / Nun',             perk: '-25% Heat generation · 2× heat decay',         drawback: '-20% Cargo capacity' },
  hillbilly:    { name: 'The Hillbilly',                 perk: '-20% Distillery upgrade costs',                drawback: '-10% Movement roll' },
  gangster:     { name: 'The Gangster',                  perk: 'Claim cities 25% cheaper',                     drawback: '+20% Heat generation' },
  vixen:        { name: 'The Vixen',                     perk: 'Bribes last 6 seasons',                        drawback: '-10% Production volume' },
  pharmacist:   { name: 'The Pharmacist',                perk: 'Whiskey sells at +50% (medicinal prescription)', drawback: 'Takeover costs +25%' },
  jazz_singer:  { name: 'The Jazz Singer',               perk: 'Passive income in large/major cities',         drawback: '+15% Heat generation' },
  bootlegger:   { name: 'The Bootlegger (Clyde)',        perk: 'All dice rolls +2 bonus',                      drawback: '+20% Heat generation' },
  socialite:    { name: 'The Socialite (Eleanor)',       perk: '+25% sell price everywhere',                   drawback: '-20% Alcohol production' },
  union_leader: { name: 'The Union Leader (Big Mike)',   perk: '+20% production from all stills',              drawback: 'Takeovers cost +20%' },
  rum_runner:   { name: 'The Rum-Runner (Capt. Morgan)', perk: 'Coastal cities produce 2×',                   drawback: '-15% Sell price everywhere' },
}
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
  const [trapOpen,     setTrapOpen]     = useState(false)
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
  const [turnPending, setTurnPending] = useState(false)
  const [cityMapOpen, setCityMapOpen] = useState(false)
  const [showYourTurnDialog, setShowYourTurnDialog] = useState(false)
  const prevIsMyTurnRef = useRef<number | null>(null)
  const [missionsOpen, setMissionsOpen] = useState(false)
  const [drawnCardId,  setDrawnCardId]  = useState<number | null>(null)
  const missionIdsBeforeDrawRef = useRef<Set<number> | null>(null)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)

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

      if (stateData.success) {
        if (stateData.data?.game?.status === 'ended') {
          nav(`/games/${gameId}/end`)
          return
        }
        setFullState(prev => {
          // Show welcome dialog the first time we see tutorialSeen = false
          if (!prev && !stateData.data?.player?.tutorialSeen) {
            setWelcomeOpen(true)
          }
          return stateData.data
        })
      }
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

  // Heartbeat — tell the server this player has the game open, every 60s while tab is visible
  useEffect(() => {
    if (!gameId) return
    const ping = () => {
      if (document.visibilityState === 'visible') {
        fetch(`/api/games/${gameId}/heartbeat`, { method: 'POST' }).catch(() => {})
      }
    }
    ping() // immediate ping on mount
    const interval = setInterval(ping, 60_000)
    document.addEventListener('visibilitychange', ping)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', ping)
    }
  }, [gameId])

  async function dismissDrinks() {
    await fetch(`/api/games/${gameId}/dismiss-drinks`, { method: 'POST' })
    await fetchAll()
  }

  async function submitSabotage() {
    if (!player?.currentCityId || !gameId) return
    await fetch(`/api/games/${gameId}/sabotage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: player.currentCityId }),
    })
    fetchAll()
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const player        = fullState?.player
  const game          = fullState?.game
  const vehiclePrices = fullState?.vehiclePrices ?? {}
  // serverIsMyTurn reflects actual server state, unaffected by optimistic turnPending
  const serverIsMyTurn = player !== undefined && game !== undefined && player.turnOrder === game.currentPlayerIndex
  const isMyTurn = !turnPending && serverIsMyTurn

  // Show "Your Turn" only when currentPlayerIndex genuinely transitions FROM another
  // player's index TO ours — not when it stays on ours (NPC auto-skip loop) and not
  // due to turnPending toggling serverIsMyTurn back and forth.
  useEffect(() => {
    const current = game?.currentPlayerIndex ?? null
    const myOrder = player?.turnOrder ?? null
    const prev    = prevIsMyTurnRef.current as number | null

    prevIsMyTurnRef.current = current as any

    if (prev === null || current === null || myOrder === null) return
    if (current === myOrder && prev !== myOrder) {
      setShowYourTurnDialog(true)
    }
  }, [game?.currentPlayerIndex, player?.turnOrder])

  // Detect newly drawn mission card and show reveal dialog
  useEffect(() => {
    const before = missionIdsBeforeDrawRef.current
    if (!before) return
    const newMission = (player?.missions ?? []).find(m => !before.has(m.id))
    if (newMission) {
      missionIdsBeforeDrawRef.current = null
      setDrawnCardId(newMission.cardId)
    }
  }, [player?.missions])

  // Also show the dialog when a trap notification arrives mid-turn
  const prevPendingTrapRef = useRef<unknown>(null)
  useEffect(() => {
    const prev = prevPendingTrapRef.current
    prevPendingTrapRef.current = player?.pendingTrap ?? null
    if (prev === null && player?.pendingTrap != null) {
      setShowYourTurnDialog(true)
    }
  }, [player?.pendingTrap])
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
  const STILL_OUTPUT: Record<number, number> = { 1: 2, 2: 4, 3: 7, 4: 11, 5: 17 }
  const STILL_UPGRADE_COST: Record<number, number> = { 1: 200, 2: 500, 3: 1000, 4: 2000, 5: 4000 }
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
  const cargoCapacity = (player?.vehicles ?? []).reduce((s, v) => s + (v.cargoSlots ?? 16), 0)
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
    // If already rolled this turn, just re-enter move mode without re-rolling
    if (diceRoll != null) {
      const effective = applyCharModifier(diceRoll, player.characterClass)
      setRemainingBudget(effective)
      setVehicleMoves(player.vehicles.map(v => ({ vehicleId: v.id, targetPath: [], allocatedPoints: 0 })))
      setSelectedVehicleId(player.vehicles[0]?.id ?? null)
      setMoveMode(true)
      return
    }
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
    // Keep diceRoll — player cannot re-roll once they've seen a result
    setVehicleMoves([])
    setSelectedVehicleId(null)
    setRemainingBudget(0)
  }

  function closeAllDialogs() {
    setMarketOpen(false)
    setStillOpen(false)
    setBribeOpen(false)
    setVehicleOpen(false)
    setCityDetailOpen(false)
    setDistilleriesOpen(false)
    setVehiclesOpen(false)
    setNetWorthOpen(false)
  }

  async function submitTurn(actions: unknown[], { refresh = true } = {}) {
    if (refresh) {
      setTurnPending(true)
      cancelMove()
      closeAllDialogs()
      // Yield to the browser so React can commit + paint the loading state
      // before the fetch starts. rAF fires after the next paint frame.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    }
    try {
      const res  = await fetch(`/api/games/${gameId}/turn`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(actions)
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Turn failed (${res.status}): ${text}`)
      }
      const data = await res.json()
      if (data.policeEncounter) {
        setPoliceEncounter(data.policeEncounter)
      }
      if (data.celebrations?.length) {
        setCelebrationQueue(prev => [...prev, ...data.celebrations])
      }
      if (refresh) { setDiceRoll(null); await fetchAll() }
      else cancelMove()
    } finally {
      if (refresh) setTurnPending(false)
    }
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
    const CHARACTERS = Object.entries(CHARACTER_DISPLAY).map(([id, c]) => ({ id, ...c }))
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

            {/* Max players — host can adjust 2-5, others see current setting */}
            {game.isHost ? (
              <div className="bg-stone-800 border border-stone-600 rounded p-3">
                <p className="text-stone-400 text-xs uppercase tracking-wider mb-2">Max Players</p>
                <div className="flex gap-2">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={async () => {
                        await fetch(`/api/games/${gameId}/max-players`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ maxPlayers: n }),
                        })
                        fetchAll()
                      }}
                      className={`flex-1 py-1.5 rounded text-sm font-bold transition ${
                        game.maxPlayers === n
                          ? 'bg-amber-600 text-stone-900'
                          : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-stone-500 text-xs mt-2">
                  Empty slots will be filled with NPC opponents.
                </p>
              </div>
            ) : (
              <div className="bg-stone-800 border border-stone-600 rounded p-3 text-center">
                <p className="text-stone-400 text-xs uppercase tracking-wider mb-0.5">Max Players</p>
                <p className="text-amber-300 font-bold">{game.maxPlayers}</p>
              </div>
            )}

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
    <div className="flex flex-col h-screen overflow-hidden" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Portrait-mode blocker */}
      <div className="portrait-blocker hidden fixed inset-0 z-[9999] bg-stone-950 flex-col items-center justify-center gap-6 p-8">
        <img src="/logo.png" alt="Prohibition" className="h-20 w-auto opacity-80" />
        <p className="text-amber-400 text-2xl font-bold text-center">Rotate your device</p>
        <p className="text-stone-400 text-sm text-center">This game is best played in landscape mode.</p>
        <span className="text-5xl animate-spin" style={{ animationDuration: '3s' }}>📱</span>
      </div>

      {/* Top bar */}
      <div className="px-2 py-1 bg-stone-800 border-b border-stone-700 flex-shrink-0 flex items-center gap-2">
        <button
          onClick={() => nav('/games')}
          className="flex items-center gap-1 flex-shrink-0 group"
          title="Back to games"
        >
          <span className="text-stone-500 group-hover:text-amber-400 transition text-sm">←</span>
          <img src="/logo.png" alt="Prohibition" className="h-8 w-auto group-hover:opacity-80 transition" />
        </button>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          {game?.gameName && (
            <p className="text-xs text-stone-500 uppercase tracking-wider hidden sm:block">
              Game: <span className="text-amber-400 font-bold">{game.gameName}</span>
            </p>
          )}
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
        {gameId && (
          <button
            onClick={() => setNetWorthOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 hover:text-amber-400 text-xs transition flex-shrink-0"
            title="Standings"
          >
            🏆
          </button>
        )}
        {fullState && player && (
          <ChatPanel
            gameId={gameId!}
            myTurnOrder={player.turnOrder}
            players={fullState.players
              .sort((a, b) => a.turnOrder - b.turnOrder)
              .map(p => ({ id: p.id, turnOrder: p.turnOrder, name: p.id === player.id ? 'You' : p.name, isYou: p.id === player.id }))}
            playerColors={PLAYER_COLORS}
            isMyTurn={isMyTurn}
            inventoryItems={(player.vehicles ?? []).flatMap(v => v.inventory).filter(i => i.quantity > 0)}
          />
        )}
        {fullState && player && (
          <AlliancePanel
            gameId={gameId!}
            alliances={fullState.alliances ?? []}
            otherPlayers={fullState.players
              .filter(p => p.id !== player.id && !p.isNpc)
              .map(p => ({ id: p.id, name: p.name }))}
            myPlayerId={player.id}
            onRefresh={fetchAll}
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
                const charDisplay = charId ? CHARACTER_DISPLAY[charId] : null
                const label = charDisplay?.name ?? (charId ? charId.replace(/_/g, ' ') : 'Unknown')
                return (
                  <div>
                    <div className="relative rounded overflow-hidden bg-stone-800 border border-stone-600" style={{ height: 140 }}>
                      <img
                        src={imgSrc}
                        className="w-full h-full object-cover object-top"
                        style={{ filter: 'sepia(0.3) contrast(1.05) brightness(0.9)' }}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                        <p className="text-amber-300 text-xs font-bold leading-tight">{label}</p>
                        {isInJail && <p className="text-red-400 text-xs leading-tight">Behind Bars · {jailSeasonsLeft} season{jailSeasonsLeft !== 1 ? 's' : ''}</p>}
                      </div>
                      {isInJail && (
                        <div className="absolute top-1.5 right-1.5 text-xs text-red-300 bg-red-900/80 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Jailed</div>
                      )}
                    </div>
                    {charDisplay && (
                      <div className="mt-1.5 space-y-0.5">
                        <div className="flex items-start gap-1 text-xs">
                          <span className="text-green-500 font-bold flex-shrink-0">+</span>
                          <span className="text-green-400">{charDisplay.perk}</span>
                        </div>
                        {charDisplay.drawback !== 'None' && (
                          <div className="flex items-start gap-1 text-xs">
                            <span className="text-red-500 font-bold flex-shrink-0">−</span>
                            <span className="text-red-400">{charDisplay.drawback}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div data-tutorial="heat">
                <HeatMeter heat={player?.heat ?? 0} />
              </div>

              {homeCity && (() => {
                const otherDists = (player?.distilleries ?? []).filter(d => d.cityId !== player?.homeCityId)
                return (
                  <div data-tutorial="distillery" className="bg-stone-800 border border-amber-800 rounded p-2 text-xs">
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
                data-tutorial="inventory"
                items={inventoryItems}
                cargoCapacity={cargoCapacity}
                cargoUsed={cargoUsed}
                vehicles={(player?.vehicles ?? []).map((v, i) => ({
                  id: v.id,
                  vehicleType: v.vehicleType,
                  cityName: mapCities.find(c => c.id === v.cityId)?.name ?? `City ${v.cityId}`,
                  isLead: i === 0,
                }))}
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

        {/* City Map dialog */}
        {cityMapOpen && player?.currentCityId != null && (() => {
          const city = mapCities.find(c => c.id === player.currentCityId)
          if (!city) return null
          const slug = city.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
          const vehicleAtCity = (player.vehicles ?? []).find(v => v.cityId === player.currentCityId) ?? null
          return (
            <CityMapDialog
              gameId={gameId!}
              cityName={city.name}
              citySlug={slug}
              populationTier={city.population_tier}
              isMyTurn={isMyTurn}
              playerCash={player.cash}
              vehicleAtCity={vehicleAtCity ? { id: vehicleAtCity.id, inventory: vehicleAtCity.inventory } : null}
              onClose={() => setCityMapOpen(false)}
              onAction={() => fetchAll()}
            />
          )
        })()}

        {/* Your Turn dialog */}
        {showYourTurnDialog && (
          <DrinkDialog
            drinks={player?.pendingDrinks ?? []}
            pendingTrap={player?.pendingTrap ?? null}
            onClose={() => {
              setShowYourTurnDialog(false)
              const hasDrinks = (player?.pendingDrinks ?? []).length > 0
              const hasTrap = player?.pendingTrap != null
              if (hasDrinks || hasTrap) dismissDrinks()
            }}
          />
        )}

        {/* Drawn mission card reveal */}
        {drawnCardId != null && (
          <DrawnCardDialog cardId={drawnCardId} onClose={() => setDrawnCardId(null)} />
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

        {/* Trap dialog */}
        {trapOpen && gameId && (() => {
          const myTrapCityIds = new Set((player?.myTraps ?? []).map(t => t.cityId))
          const vehicleCities = (player?.vehicles ?? [])
            .map(v => {
              const city = mapCities.find(c => c.id === v.cityId)
              if (!city) return null
              return { cityId: city.id, cityName: city.name, alreadyTrapped: myTrapCityIds.has(city.id) }
            })
            .filter(Boolean) as Array<{ cityId: number; cityName: string; alreadyTrapped: boolean }>
          const available = vehicleCities.filter(vc => !vc.alreadyTrapped)
          if (available.length === 0) return null
          return (
            <TrapDialog
              vehicleCities={vehicleCities}
              playerCash={player?.cash ?? 0}
              gameId={gameId}
              onClose={() => setTrapOpen(false)}
              onConfirm={() => { setTrapOpen(false); fetchAll() }}
            />
          )
        })()}

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
            vehiclePrices={vehiclePrices}
            onBuy={(vehicleType) => submitTurn([{ type: 'buy_vehicle', vehicleId: vehicleType }])}
            onClose={() => setVehiclesOpen(false)}
          />
        )}

        {/* Market dialog */}
        {marketOpen && (() => {
          const vehiclesAtCity = (player?.vehicles ?? []).filter(v => v.cityId === viewCityId)
          // Combined capacity across all vehicles at this city
          const marketCargoUsed = vehiclesAtCity.reduce((s, v) => s + v.inventory.reduce((vs, i) => vs + i.quantity, 0), 0)
          const marketCargoFree = vehiclesAtCity.reduce((s, v) => s + (v.cargoSlots ?? 16), 0) - marketCargoUsed
          // Aggregate inventory across all vehicles at this city
          const invMap = new Map<string, number>()
          for (const v of vehiclesAtCity) {
            for (const i of v.inventory) {
              if (i.quantity > 0) invMap.set(i.alcohol_type, (invMap.get(i.alcohol_type) ?? 0) + i.quantity)
            }
          }
          const marketInventory = [...invMap.entries()].map(([alcoholType, units]) => ({ alcoholType, units }))
          const marketPricesForCity = marketPrices
            .filter(p => p.cityId === viewCityId)
            .sort((a, b) => b.price - a.price)
          const canPickUpAtMarketCity = viewCityId != null &&
            (player?.distilleryCityIds ?? []).includes(viewCityId)
          const marketStock = canPickUpAtMarketCity
            ? cityInventory.filter(r => r.city_id === viewCityId && r.quantity > 0)
            : []
          return (
            <MarketDialog
              cityName={mapCities.find(c => c.id === viewCityId)?.name ?? 'Market'}
              prices={marketPricesForCity}
              inventory={marketInventory}
              distilleryStock={marketStock}
              cash={player?.cash ?? 0}
              cargoFree={marketCargoFree}
              currentCityId={viewCityId}
              onClose={() => setMarketOpen(false)}
              onAction={async (actions) => {
                // Distribute each action across vehicles at this city.
                // For pickup/buy: send one action per vehicle with the full requested quantity;
                // the backend clamps each to per-vehicle cargo space and available city stock,
                // so using stale cargo amounts here is not needed.
                // For sell: distribute using snapshot inventory (accurate at click time).
                type RawAction = { type: string; alcoholType?: string; quantity?: number; [key: string]: unknown }
                const expanded: RawAction[] = []
                for (const action of actions as RawAction[]) {
                  if ((action.type === 'pickup' || action.type === 'buy') && action.quantity && vehiclesAtCity.length > 1) {
                    for (const v of vehiclesAtCity) {
                      expanded.push({ ...action, vehicleId: v.id })
                    }
                  } else if (action.type === 'sell' && action.quantity && vehiclesAtCity.length > 1) {
                    let remaining = action.quantity as number
                    for (const v of vehiclesAtCity) {
                      if (remaining <= 0) break
                      const inVehicle = v.inventory.find(i => i.alcohol_type === action.alcoholType)?.quantity ?? 0
                      if (inVehicle <= 0) continue
                      const take = Math.min(remaining, inVehicle)
                      expanded.push({ ...action, vehicleId: v.id, quantity: take })
                      remaining -= take
                    }
                  } else {
                    expanded.push({ ...action, vehicleId: vehiclesAtCity[0]?.id })
                  }
                }
                await submitTurn(expanded, { refresh: false })
                fetchAll()
              }}
            />
          )
        })()}

        {/* Map area */}
        <div data-tutorial="map" className="relative flex-1 min-w-0 overflow-hidden bg-stone-950">
          {/* Missions button — top-right of map pane */}
          <button
            onClick={() => setMissionsOpen(true)}
            className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-stone-900/80 backdrop-blur-sm border border-purple-700 hover:bg-purple-900/50 text-purple-400 font-bold rounded uppercase tracking-wide text-xs transition"
          >
            📜 Missions
            {(player?.missions?.length ?? 0) > 0 && (
              <span className="bg-purple-700 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-black leading-none">
                {player?.missions?.length}
              </span>
            )}
          </button>
          {turnPending && (
            <div className="absolute inset-0 z-30 bg-black/40 flex items-center justify-center pointer-events-all cursor-wait" />
          )}
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

          <TransformWrapper
            minScale={1}
            maxScale={6}
            centerOnInit
            doubleClick={{ mode: 'reset' }}
            panning={{ velocityDisabled: true }}
          >
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%', height: '100%' }}>
              <div className="p-2 w-full h-full">
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
            </TransformComponent>
          </TransformWrapper>
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
          {moveMode && !turnPending ? (
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
                {isAtCity && (
                  <button
                    onClick={() => setCityMapOpen(true)}
                    className="w-full mt-1 py-1.5 border border-stone-600 hover:bg-stone-700 text-stone-300 text-xs font-bold rounded uppercase tracking-wide transition"
                  >
                    🗺 City Map
                  </button>
                )}
              </div>
            )
          })() : (
            <p className="text-stone-600 text-xs italic">Click a city to view info</p>
          )}

          <hr className="border-stone-700" />
          <p className="text-xs text-stone-400 uppercase tracking-wider">Turn Actions</p>


          {isMyTurn && !isInJail && !turnPending ? (
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
                  {/* Fleet location summary */}
                  {(player?.vehicles ?? []).length > 0 && (
                    <div className="text-xs space-y-0.5">
                      {(player?.vehicles ?? []).map(v => {
                        const cityName = mapCities.find(c => c.id === v.cityId)?.name ?? `City ${v.cityId}`
                        return (
                          <div key={v.id} className="flex items-center justify-between text-stone-500">
                            <span className="capitalize">{v.vehicleType.replace(/_/g, ' ')}</span>
                            <button
                              onClick={() => setViewCityId(v.cityId)}
                              className="text-stone-400 hover:text-amber-300 transition"
                            >
                              📍 {cityName}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <button
                    data-tutorial="roll_button"
                    onClick={rollToMove}
                    disabled={
                      player?.stuckUntilSeason != null &&
                      (game?.currentSeason ?? 0) <= player.stuckUntilSeason
                    }
                    title={
                      player?.stuckUntilSeason != null && (game?.currentSeason ?? 0) <= player.stuckUntilSeason
                        ? `Stuck here until season ${player.stuckUntilSeason}`
                        : undefined
                    }
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-stone-900 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    {player?.stuckUntilSeason != null && (game?.currentSeason ?? 0) <= player.stuckUntilSeason
                      ? `⛓️ Stuck — Season ${player.stuckUntilSeason}`
                      : diceRoll != null
                      ? `🎲 Move (${diceRoll} rolled)`
                      : '🎲 Roll to Move'}
                  </button>
                  <button
                    data-tutorial="market"
                    onClick={() => setMarketOpen(true)}
                    disabled={viewCityId == null || !(player?.vehicles ?? []).some(v => v.cityId === viewCityId)}
                    className="w-full py-2 border border-amber-600 hover:bg-amber-900 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    🏪 Market
                  </button>
                  {(() => {
                    const isOwnStill = player?.currentCityId != null &&
                      (player.distilleryCityIds ?? []).includes(player.currentCityId)
                    const competitorStill = player?.currentCityCompetitorStill
                    const canSabotage = !isOwnStill && competitorStill != null && competitorStill.tier > 1
                    const sabotageCost = competitorStill ? (STILL_UPGRADE_COST[competitorStill.tier] ?? 0) : 0
                    const sabotageHeat = competitorStill ? competitorStill.tier * 10 : 0
                    const canAffordSabotage = (player?.cash ?? 0) >= sabotageCost

                    if (canSabotage) {
                      return (
                        <button
                          onClick={submitSabotage}
                          disabled={!canAffordSabotage}
                          title={`Cost: $${sabotageCost.toLocaleString()} · Heat: +${sabotageHeat}`}
                          className="w-full py-2 border border-red-800 hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 font-bold rounded uppercase tracking-wide text-sm transition"
                        >
                          💣 Sabotage Still — ${sabotageCost.toLocaleString()}
                        </button>
                      )
                    }
                    return (
                      <button
                        data-tutorial="upgrade_still"
                        onClick={() => setStillOpen(true)}
                        disabled={!isOwnStill}
                        className="w-full py-2 border border-stone-600 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                      >
                        ⚗️ Upgrade Still
                      </button>
                    )
                  })()}
                  <button
                    onClick={() => setBribeOpen(true)}
                    className="w-full py-2 border border-stone-600 hover:bg-stone-700 text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    💰 Bribe Official
                  </button>
                  {(() => {
                    const myTrapCityIds = new Set((player?.myTraps ?? []).map(t => t.cityId))
                    const hasAvailableCity = (player?.vehicles ?? []).some(v => !myTrapCityIds.has(v.cityId))
                    return (
                      <button
                        onClick={() => setTrapOpen(true)}
                        disabled={!hasAvailableCity}
                        title={!hasAvailableCity ? 'All vehicle cities already have traps set' : undefined}
                        className="w-full py-2 border border-stone-600 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                      >
                        🪤 Set Trap
                      </button>
                    )
                  })()}
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
          ) : turnPending ? (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="text-3xl animate-spin" style={{ animationDuration: '1.2s' }}>🥃</div>
              <p className="text-amber-400 font-bold text-sm uppercase tracking-wide">Running the hooch…</p>
              <p className="text-stone-500 text-xs">Processing your turn</p>
            </div>
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

      {/* Welcome dialog — first step of FTUX */}
      {welcomeOpen && (
        <WelcomeDialog
          onBeginTour={() => { setWelcomeOpen(false); setTutorialOpen(true) }}
          onSkip={async () => {
            setWelcomeOpen(false)
            await fetch(`/api/games/${gameId}/tutorial-done`, { method: 'POST' })
            fetchAll()
          }}
        />
      )}

      {/* Tutorial spotlight steps — begins after welcome dialog */}
      {tutorialOpen && gameId && (
        <TutorialOverlay
          gameId={gameId}
          onDone={() => { setTutorialOpen(false); fetchAll() }}
        />
      )}
      {/* Mission Panel overlay */}
      {missionsOpen && (
        <MissionPanel
          missions={player?.missions ?? []}
          onClose={() => setMissionsOpen(false)}
          onDrawCard={() => {
            missionIdsBeforeDrawRef.current = new Set((player?.missions ?? []).map(m => m.id))
            setMissionsOpen(false)
            submitTurn([{ type: 'draw_mission' }])
          }}
          canDraw={isMyTurn && !isInJail && (player?.missions?.length ?? 0) < 3}
          playerState={{
            cash: player?.cash ?? 0,
            heat: player?.heat ?? 0,
            vehiclesOwned: (player?.vehicles ?? []).length,
            maxDistilleryTier: Math.max(...[(player?.distilleries ?? []).map(d => d.tier), [1]].flat()),
            totalCargoUnits: (player?.vehicles ?? []).reduce((s, v) => s + v.inventory.reduce((vs, i) => vs + i.quantity, 0), 0),
            cargoByType: (player?.vehicles ?? []).reduce((acc, v) => { v.inventory.forEach(i => { acc[i.alcohol_type] = (acc[i.alcohol_type] ?? 0) + i.quantity }); return acc }, {} as Record<string, number>),
            totalCashEarned: player?.totalCashEarned ?? 0,
            consecutiveCleanSeasons: player?.consecutiveCleanSeasons ?? 0,
            citiesOwned: (player?.distilleries ?? []).filter(d => d.cityId !== player?.homeCityId).length + (player?.homeCityId != null ? 1 : 0),
          }}
        />
      )}
    </div>
  )
}
