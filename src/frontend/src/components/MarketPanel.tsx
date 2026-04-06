import React from 'react'

interface MarketPrice {
  alcoholType: string
  price: number
  cityId: number
  primaryAlcohol?: string
}

interface MarketPanelProps {
  prices: MarketPrice[]
  currentCityId: number
}

export default function MarketPanel({ prices, currentCityId }: MarketPanelProps) {
  const localPrices = prices
    .filter(p => p.cityId === currentCityId)
    .sort((a, b) => b.price - a.price)

  if (localPrices.length === 0) {
    return (
      <div className="bg-stone-800 border border-stone-600 rounded p-3">
        <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Price List</p>
        <p className="text-stone-500 text-xs italic">No market data this season</p>
      </div>
    )
  }

  const maxPrice = localPrices[0].price
  const minPrice = localPrices[localPrices.length - 1].price

  function priceColor(price: number, isLocal: boolean): string {
    if (isLocal) return 'text-stone-400'
    if (price >= maxPrice * 0.85) return 'text-green-400'
    if (price <= minPrice * 1.15) return 'text-red-400'
    return 'text-amber-300'
  }

  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-2">
      <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">Price List</p>
      <ul className="space-y-0.5">
        {localPrices.map(p => {
          const isLocal = p.primaryAlcohol === p.alcoholType
          return (
            <li key={p.alcoholType} className="flex justify-between items-center text-xs gap-2">
              <span className={`capitalize ${isLocal ? 'text-stone-500' : 'text-stone-300'}`}>
                {p.alcoholType}
                {isLocal && <span className="text-stone-600 ml-1">(local)</span>}
              </span>
              <span className={`font-bold tabular-nums ${priceColor(p.price, isLocal)}`}>
                ${p.price}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
