import React, { useState } from 'react'

interface FedsIntroDialogProps {
  onDismiss: () => void
}

type Tab = 'threat' | 'tools'

export default function FedsIntroDialog({ onDismiss }: FedsIntroDialogProps) {
  const [tab, setTab] = useState<Tab>('threat')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />

      <div className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-96 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-700 rounded-t-lg flex-shrink-0">
          <p className="text-xs text-stone-500 uppercase tracking-wider">Heads Up</p>
          <p className="text-stone-200 font-bold text-lg">🏛 The Feds Are Watching</p>
          <p className="text-xs text-stone-500 mt-0.5">
            You're deep enough into Prohibition that the Bureau of Industrial Alcohol has taken notice.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800 flex-shrink-0">
          {([
            { id: 'threat', label: '🤫 The Threat' },
            { id: 'tools',  label: '🏛 Your Tools' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition ${
                tab === t.id
                  ? 'text-stone-200 border-b-2 border-stone-400 -mb-px'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-4 py-4 text-sm text-stone-300 leading-relaxed min-h-[160px]">
          {tab === 'threat' && (
            <div className="space-y-3">
              <p className="text-xs text-stone-400">
                When the feds stop a struggling player, they offer a deal: <span className="text-stone-200 font-semibold">flip and work for us</span>. A player who accepts becomes a snitch — they can no longer win as a bootlegger.
              </p>
              <p className="text-xs text-stone-400">
                Snitches place <span className="text-stone-200 font-semibold">informants</span> in cities to log who passes through. Once they can pin the net worth leader's location, they file an accusation — sending them to jail. If they succeed, <span className="text-stone-200 font-semibold">the feds win</span>.
              </p>
              <p className="text-xs text-stone-400">
                Anyone can be flipped. If the feds stop your operation, you may face the same choice.
              </p>
              <button
                onClick={() => setTab('tools')}
                className="mt-1 text-xs text-stone-400 hover:text-stone-200 underline underline-offset-2 transition"
              >
                See how to protect yourself →
              </button>
            </div>
          )}

          {tab === 'tools' && (
            <div className="space-y-2.5">
              <p className="text-xs text-stone-500 mb-3">
                A <span className="text-stone-300 font-semibold">🏛 Feds</span> button has appeared in your action panel.
              </p>
              <div className="space-y-2">
                {[
                  { icon: '🏛', name: 'Federal Bribe',  cost: '$400', desc: 'Reduce your chance of a federal stop for 4 seasons.' },
                  { icon: '🔍', name: 'Sweep City',      cost: '$100', desc: 'Check a city for informants. Requires a vehicle on-site.' },
                  { icon: '🗂', name: 'Remote Intel',    cost: '$500', desc: 'Check any city for informants remotely. No vehicle needed.' },
                  { icon: '🫵', name: 'Finger a Snitch', cost: null,   desc: 'Accuse someone of being a snitch. Correct: they\'re out and you take their cash. Wrong: fine + heat.' },
                ].map(item => (
                  <div key={item.name} className="flex gap-2.5 items-start">
                    <span className="text-base leading-none mt-0.5 flex-shrink-0">{item.icon}</span>
                    <div>
                      <span className="text-stone-200 font-semibold text-xs">{item.name}</span>
                      {item.cost && <span className="text-stone-500 text-xs ml-1.5">{item.cost}</span>}
                      <p className="text-stone-500 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 flex-shrink-0">
          <button
            onClick={onDismiss}
            className="w-full py-2 bg-stone-700 hover:bg-stone-600 text-stone-100 font-bold rounded uppercase tracking-wide text-sm transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  )
}
