import React, { useState } from 'react'

interface MarketPrice {
  alcoholType: string
  price: number
  primaryAlcohol?: string
}

interface InventoryItem {
  alcoholType: string
  units: number
}

interface DistilleryStock {
  alcohol_type: string
  quantity: number
}

interface PendingAction {
  type: 'buy' | 'sell' | 'pickup' | 'sell_city_stock'
  alcoholType: string
  quantity: number
  cityId?: number | null
}

interface MarketDialogProps {
  cityName: string
  prices: MarketPrice[]
  inventory: InventoryItem[]
  distilleryStock: DistilleryStock[]
  cash: number
  cargoFree: number
  currentCityId?: number | null
  characterClass?: string
  purchaseBudgetExhausted?: boolean
  onClose: () => void
  onAction: (actions: PendingAction[]) => void
}

/** Mirror of the backend sell multiplier logic in games.ts */
function getSellMultiplier(characterClass: string | undefined, alcoholType: string): number {
  if (characterClass === 'pharmacist' && alcoholType === 'whiskey') return 1.5
  if (characterClass === 'rum_runner')  return 0.85
  if (characterClass === 'socialite')   return 1.25
  return 1.0
}

export default function MarketDialog({
  cityName, prices, inventory, distilleryStock,
  cash, cargoFree, currentCityId, characterClass, purchaseBudgetExhausted, onClose, onAction
}: MarketDialogProps) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')

  const sortedPrices = [...prices].sort((a, b) => b.price - a.price)
  const maxPrice     = sortedPrices[0]?.price ?? 1
  const minPrice     = sortedPrices[sortedPrices.length - 1]?.price ?? 1

  function priceColor(price: number, isLocal: boolean) {
    if (isLocal) return 'text-stone-500'
    if (price >= maxPrice * 0.85) return 'text-green-400'
    if (price <= minPrice * 1.15) return 'text-red-400'
    return 'text-amber-300'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={() => onClose()} />

      {/* Dialog */}
      <div className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-96 max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 flex-shrink-0">
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider">Market</p>
            <p className="text-amber-300 font-bold">{cityName}</p>
          </div>
          <button onClick={() => onClose()} className="text-stone-500 hover:text-stone-200 text-xl leading-none">✕</button>
        </div>

        {/* Cash / cargo status */}
        <div className="px-4 py-2 border-b border-stone-700 flex-shrink-0">
          <p className="text-xs text-stone-500">
            Cash: <span className="text-green-400 font-bold">${cash.toLocaleString()}</span>
            &nbsp;·&nbsp;Cargo free: <span className="text-amber-300 font-bold">{cargoFree}</span>
          </p>
        </div>

        {/* Your Still — free pick-up */}
        {distilleryStock.length > 0 && (
          <div className="px-4 py-2 border-b border-stone-700 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-green-600 uppercase tracking-wider">⌂ Your still (free)</p>
              {distilleryStock.length > 1 && (
                <button
                  disabled={cargoFree <= 0}
                  onClick={() => onAction(
                    distilleryStock
                      .filter(r => r.quantity > 0)
                      .map(r => ({ type: 'pickup' as const, alcoholType: r.alcohol_type, quantity: r.quantity, cityId: currentCityId }))
                  )}
                  className="text-xs px-2 py-0.5 bg-green-800 hover:bg-green-700 disabled:opacity-40 text-green-300 rounded transition"
                >
                  Get All
                </button>
              )}
            </div>
            {distilleryStock.map(row => {
              const takeQty   = Math.min(row.quantity, cargoFree)
              const sellPrice = Math.round((prices.find(x => x.alcoholType === row.alcohol_type)?.price ?? 0) * getSellMultiplier(characterClass, row.alcohol_type))
              return (
                <div key={row.alcohol_type} className="flex items-center justify-between py-1 border-b border-stone-800 last:border-0 gap-1">
                  <span className="text-sm capitalize text-stone-300 flex-1">{row.alcohol_type}
                    <span className="text-stone-600 text-xs ml-1">×{row.quantity}</span>
                  </span>
                  <button
                    disabled={cargoFree <= 0 || row.quantity <= 0}
                    onClick={() => onAction([{ type: 'pickup', alcoholType: row.alcohol_type, quantity: takeQty, cityId: currentCityId }])}
                    className="text-xs px-2 py-1 bg-green-900 hover:bg-green-800 disabled:opacity-40 text-green-300 rounded transition flex-shrink-0"
                  >
                    Take {takeQty}
                  </button>
                  {sellPrice > 0 && (
                    <button
                      disabled={row.quantity <= 0}
                      onClick={() => onAction([{ type: 'sell_city_stock', alcoholType: row.alcohol_type, quantity: row.quantity }])}
                      className="text-xs px-2 py-1 bg-amber-800 hover:bg-amber-700 disabled:opacity-40 text-amber-200 rounded transition flex-shrink-0"
                    >
                      Sell all
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-stone-700 flex-shrink-0">
          {(['buy', 'sell'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-bold uppercase tracking-wide transition ${
                tab === t
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              {t === 'buy' ? 'Buy' : 'Sell'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">

          {/* ── Buy tab ── */}
          {tab === 'buy' && (
            <>
              {purchaseBudgetExhausted && (
                <p className="text-amber-500 text-xs bg-amber-950/40 border border-amber-800 rounded px-3 py-2">
                  Purchase limit reached — you've filled your vehicles' capacity for this turn.
                </p>
              )}
              {/* Price table */}
              {sortedPrices.length === 0 ? (
                <p className="text-stone-500 text-xs italic">No market data this season</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-stone-500 uppercase tracking-wider border-b border-stone-700">
                      <th className="text-left pb-1 font-normal">Alcohol</th>
                      <th className="text-right pb-1 font-normal">Price</th>
                      <th className="text-right pb-1 font-normal">Buy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPrices.map(p => {
                      const isLocal   = p.primaryAlcohol === p.alcoholType
                      const maxAfford = Math.floor(cash / p.price)
                      const maxBuy    = Math.min(cargoFree, maxAfford)
                      return (
                        <tr key={p.alcoholType} className="border-b border-stone-800">
                          <td className={`py-1.5 capitalize ${isLocal ? 'text-stone-500' : 'text-stone-200'}`}>
                            {p.alcoholType}
                            {isLocal && <span className="text-stone-600 ml-1">(local)</span>}
                          </td>
                          <td className={`text-right font-bold tabular-nums ${priceColor(p.price, isLocal)}`}>
                            ${p.price}
                          </td>
                          <td className="text-right pl-2">
                            <button
                              disabled={maxBuy <= 0 || purchaseBudgetExhausted}
                              onClick={() => onAction([{ type: 'buy', alcoholType: p.alcoholType, quantity: maxBuy }])}
                              className="px-2 py-1 bg-blue-900 hover:bg-blue-800 disabled:opacity-40 text-blue-200 rounded transition tabular-nums"
                            >
                              {maxBuy > 0 ? `Max ×${maxBuy} — $${(p.price * maxBuy).toLocaleString()}` : 'Max'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* ── Sell tab ── */}
          {tab === 'sell' && (
            <>
              {inventory.length === 0 ? (
                <p className="text-stone-500 text-sm italic">Your cargo is empty.</p>
              ) : (
                inventory.map(item => {
                  const p         = prices.find(x => x.alcoholType === item.alcoholType)
                  const unitPrice = Math.round((p?.price ?? 0) * getSellMultiplier(characterClass, item.alcoholType))
                  const revenue   = unitPrice * item.units
                  return (
                    <div key={item.alcoholType} className="flex items-center justify-between py-2 border-b border-stone-800 gap-2">
                      <div>
                        <p className="text-sm capitalize text-stone-200">{item.alcoholType}</p>
                        <p className="text-xs text-stone-500">×{item.units} units · ${unitPrice}/u</p>
                      </div>
                      <button
                        onClick={() => onAction([{ type: 'sell', alcoholType: item.alcoholType, quantity: item.units }])}
                        className="text-xs px-3 py-1.5 bg-amber-800 hover:bg-amber-700 text-amber-200 rounded transition font-bold flex-shrink-0"
                      >
                        Sell all — ${revenue}
                      </button>
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-stone-700 flex-shrink-0 flex justify-end">
          <button
            onClick={() => onClose()}
            className="px-4 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm font-bold rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
