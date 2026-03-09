import { describe, it, expect } from 'vitest'
import { buildGraph, getShortestPath, isConnected, generateRoads, type CityNode } from '../src/game/mapEngine'

const CITIES: CityNode[] = [
  { id: 1, name: 'Chicago',       region: 'Midwest',     primaryAlcohol: 'beer',    demandIndex: 1.0, isCoastal: false, populationTier: 'major', lat: 41.85, lon: -87.65 },
  { id: 2, name: 'New York City', region: 'East Coast',  primaryAlcohol: 'gin',     demandIndex: 1.5, isCoastal: true,  populationTier: 'major', lat: 40.71, lon: -74.01 },
  { id: 3, name: 'Detroit',       region: 'Midwest',     primaryAlcohol: 'whiskey', demandIndex: 1.0, isCoastal: true,  populationTier: 'large', lat: 42.33, lon: -83.05 },
  { id: 4, name: 'New Orleans',   region: 'South',       primaryAlcohol: 'rum',     demandIndex: 1.2, isCoastal: true,  populationTier: 'large', lat: 29.95, lon: -90.07 },
  { id: 5, name: 'San Francisco', region: 'West Coast',  primaryAlcohol: 'whiskey', demandIndex: 1.3, isCoastal: true,  populationTier: 'large', lat: 37.77, lon: -122.42 }
]

const ROADS = [
  { fromCityId: 1, toCityId: 2, distanceValue: 10 },
  { fromCityId: 1, toCityId: 3, distanceValue: 5 },
  { fromCityId: 2, toCityId: 3, distanceValue: 8 },
  { fromCityId: 3, toCityId: 4, distanceValue: 12 },
  { fromCityId: 4, toCityId: 5, distanceValue: 15 },
]

describe('buildGraph()', () => {
  it('builds adjacency map from cities and roads', () => {
    const graph = buildGraph(CITIES, ROADS)
    expect(graph.nodes.size).toBe(5)
    expect(graph.adjacency.get(1)).toBeDefined()
    expect(graph.adjacency.get(1)!.length).toBe(2) // connects to 2 and 3
  })

  it('edges are bidirectional', () => {
    const graph = buildGraph(CITIES, ROADS)
    const from1 = graph.adjacency.get(1)!.map(e => e.targetId)
    const from2 = graph.adjacency.get(2)!.map(e => e.targetId)
    expect(from1).toContain(2)
    expect(from2).toContain(1)
  })
})

describe('isConnected()', () => {
  it('returns true for a connected graph', () => {
    const graph = buildGraph(CITIES, ROADS)
    expect(isConnected(graph)).toBe(true)
  })

  it('returns false when a node is isolated', () => {
    const isolated = [...CITIES, { id: 6, name: 'Isolated', region: 'West', primaryAlcohol: 'vodka', demandIndex: 1.0, isCoastal: false, populationTier: 'small' as const, lat: 39.0, lon: -105.0 }]
    const graph = buildGraph(isolated, ROADS) // no road connects id=6
    expect(isConnected(graph)).toBe(false)
  })
})

describe('getShortestPath()', () => {
  it('returns the shortest path between two connected cities', () => {
    const graph = buildGraph(CITIES, ROADS)
    const { path, totalCost } = getShortestPath(graph, 1, 4)
    expect(path).toContain(1)
    expect(path).toContain(4)
    expect(totalCost).toBeGreaterThan(0)
  })

  it('returns null path when cities are not connected', () => {
    const graph = buildGraph(CITIES, []) // no roads
    const { path } = getShortestPath(graph, 1, 2)
    expect(path).toBeNull()
  })

  it('returns empty path when from === to', () => {
    const graph = buildGraph(CITIES, ROADS)
    const { path, totalCost } = getShortestPath(graph, 1, 1)
    expect(path).toEqual([1])
    expect(totalCost).toBe(0)
  })
})

describe('generateRoads()', () => {
  it('generates roads resulting in a connected graph', () => {
    const graph = buildGraph(CITIES, generateRoads(CITIES))
    expect(isConnected(graph)).toBe(true)
  })

  it('road costs are between 2 and 12', () => {
    const roads = generateRoads(CITIES)
    for (const road of roads) {
      expect(road.distanceValue).toBeGreaterThanOrEqual(2)
      expect(road.distanceValue).toBeLessThanOrEqual(12)
    }
  })

  it('generates at least n-1 roads for n cities (spanning tree)', () => {
    const roads = generateRoads(CITIES)
    expect(roads.length).toBeGreaterThanOrEqual(CITIES.length - 1)
  })
})
