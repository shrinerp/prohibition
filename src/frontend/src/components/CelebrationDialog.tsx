import React, { useEffect, useState } from 'react'
import { getMissionCardDisplay } from '../data/missions'

export interface Celebration {
  type: 'claim_city' | 'upgrade_still' | 'upgrade_vehicle' | 'mission_complete'
  cityId?: number
  newTier?: number
  vehicleId?: string
  missionCardId?: number
  reward?: number
}

const TIER_NAMES = ['', 'Basic Still', 'Copper Pot', 'Column Still', 'Industrial Press', 'Empire Distillery']

const VEHICLE_NAMES: Record<string, string> = {
  roadster:       'Roadster',
  truck:          'Delivery Truck',
  workhorse:      'Workhorse',
  whiskey_runner: 'Whiskey Runner',
}

const SPARKLES = ['✦', '★', '✧', '✶', '✦', '★', '✧', '✶', '✦', '★', '✧', '✶']

interface CelebrationDialogProps {
  celebration: Celebration
  cityName?: string
  onClose: () => void
}

export default function CelebrationDialog({ celebration, cityName, onClose }: CelebrationDialogProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  const citySlug = cityName?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') ?? ''

  let headline = ''
  let subtext = ''
  let imageSrc = ''
  let glowColor = 'rgba(251,191,36,0.45)'
  let borderColor = 'border-amber-500'

  if (celebration.type === 'claim_city') {
    headline = 'City Claimed!'
    subtext = cityName ? `${cityName} now flies your colors.` : 'A new city joins your empire.'
    imageSrc = `/cities/${citySlug}.png`
    glowColor = 'rgba(251,191,36,0.45)'
    borderColor = 'border-amber-500'
  } else if (celebration.type === 'upgrade_still') {
    headline = 'Still Upgraded!'
    const tierName = TIER_NAMES[celebration.newTier ?? 1]
    subtext = cityName
      ? `${cityName}'s operation is now a ${tierName}.`
      : `Upgraded to a ${tierName}.`
    imageSrc = `/cities/${citySlug}.png`
    glowColor = 'rgba(34,197,94,0.4)'
    borderColor = 'border-green-500'
  } else if (celebration.type === 'upgrade_vehicle') {
    headline = 'New Wheels!'
    const vehicleName = VEHICLE_NAMES[celebration.vehicleId ?? ''] ?? celebration.vehicleId ?? ''
    subtext = `You're now rolling in a ${vehicleName}.`
    imageSrc = `/vehicles/${celebration.vehicleId}.png`
    glowColor = 'rgba(59,130,246,0.4)'
    borderColor = 'border-blue-500'
  } else if (celebration.type === 'mission_complete') {
    const missionCard = getMissionCardDisplay(celebration.missionCardId ?? 0)
    headline = 'Mission Complete!'
    subtext = missionCard
      ? `"${missionCard.title}" — $${(celebration.reward ?? 0).toLocaleString()} collected.`
      : `$${(celebration.reward ?? 0).toLocaleString()} reward collected.`
    glowColor = 'rgba(168,85,247,0.4)'
    borderColor = 'border-purple-500'
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-all duration-300 ${
        visible ? 'bg-black/80' : 'bg-black/0'
      }`}
      onClick={handleClose}
    >
      {/* Floating sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="absolute text-amber-400 animate-bounce select-none"
            style={{
              left:              `${(i * 8.3 + 3) % 92}%`,
              top:               `${(i * 7.7 + 5) % 85}%`,
              fontSize:          `${14 + (i % 3) * 6}px`,
              animationDelay:    `${(i * 0.17) % 0.9}s`,
              animationDuration: `${0.7 + (i * 0.11) % 0.6}s`,
              opacity:           visible ? 0.8 : 0,
              transition:        'opacity 0.4s',
            }}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Card */}
      <div
        className={`relative bg-stone-900 border-2 ${borderColor} rounded-2xl overflow-hidden w-80 transition-all duration-300 ${
          visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
        style={{ boxShadow: `0 0 60px ${glowColor}, 0 0 120px ${glowColor.replace('0.4', '0.2').replace('0.45', '0.2')}` }}
        onClick={e => e.stopPropagation()}
      >
        {/* Image area */}
        <div className="relative h-52 bg-stone-800 overflow-hidden">
          {imageSrc && (
            <img
              src={imageSrc}
              alt={headline}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'sepia(0.25) contrast(1.1) brightness(0.9)' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          {/* Bottom gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-900/90 via-stone-900/20 to-transparent" />

          {/* Top badge */}
          <div className="absolute top-3 inset-x-0 flex justify-center">
            <span className="bg-black/60 backdrop-blur-sm text-amber-300 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-amber-500/50">
              Achievement
            </span>
          </div>

          {/* Headline */}
          <div className="absolute bottom-0 inset-x-0 px-4 py-3">
            <p className="text-amber-300 font-black text-2xl drop-shadow-lg leading-tight">{headline}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 text-center">
          <p className="text-stone-200 text-sm leading-relaxed">{subtext}</p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleClose}
            className={`w-full py-2.5 font-black text-sm uppercase tracking-wider rounded-lg transition ${
              celebration.type === 'upgrade_still'
                ? 'bg-green-700 hover:bg-green-600 text-white shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                : celebration.type === 'upgrade_vehicle'
                ? 'bg-blue-700 hover:bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                : celebration.type === 'mission_complete'
                ? 'bg-purple-700 hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                : 'bg-amber-600 hover:bg-amber-500 text-stone-900 shadow-[0_0_20px_rgba(217,119,6,0.5)]'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
