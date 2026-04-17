import React, { useState } from 'react'

interface VehicleSpec {
  id: string
  name: string
  movementMultiplier: number
  cargoSlots: number
  price: number
  flavour: string
}

const VEHICLES: VehicleSpec[] = [
  { id: 'workhorse',      name: 'Workhorse (Model T)', movementMultiplier: 1.0, cargoSlots: 16, price: 200, flavour: 'Reliable workhorse of the bootlegger trade.' },
  { id: 'roadster',       name: 'Roadster',             movementMultiplier: 1.2, cargoSlots: 10, price: 500, flavour: 'Quick enough to outrun a patrol car on a good road.' },
  { id: 'truck',          name: 'Truck',                movementMultiplier: 0.8, cargoSlots: 28, price: 700, flavour: 'Hauls a serious load — if you can afford to be slow.' },
  { id: 'whiskey_runner', name: 'Whiskey Runner',       movementMultiplier: 1.5, cargoSlots: 6,  price: 900, flavour: "Fastest thing on two wheels. Don't drop the bottles." },
]

interface MapCity { id: number; name: string }

interface VehicleState {
  id: number; vehicleType: string; cityId: number; heat: number; saleValue: number
  inventory: Array<{ alcohol_type: string; quantity: number }>
}

interface VehicleDialogProps {
  vehicles: VehicleState[]
  cash: number
  isMyTurn: boolean
  mapCities: MapCity[]
  vehiclePrices: Record<string, number>
  carLimit: number
  onBuy: (vehicleType: string) => void
  onSell: (vehicleId: number) => void
  onClose: () => void
}

function SpeedBar({ mult }: { mult: number }) {
  const filled = Math.round(((mult - 0.8) / (1.5 - 0.8)) * 4) + 1
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`h-1.5 w-4 rounded-sm ${i < filled ? 'bg-amber-400' : 'bg-stone-700'}`} />
      ))}
    </div>
  )
}

function CargoBar({ slots }: { slots: number }) {
  const filled = Math.round(((slots - 6) / (28 - 6)) * 4) + 1
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`h-1.5 w-4 rounded-sm ${i < filled ? 'bg-green-500' : 'bg-stone-700'}`} />
      ))}
    </div>
  )
}

