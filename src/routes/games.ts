import { Hono } from 'hono'
import type { Env } from '../index'
import type { AuthVariables } from '../middleware/sessionAuth'
import { sessionAuth } from '../middleware/sessionAuth'
import { GameService } from '../services/GameService'
import { calculateEffectiveMovement, resolveMovement, type RoadSegment } from '../game/movement'
import { generateRoads } from '../game/mapEngine'
import { updateCumulativeProgress } from '../game/missions'

export const gamesRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

gamesRouter.use('*', sessionAuth)

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

gamesRouter.post('/:id/turn', async (c) => {
  const gameId  = c.req.param('id')
  const userId  = c.get('userId')
  const actions = await c.req.json<unknown[]>()

  // Verify it's this player's turn
  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.current_city_id, gp.character_class, gp.vehicle,
            g.current_player_index, g.current_season, g.status, g.player_count
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_city_id: number | null
    character_class: string; vehicle: string
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

  // Resolve actions
  type Action = {
    type: string; targetPath?: number[]; roll?: number
    alcoholType?: string; quantity?: number; duration?: number
  }

  for (const action of actions as Action[]) {

    // ── Move ────────────────────────────────────────────────────────────────
    if (action.type === 'move' && action.targetPath && action.targetPath.length > 0 && playerRow.current_city_id != null) {
      const roll = (typeof action.roll === 'number' && action.roll >= 2 && action.roll <= 12)
        ? action.roll : 7

      const movementPoints = calculateEffectiveMovement(roll, playerRow.character_class, playerRow.vehicle)

      const { results: roadRows } = await c.env.PROHIBITIONDB.prepare(
        `SELECT from_city_id, to_city_id, distance_value FROM roads WHERE game_id = ?`
      ).bind(gameId).all<{ from_city_id: number; to_city_id: number; distance_value: number }>()

      const roads: RoadSegment[] = roadRows.map(r => ({
        fromCityId: r.from_city_id, toCityId: r.to_city_id, distanceValue: r.distance_value
      }))

      const result = resolveMovement(playerRow.current_city_id, action.targetPath, roads, movementPoints)

      await c.env.PROHIBITIONDB.prepare(
        `UPDATE game_players SET current_city_id = ? WHERE id = ?`
      ).bind(result.currentCityId, playerRow.id).run()

      // Track city visit for mission progress
      if (result.currentCityId !== playerRow.current_city_id) {
        await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, {
          type: 'city_visited', cityId: result.currentCityId
        })
      }
    }

    // ── Sell ────────────────────────────────────────────────────────────────
    if (action.type === 'sell' && action.alcoholType && action.quantity && action.quantity > 0 && playerRow.current_city_id != null) {
      const [priceRow, invRow] = await Promise.all([
        c.env.PROHIBITIONDB.prepare(
          `SELECT price FROM market_prices WHERE game_id = ? AND city_id = ? AND season = ? AND alcohol_type = ?`
        ).bind(gameId, playerRow.current_city_id, playerRow.current_season, action.alcoholType)
          .first<{ price: number }>(),
        c.env.PROHIBITIONDB.prepare(
          `SELECT quantity FROM inventory WHERE player_id = ? AND alcohol_type = ?`
        ).bind(playerRow.id, action.alcoholType).first<{ quantity: number }>(),
      ])

      const available = invRow?.quantity ?? 0
      const toSell = Math.min(action.quantity, available)

      if (toSell > 0 && priceRow) {
        const revenue = Math.round(toSell * priceRow.price)
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE inventory SET quantity = quantity - ? WHERE player_id = ? AND alcohol_type = ?`
        ).bind(toSell, playerRow.id, action.alcoholType).run()
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET cash = cash + ?, total_cash_earned = total_cash_earned + ? WHERE id = ?`
        ).bind(revenue, revenue, playerRow.id).run()
        await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, {
          type: 'sold_units', quantity: toSell, alcoholType: action.alcoholType, revenue
        })
      }
    }

    // ── Bribe Official ──────────────────────────────────────────────────────
    if (action.type === 'bribe_official' && playerRow.current_city_id != null) {
      const cityRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT cp.bribe_cost_multiplier FROM game_cities gc
         JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
      ).bind(playerRow.current_city_id).first<{ bribe_cost_multiplier: number }>()

      const baseCost = 200
      const bribeCost = Math.round(baseCost * (cityRow?.bribe_cost_multiplier ?? 1.0))
      const duration = typeof action.duration === 'number' ? action.duration : 4

      const freshCash = await c.env.PROHIBITIONDB.prepare(
        `SELECT cash FROM game_players WHERE id = ?`
      ).bind(playerRow.id).first<{ cash: number }>()

      if ((freshCash?.cash ?? 0) >= bribeCost) {
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET cash = cash - ? WHERE id = ?`
        ).bind(bribeCost, playerRow.id).run()
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_cities SET bribe_player_id = ?, bribe_expires_season = ? WHERE id = ?`
        ).bind(playerRow.id, playerRow.current_season + duration, playerRow.current_city_id).run()
        await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, { type: 'official_bribed' })
      }
    }
  }

  // Advance turn index, wrapping back to 0 and bumping season when all players have gone
  let nextIndex  = (playerRow.current_player_index + 1) % playerRow.player_count
  let nextSeason = playerRow.current_season + (nextIndex === 0 ? 1 : 0)

  // Auto-skip NPC players so the next human always sees it as their turn
  const SAFETY = playerRow.player_count
  for (let i = 0; i < SAFETY; i++) {
    const next = await c.env.PROHIBITIONDB.prepare(
      `SELECT id, is_npc FROM game_players WHERE game_id = ? AND turn_order = ?`
    ).bind(gameId, nextIndex).first<{ id: number; is_npc: number }>()
    if (!next || !next.is_npc) break

    await c.env.PROHIBITIONDB.prepare(
      `INSERT INTO turns (game_id, player_id, season, actions, skipped) VALUES (?, ?, ?, ?, 1)`
    ).bind(gameId, next.id, nextSeason, JSON.stringify([{ type: 'skip' }])).run()

    nextIndex  = (nextIndex + 1) % playerRow.player_count
    nextSeason += nextIndex === 0 ? 1 : 0
  }

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE games SET current_player_index = ?, current_season = ? WHERE id = ?`
  ).bind(nextIndex, nextSeason, gameId).run()

  return c.json({ success: true })
})

gamesRouter.get('/:id/market', async (c) => {
  const gameId = c.req.param('id')
  const { results: prices } = await c.env.PROHIBITIONDB.prepare(
    `SELECT mp.city_id, mp.alcohol_type, mp.price, mp.season,
            gc.demand_index
     FROM market_prices mp
     JOIN game_cities gc ON mp.city_id = gc.id
     WHERE mp.game_id = ?
     ORDER BY mp.city_id, mp.alcohol_type`
  ).bind(gameId).all()

  return c.json({ success: true, data: { prices } })
})

gamesRouter.get('/:id/state', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, status, current_season, current_player_index, turn_deadline, player_count, invite_code, host_user_id
     FROM games WHERE id = ?`
  ).bind(gameId).first<{
    id: string; status: string; current_season: number;
    current_player_index: number; turn_deadline: string | null; player_count: number
    invite_code: string; host_user_id: number
  }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.character_class, gp.vehicle, gp.cash, gp.heat,
            gp.jail_until_season, gp.current_city_id, gp.home_city_id, gp.adjustment_cards
     FROM game_players gp
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; character_class: string; vehicle: string;
    cash: number; heat: number; jail_until_season: number | null;
    current_city_id: number | null; home_city_id: number | null; adjustment_cards: number
  }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  const { results: players } = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.character_class, gp.is_npc, gp.current_city_id, gp.cash,
            u.email
     FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id
     WHERE gp.game_id = ? ORDER BY gp.turn_order`
  ).bind(gameId).all<{
    id: number; turn_order: number; character_class: string; is_npc: number;
    current_city_id: number | null; cash: number; email: string | null
  }>()

  const { results: inventory } = await c.env.PROHIBITIONDB.prepare(
    `SELECT alcohol_type, quantity FROM inventory WHERE player_id = ?`
  ).bind(player.id).all<{ alcohol_type: string; quantity: number }>()

  return c.json({
    success: true,
    data: {
      game: {
        status:               game.status,
        currentSeason:        game.current_season,
        currentPlayerIndex:   game.current_player_index,
        turnDeadline:         game.turn_deadline,
        inviteCode:           game.invite_code,
        isHost:               game.host_user_id === userId
      },
      player: {
        id:               player.id,
        turnOrder:        player.turn_order,
        characterClass:   player.character_class,
        vehicle:          player.vehicle,
        cash:             player.cash,
        heat:             player.heat,
        jailUntilSeason:  player.jail_until_season,
        currentCityId:    player.current_city_id,
        homeCityId:       player.home_city_id,
        adjustmentCards:  player.adjustment_cards,
        inventory:        inventory
      },
      players: players.map(p => ({
        id:            p.id,
        turnOrder:     p.turn_order,
        characterClass: p.character_class,
        isNpc:         p.is_npc === 1,
        currentCityId: p.current_city_id,
        name:          p.is_npc ? `NPC ${p.turn_order + 1}` : (p.email?.split('@')[0] ?? 'Player')
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

gamesRouter.get('/:id/map', async (c) => {
  const gameId = c.req.param('id')
  const { results: cities } = await c.env.PROHIBITIONDB.prepare(
    `SELECT gc.id, cp.name, cp.region, cp.primary_alcohol, gc.demand_index,
            cp.is_coastal, cp.population_tier, gc.owner_player_id, gc.bribe_player_id, gc.bribe_expires_season,
            cp.lat, cp.lon
     FROM game_cities gc
     JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE gc.game_id = ?`
  ).bind(gameId).all()

  const { results: roads } = await c.env.PROHIBITIONDB.prepare(
    `SELECT from_city_id, to_city_id, distance_value FROM roads WHERE game_id = ?`
  ).bind(gameId).all()

  return c.json({ success: true, data: { cities, roads } })
})
