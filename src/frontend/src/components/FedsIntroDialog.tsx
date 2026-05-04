import React from 'react'

interface FedsIntroDialogProps {
  onDismiss: () => void
}

export default function FedsIntroDialog({ onDismiss }: FedsIntroDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onDismiss} />

      <div className="relative bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-96 flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-700 rounded-t-lg flex-shrink-0">
          <p className="text-xs text-stone-500 uppercase tracking-wider">Heads Up</p>
          <p className="text-stone-200 font-bold text-lg">🏛 The Feds Are Watching</p>
        </div>

        <div className="px-4 py-4 space-y-4 text-sm text-stone-300 leading-relaxed">
          <p>
            You're deep enough into Prohibition that the <span className="text-stone-100 font-semibold">Bureau of Industrial Alcohol</span> has taken notice. Federal agents operate independently — local bribes mean nothing to them.
          </p>

          {/* Snitch threat */}
          <div className="rounded border border-zinc-700 bg-zinc-900/50 px-3 py-2.5 space-y-1.5">
            <p className="text-zinc-300 font-semibold text-xs uppercase tracking-wide">🤫 Snitches</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When the feds stop a struggling player, they offer a deal: flip and work for us. A player who accepts becomes a <span className="text-zinc-200 font-semibold">snitch</span> — they can no longer win as a bootlegger.
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Snitches place <span className="text-zinc-200 font-semibold">informants</span> in cities to log who passes through. If they can pin the net worth leader's location, they file an accusation and send them to jail — and the <span className="text-zinc-200 font-semibold">feds win</span>.
            </p>
            <p className="text-xs text-zinc-500 italic">
              This could happen to you too, if the feds stop your operation.
            </p>
          </div>

          {/* Counter-intel tools */}
          <div>
            <p className="text-stone-400 text-xs mb-2">
              A <span className="text-stone-200 font-semibold">🏛 Feds</span> button has appeared in your action panel. Use it to protect yourself:
            </p>
            <ul className="space-y-1.5 text-xs text-stone-400">
              <li className="flex gap-2">
                <span className="text-stone-200 font-bold flex-shrink-0">🏛 Federal Bribe</span>
                <span>$400 — reduce your chance of a federal stop for 4 seasons.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-stone-200 font-bold flex-shrink-0">🔍 Sweep City</span>
                <span>$100 — check a city for informants. Requires a vehicle on-site.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-stone-200 font-bold flex-shrink-0">🗂 Remote Intel</span>
                <span>$500 — remotely check any city for informants. No vehicle needed.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-stone-200 font-bold flex-shrink-0">🫵 Finger a Snitch</span>
                <span>Accuse someone of being a fed informant. Correct: they're eliminated and you take their cash. Wrong: you pay a fine.</span>
              </li>
            </ul>
          </div>
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
