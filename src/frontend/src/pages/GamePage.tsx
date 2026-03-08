import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PhaserMap       from '../components/PhaserMap'
import HeatMeter       from '../components/HeatMeter'
import CharacterCard   from '../components/CharacterCard'
import InventoryPanel  from '../components/InventoryPanel'
import MarketPanel     from '../components/MarketPanel'
import SeasonTimeline  from '../components/SeasonTimeline'
import JailOverlay     from '../components/JailOverlay'

interface GameState {
  status: string
  currentSeason: number
  seasonLabel: string
  currentTurnPlayerIndex: number
  myTurnOrder: number
  myHeat: number
  myCash: number
  myJailSeasons: number
  myCharacter: { class: string; name: string; perk: string; drawback: string }
  inventory: Array<{ alcoholType: string; units: number }>
  cargoCapacity: number
  cities: Array<{ id: number; name: string; x: number; y: number; ownerColor?: number }>
  roads: Array<{ fromCityId: number; toCityId: number }>
  playerTokens: Array<{ playerId: number; cityId: number; color: number }>
  turnOrder: string[]
  currentPlayerName: string
  marketPrices: Array<{ alcoholType: string; price: number; cityId: number }>
  myCurrentCityId: number
}

export default function GamePage() {
  const { id: gameId } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [state, setState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const fetchState = useCallback(async () => {
    if (!gameId) return
    try {
      const [mapRes, marketRes] = await Promise.all([
        fetch(`/api/games/${gameId}/map`),
        fetch(`/api/games/${gameId}/market`)
      ])
      const mapData    = await mapRes.json()
      const marketData = await marketRes.json()

      if (mapData.success) {
        // Merge map + market data into local state
        // Real positions would come from a game state endpoint; we scatter for demo
        const citiesWithPos = (mapData.data.cities ?? []).map((c: any, i: number) => ({
          id:         c.id,
          name:       c.name,
          x:          100 + (i % 8) * 90,
          y:          80  + Math.floor(i / 8) * 100,
          ownerColor: c.owner_player_id ? 0xe07b39 : undefined
        }))

        setState(prev => ({
          ...(prev ?? {} as GameState),
          cities:       citiesWithPos,
          roads:        (mapData.data.roads ?? []).map((r: any) => ({
            fromCityId: r.from_city_id,
            toCityId:   r.to_city_id
          })),
          marketPrices: marketData.data?.prices ?? []
        }))
      }
    } catch (e) {
      console.error('Failed to fetch game state', e)
    } finally {
      setLoading(false)
    }
  }, [gameId])

  useEffect(() => {
    fetchState()
    // Poll every 30 seconds for turn resolution updates
    const interval = setInterval(fetchState, 30_000)
    return () => clearInterval(interval)
  }, [fetchState])

  async function submitSkipTurn() {
    await fetch(`/api/games/${gameId}/turn`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify([{ type: 'skip' }])
    })
    fetchState()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-stone-400 animate-pulse">Loading your empire…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!state) return null

  const isMyTurn    = state.myTurnOrder === state.currentTurnPlayerIndex
  const isInJail    = state.myJailSeasons > 0
  const hasLawyerPerk = false  // checked against character class

  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      {/* Top bar — season and turn */}
      <div className="px-4 py-2 bg-stone-800 border-b border-stone-700">
        <SeasonTimeline
          seasonLabel={state.seasonLabel ?? 'Spring 1921'}
          currentPlayerName={state.currentPlayerName ?? '—'}
          isMyTurn={isMyTurn}
          turnOrder={state.turnOrder ?? []}
          currentTurnIndex={state.currentTurnPlayerIndex ?? 0}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 bg-stone-850 border-r border-stone-700 p-3 space-y-3 overflow-y-auto flex-shrink-0">
          <HeatMeter heat={state.myHeat ?? 0} />

          {state.myCharacter && (
            <CharacterCard
              characterClass={state.myCharacter.class}
              name={state.myCharacter.name}
              perk={state.myCharacter.perk}
              drawback={state.myCharacter.drawback}
            />
          )}

          <InventoryPanel
            items={state.inventory ?? []}
            cargoCapacity={state.cargoCapacity ?? 8}
            cargoUsed={(state.inventory ?? []).reduce((s, i) => s + i.units, 0)}
          />

          <MarketPanel
            prices={state.marketPrices ?? []}
            currentCityId={state.myCurrentCityId ?? 0}
          />

          <div className="bg-stone-800 border border-stone-600 rounded p-3">
            <p className="text-xs text-stone-400 uppercase tracking-wider">Cash</p>
            <p className="text-2xl font-bold text-green-400">${(state.myCash ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Main map area */}
        <div className="relative flex-1 overflow-hidden">
          {isInJail && (
            <JailOverlay
              seasonsRemaining={state.myJailSeasons}
              hasLawyerPerk={hasLawyerPerk}
              onPayLawyer={() => {/* TODO: lawyer perk action */}}
            />
          )}

          <div className="p-4 h-full">
            <PhaserMap
              cities={state.cities ?? []}
              roads={state.roads ?? []}
              playerTokens={state.playerTokens ?? []}
            />
          </div>
        </div>

        {/* Right sidebar — turn actions */}
        <div className="w-56 bg-stone-850 border-l border-stone-700 p-3 space-y-3 overflow-y-auto flex-shrink-0">
          <p className="text-xs text-stone-400 uppercase tracking-wider">Turn Actions</p>

          {isMyTurn && !isInJail ? (
            <>
              <button
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide text-sm transition"
                onClick={() => {/* TODO: open movement modal */}}
              >
                Move
              </button>
              <button
                className="w-full py-2 border border-amber-600 hover:bg-amber-900 text-amber-400 font-bold rounded uppercase tracking-wide text-sm transition"
                onClick={() => {/* TODO: open buy/sell modal */}}
              >
                Buy / Sell
              </button>
              <button
                className="w-full py-2 border border-stone-600 hover:bg-stone-700 text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                onClick={() => {/* TODO: open upgrade modal */}}
              >
                Upgrade Still
              </button>
              <button
                className="w-full py-2 border border-stone-600 hover:bg-stone-700 text-stone-300 font-bold rounded uppercase tracking-wide text-sm transition"
                onClick={() => {/* TODO: open bribe modal */}}
              >
                Bribe Official
              </button>
              <hr className="border-stone-700" />
              <button
                className="w-full py-2 text-stone-500 hover:text-stone-300 text-xs uppercase tracking-wide transition"
                onClick={submitSkipTurn}
              >
                End Turn (Skip)
              </button>
            </>
          ) : (
            <p className="text-stone-500 text-sm italic">
              {isInJail ? 'Serving time…' : 'Waiting for your turn'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
