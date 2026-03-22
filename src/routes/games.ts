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
import { applyBribeDuration, applyMovementModifier, applyCargoMultiplier, applyTakeoverCostModifier, applyProductionModifier, getCharacter } from '../game/characters'
import { PROXIMITY_RADIUS, STASH_COST, MAX_JAIL_SEASONS, boobytrapCost, coordDistance, ALCOHOL_EMOJI } from '../game/stash'
import { updateCumulativeProgress, checkAndCompleteMissions, drawMission, getMissionCard, type MissionSnapshot } from '../game/missions'
import { sendPushToUser } from '../services/webPush'

export const gamesRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

gamesRouter.use('*', sessionAuth)

// List games the authenticated user is a member of
gamesRouter.get('/', async (c) => {
  const userId = c.get('userId')
  const db = c.env.PROHIBITIONDB

  const [gamesResult, tombstonesResult] = await Promise.all([
    db.prepare(
      `SELECT g.id, g.status, g.current_season, g.invite_code, g.game_name,
              gp.turn_order, g.current_player_index,
              (gp.turn_order = g.current_player_index AND g.status = 'active') as is_my_turn
       FROM game_players gp
       JOIN games g ON g.id = gp.game_id
       WHERE gp.user_id = ?
       ORDER BY g.created_at DESC`
    ).bind(userId).all<{
      id: string; status: string; current_season: number; invite_code: string; game_name: string | null
      turn_order: number; current_player_index: number; is_my_turn: number
    }>(),
    db.prepare(
      `SELECT id, game_name FROM game_tombstones WHERE user_id = ? AND seen = 0`
    ).bind(userId).all<{ id: number; game_name: string | null }>(),
  ])

  // Mark tombstones as seen now that we're returning them
  if (tombstonesResult.results.length > 0) {
    await db.prepare(
      `UPDATE game_tombstones SET seen = 1 WHERE user_id = ? AND seen = 0`
    ).bind(userId).run()
  }

  return c.json({
    success: true,
    games: gamesResult.results,
    timedOutGames: tombstonesResult.results.map(t => t.game_name ?? 'Unnamed Game'),
  })
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

gamesRouter.post('/:id/tutorial-done', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  await c.env.PROHIBITIONDB.prepare(
    `UPDATE game_players SET tutorial_seen = 1 WHERE game_id = ? AND user_id = ?`
  ).bind(gameId, userId).run()
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

// Set max players (2-5) — host only, lobby only
gamesRouter.patch('/:id/max-players', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { maxPlayers } = await c.req.json<{ maxPlayers: number }>()

  if (!maxPlayers || maxPlayers < 2 || maxPlayers > 5) {
    return c.json({ success: false, message: 'Max players must be between 2 and 5' }, 400)
  }

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT status, host_user_id, player_count FROM games WHERE id = ?`
  ).bind(gameId).first<{ status: string; host_user_id: number; player_count: number }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)
  if (game.status !== 'lobby') return c.json({ success: false, message: 'Game already started' }, 400)
  if (game.host_user_id !== userId) return c.json({ success: false, message: 'Only the host can change this' }, 403)
  if (maxPlayers < game.player_count) {
    return c.json({ success: false, message: `${game.player_count} players already joined` }, 400)
  }

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE games SET max_players = ? WHERE id = ?`
  ).bind(Math.floor(maxPlayers), gameId).run()

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

  // Also send push if the invited email belongs to a registered user
  const invitedUser = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM users WHERE email = ?`
  ).bind(email).first<{ id: number }>()

  if (invitedUser) {
    c.executionCtx.waitUntil(
      sendPushToUser(
        c.env.PROHIBITIONDB,
        invitedUser.id,
        {
          title: `${hostName} invited you to ${gameName}`,
          body: 'Tap to join the game.',
          url: joinUrl,
        },
        c.env,
      )
    )
  }

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
            gp.stuck_until_season, gp.display_name,
            g.current_player_index, g.current_season, g.status, g.player_count
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_city_id: number | null
    character_class: string; heat: number; cash: number
    pending_police_encounter: string | null
    stuck_until_season: number | null; display_name: string | null
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
    alcoholType?: string; quantity?: number; vehicleId?: number; choice?: string; duration?: number
    vehicles?: Array<{ vehicleId: number; targetPath: number[]; allocatedPoints: number }>
  }
  let policeEncounterResult: { vehicleId?: number; bribeCost: number; populationTier: string; heat: number } | null = null
  const celebrations: Array<{ type: string; cityId?: number; newTier?: number; vehicleId?: string; missionCardId?: number; reward?: number }> = []
  const boughtThisTurn = new Map<number, number>()

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
      // Stuck enforcement — cannot move until season clears
      if (playerRow.stuck_until_season != null && playerRow.current_season <= playerRow.stuck_until_season) {
        continue
      }

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
        const newCityId = playerVehicles[0].city_id

        // Trap resolution — check BEFORE updating current_city_id so setter's DB position is still their prior city
        if (newCityId !== currentCityId) {
          const trapRow = await c.env.PROHIBITIONDB.prepare(
            `SELECT t.id, t.setter_player_id, t.consequence_type, t.consequence_params,
                    COALESCE(gp_s.display_name, u_s.email) AS setter_name,
                    gp_s.current_city_id AS setter_current_city
             FROM traps t
             JOIN game_players gp_s ON t.setter_player_id = gp_s.id
             LEFT JOIN users u_s ON gp_s.user_id = u_s.id
             WHERE t.game_id = ? AND t.city_id = ?`
          ).bind(gameId, newCityId).first<{
            id: number; setter_player_id: number; consequence_type: string
            consequence_params: string; setter_name: string | null; setter_current_city: number | null
          }>()

          // Fire if: trap exists AND setter has left this city (their DB city ≠ trap city)
          if (trapRow && trapRow.setter_current_city !== newCityId) {
            const params = JSON.parse(trapRow.consequence_params) as { seasons?: number; amount?: number; turns?: number }
            const setterName = trapRow.setter_name ?? 'Someone'
            const victimName = playerRow.display_name ?? 'Someone'

            if (trapRow.consequence_type === 'jail') {
              const seasons = Math.min(2, params.seasons ?? 1)
              await c.env.PROHIBITIONDB.prepare(
                `UPDATE game_players SET jail_until_season = ? WHERE id = ?`
              ).bind(playerRow.current_season + seasons, playerRow.id).run()
            } else if (trapRow.consequence_type === 'financial') {
              const amount = Math.max(0, params.amount ?? 100)
              await c.env.PROHIBITIONDB.prepare(
                `UPDATE game_players SET cash = MAX(0, cash - ?) WHERE id = ?`
              ).bind(amount, playerRow.id).run()
            } else if (trapRow.consequence_type === 'alcohol_loss') {
              let remaining = Math.max(1, params.amount ?? 5)
              const vehiclesHere = playerVehicles.filter(v => v.city_id === newCityId)
              for (const v of vehiclesHere) {
                if (remaining <= 0) break
                const { results: inv } = await c.env.PROHIBITIONDB.prepare(
                  `SELECT alcohol_type, quantity FROM vehicle_inventory WHERE vehicle_id = ? AND quantity > 0 ORDER BY quantity DESC`
                ).bind(v.id).all<{ alcohol_type: string; quantity: number }>()
                for (const row of inv) {
                  if (remaining <= 0) break
                  const take = Math.min(row.quantity, remaining)
                  await c.env.PROHIBITIONDB.prepare(
                    `UPDATE vehicle_inventory SET quantity = quantity - ? WHERE vehicle_id = ? AND alcohol_type = ?`
                  ).bind(take, v.id, row.alcohol_type).run()
                  remaining -= take
                }
              }
            } else if (trapRow.consequence_type === 'stuck') {
              const turns = Math.min(3, params.turns ?? 1)
              await c.env.PROHIBITIONDB.prepare(
                `UPDATE game_players SET stuck_until_season = ?, stuck_city_id = ? WHERE id = ?`
              ).bind(playerRow.current_season + turns, newCityId, playerRow.id).run()
            }

            const cityNameRow = await c.env.PROHIBITIONDB.prepare(
              `SELECT cp.name FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
            ).bind(newCityId).first<{ name: string }>()
            const cityName = cityNameRow?.name ?? 'an unknown city'

            const pendingTrapPayload = JSON.stringify({
              setterName,
              consequenceType: trapRow.consequence_type,
              cityName,
              params,
            })
            await c.env.PROHIBITIONDB.batch([
              c.env.PROHIBITIONDB.prepare(`DELETE FROM traps WHERE id = ?`).bind(trapRow.id),
              c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET pending_trap = ? WHERE id = ?`).bind(pendingTrapPayload, playerRow.id),
            ])
            const consequence = trapRow.consequence_type === 'jail'
              ? `thrown in jail for ${params.seasons ?? 1} season${(params.seasons ?? 1) !== 1 ? 's' : ''}`
              : trapRow.consequence_type === 'financial'
              ? `fined $${(params.amount ?? 100).toLocaleString()}`
              : trapRow.consequence_type === 'alcohol_loss'
              ? `lost ${params.amount ?? 5} units of cargo`
              : `stuck in ${cityName} for ${params.turns ?? 1} season${(params.turns ?? 1) !== 1 ? 's' : ''}`
            await c.env.PROHIBITIONDB.prepare(
              `INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`
            ).bind(gameId, playerRow.id, `🪤 ${setterName} left a trap in ${cityName}. ${victimName} walked right into it and was ${consequence}.`).run()
          }
        }

        // ── Courtesy payment — landing on another player's city ───────────────
        if (newCityId !== currentCityId) {
          const ownerRow = await c.env.PROHIBITIONDB.prepare(
            `SELECT gp.id, gp.cash, COALESCE(gp.display_name, u.email) AS owner_name,
                    (SELECT COUNT(*) FROM game_cities gc2 WHERE gc2.owner_player_id = gp.id AND gc2.game_id = ?) AS city_count
             FROM game_cities gc
             JOIN game_players gp ON gc.owner_player_id = gp.id
             LEFT JOIN users u ON gp.user_id = u.id
             WHERE gc.id = ? AND gc.owner_player_id IS NOT NULL AND gp.id != ?`
          ).bind(gameId, newCityId, playerRow.id).first<{
            id: number; cash: number; owner_name: string; city_count: number
          }>()

          if (ownerRow && ownerRow.city_count > 0) {
            // Skip toll if an active alliance exists between the two players
            const tollAllianceCheck = await c.env.PROHIBITIONDB.prepare(
              `SELECT id FROM alliances WHERE game_id = ? AND status = 'active'
               AND ((requester_player_id = ? AND recipient_player_id = ?)
                 OR (requester_player_id = ? AND recipient_player_id = ?))`
            ).bind(gameId, playerRow.id, ownerRow.id, ownerRow.id, playerRow.id).first()

            if (tollAllianceCheck) {
              // Allied — no toll
            } else {
            const toll = 10 * ownerRow.city_count
            const actualToll = Math.min(toll, currentCash)
            currentCash = Math.max(0, currentCash - toll)
            const cityNameRow2 = await c.env.PROHIBITIONDB.prepare(
              `SELECT cp.name FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
            ).bind(newCityId).first<{ name: string }>()
            const tollCityName = cityNameRow2?.name ?? 'the city'
            const victimName = playerRow.display_name ?? 'Someone'

            await c.env.PROHIBITIONDB.batch([
              c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(actualToll, playerRow.id),
              c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ? WHERE id = ?`).bind(actualToll, ownerRow.id),
              c.env.PROHIBITIONDB.prepare(`INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`)
                .bind(gameId, playerRow.id, `💰 ${victimName} paid ${ownerRow.owner_name} a $${actualToll} courtesy toll for passing through ${tollCityName}.`),
            ])
            } // end else (not allied)
          }
        }

        currentCityId = newCityId
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET current_city_id = ? WHERE id = ?`
        ).bind(currentCityId, playerRow.id).run()
        // Track city visit for mission progress
        await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, {
          type: 'city_visited', cityId: newCityId
        })
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
        const cargoSlots = applyCargoMultiplier(playerRow.character_class, vehicleDef?.cargoSlots ?? 16)
        const { results: currentInv } = await c.env.PROHIBITIONDB.prepare(
          `SELECT COALESCE(SUM(quantity), 0) AS used FROM vehicle_inventory WHERE vehicle_id = ?`
        ).bind(action.vehicleId).all<{ used: number }>()
        const cargoUsed = currentInv[0]?.used ?? 0
        const maxAfford = Math.floor(currentCash / priceRow.price)
        const alreadyBought = boughtThisTurn.get(action.vehicleId) ?? 0
        const turnBudget = cargoSlots - alreadyBought
        const toBuy = Math.min(requested, cargoSlots - cargoUsed, maxAfford, turnBudget)
        if (toBuy > 0) {
          boughtThisTurn.set(action.vehicleId, alreadyBought + toBuy)
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
        const cargoSlots = applyCargoMultiplier(playerRow.character_class, vehicleDef?.cargoSlots ?? 16)
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
    if (action.type === 'sell_city_stock' && action.alcoholType) {
      // Use the vehicle's city if a vehicleId was provided; fall back to player's current city.
      // This allows selling from a distillery city even when the player is physically elsewhere.
      const vehicleRowForSell = action.vehicleId != null ? playerVehicles.find(v => v.id === action.vehicleId) : null
      const sellCityId = vehicleRowForSell?.city_id ?? currentCityId
      if (sellCityId != null) {
        const ownedDistillery = await c.env.PROHIBITIONDB.prepare(
          `SELECT id FROM distilleries WHERE player_id = ? AND city_id = ?`
        ).bind(playerRow.id, sellCityId).first()
        if (ownedDistillery) {
          const cityInv = await c.env.PROHIBITIONDB.prepare(
            `SELECT quantity FROM city_inventory WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
          ).bind(gameId, sellCityId, action.alcoholType).first<{ quantity: number }>()
          const toSell = cityInv?.quantity ?? 0
          if (toSell > 0) {
            const BASE_PRICES: Record<string, number> = {
              beer: 15, gin: 25, rum: 20, whiskey: 30, moonshine: 20,
              vodka: 22, bourbon: 28, rye: 26, scotch: 35, tequila: 24,
              brandy: 28, wine: 18, vermouth: 22, malort: 15
            }
            const priceRow = await c.env.PROHIBITIONDB.prepare(
              `SELECT price FROM market_prices WHERE game_id = ? AND city_id = ? AND season = ? AND alcohol_type = ?`
            ).bind(gameId, sellCityId, playerRow.current_season, action.alcoholType).first<{ price: number }>()
            const charMods = getCharacter(playerRow.character_class)?.modifiers
            const sellMult = action.alcoholType === 'whiskey' && charMods?.medicinalPriceMultiplier != null && charMods.medicinalPriceMultiplier !== 1.0
              ? charMods.medicinalPriceMultiplier
              : (charMods?.sellPriceMultiplier ?? 1.0)
            const unitPrice = Math.round((priceRow?.price ?? BASE_PRICES[action.alcoholType] ?? 20) * sellMult)
            const revenue = Math.floor(unitPrice * toSell)
            currentCash += revenue
            await c.env.PROHIBITIONDB.batch([
              c.env.PROHIBITIONDB.prepare(
                `UPDATE city_inventory SET quantity = 0 WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
              ).bind(gameId, sellCityId, action.alcoholType),
              c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ?, total_cash_earned = total_cash_earned + ? WHERE id = ?`).bind(revenue, revenue, playerRow.id)
            ])
            await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, {
              type: 'sold_units', quantity: toSell, alcoholType: action.alcoholType, revenue
            })
          }
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
        const charMods2 = getCharacter(playerRow.character_class)?.modifiers
        const sellMult2 = action.alcoholType === 'whiskey' && charMods2?.medicinalPriceMultiplier != null && charMods2.medicinalPriceMultiplier !== 1.0
          ? charMods2.medicinalPriceMultiplier
          : (charMods2?.sellPriceMultiplier ?? 1.0)
        const unitPrice = Math.round((priceRow?.price ?? BASE_PRICES[action.alcoholType] ?? 20) * sellMult2)
        const revenue = Math.floor(unitPrice * toSell)
        currentCash += revenue
        await c.env.PROHIBITIONDB.batch([
          c.env.PROHIBITIONDB.prepare(
            `UPDATE vehicle_inventory SET quantity = quantity - ? WHERE vehicle_id = ? AND alcohol_type = ?`
          ).bind(toSell, action.vehicleId, action.alcoholType),
          c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ?, total_cash_earned = total_cash_earned + ? WHERE id = ?`).bind(revenue, revenue, playerRow.id)
        ])
        await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, {
          type: 'sold_units', quantity: toSell, alcoholType: action.alcoholType, revenue
        })
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
          await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, { type: 'official_bribed' })
        }
      }
    }

    // ── Draw Mission ──────────────────────────────────────────────────────────
    if (action.type === 'draw_mission') {
      const countRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT COUNT(*) AS count FROM player_missions WHERE player_id = ? AND status = 'held'`
      ).bind(playerRow.id).first<{ count: number }>()
      if ((countRow?.count ?? 0) < 3) {
        await drawMission(c.env.PROHIBITIONDB, gameId, playerRow.id, playerRow.current_season)
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
          : Math.floor(applyTakeoverCostModifier(playerRow.character_class,
              (cityRow.claim_cost ?? BASE_CLAIM[cityRow.population_tier] ?? 500) * 2))
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
          celebrations.push({ type: 'upgrade_vehicle', vehicleId: vehicleType })
        }
      }
    }
  }

  // ── Check mission completion (after all actions, before turn advance) ──────
  if (!policeEncounterResult) {
    const [freshRow, maxTierRow, cityCountRow, vehicleCountRow, cargoRows] = await Promise.all([
      c.env.PROHIBITIONDB.prepare(
        `SELECT cash, heat, total_cash_earned, consecutive_clean_seasons FROM game_players WHERE id = ?`
      ).bind(playerRow.id).first<{ cash: number; heat: number; total_cash_earned: number; consecutive_clean_seasons: number }>(),
      c.env.PROHIBITIONDB.prepare(`SELECT MAX(tier) AS max_tier FROM distilleries WHERE player_id = ?`)
        .bind(playerRow.id).first<{ max_tier: number | null }>(),
      c.env.PROHIBITIONDB.prepare(
        `SELECT COUNT(*) AS cnt FROM game_cities WHERE owner_player_id = ? AND game_id = ?`
      ).bind(playerRow.id, gameId).first<{ cnt: number }>(),
      c.env.PROHIBITIONDB.prepare(`SELECT COUNT(*) AS cnt FROM vehicles WHERE player_id = ?`)
        .bind(playerRow.id).first<{ cnt: number }>(),
      c.env.PROHIBITIONDB.prepare(
        `SELECT vi.alcohol_type, SUM(vi.quantity) AS qty
         FROM vehicle_inventory vi JOIN vehicles v ON vi.vehicle_id = v.id
         WHERE v.player_id = ? GROUP BY vi.alcohol_type`
      ).bind(playerRow.id).all<{ alcohol_type: string; qty: number }>(),
    ])
    const cargoByType: Record<string, number> = {}
    let totalCargoUnits = 0
    for (const r of cargoRows.results) { cargoByType[r.alcohol_type] = r.qty; totalCargoUnits += r.qty }
    const snapshot: MissionSnapshot = {
      cash: freshRow?.cash ?? 0,
      citiesOwned: cityCountRow?.cnt ?? 0,
      vehiclesOwned: vehicleCountRow?.cnt ?? 0,
      maxDistilleryTier: maxTierRow?.max_tier ?? 1,
      totalCargoUnits,
      cargoByType,
      heat: freshRow?.heat ?? 0,
      totalCashEarned: freshRow?.total_cash_earned ?? 0,
      consecutiveCleanSeasons: freshRow?.consecutive_clean_seasons ?? 0,
    }
    const missionResult = await checkAndCompleteMissions(
      c.env.PROHIBITIONDB, gameId, playerRow.id, playerRow.current_season, snapshot
    )
    for (const cardId of missionResult.completedCardIds) {
      celebrations.push({ type: 'mission_complete', missionCardId: cardId, reward: getMissionCard(cardId)?.reward ?? 0 })
    }
  }

  // If a police encounter was triggered this turn, hold the turn until the player resolves it
  if (policeEncounterResult) {
    return c.json({ success: true, policeEncounter: policeEncounterResult } as object)
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
      `SELECT d.city_id, d.tier, cp.primary_alcohol, gp.character_class, cp.is_coastal
       FROM distilleries d
       JOIN game_players gp ON d.player_id = gp.id
       JOIN game_cities  gc ON d.city_id   = gc.id
       JOIN city_pool    cp ON gc.city_pool_id = cp.id
       WHERE gp.game_id = ?`
    ).bind(gameId).all<{ city_id: number; tier: number; primary_alcohol: string; character_class: string; is_coastal: number }>()
    const prodStmts = distilleries.map(d => {
      const baseOutput = DISTILLERY_TIERS[d.tier]?.baseOutput ?? d.tier * 2
      const coastalMult = d.is_coastal === 1 ? (getCharacter(d.character_class)?.modifiers.coastalProductionMultiplier ?? 1.0) : 1.0
      const output = Math.floor(applyProductionModifier(d.character_class, baseOutput) * coastalMult)
      return c.env.PROHIBITIONDB.prepare(
        `INSERT INTO city_inventory (game_id, city_id, alcohol_type, quantity) VALUES (?, ?, ?, ?)
         ON CONFLICT(game_id, city_id, alcohol_type) DO UPDATE SET quantity = quantity + excluded.quantity`
      ).bind(gameId, d.city_id, d.primary_alcohol, output)
    })
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

    // Per-player passive heat decay — priest/nun decays 2× faster
    const { results: heatPlayers } = await c.env.PROHIBITIONDB.prepare(
      `SELECT id, heat, character_class FROM game_players WHERE game_id = ? AND heat > 0`
    ).bind(gameId).all<{ id: number; heat: number; character_class: string }>()
    const BASE_HEAT_DECAY = 5
    await Promise.all(heatPlayers.map(p => {
      const decay = Math.floor(BASE_HEAT_DECAY * (getCharacter(p.character_class)?.modifiers.heatDecayMultiplier ?? 1.0))
      return c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET heat = MAX(0, heat - ?) WHERE id = ?`)
        .bind(decay, p.id).run()
    }))

    // Jazz Singer passive income: $50 per large city, $100 per major city owned
    const { results: jazzRows } = await c.env.PROHIBITIONDB.prepare(
      `SELECT gp.id, cp.population_tier
       FROM game_players gp
       JOIN game_cities gc ON gc.owner_player_id = gp.id AND gc.game_id = gp.game_id
       JOIN city_pool cp ON gc.city_pool_id = cp.id
       WHERE gp.game_id = ? AND gp.character_class = 'jazz_singer'
         AND cp.population_tier IN ('large', 'major')`
    ).bind(gameId).all<{ id: number; population_tier: string }>()
    const JAZZ_INCOME: Record<string, number> = { large: 50, major: 100 }
    const jazzMap = new Map<number, number>()
    for (const r of jazzRows) jazzMap.set(r.id, (jazzMap.get(r.id) ?? 0) + (JAZZ_INCOME[r.population_tier] ?? 0))
    await Promise.all([...jazzMap.entries()].map(([pid, income]) =>
      c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ? WHERE id = ?`).bind(income, pid).run()
    ))
  }

  // End game after Winter 1933 (season 52: Spring 1921 = 1, Winter 1933 = 52)
  const MAX_SEASON = 52
  if (nextSeason > MAX_SEASON) {
    await c.env.PROHIBITIONDB.prepare(
      `UPDATE games SET status = 'ended', current_player_index = ?, current_season = ? WHERE id = ?`
    ).bind(nextIndex, nextSeason, gameId).run()
    return c.json({ success: true, gameEnded: true, celebrations: celebrations.length > 0 ? celebrations : undefined })
  }

  // ── Season rollover ───────────────────────────────────────────────────────
  const isSeasonRollover = nextIndex === 0 && nextSeason > playerRow.current_season
  if (isSeasonRollover) {
    // Update consecutive_clean_seasons: reset for jailed players, +1 for clean
    await c.env.PROHIBITIONDB.prepare(`
      UPDATE game_players
      SET consecutive_clean_seasons = CASE
        WHEN jail_until_season IS NOT NULL AND jail_until_season >= ? THEN 0
        ELSE consecutive_clean_seasons + 1
      END
      WHERE game_id = ?
    `).bind(nextSeason, gameId).run()

    // End-game: season 52 completed (nextSeason would be 53)
    if (nextSeason > 52) {
      // Apply end-game penalties for incomplete missions (human players only)
      const { results: incompleteMissions } = await c.env.PROHIBITIONDB.prepare(
        `SELECT pm.player_id, pm.card_id FROM player_missions pm
         JOIN game_players gp ON pm.player_id = gp.id
         WHERE gp.game_id = ? AND pm.status = 'held' AND gp.is_npc = 0`
      ).bind(gameId).all<{ player_id: number; card_id: number }>()

      if (incompleteMissions.length > 0) {
        const penaltyMap = new Map<number, number>()
        for (const m of incompleteMissions) {
          const card = getMissionCard(m.card_id)
          if (card) penaltyMap.set(m.player_id, (penaltyMap.get(m.player_id) ?? 0) + card.reward)
        }
        const penaltyPlayerIds = [...penaltyMap.keys()]
        await Promise.all([
          c.env.PROHIBITIONDB.prepare(
            `UPDATE player_missions SET status = 'failed', penalty_paid = 1
             WHERE player_id IN (${penaltyPlayerIds.map(() => '?').join(',')}) AND status = 'held'`
          ).bind(...penaltyPlayerIds).run(),
          ...[...penaltyMap.entries()].map(([pid, penalty]) =>
            c.env.PROHIBITIONDB.prepare(
              `UPDATE game_players SET cash = MAX(0, cash - ?) WHERE id = ?`
            ).bind(penalty, pid).run()
          ),
        ])
      }

      await c.env.PROHIBITIONDB.prepare(
        `UPDATE games SET status = 'ended' WHERE id = ?`
      ).bind(gameId).run()
    }
  }

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE games SET current_player_index = ?, current_season = ? WHERE id = ?`
  ).bind(nextIndex, nextSeason, gameId).run()

  // Notify the next player by email if they don't have the game open
  const nextPlayer = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.user_id, gp.display_name, gp.last_seen_at, u.email, g.game_name
     FROM game_players gp
     JOIN users u ON gp.user_id = u.id
     JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.turn_order = ? AND gp.is_npc = 0`
  ).bind(gameId, nextIndex).first<{
    user_id: number; display_name: string | null; last_seen_at: number | null; email: string | null; game_name: string | null
  }>()

  const STALE_SECONDS = 120
  const isAway = !nextPlayer?.last_seen_at || (Math.floor(Date.now() / 1000) - nextPlayer.last_seen_at) > STALE_SECONDS

  if (nextPlayer?.email && isAway) {
    c.executionCtx.waitUntil(
      fetch('https://3mails.ai/api/transactional/3bfc8350-7d53-4ab4-ab58-10b840801309/send', {
        method: 'POST',
        headers: {
          'X-API-Key': 'b6be654296ba482a8a064d11de54d39cb274e84c00d5d5eb836b3942ca74fec0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: nextPlayer.email,
          variables: {
            playerName: nextPlayer.display_name ?? nextPlayer.email.split('@')[0],
            gameName: nextPlayer.game_name ?? 'Prohibition',
            gameUrl: `https://prohibitioner.com/games/${gameId}`,
          },
        }),
      }).catch(() => {})
    )
  }

  if (nextPlayer?.user_id && isAway) {
    c.executionCtx.waitUntil(
      sendPushToUser(
        c.env.PROHIBITIONDB,
        nextPlayer.user_id,
        {
          title: `It's your turn — ${nextPlayer.game_name ?? 'Prohibition'}`,
          body: 'Your move, Boss.',
          url: `https://prohibitioner.com/games/${gameId}`,
        },
        c.env,
      )
    )
  }

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
    `SELECT id, status, current_season, current_player_index, turn_deadline, player_count, max_players, invite_code, host_user_id, game_name
     FROM games WHERE id = ?`
  ).bind(gameId).first<{
    id: string; status: string; current_season: number;
    current_player_index: number; turn_deadline: string | null; player_count: number; max_players: number
    invite_code: string; host_user_id: number; game_name: string | null
  }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.character_class, gp.cash, gp.heat,
            gp.jail_until_season, gp.current_city_id, gp.home_city_id, gp.adjustment_cards,
            gp.pending_drinks, gp.pending_trap, gp.stuck_until_season, gp.tutorial_seen,
            gp.total_cash_earned, gp.consecutive_clean_seasons
     FROM game_players gp
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; character_class: string;
    cash: number; heat: number; jail_until_season: number | null;
    current_city_id: number | null; home_city_id: number | null; adjustment_cards: number;
    pending_drinks: string | null; pending_trap: string | null; stuck_until_season: number | null
    tutorial_seen: number; total_cash_earned: number; consecutive_clean_seasons: number
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

  // Competitor still in current city (for sabotage button)
  const currentCityCompetitorStill = player.current_city_id ? await c.env.PROHIBITIONDB.prepare(
    `SELECT d.tier, d.player_id AS owner_player_id
     FROM distilleries d
     JOIN game_cities gc ON d.city_id = gc.id
     WHERE d.city_id = ?
       AND gc.owner_player_id IS NOT NULL
       AND d.player_id = gc.owner_player_id
       AND d.player_id != ?
     LIMIT 1`
  ).bind(player.current_city_id, player.id).first<{ tier: number; owner_player_id: number }>() : null

  // Alliances
  const { results: allianceRows } = await c.env.PROHIBITIONDB.prepare(
    `SELECT a.id, a.status, a.formed_season,
            a.requester_player_id, a.recipient_player_id,
            CASE WHEN a.requester_player_id = ? THEN a.recipient_player_id ELSE a.requester_player_id END AS partner_player_id,
            COALESCE(gp_p.display_name, u_p.email) AS partner_name
     FROM alliances a
     JOIN game_players gp_p ON gp_p.id = (CASE WHEN a.requester_player_id = ? THEN a.recipient_player_id ELSE a.requester_player_id END)
     LEFT JOIN users u_p ON gp_p.user_id = u_p.id
     WHERE a.game_id = ? AND (a.requester_player_id = ? OR a.recipient_player_id = ?)
       AND a.status IN ('pending', 'active')`
  ).bind(player.id, player.id, gameId, player.id, player.id).all<{
    id: number; status: string; formed_season: number | null
    requester_player_id: number; recipient_player_id: number
    partner_player_id: number; partner_name: string | null
  }>()

  // Traps: player's own active traps + whether current city already has one
  const [{ results: myTrapRows }, currentCityTrapRow] = await Promise.all([
    c.env.PROHIBITIONDB.prepare(
      `SELECT t.city_id, t.consequence_type, cp.name AS city_name
       FROM traps t
       JOIN game_cities gc ON t.city_id = gc.id
       JOIN city_pool cp ON gc.city_pool_id = cp.id
       WHERE t.game_id = ? AND t.setter_player_id = ?`
    ).bind(gameId, player.id).all<{ city_id: number; consequence_type: string; city_name: string }>(),
    player.current_city_id
      ? c.env.PROHIBITIONDB.prepare(
          `SELECT id FROM traps WHERE game_id = ? AND city_id = ?`
        ).bind(gameId, player.current_city_id).first<{ id: number }>()
      : Promise.resolve(null)
  ])

  const { results: missionRows } = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, card_id, status, progress, assigned_season
     FROM player_missions WHERE player_id = ? AND status = 'held' ORDER BY assigned_season`
  ).bind(player.id).all<{ id: number; card_id: number; status: string; progress: string; assigned_season: number }>()

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
        isHost:               game.host_user_id === userId,
        maxPlayers:           game.max_players,
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
        stuckUntilSeason:          player.stuck_until_season,
        tutorialSeen:              player.tutorial_seen === 1,
        totalCashEarned:           player.total_cash_earned,
        consecutiveCleanSeasons:   player.consecutive_clean_seasons,
        currentCityCompetitorStill: currentCityCompetitorStill
          ? { tier: currentCityCompetitorStill.tier, ownerPlayerId: currentCityCompetitorStill.owner_player_id }
          : null,
        currentCityHasTrap: !!currentCityTrapRow,
        myTraps:          myTrapRows.map(t => ({ cityId: t.city_id, consequenceType: t.consequence_type, cityName: t.city_name })),
        pendingDrinks:    JSON.parse(player.pending_drinks ?? '[]') as Array<{ senderName: string; alcoholType: string }>,
        pendingTrap:      player.pending_trap ? JSON.parse(player.pending_trap) as { setterName: string; consequenceType: string; cityName: string; params: Record<string, number> } : null,
        vehicles:         vehicleRows.map(v => ({
          id:          v.id,
          vehicleType: v.vehicle_type,
          cityId:      v.city_id,
          heat:        v.heat,
          cargoSlots:  applyCargoMultiplier(player.character_class, VEHICLES[v.vehicle_type]?.cargoSlots ?? 16),
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
          cityName:      d.city_name,
        })),
        missions:         missionRows.map(m => ({
          id:             m.id,
          cardId:         m.card_id,
          progress:       JSON.parse(m.progress),
          assignedSeason: m.assigned_season,
        }))
      },
      players: players.map(p => ({
        id:            p.id,
        turnOrder:     p.turn_order,
        characterClass: p.character_class,
        isNpc:         p.is_npc === 1,
        currentCityId: p.current_city_id,
        name:          p.display_name ?? (p.is_npc ? `NPC ${p.turn_order + 1}` : (p.email?.split('@')[0] ?? 'Player'))
      })),
      vehiclePrices: VEHICLE_PRICES,
      alliances: allianceRows.map(a => ({
        id:            a.id,
        status:        a.status,
        formedSeason:  a.formed_season,
        partnerPlayerId: a.partner_player_id,
        partnerName:   a.partner_name ?? 'Unknown',
        iRequested:    a.requester_player_id === player.id,
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
  const VEHICLE_PRICES_MAP = VEHICLE_PRICES
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

// POST /:id/stash — place a stash at the current city
gamesRouter.post('/:id/stash', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const body = await c.req.json<{
    stash_type: string; coord_x: number; coord_y: number
    cash_amount?: number; alcohol_type?: string; alcohol_qty?: number
    heat_spike?: number; jail_seasons?: number; cash_penalty?: number; note_text?: string
  }>()

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.current_city_id, gp.cash, gp.jail_until_season, gp.display_name,
            g.current_player_index, g.current_season, g.status
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_city_id: number | null; cash: number
    jail_until_season: number | null; display_name: string | null
    current_player_index: number; current_season: number; status: string
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) return c.json({ success: false, message: 'Not your turn' }, 400)
  if (playerRow.jail_until_season != null && playerRow.current_season <= playerRow.jail_until_season) {
    return c.json({ success: false, message: 'You are in jail' }, 400)
  }
  if (playerRow.current_city_id == null) return c.json({ success: false, message: 'Not in a city' }, 400)

  const { stash_type, coord_x, coord_y } = body
  if (!['money', 'alcohol', 'booby_trap', 'note'].includes(stash_type)) {
    return c.json({ success: false, message: 'Invalid stash_type' }, 400)
  }
  if (typeof coord_x !== 'number' || coord_x < 0 || coord_x > 1 ||
      typeof coord_y !== 'number' || coord_y < 0 || coord_y > 1) {
    return c.json({ success: false, message: 'Invalid coordinates' }, 400)
  }

  let extraCost = 0

  if (stash_type === 'money') {
    if (!body.cash_amount || body.cash_amount <= 0) return c.json({ success: false, message: 'cash_amount must be > 0' }, 400)
    extraCost = body.cash_amount
  }
  if (stash_type === 'alcohol') {
    if (!body.alcohol_qty || body.alcohol_qty < 1) return c.json({ success: false, message: 'alcohol_qty must be >= 1' }, 400)
    if (!body.alcohol_type) return c.json({ success: false, message: 'alcohol_type required' }, 400)
  }
  if (stash_type === 'booby_trap') {
    const hs = body.heat_spike ?? 0
    const js = body.jail_seasons ?? 0
    const cp = body.cash_penalty ?? 0
    if (hs < 0 || hs > 100) return c.json({ success: false, message: 'heat_spike must be 0–100' }, 400)
    if (js < 0 || js > MAX_JAIL_SEASONS) return c.json({ success: false, message: `jail_seasons must be 0–${MAX_JAIL_SEASONS}` }, 400)
    if (cp < 0) return c.json({ success: false, message: 'cash_penalty must be >= 0' }, 400)
    extraCost = boobytrapCost(hs, js, cp) - STASH_COST
  }
  if (stash_type === 'note') {
    const t = (body.note_text ?? '').trim()
    if (!t || t.length > 140) return c.json({ success: false, message: 'note_text must be 1–140 chars' }, 400)
  }

  const totalCost = STASH_COST + extraCost
  if (playerRow.cash < totalCost) return c.json({ success: false, message: 'Insufficient cash' }, 400)

  const cityNameRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT cp.name FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
  ).bind(playerRow.current_city_id).first<{ name: string }>()
  const cityName = cityNameRow?.name ?? 'the city'

  if (stash_type === 'alcohol') {
    const vehicle = await c.env.PROHIBITIONDB.prepare(
      `SELECT v.id FROM vehicles v
       JOIN vehicle_inventory vi ON vi.vehicle_id = v.id
       WHERE v.player_id = ? AND v.city_id = ? AND vi.alcohol_type = ? AND vi.quantity >= ?
       LIMIT 1`
    ).bind(playerRow.id, playerRow.current_city_id, body.alcohol_type, body.alcohol_qty).first<{ id: number }>()
    if (!vehicle) return c.json({ success: false, message: 'Insufficient alcohol stock in vehicle at this city' }, 400)

    await c.env.PROHIBITIONDB.batch([
      c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(STASH_COST, playerRow.id),
      c.env.PROHIBITIONDB.prepare(
        `UPDATE vehicle_inventory SET quantity = quantity - ? WHERE vehicle_id = ? AND alcohol_type = ?`
      ).bind(body.alcohol_qty, vehicle.id, body.alcohol_type),
      c.env.PROHIBITIONDB.prepare(
        `INSERT INTO city_stashes (game_id, city_id, placer_id, stash_type, coord_x, coord_y, alcohol_type, alcohol_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(gameId, playerRow.current_city_id, playerRow.id, stash_type, coord_x, coord_y, body.alcohol_type, body.alcohol_qty),
      c.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
      ).bind(gameId, playerRow.id, `${playerRow.display_name ?? 'Someone'} stashed something in ${cityName}`),
    ])
  } else {

    const stmts = [
      c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(totalCost, playerRow.id),
      c.env.PROHIBITIONDB.prepare(
        `INSERT INTO city_stashes (game_id, city_id, placer_id, stash_type, coord_x, coord_y,
           cash_amount, heat_spike, jail_seasons, cash_penalty, note_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        gameId, playerRow.current_city_id, playerRow.id, stash_type, coord_x, coord_y,
        body.cash_amount ?? null, body.heat_spike ?? null,
        body.jail_seasons ?? null, body.cash_penalty ?? null,
        stash_type === 'note' ? (body.note_text ?? '').trim() : null
      ),
      c.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
      ).bind(gameId, playerRow.id, `${playerRow.display_name ?? 'Someone'} stashed something in ${cityName}`),
    ]
    await c.env.PROHIBITIONDB.batch(stmts)
  }

  return c.json({ success: true })
})

// POST /:id/retrieve — search for stashes at the current city
gamesRouter.post('/:id/retrieve', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const body = await c.req.json<{ coord_x: number; coord_y: number }>()

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.current_city_id, gp.cash, gp.heat, gp.jail_until_season,
            gp.display_name, g.current_player_index, g.current_season, g.status
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_city_id: number | null; cash: number; heat: number
    jail_until_season: number | null; display_name: string | null
    current_player_index: number; current_season: number; status: string
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) return c.json({ success: false, message: 'Not your turn' }, 400)
  if (playerRow.jail_until_season != null && playerRow.current_season <= playerRow.jail_until_season) {
    return c.json({ success: false, message: 'You are in jail' }, 400)
  }
  if (playerRow.current_city_id == null) return c.json({ success: false, message: 'Not in a city' }, 400)
  if (playerRow.cash < 10) return c.json({ success: false, message: 'Need $10 to search' }, 400)

  const { coord_x, coord_y } = body
  if (typeof coord_x !== 'number' || coord_x < 0 || coord_x > 1 ||
      typeof coord_y !== 'number' || coord_y < 0 || coord_y > 1) {
    return c.json({ success: false, message: 'Invalid coordinates' }, 400)
  }

  // Deduct search cost upfront
  await c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - 10 WHERE id = ?`).bind(playerRow.id).run()
  playerRow.cash -= 10

  const cityRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT cp.population_tier, cp.name FROM game_cities gc
     JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
  ).bind(playerRow.current_city_id).first<{ population_tier: string; name: string }>()
  const tier = cityRow?.population_tier ?? 'small'
  const cityName = cityRow?.name ?? 'the city'
  const radius = PROXIMITY_RADIUS[tier] ?? PROXIMITY_RADIUS.small

  const { results: allStashes } = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, stash_type, coord_x, coord_y, cash_amount, alcohol_type, alcohol_qty,
            heat_spike, jail_seasons, cash_penalty, note_text
     FROM city_stashes
     WHERE game_id = ? AND city_id = ? AND retrieved_by IS NULL`
  ).bind(gameId, playerRow.current_city_id).all<{
    id: number; stash_type: string; coord_x: number; coord_y: number
    cash_amount: number | null; alcohol_type: string | null; alcohol_qty: number | null
    heat_spike: number | null; jail_seasons: number | null; cash_penalty: number | null
    note_text: string | null
  }>()

  const nearby = allStashes.filter(s => coordDistance(coord_x, coord_y, s.coord_x, s.coord_y) <= radius)
  if (nearby.length === 0) return c.json({ success: true, found: [] })

  const stmts: ReturnType<typeof c.env.PROHIBITIONDB.prepare>[] = []
  const found: Array<Record<string, unknown>> = []
  const playerName = playerRow.display_name ?? 'Someone'

  let cashDelta = 0
  let heatDelta = 0
  let newJailUntil: number | null = null

  for (const stash of nearby) {
    stmts.push(
      c.env.PROHIBITIONDB.prepare(
        `UPDATE city_stashes SET retrieved_by = ?, retrieved_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(playerRow.id, stash.id)
    )

    if (stash.stash_type === 'money') {
      const amt = stash.cash_amount ?? 0
      cashDelta += amt
      stmts.push(c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ? WHERE id = ?`).bind(amt, playerRow.id))
      stmts.push(c.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
      ).bind(gameId, playerRow.id, `${playerName} retrieved $${amt} from ${cityName}`))
      found.push({ type: 'money', cash_amount: amt })
    }

    if (stash.stash_type === 'alcohol') {
      const qty = stash.alcohol_qty ?? 0
      const atype = stash.alcohol_type ?? 'alcohol'
      const finderVehicle = await c.env.PROHIBITIONDB.prepare(
        `SELECT id FROM vehicles WHERE player_id = ? AND city_id = ? LIMIT 1`
      ).bind(playerRow.id, playerRow.current_city_id).first<{ id: number }>()
      if (finderVehicle) {
        stmts.push(c.env.PROHIBITIONDB.prepare(
          `INSERT INTO vehicle_inventory (vehicle_id, alcohol_type, quantity) VALUES (?, ?, ?)
           ON CONFLICT(vehicle_id, alcohol_type) DO UPDATE SET quantity = quantity + excluded.quantity`
        ).bind(finderVehicle.id, atype, qty))
      }
      stmts.push(c.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
      ).bind(gameId, playerRow.id, `${playerName} retrieved ${qty} cases of ${atype} from ${cityName}`))
      found.push({ type: 'alcohol', alcohol_type: atype, alcohol_qty: qty })
    }

    if (stash.stash_type === 'booby_trap') {
      const hs = stash.heat_spike ?? 0
      const js = stash.jail_seasons ?? 0
      const cp = stash.cash_penalty ?? 0
      heatDelta += hs
      cashDelta -= cp
      if (js > 0) {
        const jailUntil = playerRow.current_season + js
        newJailUntil = Math.max(newJailUntil ?? 0, jailUntil)
      }
      stmts.push(c.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
      ).bind(gameId, playerRow.id, `${playerName} triggered a trap in ${cityName}`))
      found.push({ type: 'booby_trap', heat_spike: hs, jail_seasons: js, cash_penalty: cp })
    }

    if (stash.stash_type === 'note') {
      stmts.push(c.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
      ).bind(gameId, playerRow.id, `${playerName} found a note in ${cityName}`))
      found.push({ type: 'note', note_text: stash.note_text })
    }
  }

  // Apply aggregate player updates
  if (cashDelta !== 0 || heatDelta !== 0 || newJailUntil != null) {
    if (newJailUntil != null) {
      stmts.push(c.env.PROHIBITIONDB.prepare(
        `UPDATE game_players SET cash = MAX(0, cash + ?), heat = MIN(100, heat + ?), jail_until_season = ? WHERE id = ?`
      ).bind(cashDelta, heatDelta, newJailUntil, playerRow.id))
    } else {
      stmts.push(c.env.PROHIBITIONDB.prepare(
        `UPDATE game_players SET cash = MAX(0, cash + ?), heat = MIN(100, heat + ?) WHERE id = ?`
      ).bind(cashDelta, heatDelta, playerRow.id))
    }
  }

  if (stmts.length > 0) await c.env.PROHIBITIONDB.batch(stmts)

  return c.json({ success: true, found })
})

// GET /:id/messages — poll for new chat messages since a given id
gamesRouter.get('/:id/messages', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const since = parseInt(c.req.query('since') ?? '0', 10) || 0

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM game_players WHERE game_id = ? AND user_id = ?`
  ).bind(gameId, userId).first<{ id: number }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT gm.id, gm.message, gm.created_at, gm.is_system, gp.display_name, gp.turn_order
     FROM game_messages gm
     JOIN game_players gp ON gp.id = gm.player_id
     WHERE gm.game_id = ? AND gm.id > ?
     ORDER BY gm.id ASC LIMIT 50`
  ).bind(gameId, since).all<{
    id: number; message: string; created_at: string; is_system: number; display_name: string | null; turn_order: number
  }>()

  const messages = results.map(r => ({
    id: r.id,
    message: r.message,
    createdAt: r.created_at,
    playerName: r.display_name ?? 'Player',
    turnOrder: r.turn_order,
    isSystem: r.is_system === 1,
  }))

  return c.json({ success: true, data: { messages } })
})

// POST /:id/messages — send a chat message
gamesRouter.post('/:id/messages', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { message } = await c.req.json<{ message: string }>()

  const trimmed = (message ?? '').trim()
  if (!trimmed || trimmed.length > 500) {
    return c.json({ success: false, message: 'Message must be 1–500 characters' }, 400)
  }

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM game_players WHERE game_id = ? AND user_id = ?`
  ).bind(gameId, userId).first<{ id: number }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  await c.env.PROHIBITIONDB.prepare(
    `INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`
  ).bind(gameId, player.id, trimmed).run()

  return c.json({ success: true })
})

