import React from 'react'

interface InventoryItem {
  alcoholType: string
  units: number
}

interface VehicleLocation {
  id: number
  vehicleType: string
  cityName: string
  isLead?: boolean
  turnsStationary?: number
}

interface InventoryPanelProps {
  items: InventoryItem[]
  cargoCapacity: number
  cargoUsed: number
  vehicles: VehicleLocation[]
  currentSeason?: number
  onManageFleet: () => void
  onSellAll?: () => void
  onMaxOut?: () => void
  isMyTurn?: boolean
  soldThisTurn?: boolean
  maxedThisTurn?: boolean
}

export default function InventoryPanel({ items, cargoCapacity, cargoUsed, vehicles, onManageFleet, onSellAll, onMaxOut, isMyTurn, soldThisTurn, maxedThisTurn }: InventoryPanelProps) {
  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-3 space-y-2">
      <p className="text-xs text-stone-400 uppercase tracking-wider">Inventory</p>

      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-400">
          Fleet: <span className="text-amber-300 font-bold">{vehicles.length} car{vehicles.length !== 1 ? 's' : ''}</span>
          <span className="text-stone-500 ml-1">({vehicles.length + 1}d6)</span>
        </span>
      </div>
      <button
        onClick={onManageFleet}
        className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-900 text-xs font-bold rounded uppercase tracking-wide transition cursor-pointer"
      >
        Manage Fleet
      </button>

      {/* Vehicle locations */}
      <ul className="space-y-0.5">
        {vehicles.map(v => {
          const isWarning  = v.turnsStationary === 4
          const isCritical = v.turnsStationary != null && v.turnsStationary >= 5
          return (
            <li key={v.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 capitalize text-stone-500">
                {v.isLead && (
                  <span className="relative group">
                    <span className="text-amber-400 cursor-default">🚗</span>
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 rounded bg-stone-700 border border-stone-500 px-2 py-1.5 text-xs text-stone-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-snug">
                      <strong className="text-amber-300 block mb-0.5">Lead Car</strong>
                      Used to claim cities, bribe officials, access markets, and upgrade stills. Move this car to act in a city.
                    </span>
                  </span>
                )}
                {v.vehicleType.replace(/_/g, ' ')}
                {isWarning && (
                  <span className="relative group">
                    <span className="text-orange-400 cursor-default ml-0.5">⚠</span>
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 rounded bg-stone-700 border border-orange-700 px-2 py-1.5 text-xs text-stone-200 opacity-0 group-hover:opacity-100 transition-opacity z-50 leading-snug">
                      <strong className="text-orange-400 block mb-0.5">Breaking Down Soon</strong>
                      This car hasn't moved in 4 turns. Move it next turn or it will break down and be replaced with a Workhorse.
                    </span>
                  </span>
                )}
                {isCritical && (
                  <span className="text-red-500 ml-0.5">💀</span>
                )}
              </span>
              <span className={isWarning ? 'text-orange-400' : isCritical ? 'text-red-400' : 'text-stone-400'}>📍 {v.cityName}</span>
            </li>
          )
        })}
      </ul>

      <div className="text-xs text-stone-400">
        Cargo: <span className="text-amber-400 font-bold">{cargoUsed}/{cargoCapacity}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-stone-500 text-xs italic">No cargo</p>
      ) : (
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item.alcoholType} className="flex justify-between text-sm">
              <span className="capitalize text-stone-300">{item.alcoholType}</span>
              <span className="text-amber-400 font-bold">{item.units} units</span>
            </li>
          ))}
        </ul>
      )}

      {(onSellAll || onMaxOut) && (
        <div className="flex gap-1.5">
          {onSellAll && (
            <button
              onClick={onSellAll}
              disabled={!isMyTurn || soldThisTurn}
              title={!isMyTurn ? 'Not your turn' : soldThisTurn ? 'Already sold this turn' : 'Sell all distillery stock and vehicle cargo at cities where you have a car present'}
              className="flex-1 py-1.5 border border-green-700 hover:bg-green-900/40 disabled:opacity-40 disabled:cursor-not-allowed text-green-400 font-bold rounded uppercase tracking-wide text-xs transition"
            >
              💰 Sell Everything
            </button>
          )}
          {onMaxOut && (
            <button
              onClick={onMaxOut}
              disabled={!isMyTurn || maxedThisTurn}
              title={!isMyTurn ? 'Not your turn' : maxedThisTurn ? 'Already maxed out this turn' : 'Fill each car to capacity with the alcohol of the city it is parked in'}
              className="flex-1 py-1.5 border border-amber-700 hover:bg-amber-900/40 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 font-bold rounded uppercase tracking-wide text-xs transition"
            >
              🚗 Max-out Cars
            </button>
          )}
        </div>
      )}
    </div>
  )
}
