import { Hono } from 'hono'
import type { Env } from '../index'
import type { AdminVariables } from '../middleware/adminAuth'
import { adminAuth } from '../middleware/adminAuth'

export const adminRouter = new Hono<{ Bindings: Env; Variables: AdminVariables }>()

adminRouter.use('*', adminAuth)

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter']
const GAME_START_YEAR = 1921
function seasonLabel(s: number) {
  const year  = GAME_START_YEAR + Math.floor((s - 1) / 4)
  const name  = SEASON_NAMES[(s - 1) % 4]
  return `${name} ${year}`
}

// ── List all games ────────────────────────────────────────────────────────────
adminRouter.get('/games', async (c) => {
  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT g.id, g.game_name, g.status, g.current_season, g.created_at,
            COUNT(gp.id) AS player_count
     FROM games g
     LEFT JOIN game_players gp ON gp.game_id = g.id
     GROUP BY g.id
     ORDER BY g.created_at DESC`
  ).all<{ id: string; game_name: string | null; status: string; current_season: number; created_at: string; player_count: number }>()

  return c.json({
    success: true,
    games: results.map(g => ({
      id:           g.id,
      name:         g.game_name ?? `Game ${g.id.slice(0, 6)}`,
      status:       g.status,
      season:       g.current_season,
      seasonLabel:  seasonLabel(g.current_season),
      playerCount:  g.player_count,
      createdAt:    g.created_at,
    }))
  })
})

// ── Get game players ──────────────────────────────────────────────────────────
adminRouter.get('/games/:id/players', async (c) => {
  const gameId = c.req.param('id')
  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.display_name, gp.character_class, gp.vehicle, gp.cash, gp.heat,
            gp.turn_order, gp.is_npc, gp.jail_until_season,
            u.email
     FROM game_players gp
     LEFT JOIN users u ON gp.user_id = u.id
     WHERE gp.game_id = ?
     ORDER BY gp.turn_order`
  ).bind(gameId).all<{
    id: number; display_name: string | null; character_class: string; vehicle: string
    cash: number; heat: number; turn_order: number; is_npc: number
    jail_until_season: number | null; email: string | null
  }>()

  return c.json({ success: true, players: results })
})

// ── Edit game (season, status) ────────────────────────────────────────────────
adminRouter.patch('/games/:id', async (c) => {
  const gameId = c.req.param('id')
  const body   = await c.req.json<{ season?: number; status?: string; name?: string }>()

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM games WHERE id = ?`
  ).bind(gameId).first()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)

  const updates: string[] = []
  const values: unknown[] = []

  if (body.season != null && body.season >= 1) {
    updates.push('current_season = ?')
    values.push(Math.floor(body.season))
  }
  if (body.status && ['lobby', 'active', 'ended'].includes(body.status)) {
    updates.push('status = ?')
    values.push(body.status)
  }
  if (body.name !== undefined) {
    updates.push('game_name = ?')
    values.push(body.name || null)
  }

  if (updates.length === 0) return c.json({ success: false, message: 'Nothing to update' }, 400)

  values.push(gameId)
  await c.env.PROHIBITIONDB.prepare(
    `UPDATE games SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  return c.json({ success: true })
})

// ── Delete game (cascades via FK) ─────────────────────────────────────────────
adminRouter.delete('/games/:id', async (c) => {
  const gameId = c.req.param('id')

  // Delete in dependency order:
  // 1. Leaf tables referencing game_players (no city refs)
  // 2. Tables referencing game_cities (distilleries, city_inventory, market_prices, roads)
  // 3. game_players (refs game_cities via home_city_id/current_city_id — must go before game_cities)
  // 4. game_cities, year_events
  // 5. games
  await c.env.PROHIBITIONDB.batch([
    c.env.PROHIBITIONDB.prepare(
      `DELETE FROM npc_state WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`
    ).bind(gameId),
    c.env.PROHIBITIONDB.prepare(
      `DELETE FROM heat_history WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`
    ).bind(gameId),
    c.env.PROHIBITIONDB.prepare(
      `DELETE FROM jail_sentences WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`
    ).bind(gameId),
    c.env.PROHIBITIONDB.prepare(
      `DELETE FROM inventory WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`
    ).bind(gameId),
    c.env.PROHIBITIONDB.prepare(
      `DELETE FROM vehicle_inventory WHERE vehicle_id IN (SELECT id FROM vehicles WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?))`
    ).bind(gameId),
    c.env.PROHIBITIONDB.prepare(
      `DELETE FROM vehicles WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`
    ).bind(gameId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM turns WHERE game_id = ?`).bind(gameId),
    c.env.PROHIBITIONDB.prepare(
      `DELETE FROM distilleries WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`
    ).bind(gameId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM city_inventory WHERE game_id = ?`).bind(gameId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM market_prices  WHERE game_id = ?`).bind(gameId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM roads          WHERE game_id = ?`).bind(gameId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM game_players   WHERE game_id = ?`).bind(gameId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM game_cities    WHERE game_id = ?`).bind(gameId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM year_events    WHERE game_id = ?`).bind(gameId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM games          WHERE id      = ?`).bind(gameId),
  ])

  return c.json({ success: true })
})

// ── Remove a player from a game ───────────────────────────────────────────────
adminRouter.delete('/games/:id/players/:playerId', async (c) => {
  const playerId = Number(c.req.param('playerId'))

  await c.env.PROHIBITIONDB.batch([
    c.env.PROHIBITIONDB.prepare(`DELETE FROM npc_state      WHERE player_id = ?`).bind(playerId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM heat_history   WHERE player_id = ?`).bind(playerId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM jail_sentences WHERE player_id = ?`).bind(playerId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM distilleries   WHERE player_id = ?`).bind(playerId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM inventory      WHERE player_id = ?`).bind(playerId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM vehicle_inventory WHERE vehicle_id IN (SELECT id FROM vehicles WHERE player_id = ?)`).bind(playerId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM vehicles       WHERE player_id = ?`).bind(playerId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM turns          WHERE player_id = ?`).bind(playerId),
    c.env.PROHIBITIONDB.prepare(`DELETE FROM game_players   WHERE id        = ?`).bind(playerId),
  ])

  return c.json({ success: true })
})

// ── Edit a player ─────────────────────────────────────────────────────────────
adminRouter.patch('/games/:id/players/:playerId', async (c) => {
  const playerId = Number(c.req.param('playerId'))
  const body = await c.req.json<{ cash?: number; heat?: number; vehicle?: string; jailUntilSeason?: number | null }>()

  const updates: string[] = []
  const values: unknown[] = []

  if (body.cash != null)   { updates.push('cash = ?');               values.push(Math.max(0, body.cash)) }
  if (body.heat != null)   { updates.push('heat = ?');               values.push(Math.min(100, Math.max(0, body.heat))) }
  if (body.vehicle)        { updates.push('vehicle = ?');            values.push(body.vehicle) }
  if ('jailUntilSeason' in body) { updates.push('jail_until_season = ?'); values.push(body.jailUntilSeason ?? null) }

  if (updates.length === 0) return c.json({ success: false, message: 'Nothing to update' }, 400)

  values.push(playerId)
  await c.env.PROHIBITIONDB.prepare(
    `UPDATE game_players SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  return c.json({ success: true })
})
