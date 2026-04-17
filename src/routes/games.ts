import { Hono } from 'hono'
import type { Env } from '../index'
import type { AuthVariables } from '../middleware/sessionAuth'
import { sessionAuth } from '../middleware/sessionAuth'
import { GameService, buildMarketPrices } from '../services/GameService'
import { calculateEffectiveMovement, resolveMovement, VEHICLES, VEHICLE_PRICES, type RoadSegment } from '../game/movement'
import { generateRoads, buildGraph, getShortestPath } from '../game/mapEngine'
import { DISTILLERY_TIERS, getUpgradeCost } from '../game/production'
import {
  rollPoliceEncounter, resolveSubmit, resolveBribe, resolveRun,
  calculateHeatIncrease, calculateSpotBribeCost, calculateLongTermBribeCost,
  rollFedStop, calculateFedFineCost, calculateFedJailTime,
  type PopulationTier
} from '../game/police'
import { applyBribeDuration, applyMovementModifier, applyCargoMultiplier, applyTakeoverCostModifier, applyProductionModifier, getCharacter } from '../game/characters'
import { runNpcTurn } from '../game/npc'
import { PROXIMITY_RADIUS, STASH_COST, MAX_JAIL_SEASONS, boobytrapCost, coordDistance, ALCOHOL_EMOJI } from '../game/stash'
import { updateCumulativeProgress, checkAndCompleteMissions, drawMission, getMissionCard, type MissionSnapshot } from '../game/missions'
import { sendPushToUser } from '../services/webPush'
import { recordLeaderboardEntries } from '../services/leaderboard'

export const gamesRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

gamesRouter.use('*', sessionAuth)

// List games the authenticated user is a member of
gamesRouter.get('/', async (c) => {
  const userId = c.get('userId')
  const db = c.env.PROHIBITIONDB

  const [gamesResult, tombstonesResult, userRow] = await Promise.all([
    db.prepare(
      `SELECT g.id, g.status, g.current_season, g.total_seasons, g.invite_code, g.game_name,
              gp.turn_order, g.current_player_index,
              (gp.turn_order = g.current_player_index AND g.status = 'active') as is_my_turn
       FROM game_players gp
       JOIN games g ON g.id = gp.game_id
       WHERE gp.user_id = ?
       ORDER BY g.created_at DESC`
    ).bind(userId).all<{
      id: string; status: string; current_season: number; total_seasons: number; invite_code: string; game_name: string | null
      turn_order: number; current_player_index: number; is_my_turn: number
    }>(),
    db.prepare(
      `SELECT id, game_name, reason FROM game_tombstones WHERE user_id = ? AND seen = 0`
    ).bind(userId).all<{ id: number; game_name: string | null; reason: string }>(),
    db.prepare(`SELECT is_admin FROM users WHERE id = ?`).bind(userId).first<{ is_admin: number }>(),
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
    timedOutGames: tombstonesResult.results.map(t => ({ name: t.game_name ?? 'Unnamed Game', reason: t.reason ?? 'timeout' })),
    isAdmin: userRow?.is_admin === 1,
  })
})

gamesRouter.post('/', async (c) => {
  const svc = new GameService(c.env)
  const body = await c.req.json().catch(() => ({})) as { totalSeasons?: number; isPublic?: boolean }
  const totalSeasons = [13, 26, 39, 52].includes(body.totalSeasons ?? 0) ? body.totalSeasons! : 52
  const isPublic = body.isPublic === true
  const result = await svc.createGame(c.get('userId'), totalSeasons, isPublic)
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true, gameId: result.gameId, inviteCode: result.inviteCode })
})

// List open public lobbies anyone can join
gamesRouter.get('/public', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT g.id, g.game_name, g.total_seasons, g.player_count, g.max_players, g.created_at,
            COALESCE(gp.display_name, u.email) AS host_name
     FROM games g
     JOIN game_players gp ON gp.game_id = g.id AND gp.user_id = g.host_user_id
     LEFT JOIN users u ON u.id = g.host_user_id
     WHERE g.is_public = 1 AND g.status = 'lobby'
       AND g.id NOT IN (SELECT game_id FROM game_players WHERE user_id = ?)
     ORDER BY g.created_at DESC
     LIMIT 20`
  ).bind(userId).all<{
    id: string; game_name: string | null; total_seasons: number
    player_count: number; max_players: number; created_at: string; host_name: string
  }>()
  return c.json({ success: true, games: results })
})

gamesRouter.post('/join', async (c) => {
  const body = await c.req.json<{ inviteCode?: string; gameId?: string }>()
  const svc = new GameService(c.env)
  const userId = c.get('userId')

  // Join by gameId (public lobby) or invite code (private)
  const result = body.gameId
    ? await svc.joinPublicGame(body.gameId, userId)
    : await svc.joinGame(body.inviteCode ?? '', userId)

  if (!result.success) return c.json({ success: false, message: result.message }, 400)

  // Notify host if the lobby just filled (non-blocking)
  if (result.isFull && result.hostUserId && result.gameId) {
    const gameName = result.gameName ?? 'your game'
    const gameUrl  = `https://game.prohibitioner.com/games/${result.gameId}`
    c.executionCtx.waitUntil((async () => {
      const hostRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT email FROM users WHERE id = ?`
      ).bind(result.hostUserId).first<{ email: string }>()
      await Promise.all([
        sendPushToUser(
          c.env.PROHIBITIONDB,
          result.hostUserId!,
          { title: `${gameName} is full!`, body: 'All players have joined. You can start the game.', url: gameUrl },
          c.env,
        ),
        hostRow ? c.env.EMAIL.send({
          to: hostRow.email,
          from: 'game@prohibitioner.com',
          subject: `${gameName} is full — ready to start!`,
          html: `<p>All players have joined <strong>${gameName}</strong>. Head back to the lobby to start the game.</p><p><a href="${gameUrl}">Open lobby →</a></p>`,
          text: `All players have joined ${gameName}. Head back to the lobby to start the game.\n\n${gameUrl}`,
        }) : Promise.resolve(),
      ])
    })())
  }

  return c.json({ success: true, gameId: result.gameId })
})

gamesRouter.get('/leaderboard', async (c) => {
  const userId = c.get('userId')
  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT user_id, player_name, character_class, rank, net_worth, total_seasons, ended_at, game_id
     FROM leaderboard_entries
     WHERE ended_at > datetime('now', '-3 months')
     ORDER BY total_seasons ASC, net_worth DESC`
  ).all<{
    user_id: number; player_name: string; character_class: string
    rank: number; net_worth: number; total_seasons: number; ended_at: string; game_id: string
  }>()
  return c.json({ success: true, entries: results.map(e => ({ ...e, isYou: e.user_id === userId })) })
})

gamesRouter.post('/:id/character', async (c) => {
  const { characterClass } = await c.req.json<{ characterClass: string }>()
  const svc = new GameService(c.env)
  const result = await svc.selectCharacter(c.req.param('id'), c.get('userId'), characterClass)
  if (!result.success) return c.json({ success: false, message: result.message }, 400)
  return c.json({ success: true })
})

gamesRouter.post('/:id/start', async (c) => {
  const gameId = c.req.param('id')
  const svc = new GameService(c.env)
  const result = await svc.startGame(gameId, c.get('userId'))
  if (!result.success) return c.json({ success: false, message: result.message }, 400)

  // Notify all human players that the game has started (non-blocking)
  c.executionCtx.waitUntil((async () => {
    const { results: players } = await c.env.PROHIBITIONDB.prepare(
      `SELECT gp.user_id, u.email, COALESCE(gp.display_name, u.email) AS name, g.game_name
       FROM game_players gp
       JOIN users u ON u.id = gp.user_id
       JOIN games g ON g.id = gp.game_id
       WHERE gp.game_id = ? AND gp.is_npc = 0`
    ).bind(gameId).all<{ user_id: number; email: string; name: string; game_name: string | null }>()

    const gameName = players[0]?.game_name ?? 'Prohibition'
    const gameUrl  = `https://game.prohibitioner.com/games/${gameId}`

    await Promise.all(players.flatMap(p => [
      sendPushToUser(
        c.env.PROHIBITIONDB,
        p.user_id,
        { title: `${gameName} has started!`, body: 'The game is on — may the best bootlegger win.', url: gameUrl },
        c.env,
      ),
      c.env.EMAIL.send({
        to: p.email,
        from: 'game@prohibitioner.com',
        subject: `${gameName} has started!`,
        html: `<p>The game is on, ${p.name}. May the best bootlegger win.</p><p><a href="${gameUrl}">Play now →</a></p>`,
        text: `The game is on, ${p.name}. May the best bootlegger win.\n\n${gameUrl}`,
      }),
    ]))
  })())

  return c.json({ success: true })
})

// Leave a lobby before the game starts.
// Host leaving cancels the game for everyone; non-host just removes themselves.
gamesRouter.delete('/:id/leave', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const db = c.env.PROHIBITIONDB

  const game = await db.prepare(
    `SELECT status, host_user_id, player_count FROM games WHERE id = ?`
  ).bind(gameId).first<{ status: string; host_user_id: number; player_count: number }>()

  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)
  if (game.status !== 'lobby') return c.json({ success: false, message: 'Can only leave while in lobby' }, 400)

  const membership = await db.prepare(
    `SELECT id FROM game_players WHERE game_id = ? AND user_id = ?`
  ).bind(gameId, userId).first<{ id: number }>()
  if (!membership) return c.json({ success: false, message: 'Not in this game' }, 403)

  if (game.host_user_id === userId) {
    // Host leaves → cancel the game entirely
    await db.batch([
      db.prepare(`DELETE FROM game_players WHERE game_id = ?`).bind(gameId),
      db.prepare(`DELETE FROM games WHERE id = ?`).bind(gameId),
    ])
  } else {
    // Non-host leaves → remove them and decrement count
    await db.batch([
      db.prepare(`DELETE FROM game_players WHERE game_id = ? AND user_id = ?`).bind(gameId, userId),
      db.prepare(`UPDATE games SET player_count = player_count - 1 WHERE id = ?`).bind(gameId),
    ])
  }

  return c.json({ success: true })
})

