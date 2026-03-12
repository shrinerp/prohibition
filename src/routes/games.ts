import { Hono } from 'hono'
import type { Env } from '../index'
import type { AuthVariables } from '../middleware/sessionAuth'
import { sessionAuth } from '../middleware/sessionAuth'
import { GameService, buildMarketPrices } from '../services/GameService'
import { calculateEffectiveMovement, resolveMovement, VEHICLES, VEHICLE_PRICES, type RoadSegment } from '../game/movement'
import { generateRoads } from '../game/mapEngine'
import { DISTILLERY_TIERS, getUpgradeCost } from '../game/production'
import {
  rollPoliceEncounter, resolveSubmit, resolveBribe, resolveRun,
  calculateHeatIncrease, calculateSpotBribeCost, calculateLongTermBribeCost, type PopulationTier
} from '../game/police'
import { applyBribeDuration, applyMovementModifier } from '../game/characters'

export const gamesRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

gamesRouter.use('*', sessionAuth)

// List games the authenticated user is a member of
gamesRouter.get('/', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT g.id, g.status, g.current_season, g.invite_code, g.game_name,
            gp.turn_order, g.current_player_index,
            (gp.turn_order = g.current_player_index AND g.status = 'active') as is_my_turn
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.user_id = ? AND g.status != 'ended'
     ORDER BY g.created_at DESC`
  ).bind(userId).all<{
    id: string; status: string; current_season: number; invite_code: string; game_name: string | null
    turn_order: number; current_player_index: number; is_my_turn: number
  }>()
  return c.json({ success: true, games: results })
})

gamesRouter.post('/', async (c) => {
  const svc = new GameService(c.env)
  const result = await svc.createGame(c.get('userId'))
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true, gameId: result.gameId, inviteCode: result.inviteCode })
})

gamesRouter.post('/join', async (c) => {
  const { inviteCode } = await c.req.json<{ inviteCode: string }>()
  const svc = new GameService(c.env)
  const result = await svc.joinGame(inviteCode, c.get('userId'))
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true, gameId: result.gameId })
})

gamesRouter.post('/:id/character', async (c) => {
  const { characterClass } = await c.req.json<{ characterClass: string }>()
  const svc = new GameService(c.env)
  const result = await svc.selectCharacter(c.req.param('id'), c.get('userId'), characterClass)
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true })
})

gamesRouter.post('/:id/start', async (c) => {
  const svc = new GameService(c.env)
  const result = await svc.startGame(c.req.param('id'), c.get('userId'))
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true })
})

// Regenerate roads for an active game (host only) — replaces old sparse roads with
// K-nearest geographic neighbours giving each city 3-5 connections
gamesRouter.post('/:id/regen-roads', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT host_user_id FROM games WHERE id = ?`
  ).bind(gameId).first<{ host_user_id: number }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)
  if (game.host_user_id !== userId) return c.json({ success: false, message: 'Host only' }, 403)

  const { results: gameCities } = await c.env.PROHIBITIONDB.prepare(
    `SELECT gc.id, cp.name, cp.region, cp.primary_alcohol, cp.population_tier,
            cp.is_coastal, gc.demand_index, cp.lat, cp.lon
     FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE gc.game_id = ?`
  ).bind(gameId).all<{
    id: number; name: string; region: string; primary_alcohol: string
    population_tier: string; is_coastal: number; demand_index: number; lat: number; lon: number
  }>()

  const cityNodes = gameCities.map(c => ({
    id: c.id, name: c.name, region: c.region, primaryAlcohol: c.primary_alcohol,
    demandIndex: c.demand_index, isCoastal: c.is_coastal === 1,
    populationTier: c.population_tier as 'small' | 'medium' | 'large' | 'major',
    lat: c.lat, lon: c.lon
  }))

  await c.env.PROHIBITIONDB.prepare(`DELETE FROM roads WHERE game_id = ?`).bind(gameId).run()

  const roads = generateRoads(cityNodes)
  for (const road of roads) {
    await c.env.PROHIBITIONDB.prepare(
      `INSERT INTO roads (game_id, from_city_id, to_city_id, distance_value) VALUES (?, ?, ?, ?)`
    ).bind(gameId, road.fromCityId, road.toCityId, road.distanceValue).run()
  }

  return c.json({ success: true, roads: roads.length })
})

// Regenerate market prices for the current season (host only)
gamesRouter.post('/:id/regen-prices', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT host_user_id, current_season FROM games WHERE id = ?`
  ).bind(gameId).first<{ host_user_id: number; current_season: number }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)
  if (game.host_user_id !== userId) return c.json({ success: false, message: 'Host only' }, 403)

  const { results: gameCities } = await c.env.PROHIBITIONDB.prepare(
    `SELECT gc.id, cp.primary_alcohol, gc.demand_index, cp.population_tier
     FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE gc.game_id = ?`
  ).bind(gameId).all<{ id: number; primary_alcohol: string; demand_index: number; population_tier: string }>()

  await buildMarketPrices(c.env.PROHIBITIONDB, gameId, game.current_season, gameCities)
  return c.json({ success: true, season: game.current_season, cities: gameCities.length })
})

// Set game name — host only, lobby only
gamesRouter.post('/:id/game-name', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { name } = await c.req.json<{ name: string }>()

  const trimmed = (name ?? '').trim().slice(0, 40)
  if (!trimmed) return c.json({ success: false, message: 'Name cannot be empty' }, 400)

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT status, host_user_id FROM games WHERE id = ?`
  ).bind(gameId).first<{ status: string; host_user_id: number }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)
  if (game.status !== 'lobby') return c.json({ success: false, message: 'Game already started' }, 400)
  if (game.host_user_id !== userId) return c.json({ success: false, message: 'Only the host can name the game' }, 403)

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE games SET game_name = ? WHERE id = ?`
  ).bind(trimmed, gameId).run()

  return c.json({ success: true })
})

// Send email invite — host only, lobby only
gamesRouter.post('/:id/invite', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { email } = await c.req.json<{ email: string }>()

  if (!email || !email.includes('@')) return c.json({ success: false, message: 'Invalid email' }, 400)

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT g.status, g.host_user_id, g.invite_code, g.game_name,
            gp.display_name, u.email as host_email
     FROM games g
     JOIN game_players gp ON gp.game_id = g.id AND gp.user_id = g.host_user_id
     LEFT JOIN users u ON u.id = g.host_user_id
     WHERE g.id = ?`
  ).bind(gameId).first<{ status: string; host_user_id: number; invite_code: string; game_name: string | null; display_name: string | null; host_email: string | null }>()

  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)
  if (game.host_user_id !== userId) return c.json({ success: false, message: 'Only the host can invite players' }, 403)
  if (game.status !== 'lobby') return c.json({ success: false, message: 'Game already started' }, 400)

  const hostName = game.display_name ?? game.host_email?.split('@')[0] ?? 'A player'
  const gameName = game.game_name ?? 'Prohibition'
  const joinUrl = `https://prohibitioner.com`

  const res = await fetch('https://3mails.ai/api/transactional/35247eca-1ad4-4d45-a68e-de9a074b66c5/send', {
    method: 'POST',
    headers: {
      'X-API-Key': c.env.THREEMAILS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: email,
      variables: {
        hostName,
        gameName,
        inviteCode: game.invite_code,
        joinUrl
      }
    })
  })

  if (!res.ok) return c.json({ success: false, message: 'Failed to send email' }, 500)
  return c.json({ success: true })
})

