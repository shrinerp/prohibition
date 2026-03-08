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
    `SELECT gp.id, gp.turn_order, g.current_turn_player_index, g.current_season, g.status, g.turn_started_at
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_turn_player_index: number;
    current_season: number; status: string; turn_started_at: number | null
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_turn_player_index) {
    return c.json({ success: false, message: 'Not your turn' }, 400)
  }

  // Record turn actions in the turns table
  await c.env.PROHIBITIONDB.prepare(
    `INSERT INTO turns (game_id, player_id, season, actions_json, submitted_at)
     VALUES (?, ?, ?, ?, unixepoch())`
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
            cp.is_coastal, cp.population_tier, gc.owner_player_id, gc.bribe_player_id, gc.bribe_expires_season
     FROM game_cities gc
     JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE gc.game_id = ?`
  ).bind(gameId).all()

  const { results: roads } = await c.env.PROHIBITIONDB.prepare(
    `SELECT from_city_id, to_city_id, distance_value FROM roads WHERE game_id = ?`
  ).bind(gameId).all()

  return c.json({ success: true, data: { cities, roads } })
})