// Boot a player from the lobby (host only, lobby only)
gamesRouter.delete('/:id/players/:playerId', async (c) => {
  const gameId   = c.req.param('id')
  const playerId = Number(c.req.param('playerId'))
  const userId   = c.get('userId')
  const db       = c.env.PROHIBITIONDB

  const game = await db.prepare(
    `SELECT status, host_user_id, game_name FROM games WHERE id = ?`
  ).bind(gameId).first<{ status: string; host_user_id: number; game_name: string | null }>()

  if (!game)                        return c.json({ success: false, message: 'Game not found' }, 404)
  if (game.status !== 'lobby')      return c.json({ success: false, message: 'Can only boot during lobby' }, 400)
  if (game.host_user_id !== userId) return c.json({ success: false, message: 'Host only' }, 403)

  const target = await db.prepare(
    `SELECT user_id FROM game_players WHERE id = ? AND game_id = ?`
  ).bind(playerId, gameId).first<{ user_id: number }>()

  if (!target)                   return c.json({ success: false, message: 'Player not found' }, 404)
  if (target.user_id === userId) return c.json({ success: false, message: 'Cannot boot yourself' }, 400)

  await db.batch([
    db.prepare(`DELETE FROM game_players WHERE id = ?`).bind(playerId),
    db.prepare(`UPDATE games SET player_count = player_count - 1 WHERE id = ?`).bind(gameId),
    db.prepare(`INSERT INTO game_tombstones (user_id, game_name, reason) VALUES (?, ?, 'booted')`)
      .bind(target.user_id, game.game_name),
  ])

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

gamesRouter.patch('/:id/visibility', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { isPublic } = await c.req.json<{ isPublic: boolean }>()

  const game = await c.env.PROHIBITIONDB.prepare(
    `SELECT status, host_user_id FROM games WHERE id = ?`
  ).bind(gameId).first<{ status: string; host_user_id: number }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)
  if (game.status !== 'lobby') return c.json({ success: false, message: 'Game already started' }, 400)
  if (game.host_user_id !== userId) return c.json({ success: false, message: 'Only the host can change this' }, 403)

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE games SET is_public = ? WHERE id = ?`
  ).bind(isPublic ? 1 : 0, gameId).run()

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
  const joinUrl = `https://game.prohibitioner.com/games?invite=${game.invite_code}`

  const res = await fetch('https://3mails.ai/api/transactional/3c7a2039-6d33-413a-8654-6077de8dbf8d/send', {
    method: 'POST',
    headers: {
      'X-API-Key': '5145e2fc29f74b3ca9876de0087fd1c0003c65da4244f8a9aeba15f67a5c137d',
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
            gp.heat, gp.pending_police_encounter, gp.cash, gp.turn_started_at,
            gp.stuck_until_season, COALESCE(gp.display_name, u.email) AS display_name,
            gp.role, gp.jailed_count, gp.federal_bribe_expires_season,
            g.current_player_index, g.current_season, g.total_seasons, g.status, g.player_count, g.max_players
     FROM game_players gp
     JOIN games g ON g.id = gp.game_id
     LEFT JOIN users u ON gp.user_id = u.id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; current_city_id: number | null
    character_class: string; heat: number; cash: number; turn_started_at: string | null
    pending_police_encounter: string | null
    stuck_until_season: number | null; display_name: string | null
    role: string; jailed_count: number; federal_bribe_expires_season: number | null
    current_player_index: number; current_season: number; total_seasons: number; status: string; player_count: number; max_players: number
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) {
    return c.json({ success: false, message: 'Not your turn' }, 400)
  }

  // Record turn (with duration tracking)
  const durationSeconds = playerRow.turn_started_at
    ? Math.max(1, Math.round((Date.now() - new Date(playerRow.turn_started_at + 'Z').getTime()) / 1000))
    : null
  await c.env.PROHIBITIONDB.prepare(
    `INSERT INTO turns (game_id, player_id, season, actions, duration_seconds)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(gameId, playerRow.id, playerRow.current_season, JSON.stringify(actions), durationSeconds).run()

  // Pre-fetch vehicles and all game players in parallel — avoids N+1 queries in the action loop
  const [{ results: playerVehicles }, { results: allPlayersList }] = await Promise.all([
    c.env.PROHIBITIONDB.prepare(
      `SELECT id, vehicle_type, city_id, heat, stationary_since FROM vehicles WHERE player_id = ? ORDER BY id`
    ).bind(playerRow.id).all<{ id: number; vehicle_type: string; city_id: number; heat: number; stationary_since: number }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT id, turn_order, is_npc, jail_until_season FROM game_players WHERE game_id = ? ORDER BY turn_order`
    ).bind(gameId).all<{ id: number; turn_order: number; is_npc: number; jail_until_season: number | null }>()
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
  type EncounterEntry = { vehicleId?: number; bribeCost: number; populationTier: string; heat: number; encounterType?: 'local' | 'fed'; fineCost?: number; jailSeasons?: number; cargoUnits?: number }
  let policeEncounterResult: EncounterEntry | null = null
  let fedEncounterResult: { fineCost: number; jailSeasons: number; cargoUnits: number } | null = null
  const celebrations: Array<{ type: string; cityId?: number; newTier?: number; vehicleId?: string; vehicleDbId?: number; vehicleType?: string; missionCardId?: number; reward?: number; repairCost?: number; units?: number; alcoholType?: string }> = []
  const boughtThisTurn = new Map<number, number>()

  // ── Ledger helpers ─────────────────────────────────────────────────────────
  type LedgerEntry = { type: string; amount: number; description: string; cityId: number | null; pid: number }
  const pendingLedger: LedgerEntry[] = []
  const addLedger = (type: string, amount: number, description: string, cityId: number | null = null, pid = playerRow.id) => {
    if (amount !== 0) pendingLedger.push({ type, amount, description, cityId, pid })
  }
  const flushLedger = async () => {
    if (pendingLedger.length === 0) return
    await c.env.PROHIBITIONDB.batch(
      pendingLedger.splice(0).map(e => c.env.PROHIBITIONDB.prepare(
        `INSERT INTO ledger_entries (game_id, player_id, season, type, amount, description, city_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(gameId, e.pid, playerRow.current_season, e.type, e.amount, e.description, e.cityId))
    )
  }

  for (const action of actions as Action[]) {

    // ── Police resolve (must be first — clears pending and then ends turn) ────
    if (action.type === 'police_resolve' && playerRow.pending_police_encounter) {
      const queue = JSON.parse(playerRow.pending_police_encounter) as EncounterEntry[]
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
          addLedger('police_cash', -sr.cashSeized, 'Police seized cash', playerRow.current_city_id)
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
          addLedger('police_bribe', -br.cashPaid, 'Paid police bribe', playerRow.current_city_id)
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
            `UPDATE game_players SET heat = ?, jail_until_season = ?, jailed_count = jailed_count + 1, pending_police_encounter = ? WHERE id = ?`
          ).bind(newHeat, jailUntil, remaining2, playerRow.id).run()
          await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, { type: 'jailed' })
        }
        playerRow.pending_police_encounter = remaining2
      }
      // If more encounters pending, return the next one
      if (queue.length > 0) {
        const next = queue[0]
        if (next.encounterType === 'fed') {
          fedEncounterResult = { fineCost: next.fineCost!, jailSeasons: next.jailSeasons!, cargoUnits: next.cargoUnits! }
        } else {
          policeEncounterResult = next
        }
      }
      // Fall through to turn advance
    }

    // ── Fed stop resolve ──────────────────────────────────────────────────────
    if (action.type === 'fed_stop_respond' && playerRow.pending_police_encounter) {
      const queue = JSON.parse(playerRow.pending_police_encounter) as EncounterEntry[]
      if (queue.length === 0) continue
      const encounter = queue.shift()!
      if (encounter.encounterType !== 'fed') continue

      const freshRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT cash, heat FROM game_players WHERE id = ?`
      ).bind(playerRow.id).first<{ cash: number; heat: number }>()
      const freshCash = freshRow?.cash ?? 0
      const freshHeat = freshRow?.heat ?? 0
      const remaining2 = queue.length > 0 ? JSON.stringify(queue) : null
      const choice = action.choice as 'pay' | 'jail' | 'snitch'
      const displayName = (playerRow.display_name ?? 'Someone').replace(/@.*$/, '')

      if (choice === 'pay') {
        const fine = Math.min(encounter.fineCost!, freshCash)
        const newHeat = Math.max(0, freshHeat - 5)
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET cash = cash - ?, heat = ?, pending_police_encounter = ? WHERE id = ?`
        ).bind(fine, newHeat, remaining2, playerRow.id).run()
        addLedger('fed_fine', -fine, 'Paid federal fine', playerRow.current_city_id)
        await c.env.PROHIBITIONDB.prepare(
          `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
        ).bind(gameId, playerRow.id, `🕵️ ${displayName} paid a federal fine.`).run()

      } else if (choice === 'jail') {
        const newHeat = Math.max(0, freshHeat - 10)
        const jailUntil = playerRow.current_season + (encounter.jailSeasons ?? 1)
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET heat = ?, jail_until_season = ?, jailed_count = jailed_count + 1, pending_police_encounter = ? WHERE id = ?`
        ).bind(newHeat, jailUntil, remaining2, playerRow.id).run()
        await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, { type: 'jailed' })
        addLedger('fed_jail', 0, 'Taken in by federal agents', playerRow.current_city_id)
        await c.env.PROHIBITIONDB.prepare(
          `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
        ).bind(gameId, playerRow.id, `🕵️ ${displayName} was taken in by federal agents.`).run()

      } else if (choice === 'snitch') {
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET role = 'snitch', pending_police_encounter = ? WHERE id = ?`
        ).bind(remaining2, playerRow.id).run()
        // Create 4 unplaced informants
        await c.env.PROHIBITIONDB.batch([
          c.env.PROHIBITIONDB.prepare(`INSERT INTO informants (game_id, snitch_id) VALUES (?, ?)`).bind(gameId, playerRow.id),
          c.env.PROHIBITIONDB.prepare(`INSERT INTO informants (game_id, snitch_id) VALUES (?, ?)`).bind(gameId, playerRow.id),
          c.env.PROHIBITIONDB.prepare(`INSERT INTO informants (game_id, snitch_id) VALUES (?, ?)`).bind(gameId, playerRow.id),
          c.env.PROHIBITIONDB.prepare(`INSERT INTO informants (game_id, snitch_id) VALUES (?, ?)`).bind(gameId, playerRow.id),
        ])
        // No public announcement — silent flip
      }

      playerRow.pending_police_encounter = remaining2
      if (queue.length > 0) {
        const next = queue[0]
        if (next.encounterType === 'fed') {
          fedEncounterResult = { fineCost: next.fineCost!, jailSeasons: next.jailSeasons!, cargoUnits: next.cargoUnits! }
        } else {
          policeEncounterResult = next
        }
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

      const allTraversedCities = new Set<number>()
      for (const vm of vehicleMoves) {
        if (!vm.targetPath || vm.targetPath.length === 0) continue
        const vehicleRow = playerVehicles.find(v => v.id === vm.vehicleId)
        if (!vehicleRow) continue
        const vehicleDef = VEHICLES[vehicleRow.vehicle_type]
        const effectivePts = Math.floor(vm.allocatedPoints * (vehicleDef?.movementMultiplier ?? 1.0))
        const result = resolveMovement(vehicleRow.city_id, vm.targetPath, roads, effectivePts)
        for (const c of result.traversedCities) allTraversedCities.add(c)
        vehicleRow.city_id = result.currentCityId
        vehicleRow.stationary_since = playerRow.current_season
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE vehicles SET city_id = ?, stationary_since = ? WHERE id = ?`
        ).bind(result.currentCityId, playerRow.current_season, vehicleRow.id).run()

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
            ? JSON.parse(playerRow.pending_police_encounter) as EncounterEntry[]
            : []
          existing.push({ vehicleId: vehicleRow.id, bribeCost, populationTier: tier, heat: currentHeat, encounterType: 'local' })
          const newJson = JSON.stringify(existing)
          await c.env.PROHIBITIONDB.prepare(
            `UPDATE game_players SET pending_police_encounter = ? WHERE id = ?`
          ).bind(newJson, playerRow.id).run()
          playerRow.pending_police_encounter = newJson
          if (!policeEncounterResult && !fedEncounterResult) {
            policeEncounterResult = { vehicleId: vehicleRow.id, bribeCost, populationTier: tier, heat: currentHeat, encounterType: 'local' }
          }
        }

        // Federal Stop roll — flat probability weighted by desperation, bypasses city bribe protection
        {
          const allPlayers = await c.env.PROHIBITIONDB.prepare(
            `SELECT id, cash FROM game_players WHERE game_id = ? AND is_npc = 0 AND jail_until_season IS NULL ORDER BY cash DESC`
          ).bind(gameId).all<{ id: number; cash: number }>()
          const rankByWealth = (allPlayers.results.findIndex(p => p.id === playerRow.id) ?? 0) + 1
          const playerCount = Math.max(1, allPlayers.results.length)
          const cityCountRow = await c.env.PROHIBITIONDB.prepare(
            `SELECT COUNT(*) AS cnt FROM game_cities WHERE game_id = ? AND owner_player_id = ?`
          ).bind(gameId, playerRow.id).first<{ cnt: number }>()
          const cityCount = cityCountRow?.cnt ?? 0
          const fedBribeActive = playerRow.federal_bribe_expires_season != null &&
            playerRow.federal_bribe_expires_season > playerRow.current_season

          if (rollFedStop({
            cityCount, cash: currentCash, jailedCount: playerRow.jailed_count,
            rankByWealth, playerCount, federalBribeActive: fedBribeActive, cityBribed: cityIsBribed
          })) {
            const cargoUnits = vinv.reduce((s, r) => s + r.quantity, 0)
            const fineCost = calculateFedFineCost(currentCash)
            const jailSeasons = calculateFedJailTime(cargoUnits)
            const fedQueue = playerRow.pending_police_encounter
              ? JSON.parse(playerRow.pending_police_encounter) as EncounterEntry[]
              : []
            fedQueue.push({ bribeCost: 0, populationTier: 'small', heat: currentHeat, encounterType: 'fed', fineCost, jailSeasons, cargoUnits })
            const fedJson = JSON.stringify(fedQueue)
            await c.env.PROHIBITIONDB.prepare(
              `UPDATE game_players SET pending_police_encounter = ? WHERE id = ?`
            ).bind(fedJson, playerRow.id).run()
            playerRow.pending_police_encounter = fedJson
            if (!policeEncounterResult && !fedEncounterResult) {
              fedEncounterResult = { fineCost, jailSeasons, cargoUnits }
            }
          }
        }

        // Informant sighting detection — if any snitch has an informant in destination city, queue a sighting
        {
          const { results: watchingInformants } = await c.env.PROHIBITIONDB.prepare(
            `SELECT i.snitch_id FROM informants i WHERE i.city_id = ? AND i.game_id = ? AND i.snitch_id != ?`
          ).bind(result.currentCityId, gameId, playerRow.id).all<{ snitch_id: number }>()
          if (watchingInformants.length > 0) {
            const cityNameRow = await c.env.PROHIBITIONDB.prepare(
              `SELECT cp.name FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
            ).bind(result.currentCityId).first<{ name: string }>()
            const sightingCityName = cityNameRow?.name ?? 'Unknown'
            const sightingPlayer = (playerRow.display_name ?? 'Someone').replace(/@.*$/, '')
            const sighting = { playerName: sightingPlayer, cityId: result.currentCityId, cityName: sightingCityName, season: playerRow.current_season }
            for (const inf of watchingInformants) {
              const snitchRow = await c.env.PROHIBITIONDB.prepare(
                `SELECT pending_sightings FROM game_players WHERE id = ?`
              ).bind(inf.snitch_id).first<{ pending_sightings: string | null }>()
              const existingSightings = snitchRow?.pending_sightings ? JSON.parse(snitchRow.pending_sightings) : []
              existingSightings.push(sighting)
              await c.env.PROHIBITIONDB.prepare(
                `UPDATE game_players SET pending_sightings = ? WHERE id = ?`
              ).bind(JSON.stringify(existingSightings), inf.snitch_id).run()
            }
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
            const setterName = (trapRow.setter_name ?? 'Someone').replace(/@.*$/, '')
            const victimName = (playerRow.display_name ?? 'Someone').replace(/@.*$/, '')

            let trapActualPaid = 0
            if (trapRow.consequence_type === 'jail') {
              const seasons = Math.min(2, params.seasons ?? 1)
              await c.env.PROHIBITIONDB.prepare(
                `UPDATE game_players SET jail_until_season = ? WHERE id = ?`
              ).bind(playerRow.current_season + seasons, playerRow.id).run()
            } else if (trapRow.consequence_type === 'financial') {
              const amount = Math.max(0, params.amount ?? 100)
              trapActualPaid = Math.min(amount, currentCash)
              currentCash = Math.max(0, currentCash - amount)
              await c.env.PROHIBITIONDB.batch([
                c.env.PROHIBITIONDB.prepare(
                  `UPDATE game_players SET cash = MAX(0, cash - ?) WHERE id = ?`
                ).bind(amount, playerRow.id),
                c.env.PROHIBITIONDB.prepare(
                  `UPDATE game_players SET cash = cash + ? WHERE id = ?`
                ).bind(trapActualPaid, trapRow.setter_player_id),
              ])
              if (trapActualPaid > 0) {
                addLedger('trap_penalty', -trapActualPaid, `Trap by ${setterName.replace(/@.*$/, '')}`, newCityId)
                addLedger('toll_received', trapActualPaid, `Trap payout from ${(playerRow.display_name ?? 'player').replace(/@.*$/, '')}`, newCityId, trapRow.setter_player_id)
              }
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
              ? `fined $${trapActualPaid.toLocaleString()}${trapActualPaid < (params.amount ?? 100) ? ` (couldn't cover the full $${(params.amount ?? 100).toLocaleString()})` : ''}`
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
                    (SELECT COUNT(*) FROM game_cities gc2 WHERE gc2.owner_player_id = gp.id AND gc2.game_id = ?) AS city_count,
                    cp.population_tier, cp.name AS city_name
             FROM game_cities gc
             JOIN game_players gp ON gc.owner_player_id = gp.id
             JOIN city_pool cp ON gc.city_pool_id = cp.id
             LEFT JOIN users u ON gp.user_id = u.id
             WHERE gc.id = ? AND gc.owner_player_id IS NOT NULL AND gp.id != ?`
          ).bind(gameId, newCityId, playerRow.id).first<{
            id: number; cash: number; owner_name: string; city_count: number; population_tier: string; city_name: string
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
            const TOLL_BY_TIER: Record<string, number> = { small: 10, medium: 20, large: 35, major: 50 }
            const toll = TOLL_BY_TIER[ownerRow.population_tier] ?? 10
            const actualToll = Math.min(toll, currentCash)
            currentCash = Math.max(0, currentCash - toll)
            const tollCityName = ownerRow.city_name ?? 'the city'
            const victimName = playerRow.display_name?.split('@')[0] ?? 'Someone'

            await c.env.PROHIBITIONDB.batch([
              c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(actualToll, playerRow.id),
              c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ? WHERE id = ?`).bind(actualToll, ownerRow.id),
              c.env.PROHIBITIONDB.prepare(`INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`)
                .bind(gameId, playerRow.id, `💰 ${victimName} paid ${ownerRow.owner_name} a $${actualToll} courtesy toll for passing through ${tollCityName}.`),
            ])
            addLedger('toll_paid', -actualToll, `Toll in ${tollCityName}`, newCityId)
            addLedger('toll_received', actualToll, `Toll received from ${victimName}`, newCityId, ownerRow.id)
            } // end else (not allied)
          }
        }

        currentCityId = newCityId
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE game_players SET current_city_id = ? WHERE id = ?`
        ).bind(currentCityId, playerRow.id).run()
        // Track every city touched by any vehicle this move
        for (const visitedCityId of allTraversedCities) {
          await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, {
            type: 'city_visited', cityId: visitedCityId
          })
        }
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
          addLedger('buy', -cost, `Bought ${toBuy}×${action.alcoholType}`, vCityId)
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

    // ── Steal from rival city inventory ───────────────────────────────────────
    if (action.type === 'steal_inventory' && action.vehicleId && action.cityId && action.alcoholType && action.quantity) {
      const vehicleRow = playerVehicles.find(v => v.id === action.vehicleId)
      if (vehicleRow && vehicleRow.city_id === action.cityId) {
        // City must be owned by a rival
        const cityOwnerRow = await c.env.PROHIBITIONDB.prepare(
          `SELECT gc.owner_player_id, cp.population_tier
           FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
           WHERE gc.id = ? AND gc.game_id = ?`
        ).bind(action.cityId, gameId).first<{ owner_player_id: number | null; population_tier: string }>()

        if (cityOwnerRow?.owner_player_id && cityOwnerRow.owner_player_id !== playerRow.id) {
          // Alliance check
          const stealAllianceCheck = await c.env.PROHIBITIONDB.prepare(
            `SELECT id FROM alliances WHERE game_id = ? AND status = 'active'
             AND ((requester_player_id = ? AND recipient_player_id = ?)
               OR (requester_player_id = ? AND recipient_player_id = ?))`
          ).bind(gameId, playerRow.id, cityOwnerRow.owner_player_id, cityOwnerRow.owner_player_id, playerRow.id).first()

          if (!stealAllianceCheck) {
            // Owner vehicle presence → hard block
            const ownerVehicleAtCity = await c.env.PROHIBITIONDB.prepare(
              `SELECT id FROM vehicles WHERE player_id = ? AND city_id = ? LIMIT 1`
            ).bind(cityOwnerRow.owner_player_id, action.cityId).first()

            if (ownerVehicleAtCity) {
              celebrations.push({ type: 'steal_blocked', cityId: action.cityId } as any)
            }

            if (!ownerVehicleAtCity) {
              // Check city inventory
              const cityInv = await c.env.PROHIBITIONDB.prepare(
                `SELECT quantity FROM city_inventory WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
              ).bind(gameId, action.cityId, action.alcoholType).first<{ quantity: number }>()

              if (cityInv && cityInv.quantity > 0) {
                // Calculate steal amount
                const vehicleDef = VEHICLES[vehicleRow.vehicle_type]
                const cargoSlots = applyCargoMultiplier(playerRow.character_class, vehicleDef?.cargoSlots ?? 16)
                const { results: currentInv } = await c.env.PROHIBITIONDB.prepare(
                  `SELECT COALESCE(SUM(quantity), 0) AS used FROM vehicle_inventory WHERE vehicle_id = ?`
                ).bind(action.vehicleId).all<{ used: number }>()
                const cargoUsed = currentInv[0]?.used ?? 0
                const toSteal = Math.min(Math.max(1, Math.floor(action.quantity)), cityInv.quantity, cargoSlots - cargoUsed)

                if (toSteal > 0) {
                  // Execute theft
                  await c.env.PROHIBITIONDB.batch([
                    c.env.PROHIBITIONDB.prepare(
                      `UPDATE city_inventory SET quantity = quantity - ? WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
                    ).bind(toSteal, gameId, action.cityId, action.alcoholType),
                    c.env.PROHIBITIONDB.prepare(
                      `INSERT INTO vehicle_inventory (vehicle_id, alcohol_type, quantity) VALUES (?, ?, ?)
                       ON CONFLICT(vehicle_id, alcohol_type) DO UPDATE SET quantity = quantity + excluded.quantity`
                    ).bind(action.vehicleId, action.alcoholType, toSteal),
                    c.env.PROHIBITIONDB.prepare(
                      `UPDATE game_players SET heat = MIN(100, heat + 15) WHERE id = ?`
                    ).bind(playerRow.id),
                  ])
                  const heatAfterSteal = Math.min(100, playerRow.heat + 15)

                  // Notify owner
                  const thiefName = playerRow.display_name ?? 'Someone'
                  const cityNameRow = await c.env.PROHIBITIONDB.prepare(
                    `SELECT cp.name FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
                  ).bind(action.cityId).first<{ name: string }>()
                  await c.env.PROHIBITIONDB.prepare(
                    `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
                  ).bind(gameId, cityOwnerRow.owner_player_id,
                    `🥃 ${thiefName} raided your distillery in ${cityNameRow?.name ?? 'a city'} and stole ${toSteal} units of ${action.alcoholType}!`
                  ).run()

                  celebrations.push({ type: 'steal_complete', cityId: action.cityId, units: toSteal, alcoholType: action.alcoholType })

                  // Active bribe → forced police encounter for the thief
                  const briberRow = await c.env.PROHIBITIONDB.prepare(
                    `SELECT bribe_player_id, bribe_expires_season FROM game_cities WHERE id = ?`
                  ).bind(action.cityId).first<{ bribe_player_id: number | null; bribe_expires_season: number | null }>()
                  if (briberRow?.bribe_player_id && (briberRow.bribe_expires_season ?? 0) > playerRow.current_season) {
                    const tier = (cityOwnerRow.population_tier ?? 'small') as PopulationTier
                    const bribeCost = calculateSpotBribeCost(heatAfterSteal, tier)
                    const existing = playerRow.pending_police_encounter
                      ? (JSON.parse(playerRow.pending_police_encounter) as Array<unknown>)
                      : []
                    existing.push({ vehicleId: vehicleRow.id, bribeCost, populationTier: tier, heat: heatAfterSteal })
                    const newJson = JSON.stringify(existing)
                    await c.env.PROHIBITIONDB.prepare(
                      `UPDATE game_players SET pending_police_encounter = ? WHERE id = ?`
                    ).bind(newJson, playerRow.id).run()
                    playerRow.pending_police_encounter = newJson
                    if (!policeEncounterResult) {
                      policeEncounterResult = { vehicleId: vehicleRow.id, bribeCost, populationTier: tier, heat: heatAfterSteal }
                    }
                  }
                }
              }
            }
          }
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
            addLedger('sell', revenue, `Sold ${toSell}×${action.alcoholType}`, sellCityId)
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
        addLedger('sell', revenue, `Sold ${toSell}×${action.alcoholType}`, vCityId)
        await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, {
          type: 'sold_units', quantity: toSell, alcoholType: action.alcoholType, revenue
        })
      }
    }

    // ── Bribe official (long-term city bribe) ────────────────────────────────
    // action.cityId lets the player bribe any city where they have a vehicle; falls back to currentCityId
    if (action.type === 'bribe_official') {
      const bribeCityId = action.cityId ?? currentCityId
      if (bribeCityId != null) {
        // Verify the player has a vehicle in that city
        const vehicleCheck = await c.env.PROHIBITIONDB.prepare(
          `SELECT id FROM vehicles WHERE player_id = ? AND city_id = ? LIMIT 1`
        ).bind(playerRow.id, bribeCityId).first()
        if (vehicleCheck) {
          const cityRow = await c.env.PROHIBITIONDB.prepare(
            `SELECT cp.population_tier FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id WHERE gc.id = ?`
          ).bind(bribeCityId).first<{ population_tier: string }>()
          if (cityRow) {
            const tier = cityRow.population_tier as PopulationTier
            const cost = calculateLongTermBribeCost(tier)
            if (currentCash >= cost) {
              const duration  = applyBribeDuration(playerRow.character_class, 4)
              const expiresAt = playerRow.current_season + duration
              currentCash -= cost
              await c.env.PROHIBITIONDB.batch([
                c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, playerRow.id),
                c.env.PROHIBITIONDB.prepare(`UPDATE game_cities SET bribe_player_id = ?, bribe_expires_season = ? WHERE id = ?`).bind(playerRow.id, expiresAt, bribeCityId)
              ])
              addLedger('bribe', -cost, 'Bribed city official', bribeCityId)
              await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, { type: 'official_bribed' })
            }
          }
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
    if (action.type === 'claim_city') {
      // Accept explicit cityId (any vehicle) or fall back to lead-car city
      const claimCityId = action.cityId ?? currentCityId
      if (!claimCityId) continue
      // Verify the player has a vehicle at this city
      const vehicleAtClaim = playerVehicles.find(v => v.city_id === claimCityId)
      if (!vehicleAtClaim) continue
      const BASE_CLAIM: Record<string, number> = { small: 500, medium: 1000, large: 1500, major: 2500 }
      const cityRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT gc.owner_player_id, gc.claim_cost, cp.population_tier
         FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
         WHERE gc.id = ?`
      ).bind(claimCityId).first<{ owner_player_id: number | null; claim_cost: number; population_tier: string }>()
      if (cityRow && cityRow.owner_player_id !== playerRow.id) {
        const isNeutral = cityRow.owner_player_id == null
        const cost = isNeutral
          ? Math.floor(applyTakeoverCostModifier(playerRow.character_class, BASE_CLAIM[cityRow.population_tier] ?? 500))
          : Math.floor(applyTakeoverCostModifier(playerRow.character_class,
              (cityRow.claim_cost ?? BASE_CLAIM[cityRow.population_tier] ?? 500) * 2))
        if (currentCash >= cost) {
          currentCash -= cost
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, playerRow.id),
            c.env.PROHIBITIONDB.prepare(`UPDATE game_cities SET owner_player_id = ?, claim_cost = ? WHERE id = ?`).bind(playerRow.id, cost, claimCityId),
            c.env.PROHIBITIONDB.prepare(`DELETE FROM distilleries WHERE city_id = ? AND player_id != ?`).bind(claimCityId, playerRow.id),
          ])
          // Use subquery for still_number — UNIQUE(player_id, still_number) means hardcoding 1 fails if home distillery exists
          await c.env.PROHIBITIONDB.prepare(
            `INSERT INTO distilleries (player_id, city_id, tier, still_number, purchase_price)
             SELECT ?, ?, 1, COALESCE((SELECT MAX(still_number) FROM distilleries WHERE player_id = ?), 0) + 1, 0
             WHERE NOT EXISTS (SELECT 1 FROM distilleries WHERE player_id = ? AND city_id = ?)`
          ).bind(playerRow.id, claimCityId, playerRow.id, playerRow.id, claimCityId).run()
          addLedger('claim_city', -cost, isNeutral ? 'Claimed city' : 'Took over city', claimCityId)
          celebrations.push({ type: 'claim_city', cityId: claimCityId })
        }
      }
    }

    // ── Upgrade still ─────────────────────────────────────────────────────────
    // action.cityId lets the player upgrade any still where they have a vehicle; falls back to currentCityId
    if (action.type === 'upgrade_still') {
      const upgradeCityId = action.cityId ?? currentCityId
      if (upgradeCityId == null) continue
      // Verify vehicle present at that city
      const vehicleAtCity = await c.env.PROHIBITIONDB.prepare(
        `SELECT id FROM vehicles WHERE player_id = ? AND city_id = ? LIMIT 1`
      ).bind(playerRow.id, upgradeCityId).first()
      if (!vehicleAtCity) continue
      const distRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT id, tier FROM distilleries WHERE player_id = ? AND city_id = ?`
      ).bind(playerRow.id, upgradeCityId).first<{ id: number; tier: number }>()
      if (distRow && distRow.tier < 5) {
        const cost = getUpgradeCost(distRow.tier + 1, playerRow.character_class)
        if (currentCash >= cost) {
          currentCash -= cost
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, playerRow.id),
            c.env.PROHIBITIONDB.prepare(`UPDATE distilleries SET tier = tier + 1 WHERE id = ?`).bind(distRow.id)
          ])
          addLedger('upgrade_still', -cost, `Upgraded still → Tier ${distRow.tier + 1}`, upgradeCityId)
          celebrations.push({ type: 'upgrade_still', cityId: upgradeCityId, newTier: distRow.tier + 1 })
        }
      }
    }

    // ── Buy a new vehicle ─────────────────────────────────────────────────────
    if (action.type === 'buy_vehicle' && action.vehicleId) {
      const vehicleType = action.vehicleId as unknown as string  // vehicleId carries the type name
      const target = VEHICLES[vehicleType]
      const price  = VEHICLE_PRICES[vehicleType]
      if (!target || price == null) continue
      // Car limit: max(1, owned_cities - 1)
      const ownedCitiesRow = await c.env.PROHIBITIONDB.prepare(
        `SELECT COUNT(*) as cnt FROM game_cities WHERE owner_player_id = ?`
      ).bind(playerRow.id).first<{ cnt: number }>()
      const carLimit = Math.max(1, (ownedCitiesRow?.cnt ?? 1) - 1)
      if (playerVehicles.length >= carLimit) continue
      if (currentCash >= price) {
        currentCash -= price
        const homeCityRow = await c.env.PROHIBITIONDB.prepare(
          `SELECT home_city_id FROM game_players WHERE id = ?`
        ).bind(playerRow.id).first<{ home_city_id: number }>()
        if (homeCityRow?.home_city_id) {
          await c.env.PROHIBITIONDB.batch([
            c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(price, playerRow.id),
            c.env.PROHIBITIONDB.prepare(
              `INSERT INTO vehicles (player_id, game_id, vehicle_type, city_id, stationary_since, purchase_price) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(playerRow.id, gameId, vehicleType, homeCityRow.home_city_id, playerRow.current_season, price)
          ])
          // Refresh vehicle list
          const { results: freshVehicles } = await c.env.PROHIBITIONDB.prepare(
            `SELECT id, vehicle_type, city_id, heat, stationary_since FROM vehicles WHERE player_id = ? ORDER BY id`
          ).bind(playerRow.id).all<{ id: number; vehicle_type: string; city_id: number; heat: number; stationary_since: number }>()
          playerVehicles.length = 0
          playerVehicles.push(...freshVehicles)
          addLedger('buy_vehicle', -price, `Bought ${vehicleType.replace(/_/g, ' ')}`)
          celebrations.push({ type: 'upgrade_vehicle', vehicleId: vehicleType })
        }
      }
    }

    // ── Place informant (snitch only, terminal — requires car in city) ─────────
    if (action.type === 'place_informant' && playerRow.role === 'snitch' && action.vehicleId && action.cityId) {
      // Verify the snitch has a vehicle in the target city
      const carInCity = playerVehicles.find(v => v.id === action.vehicleId && v.city_id === action.cityId)
      if (carInCity) {
        await c.env.PROHIBITIONDB.prepare(
          `UPDATE informants SET city_id = ?, placed_at = ? WHERE id = ? AND snitch_id = ? AND game_id = ?`
        ).bind(action.cityId, playerRow.current_season, action.quantity /* reuse quantity field as informantId */, playerRow.id, gameId).run()
      }
    }

    // ── Recall informant (snitch only, free action) ───────────────────────────
    if (action.type === 'recall_informant' && playerRow.role === 'snitch' && action.quantity) {
      await c.env.PROHIBITIONDB.prepare(
        `UPDATE informants SET city_id = NULL, placed_at = NULL WHERE id = ? AND snitch_id = ? AND game_id = ?`
      ).bind(action.quantity /* informantId */, playerRow.id, gameId).run()
    }

    // ── File accusation (snitch only, free action) ────────────────────────────
    // action.targetPlayerId: number, action.claimedLocations: Array<{ vehicleId: number; cityId: number }>
    if (action.type === 'file_accusation' && playerRow.role === 'snitch' && action.cityId) {
      const targetId = action.cityId  // reuse cityId field as targetPlayerId
      const claimedLocations = (action.targetPath ?? []) as unknown as Array<{ vehicleId: number; cityId: number }>

      // One accusation per target per season (not per turn — check recent)
      const alreadyAccused = await c.env.PROHIBITIONDB.prepare(
        `SELECT id FROM snitch_accusations WHERE game_id = ? AND snitch_id = ? AND target_id = ? AND season = ?`
      ).bind(gameId, playerRow.id, targetId, playerRow.current_season).first()
      if (!alreadyAccused && claimedLocations.length > 0) {
        // Fetch target's actual vehicle positions
        const { results: targetVehicles } = await c.env.PROHIBITIONDB.prepare(
          `SELECT id, city_id FROM vehicles WHERE player_id = ?`
        ).bind(targetId).all<{ id: number; city_id: number }>()

        const success = targetVehicles.length > 0 && targetVehicles.every(v => {
          const claim = claimedLocations.find(cl => cl.vehicleId === v.id)
          return claim && claim.cityId === v.city_id
        }) && claimedLocations.length === targetVehicles.length

        const targetNameRow = await c.env.PROHIBITIONDB.prepare(
          `SELECT COALESCE(display_name, 'Someone') AS name FROM game_players WHERE id = ?`
        ).bind(targetId).first<{ name: string }>()
        const targetName = (targetNameRow?.name ?? 'Someone').replace(/@.*$/, '')

        await c.env.PROHIBITIONDB.prepare(
          `INSERT INTO snitch_accusations (game_id, snitch_id, target_id, season, success) VALUES (?, ?, ?, ?, ?)`
        ).bind(gameId, playerRow.id, targetId, playerRow.current_season, success ? 1 : 0).run()

        if (success) {
          // Jail the target
          const { results: targetCargoRows } = await c.env.PROHIBITIONDB.prepare(
            `SELECT COALESCE(SUM(vi.quantity), 0) AS total FROM vehicle_inventory vi JOIN vehicles v ON vi.vehicle_id = v.id WHERE v.player_id = ?`
          ).bind(targetId).all<{ total: number }>()
          const targetCargo = targetCargoRows[0]?.total ?? 0
          const jailTime = calculateFedJailTime(targetCargo)
          await c.env.PROHIBITIONDB.prepare(
            `UPDATE game_players SET jail_until_season = ?, jailed_count = jailed_count + 1 WHERE id = ?`
          ).bind(playerRow.current_season + jailTime, targetId).run()
          await c.env.PROHIBITIONDB.prepare(
            `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, NULL, ?, 1)`
          ).bind(gameId, `🕵️ An accusation was brought against ${targetName}. ${targetName} has been sent to jail by the feds.`).run()

          // Feds-win check: was target rank 1?
          const { results: wealthRank } = await c.env.PROHIBITIONDB.prepare(
            `SELECT id FROM game_players WHERE game_id = ? AND role = 'bootlegger' ORDER BY cash DESC`
          ).bind(gameId).all<{ id: number }>()
          const isLeader = wealthRank[0]?.id === targetId || wealthRank.length === 0
          if (isLeader) {
            // All non-snitch players are jailed or eliminated — feds win
            await c.env.PROHIBITIONDB.prepare(
              `UPDATE games SET status = 'ended' WHERE id = ?`
            ).bind(gameId).run()
          }
        } else {
          // Burn next stipend
          await c.env.PROHIBITIONDB.prepare(
            `UPDATE game_players SET pending_sightings = '[]' WHERE id = ?`
          ).bind(playerRow.id).run()
          await c.env.PROHIBITIONDB.prepare(
            `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, NULL, ?, 1)`
          ).bind(gameId, `🕵️ A failed accusation was brought against ${targetName}.`).run()
        }
      }
    }
  }

  // ── Check mission completion (after all actions, before turn advance) ──────
  if (!policeEncounterResult) {
    const [freshRow, maxTierRow, cityCountRow, vehicleCountRow, cargoRows, statRow] = await Promise.all([
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
      c.env.PROHIBITIONDB.prepare(
        `SELECT MAX(? - stationary_since + 1) AS max_stat FROM vehicles WHERE player_id = ? AND stationary_since IS NOT NULL`
      ).bind(playerRow.current_season, playerRow.id).first<{ max_stat: number | null }>(),
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
      maxVehicleStationary: statRow?.max_stat ?? 0,
    }
    const missionResult = await checkAndCompleteMissions(
      c.env.PROHIBITIONDB, gameId, playerRow.id, playerRow.current_season, snapshot
    )
    for (const cardId of missionResult.completedCardIds) {
      const card = getMissionCard(cardId)
      if (card?.reward) addLedger('mission', card.reward, card.title)
      celebrations.push({ type: 'mission_complete', missionCardId: cardId, reward: card?.reward ?? 0 })
    }
  }

  // If an encounter was triggered this turn, hold the turn until the player resolves it
  if (fedEncounterResult) {
    await flushLedger()
    return c.json({ success: true, fedEncounter: fedEncounterResult } as object)
  }
  if (policeEncounterResult) {
    await flushLedger()
    return c.json({ success: true, policeEncounter: policeEncounterResult } as object)
  }

  // Market/free actions (buy, sell, pickup, sell_city_stock, upgrade_*, claim_city, bribe_official)
  // do NOT end the turn — only move, stay, skip are terminal
  const TERMINAL_ACTIONS = new Set(['move', 'stay', 'skip', 'police_resolve', 'fed_stop_respond'])
  const hasTerminal = (actions as Action[]).some(a => TERMINAL_ACTIONS.has(a.type))
  if (!hasTerminal) {
    await flushLedger()
    return c.json({ success: true, celebrations: celebrations.length > 0 ? celebrations : undefined })
  }

  // ── Vehicle breakdown: warn on turn 4, require repair/abandon decision on turn 5 ──
  // Only runs when a terminal action (move/stay/skip) ends the turn — never on market-only batches
  const { results: freshVehicles } = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, vehicle_type, city_id, stationary_since FROM vehicles WHERE player_id = ? ORDER BY id`
  ).bind(playerRow.id).all<{ id: number; vehicle_type: string; city_id: number; stationary_since: number }>()

  for (const v of freshVehicles) {
    const turnsStationary = playerRow.current_season - v.stationary_since + 1
    if (turnsStationary >= 5) {
      const repairCost = Math.floor((VEHICLE_PRICES[v.vehicle_type] ?? 300) * 0.75)
      await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, { type: 'vehicle_broke_down' })
      celebrations.push({ type: 'vehicle_breakdown', vehicleType: v.vehicle_type, vehicleDbId: v.id, repairCost, cityId: v.city_id })
    } else if (turnsStationary === 4) {
      celebrations.push({ type: 'vehicle_warning', vehicleType: v.vehicle_type, cityId: v.city_id })
    }
  }

  // Advance turn index, wrapping back to 0 and bumping season when all players have gone
  // Use max_players (total seats including NPCs) — player_count is human-only
  const totalPlayers = playerRow.max_players
  let nextIndex  = (playerRow.current_player_index + 1) % totalPlayers
  let nextSeason = playerRow.current_season + (nextIndex === 0 ? 1 : 0)

  // Execute NPC AI turns — each NPC sells stock, upgrades or expands per archetype
  const npcTurnInserts: ReturnType<typeof c.env.PROHIBITIONDB.prepare>[] = []
  const ranNpcPositions = new Set<number>()
  for (let i = 0; i < totalPlayers; i++) {
    const next = playerByOrder.get(nextIndex)
    if (!next || !next.is_npc) break
    await runNpcTurn(c.env.PROHIBITIONDB, gameId, next.id, nextSeason)
    npcTurnInserts.push(c.env.PROHIBITIONDB.prepare(
      `INSERT INTO turns (game_id, player_id, season, actions, skipped) VALUES (?, ?, ?, ?, 0)`
    ).bind(gameId, next.id, nextSeason, JSON.stringify([{ type: 'npc_turn' }])))
    ranNpcPositions.add(nextIndex)
    nextIndex  = (nextIndex + 1) % totalPlayers
    nextSeason += nextIndex === 0 ? 1 : 0
  }
  if (npcTurnInserts.length > 0) await c.env.PROHIBITIONDB.batch(npcTurnInserts)

  // Auto-skip jailed human players — advance past them without waiting for input
  const jailSkipInserts: ReturnType<typeof c.env.PROHIBITIONDB.prepare>[] = []
  for (let i = 0; i < totalPlayers; i++) {
    const next = playerByOrder.get(nextIndex)
    if (!next || next.is_npc) break
    const isJailed = next.jail_until_season != null && nextSeason <= next.jail_until_season
    if (!isJailed) break
    jailSkipInserts.push(c.env.PROHIBITIONDB.prepare(
      `INSERT INTO turns (game_id, player_id, season, actions, skipped) VALUES (?, ?, ?, ?, 1)`
    ).bind(gameId, next.id, nextSeason, JSON.stringify([{ type: 'jail_skip' }])))
    nextIndex  = (nextIndex + 1) % totalPlayers
    nextSeason += nextIndex === 0 ? 1 : 0
    // After advancing past a jailed player, also run any NPCs that follow and haven't run yet
    for (let j = 0; j < totalPlayers; j++) {
      const afterJail = playerByOrder.get(nextIndex)
      if (!afterJail || !afterJail.is_npc) break
      if (ranNpcPositions.has(nextIndex)) {
        // This NPC already ran this round — advance index but don't bump the season again
        nextIndex = (nextIndex + 1) % totalPlayers
        continue
      }
      await runNpcTurn(c.env.PROHIBITIONDB, gameId, afterJail.id, nextSeason)
      jailSkipInserts.push(c.env.PROHIBITIONDB.prepare(
        `INSERT INTO turns (game_id, player_id, season, actions, skipped) VALUES (?, ?, ?, ?, 0)`
      ).bind(gameId, afterJail.id, nextSeason, JSON.stringify([{ type: 'npc_turn' }])))
      ranNpcPositions.add(nextIndex)
      nextIndex  = (nextIndex + 1) % totalPlayers
      nextSeason += nextIndex === 0 ? 1 : 0
    }
  }
  if (jailSkipInserts.length > 0) await c.env.PROHIBITIONDB.batch(jailSkipInserts)

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

    // Per-vehicle heat decay (-3 per season)
    await c.env.PROHIBITIONDB.prepare(
      `UPDATE vehicles SET heat = MAX(0, heat - 3) WHERE game_id = ?`
    ).bind(gameId).run()

    // Expire lapsed bribes
    await c.env.PROHIBITIONDB.prepare(
      `UPDATE game_cities SET bribe_player_id = NULL, bribe_expires_season = NULL
       WHERE game_id = ? AND bribe_expires_season IS NOT NULL AND bribe_expires_season <= ?`
    ).bind(gameId, nextSeason).run()

    // Per-player heat decay with structural floor.
    // Cities and distilleries set a permanent heat floor that decay cannot go below:
    //   +1 per owned city, +0/+1/+1/+2/+3 per distillery tier 1–5
    // Priest/Nun decays 2× faster (heatDecayMultiplier: 2.0); BASE_HEAT_DECAY=8
    const { results: heatPlayers } = await c.env.PROHIBITIONDB.prepare(
      `SELECT gp.id, gp.heat, gp.character_class,
         (SELECT COUNT(*) FROM game_cities WHERE owner_player_id = gp.id AND game_id = ?) +
         COALESCE((SELECT COUNT(*) FROM distilleries d WHERE d.player_id = gp.id AND d.tier >= 2), 0) AS structural_heat
       FROM game_players gp WHERE gp.game_id = ?`
    ).bind(gameId, gameId).all<{ id: number; heat: number; character_class: string; structural_heat: number }>()
    const BASE_HEAT_DECAY = 8
    await c.env.PROHIBITIONDB.batch(heatPlayers.map(p => {
      const decay = Math.floor(BASE_HEAT_DECAY * (getCharacter(p.character_class)?.modifiers.heatDecayMultiplier ?? 1.0))
      const newHeat = Math.max(p.structural_heat, Math.max(0, p.heat - decay))
      return c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET heat = ? WHERE id = ?`).bind(newHeat, p.id)
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
    const jazzCityCount = new Map<number, { large: number; major: number }>()
    for (const r of jazzRows) {
      jazzMap.set(r.id, (jazzMap.get(r.id) ?? 0) + (JAZZ_INCOME[r.population_tier] ?? 0))
      const counts = jazzCityCount.get(r.id) ?? { large: 0, major: 0 }
      if (r.population_tier === 'large') counts.large++
      else if (r.population_tier === 'major') counts.major++
      jazzCityCount.set(r.id, counts)
    }
    await Promise.all([...jazzMap.entries()].map(async ([pid, income]) => {
      await c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ? WHERE id = ?`).bind(income, pid).run()
      const counts = jazzCityCount.get(pid) ?? { large: 0, major: 0 }
      const parts = [counts.large > 0 ? `${counts.large} large` : '', counts.major > 0 ? `${counts.major} major` : ''].filter(Boolean).join(', ')
      const desc = `Jazz Singer income (${parts})`
      await c.env.PROHIBITIONDB.prepare(
        `INSERT INTO ledger_entries (game_id, player_id, season, type, amount, description, city_id) VALUES (?, ?, ?, 'jazz_income', ?, ?, NULL)`
      ).bind(gameId, pid, playerRow.current_season, income, desc).run()
      // Notify the jazz singer player
      await c.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, ?, ?, 1)`
      ).bind(gameId, pid, `🎵 Jazz Singer passive income: +$${income.toLocaleString()} (${parts})`).run()
    }))

    // Snitch stipend: $100 per sighting queued this season; clear pending_sightings
    const { results: snitchRows } = await c.env.PROHIBITIONDB.prepare(
      `SELECT id, pending_sightings FROM game_players WHERE game_id = ? AND role = 'snitch' AND pending_sightings IS NOT NULL`
    ).bind(gameId).all<{ id: number; pending_sightings: string }>()
    for (const snitch of snitchRows) {
      const sightings = JSON.parse(snitch.pending_sightings) as Array<unknown>
      if (sightings.length === 0) continue
      const stipend = sightings.length * 100
      await c.env.PROHIBITIONDB.prepare(
        `UPDATE game_players SET cash = cash + ?, pending_sightings = NULL WHERE id = ?`
      ).bind(stipend, snitch.id).run()
      await c.env.PROHIBITIONDB.prepare(
        `INSERT INTO ledger_entries (game_id, player_id, season, type, amount, description, city_id) VALUES (?, ?, ?, 'snitch_stipend', ?, ?, NULL)`
      ).bind(gameId, snitch.id, playerRow.current_season, stipend, `Fed stipend — ${sightings.length} sighting${sightings.length !== 1 ? 's' : ''}`).run()
    }
  }

  // End game after the final season
  if (nextSeason > playerRow.total_seasons) {
    await c.env.PROHIBITIONDB.prepare(
      `UPDATE games SET status = 'ended', current_player_index = ?, current_season = ? WHERE id = ?`
    ).bind(nextIndex, nextSeason, gameId).run()
    await recordLeaderboardEntries(c.env.PROHIBITIONDB, gameId, playerRow.total_seasons, playerRow.current_season).catch(() => {})
    await flushLedger()
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

    // End-game: final season completed
    if (nextSeason > playerRow.total_seasons) {
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
      recordLeaderboardEntries(c.env.PROHIBITIONDB, gameId, playerRow.total_seasons, playerRow.current_season).catch(() => {})
    }
  }

  // All-snitches check: if every active (non-jailed) player is now a snitch, feds win
  {
    const activePlayers = await c.env.PROHIBITIONDB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN role = 'snitch' THEN 1 ELSE 0 END) AS snitches
       FROM game_players WHERE game_id = ? AND is_npc = 0`
    ).bind(gameId).first<{ total: number; snitches: number }>()
    if (activePlayers && activePlayers.total > 0 && activePlayers.snitches >= activePlayers.total) {
      await c.env.PROHIBITIONDB.prepare(`UPDATE games SET status = 'ended' WHERE id = ?`).bind(gameId).run()
      await c.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_messages (game_id, player_id, message, is_system) VALUES (?, NULL, ?, 1)`
      ).bind(gameId, `🕵️ All players have been recruited by the feds. The feds win. Everyone loses.`).run()
    }
  }

  await c.env.PROHIBITIONDB.batch([
    c.env.PROHIBITIONDB.prepare(`UPDATE games SET current_player_index = ?, current_season = ? WHERE id = ?`).bind(nextIndex, nextSeason, gameId),
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET sell_used = 0, max_out_used = 0 WHERE id = ?`).bind(playerRow.id),
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET turn_started_at = datetime('now') WHERE game_id = ? AND turn_order = ? AND is_npc = 0`).bind(gameId, nextIndex),
  ])

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
      fetch('https://3mails.ai/api/transactional/7f0bae80-5a69-4e9d-9e93-11dfe9dcfe62/send', {
        method: 'POST',
        headers: {
          'X-API-Key': '5145e2fc29f74b3ca9876de0087fd1c0003c65da4244f8a9aeba15f67a5c137d',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: nextPlayer.email,
          variables: {
            playerName: nextPlayer.display_name ?? nextPlayer.email.split('@')[0],
            gameName: nextPlayer.game_name ?? 'Prohibition',
            gameUrl: `https://game.prohibitioner.com/games/${gameId}`,
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
          url: `https://game.prohibitioner.com/games/${gameId}`,
        },
        c.env,
      )
    )
  }

  await flushLedger()
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
    `SELECT id, status, current_season, total_seasons, current_player_index, turn_deadline, player_count, max_players, invite_code, host_user_id, game_name, is_public
     FROM games WHERE id = ?`
  ).bind(gameId).first<{
    id: string; status: string; current_season: number; total_seasons: number
    current_player_index: number; turn_deadline: string | null; player_count: number; max_players: number
    invite_code: string; host_user_id: number; game_name: string | null; is_public: number
  }>()
  if (!game) return c.json({ success: false, message: 'Game not found' }, 404)

  const player = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.character_class, gp.cash, gp.heat,
            gp.jail_until_season, gp.current_city_id, gp.home_city_id, gp.adjustment_cards,
            gp.pending_drinks, gp.pending_trap, gp.stuck_until_season, gp.tutorial_seen,
            gp.total_cash_earned, gp.consecutive_clean_seasons, gp.role, gp.pending_sightings
     FROM game_players gp
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; character_class: string;
    cash: number; heat: number; jail_until_season: number | null;
    current_city_id: number | null; home_city_id: number | null; adjustment_cards: number;
    pending_drinks: string | null; pending_trap: string | null; stuck_until_season: number | null
    tutorial_seen: number; total_cash_earned: number; consecutive_clean_seasons: number
    role: string; pending_sightings: string | null
  }>()
  if (!player) return c.json({ success: false, message: 'Not in game' }, 403)

  const { results: players } = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.character_class, gp.is_npc, gp.current_city_id, gp.cash,
            gp.display_name, gp.turn_started_at, gp.role, u.email
     FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id
     WHERE gp.game_id = ? ORDER BY gp.turn_order`
  ).bind(gameId).all<{
    id: number; turn_order: number; character_class: string; is_npc: number;
    current_city_id: number | null; cash: number; display_name: string | null
    turn_started_at: string | null; email: string | null; role: string
  }>()

  const { results: vehicleRows } = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, vehicle_type, city_id, heat, stationary_since, purchase_price FROM vehicles WHERE player_id = ? ORDER BY id`
  ).bind(player.id).all<{ id: number; vehicle_type: string; city_id: number; heat: number; stationary_since: number; purchase_price: number }>()

  const vehicleIds = vehicleRows.map(v => v.id)
  let vehicleInventories: Array<{ vehicle_id: number; alcohol_type: string; quantity: number }> = []
  if (vehicleIds.length > 0) {
    const { results: vinv } = await c.env.PROHIBITIONDB.prepare(
      `SELECT vehicle_id, alcohol_type, quantity FROM vehicle_inventory WHERE vehicle_id IN (${vehicleIds.map(() => '?').join(',')}) AND quantity > 0`
    ).bind(...vehicleIds).all<{ vehicle_id: number; alcohol_type: string; quantity: number }>()
    vehicleInventories = vinv
  }

  const { results: distilleries } = await c.env.PROHIBITIONDB.prepare(
    `SELECT d.id, d.city_id, d.tier, cp.primary_alcohol, cp.name AS city_name, cp.is_coastal
     FROM distilleries d
     JOIN game_cities gc ON d.city_id = gc.id
     JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE d.player_id = ?`
  ).bind(player.id).all<{ id: number; city_id: number; tier: number; primary_alcohol: string; city_name: string; is_coastal: number }>()
  const distilleryCityIds = distilleries.map(d => d.city_id)

  // Bribe status for current city
  const bribedCityIds = player.current_city_id ? await (async () => {
    const { results: bribes } = await c.env.PROHIBITIONDB.prepare(
      `SELECT id FROM game_cities WHERE game_id = ? AND bribe_player_id = ? AND bribe_expires_season > ?`
    ).bind(gameId, player.id, game.current_season).all<{ id: number }>()
    return bribes.map(b => b.id)
  })() : []

  // Competitor stills at all vehicle cities (for sabotage + steal buttons)
  const vehicleCityIds = vehicleRows.map(v => v.city_id)
  let competitorStillsByCity: Array<{ city_id: number; tier: number; owner_player_id: number; city_is_bribed: number; owner_vehicle_present: number }> = []
  if (vehicleCityIds.length > 0) {
    const placeholders = vehicleCityIds.map(() => '?').join(',')
    const { results: csRows } = await c.env.PROHIBITIONDB.prepare(
      `SELECT d.city_id, d.tier, d.player_id AS owner_player_id,
              CASE WHEN gc.bribe_player_id IS NOT NULL AND gc.bribe_expires_season > ? THEN 1 ELSE 0 END AS city_is_bribed,
              CASE WHEN EXISTS(SELECT 1 FROM vehicles ov WHERE ov.player_id = d.player_id AND ov.city_id = d.city_id) THEN 1 ELSE 0 END AS owner_vehicle_present
       FROM distilleries d
       JOIN game_cities gc ON d.city_id = gc.id
       WHERE d.city_id IN (${placeholders})
         AND gc.owner_player_id IS NOT NULL
         AND d.player_id = gc.owner_player_id
         AND d.player_id != ?`
    ).bind(game.current_season, ...vehicleCityIds, player.id).all<{ city_id: number; tier: number; owner_player_id: number; city_is_bribed: number; owner_vehicle_present: number }>()
    competitorStillsByCity = csRows
  }
  // Keep legacy single-city field for compatibility
  const currentCityCompetitorStill = competitorStillsByCity.find(s => s.city_id === player.current_city_id) ?? null

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

  const [{ results: missionRows }, completedMissionsRow, { results: informantRows }] = await Promise.all([
    c.env.PROHIBITIONDB.prepare(
      `SELECT id, card_id, status, progress, assigned_season
       FROM player_missions WHERE player_id = ? AND status = 'held' ORDER BY assigned_season`
    ).bind(player.id).all<{ id: number; card_id: number; status: string; progress: string; assigned_season: number }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT COUNT(*) AS count FROM player_missions WHERE player_id = ? AND status = 'completed'`
    ).bind(player.id).first<{ count: number }>(),
    player.role === 'snitch'
      ? c.env.PROHIBITIONDB.prepare(
          `SELECT i.id, i.city_id, cp.name AS city_name
           FROM informants i
           LEFT JOIN game_cities gc ON i.city_id = gc.id
           LEFT JOIN city_pool cp ON gc.city_pool_id = cp.id
           WHERE i.snitch_id = ? AND i.game_id = ?`
        ).bind(player.id, gameId).all<{ id: number; city_id: number | null; city_name: string | null }>()
      : Promise.resolve({ results: [] as Array<{ id: number; city_id: number | null; city_name: string | null }> }),
  ])

  return c.json({
    success: true,
    data: {
      game: {
        status:               game.status,
        currentSeason:        game.current_season,
        totalSeasons:         game.total_seasons,
        currentPlayerIndex:   game.current_player_index,
        turnDeadline:         game.turn_deadline,
        inviteCode:           game.invite_code,
        gameName:             game.game_name ?? null,
        isHost:               game.host_user_id === userId,
        maxPlayers:           game.max_players,
        isPublic:             game.is_public === 1,
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
        claimCostMultiplier:       getCharacter(player.character_class)?.modifiers.takeoverCostMultiplier ?? 1.0,
        currentCityCompetitorStill: currentCityCompetitorStill
          ? { tier: currentCityCompetitorStill.tier, ownerPlayerId: currentCityCompetitorStill.owner_player_id }
          : null,
        competitorStillsByCity: competitorStillsByCity.map(s => ({ cityId: s.city_id, tier: s.tier, ownerPlayerId: s.owner_player_id, cityIsBribed: s.city_is_bribed === 1, ownerVehiclePresent: s.owner_vehicle_present === 1 })),
        currentCityHasTrap: !!currentCityTrapRow,
        myTraps:          myTrapRows.map(t => ({ cityId: t.city_id, consequenceType: t.consequence_type, cityName: t.city_name })),
        pendingDrinks:    JSON.parse(player.pending_drinks ?? '[]') as Array<{ senderName: string; alcoholType: string }>,
        pendingTrap:      player.pending_trap ? JSON.parse(player.pending_trap) as { setterName: string; consequenceType: string; cityName: string; params: Record<string, number> } : null,
        vehicles:         vehicleRows.map(v => ({
          id:              v.id,
          vehicleType:     v.vehicle_type,
          cityId:          v.city_id,
          heat:            v.heat,
          stationarySince: v.stationary_since,
          purchasePrice:   v.purchase_price,
          saleValue:       Math.floor(v.purchase_price * 0.5),
          cargoSlots:      applyCargoMultiplier(player.character_class, VEHICLES[v.vehicle_type]?.cargoSlots ?? 16),
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
          isCoastal:     d.is_coastal === 1,
        })),
        missions:         missionRows.map(m => ({
          id:             m.id,
          cardId:         m.card_id,
          progress:       JSON.parse(m.progress),
          assignedSeason: m.assigned_season,
        })),
        completedMissions: completedMissionsRow?.count ?? 0,
        role: player.role ?? 'bootlegger',
        informants: informantRows.map(i => ({ id: i.id, cityId: i.city_id ?? null, cityName: i.city_name ?? null })),
        pendingSightings: player.pending_sightings
          ? JSON.parse(player.pending_sightings) as Array<{ playerName: string; cityId: number; cityName: string; season: number }>
          : [],
      },
      players: [...players]
        .sort((a, b) => {
          // Snitches always rank last on the scoreboard
          const aSnitch = (a.role ?? 'bootlegger') === 'snitch' ? 1 : 0
          const bSnitch = (b.role ?? 'bootlegger') === 'snitch' ? 1 : 0
          if (aSnitch !== bSnitch) return aSnitch - bSnitch
          return b.cash - a.cash
        })
        .map(p => ({
          id:            p.id,
          turnOrder:     p.turn_order,
          characterClass: p.character_class,
          isNpc:         p.is_npc === 1,
          currentCityId: p.current_city_id,
          turnStartedAt: p.turn_started_at ?? null,
          role:          p.role ?? 'bootlegger',
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

gamesRouter.get('/:id/timing', async (c) => {
  const gameId = c.req.param('id')
  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT t.player_id, gp.display_name, u.email,
            CAST(ROUND(AVG(t.duration_seconds)) AS INTEGER) AS avg_seconds,
            MAX(t.duration_seconds) AS max_seconds,
            SUM(t.duration_seconds) AS total_seconds,
            COUNT(*) AS turn_count
     FROM turns t
     JOIN game_players gp ON gp.id = t.player_id
     LEFT JOIN users u ON gp.user_id = u.id
     WHERE t.game_id = ? AND t.duration_seconds IS NOT NULL AND gp.is_npc = 0
     GROUP BY t.player_id
     ORDER BY avg_seconds DESC`
  ).bind(gameId).all<{
    player_id: number; display_name: string | null; email: string | null
    avg_seconds: number; max_seconds: number; total_seconds: number; turn_count: number
  }>()

  return c.json({
    success: true,
    players: results.map(r => ({
      playerId:     r.player_id,
      name:         r.display_name ?? r.email?.split('@')[0] ?? 'Player',
      avgSeconds:   r.avg_seconds,
      maxSeconds:   r.max_seconds,
      totalSeconds: r.total_seconds,
      turnCount:    r.turn_count,
    }))
  })
})

