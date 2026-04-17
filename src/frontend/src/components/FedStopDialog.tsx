import React, { useState } from 'react'

interface FedStopDialogProps {
  fineCost: number
  jailSeasons: number
  cargoUnits: number
  cash: number
  onPay: () => void
  onJail: () => void
  onSnitch: () => void
}

export default function FedStopDialog({ fineCost, jailSeasons, cargoUnits, cash, onPay, onJail, onSnitch }: FedStopDialogProps) {
  const [confirmSnitch, setConfirmSnitch] = useState(false)
  const actualFine = Math.min(fineCost, cash)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" />

      <div className="relative bg-stone-900 border border-indigo-900 rounded-lg shadow-2xl w-96 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-indigo-900/60 bg-indigo-950/30 rounded-t-lg">
          <p className="text-xs text-indigo-400 uppercase tracking-wider">Federal Stop</p>
          <p className="text-indigo-200 font-bold text-lg">🕵️ Prohibition Bureau</p>
          <p className="text-xs text-indigo-400/70">Bureau of Industrial Alcohol</p>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          <p className="text-stone-300 text-sm">
            Federal agents have stopped your operation.
            {cargoUnits > 0 && (
              <span className="text-amber-400"> You're carrying {cargoUnits} unit{cargoUnits !== 1 ? 's' : ''} of contraband.</span>
            )}
          </p>

          {/* Pay the fine */}
          <button
            onClick={onPay}
            className="w-full text-left px-3 py-2.5 rounded border border-stone-600 bg-stone-800 hover:bg-stone-700 transition"
          >
            <p className="font-bold text-stone-200 text-sm">
              💵 Pay the Fine — ${actualFine.toLocaleString()}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">
              {cash < fineCost
                ? `You can only cover $${actualFine.toLocaleString()} of the $${fineCost.toLocaleString()} fine. Heat −5.`
                : `25% of your cash. Walk away. Heat −5.`}
            </p>
          </button>

          {/* Go to jail */}
          <button
            onClick={onJail}
            className="w-full text-left px-3 py-2.5 rounded border border-stone-600 bg-stone-800 hover:bg-stone-700 transition"
          >
            <p className="font-bold text-stone-200 text-sm">
              ⛓️ Go to Jail — {jailSeasons} season{jailSeasons !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">
              Cooperate fully. Heat −10.{cargoUnits > 0 ? ' Your cargo remains.' : ''}
            </p>
          </button>

          {/* Become a snitch */}
          {!confirmSnitch ? (
            <button
              onClick={() => setConfirmSnitch(true)}
              className="w-full text-left px-3 py-2.5 rounded border border-zinc-600 bg-zinc-800/50 hover:bg-zinc-700/50 transition"
            >
              <p className="font-bold text-zinc-300 text-sm">🤫 Become an Informant</p>
              <p className="text-xs text-zinc-500 mt-0.5">Work for the feds. A different path.</p>
            </button>
          ) : (
            <div className="rounded border border-red-900/60 bg-red-950/30 px-3 py-2.5 space-y-2">
              <p className="text-xs text-red-300 font-bold">Are you sure?</p>
              <p className="text-xs text-red-400/80">
                You will <strong>never win as a bootlegger again</strong>. Your only path to victory is working for the feds — placing informants, building intel, and bringing down the leader.
              </p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={onSnitch}
                  className="flex-1 py-1.5 bg-red-900 hover:bg-red-800 text-red-200 text-xs font-bold rounded transition"
                >
                  Yes — I'm in
                </button>
                <button
                  onClick={() => setConfirmSnitch(false)}
                  className="flex-1 py-1.5 bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
