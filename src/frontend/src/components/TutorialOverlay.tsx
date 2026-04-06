import React, { useState, useEffect } from 'react'

interface Step {
  target: string   // data-tutorial attribute
  title: string
  body: string
  side: 'right' | 'left' | 'below' | 'center'
}

const STEPS: Step[] = [
  {
    target: 'roll_button',
    title: '🎲 Roll the Dice',
    body: 'The game is turn-based, click this button to advance your turn. You assign your car the next city that you want to goto.',
    side: 'left',
  },
  {
    target: 'map',
    title: '🗺 Move Your Fleet',
    body: 'Tap any city on the map to route a vehicle there. You roll dice each turn — the result becomes movement points you spend across your vehicles.',
    side: 'below',
  },
  {
    target: 'market',
    title: '🏪 The Market',
    body: 'Buy and sell alcohol. Prices vary by location — find the best deals to maximize your profits. Alcohol made in the city will always be the cheapest.',
    side: 'left',
  },  
  {
    target: 'upgrade_still',
    title: '⚗ Upgrade Your Still',
    body: 'Upgrade your still to produce more alcohol. Higher tiers yield better profits.',
    side: 'left',
  },  
  {
    target: 'inventory',
    title: '🎒 Inventory',
    body: 'See your current stock of alcohol and your vehicles\' cargo. Add Vehicle to increase your trading capacity.',
    side: 'left',
  },
  {
    target: 'heat',
    title: '🌡 Watch Your Heat',
    body: 'Every illegal act raises your heat level. Hit 100 and you\'re arrested and jailed for seasons. Bribe city officials before your heat gets out of control.',
    side: 'left',
  },
]

const TOOLTIP_W = 256
const TOOLTIP_H = 180  // generous estimate
const PAD = 12         // gap between spotlight and tooltip

interface Props {
  gameId: string
  onDone: () => void
}

export default function TutorialOverlay({ gameId, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [spotlight, setSpotlight] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const current = STEPS[step]

  useEffect(() => {
    setIsMobile(window.innerWidth < 640)
  }, [])

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tutorial="${current.target}"]`)
    if (!el) { setSpotlight(null); setTooltipPos(null); return }

    const r = el.getBoundingClientRect()
    const s = { left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 }
    setSpotlight(s)

    if (window.innerWidth < 640) {
      // Mobile: tooltip anchored to bottom — no floating position needed
      setTooltipPos(null)
      return
    }

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
      // center — overlay tooltip on the spotlight
      left = s.left + s.width / 2 - TOOLTIP_W / 2
      top  = s.top + s.height / 2 - TOOLTIP_H / 2
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, vw - TOOLTIP_W - 8))
    top  = Math.max(8, Math.min(top,  vh - TOOLTIP_H - 8))

    setTooltipPos({ left, top })
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
    <div className="fixed inset-0 z-[9990] pointer-events-none select-none">

      {/* Spotlight box — its box-shadow creates the dark overlay around it */}
      {spotlight && (
        <div
          style={{
            position: 'fixed',
            left:   spotlight.left,
            top:    spotlight.top,
            width:  spotlight.width,
            height: spotlight.height,
            borderRadius: 10,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.80)',
            border: '2px solid rgba(251,191,36,0.55)',
            zIndex: 9991,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Fallback full overlay when no spotlight target found */}
      {!spotlight && (
        <div className="fixed inset-0 bg-black/80" style={{ zIndex: 9991 }} />
      )}

      {/* Tooltip card — anchored to bottom on mobile, floating on desktop */}
      <div
        className={`fixed bg-stone-800 border border-amber-500 shadow-2xl pointer-events-auto ${
          isMobile
            ? 'inset-x-0 bottom-0 rounded-t-2xl'
            : 'rounded-xl'
        }`}
        style={
          isMobile
            ? { zIndex: 9995 }
            : { left: tooltipPos?.left ?? 8, top: tooltipPos?.top ?? 8, width: TOOLTIP_W, zIndex: 9995 }
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