// POST /:id/send-drink — send a drink from your inventory to another player (once per turn)
gamesRouter.post('/:id/send-drink', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { recipientPlayerId, alcoholType } = await c.req.json<{ recipientPlayerId: number; alcoholType: string }>()

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.jail_until_season, gp.display_name,
            gp.drink_sent_turn,
            g.current_player_index, g.current_season, g.status,
            u.email
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     LEFT JOIN users u ON gp.user_id = u.id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; jail_until_season: number | null; display_name: string | null
    drink_sent_turn: string | null
    current_player_index: number; current_season: number; status: string
    email: string | null
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) return c.json({ success: false, message: 'Not your turn' }, 400)
  if (playerRow.jail_until_season != null && playerRow.current_season <= playerRow.jail_until_season) {
    return c.json({ success: false, message: 'You are in jail' }, 400)
  }

  const turnKey = `${playerRow.current_season}:${playerRow.turn_order}`
  if (playerRow.drink_sent_turn === turnKey) {
    return c.json({ success: false, message: 'Already sent a drink this turn' }, 400)
  }

  // Validate recipient is another player in same game
  const recipient = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.display_name, gp.pending_drinks, u.email
     FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id
     WHERE gp.game_id = ? AND gp.id = ? AND gp.user_id != ?`
  ).bind(gameId, recipientPlayerId, userId).first<{
    id: number; display_name: string | null; pending_drinks: string | null; email: string | null
  }>()
  if (!recipient) return c.json({ success: false, message: 'Recipient not found' }, 400)

  // Find sender's vehicle with this alcohol type
  const senderVehicle = await c.env.PROHIBITIONDB.prepare(
    `SELECT vi.vehicle_id FROM vehicle_inventory vi
     JOIN vehicles v ON vi.vehicle_id = v.id
     WHERE v.player_id = ? AND vi.alcohol_type = ? AND vi.quantity >= 1 LIMIT 1`
  ).bind(playerRow.id, alcoholType).first<{ vehicle_id: number }>()
  if (!senderVehicle) return c.json({ success: false, message: `You don't have any ${alcoholType} in your fleet` }, 400)

  // Find recipient's first vehicle (create inventory entry there)
  const recipientVehicle = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM vehicles WHERE player_id = ? LIMIT 1`
  ).bind(recipient.id).first<{ id: number }>()
  if (!recipientVehicle) return c.json({ success: false, message: 'Recipient has no vehicle' }, 400)

  const senderName = playerRow.display_name ?? (playerRow.email?.split('@')[0] ?? 'Someone')
  const recipientName = recipient.display_name ?? (recipient.email?.split('@')[0] ?? 'Someone')
  const emoji = ALCOHOL_EMOJI[alcoholType] ?? '🥃'
  const typeLabel = alcoholType.charAt(0).toUpperCase() + alcoholType.slice(1)
  const chatMessage = `${senderName} slid ${recipientName} a ${emoji} ${typeLabel} — cheers! 🥂`

  const updatedPending = JSON.stringify([
    ...JSON.parse(recipient.pending_drinks ?? '[]') as Array<{ senderName: string; alcoholType: string }>,
    { senderName, alcoholType }
  ])

  await c.env.PROHIBITIONDB.batch([
    c.env.PROHIBITIONDB.prepare(
      `UPDATE vehicle_inventory SET quantity = quantity - 1 WHERE vehicle_id = ? AND alcohol_type = ?`
    ).bind(senderVehicle.vehicle_id, alcoholType),
    c.env.PROHIBITIONDB.prepare(
      `INSERT INTO vehicle_inventory (vehicle_id, alcohol_type, quantity) VALUES (?, ?, 1)
       ON CONFLICT(vehicle_id, alcohol_type) DO UPDATE SET quantity = quantity + 1`
    ).bind(recipientVehicle.id, alcoholType),
    c.env.PROHIBITIONDB.prepare(
      `UPDATE game_players SET drink_sent_turn = ? WHERE id = ?`
    ).bind(turnKey, playerRow.id),
    c.env.PROHIBITIONDB.prepare(
      `UPDATE game_players SET pending_drinks = ? WHERE id = ?`
    ).bind(updatedPending, recipient.id),
    c.env.PROHIBITIONDB.prepare(
      `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
    ).bind(gameId, playerRow.id, chatMessage),
  ])

  if (recipient.email) {
    c.executionCtx.waitUntil(
      fetch('https://3mails.ai/api/transactional/42b2381d-5b47-4025-90c5-808775da0f66/send', {
        method: 'POST',
        headers: {
          'X-API-Key': 'b6be654296ba482a8a064d11de54d39cb274e84c00d5d5eb836b3942ca74fec0',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipient.email,
          variables: {
            sender: senderName,
            drink: typeLabel,
            drinkImageUrl: `https://prohibitioner.com/drinks/${alcoholType}.png`,
          },
        }),
      }).catch(() => {})
    )
  }

  return c.json({ success: true })
})

