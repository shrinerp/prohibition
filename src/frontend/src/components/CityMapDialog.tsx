import React, { useRef, useState } from 'react'

interface VehicleAtCity {
  id: number
  inventory: Array<{ alcohol_type: string; quantity: number }>
}

export interface CityMapDialogProps {
  gameId: string
  cityName: string
  citySlug: string
  populationTier: string
  isMyTurn: boolean
  playerCash: number
  vehicleAtCity: VehicleAtCity | null
  onClose: () => void
  onAction: () => void
}

type StashType = 'money' | 'alcohol' | 'booby_trap' | 'note'
type Mode = 'stash' | 'retrieve'

interface FoundItem {
  type: string
  cash_amount?: number
  alcohol_type?: string
  alcohol_qty?: number
  heat_spike?: number
  jail_seasons?: number
  cash_penalty?: number
  note_text?: string
}

const STASH_COST = 100
const SEARCH_COST = 10
const MAX_JAIL_SEASONS = 3

function boobytrapCost(heatSpike: number, jailSeasons: number, cashPenalty: number): number {
  return STASH_COST
    + 2 * heatSpike
    + 100 * Math.min(jailSeasons, MAX_JAIL_SEASONS)
    + Math.floor(0.10 * cashPenalty)
}

export default function CityMapDialog({
  gameId, cityName, citySlug, isMyTurn, playerCash,
  vehicleAtCity, onClose, onAction,
}: CityMapDialogProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const fallbackRef = useRef<HTMLDivElement>(null)
  const [pendingCoord, setPendingCoord] = useState<{ x: number; y: number } | null>(null)
  const [mode, setMode] = useState<Mode>('stash')
  const [stashType, setStashType] = useState<StashType>('money')
  const [cashAmount, setCashAmount] = useState('')
  const [alcoholType, setAlcoholType] = useState('')
  const [alcoholQty, setAlcoholQty] = useState('')
  const [heatSpike, setHeatSpike] = useState('0')
  const [jailSeasons, setJailSeasons] = useState('0')
  const [cashPenalty, setCashPenalty] = useState('0')
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [foundItems, setFoundItems] = useState<FoundItem[] | null>(null)
  const [imgError, setImgError] = useState(false)
  const [innerOpen, setInnerOpen] = useState(false)

  const availableAlcohol = (vehicleAtCity?.inventory ?? []).filter(i => i.quantity > 0)

  function handleMapClick(e: React.MouseEvent<HTMLImageElement | HTMLDivElement>) {
    const el = imgError ? fallbackRef.current : imgRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPendingCoord({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    })
    setFoundItems(null)
    setError(null)
    setInnerOpen(true)
  }

  function closeInner() {
    setInnerOpen(false)
    setPendingCoord(null)
    setFoundItems(null)
    setError(null)
  }

  async function handleStash() {
    if (!pendingCoord) return
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        stash_type: stashType,
        coord_x: pendingCoord.x,
        coord_y: pendingCoord.y,
      }
      if (stashType === 'money') body.cash_amount = parseFloat(cashAmount)
      if (stashType === 'alcohol') {
        body.alcohol_type = alcoholType
        body.alcohol_qty = parseInt(alcoholQty, 10)
      }
      if (stashType === 'booby_trap') {
        body.heat_spike = parseInt(heatSpike, 10)
        body.jail_seasons = parseInt(jailSeasons, 10)
        body.cash_penalty = parseFloat(cashPenalty)
      }
      if (stashType === 'note') body.note_text = noteText.trim()

      const res = await fetch(`/api/games/${gameId}/stash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) { setError(data.message ?? 'Failed'); return }
      closeInner()
      onAction()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetrieve() {
    if (!pendingCoord) return
    setSubmitting(true)
    setError(null)
    setFoundItems(null)
    try {
      const res = await fetch(`/api/games/${gameId}/retrieve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coord_x: pendingCoord.x, coord_y: pendingCoord.y }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.message ?? 'Failed'); return }
      setFoundItems(data.found as FoundItem[])
      onAction()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const totalCost = stashType === 'money'
    ? STASH_COST + (parseFloat(cashAmount) || 0)
    : stashType === 'booby_trap'
      ? boobytrapCost(parseInt(heatSpike) || 0, parseInt(jailSeasons) || 0, parseFloat(cashPenalty) || 0)
      : STASH_COST

  const canStash = isMyTurn && !submitting && playerCash >= STASH_COST
  const canSearch = isMyTurn && !submitting && playerCash >= SEARCH_COST

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full max-h-[90vh] bg-stone-900 border border-stone-600 rounded-lg flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <h2 className="text-amber-400 font-bold uppercase tracking-wider text-sm flex-1">{cityName} — City Map</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-lg transition px-1">✕</button>
        </div>

        {/* Instruction bar */}
        <div className="px-4 py-1.5 border-b border-stone-800 flex-shrink-0">
          <p className="text-stone-500 text-xs italic text-center">
            {isMyTurn
              ? `First, click the map to select a location${mode === 'retrieve' ? ` — $${SEARCH_COST} per search` : ''}`
              : 'Viewing only — actions available on your turn'}
          </p>
        </div>

        {/* Map — full width */}
        <div className="flex-1 relative overflow-hidden rounded-b-lg min-h-0">
          {imgError ? (
            <div
              ref={fallbackRef}
              className="absolute inset-0 flex items-center justify-center bg-stone-800 text-stone-600 cursor-crosshair"
              onClick={handleMapClick}
            >
              <div className="text-center pointer-events-none">
                <div className="text-4xl mb-2">🗺</div>
                <div className="text-sm italic">Map unavailable — click to place coordinates</div>
              </div>
            </div>
          ) : (
            <img
              ref={imgRef}
              src={`/city-maps/${citySlug}.png`}
              alt={`${cityName} map`}
              className="w-full h-full object-cover cursor-crosshair select-none"
              onError={() => setImgError(true)}
              onClick={handleMapClick}
              draggable={false}
            />
          )}

          {/* Pending dot */}
          {pendingCoord && (
            <div
              className="absolute w-3 h-3 rounded-full bg-amber-400 border-2 border-stone-900 pointer-events-none -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pendingCoord.x * 100}%`, top: `${pendingCoord.y * 100}%` }}
            />
          )}

          {/* Inner dialog */}
          {innerOpen && pendingCoord && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-80 flex flex-col max-h-[80%] overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-700 flex-shrink-0">
                  <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">
                    {mode === 'stash' ? '📦 Place Stash' : '🔍 Search Location'}
                  </span>
                  <button onClick={closeInner} className="text-stone-500 hover:text-stone-200 text-sm px-1">✕</button>
                </div>

                <div className="p-4 space-y-3">
                  {mode === 'stash' && (
                    <>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([
                          ['money', '💵 Money'],
                          ['alcohol', '🍶 Alcohol'],
                          ['booby_trap', '💣 Booby Trap'],
                          ['note', '📜 Note'],
                        ] as [StashType, string][]).map(([t, label]) => (
                          <button
                            key={t}
                            onClick={() => setStashType(t)}
                            className={`py-1.5 px-2 rounded text-xs font-semibold border transition ${
                              stashType === t
                                ? 'bg-amber-800 border-amber-600 text-amber-100'
                                : 'bg-stone-800 border-stone-600 text-stone-400 hover:bg-stone-700'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {stashType === 'money' && (
                        <div className="space-y-1">
                          <label className="text-xs text-stone-400">Amount ($)</label>
                          <input
                            type="number" min="1" value={cashAmount}
                            onChange={e => setCashAmount(e.target.value)}
                            className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                            placeholder="e.g. 500"
                          />
                        </div>
                      )}

                      {stashType === 'alcohol' && (
                        availableAlcohol.length === 0 ? (
                          <p className="text-stone-500 text-xs italic">No vehicle with alcohol at this city</p>
                        ) : (
                          <div className="space-y-1.5">
                            <div>
                              <label className="text-xs text-stone-400">Type</label>
                              <select
                                value={alcoholType}
                                onChange={e => setAlcoholType(e.target.value)}
                                className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500 mt-0.5"
                              >
                                <option value="">Select…</option>
                                {availableAlcohol.map(i => (
                                  <option key={i.alcohol_type} value={i.alcohol_type}>
                                    {i.alcohol_type} ({i.quantity} cases)
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-stone-400">Quantity</label>
                              <input
                                type="number" min="1" value={alcoholQty}
                                onChange={e => setAlcoholQty(e.target.value)}
                                className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500 mt-0.5"
                                placeholder="cases"
                              />
                            </div>
                          </div>
                        )
                      )}

                      {stashType === 'booby_trap' && (
                        <div className="space-y-1.5">
                          <div>
                            <label className="text-xs text-stone-400">Heat spike (0–100)</label>
                            <input type="number" min="0" max="100" value={heatSpike}
                              onChange={e => setHeatSpike(e.target.value)}
                              className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500 mt-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-stone-400">Jail seasons (0–{MAX_JAIL_SEASONS})</label>
                            <input type="number" min="0" max={MAX_JAIL_SEASONS} value={jailSeasons}
                              onChange={e => setJailSeasons(e.target.value)}
                              className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500 mt-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-stone-400">Cash penalty ($)</label>
                            <input type="number" min="0" value={cashPenalty}
                              onChange={e => setCashPenalty(e.target.value)}
                              className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 focus:outline-none focus:border-amber-500 mt-0.5"
                            />
                          </div>
                        </div>
                      )}

                      {stashType === 'note' && (
                        <div className="space-y-1">
                          <label className="text-xs text-stone-400">{noteText.length}/140</label>
                          <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            maxLength={140}
                            rows={4}
                            placeholder="TYPE YOUR MESSAGE STOP"
                            className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500 resize-none font-mono"
                          />
                        </div>
                      )}

                      {error && <p className="text-red-400 text-xs">{error}</p>}

                      <button
                        onClick={handleStash}
                        disabled={!canStash}
                        className="w-full py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 font-bold rounded uppercase tracking-wide text-xs transition"
                      >
                        {submitting ? 'Placing…' : `Place Stash — $${totalCost}`}
                      </button>
                    </>
                  )}

                  {mode === 'retrieve' && (
                    <>
                      <button
                        onClick={handleRetrieve}
                        disabled={!canSearch}
                        className="w-full py-2 bg-stone-700 hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed text-stone-200 font-bold rounded uppercase tracking-wide text-xs transition"
                      >
                        {submitting ? 'Searching…' : `Search — $${SEARCH_COST}`}
                      </button>

                      {error && <p className="text-red-400 text-xs">{error}</p>}

                      {foundItems !== null && (
                        <div className="space-y-2">
                          {foundItems.length === 0 ? (
                            <p className="text-stone-500 text-xs italic">Nothing found nearby. Try a different spot.</p>
                          ) : (
                            foundItems.map((item, i) => (
                              <div key={i} className={`rounded p-2 border text-xs space-y-0.5 ${
                                item.type === 'money'      ? 'border-green-700 bg-green-950/40' :
                                item.type === 'alcohol'    ? 'border-amber-700 bg-amber-950/40' :
                                item.type === 'booby_trap' ? 'border-red-700 bg-red-950/40' :
                                                             'border-amber-700 bg-amber-950/30'
                              }`}>
                                {item.type === 'money' && (
                                  <span className="text-green-400 font-semibold">Found ${item.cash_amount}</span>
                                )}
                                {item.type === 'alcohol' && (
                                  <span className="text-amber-400 font-semibold">Found {item.alcohol_qty} cases of {item.alcohol_type}</span>
                                )}
                                {item.type === 'booby_trap' && (
                                  <div className="text-red-400">
                                    <p className="font-semibold">Trap triggered!</p>
                                    {(item.heat_spike ?? 0) > 0 && <p>+{item.heat_spike} heat</p>}
                                    {(item.jail_seasons ?? 0) > 0 && <p>{item.jail_seasons} seasons jail</p>}
                                    {(item.cash_penalty ?? 0) > 0 && <p>-${item.cash_penalty}</p>}
                                  </div>
                                )}
                                {item.type === 'note' && (
                                  <p className="text-amber-300 italic font-mono leading-relaxed">{item.note_text}</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom mode toggle */}
        <div className="flex gap-2 px-4 py-3 border-t border-stone-700 flex-shrink-0">
          {(['stash', 'retrieve'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setFoundItems(null); setError(null) }}
              className={`flex-1 py-2 rounded uppercase text-xs font-bold tracking-wider border transition ${
                mode === m
                  ? 'bg-amber-700 border-amber-600 text-amber-100'
                  : 'bg-stone-800 border-stone-600 text-stone-400 hover:bg-stone-700'
              }`}
            >
              {m === 'stash' ? '📦 Stash' : '🔍 Retrieve'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
