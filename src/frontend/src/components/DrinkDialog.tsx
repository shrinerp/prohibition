import React, { useEffect, useState } from 'react'

const ALCOHOL_EMOJI: Record<string, string> = {
  beer: '🍺', wine: '🍷', whiskey: '🥃', bourbon: '🥃', scotch: '🥃', rye: '🥃',
  gin: '🍸', rum: '🍹', vodka: '🍸', moonshine: '🫙', tequila: '🥂',
  brandy: '🍷', vermouth: '🍸', malort: '😬',
}

interface PendingDrink {
  senderName: string
  alcoholType: string
}

interface PendingTrap {
  setterName: string
  consequenceType: string
  cityName: string
  params: { seasons?: number; amount?: number; turns?: number }
}

interface DrinkDialogProps {
  drinks: PendingDrink[]
  pendingTrap: PendingTrap | null
  onClose: () => void
}

function trapDescription(trap: PendingTrap): string {
  const { consequenceType, cityName, params } = trap
  if (consequenceType === 'jail') {
    const s = params.seasons ?? 1
    return `Thrown in jail for ${s} season${s !== 1 ? 's' : ''} in ${cityName}.`
  }
  if (consequenceType === 'financial') {
    return `Fined $${(params.amount ?? 0).toLocaleString()} in ${cityName}.`
  }
  if (consequenceType === 'alcohol_loss') {
    const u = params.amount ?? 0
    return `${u} unit${u !== 1 ? 's' : ''} of cargo seized in ${cityName}.`
  }
  if (consequenceType === 'stuck') {
    const t = params.turns ?? 1
    return `Stuck in ${cityName} for ${t} season${t !== 1 ? 's' : ''}.`
  }
  return `A trap was sprung in ${cityName}.`
}

export default function DrinkDialog({ drinks, pendingTrap, onClose }: DrinkDialogProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  const hasDrinks = drinks.length > 0
  const hasTrap = pendingTrap != null
  const primary = drinks[0]
  const typeLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-all duration-300 ${
        visible ? 'bg-black/80' : 'bg-black/0'
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative bg-stone-900 border-2 rounded-2xl overflow-hidden w-80 transition-all duration-300 ${
          hasTrap ? 'border-red-700' : 'border-amber-600'
        } ${visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}
        style={{
          boxShadow: hasTrap
            ? '0 0 60px rgba(185,28,28,0.45), 0 0 120px rgba(185,28,28,0.2)'
            : '0 0 60px rgba(217,119,6,0.45), 0 0 120px rgba(217,119,6,0.2)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Image / header area */}
        <div className="relative h-52 bg-stone-800 overflow-hidden flex items-center justify-center">
          {hasDrinks ? (
            <img
              src={`/drinks/${primary.alcoholType}.png`}
              alt={primary.alcoholType}
              className={`transition-all duration-300 ${visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'}`}
              style={{ maxHeight: '160px', objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <p className="text-7xl select-none">{hasTrap ? '🪤' : '🥃'}</p>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/10 to-transparent" />

          {/* Badge */}
          <div className="absolute top-3 inset-x-0 flex justify-center">
            <span className="bg-black/60 backdrop-blur-sm text-amber-300 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-amber-500/50">
              Prohibition
            </span>
          </div>

          {/* Headline */}
          <div className="absolute bottom-0 inset-x-0 px-4 py-3">
            <p className="text-amber-300 font-black text-2xl drop-shadow-lg leading-tight text-center">
              Your Turn!
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Trap notification */}
          {hasTrap && (
            <div className="bg-red-950/60 border border-red-800 rounded-lg px-3 py-2.5 space-y-1">
              <p className="text-red-400 text-xs font-bold uppercase tracking-wide">
                🪤 You triggered a trap
              </p>
              <p className="text-stone-200 text-sm">
                <span className="font-bold text-red-300">{pendingTrap!.setterName}</span> set you up —{' '}
                {trapDescription(pendingTrap!)}
              </p>
            </div>
          )}

          {/* Drinks */}
          {hasDrinks ? (
            <>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-wide text-center">
                {drinks.length === 1 ? 'A drink came in while you waited' : `${drinks.length} drinks came in while you waited`}
              </p>
              {drinks.map((d, i) => (
                <p key={i} className="text-stone-200 text-sm text-center">
                  {ALCOHOL_EMOJI[d.alcoholType] ?? '🥃'}{' '}
                  <span className="font-bold text-amber-400">{d.senderName}</span>
                  {' '}slid you a {typeLabel(d.alcoholType)}
                </p>
              ))}
            </>
          ) : !hasTrap ? (
            <p className="text-stone-400 text-sm text-center">Make your move, boss.</p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleClose}
            className={`w-full py-2.5 font-black text-sm uppercase tracking-wider rounded-lg transition shadow-[0_0_20px_rgba(217,119,6,0.5)] ${
              hasDrinks ? 'bg-amber-600 hover:bg-amber-500 text-stone-900' : 'bg-stone-700 hover:bg-stone-600 text-stone-200'
            }`}
          >
            {hasDrinks ? "Cheers! Let's Go 🥂" : hasTrap ? "Noted. Let's Go →" : "Let's Go →"}
          </button>
        </div>
      </div>
    </div>
  )
}
