import React, { useState, useEffect, useRef } from 'react'

interface Step {
  target: string   // data-tutorial attribute
  title: string
  body: string
  side: 'right' | 'left' | 'center'
}

const STEPS: Step[] = [
  {
    target: 'distillery',
    title: '⚗ Your Distillery',
    body: 'Every season your still brews alcohol automatically. How much depends on its tier — upgrade it to produce more. Collect your stock and load it into your vehicle.',
    side: 'right',
  },
  {
    target: 'map',
    title: '🗺 Move Your Fleet',
    body: 'Tap any city on the map to route a vehicle there. You roll dice each turn — the result becomes movement points you spend across your vehicles.',
    side: 'center',
  },
  {
    target: 'actions',
    title: '💰 Buy Low, Sell High',
    body: 'Every city overproduces one alcohol type — prices are low there. Drive your cargo to a different city and sell high. That\'s how you build an empire.',
    side: 'left',
  },
  {
    target: 'heat',
    title: '🌡 Watch Your Heat',
    body: 'Every illegal act raises your heat level. Hit 100 and you\'re arrested and jailed for seasons. Bribe city officials before your heat gets out of control.',
    side: 'right',
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
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })

  const current = STEPS[step]

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tutorial="${current.target}"]`)
    if (!el) { setSpotlight(null); return }

    const r = el.getBoundingClientRect()
    const s = { left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 }
    setSpotlight(s)

    const vw = window.innerWidth
    const vh = window.innerHeight

    let left = 0, top = 0

    if (current.side === 'right') {
      left = s.left + s.width + PAD
      top  = s.top + s.height / 2 - TOOLTIP_H / 2
    } else if (current.side === 'left') {
      left = s.left - TOOLTIP_W - PAD
      top  = s.top + s.height / 2 - TOOLTIP_H / 2
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

      {/* Tooltip card */}
      <div
        className="fixed bg-stone-800 border border-amber-500 rounded-xl shadow-2xl pointer-events-auto"
        style={{ left: tooltipPos.left, top: tooltipPos.top, width: TOOLTIP_W, zIndex: 9995 }}
      >
        <div className="p-4">
          <p className="text-amber-400 font-bold text-sm mb-1.5">{current.title}</p>
          <p className="text-stone-300 text-xs leading-relaxed">{current.body}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-5 bg-amber-400' : 'w-1.5 bg-stone-600'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between px-4 pb-4 gap-2">
          <button
            onClick={finish}
            className="text-xs text-stone-500 hover:text-stone-400 transition"
          >
            Skip
          </button>
          <button
            onClick={next}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-900 text-xs font-bold rounded-lg uppercase tracking-wide transition"
          >
            {step < STEPS.length - 1 ? 'Next →' : "Let's go!"}
          </button>
        </div>
      </div>
    </div>
  )
}
