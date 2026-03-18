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
}

interface InventoryPanelProps {
  items: InventoryItem[]
  cargoCapacity: number
  cargoUsed: number
  vehicles: VehicleLocation[]
  onManageFleet: () => void
}

export default function InventoryPanel({ items, cargoCapacity, cargoUsed, vehicles, onManageFleet }: InventoryPanelProps) {
  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-3 space-y-2">
      <p className="text-xs text-stone-400 uppercase tracking-wider">Inventory</p>

      <div className="flex items-center justify-between text-xs">
        <span className="text-stone-400">
          Fleet: <span className="text-amber-300 font-bold">{vehicles.length} car{vehicles.length !== 1 ? 's' : ''}</span>
          <span className="text-stone-500 ml-1">({vehicles.length + 1}d6)</span>
        </span>
        <button
          onClick={onManageFleet}
          className="text-stone-500 hover:text-amber-300 uppercase tracking-wide transition"
        >
          manage
        </button>
      </div>

      {/* Vehicle locations */}
      <ul className="space-y-0.5">
        {vehicles.map(v => (
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
            </span>
            <span className="text-stone-400">📍 {v.cityName}</span>
          </li>
        ))}
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
    </div>
  )
}
