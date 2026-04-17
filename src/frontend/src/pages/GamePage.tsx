import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SvgMap, { type CityNode, type Road, type PlayerToken, projectLatLon, SVG_W, SVG_H } from '../components/SvgMap'
import HeatMeter      from '../components/HeatMeter'
import InventoryPanel from '../components/InventoryPanel'
import MarketDialog   from '../components/MarketDialog'
import VehicleDialog  from '../components/VehicleDialog'
import StillDialog    from '../components/StillDialog'
import PoliceDialog   from '../components/PoliceDialog'
import FedStopDialog  from '../components/FedStopDialog'
import BribeDialog      from '../components/BribeDialog'
import SeasonTimeline   from '../components/SeasonTimeline'
import JailOverlay      from '../components/JailOverlay'
import CityDetailDialog     from '../components/CityDetailDialog'
import CelebrationDialog, { type Celebration } from '../components/CelebrationDialog'
import NetWorthDialog from '../components/NetWorthDialog'
import LedgerDialog from '../components/LedgerDialog'
import ChatPanel from '../components/ChatPanel'
import CityMapDialog from '../components/CityMapDialog'
import DrinkDialog from '../components/DrinkDialog'
import TrapDialog from '../components/TrapDialog'
import AlliancePanel from '../components/AlliancePanel'
import TutorialOverlay from '../components/TutorialOverlay'
import WelcomeDialog   from '../components/WelcomeDialog'
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch'
import MissionPanel      from '../components/MissionPanel'
import DrawnCardDialog  from '../components/DrawnCardDialog'
import ProhibitionTimes from '../components/ProhibitionTimes'
import { usePushSubscription } from '../hooks/usePushSubscription'
import { capture } from '../analytics'

// ── Helpers ────────────────────────────────────────────────────────────────
const ALCOHOL_EMOJI: Record<string, string> = {
  beer: '🍺', wine: '🍷', whiskey: '🥃', bourbon: '🥃', scotch: '🥃', rye: '🥃',
  gin: '🍸', rum: '🍹', vodka: '🍸', moonshine: '🫙', tequila: '🥂',
  brandy: '🍷', vermouth: '🍸', malort: '😬',
}

const GAME_START_YEAR = 1921
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
  return `${seasonName}${GAME_START_YEAR + yearOffset}`
}

const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f97316', '#a855f7']