gamesRouter.get('/:id/ledger', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id FROM game_players gp WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number }>()
  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)

  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT le.id, le.season, le.type, le.amount, le.description,
            cp.name AS city_name
     FROM ledger_entries le
     LEFT JOIN game_cities gc ON le.city_id = gc.id
     LEFT JOIN city_pool cp ON gc.city_pool_id = cp.id
     WHERE le.game_id = ? AND le.player_id = ?
     ORDER BY le.id DESC
     LIMIT 300`
  ).bind(gameId, playerRow.id).all<{
    id: number; season: number; type: string; amount: number; description: string; city_name: string | null
  }>()

  return c.json({ success: true, entries: results })
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

  // Distillery net-worth contribution — ~25% of cumulative investment (stills also generate production revenue, so book value is discounted)
  const DIST_VALUE: Record<number, number> = { 1: 50, 2: 175, 3: 425, 4: 900, 5: 1900 }
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
    { results: missionRows },
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
    c.env.PROHIBITIONDB.prepare(
      `SELECT pm.player_id, pm.card_id, pm.status
       FROM player_missions pm
       JOIN game_players gp ON pm.player_id = gp.id
       WHERE gp.game_id = ? AND pm.status IN ('completed', 'failed')`
    ).bind(gameId).all<{ player_id: number; card_id: number; status: string }>(),
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

    const playerMissions = missionRows.filter(m => m.player_id === p.id)
    const missionsCompleted = playerMissions.filter(m => m.status === 'completed').length
    const failedRows = playerMissions.filter(m => m.status === 'failed')
    const missionsFailed = failedRows.length
    const missionPenalty = failedRows.reduce((s, m) => s + (getMissionCard(m.card_id)?.reward ?? 0), 0)

    return {
      playerId:  p.id,
      isYou:     p.user_id === userId,
      isNpc:     p.is_npc === 1,
      name:      p.display_name ?? (p.is_npc ? `NPC ${p.id}` : (p.email?.split('@')[0] ?? 'Player')),
      components: { cash: cashVal, inventory: inventoryVal, distilleries: distilleryVal, vehicles: vehicleVal, cities: citiesVal },
      total,
      missionsCompleted,
      missionsFailed,
      missionPenalty,
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
      fetch('https://3mails.ai/api/transactional/ba704366-0a0c-4547-8d80-136933a29631/send', {
        method: 'POST',
        headers: {
          'X-API-Key': '5145e2fc29f74b3ca9876de0087fd1c0003c65da4244f8a9aeba15f67a5c137d',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipient.email,
          variables: {
            sender: senderName,
            drink: typeLabel,
            drinkImageUrl: `https://game.prohibitioner.com/drinks/${alcoholType}.png`,
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

