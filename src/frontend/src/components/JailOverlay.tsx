import React from 'react'

interface JailOverlayProps {
  seasonsRemaining: number
  hasLawyerPerk: boolean
  onPayLawyer: () => void
}

export default function JailOverlay({ seasonsRemaining, hasLawyerPerk, onPayLawyer }: JailOverlayProps) {
  return (
    <div className="absolute inset-0 bg-stone-900/90 flex flex-col items-center justify-center z-10 rounded">
      <div className="text-6xl mb-4">🔒</div>
      <h3 className="text-2xl font-bold text-red-400 mb-2">Behind Bars</h3>
      <p className="text-stone-300 mb-6">
        {seasonsRemaining} season{seasonsRemaining !== 1 ? 's' : ''} remaining
      </p>
      {hasLawyerPerk && (
        <button
          onClick={onPayLawyer}
          className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded uppercase tracking-wide transition"
        >
          Pay Legal Fee — Walk Free
        </button>
      )}
    </div>
  )
}
