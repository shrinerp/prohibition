import { getUpgradeCost, DISTILLERY_TIERS } from './production'
import { VEHICLES, calculateEffectiveMovement } from './movement'
import {
  rollPoliceEncounter, resolveBribe, resolveSubmit, resolveRun,
  calculateSpotBribeCost, type PopulationTier,
} from './police'

export type NpcArchetype = 'npc_merchant' | 'npc_expander' | 'npc_industrialist' | 'npc_syndicate'

// ── Legacy pure-logic exports (used by unit tests) ──────────────────────────

export type NpcAction = 'upgrade' | 'buy_city' | 'double_cross' | 'sell'

export interface NpcState {
  playerId: number
  characterClass: string
  cash: number
  alcoholUnits: number
  distilleryTier: number
  stillCount: number
  ownedCityIds: number[]
  currentCityId: number
  isInJail: boolean
  heat: number
  season: number
}

export const NPC_PRIORITY: NpcAction[] = ['upgrade', 'buy_city', 'double_cross', 'sell']

export function applyWealthDecay(npc: NpcState): NpcState {
  if (npc.season > 0 && npc.season % 4 === 0) {
    return { ...npc, cash: Math.floor(npc.cash * 0.7) }
  }
  return npc
}

export function selectNpcAction(
  npc: NpcState,
  canUpgrade: boolean,
  canBuyCity: boolean,
  canIntercept = false
): NpcAction {
  if (npc.isInJail) return 'sell'
  if (canUpgrade) return 'upgrade'
  if (canBuyCity) return 'buy_city'
  if (canIntercept) return 'double_cross'
  return 'sell'
}

// ── BFS helpers ──────────────────────────────────────────────────────────────

interface RoadRow { from_city_id: number; to_city_id: number; distance_value: number }

interface ReachableCity { cityId: number; cost: number }

/**
 * Find all cities reachable from `startCityId` within `movementPoints` using
 * a simple Dijkstra expansion over all road segments.
 */
function findReachableCities(
  startCityId: number,
  roads: RoadRow[],
  movementPoints: number
): ReachableCity[] {
  const dist = new Map<number, number>([[startCityId, 0]])
  const queue: Array<{ cityId: number; cost: number }> = [{ cityId: startCityId, cost: 0 }]

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost)
    const { cityId, cost } = queue.shift()!
    if (cost > (dist.get(cityId) ?? Infinity)) continue

    for (const road of roads) {
      let neighbor: number | null = null
      if (road.from_city_id === cityId) neighbor = road.to_city_id
      else if (road.to_city_id === cityId) neighbor = road.from_city_id
      if (neighbor === null) continue

      const newCost = cost + road.distance_value
      if (newCost <= movementPoints && newCost < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, newCost)
        queue.push({ cityId: neighbor, cost: newCost })
      }
    }
  }

  const result: ReachableCity[] = []
  for (const [cityId, cost] of dist.entries()) {
    if (cityId !== startCityId) result.push({ cityId, cost })
  }
  return result
}

// ── Main NPC turn ────────────────────────────────────────────────────────────

/**
 * Main NPC turn function. Called from the auto-advance loop in games.ts
 * after a human player completes their turn.
 *
 * Flow: sell distillery stock → sell carried cargo → roll + move →
 *       claim city → set trap → sabotage → buy cargo → upgrade still
 */
