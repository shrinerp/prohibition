import React from 'react'

interface MarketPrice {
  alcoholType: string
  price: number
  cityId: number
}

interface MarketPanelProps {
  prices: MarketPrice[]
  currentCityId: number
}

export default function MarketPanel({ prices, currentCityId }: MarketPanelProps) {
  const localPrices = prices.filter(p => p.cityId === currentCityId)

  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-3 space-y-2">
      <p className="text-xs text-stone-400 uppercase tracking-wider">Market Prices</p>
      {localPrices.length === 0 ? (
        <p className="text-stone-500 text-xs italic">No market data</p>
      ) : (
        <ul className="space-y-1">
          {localPrices.map(p => (
            <li key={p.alcoholType} className="flex justify-between text-sm">
              <span className="capitalize text-stone-300">{p.alcoholType}</span>
              <span className="text-green-400 font-bold">${p.price}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