// POST /:id/heartbeat — record that the player currently has the game open
gamesRouter.post('/:id/heartbeat', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const now = Math.floor(Date.now() / 1000)
  await c.env.PROHIBITIONDB.prepare(
    `UPDATE game_players SET last_seen_at = ? WHERE game_id = ? AND user_id = ?`
  ).bind(now, gameId, userId).run()
  return c.json({ success: true })
})

// POST /:id/traps — set a trap in the player's current city
gamesRouter.post('/:id/traps', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { cityId, consequenceType, consequenceParams } = await c.req.json<{
    cityId: number
    consequenceType: 'jail' | 'alcohol_loss' | 'financial' | 'stuck'
    consequenceParams: { seasons?: number; amount?: number; turns?: number }
  }>()

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.current_city_id, gp.cash, gp.jail_until_season,
            g.current_player_index, g.current_season, g.status
     FROM game_players gp JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_city_id: number | null; cash: number
    jail_until_season: number | null
    current_player_index: number; current_season: number; status: string
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) return c.json({ success: false, message: 'Not your turn' }, 400)
  if (playerRow.jail_until_season != null && playerRow.current_season <= playerRow.jail_until_season) {
    return c.json({ success: false, message: 'Cannot set a trap while in jail' }, 400)
  }
  const vehicleAtCity = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM vehicles WHERE player_id = ? AND city_id = ?`
  ).bind(playerRow.id, cityId).first<{ id: number }>()
  if (!vehicleAtCity) {
    return c.json({ success: false, message: 'You must have a vehicle in this city to set a trap' }, 400)
  }

  // Validate and calculate cost
  let cost = 0
  if (consequenceType === 'jail') {
    const seasons = Math.min(2, Math.max(1, consequenceParams.seasons ?? 1))
    consequenceParams.seasons = seasons
    cost = 300 * seasons
  } else if (consequenceType === 'financial') {
    const amount = Math.max(100, consequenceParams.amount ?? 500)
    consequenceParams.amount = amount
    cost = Math.max(100, Math.round(amount * 0.4))
  } else if (consequenceType === 'alcohol_loss') {
    const amount = Math.min(50, Math.max(1, consequenceParams.amount ?? 5))
    consequenceParams.amount = amount
    cost = 20 * amount
  } else if (consequenceType === 'stuck') {
    const turns = Math.min(3, Math.max(1, consequenceParams.turns ?? 1))
    consequenceParams.turns = turns
    cost = 200 * turns
  } else {
    return c.json({ success: false, message: 'Invalid consequence type' }, 400)
  }

  if (playerRow.cash < cost) return c.json({ success: false, message: `Not enough cash (need $${cost})` }, 400)

  const existing = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM traps WHERE game_id = ? AND city_id = ?`
  ).bind(gameId, cityId).first<{ id: number }>()
  if (existing) return c.json({ success: false, message: 'This city already has a trap' }, 400)

  await c.env.PROHIBITIONDB.batch([
    c.env.PROHIBITIONDB.prepare(
      `UPDATE game_players SET cash = cash - ? WHERE id = ?`
    ).bind(cost, playerRow.id),
    c.env.PROHIBITIONDB.prepare(
      `INSERT INTO traps (game_id, city_id, setter_player_id, consequence_type, consequence_params, cost, created_season)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(gameId, cityId, playerRow.id, consequenceType, JSON.stringify(consequenceParams), cost, playerRow.current_season),
  ])

  return c.json({ success: true, cost })
})

// POST /:id/sabotage — downgrade a competitor's still by one tier (free action, costs cash + heat)
gamesRouter.post('/:id/sabotage', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { cityId } = await c.req.json<{ cityId: number }>()

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.current_city_id, gp.cash, gp.heat,
            gp.jail_until_season, gp.display_name,
            g.current_player_index, g.current_season, g.status
     FROM game_players gp JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_city_id: number | null; cash: number; heat: number
    jail_until_season: number | null; display_name: string | null
    current_player_index: number; current_season: number; status: string
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) return c.json({ success: false, message: 'Not your turn' }, 400)
  if (playerRow.jail_until_season != null && playerRow.current_season <= playerRow.jail_until_season) {
    return c.json({ success: false, message: 'Cannot sabotage while in jail' }, 400)
  }
  if (playerRow.current_city_id !== cityId) {
    return c.json({ success: false, message: 'You must be in this city' }, 400)
  }

  // Find city owner's still (must be owned city, still belongs to owner, not the current player)
  const stillRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT d.id, d.tier, d.player_id AS owner_player_id,
            COALESCE(gp_o.display_name, u_o.email) AS owner_name,
            cp.name AS city_name
     FROM distilleries d
     JOIN game_cities gc ON d.city_id = gc.id
     JOIN game_players gp_o ON d.player_id = gp_o.id
     LEFT JOIN users u_o ON gp_o.user_id = u_o.id
     JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE d.city_id = ?
       AND gc.owner_player_id IS NOT NULL
       AND d.player_id = gc.owner_player_id
       AND d.player_id != ?
     LIMIT 1`
  ).bind(cityId, playerRow.id).first<{
    id: number; tier: number; owner_player_id: number; owner_name: string | null; city_name: string
  }>()

  if (!stillRow) return c.json({ success: false, message: 'No competitor still found in this city' }, 400)
  if (stillRow.tier <= 1) return c.json({ success: false, message: 'Still is already at minimum tier' }, 400)

  // Alliance immunity — cannot sabotage an ally's still
  const allianceCheck = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM alliances
     WHERE game_id = ? AND status = 'active'
       AND ((requester_player_id = ? AND recipient_player_id = ?)
         OR (requester_player_id = ? AND recipient_player_id = ?))`
  ).bind(gameId, playerRow.id, stillRow.owner_player_id, stillRow.owner_player_id, playerRow.id).first()
  if (allianceCheck) return c.json({ success: false, message: 'Cannot sabotage an ally\'s still' }, 400)

  const cost = DISTILLERY_TIERS[stillRow.tier]?.cost ?? 0
  const heatIncrease = stillRow.tier * 10
  if (playerRow.cash < cost) return c.json({ success: false, message: `Not enough cash (need $${cost.toLocaleString()})` }, 400)

  const newTier = stillRow.tier - 1
  const attackerName = playerRow.display_name ?? 'Someone'
  const ownerName = stillRow.owner_name ?? 'Someone'

  await c.env.PROHIBITIONDB.batch([
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, playerRow.id),
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET heat = MIN(100, heat + ?) WHERE id = ?`).bind(heatIncrease, playerRow.id),
    c.env.PROHIBITIONDB.prepare(`UPDATE distilleries SET tier = ? WHERE id = ?`).bind(newTier, stillRow.id),
    c.env.PROHIBITIONDB.prepare(
      `INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`
    ).bind(gameId, playerRow.id,
      `💣 ${attackerName} sabotaged ${ownerName}'s still in ${stillRow.city_name}! Downgraded from Tier ${stillRow.tier} → Tier ${newTier}.`
    ),
  ])

  return c.json({ success: true, cost, heatIncrease, newTier })
})

