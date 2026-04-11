import React from 'react'

interface Props {
  onBeginTour: () => void
  onSkip: () => void
}

const HIGHLIGHTS = [
  { icon: '🥃', text: 'Produce alcohol at your distillery every season' },
  { icon: '🚗', text: 'Drive your fleet across 52 US cities, buy low and sell high' },
  { icon: '💰', text: 'Bribe officials, claim territory, sabotage rivals' },
]

export default function WelcomeDialog({ onBeginTour, onSkip }: Props) {
  return (
    <div className="fixed inset-0 z-[99980] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85" />

      <div className="relative w-full max-w-lg bg-stone-900 border border-amber-700/60 rounded-2xl shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 80px rgba(180,120,20,0.25), 0 25px 60px rgba(0,0,0,0.7)' }}>


        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-amber-500/80 text-xs uppercase tracking-[0.25em] font-bold text-center mb-1">America · 1920–1933</p>
          <h1 className="text-amber-300 font-black text-xl text-center mb-3">Welcome to Prohibitioner</h1>

          <p className="text-stone-300 text-sm leading-relaxed text-center mb-4">
            The goal of the game is to amass as much wealth as possible by producing and selling alcohol. 
            Each turn represents a season — you have up to 52 seasons (turns) to compete for the most wealth.
          </p>

          <div className="space-y-2 mb-5">
            {HIGHLIGHTS.map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-base w-6 text-center flex-shrink-0">{icon}</span>
                <p className="text-stone-300 text-sm">{text}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-stone-700 mb-4" />

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onSkip}
              className="text-sm text-stone-500 hover:text-stone-400 transition"
            >
              Skip tour
            </button>
            <button
              onClick={onBeginTour}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-900 font-black text-sm rounded-lg uppercase tracking-wider transition"
              style={{ boxShadow: '0 0 20px rgba(217,119,6,0.4)' }}
            >
              Begin Tour →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
