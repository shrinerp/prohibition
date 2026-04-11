import React, { useState, useEffect } from 'react'

// ── Step messages — edit these freely ────────────────────────────────────────
interface Step {
  target: string        // data-tutorial attribute to spotlight
  title: string
  body: string
  side: 'right' | 'left' | 'below' | 'center'
  action?: string       // fired when this step is entered (handled by parent)
}

const STEPS: Step[] = [
  {
    target: 'city_actions',
    title: '🏙 City Actions',
    body: 'These are operations that affect the whole city — buying, selling, upgrading your still, bribing officials, and more.',
    side: 'left',
  },
  {
    target: 'market',
    title: '🏪 The Market',
    body: 'This is where you buy and sell alcohol. Every city has its own prices — find the best deals to maximize your profits.',
    side: 'left',
  },
  {
    target: 'market_dialog',
    title: '🏪 Your Marketplace',
    body: 'This is your marketplace. It shows your still inventory, what you can buy, and what you can sell.',
    side: 'right',
    action: 'open_market',
  },
  {
    target: 'still_inventory',
    title: '⌂ Still Inventory',
    body: 'This is the alcohol your still has produced. You can take it into your vehicle for free, or sell it directly from the distillery.',
    side: 'right',
    action: 'open_market',
  },
  {
    target: 'market_buy',
    title: '🛒 Buy Alcohol',
    body: 'Purchase alcohol from the city\'s market. The buy button will purchase the maximum amount you can afford and carry.',
    side: 'right',
    action: 'open_market',
  },
  {
    target: 'market_sell_tab',
    title: '💰 Sell Your Inventory',
    body: 'Switch to the Sell tab to sell the alcohol in your vehicle. Move it to cities where prices are highest for the best profit.',
    side: 'right',
    action: 'open_market',
  },
  {
    target: 'upgrade_still',
    title: '⚗ Upgrade Your Still',
    body: 'Increase your production by upgrading your still. Higher tiers produce more alcohol each season, multiplying your earnings.',
    side: 'left',
    action: 'close_market',
  },
  {
    target: 'bribe',
    title: '💰 Bribe Officials',
    body: 'Pay for safety. Bribing the local official means no police stops in that city. A bribe lasts 4 turns.',
    side: 'left',
  },
  {
    target: 'trap',
    title: '🪤 Set Traps',
    body: 'Set traps in cities to catch other players. If they get caught, they lose their next turn and have to pay you a fee.',
    side: 'left',
  },
  {
    target: 'roll_button',
    title: '🎲 Roll to Move',
    body: 'When you\'re ready to end your turn, roll the dice. This gives you movement points to spend moving your fleet.',
    side: 'left',
  },
  {
    target: 'map',
    title: '🗺 Choose Your Destination',
    body: 'Select the city you want to travel to. Each city produces different alcohol — and where it\'s produced is always the cheapest you\'ll find it.',
    side: 'below',
  },
  {
    target: 'map',
    title: '🚗 Move Your Fleet',
    body: 'Tap any city on the map to route a vehicle there. Movement points are shared across all your vehicles, so plan your routes wisely.',
    side: 'below',
  },
  {
    target: 'missions',
    title: '📜 Mission Cards',
    body: 'Completing missions is one of the best ways to make money. Draw cards, follow the objectives, and collect big rewards.',
    side: 'below',
  },
  {
    target: 'player_panel',
    title: '👤 Your Panel',
    body: 'These are things specific to you — buy more vehicles to expand your fleet, track your cash, and monitor your heat level.',
    side: 'right',
  },
  {
    target: 'heat',
    title: '🌡 Your Heat',
    body: 'Every illegal act raises your heat. Hit 100 and you\'re arrested and jailed for seasons. Keep it low by bribing officials or laying low.',
    side: 'right',
  },
  {
    target: 'chat',
    title: '💬 Chat & Game Log',
    body: 'This is where you interact with other players and watch the story unfold. You can also send other players drinks — cheers!',
    side: 'right',
  },
  {
    target: 'alliances',
    title: '🤝 Alliances',
    body: 'Form alliances with other players. Allies visit each other\'s cities without fees and won\'t sabotage each other\'s operations.',
    side: 'right',
  },
]
// ─────────────────────────────────────────────────────────────────────────────

const TOOLTIP_W = 260
const TOOLTIP_H = 190
const PAD = 12

interface Props {
  gameId: string
  onAction?: (action: string) => void
  onDone: () => void
}

