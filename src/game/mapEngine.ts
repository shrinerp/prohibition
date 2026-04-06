export interface CityNode {
  id: number
  name: string
  region: string
  primaryAlcohol: string
  demandIndex: number
  isCoastal: boolean
  populationTier: 'small' | 'medium' | 'large' | 'major'
  lat: number
  lon: number
  ownerId?: number | null
  bribePlayerId?: number | null
  bribeExpiresSeason?: number | null
}

export interface Road {
  fromCityId: number
  toCityId: number
  distanceValue: number
}

export interface GraphEdge {
  targetId: number
  distanceValue: number
}

export interface CityGraph {
  nodes: Map<number, CityNode>
  adjacency: Map<number, GraphEdge[]>
}

export function buildGraph(cities: CityNode[], roads: Road[]): CityGraph {
  const nodes = new Map<number, CityNode>()
  const adjacency = new Map<number, GraphEdge[]>()

  for (const city of cities) {
    nodes.set(city.id, city)
    adjacency.set(city.id, [])
  }

  for (const road of roads) {
    adjacency.get(road.fromCityId)?.push({ targetId: road.toCityId, distanceValue: road.distanceValue })
    adjacency.get(road.toCityId)?.push({ targetId: road.fromCityId, distanceValue: road.distanceValue })
  }

  return { nodes, adjacency }
}

export function isConnected(graph: CityGraph): boolean {
  if (graph.nodes.size === 0) return true
  const start = graph.nodes.keys().next().value as number
  const visited = new Set<number>()
  const queue = [start]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    for (const edge of graph.adjacency.get(current) ?? []) {
      if (!visited.has(edge.targetId)) queue.push(edge.targetId)
    }
  }

  return visited.size === graph.nodes.size
}

export function getShortestPath(graph: CityGraph, fromId: number, toId: number): { path: number[] | null; totalCost: number } {
  if (fromId === toId) return { path: [fromId], totalCost: 0 }

  const dist = new Map<number, number>()
  const prev = new Map<number, number>()
  const unvisited = new Set<number>()

  for (const id of graph.nodes.keys()) {
    dist.set(id, Infinity)
    unvisited.add(id)
  }
  dist.set(fromId, 0)

  while (unvisited.size > 0) {
    // Pick unvisited node with smallest distance
    let current: number | null = null
    let minDist = Infinity
    for (const id of unvisited) {
      const d = dist.get(id) ?? Infinity
      if (d < minDist) { minDist = d; current = id }
    }

    if (current === null || minDist === Infinity) break
    if (current === toId) break
    unvisited.delete(current)

    for (const edge of graph.adjacency.get(current) ?? []) {
      if (!unvisited.has(edge.targetId)) continue
      const alt = (dist.get(current) ?? Infinity) + edge.distanceValue
      if (alt < (dist.get(edge.targetId) ?? Infinity)) {
        dist.set(edge.targetId, alt)
        prev.set(edge.targetId, current)
      }
    }
  }

  if (!prev.has(toId) && fromId !== toId) return { path: null, totalCost: 0 }

  // Reconstruct path
  const path: number[] = []
  let step: number | undefined = toId
  while (step !== undefined) {
    path.unshift(step)
    step = prev.get(step)
  }

  return { path, totalCost: dist.get(toId) ?? 0 }
}

/**
 * Generate roads using K-nearest geographic neighbours.
 * Each city connects to its 4 closest cities by lat/lon distance,
 * with road cost scaled from geographic distance (2–12 game points).
 * A connectivity pass ensures no city is isolated.
 */
export function generateRoads(cities: CityNode[]): Road[] {
  if (cities.length === 0) return []

  const seen = new Set<string>()
  const roads: Road[] = []

  function edgeKey(a: number, b: number) {
    return `${Math.min(a, b)}-${Math.max(a, b)}`
  }

  function geoDist(a: CityNode, b: CityNode): number {
    const dlat = a.lat - b.lat
    const dlon = (a.lon - b.lon) * Math.cos((a.lat + b.lat) * Math.PI / 360)
    return Math.sqrt(dlat * dlat + dlon * dlon)
  }

  // Furthest reasonable pair in the continental US ≈ 48 degrees (Miami→Seattle)
  const MAX_GEO = 48

  function gameDistance(geo: number): number {
    return Math.max(2, Math.min(12, Math.round(geo / MAX_GEO * 10 + 2)))
  }

  function addRoad(a: CityNode, b: CityNode) {
    const k = edgeKey(a.id, b.id)
    if (seen.has(k)) return
    seen.add(k)
    roads.push({ fromCityId: a.id, toCityId: b.id, distanceValue: gameDistance(geoDist(a, b)) })
  }

  // For each city, connect to its 4 nearest neighbours
  const K = 4
  for (const city of cities) {
    const sorted = cities
      .filter(c => c.id !== city.id)
      .map(c => ({ city: c, dist: geoDist(city, c) }))
      .sort((a, b) => a.dist - b.dist)

    for (let i = 0; i < Math.min(K, sorted.length); i++) {
      addRoad(city, sorted[i].city)
    }
  }

  // Connectivity repair: BFS from the first city to find the reachable set,
  // then connect every unreachable city to its nearest reachable city in turn.
  // Adding each isolated city to the reachable set as we go handles multiple
  // disconnected components in a single linear pass.
  const cityById = new Map(cities.map(c => [c.id, c]))

  const roadAdj = new Map<number, Set<number>>()
  for (const c of cities) roadAdj.set(c.id, new Set())
  for (const r of roads) {
    roadAdj.get(r.fromCityId)?.add(r.toCityId)
    roadAdj.get(r.toCityId)?.add(r.fromCityId)
  }

  const reachable = new Set<number>()
  const bfsQ = [cities[0].id]
  while (bfsQ.length > 0) {
    const cur = bfsQ.shift()!
    if (reachable.has(cur)) continue
    reachable.add(cur)
    for (const nb of roadAdj.get(cur) ?? []) bfsQ.push(nb)
  }

  for (const city of cities) {
    if (reachable.has(city.id)) continue
    // Find nearest already-reachable city
    let bestCity: CityNode | null = null
    let bestDist = Infinity
    for (const id of reachable) {
      const d = geoDist(city, cityById.get(id)!)
      if (d < bestDist) { bestDist = d; bestCity = cityById.get(id)! }
    }
    if (bestCity) {
      addRoad(city, bestCity)
      reachable.add(city.id)   // now reachable — subsequent orphans can connect here
    }
  }

  return roads
}

function randomCost(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}