// ── Turn Timer ─────────────────────────────────────────────────────────────
function TurnTimer({ startedAt }: { startedAt: string | null }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startedAt) return
    const update = () => setElapsed(Math.floor((Date.now() - new Date(startedAt + 'Z').getTime()) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  if (!startedAt) return null
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const display = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
  return <span className="text-xs text-amber-400 ml-1">({display})</span>
}

// ── Types ──────────────────────────────────────────────────────────────────
interface PlayerInfo {
  id: number; turnOrder: number; characterClass: string
  isNpc: boolean; currentCityId: number | null; name: string
  turnStartedAt: string | null
}

interface VehicleState {
  id: number; vehicleType: string; cityId: number; heat: number; cargoSlots?: number
  stationarySince?: number
  inventory: Array<{ alcohol_type: string; quantity: number }>
}

interface FullState {
  game: {
    status: string; currentSeason: number; totalSeasons: number
    currentPlayerIndex: number; turnDeadline: string | null
    inviteCode: string; gameName: string | null; isHost: boolean; maxPlayers: number; isPublic: boolean
  }
  player: {
    id: number; turnOrder: number; characterClass: string
    cash: number; heat: number; jailUntilSeason: number | null
    currentCityId: number | null; homeCityId: number | null
    adjustmentCards: number
    stuckUntilSeason: number | null
    tutorialSeen: boolean
    currentCityCompetitorStill: { tier: number; ownerPlayerId: number } | null
    competitorStillsByCity: Array<{ cityId: number; tier: number; ownerPlayerId: number; cityIsBribed?: boolean; ownerVehiclePresent?: boolean }>
    currentCityHasTrap: boolean
    myTraps: Array<{ cityId: number; consequenceType: string; cityName: string }>
    pendingDrinks: Array<{ senderName: string; alcoholType: string }>
    pendingTrap: { setterName: string; consequenceType: string; cityName: string; params: Record<string, number> } | null
    vehicles: VehicleState[]
    distilleryCityIds: number[]
    bribedCityIds: number[]
    distilleries: Array<{ id: number; cityId: number; tier: number; primaryAlcohol: string; cityName: string; isCoastal: boolean }>
    missions: Array<{ id: number; cardId: number; progress: Record<string, unknown>; assignedSeason: number }>
    completedMissions: number
    totalCashEarned: number
    consecutiveCleanSeasons: number
    claimCostMultiplier: number
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
  bribe_player_id?: number | null; bribe_expires_season?: number | null
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
    <div className="flex flex-col items-center gap-3 w-full">
      <p className="text-stone-400 text-xs uppercase tracking-wider">Choose Your Character</p>

      {/* Main card with flanking arrows */}
      <div className="flex items-center gap-3 w-full">
        {/* Left arrow */}
        <button onClick={prev}
          className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-amber-600 text-amber-300 text-xl sm:text-2xl flex items-center justify-center transition">
          ‹
        </button>

        {/* Card */}
        <div className={`flex-1 rounded-lg border-2 overflow-hidden transition ${
          isMine   ? 'border-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.25)]'
          : isTaken ? 'border-stone-700'
                    : 'border-stone-600'
        }`}>
          <div className="relative w-full" style={{ paddingBottom: '100%' }}>
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
  const [fedEncounter, setFedEncounter] = useState<{ fineCost: number; jailSeasons: number; cargoUnits: number } | null>(null)
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
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [turnPending, setTurnPending] = useState(false)
  const [cityMapOpen, setCityMapOpen] = useState(false)
  const [showYourTurnDialog, setShowYourTurnDialog] = useState(false)
  const prevIsMyTurnRef = useRef<number | null>(null)
  const [missionsOpen, setMissionsOpen] = useState(false)
  const [drawnCardId,  setDrawnCardId]  = useState<number | null>(null)
  const missionIdsBeforeDrawRef = useRef<Set<number> | null>(null)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [showNewsPrompt, setShowNewsPrompt] = useState(false)
  const [newsDeclined, setNewsDeclined] = useState(false)
  const [mapMode, setMapMode] = useState<'normal' | 'simple' | 'info'>('normal')
  const [infoCityId, setInfoCityId] = useState<number | null>(null)
  const [characterPopup, setCharacterPopup] = useState<{ name: string; perk: string; drawback: string } | null>(null)
  const [boughtThisTurn, setBoughtThisTurn] = useState<Map<number, number>>(new Map())
  const [soldThisTurn,   setSoldThisTurn]   = useState(false)
  const [maxedThisTurn,  setMaxedThisTurn]  = useState(false)
  const [showPaper, setShowPaper] = useState(false)
  const [showBeerTransition, setShowBeerTransition] = useState(false)
  const [beerExiting, setBeerExiting] = useState(false)
  const beerMessageRef = useRef('')
  const beerExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null)

  const fetchAll = useCallback(async () => {
    if (!gameId) return
    try {
      const [stateRes, mapRes, marketRes] = await Promise.all([
        fetch(`/api/games/${gameId}/state`),
        fetch(`/api/games/${gameId}/map`),
        fetch(`/api/games/${gameId}/market`)
      ])
      if (stateRes.status === 401) {
        nav(`/login?redirect=/games/${gameId}`)
        return
      }
      if (stateRes.status === 403) {
        // No longer in this game (e.g. booted) — go back to lobby list
        nav('/games')
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

  usePushSubscription()

  async function dismissDrinks() {
    await fetch(`/api/games/${gameId}/dismiss-drinks`, { method: 'POST' })
    await fetchAll()
  }

  async function submitSabotage() {
    if (!viewCityId || !gameId) return
    await fetch(`/api/games/${gameId}/sabotage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: viewCityId }),
    })
    fetchAll()
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const player        = fullState?.player
  const game          = fullState?.game
  const vehiclePrices = fullState?.vehiclePrices ?? {}
  // serverIsMyTurn reflects actual server state, unaffected by optimistic turnPending
  const serverIsMyTurn = player !== undefined && game !== undefined && player.turnOrder === game.currentPlayerIndex

  // After a sidebar toggle, re-center the map on whatever was at the viewport center before.
  // The content div is width/height 100% of the wrapper, so content-pixel coordinates change
  // when the wrapper resizes. Convert through SVG coordinates (which are invariant) to
  // find the correct new posX/posY.
  function recenterAfterResize(toggle: () => void) {
    const ref = transformRef.current
    if (!ref) { toggle(); return }
    const wrapper = ref.instance.wrapperComponent
    if (!wrapper) { toggle(); return }
    const { positionX, positionY, scale } = ref.instance.transformState
    const oldW = wrapper.clientWidth
    const oldH = wrapper.clientHeight
    const pad = 8 // p-2 padding on the SVG container
    // Content pixel at old viewport center
    const cx = (oldW / 2 - positionX) / scale
    const cy = (oldH / 2 - positionY) / scale
    // Convert to SVG coordinate space (invariant across viewport resizes)
    const svgX = (cx - pad) * SVG_W / Math.max(1, oldW - 2 * pad)
    const svgY = (cy - pad) * SVG_H / Math.max(1, oldH - 2 * pad)
    toggle()
    setTimeout(() => {
      const newW = wrapper.clientWidth
      const newH = wrapper.clientHeight
      // Convert SVG coordinates back to new content pixel space
      const newCX = pad + svgX * (newW - 2 * pad) / SVG_W
      const newCY = pad + svgY * (newH - 2 * pad) / SVG_H
      ref.setTransform(newW / 2 - newCX * scale, newH / 2 - newCY * scale, scale, 0)
    }, 220)
  }

  // Zoom map to fit all owned cities (distilleries + claimed cities)
  function zoomToOwnedCities(ownedCityIds: number[], allCities: MapCity[]) {
    const ref = transformRef.current
    if (!ref) return
    const wrapper = ref.instance.wrapperComponent
    if (!wrapper) return
    const vW = wrapper.clientWidth
    const vH = wrapper.clientHeight
    if (!vW || !vH) return

    const points = ownedCityIds
      .map(id => allCities.find(c => c.id === id))
      .filter(Boolean)
      .flatMap(c => {
        const p = projectLatLon(c!.lat, c!.lon)
        return p ? [p] : []
      })

    if (points.length === 0) return

    // Bounding box in SVG space, with a minimum size for single-city case
    const pad = 8 // SVG units
    let minSX = Math.min(...points.map(p => p.x)) - pad
    let maxSX = Math.max(...points.map(p => p.x)) + pad
    let minSY = Math.min(...points.map(p => p.y)) - pad
    let maxSY = Math.max(...points.map(p => p.y)) + pad
    const minSpan = 80 // SVG units minimum
    if (maxSX - minSX < minSpan) { const mx = (minSX + maxSX) / 2; minSX = mx - minSpan / 2; maxSX = mx + minSpan / 2 }
    if (maxSY - minSY < minSpan) { const my = (minSY + maxSY) / 2; minSY = my - minSpan / 2; maxSY = my + minSpan / 2 }

    // Convert SVG bbox to content CSS pixels (accounting for p-2 = 8px padding)
    const svgPad = 8
    const scaleX = (vW - svgPad * 2) / SVG_W
    const scaleY = (vH - svgPad * 2) / SVG_H
    const toCSS = (sx: number, sy: number) => ({
      x: svgPad + sx * scaleX,
      y: svgPad + sy * scaleY,
    })
    const topLeft  = toCSS(minSX, minSY)
    const botRight = toCSS(maxSX, maxSY)
    const bboxW = botRight.x - topLeft.x
    const bboxH = botRight.y - topLeft.y
    const bboxCX = (topLeft.x + botRight.x) / 2
    const bboxCY = (topLeft.y + botRight.y) / 2

    const scale = Math.min((vW * 0.8) / bboxW, (vH * 0.8) / bboxH, 5)
    const posX  = vW / 2 - bboxCX * scale
    const posY  = vH / 2 - bboxCY * scale

    ref.setTransform(posX, posY, scale, 600, 'easeOut')
  }

  // On initial load: if it's already our turn, pre-select the primary vehicle's city + zoom
  const didInitViewRef = useRef(false)
  useEffect(() => {
    if (didInitViewRef.current || !player || !game) return
    didInitViewRef.current = true
    if (player.turnOrder === game.currentPlayerIndex) {
      const vehicleCity = player.vehicles?.[0]?.cityId
      if (vehicleCity != null) setViewCityId(vehicleCity)
      const ownedIds = [
        ...player.distilleries.map(d => d.cityId),
        ...mapCities.filter(c => c.owner_player_id === player.id).map(c => c.id),
      ]
      setTimeout(() => zoomToOwnedCities([...new Set(ownedIds)], mapCities), 300)
    }
  }, [player?.id])
  const isMyTurn = !turnPending && serverIsMyTurn

  // Reset the first-turn newspaper decline once it becomes the player's turn
  useEffect(() => {
    if (serverIsMyTurn) setNewsDeclined(false)
  }, [serverIsMyTurn])

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
      const vehicleCity = player?.vehicles?.[0]?.cityId
      if (vehicleCity != null) setViewCityId(vehicleCity)
      const ownedIds = [
        ...( player?.distilleries?.map(d => d.cityId) ?? []),
        ...mapCities.filter(c => c.owner_player_id === player?.id).map(c => c.id),
      ]
      setTimeout(() => zoomToOwnedCities([...new Set(ownedIds)], mapCities), 400)
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

  // Always keep a fresh ref to the primary vehicle's city so effects with stale closures can read it
  const primaryVehicleCityRef = useRef<number | null>(null)
  primaryVehicleCityRef.current = player?.vehicles?.[0]?.cityId ?? null

  const BEER_MESSAGES = [
    'Laying low…', 'Counting the take…', 'Greasing the wheels…',
    'Checking the heat…', 'Cutting the deal…', 'Bottling the batch…',
    'Watching the road…', 'Paying off the copper…',
  ]
  // Clear any lingering beer exit timer on unmount
  useEffect(() => () => { if (beerExitTimerRef.current) clearTimeout(beerExitTimerRef.current) }, [])
  const isInJail  = !!player?.jailUntilSeason && !!game && player.jailUntilSeason > game.currentSeason
  const seasonLabel       = game ? getSeasonLabel(game.currentSeason, game.totalSeasons) : 'Spring 1921'
  const jailSeasonsLeft   = Math.max(0, (player?.jailUntilSeason ?? 0) - (game?.currentSeason ?? 0))
  const currentPlayerName = fullState?.players[game?.currentPlayerIndex ?? 0]?.name ?? '—'
  const turnOrderNames    = (fullState?.players ?? []).map(p => p.name)
  // Fleet-level derived state
  const primaryVehicle = player?.vehicles?.[0] ?? null
  const cargoUsed = (player?.vehicles ?? []).reduce((s, v) => s + v.inventory.reduce((vs, i) => vs + i.quantity, 0), 0)
  const inventoryItems = React.useMemo(() => {
    const agg = new Map<string, number>()
    for (const v of player?.vehicles ?? []) {
      for (const i of v.inventory) {
        if (i.quantity > 0) agg.set(i.alcohol_type, (agg.get(i.alcohol_type) ?? 0) + i.quantity)
      }
    }
    return Array.from(agg.entries())
      .map(([alcoholType, units]) => ({ alcoholType, units }))
      .sort((a, b) => b.units - a.units)
  }, [player?.vehicles])

  const homeCity = player?.homeCityId != null
    ? mapCities.find(c => c.id === player.homeCityId) ?? null
    : null

  // Live net worth = cash + cargo (at avg market price) + vehicles + distilleries + owned cities
  const liveNetWorth = React.useMemo(() => {
    if (!player) return 0
    const DIST_VAL: Record<number, number> = { 1: 50, 2: 175, 3: 425, 4: 900, 5: 1900 }
    const BASE_PRICES: Record<string, number> = {
      beer: 15, gin: 25, rum: 20, whiskey: 30, moonshine: 20,
      vodka: 22, bourbon: 28, rye: 26, scotch: 35, tequila: 24,
      brandy: 28, wine: 18, vermouth: 22, malort: 15,
    }
    // Average market price per alcohol type across all cities
    const priceAcc: Record<string, { sum: number; n: number }> = {}
    for (const p of marketPrices) {
      if (!priceAcc[p.alcoholType]) priceAcc[p.alcoholType] = { sum: 0, n: 0 }
      priceAcc[p.alcoholType].sum += p.price
      priceAcc[p.alcoholType].n++
    }
    const avgPrice = (type: string) => priceAcc[type]
      ? Math.round(priceAcc[type].sum / priceAcc[type].n)
      : (BASE_PRICES[type] ?? 0)

    const cargoVal  = player.vehicles.reduce((s, v) => s + v.inventory.reduce((vs, i) => vs + i.quantity * avgPrice(i.alcohol_type), 0), 0)
    const vehVal    = player.vehicles.reduce((s, v) => s + (fullState?.vehiclePrices[v.vehicleType] ?? 200), 0)
    const distVal   = player.distilleries.reduce((s, d) => s + (DIST_VAL[d.tier] ?? 50), 0)
    const cityVal   = mapCities.filter(c => c.owner_player_id === player.id).reduce((s, c) => s + (c.claim_cost ?? 0), 0)
    return player.cash + cargoVal + vehVal + distVal + cityVal
  }, [player, marketPrices, mapCities, fullState?.vehiclePrices])
  const STILL_BASE_OUTPUT: Record<number, number> = { 1: 2, 2: 4, 3: 7, 4: 11, 5: 17 }
  const STILL_UPGRADE_COST: Record<number, number> = { 1: 200, 2: 500, 3: 1000, 4: 2000, 5: 4000 }
  const PROD_MULT: Record<string, number> = { union_leader: 1.2, socialite: 0.8, vixen: 0.9, npc_industrialist: 1.1 }
  const COASTAL_MULT: Record<string, number> = { rum_runner: 2.0 }
  function stillOutput(tier: number, isCoastal: boolean): number {
    const base = STILL_BASE_OUTPUT[tier] ?? 4
    const charClass = player?.characterClass ?? ''
    const prod = PROD_MULT[charClass] ?? 1.0
    const coastal = isCoastal ? (COASTAL_MULT[charClass] ?? 1.0) : 1.0
    return Math.floor(base * prod * coastal)
  }
  const homeDistillery = (player?.distilleries ?? []).find(d => d.cityId === player?.homeCityId) ?? null
  const homeProduction = homeDistillery ? stillOutput(homeDistillery.tier, homeDistillery.isCoastal) : 0

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

  // Build tokens: current player's vehicles + other human players at their currentCityId
  const myPlayerId = player?.id
  const myIndex = (fullState?.players ?? []).findIndex(p => p.id === myPlayerId)
  const svgTokens: PlayerToken[] = [
    // Other human players — one token per player at their currentCityId (exclude self + NPCs)
    ...(fullState?.players ?? [])
      .filter(p => p.currentCityId != null && p.id !== myPlayerId && !p.isNpc)
      .map(p => {
        const i = (fullState?.players ?? []).findIndex(fp => fp.id === p.id)
        return { playerId: p.id, cityId: p.currentCityId!, color: PLAYER_COLORS[i % PLAYER_COLORS.length], isMe: false }
      }),
    // My vehicles — one token per vehicle (each has its own position)
    ...(player?.vehicles ?? []).map(v => ({
      playerId: myPlayerId!,
      cityId: v.cityId,
      color: PLAYER_COLORS[myIndex >= 0 ? myIndex % PLAYER_COLORS.length : 0],
      isMe: true,
    })),
  ]

  // ── Actions ────────────────────────────────────────────────────────────────
  async function startGame() {
    setStarting(true)
    await fetch(`/api/games/${gameId}/start`, { method: 'POST' })
    fetchAll()
  }

  async function bootPlayer(playerRowId: number) {
    await fetch(`/api/games/${gameId}/players/${playerRowId}`, { method: 'DELETE' })
    fetchAll()
  }

  async function leaveGame() {
    if (!confirm(game?.isHost ? 'You are the host. Leaving will cancel the game for everyone. Continue?' : 'Leave this lobby?')) return
    await fetch(`/api/games/${gameId}/leave`, { method: 'DELETE' })
    nav('/games')
  }

  function rollToMove() {
    if (!player) return
    // If already rolled this turn, re-enter move mode preserving existing selections
    if (diceRoll != null) {
      // Ensure all vehicles have an entry (may be missing if vehicles were acquired mid-turn)
      setVehicleMoves(prev => {
        const existingIds = new Set(prev.map(vm => vm.vehicleId))
        const additions = player.vehicles
          .filter(v => !existingIds.has(v.id))
          .map(v => ({ vehicleId: v.id, targetPath: [], allocatedPoints: 0 }))
        return additions.length > 0 ? [...prev, ...additions] : prev
      })
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
    // Exit move-planning UI but preserve vehicleMoves — selections persist until turn ends
    setMoveMode(false)
    setSelectedVehicleId(null)
  }

  function resetMovement() {
    // Full reset — only called after a turn is actually submitted
    setMoveMode(false)
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

  async function submitTurn(actions: unknown[], { refresh = true, transition = false } = {}) {
    if (refresh) {
      setTurnPending(true)
      if (transition) {
        if (beerExitTimerRef.current) clearTimeout(beerExitTimerRef.current)
        beerMessageRef.current = BEER_MESSAGES[Math.floor(Math.random() * BEER_MESSAGES.length)]
        setBeerExiting(false)
        setShowBeerTransition(true)
      }
      resetMovement()
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
      if (data.fedEncounter) {
        setFedEncounter(data.fedEncounter)
      }
      if (data.policeEncounter) {
        setPoliceEncounter(data.policeEncounter)
      }
      if (data.celebrations?.length) {
        setCelebrationQueue(prev => [...prev, ...data.celebrations])
        for (const c of data.celebrations as Celebration[]) {
          if (c.type === 'claim_city')        capture('city_claimed', { cityId: c.cityId })
          if (c.type === 'upgrade_still')     capture('still_upgraded', { new_tier: c.newTier, cityId: c.cityId })
          if (c.type === 'upgrade_vehicle')   capture('vehicle_upgraded', { vehicle_type: c.vehicleId })
          if (c.type === 'mission_complete')  capture('mission_completed', { card_id: c.missionCardId, reward: c.reward })
          if (c.type === 'steal_complete')    capture('steal_complete', { units: c.units, alcohol_type: c.alcoholType })
        }
      }
      if (refresh) {
        const actionTypes = (actions as Array<{ type: string }>).map(a => a.type).filter(Boolean)
        capture('turn_submitted', {
          action_types: actionTypes,
          season: game?.currentSeason,
          heat: player?.heat,
          police_encounter: !!data.policeEncounter,
        })
      }
      if (refresh) { setDiceRoll(null); setBoughtThisTurn(new Map()); setSoldThisTurn(false); setMaxedThisTurn(false); await fetchAll() }
      else resetMovement()
    } finally {
      if (refresh) {
        setTurnPending(false)
        if (transition) {
          if (primaryVehicleCityRef.current != null) setViewCityId(primaryVehicleCityRef.current)
          setBeerExiting(true)
          beerExitTimerRef.current = setTimeout(() => setShowBeerTransition(false), 350)
        }
      }
    }
  }

  function handleCityClick(cityId: number) {
    if (mapMode === 'info') {
      setInfoCityId(prev => prev === cityId ? null : cityId)
      return
    }
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
          capture('invite_sent', { channel: 'email' })
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
      <div className="min-h-screen bg-stone-900 p-4 md:p-6">

        {/* App header — logo left, title + back right */}
        <div className="max-w-4xl mx-auto flex items-center justify-between mb-6">
          <img src="/logo.png" alt="Prohibitioner" className="h-12 w-auto object-contain drop-shadow-lg" />
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-amber-400 hidden sm:block">Speakeasy Lobby</span>
            <button
              onClick={() => nav('/games')}
              className="text-xs text-stone-600 hover:text-amber-400 transition cursor-pointer"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Two-column grid — stacks on mobile */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

          {/* Column 1 — Game setup (visually second) */}
          <div className="space-y-3 md:order-2">

            {/* Game identity card: invite code + game name + email invite */}
            <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">
              {/* Invite code */}
              <div className="px-4 py-3 text-center border-b border-stone-800">
                <p className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-1">Invite Code</p>
                <p className="text-2xl font-mono font-bold text-amber-300">{game.inviteCode}</p>
              </div>

              {/* Game name */}
              {game.isHost ? (
                <div className="px-4 py-3 border-b border-stone-800">
                  <NameInput
                    currentName={game.gameName ?? ''}
                    placeholder="Name your game…"
                    onSave={saveGameName}
                    label="Game Name"
                  />
                </div>
              ) : game.gameName ? (
                <div className="px-4 py-3 text-center border-b border-stone-800">
                  <p className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-0.5">Game</p>
                  <p className="text-amber-300 font-bold">{game.gameName}</p>
                </div>
              ) : null}

              {/* Email invite — host only */}
              {game.isHost && (
                <div className="px-4 py-3">
                  <p className="text-xs text-stone-600 mb-2">Invite a friend by email</p>
                  <form onSubmit={sendInvite} className="flex gap-2">
                    <input
                      type="email"
                      placeholder="friend@email.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      disabled={inviteStatus === 'sending'}
                      className="flex-1 px-3 py-2 bg-stone-800 rounded border border-stone-700 focus:outline-none focus:border-amber-500 text-sm placeholder-stone-600 min-w-0"
                    />
                    <button
                      type="submit"
                      disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
                      className="px-4 py-2 border border-stone-600 hover:border-amber-600 hover:text-amber-400 text-stone-400 font-bold rounded text-xs uppercase tracking-wide transition cursor-pointer disabled:opacity-40"
                    >
                      {inviteStatus === 'sending' ? '…' : inviteStatus === 'sent' ? 'Sent' : 'Send'}
                    </button>
                  </form>
                  {inviteStatus === 'sent' && <p className="text-green-400 text-xs mt-1.5">Invite sent!</p>}
                  {inviteStatus === 'error' && <p className="text-red-400 text-xs mt-1.5">Failed to send invite.</p>}
                </div>
              )}
            </div>

            {/* Settings + Players card */}
            <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">
              {/* Max players */}
              <div className="px-4 py-3 border-b border-stone-800">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">Max Players</p>
                  {!game.isHost && <span className="text-sm font-bold text-amber-300">{game.maxPlayers}</span>}
                </div>
                {game.isHost && (
                  <>
                    <div className="flex gap-1">
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
                          className={`flex-1 py-1 text-xs font-bold rounded transition border cursor-pointer ${
                            game.maxPlayers === n
                              ? 'bg-amber-600 border-amber-500 text-stone-900'
                              : 'bg-stone-800 border-stone-600 text-stone-500 hover:border-amber-700 hover:text-amber-400'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-stone-600 text-xs mt-1.5">Empty slots filled with NPC opponents.</p>
                  </>
                )}
              </div>

              {/* Visibility toggle — host only */}
              {game.isHost && (
                <div className="px-4 py-3 border-b border-stone-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">Visibility</p>
                      <p className="text-xs text-stone-600 mt-0.5">
                        {game.isPublic ? 'Anyone can find and join this game' : 'Only people with the invite code can join'}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`/api/games/${gameId}/visibility`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ isPublic: !game.isPublic }),
                        })
                        fetchAll()
                      }}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${game.isPublic ? 'bg-amber-500' : 'bg-stone-700'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${game.isPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              )}

              {/* Players readiness */}
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-2">Players</p>
              </div>
              {humanPlayers.map((p, i) => {
                const selected = p.characterClass && p.characterClass !== 'unselected'
                const isMe = p.id === player?.id
                return (
                  <div key={p.id} className="px-4 py-3 border-b border-stone-800 last:border-0 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-semibold truncate ${isMe ? 'text-amber-400' : 'text-stone-300'}`}>
                          {p.name}
                        </p>
                        {isMe && (
                          <button
                            onClick={() => setNameDialogOpen(true)}
                            className="text-xs text-stone-500 hover:text-amber-400 underline underline-offset-2 flex-shrink-0 transition cursor-pointer"
                          >
                            change
                          </button>
                        )}
                      </div>
                      <p className={`text-xs truncate ${selected ? 'text-green-400' : 'text-stone-500 italic'}`}>
                        {selected ? p.characterClass!.replace(/_/g, ' ') : 'Choosing…'}
                      </p>
                    </div>
                    <span className={`text-base flex-shrink-0 ${selected ? 'text-green-400' : 'text-stone-600'}`}>
                      {selected ? '✓' : '○'}
                    </span>
                    {game.isHost && !isMe && (
                      <button
                        onClick={() => bootPlayer(p.id)}
                        className="text-stone-700 hover:text-red-400 text-base leading-none flex-shrink-0 transition cursor-pointer ml-1"
                        title={`Boot ${p.name}`}
                        aria-label={`Boot ${p.name}`}
                      >×</button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Start / ready */}
            {!iAmReady && (
              <p className="text-amber-500 text-xs text-center">Select your character on the right to continue →</p>
            )}
            {game.isHost ? (
              <button
                disabled={!allReady || starting}
                onClick={startGame}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-stone-900 font-bold rounded uppercase tracking-wide transition text-sm cursor-pointer"
                title={!allReady ? 'Waiting for all players to select a character' : ''}
              >
                {starting ? 'Starting…' : allReady ? 'Start Game' : 'Waiting for players…'}
              </button>
            ) : (
              <p className="text-stone-500 italic text-sm text-center">
                {iAmReady ? 'Ready — waiting for host to start…' : 'Select a character to get ready'}
              </p>
            )}
            <button
              onClick={leaveGame}
              className="w-full py-1.5 text-stone-600 hover:text-red-400 text-xs transition cursor-pointer"
            >
              {game.isHost ? 'Cancel Game' : 'Leave Lobby'}
            </button>
          </div>

          {/* Column 2 — Character selection (visually first) */}
          <div className="space-y-3 md:order-1">

            {/* Character carousel */}
            <CharacterCarousel
              characters={CHARACTERS}
              myClass={myClass}
              takenClasses={takenClasses}
              onSelect={selectCharacter}
            />

            {/* Why character choice matters */}
            <div className="bg-stone-900 border border-stone-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-800">
                <p className="text-xs text-stone-500 uppercase tracking-widest font-bold">Why Your Character Matters</p>
              </div>
              <div className="px-4 py-3 space-y-2">
                <p className="text-stone-400 text-xs leading-relaxed">
                  Your character class shapes your entire strategy. Each one has a meaningful perk and a real drawback — there is no neutral choice.
                </p>
                <div className="space-y-1.5 text-xs text-stone-500 leading-relaxed">
                  <p><span className="text-green-400 font-semibold">Production</span> — Union Leader &amp; Hillbilly snowball income if you invest in stills early.</p>
                  <p><span className="text-amber-400 font-semibold">Trade</span> — Socialite &amp; Pharmacist make fewer runs more profitable.</p>
                  <p><span className="text-blue-400 font-semibold">Expansion</span> — Gangster &amp; Rum Runner dominate territory.</p>
                  <p><span className="text-purple-400 font-semibold">Stealth</span> — Priest/Nun &amp; Vixen let you operate boldly without going to jail.</p>
                </div>
                <p className="text-stone-600 text-xs italic">Hint: your starting city's primary alcohol affects how well each build performs.</p>
              </div>
            </div>
          </div>

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
                className="mt-3 w-full py-1.5 text-stone-500 hover:text-stone-300 text-sm transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
        <button
          onClick={() => nav('/games')}
          className="px-5 py-2 border border-stone-700 hover:border-amber-600 hover:text-amber-400 text-stone-500 text-sm rounded transition cursor-pointer"
        >
          ← Back to Games
        </button>
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
            totalSeasons={game?.totalSeasons ?? 52}
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
        {gameId && (
          <button
            onClick={() => setLedgerOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 hover:text-amber-400 text-xs transition flex-shrink-0"
            title="Ledger"
          >
            📒
          </button>
        )}
        <button
          onClick={() => setTutorialOpen(true)}
          className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-400 hover:text-amber-400 text-xs font-bold transition flex-shrink-0"
          title="Help"
        >
          ?
        </button>
        {fullState && player && (
          <span data-tutorial="chat">
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
          </span>
        )}
        {fullState && player && (
          <span data-tutorial="alliances">
          <AlliancePanel
            gameId={gameId!}
            alliances={fullState.alliances ?? []}
            otherPlayers={fullState.players
              .filter(p => p.id !== player.id && !p.isNpc)
              .map(p => ({ id: p.id, name: p.name }))}
            myPlayerId={player.id}
            onRefresh={fetchAll}
          />
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Prohibition Times — full-area overlay when waiting for another player's turn */}
        {!serverIsMyTurn && !turnPending && !isInJail && game?.status === 'active' && player?.tutorialSeen && !showNewsPrompt && !newsDeclined && (
          <div className="absolute inset-0 z-30 overflow-hidden">
            <ProhibitionTimes gameId={gameId!} currentSeason={game.currentSeason} onClose={() => setNewsDeclined(true)} />
          </div>
        )}
        {/* Left sidebar */}
        <div data-tutorial="player_panel" className={`${leftOpen ? 'w-60' : 'w-8'} bg-stone-900 border-r border-stone-700 flex-shrink-0 transition-all duration-200 overflow-hidden relative flex flex-col`}>
          {/* Collapse toggle */}
          <button
            onClick={() => recenterAfterResize(() => setLeftOpen(o => !o))}
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

              <div className="bg-stone-800 border border-stone-600 rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-stone-400 uppercase tracking-wider">Net Worth</p>
                  <button
                    onClick={() => setNetWorthOpen(true)}
                    className="text-xs text-stone-500 hover:text-amber-300 underline underline-offset-2 transition"
                  >
                    Breakdown
                  </button>
                </div>
                <p className="text-2xl font-bold text-green-400">${liveNetWorth.toLocaleString()}</p>
                <p className="text-xs text-stone-500 mt-0.5">Cash ${(player?.cash ?? 0).toLocaleString()}</p>
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
                            {' · '}+{stillOutput(d.tier, d.isCoastal)} units/season
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
                  turnsStationary: v.stationarySince != null ? (game?.currentSeason ?? 1) - v.stationarySince + 1 : undefined,
                }))}
                currentSeason={game?.currentSeason ?? 1}
                onManageFleet={() => setVehiclesOpen(true)}
                isMyTurn={isMyTurn}
                soldThisTurn={soldThisTurn}
                maxedThisTurn={maxedThisTurn}
                onSellAll={async () => {
                  setSoldThisTurn(true)
                  const res = await fetch(`/api/games/${gameId}/sell-distillery-stock`, { method: 'POST' })
                  const data = await res.json()
                  if (data.celebrations?.length) setCelebrationQueue(prev => [...prev, ...data.celebrations])
                  fetchAll()
                }}
                onMaxOut={async () => {
                  setMaxedThisTurn(true)
                  await fetch(`/api/games/${gameId}/max-out-vehicles`, { method: 'POST' })
                  fetchAll()
                }}
              />

              <button
                onClick={() => setShowPaper(true)}
                className="w-full py-1.5 border border-stone-600 hover:border-amber-600 hover:text-amber-300 text-stone-400 text-xs font-bold rounded uppercase tracking-wide transition flex items-center justify-center gap-1.5"
              >
                📰 Prohibition Times
              </button>

            </div>
          )}
        </div>

        {/* Net worth dialog */}
        {netWorthOpen && gameId && (
          <NetWorthDialog gameId={gameId} onClose={() => setNetWorthOpen(false)} />
        )}

        {/* Ledger dialog */}
        {ledgerOpen && gameId && (
          <LedgerDialog gameId={gameId} onClose={() => setLedgerOpen(false)} />
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
            onRepairVehicle={async (vehicleDbId, repairCost) => {
              await fetch(`/api/games/${gameId}/vehicle-repair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId: vehicleDbId, choice: 'repair' }),
              })
              setCelebrationQueue(prev => prev.slice(1))
              await fetchAll()
            }}
            onAbandonVehicle={async (vehicleDbId) => {
              await fetch(`/api/games/${gameId}/vehicle-repair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId: vehicleDbId, choice: 'abandon' }),
              })
              setCelebrationQueue(prev => prev.slice(1))
              await fetchAll()
            }}
          />
        )}

        {/* Federal stop dialog */}
        {fedEncounter && (
          <FedStopDialog
            fineCost={fedEncounter.fineCost}
            jailSeasons={fedEncounter.jailSeasons}
            cargoUnits={fedEncounter.cargoUnits}
            cash={player?.cash ?? 0}
            onPay={() => { submitTurn([{ type: 'fed_stop_respond', choice: 'pay' }], { transition: true }); setFedEncounter(null) }}
            onJail={() => { submitTurn([{ type: 'fed_stop_respond', choice: 'jail' }], { transition: true }); setFedEncounter(null) }}
            onSnitch={() => { submitTurn([{ type: 'fed_stop_respond', choice: 'snitch' }], { transition: true }); setFedEncounter(null) }}
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
            onSubmit={() => { submitTurn([{ type: 'police_resolve', choice: 'submit' }], { transition: true }); setPoliceEncounter(null) }}
            onBribe={() => { submitTurn([{ type: 'police_resolve', choice: 'bribe' }], { transition: true }); setPoliceEncounter(null) }}
            onRun={() => { submitTurn([{ type: 'police_resolve', choice: 'run' }], { transition: true }); setPoliceEncounter(null) }}
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

        {/* Bribe dialog — targets viewCityId (any city where the player has a vehicle) */}
        {bribeOpen && viewCityId != null && (
          <BribeDialog
            cityName={mapCities.find(c => c.id === viewCityId)?.name ?? 'this city'}
            populationTier={mapCities.find(c => c.id === viewCityId)?.population_tier ?? 'small'}
            currentSeason={game?.currentSeason ?? 1}
            characterClass={player?.characterClass ?? ''}
            cash={player?.cash ?? 0}
            alreadyBribed={(() => {
              const mc = mapCities.find(c => c.id === viewCityId)
              return mc?.bribe_player_id === player?.id &&
                     (mc?.bribe_expires_season ?? 0) > (game?.currentSeason ?? 1)
            })()}
            onConfirm={() => submitTurn([{ type: 'bribe_official', cityId: viewCityId }])}
            onClose={() => setBribeOpen(false)}
          />
        )}

        {/* Still dialog */}
        {stillOpen && (
          <StillDialog
            distilleries={player?.distilleries ?? []}
            vehicleCityIds={new Set((player?.vehicles ?? []).map(v => v.cityId))}
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
            carLimit={Math.max(1, mapCities.filter(c => c.owner_player_id === player?.id).length - 1)}
            onBuy={(vehicleType) => submitTurn([{ type: 'buy_vehicle', vehicleId: vehicleType }])}
            onSell={async (vehicleId) => {
              await fetch(`/api/games/${gameId}/sell-vehicle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId }),
              })
              fetchAll()
            }}
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
          const totalRemainingBudget = vehiclesAtCity.reduce((sum, v) => {
            const slots = v.cargoSlots ?? 16
            const bought = boughtThisTurn.get(v.id) ?? 0
            return sum + Math.max(0, slots - bought)
          }, 0)
          return (
            <MarketDialog
              cityName={mapCities.find(c => c.id === viewCityId)?.name ?? 'Market'}
              prices={marketPricesForCity}
              inventory={marketInventory}
              distilleryStock={marketStock}
              cash={player?.cash ?? 0}
              cargoFree={marketCargoFree}
              currentCityId={viewCityId}
              characterClass={player?.characterClass}
              purchaseBudgetExhausted={totalRemainingBudget === 0 && vehiclesAtCity.some(v => (boughtThisTurn.get(v.id) ?? 0) > 0)}
              onClose={() => setMarketOpen(false)}
              onAction={async (actions) => {
                // Distribute each action across vehicles at this city.
                // For pickup/buy: send one action per vehicle with the full requested quantity;
                // the backend clamps each to per-vehicle cargo space and available city stock,
                // so using stale cargo amounts here is not needed.
                // For sell: distribute using snapshot inventory (accurate at click time).
                type RawAction = { type: string; alcoholType?: string; quantity?: number; vehicleId?: number; [key: string]: unknown }
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
                // Accumulate buy quantities for the per-turn budget tracker
                for (const action of expanded) {
                  if (action.type === 'buy' && action.vehicleId != null && action.quantity) {
                    setBoughtThisTurn(prev => {
                      const next = new Map(prev)
                      next.set(action.vehicleId!, (next.get(action.vehicleId!) ?? 0) + (action.quantity as number))
                      return next
                    })
                  }
                }
                fetchAll()
              }}
            />
          )
        })()}

        {/* Map area */}
        <div data-tutorial="map" className="relative flex-1 min-w-0 overflow-hidden bg-stone-950">
          {/* Missions button — top-right of map pane */}
          <button
            data-tutorial="missions"
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
          {/* Map mode toggle — top-left */}
          <button
            onClick={() => {
              setMapMode(m => m === 'normal' ? 'info' : m === 'info' ? 'simple' : 'normal')
              setInfoCityId(null)
            }}
            className={`absolute top-2 left-2 z-10 flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-sm border rounded uppercase tracking-wide text-xs font-bold transition ${
              mapMode === 'info'   ? 'bg-blue-900/80 border-blue-500 text-blue-200 hover:bg-blue-800/80'
              : mapMode === 'simple' ? 'bg-amber-900/80 border-amber-500 text-amber-200 hover:bg-amber-800/80'
              : 'bg-stone-900/80 border-stone-600 text-stone-400 hover:bg-stone-700/80 hover:text-stone-200'
            }`}
          >
            {mapMode === 'info' ? 'ℹ Info' : mapMode === 'simple' ? '⬡ Simple' : '🗺 Map'}
          </button>
          {mapMode === 'info' && (
            <div className="absolute top-10 left-2 z-10 text-xs text-blue-300/70 bg-stone-900/70 backdrop-blur-sm px-2 py-1 rounded pointer-events-none">
              Tap a city to inspect
            </div>
          )}
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
          {mapMode !== 'info' && viewCityId != null && (() => {
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

          {/* Info mode city card — bottom-left of map pane */}
          {mapMode === 'info' && infoCityId != null && (() => {
            const city = mapCities.find(c => c.id === infoCityId)
            if (!city) return null
            const owner = fullState?.players.find(p => p.id === city.owner_player_id)
            const TIER_LABEL: Record<string, string> = { small: 'Small', medium: 'Medium', large: 'Large', major: 'Major' }
            const baseClaimCost = BASE_CLAIM_COST[city.population_tier] ?? 500
            const displayCost = city.owner_player_id == null
              ? Math.floor(baseClaimCost * (player?.claimCostMultiplier ?? 1))
              : (city.claim_cost > 0 ? city.claim_cost * 2 : baseClaimCost * 2)
            const costLabel = city.owner_player_id == null ? 'Claim cost' : 'Takeover cost'
            return (
              <div className="absolute bottom-4 left-4 z-20 bg-stone-900/90 backdrop-blur-sm border border-stone-600 rounded-lg p-3 min-w-[180px] shadow-xl">
                <p className="text-amber-300 font-bold text-base leading-tight mb-2">{city.name}</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-stone-400">Produces</span>
                    <span className="text-green-400 font-semibold capitalize">{city.primary_alcohol}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-stone-400">City size</span>
                    <span className="text-amber-300 capitalize">{TIER_LABEL[city.population_tier] ?? city.population_tier}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-stone-400">{costLabel}</span>
                    <span className="text-amber-200 font-bold">${displayCost.toLocaleString()}</span>
                  </div>
                  {owner && (
                    <div className="flex items-center justify-between gap-4 pt-1 border-t border-stone-700">
                      <span className="text-stone-400">Owner</span>
                      <span className="text-stone-300">{owner.name}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setInfoCityId(null)}
                  className="absolute top-1.5 right-2 text-stone-600 hover:text-stone-400 text-xs leading-none"
                >✕</button>
              </div>
            )
          })()}

          {/* City name overlay — bottom-left of map pane */}
          {mapMode !== 'info' && viewCityId != null && (() => {
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
            ref={transformRef}
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
                  simplified={mapMode === 'simple'}
                />
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>

        {/* Right sidebar */}
        <div className={`${rightOpen ? 'w-52' : 'w-8'} bg-stone-900 border-l border-stone-700 flex-shrink-0 transition-all duration-200 overflow-hidden relative flex flex-col`}>
          {/* Collapse toggle */}
          <button
            onClick={() => recenterAfterResize(() => setRightOpen(o => !o))}
            className="absolute top-1/2 -translate-y-1/2 -left-3 z-20 w-6 h-12 flex items-center justify-center bg-stone-700 hover:bg-amber-700 border border-stone-600 hover:border-amber-500 rounded-l text-stone-300 hover:text-white text-sm font-bold transition shadow-md"
          >{rightOpen ? '›' : '‹'}</button>
        {rightOpen && <div className="p-3 pt-7 space-y-2 overflow-y-auto flex-1">
          {/* Fleet panel */}
          {moveMode && !turnPending && (
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
              <button
                onClick={async () => {
                  const res = await fetch(`/api/games/${gameId}/auto-rotate-plan`)
                  const plan = await res.json() as { roll: number; vehicles: Array<{ vehicleId: number; targetPath: number[]; allocatedPoints: number }> }
                  if (!plan.vehicles?.length) return
                  const effective = applyCharModifier(plan.roll, player?.characterClass ?? '')
                  setDiceRoll(plan.roll)
                  setRemainingBudget(effective)
                  setVehicleMoves(prev => prev.map(vm => {
                    const planned = plan.vehicles.find(p => p.vehicleId === vm.vehicleId)
                    return planned ? { ...vm, targetPath: planned.targetPath, allocatedPoints: planned.allocatedPoints } : vm
                  }))
                }}
                title="Pre-fill routes to rotate all cars across your cities — adjust before confirming"
                className="w-full py-1.5 border border-amber-700 hover:bg-amber-900/40 text-amber-400 font-bold rounded uppercase tracking-wide text-xs transition"
              >
                🔄 Auto-Rotate
              </button>
            </div>
          )}
          <p data-tutorial="city_actions" className="text-xs text-stone-400 uppercase tracking-wider">Turn Actions</p>


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
                    onClick={() => submitTurn([{ type: 'move', roll: diceRoll, vehicles: vehicleMoves.filter(vm => vm.targetPath.length > 0) }], { transition: true })}
                    className="w-full py-2 bg-green-700 hover:bg-green-600 text-white font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    Complete Turn
                  </button>
                  <button
                    onClick={() => submitTurn([{ type: 'stay' }], { transition: true })}
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
                  {/* Pending route summary — shown when player selected destinations then exited move mode */}
                  {diceRoll != null && vehicleMoves.some(vm => vm.targetPath.length > 0) && (() => {
                    const movers = vehicleMoves.filter(vm => vm.targetPath.length > 0)
                    return (
                      <div className="bg-green-950 border border-green-700 rounded p-2 space-y-1">
                        <p className="text-green-400 text-xs font-bold uppercase tracking-wide">Route Planned</p>
                        {movers.map(vm => {
                          const v = player?.vehicles?.find(vv => vv.id === vm.vehicleId)
                          const destName = mapCities.find(c => c.id === vm.targetPath[vm.targetPath.length - 1])?.name ?? '?'
                          return (
                            <p key={vm.vehicleId} className="text-xs text-green-300">
                              {v?.vehicleType.replace(/_/g, ' ') ?? 'Vehicle'} → {destName}
                            </p>
                          )
                        })}
                        <div className="flex gap-1 pt-1">
                          <button
                            onClick={() => submitTurn([{ type: 'move', roll: diceRoll, vehicles: vehicleMoves.filter(vm => vm.targetPath.length > 0) }], { transition: true })}
                            className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 text-white font-bold rounded text-xs uppercase tracking-wide transition"
                          >
                            Confirm Move
                          </button>
                          <button
                            onClick={rollToMove}
                            className="flex-1 py-1.5 border border-green-700 hover:bg-green-900 text-green-300 font-bold rounded text-xs uppercase tracking-wide transition"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Fleet location summary */}
                  {(player?.vehicles ?? []).length > 0 && !(diceRoll != null && vehicleMoves.some(vm => vm.targetPath.length > 0)) && (
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
                    data-tutorial="market"
                    onClick={() => setMarketOpen(true)}
                    disabled={viewCityId == null || !(player?.vehicles ?? []).some(v => v.cityId === viewCityId)}
                    className="w-full py-2 border border-amber-600 hover:bg-amber-900 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    🏪 Market
                  </button>
                  {(() => {
                    const distilleryCitySet = new Set(player?.distilleryCityIds ?? [])
                    const hasVehicleAtOwnStill = (player?.vehicles ?? []).some(v => distilleryCitySet.has(v.cityId))
                    const hasVehicleAtViewCity = viewCityId != null && (player?.vehicles ?? []).some(v => v.cityId === viewCityId)
                    const isOwnStill = viewCityId != null && distilleryCitySet.has(viewCityId)
                    const competitorStill = viewCityId != null
                      ? (player?.competitorStillsByCity ?? []).find(s => s.cityId === viewCityId) ?? null
                      : null
                    const canSabotage = hasVehicleAtViewCity && !isOwnStill && competitorStill != null
                    const sabotageCost = competitorStill ? (STILL_UPGRADE_COST[competitorStill.tier] ?? 0) : 0
                    const sabotageHeat = competitorStill ? competitorStill.tier * 10 : 0
                    const canAffordSabotage = (player?.cash ?? 0) >= sabotageCost
                    const sabotageLabel = competitorStill?.tier === 1 ? '💣 Destroy Still' : '💣 Sabotage Still'

                    if (canSabotage) {
                      return (
                        <button
                          onClick={submitSabotage}
                          disabled={!canAffordSabotage}
                          title={competitorStill?.tier === 1
                            ? `Destroy this Tier 1 still · Cost: $${sabotageCost.toLocaleString()} · Heat: +${sabotageHeat}`
                            : `Cost: $${sabotageCost.toLocaleString()} · Heat: +${sabotageHeat}`}
                          className="w-full py-2 border border-red-800 hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 font-bold rounded uppercase tracking-wide text-sm transition"
                        >
                          {sabotageLabel} — ${sabotageCost.toLocaleString()}
                        </button>
                      )
                    }
                    return (
                      <button
                        data-tutorial="upgrade_still"
                        onClick={() => setStillOpen(true)}
                        disabled={!hasVehicleAtOwnStill}
                        title={!hasVehicleAtOwnStill ? 'Move a car to one of your distillery cities to upgrade' : undefined}
                        className="w-full py-2 border border-stone-600 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                      >
                        ⚗️ Upgrade Still
                      </button>
                    )
                  })()}
                  {/* Steal inventory — rival city only */}
                  {(() => {
                    const distilleryCitySet2 = new Set(player?.distilleryCityIds ?? [])
                    const isOwnStill2 = viewCityId != null && distilleryCitySet2.has(viewCityId)
                    if (isOwnStill2 || viewCityId == null) return null

                    const viewCity = mapCities.find(c => c.id === viewCityId)
                    const isRivalCity = viewCity?.owner_player_id != null && viewCity.owner_player_id !== player?.id
                    const rivalStealItems = cityInventory.filter(r => r.city_id === viewCityId && r.quantity > 0)
                    if (!isRivalCity || rivalStealItems.length === 0) return null

                    const hasVehicleAtViewCity2 = (player?.vehicles ?? []).some(v => v.cityId === viewCityId)
                    if (!hasVehicleAtViewCity2) {
                      // Show hint — player needs to move a vehicle here first
                      return (
                        <button disabled className="w-full py-2 border border-stone-700 opacity-40 cursor-not-allowed text-stone-500 font-bold rounded uppercase tracking-wide text-sm">
                          🥃 Steal Inventory — Move here first
                        </button>
                      )
                    }

                    const competitorStill2 = (player?.competitorStillsByCity ?? []).find(s => s.cityId === viewCityId) ?? null
                    // If the owner's vehicle presence can't be confirmed from fresh state, treat as blocked (safe default)
                    if (!competitorStill2) return (
                      <button disabled className="w-full py-2 border border-stone-700 opacity-40 cursor-not-allowed text-stone-500 font-bold rounded uppercase tracking-wide text-sm">
                        🥃 Steal Inventory — Protected
                      </button>
                    )
                    const vehicleAtCity = (player?.vehicles ?? []).find(v => v.cityId === viewCityId)
                    if (!vehicleAtCity) return null
                    const isBlocked = competitorStill2.ownerVehiclePresent
                    const isBribed = competitorStill2.cityIsBribed
                    return (
                      <div className="space-y-1.5">
                        {isBlocked ? (
                          <button disabled className="w-full py-2 border border-stone-700 opacity-40 cursor-not-allowed text-stone-500 font-bold rounded uppercase tracking-wide text-sm">
                            🥃 Steal Inventory — Owner's vehicle here
                          </button>
                        ) : (
                          <>
                            {isBribed && (
                              <p className="text-xs text-orange-400 text-center">⚠ Bribed city — steal triggers police encounter</p>
                            )}
                            {rivalStealItems.map(item => (
                              <button
                                key={item.alcohol_type}
                                onClick={() => submitTurn([{
                                  type: 'steal_inventory',
                                  vehicleId: vehicleAtCity.id,
                                  cityId: viewCityId,
                                  alcoholType: item.alcohol_type,
                                  quantity: item.quantity,
                                }])}
                                className="w-full py-2 border border-teal-800 hover:bg-teal-900/40 text-teal-400 font-bold rounded uppercase tracking-wide text-sm transition"
                              >
                                🥃 Steal {item.quantity} {item.alcohol_type}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )
                  })()}
                  <button
                    data-tutorial="bribe"
                    onClick={() => setBribeOpen(true)}
                    disabled={viewCityId == null || !(player?.vehicles ?? []).some(v => v.cityId === viewCityId)}
                    title={viewCityId == null || !(player?.vehicles ?? []).some(v => v.cityId === viewCityId) ? 'Move a car to this city to bribe its official' : undefined}
                    className="w-full py-2 border border-stone-600 hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                  >
                    💰 Bribe Official
                  </button>
                  {(() => {
                    const myTrapCityIds = new Set((player?.myTraps ?? []).map(t => t.cityId))
                    const hasAvailableCity = (player?.vehicles ?? []).some(v => !myTrapCityIds.has(v.cityId))
                    return (
                      <button
                        data-tutorial="trap"
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
                  <p className="text-xs text-stone-500 uppercase tracking-wider">End Turn</p>
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
                    onClick={() => {
                      resetMovement()
                      submitTurn([{ type: 'skip' }], { transition: true })
                    }}
                    className={`w-full py-2 text-xs uppercase tracking-wide transition ${
                      diceRoll != null && vehicleMoves.some(vm => vm.targetPath.length > 0)
                        ? 'text-red-500 hover:text-red-300'
                        : 'text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    {diceRoll != null && vehicleMoves.some(vm => vm.targetPath.length > 0)
                      ? 'End Turn Without Moving'
                      : 'Stay Put'}
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
              <p className="text-xs text-stone-600 italic">Your turns advance automatically while jailed.</p>
            </div>
          ) : (
            <p className="text-stone-500 text-sm italic">Waiting for {currentPlayerName}</p>
          )}

          {/* City info */}
          <hr className="border-stone-700" />
          {viewCityId != null ? (() => {
            const city  = mapCities.find(c => c.id === viewCityId)
            const ownerPlayer = city?.owner_player_id != null
              ? (fullState?.players ?? []).find(p => p.id === city.owner_player_id) ?? null
              : null
            const ownerColor = ownerPlayer
              ? PLAYER_COLORS[(fullState?.players ?? []).findIndex(p => p.id === ownerPlayer.id) % PLAYER_COLORS.length]
              : null
            const isMyCity   = city?.owner_player_id === player?.id
            const isAtCity   = (player?.vehicles ?? []).some(v => v.cityId === viewCityId)
            const claimCost  = city
              ? (city.owner_player_id == null
                  ? Math.floor((BASE_CLAIM_COST[city.population_tier] ?? 500) * (player?.claimCostMultiplier ?? 1))
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
                <p className="text-xs text-stone-500 capitalize">{city?.population_tier}</p>
                <p className="text-xs text-stone-500">
                  Produces: <span className="text-green-400 font-semibold capitalize">{city?.primary_alcohol}</span>
                </p>
                <p className="text-xs text-stone-500">
                  {city?.owner_player_id == null ? 'Claim' : 'Takeover'}: <span className="text-amber-400 font-semibold">${claimCost.toLocaleString()}</span>
                </p>
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
                    onClick={() => submitTurn([{ type: 'claim_city', cityId: viewCityId ?? undefined }])}
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

          {/* Player list */}
          {fullState && (
            <div className="pt-2 border-t border-stone-700 space-y-1">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Players</p>
              {fullState.players.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PLAYER_COLORS[i % PLAYER_COLORS.length] }} />
                  <button
                    onClick={() => {
                      const charInfo = CHARACTER_DISPLAY[p.characterClass]
                      if (charInfo) setCharacterPopup(charInfo)
                    }}
                    className={`text-left hover:underline transition ${p.id === player?.id ? 'text-amber-400' : 'text-stone-400 hover:text-stone-200'}`}
                  >
                    {p.name}{p.isNpc ? ' (NPC)' : ''}
                    {p.turnOrder === game?.currentPlayerIndex ? ' ●' : ''}
                    {p.turnOrder === game?.currentPlayerIndex && !p.isNpc && (
                      <TurnTimer startedAt={p.turnStartedAt} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>}
        </div>
      </div>

      {/* Character info popup */}
      {characterPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setCharacterPopup(null)}
        >
          <div
            className="bg-stone-900 border border-amber-700 rounded-lg p-5 max-w-xs w-full mx-4 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-amber-400 font-bold text-sm">{characterPopup.name}</p>
            <div className="space-y-1 text-xs">
              <p className="text-green-400">✦ {characterPopup.perk}</p>
              <p className="text-red-400">✦ {characterPopup.drawback}</p>
            </div>
            <button
              onClick={() => setCharacterPopup(null)}
              className="w-full py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 text-xs rounded transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Welcome dialog — first step of FTUX */}
      {welcomeOpen && (
        <WelcomeDialog
          onBeginTour={() => { setWelcomeOpen(false); setTutorialOpen(true) }}
          onSkip={async () => {
            setWelcomeOpen(false)
            if (!serverIsMyTurn) setShowNewsPrompt(true)
            await fetch(`/api/games/${gameId}/tutorial-done`, { method: 'POST' })
            fetchAll()
          }}
        />
      )}

      {/* Tutorial spotlight steps — begins after welcome dialog */}
      {tutorialOpen && gameId && (
        <TutorialOverlay
          gameId={gameId}
          onAction={action => {
            if (action === 'open_market') setMarketOpen(true)
            if (action === 'close_market') setMarketOpen(false)
          }}
          onDone={() => {
            setTutorialOpen(false)
            setMarketOpen(false)
            if (!serverIsMyTurn) setShowNewsPrompt(true)
            fetchAll()
          }}
        />
      )}

      {/* First-turn newspaper prompt — shown after FTUX when waiting for first turn */}
      {showNewsPrompt && (
        <div className="fixed inset-0 z-[99970] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative w-full max-w-sm bg-stone-900 border border-amber-700/60 rounded-2xl shadow-2xl overflow-hidden p-6 text-center"
            style={{ boxShadow: '0 0 60px rgba(180,120,20,0.2), 0 20px 50px rgba(0,0,0,0.6)' }}>
            <p className="text-amber-500/80 text-xs uppercase tracking-[0.25em] font-bold mb-2">Waiting for your first turn</p>
            <h2 className="text-amber-300 font-black text-lg mb-3">Read The Prohibition Times?</h2>
            <p className="text-stone-400 text-sm mb-6 leading-relaxed">
              Catch up on era news, local dispatches, and period ads while the other players take their turn.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setShowNewsPrompt(false); setNewsDeclined(true) }}
                className="px-4 py-2 text-sm text-stone-500 hover:text-stone-300 border border-stone-700 hover:border-stone-500 rounded-lg transition"
              >
                Skip for now
              </button>
              <button
                onClick={() => setShowNewsPrompt(false)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-black text-sm rounded-lg uppercase tracking-wider transition"
                style={{ boxShadow: '0 0 16px rgba(217,119,6,0.35)' }}
              >
                Read the Paper →
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Prohibition Times overlay */}
      {showPaper && (
        <ProhibitionTimes
          gameId={gameId!}
          currentSeason={game?.currentSeason ?? 1}
          isOverlay
          onClose={() => setShowPaper(false)}
          onMaximize={!serverIsMyTurn ? () => { setNewsDeclined(false); setShowPaper(false) } : undefined}
        />
      )}
      {/* Mission Panel overlay */}
      {missionsOpen && (
        <MissionPanel
          missions={player?.missions ?? []}
          completedMissions={player?.completedMissions ?? 0}
          onClose={() => setMissionsOpen(false)}
          onDrawCard={() => {
            missionIdsBeforeDrawRef.current = new Set((player?.missions ?? []).map(m => m.id))
            setMissionsOpen(false)
            submitTurn([{ type: 'draw_mission' }])
          }}
          onAbandon={async (missionId) => {
            await fetch(`/api/games/${gameId}/missions/abandon`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ missionId }),
            })
            await fetchAll()
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
            maxVehicleStationary: Math.max(0, ...(player?.vehicles ?? []).map(v => v.stationarySince != null ? (game?.currentSeason ?? 1) - v.stationarySince + 1 : 0)),
          }}
        />
      )}

      {showBeerTransition && (
        <div
          className="fixed inset-0 z-[100] overflow-hidden pointer-events-none flex items-center justify-center"
          style={{ opacity: beerExiting ? 0 : 1, transition: 'opacity 350ms ease-in' }}
        >
          {/* Beer fill rising from bottom */}
          <div
            className="absolute inset-0 bg-amber-600"
            style={{ animation: 'beerFill 500ms cubic-bezier(0.22,1,0.36,1) forwards', opacity: 0.93 }}
          />
          {/* Foam layer at top */}
          <div
            className="absolute left-0 right-0 top-0 h-10 bg-amber-50 origin-left"
            style={{ borderRadius: '0 0 50% 50% / 0 0 100% 100%', animation: 'foamSettle 400ms 350ms ease-out both', opacity: 0.88 }}
          />
          {/* Bubbles */}
          {Array.from({ length: 30 }, (_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-amber-200"
              style={{
                width:  `${4 + (i % 5) * 3}px`,
                height: `${4 + (i % 5) * 3}px`,
                left:   `${(i * 3.3) % 94}%`,
                bottom: `${3 + (i % 7) * 6}%`,
                opacity: 0.4 + (i % 3) * 0.15,
                '--bubble-drift': `${(i % 2 === 0 ? 1 : -1) * (4 + (i % 7) * 3)}px`,
                animation: `bubbleRise ${0.9 + (i % 7) * 0.3}s ${i * 0.07}s ease-in infinite`,
              } as React.CSSProperties}
            />
          ))}
          {/* Message */}
          <p
            className="relative text-amber-100 text-xl font-semibold tracking-wide"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}
          >
            {beerMessageRef.current}
          </p>
        </div>
      )}
    </div>
  )
}