// ── Alliance endpoints ────────────────────────────────────────────────────────

// POST /:id/alliances — send an alliance request
gamesRouter.post('/:id/alliances', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { recipientPlayerId } = await c.req.json<{ recipientPlayerId: number }>()

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.display_name FROM game_players gp
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number; display_name: string | null }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)
  if (player.id === recipientPlayerId) return c.json({ success: false, message: 'Cannot ally with yourself' }, 400)

  // Check no active/pending alliance already exists between these two
  const existing = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM alliances WHERE game_id = ? AND status IN ('pending','active')
     AND ((requester_player_id = ? AND recipient_player_id = ?)
       OR (requester_player_id = ? AND recipient_player_id = ?))`
  ).bind(gameId, player.id, recipientPlayerId, recipientPlayerId, player.id).first()
  if (existing) return c.json({ success: false, message: 'Alliance already exists or is pending' }, 400)

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT current_season FROM games WHERE id = ?`
  ).bind(gameId).first<{ current_season: number }>()

  await c.env.PROHIBITIONDB.prepare(
    `INSERT INTO alliances (game_id, requester_player_id, recipient_player_id) VALUES (?, ?, ?)`
  ).bind(gameId, player.id, recipientPlayerId).run()

  return c.json({ success: true })
})

// POST /:id/alliances/:aid/accept — accept a pending alliance request
gamesRouter.post('/:id/alliances/:aid/accept', async (c) => {
  const gameId = c.req.param('id')
  const allianceId = Number(c.req.param('aid'))
  const userId = c.get('userId')

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id FROM game_players gp WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  const alliance = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, requester_player_id, recipient_player_id, status FROM alliances WHERE id = ? AND game_id = ?`
  ).bind(allianceId, gameId).first<{ id: number; requester_player_id: number; recipient_player_id: number; status: string }>()
  if (!alliance) return c.json({ success: false, message: 'Alliance not found' }, 404)
  if (alliance.recipient_player_id !== player.id) return c.json({ success: false, message: 'Not the recipient' }, 403)
  if (alliance.status !== 'pending') return c.json({ success: false, message: 'Alliance is not pending' }, 400)

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT current_season FROM games WHERE id = ?`
  ).bind(gameId).first<{ current_season: number }>()

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE alliances SET status = 'active', formed_season = ? WHERE id = ?`
  ).bind(game?.current_season ?? 0, allianceId).run()

  return c.json({ success: true })
})

// POST /:id/alliances/:aid/decline — decline a pending request
gamesRouter.post('/:id/alliances/:aid/decline', async (c) => {
  const gameId = c.req.param('id')
  const allianceId = Number(c.req.param('aid'))
  const userId = c.get('userId')

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id FROM game_players gp WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  const alliance = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, recipient_player_id, status FROM alliances WHERE id = ? AND game_id = ?`
  ).bind(allianceId, gameId).first<{ id: number; recipient_player_id: number; status: string }>()
  if (!alliance || alliance.recipient_player_id !== player.id) return c.json({ success: false, message: 'Not found' }, 404)
  if (alliance.status !== 'pending') return c.json({ success: false, message: 'Not pending' }, 400)

  await c.env.PROHIBITIONDB.prepare(`DELETE FROM alliances WHERE id = ?`).bind(allianceId).run()
  return c.json({ success: true })
})

