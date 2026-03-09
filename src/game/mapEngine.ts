export interface CityNode {
  id: number
  name: string
  region: string
  primaryAlcohol: string
  demandIndex: number
  isCoastal: boolean
  populationTier: 'small' | 'medium' | 'large' | 'major'
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

// Generate roads using a minimum spanning tree (Kruskal-inspired) + extra regional edges
export function generateRoads(cities: CityNode[]): Road[] {
  if (cities.length === 0) return []

  const roads: Road[] = []
  const regionGroups = new Map<string, CityNode[]>()

  for (const city of cities) {
    if (!regionGroups.has(city.region)) regionGroups.set(city.region, [])
    regionGroups.get(city.region)!.push(city)
  }

  // Connect cities within each region (chain)
  for (const group of regionGroups.values()) {
    for (let i = 0; i < group.length - 1; i++) {
      roads.push({
        fromCityId: group[i].id,
        toCityId: group[i + 1].id,
        distanceValue: randomCost(2, 5) // short regional hops
      })
    }
  }

  // Connect regions together (one bridge per adjacent region pair)
  const regionList = Array.from(regionGroups.entries())
  for (let i = 0; i < regionList.length - 1; i++) {
    const [, groupA] = regionList[i]
    const [, groupB] = regionList[i + 1]
    const a = groupA[Math.floor(Math.random() * groupA.length)]
    const b = groupB[Math.floor(Math.random() * groupB.length)]
    roads.push({
      fromCityId: a.id,
      toCityId: b.id,
      distanceValue: randomCost(8, 12) // longer cross-region routes
    })
  }

  // Deduplicate
  const seen = new Set<string>()
  return roads.filter(r => {
    const key = [Math.min(r.fromCityId, r.toCityId), Math.max(r.fromCityId, r.toCityId)].join('-')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function randomCost(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}
