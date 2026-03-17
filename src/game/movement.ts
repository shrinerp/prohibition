import { applyMovementModifier } from './characters'

export interface Vehicle {
  id: string
  name: string
  movementMultiplier: number
  cargoSlots: number
}

export const VEHICLE_PRICES: Record<string, number> = {
  workhorse:      200,
  roadster:       500,
  truck:          700,
  whiskey_runner: 900,
}

export const VEHICLES: Record<string, Vehicle> = {
  roadster: {
    id: 'roadster',
    name: 'Roadster',
    movementMultiplier: 1.2,
    cargoSlots: 10
  },
  truck: {
    id: 'truck',
    name: 'Truck',
    movementMultiplier: 0.8,
    cargoSlots: 28
  },
  workhorse: {
    id: 'workhorse',
    name: 'Workhorse (Model T)',
    movementMultiplier: 1.0,
    cargoSlots: 16
  },
  whiskey_runner: {
    id: 'whiskey_runner',
    name: 'Whiskey Runner (Motorcycle)',
    movementMultiplier: 1.5,
    cargoSlots: 6
  }
}

export interface RoadSegment {
  fromCityId: number
  toCityId: number
  distanceValue: number
}

export interface MovementResult {
  arrived: boolean
  currentCityId: number
  traversedCities: number[]
  remainingPoints: number
}

/** Roll 2d6 server-side */
export function rollDice(): number {
  return Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6)
}

/** Apply vehicle multiplier to a base roll (floor result) */
export function applyVehicleModifier(roll: number, vehicleId: string): number {
  const vehicle = VEHICLES[vehicleId]
  if (!vehicle) return roll
  return Math.floor(roll * vehicle.movementMultiplier)
}

/**
 * Resolve a player's movement along a declared path.
 * @param fromCityId    — starting city
 * @param targetPath    — ordered list of city IDs to traverse (not including start)
 * @param roads         — all roads in the game
 * @param totalPoints   — effective movement points after vehicle + character modifiers
 */
export function resolveMovement(
  fromCityId: number,
  targetPath: number[],
  roads: RoadSegment[],
  totalPoints: number
): MovementResult {
  // Build bidirectional lookup: "fromId-toId" → cost
  const roadCost = new Map<string, number>()
  for (const r of roads) {
    roadCost.set(`${r.fromCityId}-${r.toCityId}`, r.distanceValue)
    roadCost.set(`${r.toCityId}-${r.fromCityId}`, r.distanceValue)
  }

  let remaining = totalPoints
  let current = fromCityId
  const traversed: number[] = []
  let arrived = false

  for (const nextCity of targetPath) {
    const cost = roadCost.get(`${current}-${nextCity}`)
    if (cost === undefined || remaining < cost) {
      // Can't afford this hop — stop here
      break
    }
    remaining -= cost
    current = nextCity
    traversed.push(nextCity)

    if (nextCity === targetPath[targetPath.length - 1]) {
      arrived = true
    }
  }

  return {
    arrived,
    currentCityId: current,
    traversedCities: traversed,
    remainingPoints: remaining
  }
}

/**
 * Returns player IDs of opponents whose current city appears in the traversed path.
 * Used to surface Double Cross opportunities.
 */
export function detectIntercepts(
  traversedCities: number[],
  playerPositions: Map<number, number>, // playerId → cityId
  movingPlayerId: number
): number[] {
  const intercepted: number[] = []
  const traversedSet = new Set(traversedCities)

  for (const [playerId, cityId] of playerPositions) {
    if (playerId === movingPlayerId) continue
    if (traversedSet.has(cityId)) {
      intercepted.push(playerId)
    }
  }

  return intercepted
}

/**
 * Calculate effective movement points for a player's roll.
 * Applies character class modifiers (Bootlegger +2, Hillbilly -10%) and vehicle multiplier.
 */
export function calculateEffectiveMovement(
  diceRoll: number,
  characterClass: string,
  vehicleId: string
): number {
  const afterCharacter = applyMovementModifier(characterClass, diceRoll)
  return applyVehicleModifier(afterCharacter, vehicleId)
}