export default function VehicleDialog({ vehicles, cash, isMyTurn, mapCities, vehiclePrices, carLimit, onBuy, onSell, onClose }: VehicleDialogProps) {
  const [tab, setTab] = useState<'fleet' | 'buy'>('fleet')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-[480px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider">Fleet</p>
            <p className="text-amber-300 font-bold">{vehicles.length} Car{vehicles.length !== 1 ? 's' : ''} — {vehicles.length + 1}d6 per roll</p>
            <p className="text-xs text-stone-500">Limit: {carLimit} car{carLimit !== 1 ? 's' : ''} · claim more cities to expand</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400">
              Cash: <span className="text-green-400 font-bold">${cash.toLocaleString()}</span>
            </span>
            <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-xl leading-none">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-700 flex-shrink-0">
          <button
            onClick={() => setTab('fleet')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition ${tab === 'fleet' ? 'text-amber-300 border-b-2 border-amber-500' : 'text-stone-500 hover:text-stone-300'}`}
          >
            My Fleet
          </button>
          <button
            onClick={() => setTab('buy')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition ${tab === 'buy' ? 'text-amber-300 border-b-2 border-amber-500' : 'text-stone-500 hover:text-stone-300'}`}
          >
            Buy New Car
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {tab === 'fleet' ? (
            <div className="space-y-3">
              {vehicles.length === 0 && (
                <p className="text-stone-500 text-sm italic text-center py-4">No vehicles yet</p>
              )}
              {vehicles.map((v, i) => {
                const spec = VEHICLES.find(s => s.id === v.vehicleType)
                const cargoUsed = v.inventory.reduce((s, inv) => s + inv.quantity, 0)
                const cargoSlots = spec?.cargoSlots ?? 16
                const cityName = mapCities.find(c => c.id === v.cityId)?.name ?? `City ${v.cityId}`
                return (
                  <div key={v.id} className="rounded border border-stone-700 bg-stone-800 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="font-bold text-sm text-stone-200">
                          {i === 0 && <span className="text-amber-500 mr-1">★</span>}
                          {spec?.name ?? v.vehicleType}
                        </span>
                        <span className="text-xs text-stone-500 ml-2">#{v.id}</span>
                      </div>
                      <span className="text-xs text-stone-400">{cityName}</span>
                    </div>
                    {/* Heat bar */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-stone-500 w-8">Heat</span>
                      <div className="flex-1 h-1.5 rounded bg-stone-700 overflow-hidden">
                        <div className="h-full rounded transition-all"
                          style={{ width: `${v.heat}%`, background: v.heat > 70 ? '#ef4444' : v.heat > 40 ? '#f97316' : '#22c55e' }} />
                      </div>
                      <span className="text-xs text-stone-400 tabular-nums w-8">{v.heat}%</span>
                    </div>
                    {/* Cargo */}
                    <div className="text-xs text-stone-500 mb-2">
                      Cargo: <span className="text-amber-400 font-bold">{cargoUsed}/{cargoSlots}</span>
                      {v.inventory.filter(inv => inv.quantity > 0).length > 0 && (
                        <span className="ml-2 text-stone-500">
                          {v.inventory.filter(inv => inv.quantity > 0).map(inv => `${inv.quantity} ${inv.alcohol_type}`).join(', ')}
                        </span>
                      )}
                    </div>
                    {/* Sell button — disabled for lead car (index 0) or when not your turn */}
                    {i > 0 && (
                      <button
                        disabled={!isMyTurn}
                        onClick={() => onSell(v.id)}
                        title={isMyTurn ? `Sell for $${v.saleValue.toLocaleString()} (50% of purchase price). Cargo will be abandoned.` : 'Not your turn'}
                        className="w-full py-1 border border-red-800 hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 text-xs font-bold rounded uppercase tracking-wide transition"
                      >
                        Sell — ${v.saleValue.toLocaleString()}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {vehicles.length >= carLimit ? (
                <div className="rounded border border-stone-700 bg-stone-800/50 px-3 py-2.5 text-xs text-stone-500">
                  You have reached your car limit ({carLimit}). Claim more cities to unlock additional cars.
                </div>
              ) : (
                <p className="text-xs text-stone-500 mb-3">New car spawns at your home city. Each car adds +1 die to your movement roll.</p>
              )}
              {VEHICLES.map(v => {
                const price = vehiclePrices[v.id] ?? v.price
                const atLimit = vehicles.length >= carLimit
                const canAfford = isMyTurn && cash >= price && !atLimit
                return (
                  <div key={v.id} className="rounded border border-stone-700 bg-stone-800 overflow-hidden">
                    <div className="relative h-28 bg-stone-950 flex items-end justify-center px-4">
                      <img src={`/vehicles/${v.id}.png`} alt={v.name}
                        className="max-h-24 max-w-full object-contain"
                        style={{ filter: 'sepia(0.3) contrast(1.05)' }} />
                    </div>
                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-stone-200">{v.name}</p>
                        <p className="text-xs text-stone-500 mb-1.5">{v.flavour}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-stone-500 w-12">Speed</span>
                            <SpeedBar mult={v.movementMultiplier} />
                            <span className="text-stone-400 tabular-nums">{v.movementMultiplier}×</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-stone-500 w-12">Cargo</span>
                            <CargoBar slots={v.cargoSlots} />
                            <span className="text-stone-400 tabular-nums">{v.cargoSlots} slots</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <button
                          disabled={!canAfford}
                          onClick={() => { onBuy(v.id); onClose() }}
                          className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 disabled:opacity-40 text-blue-200 text-xs font-bold rounded transition"
                        >
                          ${price.toLocaleString()}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
