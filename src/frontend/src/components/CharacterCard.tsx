import React from 'react'

interface CharacterCardProps {
  characterClass: string
  name: string
  perk: string
  drawback: string
}

export default function CharacterCard({ characterClass, name, perk, drawback }: CharacterCardProps) {
  return (
    <div className="bg-stone-800 border border-stone-600 rounded p-3 space-y-1">
      <p className="text-xs text-stone-400 uppercase tracking-wider">Character</p>
      <p className="font-bold text-amber-400">{name}</p>
      <p className="text-xs text-green-400">✦ {perk}</p>
      <p className="text-xs text-red-400">✗ {drawback}</p>
    </div>
  )
}