// POST /:id/vehicle-repair — repair or abandon a broken-down vehicle (free action, no turn advance)
gamesRouter.post('/:id/vehicle-repair', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { vehicleId, choice } = await c.req.json<{ vehicleId: number; choice: 'repair' | 'abandon' }>()

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.cash, gp.character_class, gp.display_name, g.current_season, g.status
     FROM game_players gp JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; cash: number; character_class: string; display_name: string | null
    current_season: number; status: string
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)

  // Verify player owns this vehicle and it is actually broken down (stationary for >= 5 turns)
  const vehicle = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, vehicle_type, city_id, stationary_since FROM vehicles WHERE id = ? AND player_id = ?`
  ).bind(vehicleId, playerRow.id).first<{ id: number; vehicle_type: string; city_id: number; stationary_since: number }>()

  if (!vehicle) return c.json({ success: false, message: 'Vehicle not found' }, 404)

  const turnsStationary = playerRow.current_season - vehicle.stationary_since + 1
  if (turnsStationary < 5) return c.json({ success: false, message: 'Vehicle is not broken down' }, 400)

  if (choice === 'repair') {
    const repairCost = Math.floor((VEHICLE_PRICES[vehicle.vehicle_type] ?? 300) * 0.75)
    if (playerRow.cash < repairCost) {
      return c.json({ success: false, message: `Not enough cash — repair costs $${repairCost.toLocaleString()}` }, 400)
    }
    await c.env.PROHIBITIONDB.batch([
      c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(repairCost, playerRow.id),
      c.env.PROHIBITIONDB.prepare(`UPDATE vehicles SET stationary_since = ? WHERE id = ?`).bind(playerRow.current_season, vehicle.id),
      c.env.PROHIBITIONDB.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
        .bind(gameId, playerRow.id,
          `🔧 Repaired the ${vehicle.vehicle_type.replace(/_/g, ' ')} for $${repairCost.toLocaleString()}.`),
      c.env.PROHIBITIONDB.prepare(
        `INSERT INTO ledger_entries (game_id, player_id, season, type, amount, description, city_id) VALUES (?, ?, ?, 'vehicle_repair', ?, ?, ?)`
      ).bind(gameId, playerRow.id, playerRow.current_season, -repairCost, `Repaired ${vehicle.vehicle_type.replace(/_/g, ' ')}`, vehicle.city_id),
    ])
    return c.json({ success: true, choice: 'repair', repairCost })
  } else {
    // Abandon — remove vehicle and its cargo
    const vehicleName = vehicle.vehicle_type.replace(/_/g, ' ')
    await c.env.PROHIBITIONDB.batch([
      c.env.PROHIBITIONDB.prepare(`DELETE FROM vehicle_inventory WHERE vehicle_id = ?`).bind(vehicle.id),
      c.env.PROHIBITIONDB.prepare(`DELETE FROM vehicles WHERE id = ?`).bind(vehicle.id),
      c.env.PROHIBITIONDB.prepare(`INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`)
        .bind(gameId, playerRow.id, `🚗 Abandoned the broken-down ${vehicleName} — it's been stripped for parts.`),
    ])
    await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, { type: 'vehicle_abandoned' })
    return c.json({ success: true, choice: 'abandon' })
  }
})

