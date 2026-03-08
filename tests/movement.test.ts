import { describe, it, expect, vi } from 'vitest'
import {
  rollDice,
  applyVehicleModifier,
  resolveMovement,
  detectIntercepts,
  VEHICLES,
  type MovementResult
} from '../src/game/movement'

describe('rollDice()', () => {
  it('returns sum of two dice (2-12)', () => {
    for (let i = 0; i < 50; i++) {
      const roll = rollDice()
      expect(roll).toBeGreaterThanOrEqual(2)
      expect(roll).toBeLessThanOrEqual(12)
    }
  })
})

describe('VEHICLES', () => {
  it('defines all 4 vehicle types', () => {
    expect(VEHICLES.roadster).toBeDefined()
    expect(VEHICLES.truck).toBeDefined()
    expect(VEHICLES.workhorse).toBeDefined()
    expect(VEHICLES.whiskey_runner).toBeDefined()
  })

  it('roadster has 1.2x movement and low cargo', () => {
    expect(VEHICLES.roadster.movementMultiplier).toBeCloseTo(1.2)
    expect(VEHICLES.roadster.cargoSlots).toBeLessThan(VEHICLES.workhorse.cargoSlots)
  })

  it('truck has 0.8x movement and high cargo', () => {
    expect(VEHICLES.truck.movementMultiplier).toBeCloseTo(0.8)
    expect(VEHICLES.truck.cargoSlots).toBeGreaterThan(VEHICLES.workhorse.cargoSlots)
  })

  it('whiskey runner has 1.5x movement and very low cargo', () => {
    expect(VEHICLES.whiskey_runner.movementMultiplier).toBeCloseTo(1.5)
    expect(VEHICLES.whiskey_runner.cargoSlots).toBeLessThan(VEHICLES.roadster.cargoSlots)
  })
})

describe('applyVehicleModifier()', () => {
  it('multiplies roll by vehicle modifier and floors it', () => {
    expect(applyVehicleModifier(10, 'roadster')).toBe(12)  // 10 * 1.2 = 12
    expect(applyVehicleModifier(10, 'truck')).toBe(8)       // 10 * 0.8 = 8
    expect(applyVehicleModifier(10, 'workhorse')).toBe(10)  // 10 * 1.0 = 10
  })
})

describe('resolveMovement()', () => {
  // Simple 3-city path: 1 --(cost 5)--> 2 --(cost 6)--> 3
  const roads = [
    { fromCityId: 1, toCityId: 2, distanceValue: 5 },
    { fromCityId: 2, toCityId: 3, distanceValue: 6 }
  ]

  it('reaches destination when roll >= path cost', () => {
    // roll=12, path cost=5, arrives at 2 with 7 remaining (forfeited)
    const result = resolveMovement(1, [2], roads, 12)
    expect(result.arrived).toBe(true)
    expect(result.currentCityId).toBe(2)
  })

  it('cannot move when roll < first road cost', () => {
    const result = resolveMovement(1, [2], roads, 3) // needs 5, has 3
    expect(result.arrived).toBe(false)
    expect(result.currentCityId).toBe(1)
  })

  it('follows multi-hop path when roll is sufficient', () => {
    const result = resolveMovement(1, [2, 3], roads, 12) // 5+6=11 ≤ 12
    expect(result.arrived).toBe(true)
    expect(result.currentCityId).toBe(3)
  })

  it('stops at last affordable city on path when roll is insufficient for full route', () => {
    const result = resolveMovement(1, [2, 3], roads, 7) // can afford hop to 2 (5), not to 3 (needs 11)
    expect(result.arrived).toBe(false)
    expect(result.currentCityId).toBe(2)
  })

  it('includes all traversed cities in the path', () => {
    const result = resolveMovement(1, [2, 3], roads, 12)
    expect(result.traversedCities).toContain(2)
    expect(result.traversedCities).toContain(3)
  })
})

describe('detectIntercepts()', () => {
  it('returns cities where other players are present along traversed path', () => {
    const playerPositions = new Map([[99, 2], [88, 5]]) // player 99 is in city 2
    const intercepts = detectIntercepts([1, 2, 3], playerPositions, 1)
    expect(intercepts).toContain(99)
    expect(intercepts).not.toContain(88)
  })

  it('does not include the moving player themselves', () => {
    const playerPositions = new Map([[1, 2]]) // moving player is player 1
    const intercepts = detectIntercepts([1, 2, 3], playerPositions, 1)
    expect(intercepts).toHaveLength(0)
  })

  it('returns empty when no players are in traversed cities', () => {
    const playerPositions = new Map([[99, 9]])
    const intercepts = detectIntercepts([1, 2, 3], playerPositions, 42)
    expect(intercepts).toHaveLength(0)
  })
})