export async function runNpcTurn(
  db: D1Database,
  gameId: string,
  npcId: number,
  season: number
): Promise<void> {
  const npcRow = await db.prepare(
    `SELECT cash, character_class, display_name, current_city_id, jail_until_season,
            role, jailed_count
     FROM game_players WHERE id = ?`
  ).bind(npcId).first<{
    cash: number; character_class: string; display_name: string | null
    current_city_id: number | null; jail_until_season: number | null
    role: string; jailed_count: number
  }>()
  if (!npcRow) return

  const archetype = npcRow.character_class as NpcArchetype
  const displayName = npcRow.display_name ?? 'An operator'
  const isInJail = npcRow.jail_until_season != null && season <= npcRow.jail_until_season

  // ── NPC snitch auto-recruitment ──────────────────────────────────────────
  // Threshold: last place by cash AND cash < $300 AND jailed_count > 0
  if ((npcRow.role ?? 'bootlegger') === 'bootlegger') {
    const wealthRank = await db.prepare(
      `SELECT id FROM game_players WHERE game_id = ? AND is_npc = 1 ORDER BY cash DESC`
    ).bind(gameId).all<{ id: number }>()
    const isLastNpc = wealthRank.results[wealthRank.results.length - 1]?.id === npcId
    if (isLastNpc && npcRow.cash < 300 && npcRow.jailed_count > 0) {
      await db.prepare(`UPDATE game_players SET role = 'snitch' WHERE id = ?`).bind(npcId).run()
      await db.batch([
        db.prepare(`INSERT INTO informants (game_id, snitch_id) VALUES (?, ?)`).bind(gameId, npcId),
        db.prepare(`INSERT INTO informants (game_id, snitch_id) VALUES (?, ?)`).bind(gameId, npcId),
        db.prepare(`INSERT INTO informants (game_id, snitch_id) VALUES (?, ?)`).bind(gameId, npcId),
        db.prepare(`INSERT INTO informants (game_id, snitch_id) VALUES (?, ?)`).bind(gameId, npcId),
      ])
      // Place informants in the largest nearby cities
      const { results: topCities } = await db.prepare(
        `SELECT gc.id FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
         WHERE gc.game_id = ? AND cp.population_tier IN ('large', 'major')
         ORDER BY cp.bribe_cost_multiplier DESC LIMIT 4`
      ).bind(gameId).all<{ id: number }>()
      const { results: npcInformants } = await db.prepare(
        `SELECT id FROM informants WHERE snitch_id = ? AND game_id = ?`
      ).bind(npcId, gameId).all<{ id: number }>()
      await db.batch(npcInformants.slice(0, topCities.length).map((inf, i) =>
        db.prepare(`UPDATE informants SET city_id = ?, placed_at = ? WHERE id = ?`)
          .bind(topCities[i].id, season, inf.id)
      ))
      return // snitch turn logic runs next turn
    }
  }

  // ── NPC snitch turn: file accusations if sightings match ─────────────────
  if ((npcRow.role ?? 'bootlegger') === 'snitch') {
    const sightingsRaw = await db.prepare(
      `SELECT pending_sightings FROM game_players WHERE id = ?`
    ).bind(npcId).first<{ pending_sightings: string | null }>()
    const sightings = sightingsRaw?.pending_sightings
      ? JSON.parse(sightingsRaw.pending_sightings) as Array<{ playerName: string; cityId: number; season: number }>
      : []

    if (sightings.length >= 2) {
      // Find a human player whose all vehicles appear in sightings
      const { results: humanPlayers } = await db.prepare(
        `SELECT id FROM game_players WHERE game_id = ? AND is_npc = 0 AND role = 'bootlegger'`
      ).bind(gameId).all<{ id: number }>()
      for (const target of humanPlayers) {
        const { results: targetVehicles } = await db.prepare(
          `SELECT id, city_id FROM vehicles WHERE player_id = ?`
        ).bind(target.id).all<{ id: number; city_id: number }>()
        const allPinned = targetVehicles.every(v =>
          sightings.some(s => s.cityId === v.city_id)
        )
        if (allPinned && targetVehicles.length > 0) {
          const alreadyAccused = await db.prepare(
            `SELECT id FROM snitch_accusations WHERE game_id = ? AND snitch_id = ? AND target_id = ? AND season = ?`
          ).bind(gameId, npcId, target.id, season).first()
          if (!alreadyAccused) {
            const cargoRows = await db.prepare(
              `SELECT COALESCE(SUM(vi.quantity), 0) AS total FROM vehicle_inventory vi JOIN vehicles v ON vi.vehicle_id = v.id WHERE v.player_id = ?`
            ).bind(target.id).first<{ total: number }>()
            const jailTime = Math.min(8, Math.max(1, 1 + Math.floor((cargoRows?.total ?? 0) / 4)))
            const targetNameRow = await db.prepare(
              `SELECT COALESCE(display_name, 'Someone') AS name FROM game_players WHERE id = ?`
            ).bind(target.id).first<{ name: string }>()
            const targetName = (targetNameRow?.name ?? 'Someone').replace(/@.*$/, '')
            await db.prepare(
              `INSERT INTO snitch_accusations (game_id, snitch_id, target_id, season, success) VALUES (?, ?, ?, ?, 1)`
            ).bind(gameId, npcId, target.id, season).run()
            await db.prepare(
              `UPDATE game_players SET jail_until_season = ?, jailed_count = jailed_count + 1 WHERE id = ?`
            ).bind(season + jailTime, target.id).run()
            await db.prepare(
              `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, NULL, ?, 1)`
            ).bind(gameId, `🕵️ An accusation was brought against ${targetName}. ${targetName} has been sent to jail by the feds.`).run()
          }
          break
        }
      }
    }
    return // snitch doesn't do normal bootlegger turn
  }

  // Step 1: Sell distillery stock (always)
  await sellAllDistilleryStock(db, gameId, npcId, season, displayName)

  if (isInJail) return

  // Step 2: Sell any cargo carried in vehicle
  await sellVehicleCargo(db, gameId, npcId, season, displayName)

  // Step 3: Roll dice and move
  const vehicle = await db.prepare(
    `SELECT id, city_id, vehicle_type FROM vehicles WHERE player_id = ? AND game_id = ? ORDER BY id LIMIT 1`
  ).bind(npcId, gameId).first<{ id: number; city_id: number; vehicle_type: string }>()

  if (!vehicle) {
    await tryUpgradeStill(db, gameId, npcId, archetype, displayName)
    return
  }

  const roll = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6)
  const movementPoints = calculateEffectiveMovement(roll, archetype, vehicle.vehicle_type)

  const { results: allRoads } = await db.prepare(
    `SELECT from_city_id, to_city_id, distance_value FROM roads WHERE game_id = ?`
  ).bind(gameId).all<RoadRow>()

  const reachable = findReachableCities(vehicle.city_id, allRoads, movementPoints)

  let destinationCityId = vehicle.city_id  // default: stay

  if (reachable.length > 0) {
    // Pick destination: expander prefers unclaimed/competitor cities; others random
    let chosen: ReachableCity

    if (archetype === 'npc_expander') {
      // Prefer neutral cities, then competitor cities, then random
      const cityInfo = await fetchCityOwnership(db, gameId, reachable.map(r => r.cityId))
      const neutral = reachable.filter(r => cityInfo.get(r.cityId) === null)
      const competitor = reachable.filter(r => {
        const owner = cityInfo.get(r.cityId)
        return owner !== null && owner !== npcId
      })
      if (neutral.length > 0) {
        chosen = neutral[Math.floor(Math.random() * neutral.length)]
      } else if (competitor.length > 0) {
        chosen = competitor[Math.floor(Math.random() * competitor.length)]
      } else {
        chosen = reachable[Math.floor(Math.random() * reachable.length)]
      }
    } else {
      chosen = reachable[Math.floor(Math.random() * reachable.length)]
    }

    destinationCityId = chosen.cityId

    await db.batch([
      db.prepare(`UPDATE vehicles SET city_id = ?, stationary_since = ? WHERE id = ?`)
        .bind(destinationCityId, season, vehicle.id),
      db.prepare(`UPDATE game_players SET current_city_id = ? WHERE id = ?`)
        .bind(destinationCityId, npcId),
    ])

    // Trap resolution — only fires when actually moving to a new city
    await resolveNpcTrap(db, gameId, npcId, destinationCityId, season, displayName)
  }

  // Step 4: Police encounter at destination (auto-resolved)
  await runNpcPoliceCheck(db, gameId, npcId, vehicle.id, destinationCityId, season, displayName)

  // Step 5: Claim the city if it's neutral (all) or competitor-owned (expander)
  await tryClaimCity(db, gameId, npcId, archetype, destinationCityId, displayName)

  // Step 6: Set a trap (syndicate archetype, random chance)
  if (archetype === 'npc_syndicate') {
    await trySetTrap(db, gameId, npcId, destinationCityId, season, displayName)
  }

  // Step 7: Sabotage a competitor's still (syndicate + expander, random chance)
  if (archetype === 'npc_syndicate' || archetype === 'npc_expander') {
    await trySabotage(db, gameId, npcId, archetype, destinationCityId, displayName)
  }

  // Step 8: Buy cheap cargo to sell next turn (merchant archetype)
  if (archetype === 'npc_merchant') {
    await tryBuyCargo(db, gameId, npcId, vehicle.id, vehicle.vehicle_type, destinationCityId, season)
  }

  // Step 9: Upgrade stills
  if (archetype === 'npc_industrialist') {
    await tryUpgradeStill(db, gameId, npcId, archetype, displayName)
    await tryUpgradeStill(db, gameId, npcId, archetype, displayName)
  } else {
    await tryUpgradeStill(db, gameId, npcId, archetype, displayName)
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch owner_player_id for a list of city IDs, keyed by city ID */
async function fetchCityOwnership(
  db: D1Database,
  gameId: string,
  cityIds: number[]
): Promise<Map<number, number | null>> {
  if (cityIds.length === 0) return new Map()
  const placeholders = cityIds.map(() => '?').join(',')
  const { results } = await db.prepare(
    `SELECT id, owner_player_id FROM game_cities WHERE game_id = ? AND id IN (${placeholders})`
  ).bind(gameId, ...cityIds).all<{ id: number; owner_player_id: number | null }>()
  const map = new Map<number, number | null>()
  for (const row of results) map.set(row.id, row.owner_player_id)
  return map
}

/** Sell all city_inventory stock for every distillery the NPC owns */
async function sellAllDistilleryStock(
  db: D1Database,
  gameId: string,
  npcId: number,
  season: number,
  displayName: string
): Promise<void> {
  const { results } = await db.prepare(
    `SELECT d.city_id, ci.alcohol_type, ci.quantity,
            COALESCE(mp.price, 20) AS price
     FROM distilleries d
     JOIN city_inventory ci
       ON ci.game_id = ? AND ci.city_id = d.city_id AND ci.quantity > 0
     LEFT JOIN market_prices mp
       ON mp.game_id = ? AND mp.city_id = d.city_id
      AND mp.season = ? AND mp.alcohol_type = ci.alcohol_type
     WHERE d.player_id = ?`
  ).bind(gameId, gameId, season, npcId)
   .all<{ city_id: number; alcohol_type: string; quantity: number; price: number }>()

  if (results.length === 0) return

  const totalRevenue = results.reduce((s, r) => s + Math.floor(r.price * r.quantity), 0)

  await db.batch([
    ...results.map(r =>
      db.prepare(
        `UPDATE city_inventory SET quantity = 0
         WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
      ).bind(gameId, r.city_id, r.alcohol_type)
    ),
    db.prepare(
      `UPDATE game_players
       SET cash = cash + ?, total_cash_earned = total_cash_earned + ?
       WHERE id = ?`
    ).bind(totalRevenue, totalRevenue, npcId),
    db.prepare(
      `INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`
    ).bind(gameId, npcId, `📦 ${displayName} sold distillery stock for $${totalRevenue.toLocaleString()}.`),
  ])
}

/** Sell any alcohol cargo currently loaded in the NPC's vehicle */
async function sellVehicleCargo(
  db: D1Database,
  gameId: string,
  npcId: number,
  season: number,
  displayName: string
): Promise<void> {
  const vehicle = await db.prepare(
    `SELECT id, city_id FROM vehicles WHERE player_id = ? AND game_id = ? ORDER BY id LIMIT 1`
  ).bind(npcId, gameId).first<{ id: number; city_id: number }>()
  if (!vehicle) return

  const { results: cargoRows } = await db.prepare(
    `SELECT alcohol_type, quantity FROM vehicle_inventory WHERE vehicle_id = ? AND quantity > 0`
  ).bind(vehicle.id).all<{ alcohol_type: string; quantity: number }>()
  if (cargoRows.length === 0) return

  let totalRevenue = 0
  const ops: ReturnType<D1Database['prepare']>[] = []

  for (const cargo of cargoRows) {
    const priceRow = await db.prepare(
      `SELECT price FROM market_prices WHERE game_id = ? AND city_id = ? AND season = ? AND alcohol_type = ?`
    ).bind(gameId, vehicle.city_id, season, cargo.alcohol_type).first<{ price: number }>()
    const price = priceRow?.price ?? 20
    totalRevenue += Math.floor(price * cargo.quantity)
    ops.push(
      db.prepare(`UPDATE vehicle_inventory SET quantity = 0 WHERE vehicle_id = ? AND alcohol_type = ?`)
        .bind(vehicle.id, cargo.alcohol_type)
    )
  }

  if (totalRevenue > 0) {
    ops.push(
      db.prepare(
        `UPDATE game_players SET cash = cash + ?, total_cash_earned = total_cash_earned + ? WHERE id = ?`
      ).bind(totalRevenue, totalRevenue, npcId)
    )
    ops.push(
      db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
        .bind(gameId, npcId, `🚗 ${displayName} sold transported cargo for $${totalRevenue.toLocaleString()}.`)
    )
    await db.batch(ops)
  }
}

/** Upgrade the cheapest upgradeable still the NPC owns, if affordable. Returns true if upgraded. */
async function tryUpgradeStill(
  db: D1Database,
  gameId: string,
  npcId: number,
  characterClass: string,
  displayName: string
): Promise<boolean> {
  const still = await db.prepare(
    `SELECT id, tier FROM distilleries WHERE player_id = ? AND tier < 5 ORDER BY tier ASC LIMIT 1`
  ).bind(npcId).first<{ id: number; tier: number }>()
  if (!still) return false

  const npcRow = await db.prepare(
    `SELECT cash FROM game_players WHERE id = ?`
  ).bind(npcId).first<{ cash: number }>()
  if (!npcRow) return false

  const cost = getUpgradeCost(still.tier + 1, characterClass)
  if (npcRow.cash < cost) return false

  await db.batch([
    db.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, npcId),
    db.prepare(`UPDATE distilleries SET tier = tier + 1 WHERE id = ?`).bind(still.id),
    db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
      .bind(gameId, npcId, `🔧 ${displayName} upgraded a still to Tier ${still.tier + 1}.`),
  ])
  return true
}

/** Claim the given city if it's unclaimed (all archetypes) or competitor-owned (expander). */
async function tryClaimCity(
  db: D1Database,
  gameId: string,
  npcId: number,
  archetype: NpcArchetype,
  cityId: number,
  displayName: string
): Promise<boolean> {
  const BASE_CLAIM: Record<string, number> = { small: 500, medium: 1000, large: 1500, major: 2500 }

  const cityRow = await db.prepare(
    `SELECT gc.id, gc.owner_player_id, cp.population_tier, cp.name AS city_name
     FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE gc.id = ? AND gc.game_id = ?`
  ).bind(cityId, gameId).first<{
    id: number; owner_player_id: number | null; population_tier: string; city_name: string
  }>()
  if (!cityRow) return false
  if (cityRow.owner_player_id === npcId) return false  // already ours
  if (cityRow.owner_player_id !== null && archetype !== 'npc_expander') return false  // only expander claims competitor cities

  const cost = BASE_CLAIM[cityRow.population_tier] ?? 500

  const npcRow = await db.prepare(`SELECT cash FROM game_players WHERE id = ?`)
    .bind(npcId).first<{ cash: number }>()
  if (!npcRow || npcRow.cash < cost) return false

  await db.batch([
    db.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, npcId),
    db.prepare(`UPDATE game_cities SET owner_player_id = ?, claim_cost = ? WHERE id = ?`)
      .bind(npcId, cost, cityId),
    db.prepare(
      `INSERT INTO distilleries (player_id, city_id, tier, still_number, purchase_price)
       SELECT ?, ?, 1,
              COALESCE((SELECT MAX(still_number) FROM distilleries WHERE player_id = ?), 0) + 1, 0
       WHERE NOT EXISTS (SELECT 1 FROM distilleries WHERE player_id = ? AND city_id = ?)`
    ).bind(npcId, cityId, npcId, npcId, cityId),
    db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
      .bind(gameId, npcId, `🗺️ ${displayName} claimed ${cityRow.city_name}!`),
  ])
  return true
}

/** Set a financial trap at the city (40% chance, syndicate only). */
async function trySetTrap(
  db: D1Database,
  gameId: string,
  npcId: number,
  cityId: number,
  season: number,
  displayName: string
): Promise<boolean> {
  if (Math.random() > 0.4) return false

  const npcRow = await db.prepare(`SELECT cash FROM game_players WHERE id = ?`)
    .bind(npcId).first<{ cash: number }>()
  if (!npcRow || npcRow.cash < 300) return false

  const existing = await db.prepare(
    `SELECT id FROM traps WHERE game_id = ? AND city_id = ?`
  ).bind(gameId, cityId).first()
  if (existing) return false

  await db.batch([
    db.prepare(`UPDATE game_players SET cash = cash - 300 WHERE id = ?`).bind(npcId),
    db.prepare(
      `INSERT INTO traps (game_id, city_id, setter_player_id, consequence_type, consequence_params, cost, created_season)
       VALUES (?, ?, ?, 'jail', ?, 300, ?)`
    ).bind(gameId, cityId, npcId, JSON.stringify({ seasons: 1 }), season),
    db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
      .bind(gameId, npcId, `🪤 ${displayName} quietly set a trap.`),
  ])
  return true
}

/** Sabotage a competitor's still at the given city (random chance per archetype). */
async function trySabotage(
  db: D1Database,
  gameId: string,
  npcId: number,
  archetype: NpcArchetype,
  cityId: number,
  displayName: string
): Promise<boolean> {
  const chance = archetype === 'npc_syndicate' ? 0.5 : 0.3
  if (Math.random() > chance) return false

  const npcRow = await db.prepare(`SELECT cash FROM game_players WHERE id = ?`)
    .bind(npcId).first<{ cash: number }>()
  if (!npcRow) return false

  const stillRow = await db.prepare(
    `SELECT d.id, d.tier, COALESCE(gp.display_name, u.email) AS owner_name, cp.name AS city_name
     FROM distilleries d
     JOIN game_cities gc ON d.city_id = gc.id
     JOIN game_players gp ON d.player_id = gp.id
     LEFT JOIN users u ON gp.user_id = u.id
     JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE d.city_id = ?
       AND gc.owner_player_id IS NOT NULL
       AND d.player_id = gc.owner_player_id
       AND d.player_id != ?
     LIMIT 1`
  ).bind(cityId, npcId).first<{ id: number; tier: number; owner_name: string | null; city_name: string }>()
  if (!stillRow) return false

  const cost = DISTILLERY_TIERS[stillRow.tier]?.cost ?? 0
  const heatIncrease = stillRow.tier * 10
  if (npcRow.cash < cost) return false

  const ownerName = stillRow.owner_name?.split('@')[0] ?? 'a rival'

  if (stillRow.tier <= 1) {
    await db.batch([
      db.prepare(`UPDATE game_players SET cash = cash - ?, heat = MIN(100, heat + ?) WHERE id = ?`)
        .bind(cost, heatIncrease, npcId),
      db.prepare(`DELETE FROM distilleries WHERE id = ?`).bind(stillRow.id),
      db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
        .bind(gameId, npcId, `💣 ${displayName} destroyed ${ownerName}'s still in ${stillRow.city_name}!`),
    ])
  } else {
    await db.batch([
      db.prepare(`UPDATE game_players SET cash = cash - ?, heat = MIN(100, heat + ?) WHERE id = ?`)
        .bind(cost, heatIncrease, npcId),
      db.prepare(`UPDATE distilleries SET tier = tier - 1 WHERE id = ?`).bind(stillRow.id),
      db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
        .bind(gameId, npcId, `💣 ${displayName} sabotaged ${ownerName}'s still in ${stillRow.city_name}! (Tier ${stillRow.tier} → ${stillRow.tier - 1})`),
    ])
  }
  return true
}

/**
 * Buy the cheapest alcohol at this city if the market price is below the historical base.
 * Cargo is loaded into the vehicle and sold next turn after moving.
 */
async function tryBuyCargo(
  db: D1Database,
  gameId: string,
  npcId: number,
  vehicleId: number,
  vehicleType: string,
  cityId: number,
  season: number
): Promise<void> {
  const npcRow = await db.prepare(`SELECT cash FROM game_players WHERE id = ?`)
    .bind(npcId).first<{ cash: number }>()
  if (!npcRow || npcRow.cash < 50) return

  const cheapItem = await db.prepare(
    `SELECT alcohol_type, price FROM market_prices
     WHERE game_id = ? AND city_id = ? AND season = ?
     ORDER BY price ASC LIMIT 1`
  ).bind(gameId, cityId, season).first<{ alcohol_type: string; price: number }>()
  if (!cheapItem) return

  // Base prices — only buy if the market price is meaningfully below base
  const BASE_PRICES: Record<string, number> = {
    beer: 15, gin: 25, rum: 20, whiskey: 30, moonshine: 20,
    vodka: 22, bourbon: 28, rye: 26, scotch: 35, tequila: 24,
    brandy: 28, wine: 18, vermouth: 22, malort: 15,
  }
  const basePrice = BASE_PRICES[cheapItem.alcohol_type] ?? 20
  if (cheapItem.price > basePrice * 0.85) return  // skip unless at least 15% below base

  const vehicleDef = VEHICLES[vehicleType]
  const cargoSlots = vehicleDef?.cargoSlots ?? 16
  const { results: currentInv } = await db.prepare(
    `SELECT COALESCE(SUM(quantity), 0) AS used FROM vehicle_inventory WHERE vehicle_id = ?`
  ).bind(vehicleId).all<{ used: number }>()
  const cargoUsed = currentInv[0]?.used ?? 0
  const freeSlots = cargoSlots - cargoUsed
  if (freeSlots <= 0) return

  const maxAfford = Math.floor(npcRow.cash / cheapItem.price)
  const toBuy = Math.min(freeSlots, maxAfford, 10)  // cap per trip
  if (toBuy <= 0) return

  const cost = Math.round(cheapItem.price * toBuy)
  await db.batch([
    db.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, npcId),
    db.prepare(
      `INSERT INTO vehicle_inventory (vehicle_id, alcohol_type, quantity) VALUES (?, ?, ?)
       ON CONFLICT(vehicle_id, alcohol_type) DO UPDATE SET quantity = quantity + excluded.quantity`
    ).bind(vehicleId, cheapItem.alcohol_type, toBuy),
  ])
}

/**
 * Check for and fire a trap when an NPC arrives at a city.
 * Mirrors the human trap logic: fires only if the setter has already left the city.
 * Consequences are applied directly (no pending state needed for NPCs).
 */
async function resolveNpcTrap(
  db: D1Database,
  gameId: string,
  npcId: number,
  cityId: number,
  season: number,
  displayName: string
): Promise<void> {
  const trapRow = await db.prepare(
    `SELECT t.id, t.consequence_type, t.consequence_params,
            COALESCE(gp_s.display_name, u_s.email) AS setter_name,
            gp_s.current_city_id AS setter_current_city
     FROM traps t
     JOIN game_players gp_s ON t.setter_player_id = gp_s.id
     LEFT JOIN users u_s ON gp_s.user_id = u_s.id
     WHERE t.game_id = ? AND t.city_id = ?`
  ).bind(gameId, cityId).first<{
    id: number; consequence_type: string; consequence_params: string
    setter_name: string | null; setter_current_city: number | null
  }>()

  // Only fire if trap exists AND setter has left this city
  if (!trapRow || trapRow.setter_current_city === cityId) return

  const params = JSON.parse(trapRow.consequence_params) as { seasons?: number; amount?: number; turns?: number }
  const setterName = trapRow.setter_name?.split('@')[0] ?? 'Someone'

  const cityNameRow = await db.prepare(
    `SELECT cp.name FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
  ).bind(cityId).first<{ name: string }>()
  const cityName = cityNameRow?.name ?? 'the city'

  const ops: ReturnType<D1Database['prepare']>[] = [
    db.prepare(`DELETE FROM traps WHERE id = ?`).bind(trapRow.id),
  ]

  let consequence = ''
  if (trapRow.consequence_type === 'jail') {
    const seasons = Math.min(2, params.seasons ?? 1)
    ops.push(
      db.prepare(`UPDATE game_players SET jail_until_season = ? WHERE id = ?`).bind(season + seasons, npcId)
    )
    consequence = `thrown in jail for ${seasons} season${seasons !== 1 ? 's' : ''}`
  } else if (trapRow.consequence_type === 'financial') {
    const amount = Math.max(0, params.amount ?? 100)
    ops.push(
      db.prepare(`UPDATE game_players SET cash = MAX(0, cash - ?) WHERE id = ?`).bind(amount, npcId)
    )
    consequence = `fined $${amount.toLocaleString()}`
  } else if (trapRow.consequence_type === 'alcohol_loss') {
    const amount = Math.max(1, params.amount ?? 5)
    // Seize from vehicle inventory
    const vehicle = await db.prepare(
      `SELECT id FROM vehicles WHERE player_id = ? AND game_id = ? ORDER BY id LIMIT 1`
    ).bind(npcId, gameId).first<{ id: number }>()
    if (vehicle) {
      let remaining = amount
      const { results: inv } = await db.prepare(
        `SELECT alcohol_type, quantity FROM vehicle_inventory WHERE vehicle_id = ? AND quantity > 0 ORDER BY quantity DESC`
      ).bind(vehicle.id).all<{ alcohol_type: string; quantity: number }>()
      for (const row of inv) {
        if (remaining <= 0) break
        const take = Math.min(row.quantity, remaining)
        ops.push(
          db.prepare(`UPDATE vehicle_inventory SET quantity = quantity - ? WHERE vehicle_id = ? AND alcohol_type = ?`)
            .bind(take, vehicle.id, row.alcohol_type)
        )
        remaining -= take
      }
    }
    consequence = `lost ${amount} units of cargo`
  } else if (trapRow.consequence_type === 'stuck') {
    const turns = Math.min(3, params.turns ?? 1)
    ops.push(
      db.prepare(`UPDATE game_players SET stuck_until_season = ?, stuck_city_id = ? WHERE id = ?`).bind(season + turns, cityId, npcId)
    )
    consequence = `stuck in ${cityName} for ${turns} season${turns !== 1 ? 's' : ''}`
  }

  ops.push(
    db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
      .bind(gameId, npcId, `🪤 ${setterName} left a trap in ${cityName}. ${displayName} walked right into it and was ${consequence}.`)
  )

  await db.batch(ops)
}

/**
 * Roll a police encounter for an NPC at the destination city.
 * Auto-resolves: bribe if affordable, otherwise submit (cargo + cash seizure)
 * or run (risk jail). NPCs never stay immune from heat-based stops.
 */
async function runNpcPoliceCheck(
  db: D1Database,
  gameId: string,
  npcId: number,
  vehicleId: number,
  cityId: number,
  season: number,
  displayName: string
): Promise<void> {
  const npcRow = await db.prepare(
    `SELECT heat, cash FROM game_players WHERE id = ?`
  ).bind(npcId).first<{ heat: number; cash: number }>()
  if (!npcRow || npcRow.heat <= 0) return

  if (!rollPoliceEncounter(npcRow.heat)) return

  // Check if NPC bribed this city themselves
  const cityRow = await db.prepare(
    `SELECT cp.population_tier, gc.bribe_player_id, gc.bribe_expires_season
     FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE gc.id = ?`
  ).bind(cityId).first<{ population_tier: string; bribe_player_id: number | null; bribe_expires_season: number | null }>()
  if (cityRow?.bribe_player_id === npcId && (cityRow?.bribe_expires_season ?? 0) > season) return

  const tier = (cityRow?.population_tier ?? 'small') as PopulationTier
  const bribeCost = calculateSpotBribeCost(npcRow.heat, tier)

  // Total cargo in vehicle
  const cargoRow = await db.prepare(
    `SELECT COALESCE(SUM(quantity), 0) AS total FROM vehicle_inventory WHERE vehicle_id = ?`
  ).bind(vehicleId).first<{ total: number }>()
  const totalCargo = cargoRow?.total ?? 0

  // ── Decision tree ──────────────────────────────────────────────────────────
  // Bribe: preferred if affordable; 25% chance they submit anyway (overconfident)
  if (npcRow.cash >= bribeCost && Math.random() > 0.25) {
    const br = resolveBribe(bribeCost)
    await db.batch([
      db.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(br.cashPaid, npcId),
      db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
        .bind(gameId, npcId, `👮 Police stopped ${displayName} — bribed their way out ($${br.cashPaid.toLocaleString()}).`),
    ])
    return
  }

  // Run: 30% chance if they can't or won't bribe
  if (Math.random() < 0.3) {
    const runRoll = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6)
    const rr = resolveRun(runRoll)
    const newHeat = Math.max(0, Math.min(100, npcRow.heat + rr.heatDelta))
    if (rr.escaped) {
      await db.batch([
        db.prepare(`UPDATE game_players SET heat = ? WHERE id = ?`).bind(newHeat, npcId),
        db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
          .bind(gameId, npcId, `🚔 Police chased ${displayName} — managed to escape (heat now ${newHeat}).`),
      ])
    } else {
      const jailUntil = season + rr.jailSeasons
      await db.batch([
        db.prepare(`UPDATE game_players SET heat = ?, jail_until_season = ? WHERE id = ?`).bind(newHeat, jailUntil, npcId),
        db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
          .bind(gameId, npcId, `🚔 ${displayName} tried to run from police and was arrested! Jailed until season ${jailUntil}.`),
      ])
    }
    return
  }

  // Submit: cooperate — lose cargo and potentially 50% cash
  const sr = resolveSubmit(npcRow.heat, totalCargo, npcRow.cash)
  const ops: ReturnType<D1Database['prepare']>[] = []

  if (sr.alcoholSeized > 0) {
    let remaining = sr.alcoholSeized
    const { results: invRows } = await db.prepare(
      `SELECT alcohol_type, quantity FROM vehicle_inventory WHERE vehicle_id = ? AND quantity > 0 ORDER BY quantity DESC`
    ).bind(vehicleId).all<{ alcohol_type: string; quantity: number }>()
    for (const row of invRows) {
      if (remaining <= 0) break
      const take = Math.min(row.quantity, remaining)
      ops.push(
        db.prepare(`UPDATE vehicle_inventory SET quantity = quantity - ? WHERE vehicle_id = ? AND alcohol_type = ?`)
          .bind(take, vehicleId, row.alcohol_type)
      )
      remaining -= take
    }
  }

  // At high heat with no cargo, still strip 50% cash — NPCs are known criminals
  const cashStripped = sr.cashSeized > 0
    ? sr.cashSeized
    : npcRow.heat >= 50 ? Math.floor(npcRow.cash * 0.5) : 0

  if (cashStripped > 0) {
    ops.push(db.prepare(`UPDATE game_players SET cash = MAX(0, cash - ?) WHERE id = ?`).bind(cashStripped, npcId))
  }

  const newHeat = Math.max(0, Math.min(100, npcRow.heat + sr.heatDelta))
  ops.push(db.prepare(`UPDATE game_players SET heat = ? WHERE id = ?`).bind(newHeat, npcId))

  const msg = sr.alcoholSeized > 0 && cashStripped > 0
    ? `👮 Police stopped ${displayName} — seized ${sr.alcoholSeized} units and $${cashStripped.toLocaleString()}.`
    : sr.alcoholSeized > 0
    ? `👮 Police stopped ${displayName} — seized ${sr.alcoholSeized} units of cargo.`
    : cashStripped > 0
    ? `👮 Police stopped ${displayName} — fined $${cashStripped.toLocaleString()} for suspicious activity.`
    : `👮 Police stopped ${displayName} but found nothing incriminating (heat reduced).`

  ops.push(
    db.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`).bind(gameId, npcId, msg)
  )
  await db.batch(ops)
}
