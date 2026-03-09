import { Hono } from 'hono'
import type { Env } from '../index'
import type { AuthVariables } from '../middleware/sessionAuth'
import { sessionAuth } from '../middleware/sessionAuth'
import { GameService } from '../services/GameService'

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

gamesRouter.post('/:id/turn', async (c) => {
  const gameId  = c.req.param('id')
  const userId  = c.get('userId')
  const actions = await c.req.json<unknown[]>()

  // Verify it's this player's turn
  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, g.current_player_index, g.current_season, g.status
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_player_index: number;
    current_season: number; status: string
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) {
    return c.json({ success: false, message: 'Not your turn' }, 400)
  }

  // Record turn actions in the turns table
  await c.env.PROHIBITIONDB.prepare(
    `INSERT INTO turns (game_id, player_id, season, actions)
     VALUES (?, ?, ?, ?)`
  ).bind(gameId, playerRow.id, playerRow.current_season, JSON.stringify(actions)).run()

  return c.json({ success: true, message: 'Turn submitted — resolution pending' })
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