// Set display name — lobby only
gamesRouter.post('/:id/name', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { name } = await c.req.json<{ name: string }>()

  const trimmed = (name ?? '').trim().slice(0, 30)
  if (!trimmed) return c.json({ success: false, message: 'Name cannot be empty' }, 400)

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT status FROM games WHERE id = ?`
  ).bind(gameId).first<{ status: string }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)
  if (game.status !== 'lobby') return c.json({ success: false, message: 'Game already started' }, 400)

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE game_players SET display_name = ? WHERE game_id = ? AND user_id = ?`
  ).bind(trimmed, gameId, userId).run()

  return c.json({ success: true })
})

gamesRouter.post('/:id/turn', async (c) => {
  const gameId  = c.req.param('id')
  const userId  = c.get('userId')
  const actions = await c.req.json<unknown[]>()

  // Verify it's this player's turn
  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.current_city_id, gp.character_class,
            gp.heat, gp.pending_police_encounter, gp.cash,
            g.current_player_index, g.current_season, g.status, g.player_count
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_city_id: number | null
    character_class: string; heat: number; cash: number
    pending_police_encounter: string | null
    current_player_index: number; current_season: number; status: string; player_count: number
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) {
    return c.json({ success: false, message: 'Not your turn' }, 400)
  }

  // Record turn
  await c.env.PROHIBITIONDB.prepare(
    `INSERT INTO turns (game_id, player_id, season, actions)
     VALUES (?, ?, ?, ?)`
  ).bind(gameId, playerRow.id, playerRow.current_season, JSON.stringify(actions)).run()

  // Pre-fetch vehicles and all game players in parallel — avoids N+1 queries in the action loop
  const [{ results: playerVehicles }, { results: allPlayersList }] = await Promise.all([
    c.env.PROHIBITIONDB.prepare(
      `SELECT id, vehicle_type, city_id, heat FROM vehicles WHERE player_id = ? ORDER BY id`
    ).bind(playerRow.id).all<{ id: number; vehicle_type: string; city_id: number; heat: number }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT id, turn_order, is_npc FROM game_players WHERE game_id = ? ORDER BY turn_order`
    ).bind(gameId).all<{ id: number; turn_order: number; is_npc: number }>()
  ])
  let currentCash = playerRow.cash
  const playerByOrder = new Map(allPlayersList.map(p => [p.turn_order, p]))

  // Track current city — may be updated mid-action-list by a move
  let currentCityId = playerRow.current_city_id

  // Resolve actions
  type Action = {
    type: string; targetPath?: number[]; roll?: number; cityId?: number
    alcoholType?: string; quantity?: number; vehicleId?: number; choice?: string
    vehicles?: Array<{ vehicleId: number; targetPath: number[]; allocatedPoints: number }>
  }
  let policeEncounterResult: { vehicleId?: number; bribeCost: number; populationTier: string; heat: number } | null = null
  const celebrations: Array<{ type: string; cityId?: number; newTier?: number; vehicleId?: string }> = []

  for (const action of actions as Action[]) {

    // ── Police resolve (must be first — clears pending and then ends turn) ────
    if (action.type === 'police_resolve' && playerRow.pending_police_encounter) {
      const queue = JSON.parse(playerRow.pending_police_encounter) as Array<{
        vehicleId?: number; bribeCost: number; populationTier: PopulationTier; heat: number
      }>
      if (queue.length === 0) continue
      const encounter = queue.shift()!
      const choice = action.choice as 'submit' | 'bribe' | 'run'

      const freshCashRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT cash, heat FROM game_players WHERE id = ?`
      ).bind(playerRow.id).first<{ cash: number; heat: number }>()
      const freshCash = freshCashRow?.cash ?? 0
      const freshHeat = freshCashRow?.heat ?? encounter.heat

      if (choice === 'submit') {
        // Seize from specific vehicle's inventory (or all if no vehicleId)
        const invQuery = encounter.vehicleId
          ? `SELECT alcohol_type, quantity FROM vehicle_inventory WHERE vehicle_id = ?`
          : `SELECT vi.alcohol_type, vi.quantity FROM vehicle_inventory vi JOIN vehicles v ON vi.vehicle_id = v.id WHERE v.player_id = ?`
        const { results: invRows } = await c.env.PROHIBITIONDB.prepare(invQuery)
          .bind(encounter.vehicleId ?? playerRow.id).all<{ alcohol_type: string; quantity: number }>()
        const totalUnits = invRows.reduce((s, r) => s + r.quantity, 0)
        const sr = resolveSubmit(freshHeat, totalUnits, freshCash)
        if (sr.alcoholSeized > 0 && encounter.vehicleId) {
          let remaining = sr.alcoholSeized
          for (const row of invRows) {
            if (remaining <= 0) break
            const take = Math.min(row.quantity, remaining)
            await c.env.PROHIBITIONDB.prepare(
              `UPDATE vehicle_inventory SET quantity = quantity - ? WHERE vehicle_id = ? AND alcohol_type = ?`
            ).bind(take, encounter.vehicleId, row.alcohol_type).run()
            remaining -= take
          }
        }
        if (sr.cashSeized > 0) {
          await c.env.PROHIBITIONDB.prepare(
            `UPDATE game_players SET cash = cash - ? WHERE id = ?`
          ).bind(sr.cashSeized, playerRow.id).run()
        }
        const newHeat = Math.max(0, Math.min(100, freshHeat + sr.heatDelta))
        const remaining2 = queue.length > 0 ? JSON.stringify(queue) : null
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET heat = ?, pending_police_encounter = ? WHERE id = ?`
        ).bind(newHeat, remaining2, playerRow.id).run()
        playerRow.pending_police_encounter = remaining2

      } else if (choice === 'bribe') {
        const br = resolveBribe(encounter.bribeCost)
        if (freshCash >= br.cashPaid) {
          const remaining2 = queue.length > 0 ? JSON.stringify(queue) : null
          await c.env.PROHIBITIONDB.prepare(
            `UPDATE game_players SET cash = cash - ?, pending_police_encounter = ? WHERE id = ?`
          ).bind(br.cashPaid, remaining2, playerRow.id).run()
          playerRow.pending_police_encounter = remaining2
        }

      } else if (choice === 'run') {
        const runRoll = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6)
        const rr = resolveRun(runRoll)
        const newHeat = Math.max(0, Math.min(100, freshHeat + rr.heatDelta))
        const remaining2 = queue.length > 0 ? JSON.stringify(queue) : null
        if (rr.escaped) {
          await c.env.PROHIBITIONDB.prepare(
            `UPDATE game_players SET heat = ?, pending_police_encounter = ? WHERE id = ?`
          ).bind(newHeat, remaining2, playerRow.id).run()
        } else {
          const jailUntil = playerRow.current_season + rr.jailSeasons
          await c.env.PROHIBITIONDB.prepare(
            `UPDATE game_players SET heat = ?, jail_until_season = ?, pending_police_encounter = ? WHERE id = ?`
          ).bind(newHeat, jailUntil, remaining2, playerRow.id).run()
        }
        playerRow.pending_police_encounter = remaining2
      }
      // If more encounters pending, return the next one
      if (queue.length > 0) {
        const next = queue[0]
        policeEncounterResult = { vehicleId: next.vehicleId, bribeCost: next.bribeCost, populationTier: next.populationTier, heat: next.heat }
      }
      // Fall through to turn advance
    }

    // ── Move ──────────────────────────────────────────────────────────────────
    if (action.type === 'move') {
      const numDice = playerVehicles.length + 1
      const maxRoll = numDice * 6
      const roll = (typeof action.roll === 'number' && action.roll >= numDice && action.roll <= maxRoll)
        ? action.roll : Math.ceil(numDice * 3.5)

      const effectiveTotal = applyMovementModifier(playerRow.character_class, roll)

      const vehicleMoves = action.vehicles ?? []
      const totalAllocated = vehicleMoves.reduce((s, vm) => s + vm.allocatedPoints, 0)
      if (totalAllocated > effectiveTotal) continue // reject if over-budget

      // Lazy-load roads once
      const { results: roadRows } = await c.env.PROHIBITIONDB.prepare(
        `SELECT from_city_id, to_city_id, distance_value FROM roads WHERE game_id = ?`
      ).bind(gameId).all<{ from_city_id: number; to_city_id: number; distance_value: number }>()
      const roads: RoadSegment[] = roadRows.map(r => ({
        fromCityId: r.from_city_id, toCityId: r.to_city_id, distanceValue: r.distance_value
      }))

      for (const vm of vehicleMoves) {
        if (!vm.targetPath || vm.targetPath.length === 0) continue
        const vehicleRow = playerVehicles.find(v => v.id === vm.vehicleId)
        if (!vehicleRow) continue
        const vehicleDef = VEHICLES[vehicleRow.vehicle_type]
        const effectivePts = Math.floor(vm.allocatedPoints * (vehicleDef?.movementMultiplier ?? 1.0))
        const result = resolveMovement(vehicleRow.city_id, vm.targetPath, roads, effectivePts)
        vehicleRow.city_id = result.currentCityId
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE vehicles SET city_id = ? WHERE id = ?`
        ).bind(result.currentCityId, vehicleRow.id).run()

        // Cargo-travel heat for this vehicle
        const { results: vinv } = await c.env.PROHIBITIONDB.prepare(
          `SELECT quantity FROM vehicle_inventory WHERE vehicle_id = ? AND quantity > 0`
        ).bind(vehicleRow.id).all<{ quantity: number }>()
        const hasCargo = vinv.some(r => r.quantity > 0)
        let currentHeat = playerRow.heat
        if (hasCargo) {
          const heatDelta = calculateHeatIncrease('cargo_travel', playerRow.character_class)
          currentHeat = Math.min(100, currentHeat + heatDelta)
          await c.env.PROHIBITIONDB.prepare(
            `UPDATE game_players SET heat = ? WHERE id = ?`
          ).bind(currentHeat, playerRow.id).run()
          playerRow.heat = currentHeat
        }

        // Check if this city is bribed
        const briberRow = await c.env.PROHIBITIONDB.prepare(
          `SELECT bribe_player_id, bribe_expires_season FROM game_cities WHERE id = ?`
        ).bind(result.currentCityId).first<{ bribe_player_id: number | null; bribe_expires_season: number | null }>()
        const cityIsBribed = briberRow?.bribe_player_id === playerRow.id &&
          (briberRow?.bribe_expires_season ?? 0) > playerRow.current_season

        // Police encounter roll (only if carrying cargo)
        if (hasCargo && !cityIsBribed && rollPoliceEncounter(currentHeat)) {
          const cityRow = await c.env.PROHIBITIONDB.prepare(
            `SELECT cp.population_tier FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
          ).bind(result.currentCityId).first<{ population_tier: string }>()
          const tier = (cityRow?.population_tier ?? 'small') as PopulationTier
          const bribeCost = calculateSpotBribeCost(currentHeat, tier)
          // Append to encounter queue
          const existing = playerRow.pending_police_encounter
            ? JSON.parse(playerRow.pending_police_encounter) as Array<{ vehicleId: number; bribeCost: number; populationTier: string; heat: number }>
            : []
          existing.push({ vehicleId: vehicleRow.id, bribeCost, populationTier: tier, heat: currentHeat })
          const newJson = JSON.stringify(existing)
          await c.env.PROHIBITIONDB.prepare(
            `UPDATE game_players SET pending_police_encounter = ? WHERE id = ?`
          ).bind(newJson, playerRow.id).run()
          playerRow.pending_police_encounter = newJson
          if (!policeEncounterResult) {
            policeEncounterResult = { vehicleId: vehicleRow.id, bribeCost, populationTier: tier, heat: currentHeat }
          }
        }
      }

      // Update game_players.current_city_id to first vehicle's final city
      if (playerVehicles.length > 0) {
        currentCityId = playerVehicles[0].city_id
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET current_city_id = ? WHERE id = ?`
        ).bind(currentCityId, playerRow.id).run()
      }
    }

    // ── Buy alcohol from the open market ─────────────────────────────────────
    if (action.type === 'buy' && action.vehicleId && action.alcoholType && action.quantity) {
      const vehicleRow = playerVehicles.find(v => v.id === action.vehicleId)
      if (!vehicleRow) continue
      const vCityId = vehicleRow.city_id
      const requested = Math.max(1, Math.floor(action.quantity))
      const priceRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT price FROM market_prices WHERE game_id = ? AND city_id = ? AND season = ? AND alcohol_type = ?`
      ).bind(gameId, vCityId, playerRow.current_season, action.alcoholType).first<{ price: number }>()
      if (priceRow) {
        const vehicleDef = VEHICLES[vehicleRow.vehicle_type]
        const cargoSlots = vehicleDef?.cargoSlots ?? 16
        const { results: currentInv } = await c.env.PROHIBITIONDB.prepare(
          `SELECT COALESCE(SUM(quantity), 0) AS used FROM vehicle_inventory WHERE vehicle_id = ?`
        ).bind(action.vehicleId).all<{ used: number }>()
        const cargoUsed = currentInv[0]?.used ?? 0
        const maxAfford = Math.floor(currentCash / priceRow.price)
        const toBuy = Math.min(requested, cargoSlots - cargoUsed, maxAfford)
        if (toBuy > 0) {
          const cost = Math.round(priceRow.price * toBuy)
          currentCash -= cost
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, playerRow.id),
            c.env.PROHIBITIONDB.prepare(
              `INSERT INTO vehicle_inventory (vehicle_id, alcohol_type, quantity) VALUES (?, ?, ?)
               ON CONFLICT(vehicle_id, alcohol_type) DO UPDATE SET quantity = quantity + excluded.quantity`
            ).bind(action.vehicleId, action.alcoholType, toBuy)
          ])
        }
      }
    }

    // ── Pick up alcohol from city inventory ───────────────────────────────────
    if (action.type === 'pickup' && action.vehicleId && action.alcoholType && action.quantity) {
      const vehicleRow = playerVehicles.find(v => v.id === action.vehicleId)
      if (!vehicleRow) continue
      const vCityId = vehicleRow.city_id
      const requested = Math.max(1, Math.floor(action.quantity))
      const ownedDistillery = await c.env.PROHIBITIONDB.prepare(
        `SELECT id FROM distilleries WHERE player_id = ? AND city_id = ?`
      ).bind(playerRow.id, vCityId).first()
      if (!ownedDistillery) continue
      const cityInv = await c.env.PROHIBITIONDB.prepare(
        `SELECT quantity FROM city_inventory WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
      ).bind(gameId, vCityId, action.alcoholType).first<{ quantity: number }>()
      if (cityInv && cityInv.quantity > 0) {
        const vehicleDef = VEHICLES[vehicleRow.vehicle_type]
        const cargoSlots = vehicleDef?.cargoSlots ?? 16
        const { results: currentInv } = await c.env.PROHIBITIONDB.prepare(
          `SELECT COALESCE(SUM(quantity), 0) AS used FROM vehicle_inventory WHERE vehicle_id = ?`
        ).bind(action.vehicleId).all<{ used: number }>()
        const cargoUsed = currentInv[0]?.used ?? 0
        const toPickup = Math.min(requested, cargoSlots - cargoUsed, cityInv.quantity)
        if (toPickup > 0) {
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(
              `UPDATE city_inventory SET quantity = quantity - ? WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
            ).bind(toPickup, gameId, vCityId, action.alcoholType),
            c.env.PROHIBITIONDB.prepare(
              `INSERT INTO vehicle_inventory (vehicle_id, alcohol_type, quantity) VALUES (?, ?, ?)
               ON CONFLICT(vehicle_id, alcohol_type) DO UPDATE SET quantity = quantity + excluded.quantity`
            ).bind(action.vehicleId, action.alcoholType, toPickup)
          ])
        }
      }
    }

    // ── Sell directly from city inventory (distillery) — no cargo limit ──────
    if (action.type === 'sell_city_stock' && currentCityId != null && action.alcoholType) {
      const ownedDistillery = await c.env.PROHIBITIONDB.prepare(
        `SELECT id FROM distilleries WHERE player_id = ? AND city_id = ?`
      ).bind(playerRow.id, currentCityId).first()
      if (ownedDistillery) {
        const cityInv = await c.env.PROHIBITIONDB.prepare(
          `SELECT quantity FROM city_inventory WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
        ).bind(gameId, currentCityId, action.alcoholType).first<{ quantity: number }>()
        const toSell = cityInv?.quantity ?? 0
        if (toSell > 0) {
          const BASE_PRICES: Record<string, number> = {
            beer: 15, gin: 25, rum: 20, whiskey: 30, moonshine: 20,
            vodka: 22, bourbon: 28, rye: 26, scotch: 35, tequila: 24,
            brandy: 28, wine: 18, vermouth: 22, malort: 15
          }
          const priceRow = await c.env.PROHIBITIONDB.prepare(
            `SELECT price FROM market_prices WHERE game_id = ? AND city_id = ? AND season = ? AND alcohol_type = ?`
          ).bind(gameId, currentCityId, playerRow.current_season, action.alcoholType).first<{ price: number }>()
          const unitPrice = priceRow?.price ?? BASE_PRICES[action.alcoholType] ?? 20
          const revenue = Math.floor(unitPrice * toSell)
          currentCash += revenue
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(
              `UPDATE city_inventory SET quantity = 0 WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
            ).bind(gameId, currentCityId, action.alcoholType),
            c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ? WHERE id = ?`).bind(revenue, playerRow.id)
          ])
        }
      }
    }

    // ── Sell alcohol from vehicle inventory ────────────────────────────────────
    if (action.type === 'sell' && action.vehicleId && action.alcoholType && action.quantity) {
      const vehicleRow = playerVehicles.find(v => v.id === action.vehicleId)
      if (!vehicleRow) continue
      const vCityId = vehicleRow.city_id
      const requested = Math.max(1, Math.floor(action.quantity))
      const invRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT quantity FROM vehicle_inventory WHERE vehicle_id = ? AND alcohol_type = ?`
      ).bind(action.vehicleId, action.alcoholType).first<{ quantity: number }>()
      const currentQty = invRow?.quantity ?? 0
      if (currentQty > 0) {
        const toSell = Math.min(requested, currentQty)
        const BASE_PRICES: Record<string, number> = {
          beer: 15, gin: 25, rum: 20, whiskey: 30, moonshine: 20,
          vodka: 22, bourbon: 28, rye: 26, scotch: 35, tequila: 24,
          brandy: 28, wine: 18, vermouth: 22, malort: 15
        }
        const priceRow = await c.env.PROHIBITIONDB.prepare(
          `SELECT price FROM market_prices WHERE game_id = ? AND city_id = ? AND season = ? AND alcohol_type = ?`
        ).bind(gameId, vCityId, playerRow.current_season, action.alcoholType).first<{ price: number }>()
        const unitPrice = priceRow?.price ?? BASE_PRICES[action.alcoholType] ?? 20
        const revenue = Math.floor(unitPrice * toSell)
        currentCash += revenue
        await c.env.PROHIBITIONDB.batch([
          c.env.PROHIBITIONDB.prepare(
            `UPDATE vehicle_inventory SET quantity = quantity - ? WHERE vehicle_id = ? AND alcohol_type = ?`
          ).bind(toSell, action.vehicleId, action.alcoholType),
          c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ? WHERE id = ?`).bind(revenue, playerRow.id)
        ])
      }
    }

    // ── Bribe official (long-term city bribe) ────────────────────────────────
    if (action.type === 'bribe_official' && currentCityId != null) {
      const cityRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT cp.population_tier FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
      ).bind(currentCityId).first<{ population_tier: string }>()
      if (cityRow) {
        const tier = cityRow.population_tier as PopulationTier
        const cost = calculateLongTermBribeCost(tier)
        if (currentCash >= cost) {
          const duration  = applyBribeDuration(playerRow.character_class, 4)
          const expiresAt = playerRow.current_season + duration
          currentCash -= cost
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, playerRow.id),
            c.env.PROHIBITIONDB.prepare(`UPDATE game_cities SET bribe_player_id = ?, bribe_expires_season = ? WHERE id = ?`).bind(playerRow.id, expiresAt, currentCityId)
          ])
        }
      }
    }

    // ── Claim / take over a city ──────────────────────────────────────────────
    if (action.type === 'claim_city' && currentCityId != null) {
      const BASE_CLAIM: Record<string, number> = { small: 500, medium: 1000, large: 1500, major: 2500 }
      const cityRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT gc.owner_player_id, gc.claim_cost, cp.population_tier
         FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
         WHERE gc.id = ?`
      ).bind(currentCityId).first<{ owner_player_id: number | null; claim_cost: number; population_tier: string }>()
      if (cityRow && cityRow.owner_player_id !== playerRow.id) {
        const isNeutral = cityRow.owner_player_id == null
        const cost = isNeutral
          ? (BASE_CLAIM[cityRow.population_tier] ?? 500)
          : (cityRow.claim_cost ?? BASE_CLAIM[cityRow.population_tier] ?? 500) * 2
        if (currentCash >= cost) {
          currentCash -= cost
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, playerRow.id),
            c.env.PROHIBITIONDB.prepare(`UPDATE game_cities SET owner_player_id = ?, claim_cost = ? WHERE id = ?`).bind(playerRow.id, cost, currentCityId),
            c.env.PROHIBITIONDB.prepare(`DELETE FROM distilleries WHERE city_id = ? AND player_id != ?`).bind(currentCityId, playerRow.id),
          ])
          // Use subquery for still_number — UNIQUE(player_id, still_number) means hardcoding 1 fails if home distillery exists
          await c.env.PROHIBITIONDB.prepare(
            `INSERT INTO distilleries (player_id, city_id, tier, still_number, purchase_price)
             SELECT ?, ?, 1, COALESCE((SELECT MAX(still_number) FROM distilleries WHERE player_id = ?), 0) + 1, 0
             WHERE NOT EXISTS (SELECT 1 FROM distilleries WHERE player_id = ? AND city_id = ?)`
          ).bind(playerRow.id, currentCityId, playerRow.id, playerRow.id, currentCityId).run()
          celebrations.push({ type: 'claim_city', cityId: currentCityId })
        }
      }
    }

    // ── Upgrade still ─────────────────────────────────────────────────────────
    if (action.type === 'upgrade_still' && currentCityId != null) {
      const distRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT id, tier FROM distilleries WHERE player_id = ? AND city_id = ?`
      ).bind(playerRow.id, currentCityId).first<{ id: number; tier: number }>()
      if (distRow && distRow.tier < 5) {
        const cost = getUpgradeCost(distRow.tier + 1, playerRow.character_class)
        if (currentCash >= cost) {
          currentCash -= cost
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, playerRow.id),
            c.env.PROHIBITIONDB.prepare(`UPDATE distilleries SET tier = tier + 1 WHERE id = ?`).bind(distRow.id)
          ])
          celebrations.push({ type: 'upgrade_still', cityId: currentCityId, newTier: distRow.tier + 1 })
        }
      }
    }

    // ── Buy a new vehicle ─────────────────────────────────────────────────────
    if (action.type === 'buy_vehicle' && action.vehicleId) {
      const vehicleType = action.vehicleId as unknown as string  // vehicleId carries the type name
      const target = VEHICLES[vehicleType]
      const price  = VEHICLE_PRICES[vehicleType]
      if (!target || price == null) continue
      if (currentCash >= price) {
        currentCash -= price
        const homeCityRow = await c.env.PROHIBITIONDB.prepare(
          `SELECT home_city_id FROM game_players WHERE id = ?`
        ).bind(playerRow.id).first<{ home_city_id: number }>()
        if (homeCityRow?.home_city_id) {
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(price, playerRow.id),
            c.env.PROHIBITIONDB.prepare(
              `INSERT INTO vehicles (player_id, game_id, vehicle_type, city_id, purchase_price) VALUES (?, ?, ?, ?, ?)`
            ).bind(playerRow.id, gameId, vehicleType, homeCityRow.home_city_id, price)
          ])
          // Refresh vehicle list
          const { results: freshVehicles } = await c.env.PROHIBITIONDB.prepare(
            `SELECT id, vehicle_type, city_id, heat FROM vehicles WHERE player_id = ? ORDER BY id`
          ).bind(playerRow.id).all<{ id: number; vehicle_type: string; city_id: number; heat: number }>()
          playerVehicles.length = 0
          playerVehicles.push(...freshVehicles)
          celebrations.push({ type: 'buy_vehicle', vehicleId: vehicleType })
        }
      }
    }
  }

  // If a police encounter was triggered this turn, hold the turn until the player resolves it
  if (policeEncounterResult) {
    return c.json({ success: true, policeEncounter: policeEncounterResult })
  }

  // Market/free actions (buy, sell, pickup, sell_city_stock, upgrade_*, claim_city, bribe_official)
  // do NOT end the turn — only move, stay, skip are terminal
  const TERMINAL_ACTIONS = new Set(['move', 'stay', 'skip', 'police_resolve'])
  const hasTerminal = (actions as Action[]).some(a => TERMINAL_ACTIONS.has(a.type))
  if (!hasTerminal) {
    return c.json({ success: true, celebrations: celebrations.length > 0 ? celebrations : undefined })
  }

  // Advance turn index, wrapping back to 0 and bumping season when all players have gone
  let nextIndex  = (playerRow.current_player_index + 1) % playerRow.player_count
  let nextSeason = playerRow.current_season + (nextIndex === 0 ? 1 : 0)

  // Auto-skip NPC players using pre-fetched player list — collect then batch insert
  const npcSkipStmts: ReturnType<typeof c.env.PROHIBITIONDB.prepare>[] = []
  const SAFETY = playerRow.player_count
  for (let i = 0; i < SAFETY; i++) {
    const next = playerByOrder.get(nextIndex)
    if (!next || !next.is_npc) break
    npcSkipStmts.push(c.env.PROHIBITIONDB.prepare(
      `INSERT INTO turns (game_id, player_id, season, actions, skipped) VALUES (?, ?, ?, ?, 1)`
    ).bind(gameId, next.id, nextSeason, JSON.stringify([{ type: 'skip' }])))
    nextIndex  = (nextIndex + 1) % playerRow.player_count
    nextSeason += nextIndex === 0 ? 1 : 0
  }
  if (npcSkipStmts.length > 0) await c.env.PROHIBITIONDB.batch(npcSkipStmts)

  // Season rollover — run distillery production + regenerate market prices
  if (nextIndex === 0) {
    const { results: distilleries } = await c.env.PROHIBITIONDB.prepare(
      `SELECT d.city_id, d.tier, cp.primary_alcohol
       FROM distilleries d
       JOIN game_players gp ON d.player_id = gp.id
       JOIN game_cities  gc ON d.city_id   = gc.id
       JOIN city_pool    cp ON gc.city_pool_id = cp.id
       WHERE gp.game_id = ?`
    ).bind(gameId).all<{ city_id: number; tier: number; primary_alcohol: string }>()
    const prodStmts = distilleries.map(d => c.env.PROHIBITIONDB.prepare(
      `INSERT INTO city_inventory (game_id, city_id, alcohol_type, quantity) VALUES (?, ?, ?, ?)
       ON CONFLICT(game_id, city_id, alcohol_type) DO UPDATE SET quantity = quantity + excluded.quantity`
    ).bind(gameId, d.city_id, d.primary_alcohol, DISTILLERY_TIERS[d.tier]?.baseOutput ?? d.tier * 2))
    if (prodStmts.length > 0) await c.env.PROHIBITIONDB.batch(prodStmts)

    // New prices for the incoming season
    const { results: gameCities } = await c.env.PROHIBITIONDB.prepare(
      `SELECT gc.id, cp.primary_alcohol, gc.demand_index, cp.population_tier
       FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
       WHERE gc.game_id = ?`
    ).bind(gameId).all<{ id: number; primary_alcohol: string; demand_index: number; population_tier: string }>()
    await buildMarketPrices(c.env.PROHIBITIONDB, gameId, nextSeason, gameCities)

    // Passive heat: distillery heat + 1 per owned city − 3 natural decay
    // Distillery tiers: 1→0, 2→1, 3→1, 4→2, 5→4
    const { results: playerHeatRows } = await c.env.PROHIBITIONDB.prepare(
      `SELECT gp.id,
              COALESCE(SUM(DISTILLERY_HEAT.heat_val), 0) AS dist_heat,
              COUNT(DISTINCT gc.id) AS city_count
       FROM game_players gp
       LEFT JOIN (
         SELECT d.player_id,
                CASE d.tier
                  WHEN 1 THEN 0 WHEN 2 THEN 1 WHEN 3 THEN 1 WHEN 4 THEN 2 WHEN 5 THEN 4 ELSE 0
                END AS heat_val
         FROM distilleries d
         JOIN game_players gp2 ON d.player_id = gp2.id
         WHERE gp2.game_id = ?
       ) AS DISTILLERY_HEAT ON DISTILLERY_HEAT.player_id = gp.id
       LEFT JOIN game_cities gc ON gc.owner_player_id = gp.id AND gc.game_id = ?
       WHERE gp.game_id = ?
       GROUP BY gp.id`
    ).bind(gameId, gameId, gameId).all<{ id: number; dist_heat: number; city_count: number }>()
    const NATURAL_DECAY = 3
    const heatStmts = playerHeatRows
      .map(row => {
        const delta = row.dist_heat + row.city_count - NATURAL_DECAY
        return c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET heat = MAX(0, MIN(100, heat + ?)) WHERE id = ?`
        ).bind(delta, row.id)
      })
    if (heatStmts.length > 0) await c.env.PROHIBITIONDB.batch(heatStmts)

    // Per-vehicle heat decay (-3 per season)
    await c.env.PROHIBITIONDB.prepare(
      `UPDATE vehicles SET heat = MAX(0, heat - 3) WHERE game_id = ?`
    ).bind(gameId).run()

    // Expire lapsed bribes
    await c.env.PROHIBITIONDB.prepare(
      `UPDATE game_cities SET bribe_player_id = NULL, bribe_expires_season = NULL
       WHERE game_id = ? AND bribe_expires_season IS NOT NULL AND bribe_expires_season <= ?`
    ).bind(gameId, nextSeason).run()
  }

  // End game after Winter 1933 (season 52: Spring 1921 = 1, Winter 1933 = 52)
  const MAX_SEASON = 52
  if (nextSeason > MAX_SEASON) {
    await c.env.PROHIBITIONDB.prepare(
      `UPDATE games SET status = 'ended', current_player_index = ?, current_season = ? WHERE id = ?`
    ).bind(nextIndex, nextSeason, gameId).run()
    return c.json({ success: true, gameEnded: true, celebrations: celebrations.length > 0 ? celebrations : undefined })
  }

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE games SET current_player_index = ?, current_season = ? WHERE id = ?`
  ).bind(nextIndex, nextSeason, gameId).run()

  return c.json({ success: true, celebrations: celebrations.length > 0 ? celebrations : undefined })
})

