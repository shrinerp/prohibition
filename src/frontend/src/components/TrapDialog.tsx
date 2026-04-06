import React, { useState } from 'react'

type ConsequenceType = 'jail' | 'financial' | 'alcohol_loss' | 'stuck'

interface VehicleCity {
  cityId: number
  cityName: string
  alreadyTrapped: boolean // player already set a trap here
}

interface TrapDialogProps {
  vehicleCities: VehicleCity[]
  playerCash: number
  gameId: string
  onClose: () => void
  onConfirm: () => void
}

interface ConsequenceOption {
  type: ConsequenceType
  label: string
  emoji: string
  flavor: string
  inputLabel: string
  inputMin: number
  inputMax: number
  inputStep: number
  inputDefault: number
  inputSuffix: string
  computeCost: (val: number) => number
}

const OPTIONS: ConsequenceOption[] = [
  {
    type: 'jail',
    label: 'Jail Time',
    emoji: '🔒',
    flavor: '"The law\'s long arm reaches even here."',
    inputLabel: 'Seasons behind bars',
    inputMin: 1, inputMax: 2, inputStep: 1, inputDefault: 1,
    inputSuffix: 'season(s)',
    computeCost: (v) => 300 * v,
  },
  {
    type: 'financial',
    label: 'Financial Penalty',
    emoji: '💸',
    flavor: '"Money talks — and disappears."',
    inputLabel: 'Cash seized ($)',
    inputMin: 100, inputMax: 5000, inputStep: 100, inputDefault: 500,
    inputSuffix: '',
    computeCost: (v) => Math.max(100, Math.round(v * 0.4)),
  },
  {
    type: 'alcohol_loss',
    label: 'Cargo Seized',
    emoji: '🫙',
    flavor: '"The Feds found the stash."',
    inputLabel: 'Units confiscated',
    inputMin: 1, inputMax: 50, inputStep: 1, inputDefault: 5,
    inputSuffix: 'unit(s)',
    computeCost: (v) => 20 * v,
  },
  {
    type: 'stuck',
    label: 'Stuck in Town',
    emoji: '⛓️',
    flavor: '"Your wheels just stopped working. Funny, that."',
    inputLabel: 'Seasons stranded',
    inputMin: 1, inputMax: 3, inputStep: 1, inputDefault: 1,
    inputSuffix: 'season(s)',
    computeCost: (v) => 200 * v,
  },
]

