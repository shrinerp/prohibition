import React, { useMemo } from 'react'

export interface CityNode {
  id: number
  name: string
  lat: number
  lon: number
  ownerColor?: string
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

// Continental US bounds
const LAT_MAX = 49.5
const LAT_MIN = 24.5
const LON_MIN = -125.0
const LON_MAX = -66.5

// SVG viewport with padding
const SVG_W = 800
const SVG_H = 480
const PAD = 30

function project(lat: number, lon: number): { x: number; y: number } {
  const x = PAD + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (SVG_W - PAD * 2)
  const y = PAD + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (SVG_H - PAD * 2)
  return { x, y }
}

export default function SvgMap({ cities, roads, playerTokens, selectedCityId, onCityClick }: SvgMapProps) {
  const positions = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>()
    for (const city of cities) {
      map.set(city.id, project(city.lat, city.lon))
    }
    return map
  }, [cities])

  if (cities.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-stone-500 text-sm italic">
        Map not yet generated — start the game to see the board.
      </div>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
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
              x={pos.x} y={pos.y + 20}
              textAnchor="middle"
              fill="#d4a855"
              fontSize="8"
              fontFamily="sans-serif"
            >
              {city.name.length > 12 ? city.name.slice(0, 11) + '…' : city.name}
            </text>
          </g>
        )
      })}

      {/* Player tokens — small circles offset above city */}
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