// POST /:id/alliances/:aid/break — break an active alliance (heat → 100 for breaker)
gamesRouter.post('/:id/alliances/:aid/break', async (c) => {
  const gameId = c.req.param('id')
  const allianceId = Number(c.req.param('aid'))
  const userId = c.get('userId')

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.display_name, COALESCE(gp.display_name, u.email) AS name
     FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number; display_name: string | null; name: string }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  const alliance = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, requester_player_id, recipient_player_id, status FROM alliances WHERE id = ? AND game_id = ?`
  ).bind(allianceId, gameId).first<{ id: number; requester_player_id: number; recipient_player_id: number; status: string }>()
  if (!alliance) return c.json({ success: false, message: 'Alliance not found' }, 404)
  if (alliance.requester_player_id !== player.id && alliance.recipient_player_id !== player.id) {
    return c.json({ success: false, message: 'Not in this alliance' }, 403)
  }
  if (alliance.status !== 'active') return c.json({ success: false, message: 'Alliance is not active' }, 400)

  const partnerId = alliance.requester_player_id === player.id ? alliance.recipient_player_id : alliance.requester_player_id
  const partnerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT COALESCE(gp.display_name, u.email) AS name FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id WHERE gp.id = ?`
  ).bind(partnerId).first<{ name: string }>()

  await c.env.PROHIBITIONDB.batch([
    c.env.PROHIBITIONDB.prepare(`UPDATE alliances SET status = 'broken' WHERE id = ?`).bind(allianceId),
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET heat = 100 WHERE id = ?`).bind(player.id),
    c.env.PROHIBITIONDB.prepare(`INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`)
      .bind(gameId, player.id, `🔥 ${player.name} betrayed their alliance with ${partnerRow?.name ?? 'an ally'}. The heat is on.`),
  ])

  return c.json({ success: true })
})

// POST /:id/alliances/:aid/transfer — transfer cash to ally (logged in group chat)
gamesRouter.post('/:id/alliances/:aid/transfer', async (c) => {
  const gameId = c.req.param('id')
  const allianceId = Number(c.req.param('aid'))
  const userId = c.get('userId')
  const { amount } = await c.req.json<{ amount: number }>()

  if (!amount || amount <= 0) return c.json({ success: false, message: 'Invalid amount' }, 400)

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.cash, COALESCE(gp.display_name, u.email) AS name
     FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number; cash: number; name: string }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)
  if (player.cash < amount) return c.json({ success: false, message: 'Not enough cash' }, 400)

  const alliance = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, requester_player_id, recipient_player_id, status FROM alliances WHERE id = ? AND game_id = ?`
  ).bind(allianceId, gameId).first<{ id: number; requester_player_id: number; recipient_player_id: number; status: string }>()
  if (!alliance || alliance.status !== 'active') return c.json({ success: false, message: 'No active alliance' }, 400)
  if (alliance.requester_player_id !== player.id && alliance.recipient_player_id !== player.id) {
    return c.json({ success: false, message: 'Not in this alliance' }, 403)
  }

  const partnerId = alliance.requester_player_id === player.id ? alliance.recipient_player_id : alliance.requester_player_id
  const partnerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT COALESCE(gp.display_name, u.email) AS name FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id WHERE gp.id = ?`
  ).bind(partnerId).first<{ name: string }>()

  await c.env.PROHIBITIONDB.batch([
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(amount, player.id),
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ? WHERE id = ?`).bind(amount, partnerId),
    c.env.PROHIBITIONDB.prepare(`INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`)
      .bind(gameId, player.id, `💸 ${player.name} transferred $${amount.toLocaleString()} to ${partnerRow?.name ?? 'an ally'}.`),
  ])

  return c.json({ success: true })
})