export default function TrapDialog({ vehicleCities, playerCash, gameId, onClose, onConfirm }: TrapDialogProps) {
  // If only one vehicle city, skip the city picker
  const [selectedCityId, setSelectedCityId] = useState<number | null>(
    vehicleCities.length === 1 ? vehicleCities[0].cityId : null
  )
  const [selected, setSelected] = useState<ConsequenceType | null>(null)
  const [value, setValue] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCity = vehicleCities.find(c => c.cityId === selectedCityId) ?? null
  const option = OPTIONS.find(o => o.type === selected) ?? null
  const cost = option ? option.computeCost(value) : 0
  const canAfford = playerCash >= cost

  function selectOption(opt: ConsequenceOption) {
    setSelected(opt.type)
    setValue(opt.inputDefault)
    setError(null)
  }

  async function handleConfirm() {
    if (!option || !selectedCityId) return
    setSubmitting(true)
    setError(null)
    try {
      const params: Record<string, number> = {}
      if (option.type === 'jail') params.seasons = value
      else if (option.type === 'financial') params.amount = value
      else if (option.type === 'alcohol_loss') params.amount = value
      else if (option.type === 'stuck') params.turns = value

      const res = await fetch(`/api/games/${gameId}/traps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId: selectedCityId, consequenceType: option.type, consequenceParams: params }),
      })
      const data = await res.json() as { success: boolean; message?: string }
      if (data.success) {
        onConfirm()
      } else {
        setError(data.message ?? 'Failed to set trap')
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-stone-900 border border-amber-900 rounded-lg shadow-2xl w-80 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeScaleIn 120ms ease-out' }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-700 flex items-center justify-between">
          <div>
            <p className="text-amber-400 font-bold text-sm uppercase tracking-wide">🪤 Set a Trap</p>
            <p className="text-stone-400 text-xs mt-0.5">
              {selectedCity ? selectedCity.cityName : 'Choose a city'}
            </p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-lg leading-none transition">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-3">
          {/* City picker — shown when player has multiple vehicle cities */}
          {vehicleCities.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-stone-500 text-xs uppercase tracking-wider">Select city</p>
              {vehicleCities.map(vc => (
                <button
                  key={vc.cityId}
                  disabled={vc.alreadyTrapped}
                  onClick={() => { setSelectedCityId(vc.cityId); setError(null) }}
                  className={`w-full text-left rounded border px-3 py-2 text-xs transition ${
                    vc.alreadyTrapped
                      ? 'border-stone-800 bg-stone-800/50 text-stone-600 cursor-not-allowed'
                      : selectedCityId === vc.cityId
                      ? 'border-amber-500 bg-amber-900/30 text-amber-300 font-bold'
                      : 'border-stone-700 bg-stone-800 text-stone-300 hover:border-stone-500'
                  }`}
                >
                  <span>{vc.cityName}</span>
                  {vc.alreadyTrapped && <span className="ml-2 text-stone-600 italic">(trap set)</span>}
                  {selectedCityId === vc.cityId && !vc.alreadyTrapped && <span className="float-right text-amber-400">✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Consequence options — only show once city is selected */}
          {selectedCityId && (
            <>
              <p className="text-stone-500 text-xs uppercase tracking-wider">Choose consequence</p>
              <div className="space-y-2">
                {OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => selectOption(opt)}
                    className={`w-full text-left rounded border p-2.5 transition ${
                      selected === opt.type
                        ? 'border-amber-500 bg-amber-900/30'
                        : 'border-stone-700 bg-stone-800 hover:border-stone-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{opt.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-stone-200">{opt.label}</p>
                        <p className="text-xs text-stone-500 italic leading-tight mt-0.5">{opt.flavor}</p>
                      </div>
                      {selected === opt.type && <span className="text-amber-400 text-sm flex-shrink-0">✓</span>}
                    </div>
                  </button>
                ))}
              </div>

              {/* Severity input */}
              {option && (
                <div className="bg-stone-800 border border-stone-700 rounded p-3 space-y-2">
                  <label className="text-xs text-stone-400 uppercase tracking-wider block">{option.inputLabel}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={option.inputMin}
                      max={option.inputMax}
                      step={option.inputStep}
                      value={value}
                      onChange={e => setValue(Math.min(option.inputMax, Math.max(option.inputMin, Number(e.target.value))))}
                      className="w-24 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-sm text-stone-200 focus:outline-none focus:border-amber-500 tabular-nums"
                    />
                    {option.type === 'financial' && (
                      <input
                        type="range"
                        min={option.inputMin}
                        max={option.inputMax}
                        step={option.inputStep}
                        value={value}
                        onChange={e => setValue(Number(e.target.value))}
                        className="flex-1 accent-amber-500"
                      />
                    )}
                    {option.inputSuffix && (
                      <span className="text-xs text-stone-500">{option.inputSuffix}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Cost preview */}
              {option && (
                <div className={`rounded p-2.5 text-xs border ${canAfford ? 'border-stone-700 bg-stone-800' : 'border-red-900 bg-red-950'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Setup cost</span>
                    <span className={`font-bold ${canAfford ? 'text-amber-300' : 'text-red-400'}`}>
                      ${cost.toLocaleString()}
                    </span>
                  </div>
                  {!canAfford && (
                    <p className="text-red-400 mt-1">Not enough cash (you have ${playerCash.toLocaleString()})</p>
                  )}
                </div>
              )}
            </>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-stone-700 space-y-2">
          <button
            disabled={!selected || !selectedCityId || !canAfford || submitting}
            onClick={handleConfirm}
            className="w-full py-2 bg-red-800 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-red-100 font-bold rounded uppercase tracking-wide text-sm transition"
          >
            {submitting ? 'Setting trap…' : `🪤 Set Trap — $${cost.toLocaleString()}`}
          </button>
          <button
            onClick={onClose}
            className="w-full py-1.5 text-stone-500 hover:text-stone-300 text-xs uppercase tracking-wide transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
