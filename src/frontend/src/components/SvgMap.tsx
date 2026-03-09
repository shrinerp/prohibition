import React, { useMemo } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import usAtlasRaw from 'us-atlas/states-10m.json'

const usAtlas = usAtlasRaw as unknown as Topology<{
  states: GeometryCollection
  nation: GeometryCollection
}>

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
  currentCityId?: number | null
  selectedCityId?: number | null
  reachableCityIds?: Set<number> | null
  onCityClick?: (cityId: number) => void
}

const SVG_W = 800
const SVG_H = 480
const PAD  = 20

// Pre-compute once at module load — these never change
const statesGeo  = feature(usAtlas, usAtlas.objects.states)
const nationGeo  = feature(usAtlas, usAtlas.objects.nation)
const stateMesh  = mesh(usAtlas, usAtlas.objects.states, (a, b) => a !== b)

const projection = geoAlbersUsa().fitExtent(
  [[PAD, PAD], [SVG_W - PAD, SVG_H - PAD]],
  statesGeo
)
const pathGen    = geoPath().projection(projection)

const NATION_D = pathGen(nationGeo) ?? ''
const STATES_D = pathGen(stateMesh)  ?? ''

function project(lat: number, lon: number): { x: number; y: number } | null {
  const coords = projection([lon, lat])
  return coords ? { x: coords[0], y: coords[1] } : null
}

export default function SvgMap({ cities, roads, playerTokens, currentCityId, selectedCityId, reachableCityIds, onCityClick }: SvgMapProps) {
  const positions = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>()
    for (const city of cities) {
      const pos = project(city.lat, city.lon)
      if (pos) map.set(city.id, pos)
    }
    return map
  }, [cities])

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-full"
      style={{ background: '#1c1917' }}
    >
      {/* Water / ocean fill behind land */}
      <rect width={SVG_W} height={SVG_H} fill="#1c1917" />

      {/* Land fill */}
      <path d={NATION_D} fill="#292524" />

      {/* State borders */}
      <path d={STATES_D} fill="none" stroke="#44403c" strokeWidth="0.8" />

      {/* Roads */}
      {roads.map((road, i) => {
        const a = positions.get(road.fromCityId)
        const b = positions.get(road.toCityId)
        if (!a || !b) return null
        return (
          <line
            key={i}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="#78716c" strokeWidth="1.2" strokeOpacity="0.6"
          />
        )
      })}

      {/* City nodes */}
      {cities.map(city => {
        const pos = positions.get(city.id)
        if (!pos) return null
        const isSelected  = selectedCityId === city.id
        const isCurrent   = currentCityId  === city.id
        const isReachable = reachableCityIds?.has(city.id) ?? false
        const inMoveMode  = reachableCityIds !== null && reachableCityIds !== undefined
        const isUnreachable = inMoveMode && !isReachable && !isCurrent && !isSelected

        const fill = city.ownerColor ?? '#78716c'
        const r = isSelected ? 13 : 9
        return (
          <g
            key={city.id}
            onClick={() => onCityClick?.(city.id)}
            style={{ cursor: isReachable && onCityClick ? 'pointer' : 'default' }}
            opacity={isUnreachable ? 0.3 : 1}
          >
            {/* Reachable glow ring */}
            {isReachable && (
              <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeOpacity="0.7" />
            )}
            {/* "You are here" ring */}
            {isCurrent && (
              <circle cx={pos.x} cy={pos.y} r={r + 7} fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.5" />
            )}
            <circle
              cx={pos.x} cy={pos.y} r={r}
              fill={fill}
              stroke={isSelected ? '#fbbf24' : isCurrent ? '#ffffff' : isReachable ? '#4ade80' : '#d4a855'}
              strokeWidth={isSelected || isCurrent ? 2.5 : isReachable ? 2 : 1.5}
            />
            <text
              x={pos.x} y={pos.y + 19}
              textAnchor="middle"
              fill={isCurrent ? '#ffffff' : isReachable ? '#86efac' : '#e7d5a8'}
              fontSize="7.5"
              fontFamily="sans-serif"
              fontWeight={isCurrent || isReachable ? 'bold' : 'normal'}
              style={{ pointerEvents: 'none' }}
            >
              {city.name.length > 13 ? city.name.slice(0, 12) + '…' : city.name}
            </text>
          </g>
        )
      })}

      {/* Player tokens — small circles offset above their city */}
      {playerTokens.map((token, i) => {
        const pos = positions.get(token.cityId)
        if (!pos) return null
        const offsetX = (i % 3 - 1) * 10
        return (
          <circle
            key={token.playerId}
            cx={pos.x + offsetX} cy={pos.y - 14} r={5}
            fill={token.color}
            stroke={token.isMe ? '#fff' : '#555'}
            strokeWidth={token.isMe ? 2 : 1}
          />
        )
      })}
    </svg>
  )
}