export default function TutorialOverlay({ gameId, onAction, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [spotlight, setSpotlight] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const current = STEPS[step]

  useEffect(() => {
    setIsMobile(window.innerWidth < 640)
  }, [])

  useEffect(() => {
    // Fire step action (e.g. open/close market dialog)
    if (current.action) onAction?.(current.action)

    // Retry finding the element — it may not be in the DOM yet if a dialog is opening
    let cancelled = false
    const findAndPosition = (attempt = 0) => {
      if (cancelled) return
      const el = document.querySelector<HTMLElement>(`[data-tutorial="${current.target}"]`)
      if (!el) {
        if (attempt < 12) setTimeout(() => findAndPosition(attempt + 1), 80)
        else { setSpotlight(null); setTooltipPos(null) }
        return
      }

      const r = el.getBoundingClientRect()
      const s = { left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 }
      setSpotlight(s)

      if (window.innerWidth < 640) { setTooltipPos(null); return }

      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = 0, top = 0

      if (current.side === 'right') {
        left = s.left + s.width + PAD
        top  = s.top + s.height / 2 - TOOLTIP_H / 2
      } else if (current.side === 'left') {
        left = s.left - TOOLTIP_W - PAD
        top  = s.top + s.height / 2 - TOOLTIP_H / 2
      } else if (current.side === 'below') {
        left = s.left + s.width / 2 - TOOLTIP_W / 2
        top  = s.top + s.height + PAD
      } else {
        left = s.left + s.width / 2 - TOOLTIP_W / 2
        top  = s.top + s.height / 2 - TOOLTIP_H / 2
      }

      left = Math.max(8, Math.min(left, vw - TOOLTIP_W - 8))
      top  = Math.max(8, Math.min(top,  vh - TOOLTIP_H - 8))
      setTooltipPos({ left, top })
    }

    findAndPosition()
    return () => { cancelled = true }
  }, [step])

  async function finish() {
    await fetch(`/api/games/${gameId}/tutorial-done`, { method: 'POST' })
    onDone()
  }

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else finish()
  }

  return (
    <div className="fixed inset-0 z-[99990] pointer-events-none select-none">

      {/* Spotlight box */}
      {spotlight && (
        <div
          style={{
            position:     'fixed',
            left:         spotlight.left,
            top:          spotlight.top,
            width:        spotlight.width,
            height:       spotlight.height,
            borderRadius: 10,
            boxShadow:    '0 0 0 9999px rgba(0,0,0,0.80)',
            border:       '2px solid rgba(251,191,36,0.55)',
            zIndex:       99991,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Fallback full overlay when no spotlight target found */}
      {!spotlight && (
        <div className="fixed inset-0 bg-black/80" style={{ zIndex: 99991 }} />
      )}

      {/* Tooltip card */}
      <div
        className={`fixed bg-stone-800 border border-amber-500 shadow-2xl pointer-events-auto ${
          isMobile ? 'inset-x-0 bottom-0 rounded-t-2xl' : 'rounded-xl'
        }`}
        style={
          isMobile
            ? { zIndex: 99995 }
            : { left: tooltipPos?.left ?? 8, top: tooltipPos?.top ?? 8, width: TOOLTIP_W, zIndex: 99995 }
        }
      >
        <div className={isMobile ? 'px-5 pt-5 pb-2' : 'p-4'}>
          <p className={`text-amber-400 font-bold mb-1.5 ${isMobile ? 'text-base' : 'text-sm'}`}>{current.title}</p>
          <p className={`text-stone-300 leading-relaxed ${isMobile ? 'text-sm' : 'text-xs'}`}>{current.body}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-2 pt-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-5 bg-amber-400' : 'w-1.5 bg-stone-600'
              }`}
            />
          ))}
        </div>

        <div className={`flex items-center justify-between gap-2 ${isMobile ? 'px-5 pb-8' : 'px-4 pb-4'}`}>
          <button
            onClick={finish}
            className={`text-stone-500 hover:text-stone-400 transition ${isMobile ? 'text-sm' : 'text-xs'}`}
          >
            Skip
          </button>
          <span className={`text-stone-600 ${isMobile ? 'text-sm' : 'text-xs'}`}>{step + 1} / {STEPS.length}</span>
          <button
            onClick={next}
            className={`bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded-lg uppercase tracking-wide transition ${isMobile ? 'px-6 py-2.5 text-sm' : 'px-4 py-1.5 text-xs'}`}
          >
            {step < STEPS.length - 1 ? 'Next →' : "Let's go!"}
          </button>
        </div>
      </div>
    </div>
  )
}
