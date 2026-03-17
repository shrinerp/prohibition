import React, { useMemo } from 'react'
import { geoAlbersUsa, geoPath } from 'd3-geo'
import { feature, mesh, merge } from 'topojson-client'
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
  transparent?: boolean
  playerTokens: PlayerToken[]
  currentCityId?: number | null
  homeCityId?: number | null
  selectedCityId?: number | null
  reachableCityIds?: Set<number> | null
  pathCityIds?: Set<number> | null
  cityStockpiles?: Map<number, number>
  onCityClick?: (cityId: number) => void
}

const SVG_W = 800
const SVG_H = 480
const PAD  = 20

// Pre-compute once at module load — continental US only (exclude Alaska=2, Hawaii=15)
const EXCLUDE_FIPS = new Set([2, 15])
const continentalGeometries = {
  ...usAtlas.objects.states,
  geometries: usAtlas.objects.states.geometries.filter(g => !EXCLUDE_FIPS.has(Number(g.id)))
}
const statesGeo = feature(usAtlas, continentalGeometries)
const nationGeo = merge(usAtlas, continentalGeometries.geometries as any)
const stateMesh = mesh(usAtlas, continentalGeometries, (a, b) => a !== b)

const projection = geoAlbersUsa().fitExtent(
  [[PAD, PAD], [SVG_W - PAD, SVG_H - PAD]],
  statesGeo
)
const pathGen = geoPath().projection(projection)

const NATION_D = pathGen(nationGeo) ?? ''
const STATES_D = pathGen(stateMesh) ?? ''

function project(lat: number, lon: number): { x: number; y: number } | null {
  const coords = projection([lon, lat])
  return coords ? { x: coords[0], y: coords[1] } : null
}

export default function SvgMap({ cities, roads, playerTokens, currentCityId, homeCityId, selectedCityId, reachableCityIds, pathCityIds, cityStockpiles, onCityClick, transparent }: SvgMapProps) {
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
      style={{ background: transparent ? 'transparent' : '#1c1917' }}
    >
      {/* Water / ocean fill behind land */}
      {!transparent && <rect width={SVG_W} height={SVG_H} fill="#1c1917" />}

      {/* Land fill */}
      <path d={NATION_D} fill="#292524" fillOpacity={transparent ? 0.7 : 1} />

      {/* Outer nation border */}
      <path d={NATION_D} fill="none" stroke={transparent ? '#d6c9a8' : '#6b6360'} strokeWidth={transparent ? 1.5 : 1} strokeOpacity={transparent ? 0.8 : 0.6} />

      {/* State borders */}
      <path d={STATES_D} fill="none" stroke={transparent ? '#ffffff' : '#44403c'} strokeWidth={transparent ? 1.2 : 0.8} strokeOpacity={transparent ? 0.6 : 1} />

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
        const isSelected    = selectedCityId === city.id
        const isCurrent     = currentCityId  === city.id
        const isHome        = homeCityId     === city.id
        const isReachable   = reachableCityIds?.has(city.id) ?? false
        const isOnPath      = pathCityIds?.has(city.id) ?? false
        const inMoveMode    = reachableCityIds !== null && reachableCityIds !== undefined
        const isUnreachable = inMoveMode && !isReachable && !isCurrent && !isOnPath && !isHome

        const fill = city.ownerColor ?? '#78716c'
        const r = isSelected ? 13 : 9
        const borderColor = isSelected  ? '#fbbf24'
                          : isOnPath    ? '#fb923c'
                          : isCurrent   ? '#ffffff'
                          : isReachable ? '#4ade80'
                          :               '#d4a855'
        const labelColor  = isCurrent   ? '#ffffff'
                          : isOnPath    ? '#fdba74'
                          : isReachable ? '#86efac'
                          :               '#e7d5a8'
        return (
          <g
            key={city.id}
            onClick={() => onCityClick?.(city.id)}
            style={{ cursor: 'pointer' }}
            opacity={isUnreachable ? 0.3 : 1}
          >
            {/* Path / destination glow ring */}
            {isOnPath && !isSelected && (
              <circle cx={pos.x} cy={pos.y} r={r + 5} fill="none" stroke="#fb923c" strokeWidth="1.5" strokeOpacity="0.7" />
            )}
            {isSelected && (
              <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke="#fbbf24" strokeWidth="2" strokeOpacity="0.8" />
            )}
            {/* Reachable glow ring */}
            {isReachable && !isOnPath && !isSelected && (
              <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeOpacity="0.7" />
            )}
            {/* Home base ring — amber dashed */}
            {isHome && (
              <circle cx={pos.x} cy={pos.y} r={r + 9} fill="none" stroke="#f59e0b" strokeWidth="1.5"
                strokeDasharray="3 2" strokeOpacity="0.9" />
            )}
            {/* "You are here" ring */}
            {isCurrent && (
              <circle cx={pos.x} cy={pos.y} r={r + 7} fill="none" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.5" />
            )}
            <circle
              cx={pos.x} cy={pos.y} r={r}
              fill={fill}
              stroke={borderColor}
              strokeWidth={isSelected || isCurrent || isOnPath ? 2.5 : isReachable ? 2 : 1.5}
            />
            <text
              x={pos.x} y={pos.y + 19}
              textAnchor="middle"
              fill={labelColor}
              fontSize="7.5"
              fontFamily="sans-serif"
              fontWeight={isCurrent || isReachable || isOnPath || isHome ? 'bold' : 'normal'}
              style={{ pointerEvents: 'none' }}
            >
              {city.name.length > 13 ? city.name.slice(0, 12) + '…' : city.name}
            </text>
            {isHome && (
              <text x={pos.x} y={pos.y + 27} textAnchor="middle"
                fill="#f59e0b" fontSize="6" fontFamily="sans-serif" style={{ pointerEvents: 'none' }}>
                ⌂ HOME
              </text>
            )}
            {/* Stockpile badge */}
            {(cityStockpiles?.get(city.id) ?? 0) > 0 && (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={pos.x + 4} y={pos.y - r - 8} width={14} height={9} rx={2}
                  fill="#14532d" stroke="#4ade80" strokeWidth="0.8" />
                <text x={pos.x + 11} y={pos.y - r - 1.5} textAnchor="middle"
                  fill="#86efac" fontSize="5.5" fontFamily="sans-serif" fontWeight="bold">
                  {cityStockpiles!.get(city.id)}
                </text>
              </g>
            )}
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