// POST /:id/sell-distillery-stock — sell all city_inventory at cities where the player has a vehicle (free action, no turn advance)
gamesRouter.post('/:id/sell-distillery-stock', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.cash, gp.character_class, gp.display_name,
            gp.jail_until_season, gp.sell_used, g.current_player_index, g.current_season, g.status
     FROM game_players gp JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; cash: number; character_class: string; display_name: string | null
    jail_until_season: number | null; sell_used: number; current_player_index: number; current_season: number; status: string
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) return c.json({ success: false, message: 'Not your turn' }, 400)
  if (playerRow.jail_until_season != null && playerRow.current_season <= playerRow.jail_until_season) {
    return c.json({ success: false, message: 'Cannot sell while in jail' }, 400)
  }
  if (playerRow.sell_used >= 1) return c.json({ success: false, message: 'Sell Everything already used this turn' }, 400)

  const BASE_PRICES: Record<string, number> = {
    beer: 15, gin: 25, rum: 20, whiskey: 30, moonshine: 20,
    vodka: 22, bourbon: 28, rye: 26, scotch: 35, tequila: 24,
    brandy: 28, wine: 18, vermouth: 22, malort: 15
  }
  const charMods = getCharacter(playerRow.character_class)?.modifiers

  // Fetch vehicle IDs where the player has a car present
  const { results: playerVehiclesForSell } = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, city_id FROM vehicles WHERE player_id = ? AND game_id = ?`
  ).bind(playerRow.id, gameId).all<{ id: number; city_id: number }>()
  const vehicleCityIds = [...new Set(playerVehiclesForSell.map(v => v.city_id))]
  const vehicleIds = playerVehiclesForSell.map(v => v.id)

  if (vehicleCityIds.length === 0) return c.json({ success: true, revenue: 0, message: 'Nothing to sell' })

  const cityPlaceholders = vehicleCityIds.map(() => '?').join(',')

  // Distillery (city) inventory at cities where player has a vehicle
  const { results: stockWithPrices } = await c.env.PROHIBITIONDB.prepare(
    `SELECT ci.city_id, ci.alcohol_type, ci.quantity,
            COALESCE(mp.price, 20) AS market_price
     FROM city_inventory ci
     JOIN distilleries d ON d.city_id = ci.city_id AND d.player_id = ?
     LEFT JOIN market_prices mp ON mp.game_id = ? AND mp.city_id = ci.city_id
       AND mp.season = ? AND mp.alcohol_type = ci.alcohol_type
     WHERE ci.game_id = ? AND ci.city_id IN (${cityPlaceholders}) AND ci.quantity > 0`
  ).bind(playerRow.id, gameId, playerRow.current_season, gameId, ...vehicleCityIds)
   .all<{ city_id: number; alcohol_type: string; quantity: number; market_price: number }>()

  // Vehicle cargo inventory
  let vehicleStockWithPrices: Array<{ vehicle_id: number; city_id: number; alcohol_type: string; quantity: number; market_price: number }> = []
  if (vehicleIds.length > 0) {
    const vPlaceholders = vehicleIds.map(() => '?').join(',')
    const { results: vStock } = await c.env.PROHIBITIONDB.prepare(
      `SELECT vi.vehicle_id, v.city_id, vi.alcohol_type, vi.quantity,
              COALESCE(mp.price, 20) AS market_price
       FROM vehicle_inventory vi
       JOIN vehicles v ON vi.vehicle_id = v.id
       LEFT JOIN market_prices mp ON mp.game_id = ? AND mp.city_id = v.city_id
         AND mp.season = ? AND mp.alcohol_type = vi.alcohol_type
       WHERE vi.vehicle_id IN (${vPlaceholders}) AND vi.quantity > 0`
    ).bind(gameId, playerRow.current_season, ...vehicleIds)
     .all<{ vehicle_id: number; city_id: number; alcohol_type: string; quantity: number; market_price: number }>()
    vehicleStockWithPrices = vStock
  }

  if (stockWithPrices.length === 0 && vehicleStockWithPrices.length === 0) {
    return c.json({ success: true, revenue: 0, message: 'Nothing to sell' })
  }

  let totalRevenue = 0
  const batchOps: ReturnType<typeof c.env.PROHIBITIONDB.prepare>[] = []

  for (const row of stockWithPrices) {
    const sellMult = row.alcohol_type === 'whiskey' && charMods?.medicinalPriceMultiplier != null && charMods.medicinalPriceMultiplier !== 1.0
      ? charMods.medicinalPriceMultiplier
      : (charMods?.sellPriceMultiplier ?? 1.0)
    const unitPrice = Math.round((row.market_price ?? BASE_PRICES[row.alcohol_type] ?? 20) * sellMult)
    totalRevenue += Math.floor(unitPrice * row.quantity)
    batchOps.push(
      c.env.PROHIBITIONDB.prepare(
        `UPDATE city_inventory SET quantity = 0 WHERE game_id = ? AND city_id = ? AND alcohol_type = ?`
      ).bind(gameId, row.city_id, row.alcohol_type)
    )
  }

  for (const row of vehicleStockWithPrices) {
    const sellMult = row.alcohol_type === 'whiskey' && charMods?.medicinalPriceMultiplier != null && charMods.medicinalPriceMultiplier !== 1.0
      ? charMods.medicinalPriceMultiplier
      : (charMods?.sellPriceMultiplier ?? 1.0)
    const unitPrice = Math.round((row.market_price ?? BASE_PRICES[row.alcohol_type] ?? 20) * sellMult)
    totalRevenue += Math.floor(unitPrice * row.quantity)
    batchOps.push(
      c.env.PROHIBITIONDB.prepare(
        `UPDATE vehicle_inventory SET quantity = 0 WHERE vehicle_id = ? AND alcohol_type = ?`
      ).bind(row.vehicle_id, row.alcohol_type)
    )
  }

  batchOps.push(
    c.env.PROHIBITIONDB.prepare(
      `UPDATE game_players SET cash = cash + ?, total_cash_earned = total_cash_earned + ? WHERE id = ?`
    ).bind(totalRevenue, totalRevenue, playerRow.id),
    c.env.PROHIBITIONDB.prepare(
      `INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`
    ).bind(gameId, playerRow.id,
      `💰 ${playerRow.display_name ?? 'You'} sold everything for $${totalRevenue.toLocaleString()}.`
    ),
    c.env.PROHIBITIONDB.prepare(
      `INSERT INTO ledger_entries (game_id, player_id, season, type, amount, description, city_id) VALUES (?, ?, ?, 'sell_all', ?, 'Sold all stock', NULL)`
    ).bind(gameId, playerRow.id, playerRow.current_season, totalRevenue),
  )

  batchOps.push(
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET sell_used = sell_used + 1 WHERE id = ?`).bind(playerRow.id)
  )
  await c.env.PROHIBITIONDB.batch(batchOps)

  // Update cumulative mission progress for everything sold
  for (const row of [...stockWithPrices, ...vehicleStockWithPrices]) {
    const sellMult = row.alcohol_type === 'whiskey' && charMods?.medicinalPriceMultiplier != null && charMods.medicinalPriceMultiplier !== 1.0
      ? charMods.medicinalPriceMultiplier
      : (charMods?.sellPriceMultiplier ?? 1.0)
    const unitPrice = Math.round((row.market_price ?? BASE_PRICES[row.alcohol_type] ?? 20) * sellMult)
    const revenue = Math.floor(unitPrice * row.quantity)
    await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, {
      type: 'sold_units', quantity: row.quantity, alcoholType: row.alcohol_type, revenue
    })
  }

  // Check mission completion against fresh snapshot after sale
  const [freshRow, maxTierRow, cityCountRow, vehicleCountRow, cargoRows, statRow] = await Promise.all([
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
    c.env.PROHIBITIONDB.prepare(
      `SELECT MAX(? - stationary_since + 1) AS max_stat FROM vehicles WHERE player_id = ? AND stationary_since IS NOT NULL`
    ).bind(playerRow.current_season, playerRow.id).first<{ max_stat: number | null }>(),
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
    maxVehicleStationary: statRow?.max_stat ?? 0,
  }
  const missionResult = await checkAndCompleteMissions(
    c.env.PROHIBITIONDB, gameId, playerRow.id, playerRow.current_season, snapshot
  )

  return c.json({ success: true, revenue: totalRevenue, celebrations: missionResult.completedCardIds.length > 0
    ? missionResult.completedCardIds.map(id => ({ type: 'mission_complete', missionCardId: id, reward: getMissionCard(id)?.reward ?? 0 }))
    : undefined
  })
})