// GET /:id/alliances/:aid/chat — fetch alliance private chat
gamesRouter.get('/:id/alliances/:aid/chat', async (c) => {
  const gameId = c.req.param('id')
  const allianceId = Number(c.req.param('aid'))
  const userId = c.get('userId')

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id FROM game_players gp WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  const alliance = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, requester_player_id, recipient_player_id, status FROM alliances WHERE id = ? AND game_id = ?`
  ).bind(allianceId, gameId).first<{ id: number; requester_player_id: number; recipient_player_id: number; status: string }>()
  if (!alliance) return c.json({ success: false, message: 'Not found' }, 404)
  if (alliance.requester_player_id !== player.id && alliance.recipient_player_id !== player.id) {
    return c.json({ success: false, message: 'Not in this alliance' }, 403)
  }

  const { results: messages } = await c.env.PROHIBITIONDB.prepare(
    `SELECT ac.id, ac.player_id, ac.message, ac.created_at,
            COALESCE(gp.display_name, u.email) AS sender_name
     FROM alliance_chat ac
     JOIN game_players gp ON ac.player_id = gp.id
     LEFT JOIN users u ON gp.user_id = u.id
     WHERE ac.alliance_id = ?
     ORDER BY ac.created_at ASC`
  ).bind(allianceId).all<{ id: number; player_id: number; message: string; created_at: string; sender_name: string | null }>()

  return c.json({ success: true, messages: messages.map(m => ({
    id: m.id,
    playerId: m.player_id,
    message: m.message,
    createdAt: m.created_at,
    senderName: m.sender_name ?? 'Unknown',
    isMe: m.player_id === player.id,
  }))})
})

// POST /:id/alliances/:aid/chat — send a message in alliance private chat
gamesRouter.post('/:id/alliances/:aid/chat', async (c) => {
  const gameId = c.req.param('id')
  const allianceId = Number(c.req.param('aid'))
  const userId = c.get('userId')
  const { message } = await c.req.json<{ message: string }>()

  if (!message?.trim()) return c.json({ success: false, message: 'Empty message' }, 400)

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id FROM game_players gp WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  const alliance = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, requester_player_id, recipient_player_id, status FROM alliances WHERE id = ? AND game_id = ?`
  ).bind(allianceId, gameId).first<{ id: number; requester_player_id: number; recipient_player_id: number; status: string }>()
  if (!alliance || alliance.status !== 'active') return c.json({ success: false, message: 'No active alliance' }, 404)
  if (alliance.requester_player_id !== player.id && alliance.recipient_player_id !== player.id) {
    return c.json({ success: false, message: 'Not in this alliance' }, 403)
  }

  await c.env.PROHIBITIONDB.prepare(
    `INSERT INTO alliance_chat (alliance_id, player_id, message) VALUES (?, ?, ?)`
  ).bind(allianceId, player.id, message.trim()).run()

  return c.json({ success: true })
})

// POST /:id/dismiss-drinks — clear the caller's pending drink notifications
gamesRouter.post('/:id/dismiss-drinks', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE game_players SET pending_drinks = NULL, pending_trap = NULL WHERE game_id = ? AND user_id = ?`
  ).bind(gameId, userId).run()

  return c.json({ success: true })
})
