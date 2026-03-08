import React, { useMemo } from 'react'

export interface CityNode {
  id: number
  name: string
  ownerColor?: string   // CSS colour, e.g. '#e07b39'
}

export interface Road {
  fromCityId: number
  toCityId: number
}

export interface PlayerToken {
  playerId: number
  cityId: number
  color: string
  isMe: boolean
}

interface SvgMapProps {
  cities: CityNode[]
  roads: Road[]
  playerTokens: PlayerToken[]
  selectedCityId?: number | null
  onCityClick?: (cityId: number) => void
}

/** Deterministic layout: evenly distribute cities in a grid-like spiral */
function layoutCities(cities: CityNode[]): Map<number, { x: number; y: number }> {
  const W = 780, H = 460
  const cols = Math.ceil(Math.sqrt(cities.length * (W / H)))
  const rows = Math.ceil(cities.length / cols)
  const xStep = W / (cols + 1)
  const yStep = H / (rows + 1)

  const positions = new Map<number, { x: number; y: number }>()
  cities.forEach((city, i) => {
    const col = (i % cols) + 1
    const row = Math.floor(i / cols) + 1
    // Slight jitter so it doesn't look like a pure grid
    const jx = ((city.id * 37) % 20) - 10
    const jy = ((city.id * 53) % 20) - 10
    positions.set(city.id, { x: col * xStep + jx, y: row * yStep + jy })
  })
  return positions
}

export default function SvgMap({ cities, roads, playerTokens, selectedCityId, onCityClick }: SvgMapProps) {
  const positions = useMemo(() => layoutCities(cities), [cities])

  if (cities.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-500 text-sm italic">
        Map not yet generated — start the game to see the board.
      </div>
    )
  }

  return (
    <svg
      viewBox="0 0 800 480"
      className="w-full h-full"
      style={{ background: '#1c1917' }}
    >
      {/* Roads */}
      {roads.map((road, i) => {
        const a = positions.get(road.fromCityId)
        const b = positions.get(road.toCityId)
        if (!a || !b) return null
        return (
          <line
            key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#57534e" strokeWidth="1.5" strokeOpacity="0.7"
          />
        )
      })}

      {/* City nodes */}
      {cities.map(city => {
        const pos = positions.get(city.id)
        if (!pos) return null
        const isSelected = selectedCityId === city.id
        const fill = city.ownerColor ?? '#78716c'
        return (
          <g
            key={city.id}
            onClick={() => onCityClick?.(city.id)}
            style={{ cursor: onCityClick ? 'pointer' : 'default' }}
          >
            <circle
              cx={pos.x} cy={pos.y} r={isSelected ? 14 : 10}
              fill={fill}
              stroke={isSelected ? '#fbbf24' : '#d4a855'}
              strokeWidth={isSelected ? 3 : 1.5}
            />
            <text
              x={pos.x} y={pos.y + 22}
              textAnchor="middle"
              fill="#d4a855"
              fontSize="9"
              fontFamily="sans-serif"
            >
              {city.name.length > 12 ? city.name.slice(0, 11) + '…' : city.name}
            </text>
          </g>
        )
      })}

      {/* Player tokens — small circles offset from city centre */}
      {playerTokens.map((token, i) => {
        const pos = positions.get(token.cityId)
        if (!pos) return null
        const offsetX = (i % 3 - 1) * 10
        const offsetY = -14
        return (
          <circle
            key={token.playerId}
            cx={pos.x + offsetX} cy={pos.y + offsetY} r={5}
            fill={token.color}
            stroke={token.isMe ? '#fff' : '#555'}
            strokeWidth={token.isMe ? 2 : 1}
          />
        )
      })}
    </svg>
  )
}
