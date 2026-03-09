import type { Env } from '../index'
import { buildGraph, generateRoads } from '../game/mapEngine'

const STARTING_CASH = 200
const STARTING_ADJUSTMENT_CARDS = 3
const MIN_CITIES = 15
const MAX_CITIES = 20
const MAX_PLAYERS = 5
const REGIONS = ['Midwest', 'East Coast', 'South', 'West Coast', 'West'] as const

interface CityPoolRow {
  id: number
  region: string
}

interface GameResult {
  success: boolean
  message?: string
  gameId?: string
  inviteCode?: string
}

export class GameService {
  constructor(private env: Env) {}

  async createGame(userId: number): Promise<GameResult> {
    const gameId = crypto.randomUUID()
    const inviteCode = crypto.randomUUID().split('-')[0].toUpperCase()

    await this.env.PROHIBITIONDB.prepare(
      `INSERT INTO games (id, invite_code, status, host_user_id) VALUES (?, ?, 'lobby', ?)`
    ).bind(gameId, inviteCode, userId).run()

    await this.env.PROHIBITIONDB.prepare(
      `INSERT INTO game_players (game_id, user_id, turn_order, character_class, is_npc, cash, heat, adjustment_cards)
       VALUES (?, ?, 0, 'unselected', 0, ?, ?, ?)`
    ).bind(gameId, userId, STARTING_CASH, 0, STARTING_ADJUSTMENT_CARDS).run()

    return { success: true, gameId, inviteCode }
  }

  async joinGame(inviteCode: string, userId: number): Promise<GameResult> {
    const game = await this.env.PROHIBITIONDB.prepare(
      `SELECT id, status, player_count FROM games WHERE invite_code = ?`
    ).bind(inviteCode).first<{ id: string; status: string; player_count: number }>()

    if (!game) return { success: false, message: 'Game not found' }
    if (game.status !== 'lobby') return { success: false, message: 'Game already started' }
    if (game.player_count >= MAX_PLAYERS) return { success: false, message: 'Game is full' }

    const turnOrder = game.player_count
    await this.env.PROHIBITIONDB.prepare(
      `INSERT INTO game_players (game_id, user_id, turn_order, character_class, is_npc, cash, heat, adjustment_cards)
       VALUES (?, ?, ?, 'unselected', 0, ?, ?, ?)`
    ).bind(game.id, userId, turnOrder, STARTING_CASH, 0, STARTING_ADJUSTMENT_CARDS).run()

    await this.env.PROHIBITIONDB.prepare(
      `UPDATE games SET player_count = player_count + 1 WHERE id = ?`
    ).bind(game.id).run()

    return { success: true, gameId: game.id }
  }

  async selectCharacter(gameId: string, userId: number, characterClass: string): Promise<GameResult> {
    // Check no duplicate class in this game
    const existing = await this.env.PROHIBITIONDB.prepare(
      `SELECT id FROM game_players WHERE game_id = ? AND character_class = ? AND user_id != ?`
    ).bind(gameId, characterClass, userId).first()
    if (existing) return { success: false, message: 'Character already taken' }

    await this.env.PROHIBITIONDB.prepare(
      `UPDATE game_players SET character_class = ? WHERE game_id = ? AND user_id = ?`
    ).bind(characterClass, gameId, userId).run()

    return { success: true }
  }