// POST /:id/max-out-vehicles — buy market alcohol at each vehicle's city to fill it to capacity
gamesRouter.post('/:id/max-out-vehicles', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.character_class, gp.cash,
            gp.jail_until_season, gp.max_out_used, g.current_player_index, g.current_season, g.status
     FROM game_players gp JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; character_class: string; cash: number
    jail_until_season: number | null; max_out_used: number; current_player_index: number; current_season: number; status: string
  }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) return c.json({ success: false, message: 'Not your turn' }, 400)
  if (playerRow.jail_until_season != null && playerRow.current_season <= playerRow.jail_until_season) {
    return c.json({ success: false, message: 'Cannot buy while in jail' }, 400)
  }
  if (playerRow.max_out_used >= 1) return c.json({ success: false, message: 'Max-out Cars already used this turn' }, 400)

  // All vehicles + current cargo used
  const { results: vehicles } = await c.env.PROHIBITIONDB.prepare(
    `SELECT v.id, v.vehicle_type, v.city_id,
            COALESCE(SUM(vi.quantity), 0) AS cargo_used
     FROM vehicles v
     LEFT JOIN vehicle_inventory vi ON vi.vehicle_id = v.id
     WHERE v.player_id = ? AND v.game_id = ?
     GROUP BY v.id`
  ).bind(playerRow.id, gameId)
   .all<{ id: number; vehicle_type: string; city_id: number; cargo_used: number }>()

  if (vehicles.length === 0) return c.json({ success: true })

  const batchOps: ReturnType<typeof c.env.PROHIBITIONDB.prepare>[] = []
  let cashRemaining = playerRow.cash

  for (const v of vehicles) {
    const cargoSlots = applyCargoMultiplier(playerRow.character_class, VEHICLES[v.vehicle_type]?.cargoSlots ?? 16)
    const freeSlots = cargoSlots - v.cargo_used
    if (freeSlots <= 0) continue

    // Buy the city's primary alcohol (what its distillery produces) at market price
    const marketRow = await c.env.PROHIBITIONDB.prepare(
      `SELECT cp.primary_alcohol AS alcohol_type, mp.price
       FROM game_cities gc
       JOIN city_pool cp ON gc.city_pool_id = cp.id
       JOIN market_prices mp ON mp.game_id = gc.game_id AND mp.city_id = gc.id
         AND mp.season = ? AND mp.alcohol_type = cp.primary_alcohol
       WHERE gc.id = ? AND gc.game_id = ?`
    ).bind(playerRow.current_season, v.city_id, gameId).first<{ alcohol_type: string; price: number }>()
    if (!marketRow || marketRow.price <= 0) continue

    const maxAfford = Math.floor(cashRemaining / marketRow.price)
    const toBuy = Math.min(freeSlots, maxAfford)
    if (toBuy <= 0) continue

    const cost = Math.round(marketRow.price * toBuy)
    cashRemaining -= cost

    batchOps.push(
      c.env.PROHIBITIONDB.prepare(
        `UPDATE game_players SET cash = cash - ? WHERE id = ?`
      ).bind(cost, playerRow.id),
      c.env.PROHIBITIONDB.prepare(
        `INSERT INTO vehicle_inventory (vehicle_id, alcohol_type, quantity) VALUES (?, ?, ?)
         ON CONFLICT(vehicle_id, alcohol_type) DO UPDATE SET quantity = quantity + excluded.quantity`
      ).bind(v.id, marketRow.alcohol_type, toBuy)
    )
  }

  batchOps.push(
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET max_out_used = max_out_used + 1 WHERE id = ?`).bind(playerRow.id)
  )
  if (batchOps.length > 0) await c.env.PROHIBITIONDB.batch(batchOps)
  return c.json({ success: true })
})

// POST /:id/sell-vehicle — sell a vehicle for 50% of purchase price; cargo is abandoned at its city
gamesRouter.post('/:id/sell-vehicle', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { vehicleId } = await c.req.json<{ vehicleId: number }>()

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, g.current_player_index, g.current_season, g.status
     FROM game_players gp JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number; turn_order: number; current_player_index: number; current_season: number; status: string }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) return c.json({ success: false, message: 'Not your turn' }, 400)

  // Must keep at least one vehicle
  const { results: allVehicles } = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, purchase_price FROM vehicles WHERE player_id = ? AND game_id = ?`
  ).bind(playerRow.id, gameId).all<{ id: number; purchase_price: number }>()
  if (allVehicles.length <= 1) return c.json({ success: false, message: 'Cannot sell your last vehicle' }, 400)

  const vehicle = allVehicles.find(v => v.id === vehicleId)
  if (!vehicle) return c.json({ success: false, message: 'Vehicle not found' }, 404)

  const saleValue = Math.floor(vehicle.purchase_price * 0.5)

  await c.env.PROHIBITIONDB.batch([
    // Refund 50% to player
    c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash + ? WHERE id = ?`).bind(saleValue, playerRow.id),
    // Drop cargo (abandon it — simplest, avoids inventory edge cases)
    c.env.PROHIBITIONDB.prepare(`DELETE FROM vehicle_inventory WHERE vehicle_id = ?`).bind(vehicleId),
    // Remove vehicle
    c.env.PROHIBITIONDB.prepare(`DELETE FROM vehicles WHERE id = ? AND player_id = ?`).bind(vehicleId, playerRow.id),
    c.env.PROHIBITIONDB.prepare(
      `INSERT INTO ledger_entries (game_id, player_id, season, type, amount, description, city_id) VALUES (?, ?, ?, 'sell_vehicle', ?, ?, NULL)`
    ).bind(gameId, playerRow.id, playerRow.current_season, saleValue, `Sold vehicle (50% of $${vehicle.purchase_price.toLocaleString()})`),
  ])

  return c.json({ success: true, saleValue })
})

// GET /:id/auto-rotate-plan — compute move plan that sends each vehicle to a different owned city
gamesRouter.get('/:id/auto-rotate-plan', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.turn_order, gp.character_class, g.current_player_index, g.current_season, g.status
     FROM game_players gp JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{
    id: number; turn_order: number; character_class: string
    current_player_index: number; current_season: number; status: string
  }>()

  if (!playerRow) return c.json({ error: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ error: 'Game not active' }, 400)
  if (playerRow.turn_order !== playerRow.current_player_index) return c.json({ error: 'Not your turn' }, 400)

  const [vehiclesResult, ownedCitiesResult, roadRows] = await Promise.all([
    c.env.PROHIBITIONDB.prepare(
      `SELECT id, vehicle_type, city_id FROM vehicles WHERE player_id = ? AND game_id = ?`
    ).bind(playerRow.id, gameId).all<{ id: number; vehicle_type: string; city_id: number }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT gc.id FROM game_cities gc WHERE gc.game_id = ? AND gc.owner_player_id = ?`
    ).bind(gameId, playerRow.id).all<{ id: number }>(),
    c.env.PROHIBITIONDB.prepare(
      `SELECT from_city_id, to_city_id, distance_value FROM roads WHERE game_id = ?`
    ).bind(gameId).all<{ from_city_id: number; to_city_id: number; distance_value: number }>(),
  ])

  const vehicles = vehiclesResult.results
  const ownedCityIds = ownedCitiesResult.results.map(r => r.id).sort((a, b) => a - b)

  if (vehicles.length === 0 || ownedCityIds.length === 0) {
    return c.json({ roll: 7, vehicles: [] })
  }

  // Build a minimal graph from roads (nodes only need IDs for Dijkstra)
  const allCityIds = new Set<number>()
  for (const r of roadRows.results) { allCityIds.add(r.from_city_id); allCityIds.add(r.to_city_id) }
  const dummyNodes = Array.from(allCityIds).map(id => ({
    id, name: '', region: '', primaryAlcohol: '', demandIndex: 1, isCoastal: false,
    populationTier: 'small' as const, lat: 0, lon: 0
  }))
  const graph = buildGraph(dummyNodes, roadRows.results.map(r => ({
    fromCityId: r.from_city_id, toCityId: r.to_city_id, distanceValue: r.distance_value
  })))

  // Greedy assignment: each vehicle → nearest unassigned owned city (not its current city)
  const vehiclesSorted = [...vehicles].sort((a, b) => a.id - b.id)
  const usedTargets = new Set<number>()

  interface Assignment { vehicleId: number; targetPath: number[]; cost: number; vehicleType: string }
  const assignments: Assignment[] = []

  for (const v of vehiclesSorted) {
    let best: { cityId: number; path: number[]; cost: number } | null = null

    // First pass: unassigned cities not equal to vehicle's current city
    for (const cityId of ownedCityIds) {
      if (usedTargets.has(cityId) || cityId === v.city_id) continue
      const result = getShortestPath(graph, v.city_id, cityId)
      if (!result.path) continue
      if (!best || result.totalCost < best.cost) {
        best = { cityId, path: result.path.slice(1), cost: result.totalCost }
      }
    }

    // Second pass: allow already-assigned cities if no unassigned options found
    if (!best) {
      for (const cityId of ownedCityIds) {
        if (cityId === v.city_id) continue
        const result = getShortestPath(graph, v.city_id, cityId)
        if (!result.path) continue
        if (!best || result.totalCost < best.cost) {
          best = { cityId, path: result.path.slice(1), cost: result.totalCost }
        }
      }
    }

    if (best && best.path.length > 0) {
      usedTargets.add(best.cityId)
      assignments.push({ vehicleId: v.id, targetPath: best.path, cost: best.cost, vehicleType: v.vehicle_type })
    }
  }

  if (assignments.length === 0) return c.json({ roll: 7, vehicles: [] })

  // Use max roll for best coverage
  const numDice = vehicles.length + 1
  const roll = numDice * 6
  const effectiveTotal = Math.floor(applyMovementModifier(playerRow.character_class, roll))

  // Allocate raw points per vehicle (accounting for vehicle movement multiplier)
  const rawNeeded = assignments.map(a => {
    const mult = VEHICLES[a.vehicleType]?.movementMultiplier ?? 1.0
    return Math.ceil(a.cost / mult)
  })
  const totalNeeded = rawNeeded.reduce((s, n) => s + n, 0)

  const vehiclePlan = assignments.map((a, i) => ({
    vehicleId: a.vehicleId,
    targetPath: a.targetPath,
    allocatedPoints: totalNeeded <= effectiveTotal
      ? rawNeeded[i]
      : Math.floor(rawNeeded[i] * effectiveTotal / totalNeeded)
  }))

  return c.json({ roll, vehicles: vehiclePlan })
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
  // Verify player has any vehicle at the target city (not just lead car)
  const vehicleAtCity = await c.env.PROHIBITIONDB.prepare(
    `SELECT id FROM vehicles WHERE player_id = ? AND city_id = ? LIMIT 1`
  ).bind(playerRow.id, cityId).first()
  if (!vehicleAtCity) {
    return c.json({ success: false, message: 'No vehicle at this city' }, 400)
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

  const attackerName = playerRow.display_name ?? 'Someone'
  const ownerName = stillRow.owner_name ?? 'Someone'

  if (stillRow.tier <= 1) {
    // Tier 1 — destroy the still entirely; it will be recreated on next season rollover
    await c.env.PROHIBITIONDB.batch([
      c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET cash = cash - ? WHERE id = ?`).bind(cost, playerRow.id),
      c.env.PROHIBITIONDB.prepare(`UPDATE game_players SET heat = MIN(100, heat + ?) WHERE id = ?`).bind(heatIncrease, playerRow.id),
      c.env.PROHIBITIONDB.prepare(`DELETE FROM distilleries WHERE id = ?`).bind(stillRow.id),
      c.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`
      ).bind(gameId, playerRow.id,
        `💣 ${attackerName} destroyed ${ownerName}'s still in ${stillRow.city_name}! They'll have to rebuild from scratch.`
      ),
    ])
  } else {
    const newTier = stillRow.tier - 1
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
  }

  await updateCumulativeProgress(c.env.PROHIBITIONDB, playerRow.id, { type: 'sabotage_completed' })

  const newTier = stillRow.tier <= 1 ? 0 : stillRow.tier - 1
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
// POST /:id/missions/abandon — pay the penalty and discard a held mission
gamesRouter.post('/:id/missions/abandon', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')
  const { missionId } = await c.req.json<{ missionId: number }>()

  const playerRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT gp.id, gp.cash, g.current_season, g.status
     FROM game_players gp JOIN games g ON g.id = gp.game_id
     WHERE gp.game_id = ? AND gp.user_id = ?`
  ).bind(gameId, userId).first<{ id: number; cash: number; current_season: number; status: string }>()

  if (!playerRow) return c.json({ success: false, message: 'Not in game' }, 403)
  if (playerRow.status !== 'active') return c.json({ success: false, message: 'Game not active' }, 400)

  // Verify the player holds this mission
  const missionRow = await c.env.PROHIBITIONDB.prepare(
    `SELECT id, card_id FROM player_missions WHERE id = ? AND player_id = ? AND status = 'held'`
  ).bind(missionId, playerRow.id).first<{ id: number; card_id: number }>()

  if (!missionRow) return c.json({ success: false, message: 'Mission not found' }, 404)

  const card = getMissionCard(missionRow.card_id)
  const penalty = card?.reward ?? 0

  if (playerRow.cash < penalty) {
    return c.json({ success: false, message: `Not enough cash — need $${penalty.toLocaleString()} to abandon this mission` }, 400)
  }

  // Mark failed and apply penalty
  await c.env.PROHIBITIONDB.batch([
    c.env.PROHIBITIONDB.prepare(
      `UPDATE player_missions SET status = 'failed', penalty_paid = 1 WHERE id = ?`
    ).bind(missionRow.id),
    c.env.PROHIBITIONDB.prepare(
      `UPDATE game_players SET cash = MAX(0, cash - ?) WHERE id = ?`
    ).bind(penalty, playerRow.id),
    c.env.PROHIBITIONDB.prepare(
      `INSERT INTO game_messages (game_id, player_id, message) VALUES (?, ?, ?)`
    ).bind(gameId, playerRow.id,
      `🗑️ Abandoned mission "${card?.title ?? 'Unknown'}" — paid $${penalty.toLocaleString()} penalty.`
    ),
  ])

  return c.json({ success: true, penalty })
})

gamesRouter.post('/:id/dismiss-drinks', async (c) => {
  const gameId = c.req.param('id')
  const userId = c.get('userId')

  await c.env.PROHIBITIONDB.prepare(
    `UPDATE game_players SET pending_drinks = NULL, pending_trap = NULL WHERE game_id = ? AND user_id = ?`
  ).bind(gameId, userId).run()

  return c.json({ success: true })
})