gamesRouter.get('/:id/market', async (c) => {
  const gameId = c.req.param('id')
  const { results: prices } = await c.env.PROHIBITIONDB.prepare(
    `SELECT mp.city_id, mp.alcohol_type, mp.price, gc.demand_index, cp.primary_alcohol
     FROM market_prices mp
     JOIN game_cities gc ON mp.city_id = gc.id
     JOIN city_pool   cp ON gc.city_pool_id = cp.id
     JOIN games        g ON mp.game_id = g.id AND mp.season = g.current_season
     WHERE mp.game_id = ?
     ORDER BY mp.city_id, mp.price DESC`
  ).bind(gameId).all()

  return c.json({ success: true, data: { prices } })
})

gamesRouter.get('/:id/state', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, status, current_season, current_player_index, turn_deadline, player_count, invite_code, host_user_id, game_name
     FROM games WHERE id = ?`
  ).bind(gameId).first<{
    id: string; status: string; current_season: number;
    current_player_index: number; turn_deadline: string | null; player_count: number
    invite_code: string; host_user_id: number; game_name: string | null
  }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.character_class, gp.cash, gp.heat,
            gp.jail_until_season, gp.current_city_id, gp.home_city_id, gp.adjustment_cards
     FROM game_players gp
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; character_class: string;
    cash: number; heat: number; jail_until_season: number | null;
    current_city_id: number | null; home_city_id: number | null; adjustment_cards: number
  }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  const { results: players } = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.character_class, gp.is_npc, gp.current_city_id, gp.cash,
            gp.display_name, u.email
     FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id
     WHERE gp.game_id = ? ORDER BY gp.turn_order`
  ).bind(gameId).all<{
    id: number; turn_order: number; character_class: string; is_npc: number;
    current_city_id: number | null; cash: number; display_name: string | null; email: string | null
  }>()

  const { results: vehicleRows } = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, vehicle_type, city_id, heat FROM vehicles WHERE player_id = ? ORDER BY id`
  ).bind(player.id).all<{ id: number; vehicle_type: string; city_id: number; heat: number }>()

  const vehicleIds = vehicleRows.map(v => v.id)
  let vehicleInventories: Array<{ vehicle_id: number; alcohol_type: string; quantity: number }> = []
  if (vehicleIds.length > 0) {
    const { results: vinv } = await c.env.PROHIBITIONDB.prepare(
      `SELECT vehicle_id, alcohol_type, quantity FROM vehicle_inventory WHERE vehicle_id IN (${vehicleIds.map(() => '?').join(',')}) AND quantity > 0`
    ).bind(...vehicleIds).all<{ vehicle_id: number; alcohol_type: string; quantity: number }>()
    vehicleInventories = vinv
  }

  const { results: distilleries } = await c.env.PROHIBITIONDB.prepare(
    `SELECT d.id, d.city_id, d.tier, cp.primary_alcohol, cp.name AS city_name
     FROM distilleries d
     JOIN game_cities gc ON d.city_id = gc.id
     JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE d.player_id = ?`
  ).bind(player.id).all<{ id: number; city_id: number; tier: number; primary_alcohol: string; city_name: string }>()
  const distilleryCityIds = distilleries.map(d => d.city_id)

  // Bribe status for current city
  const bribedCityIds = player.current_city_id ? await (async () => {
    const { results: bribes } = await c.env.PROHIBITIONDB.prepare(
      `SELECT id FROM game_cities WHERE game_id = ? AND bribe_player_id = ? AND bribe_expires_season > ?`
    ).bind(gameId, player.id, game.current_season).all<{ id: number }>()
    return bribes.map(b => b.id)
  })() : []

  return c.json({
    success: true,
    data: {
      game: {
        status:               game.status,
        currentSeason:        game.current_season,
        currentPlayerIndex:   game.current_player_index,
        turnDeadline:         game.turn_deadline,
        inviteCode:           game.invite_code,
        gameName:             game.game_name ?? null,
        isHost:               game.host_user_id === userId
      },
      player: {
        id:               player.id,
        turnOrder:        player.turn_order,
        characterClass:   player.character_class,
        cash:             player.cash,
        heat:             player.heat,
        jailUntilSeason:  player.jail_until_season,
        currentCityId:    player.current_city_id,
        homeCityId:       player.home_city_id,
        adjustmentCards:  player.adjustment_cards,
        vehicles:         vehicleRows.map(v => ({
          id:          v.id,
          vehicleType: v.vehicle_type,
          cityId:      v.city_id,
          heat:        v.heat,
          inventory:   vehicleInventories.filter(i => i.vehicle_id === v.id).map(i => ({
            alcohol_type: i.alcohol_type,
            quantity:     i.quantity
          }))
        })),
        distilleryCityIds:  distilleryCityIds,
        bribedCityIds:      bribedCityIds,
        distilleries:       distilleries.map(d => ({
          id:            d.id,
          cityId:        d.city_id,
          tier:          d.tier,
          primaryAlcohol: d.primary_alcohol,
          cityName:      d.city_name
        }))
      },
      players: players.map(p => ({
        id:            p.id,
        turnOrder:     p.turn_order,
        characterClass: p.character_class,
        isNpc:         p.is_npc === 1,
        currentCityId: p.current_city_id,
        name:          p.display_name ?? (p.is_npc ? `NPC ${p.turn_order + 1}` : (p.email?.split('@')[0] ?? 'Player'))
      }))
    }
  })
})

gamesRouter.get('/:id/recap', async (c) => {
  const gameId = c.req.param('id')
  const row = await c.env.PROHIBITIONDB.prepare(
    `SELECT recap_markdown FROM games WHERE id = ? AND status = 'ended'`
  ).bind(gameId).first<{ recap_markdown: string | null }>()

  if (!row) return c.json({ success: false, message: 'Game not found or not ended' }, 404)
  return c.json({ success: true, data: { recap: row.recap_markdown } })
})

gamesRouter.get('/:id/networth', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT current_season FROM games WHERE id = ?`
  ).bind(gameId).first<{ current_season: number }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)

  // Cumulative distillery investment by tier
  const DIST_VALUE: Record<number, number> = { 1: 200, 2: 700, 3: 1700, 4: 3700, 5: 7700 }
  const VEHICLE_PRICES_MAP: Record<string, number> = {
    workhorse: 200, roadster: 500, truck: 700, whiskey_runner: 900
  }
  const BASE_PRICES: Record<string, number> = {
    beer: 15, gin: 25, rum: 20, whiskey: 30, moonshine: 20,
    vodka: 22, bourbon: 28, rye: 26, scotch: 35, tequila: 24,
    brandy: 28, wine: 18, vermouth: 22, malort: 15
  }

  const [
    { results: players },
    { results: allVehicleInventory },
    { results: allVehicles },
    { results: allDistilleries },
    { results: ownedCities },
    { results: avgPrices },
  ] = await Promise.all([
    c.env.PROHIBITIONDB.prepare(
      `SELECT gp.id, gp.user_id, gp.display_name, gp.cash, gp.is_npc, u.email
       FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id
       WHERE gp.game_id = ? ORDER BY gp.turn_order`
    ).bind(gameId).all<{ id: number; user_id: number; display_name: string | null; cash: number; is_npc: number; email: string | null }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT vi.alcohol_type, vi.quantity, v.player_id
       FROM vehicle_inventory vi
       JOIN vehicles v ON vi.vehicle_id = v.id
       JOIN game_players gp ON v.player_id = gp.id
       WHERE gp.game_id = ?`
    ).bind(gameId).all<{ alcohol_type: string; quantity: number; player_id: number }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT v.player_id, v.vehicle_type, v.purchase_price
       FROM vehicles v
       JOIN game_players gp ON v.player_id = gp.id
       WHERE gp.game_id = ?`
    ).bind(gameId).all<{ player_id: number; vehicle_type: string; purchase_price: number }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT d.player_id, d.tier
       FROM distilleries d
       JOIN game_players gp ON d.player_id = gp.id
       WHERE gp.game_id = ?`
    ).bind(gameId).all<{ player_id: number; tier: number }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT owner_player_id, claim_cost FROM game_cities WHERE game_id = ? AND owner_player_id IS NOT NULL`
    ).bind(gameId).all<{ owner_player_id: number; claim_cost: number }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT alcohol_type, AVG(price) AS avg_price
       FROM market_prices WHERE game_id = ? AND season = ? GROUP BY alcohol_type`
    ).bind(gameId, game.current_season).all<{ alcohol_type: string; avg_price: number }>(),
  ])

  const priceMap = new Map(avgPrices.map(p => [p.alcohol_type, Math.round(p.avg_price)]))

  const result = players.map(p => {
    const invItems  = allVehicleInventory.filter(i => i.player_id === p.id)
    const vehicles  = allVehicles.filter(v => v.player_id === p.id)
    const dists     = allDistilleries.filter(d => d.player_id === p.id)
    const cities    = ownedCities.filter(c => c.owner_player_id === p.id)

    const cashVal       = p.cash
    const inventoryVal  = invItems.reduce((s, i) => s + i.quantity * (priceMap.get(i.alcohol_type) ?? BASE_PRICES[i.alcohol_type] ?? 0), 0)
    const distilleryVal = dists.reduce((s, d) => s + (DIST_VALUE[d.tier] ?? 200), 0)
    const vehicleVal    = vehicles.reduce((s, v) => s + (VEHICLE_PRICES_MAP[v.vehicle_type] ?? v.purchase_price ?? 200), 0)
    const citiesVal     = cities.reduce((s, c) => s + (c.claim_cost ?? 0), 0)
    const total         = cashVal + inventoryVal + distilleryVal + vehicleVal + citiesVal

    return {
      playerId:  p.id,
      isYou:     p.user_id === userId,
      isNpc:     p.is_npc === 1,
      name:      p.display_name ?? (p.is_npc ? `NPC ${p.id}` : (p.email?.split('@')[0] ?? 'Player')),
      components: { cash: cashVal, inventory: inventoryVal, distilleries: distilleryVal, vehicles: vehicleVal, cities: citiesVal },
      total,
    }
  })

  result.sort((a, b) => b.total - a.total)
  return c.json({ success: true, data: { players: result } })
})

gamesRouter.get('/:id/map', async (c) => {
  const gameId = c.req.param('id')
  const { results: cities } = await c.env.PROHIBITIONDB.prepare(
    `SELECT gc.id, cp.name, cp.region, cp.primary_alcohol, gc.demand_index,
            cp.is_coastal, cp.population_tier, gc.owner_player_id, gc.claim_cost, gc.bribe_player_id, gc.bribe_expires_season,
            cp.lat, cp.lon
     FROM game_cities gc
     JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE gc.game_id = ?`
  ).bind(gameId).all()

  const { results: roads } = await c.env.PROHIBITIONDB.prepare(
    `SELECT from_city_id, to_city_id, distance_value FROM roads WHERE game_id = ?`
  ).bind(gameId).all()

  const { results: cityInventory } = await c.env.PROHIBITIONDB.prepare(
    `SELECT city_id, alcohol_type, quantity FROM city_inventory WHERE game_id = ? AND quantity > 0`
  ).bind(gameId).all()

  return c.json({ success: true, data: { cities, roads, cityInventory } })
})
