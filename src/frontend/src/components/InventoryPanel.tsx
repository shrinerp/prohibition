import React from 'react'

interface InventoryItem {
  alcoholType: string
  units: number
}

interface InventoryPanelProps {
  items: InventoryItem[]
  cargoCapacity: number
  cargoUsed: number
}

export default function InventoryPanel({ items, cargoCapacity, cargoUsed }: InventoryPanelProps) {
  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-3 space-y-2">
      <p className="text-xs text-stone-400 uppercase tracking-wider">Inventory</p>
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