  async startGame(gameId: string, userId: number): Promise<GameResult> {
    const game = await this.env.PROHIBITIONDB.prepare(
      `SELECT id, status, host_user_id FROM games WHERE id = ?`
    ).bind(gameId).first<{ id: string; status: string; host_user_id: number }>()

    if (!game) return { success: false, message: 'Game not found' }
    if (game.status !== 'lobby') return { success: false, message: 'Game already started' }
    if (game.host_user_id !== userId) return { success: false, message: 'Only the host can start the game' }

    // Load city pool and select 15-20 cities
    const { results: cityPool } = await this.env.PROHIBITIONDB.prepare(
      `SELECT id, region FROM city_pool`
    ).bind().all<CityPoolRow>()

    const selectedCities = this.selectCities(cityPool)

    // Insert selected cities into game_cities
    for (const city of selectedCities) {
      await this.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_cities (game_id, city_pool_id, demand_index) VALUES (?, ?, 1.0)`
      ).bind(gameId, city.id).run()
    }

    // Fetch the inserted city rows so we can generate roads with real IDs
    const { results: gameCities } = await this.env.PROHIBITIONDB.prepare(
      `SELECT gc.id, cp.name, cp.region, cp.primary_alcohol, cp.population_tier, cp.is_coastal,
              gc.demand_index, cp.lat, cp.lon
       FROM game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id
       WHERE gc.game_id = ?`
    ).bind(gameId).all<{
      id: number; name: string; region: string;
      primary_alcohol: string; population_tier: string; is_coastal: number; demand_index: number
      lat: number; lon: number
    }>()

    // Build CityNode list using game_city IDs (not pool IDs)
    const cityNodes = gameCities.map(c => ({
      id:             c.id,
      name:           c.name,
      region:         c.region,
      primaryAlcohol: c.primary_alcohol,
      demandIndex:    c.demand_index,
      isCoastal:      c.is_coastal === 1,
      populationTier: c.population_tier as 'small' | 'medium' | 'large' | 'major',
      lat:            c.lat,
      lon:            c.lon
    }))

    const roads = generateRoads(cityNodes)
    for (const road of roads) {
      await this.env.PROHIBITIONDB.prepare(
        `INSERT INTO roads (game_id, from_city_id, to_city_id, distance_value) VALUES (?, ?, ?, ?)`
      ).bind(gameId, road.fromCityId, road.toCityId, road.distanceValue).run()
    }

    // Backfill empty slots with NPCs
    const { results: players } = await this.env.PROHIBITIONDB.prepare(
      `SELECT id, turn_order FROM game_players WHERE game_id = ?`
    ).bind(gameId).all<{ id: number; turn_order: number }>()

    for (let i = players.length; i < MAX_PLAYERS; i++) {
      await this.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_players (game_id, user_id, turn_order, character_class, is_npc, cash, heat, adjustment_cards)
         VALUES (?, NULL, ?, 'npc_syndicate', 1, ?, ?, ?)`
      ).bind(gameId, i, STARTING_CASH, 0, STARTING_ADJUSTMENT_CARDS).run()
    }

    // Assign home bases — spread players across cities
    const allPlayers = await this.env.PROHIBITIONDB.prepare(
      `SELECT id FROM game_players WHERE game_id = ? ORDER BY turn_order`
    ).bind(gameId).all<{ id: number }>()

    for (let i = 0; i < allPlayers.results.length; i++) {
      const cityId = cityNodes[i % cityNodes.length].id
      await this.env.PROHIBITIONDB.prepare(
        `UPDATE game_players SET home_city_id = ?, current_city_id = ? WHERE id = ?`
      ).bind(cityId, cityId, allPlayers.results[i].id).run()
    }

    // Set deadline for first turn
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await this.env.PROHIBITIONDB.prepare(
      `UPDATE games SET status = 'active', current_season = 1, turn_deadline = ? WHERE id = ?`
    ).bind(deadline, gameId).run()

    return { success: true }
  }

  selectCities(pool: CityPoolRow[]): CityPoolRow[] {
    // Guarantee at least one city per region, then fill to 15-20 total
    const byRegion = new Map<string, CityPoolRow[]>()
    for (const city of pool) {
      if (!byRegion.has(city.region)) byRegion.set(city.region, [])
      byRegion.get(city.region)!.push(city)
    }

    const selected: CityPoolRow[] = []
    const used = new Set<number>()

    // One guaranteed per region
    for (const region of REGIONS) {
      const candidates = (byRegion.get(region) ?? []).filter(c => !used.has(c.id))
      if (candidates.length === 0) continue
      const pick = candidates[Math.floor(Math.random() * candidates.length)]
      selected.push(pick)
      used.add(pick.id)
    }

    // Fill to a random count between MAX and MIN
    const target = MIN_CITIES + Math.floor(Math.random() * (MAX_CITIES - MIN_CITIES + 1))
    const remaining = pool.filter(c => !used.has(c.id)).sort(() => Math.random() - 0.5)

    for (const city of remaining) {
      if (selected.length >= target) break
      selected.push(city)
      used.add(city.id)
    }

    return selected
  }
}
