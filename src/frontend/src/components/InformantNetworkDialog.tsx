import React, { useState } from 'react'

interface Informant {
  id: number
  cityId: number | null
  cityName: string | null
}

interface Sighting {
  playerName: string
  cityId: number
  cityName: string
  season: number
}

interface OtherPlayer {
  id: number
  name: string
  role: string
  isNpc: boolean
}

interface MapCity {
  id: number
  name: string
}

interface VehicleAtCity {
  cityId: number
}

interface InformantNetworkDialogProps {
  informants: Informant[]
  pendingSightings: Sighting[]
  mapCities: MapCity[]
  otherPlayers: OtherPlayer[]
  vehicleCityIds: Set<number>
  currentSeason: number
  playerCash: number
  isMyTurn: boolean
  onClose: () => void
  onPlaceInformant: (informantId: number, cityId: number) => void
  onRecallInformant: (informantId: number) => void
  onFileAccusation: (targetPlayerId: number, claimedCityIds: number[]) => void
}

export default function InformantNetworkDialog({
  informants,
  pendingSightings,
  mapCities,
  otherPlayers,
  vehicleCityIds,
  currentSeason,
  playerCash,
  isMyTurn,
  onClose,
  onPlaceInformant,
  onRecallInformant,
  onFileAccusation,
}: InformantNetworkDialogProps) {
  const [accuseTarget, setAccuseTarget] = useState<number | null>(null)
  const [accuseCities, setAccuseCities] = useState<number[]>([])
  const [confirmAccuse, setConfirmAccuse] = useState(false)

  // Group sightings by player (most recent per player)
  const latestSightingByPlayer = new Map<string, Sighting>()
  for (const s of pendingSightings) {
    const existing = latestSightingByPlayer.get(s.playerName)
    if (!existing || s.season > existing.season) {
      latestSightingByPlayer.set(s.playerName, s)
    }
  }

  const bootleggerTargets = otherPlayers.filter(p => p.role === 'bootlegger')

  function toggleAccuseCity(cityId: number) {
    setAccuseCities(prev =>
      prev.includes(cityId) ? prev.filter(c => c !== cityId) : [...prev, cityId]
    )
  }

  function handleAccuse() {
    if (!accuseTarget || accuseCities.length === 0) return
    onFileAccusation(accuseTarget, accuseCities)
    setAccuseTarget(null)
    setAccuseCities([])
    setConfirmAccuse(false)
  }

  const unplacedInformants = informants.filter(i => i.cityId === null)
  const placedInformants   = informants.filter(i => i.cityId !== null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-stone-900 border border-indigo-900 rounded-lg shadow-2xl w-[26rem] max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-indigo-900/60 bg-indigo-950/30 rounded-t-lg flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-400 uppercase tracking-wider">Federal Informant</p>
            <p className="text-indigo-200 font-bold text-lg">🕵️ Informant Network</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-lg leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">

          {/* ── Informants ── */}
          <section>
            <p className="text-xs text-indigo-400 uppercase tracking-wider mb-2">Your Informants</p>
            <div className="space-y-1.5">
              {informants.map((inf, idx) => {
                const isPlaced = inf.cityId !== null
                const vehicleHere = isPlaced ? false : false // place requires vehicle in city
                return (
                  <div key={inf.id} className={`flex items-center justify-between rounded px-3 py-2 text-xs border ${isPlaced ? 'border-indigo-700 bg-indigo-950/30' : 'border-stone-700 bg-stone-800/50'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-400">👤</span>
                      <span className="text-stone-300">
                        {isPlaced
                          ? <><span className="text-indigo-300 font-semibold">Deployed</span> — {inf.cityName}</>
                          : <span className="text-stone-500 italic">Unplaced</span>}
                      </span>
                    </div>
                    {isMyTurn && (
                      isPlaced ? (
                        <button
                          onClick={() => onRecallInformant(inf.id)}
                          className="text-xs text-stone-400 hover:text-red-400 border border-stone-700 hover:border-red-800 rounded px-2 py-0.5 transition"
                        >
                          Recall
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          {[...vehicleCityIds].map(cityId => {
                            const city = mapCities.find(c => c.id === cityId)
                            if (!city) return null
                            const alreadyWatched = informants.some(i => i.cityId === cityId)
                            if (alreadyWatched) return null
                            return (
                              <button
                                key={cityId}
                                onClick={() => onPlaceInformant(inf.id, cityId)}
                                className="text-xs text-indigo-400 hover:text-indigo-200 border border-indigo-800 hover:border-indigo-600 rounded px-2 py-0.5 transition"
                                title={`Place in ${city.name}`}
                              >
                                → {city.name}
                              </button>
                            )
                          })}
                          {[...vehicleCityIds].every(cid => informants.some(i => i.cityId === cid)) && (
                            <span className="text-stone-600 text-xs italic">Move a car to a new city to place</span>
                          )}
                          {vehicleCityIds.size === 0 && (
                            <span className="text-stone-600 text-xs italic">No vehicles deployed</span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )
              })}
              {informants.length === 0 && (
                <p className="text-stone-500 text-xs italic">No informants assigned.</p>
              )}
            </div>
            <p className="text-xs text-stone-600 mt-1.5">Each sighting earns $100 at season rollover. Move a vehicle to a city to deploy there.</p>
          </section>

          {/* ── Pending Sightings ── */}
          <section>
            <p className="text-xs text-indigo-400 uppercase tracking-wider mb-2">
              Intelligence Sightings
              {pendingSightings.length > 0 && (
                <span className="ml-1.5 bg-indigo-800 text-indigo-200 text-xs rounded-full px-1.5 py-0.5 font-bold">{pendingSightings.length}</span>
              )}
            </p>
            {pendingSightings.length === 0 ? (
              <p className="text-stone-500 text-xs italic">No sightings yet. Deploy informants in cities to intercept movement.</p>
            ) : (
              <div className="space-y-1">
                {pendingSightings.slice().reverse().map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs px-2 py-1.5 bg-stone-800/50 rounded border border-stone-700">
                    <div>
                      <span className="text-amber-300 font-semibold">{s.playerName}</span>
                      <span className="text-stone-400"> seen in </span>
                      <span className="text-stone-200">{s.cityName}</span>
                    </div>
                    <span className="text-stone-600">Season {s.season}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-stone-600 mt-1.5">Paid out at $100/sighting each season rollover.</p>
          </section>

          {/* ── File Accusation ── */}
          {isMyTurn && bootleggerTargets.length > 0 && (
            <section>
              <p className="text-xs text-indigo-400 uppercase tracking-wider mb-2">File Accusation</p>

              {!confirmAccuse ? (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-stone-400 block mb-1">Target player</label>
                    <select
                      value={accuseTarget ?? ''}
                      onChange={e => {
                        setAccuseTarget(e.target.value ? Number(e.target.value) : null)
                        setAccuseCities([])
                      }}
                      className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">— Select a target —</option>
                      {bootleggerTargets.map(p => {
                        const lastSeen = pendingSightings.findLast(s => s.playerName === p.name)
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.isNpc ? ' (NPC)' : ''}{lastSeen ? ` — last seen ${lastSeen.cityName}` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {accuseTarget != null && (
                    <div>
                      <label className="text-xs text-stone-400 block mb-1">
                        Claim vehicle locations — select cities
                      </label>
                      <p className="text-xs text-stone-600 mb-1.5">
                        Must match ALL of the target's current vehicle positions exactly to succeed.
                        Wrong = your next stipend is burned.
                      </p>
                      <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto">
                        {mapCities.map(city => {
                          const isSelected = accuseCities.includes(city.id)
                          const hasSighting = pendingSightings.some(s => {
                            const target = bootleggerTargets.find(p => p.id === accuseTarget)
                            return target && s.playerName === target.name && s.cityId === city.id
                          })
                          return (
                            <button
                              key={city.id}
                              onClick={() => toggleAccuseCity(city.id)}
                              className={`text-left px-2 py-1 rounded text-xs border transition ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-900/40 text-indigo-200'
                                  : hasSighting
                                  ? 'border-amber-800/60 bg-amber-950/20 text-amber-400 hover:bg-amber-900/30'
                                  : 'border-stone-700 bg-stone-800/30 text-stone-400 hover:bg-stone-700/50'
                              }`}
                            >
                              {hasSighting && <span className="mr-1">👁</span>}
                              {city.name}
                            </button>
                          )
                        })}
                      </div>
                      {accuseCities.length > 0 && (
                        <p className="text-xs text-indigo-400 mt-1.5">
                          Selected {accuseCities.length} {accuseCities.length === 1 ? 'city' : 'cities'}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    disabled={!accuseTarget || accuseCities.length === 0}
                    onClick={() => setConfirmAccuse(true)}
                    className="w-full py-2 bg-indigo-800 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-indigo-100 text-xs font-bold rounded uppercase tracking-wide transition"
                  >
                    🗂 File Accusation
                  </button>
                </div>
              ) : (
                <div className="rounded border border-indigo-800/60 bg-indigo-950/30 px-3 py-2.5 space-y-2">
                  <p className="text-xs text-indigo-300 font-bold">Confirm Accusation?</p>
                  <p className="text-xs text-stone-400">
                    Target: <span className="text-amber-300">{bootleggerTargets.find(p => p.id === accuseTarget)?.name}</span><br />
                    Claimed cities: {accuseCities.map(cid => mapCities.find(c => c.id === cid)?.name ?? cid).join(', ')}
                  </p>
                  <p className="text-xs text-stone-500">
                    Failure burns your next stipend payout.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAccuse}
                      className="flex-1 py-1.5 bg-indigo-800 hover:bg-indigo-700 text-indigo-200 text-xs font-bold rounded transition"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmAccuse(false)}
                      className="flex-1 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
