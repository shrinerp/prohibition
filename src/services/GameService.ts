import type { Env } from '../index'
import { buildGraph, generateRoads } from '../game/mapEngine'

// ── Market price constants ────────────────────────────────────────────────────
export const ALCOHOL_BASE_PRICES: Record<string, number> = {
  beer: 15, gin: 25, rum: 20, whiskey: 30, moonshine: 20,
  vodka: 22, bourbon: 28, rye: 26, scotch: 35, tequila: 24,
  brandy: 28, wine: 18, vermouth: 22, malort: 15
}

const TIER_MULT: Record<string, number> = { small: 0.9, medium: 1.0, large: 1.1, major: 1.2 }

/**
 * Generate (or regenerate) market prices for every city for a given season.
 * Cities oversupply their primary alcohol (0.65×); all other types reflect
 * demand_index + population tier + ±15% random variance.
 * Uses D1 batch for efficiency.
 */
export async function buildMarketPrices(
  db: Env['PROHIBITIONDB'],
  gameId: string,
  season: number,
  cities: Array<{ id: number; primary_alcohol: string; demand_index: number; population_tier: string }>
): Promise<void> {
  const stmts = []
  for (const city of cities) {
    for (const [alcoholType, basePrice] of Object.entries(ALCOHOL_BASE_PRICES)) {
      const supplyMult = alcoholType === city.primary_alcohol ? 0.65 : 1.0
      const tierMult   = TIER_MULT[city.population_tier] ?? 1.0
      const variance   = 0.85 + Math.random() * 0.30   // 0.85 – 1.15
      const price      = Math.max(5, Math.round(basePrice * supplyMult * city.demand_index * tierMult * variance))
      stmts.push(db.prepare(
        `INSERT OR REPLACE INTO market_prices (game_id, city_id, season, alcohol_type, price)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(gameId, city.id, season, alcoholType, price))
    }
  }
  if (stmts.length > 0) await db.batch(stmts)
}

const STARTING_CASH = 200
const STARTING_ADJUSTMENT_CARDS = 3
const MIN_CITIES = 15
const MAX_CITIES = 20
const MAX_PLAYERS = 5
const REGIONS = ['Midwest', 'East Coast', 'South', 'West Coast', 'West'] as const

interface CityPoolRow {
  id: number
  region: string
  lat: number
  lon: number
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
      `SELECT id, region, lat, lon FROM city_pool`
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

    const NPC_NAMES = [
      'Big Al', 'Lucky Luciano', 'Dutch Schultz', 'Bugs Moran',
      'Machine Gun Kelly', 'Pretty Boy Floyd', 'Scarface McGee', 'The Barber',
      'Two-Fingers Moretti', 'Knuckles O\'Brien'
    ]
    // Shuffle so NPCs get varied names each game
    const shuffledNames = [...NPC_NAMES].sort(() => Math.random() - 0.5)
    let npcNameIndex = 0

    for (let i = players.length; i < MAX_PLAYERS; i++) {
      const npcName = shuffledNames[npcNameIndex++ % shuffledNames.length]
      await this.env.PROHIBITIONDB.prepare(
        `INSERT INTO game_players (game_id, user_id, turn_order, character_class, is_npc, cash, heat, adjustment_cards, display_name)
         VALUES (?, NULL, ?, 'npc_syndicate', 1, ?, ?, ?, ?)`
      ).bind(gameId, i, STARTING_CASH, 0, STARTING_ADJUSTMENT_CARDS, npcName).run()
    }

    // Assign home bases — spread players across cities
    const allPlayers = await this.env.PROHIBITIONDB.prepare(
      `SELECT id FROM game_players WHERE game_id = ? ORDER BY turn_order`
    ).bind(gameId).all<{ id: number }>()

    for (let i = 0; i < allPlayers.results.length; i++) {
      const cityId = cityNodes[i % cityNodes.length].id
      const playerId = allPlayers.results[i].id
      await this.env.PROHIBITIONDB.prepare(
        `UPDATE game_players SET home_city_id = ?, current_city_id = ? WHERE id = ?`
      ).bind(cityId, cityId, playerId).run()
      await this.env.PROHIBITIONDB.prepare(
        `UPDATE game_cities SET owner_player_id = ? WHERE id = ?`
      ).bind(playerId, cityId).run()
      // Give each player a Tier-1 still at their home city
      await this.env.PROHIBITIONDB.prepare(
        `INSERT INTO distilleries (player_id, city_id, tier, still_number, purchase_price) VALUES (?, ?, 1, 1, 0)`
      ).bind(playerId, cityId).run()
      // Give each player a Workhorse vehicle at their home city
      await this.env.PROHIBITIONDB.prepare(
        `INSERT INTO vehicles (player_id, game_id, vehicle_type, city_id, purchase_price) VALUES (?, ?, 'workhorse', ?, 0)`
      ).bind(playerId, gameId, cityId).run()
    }

    // Generate market prices for season 1
    const cityPriceData = gameCities.map(c => ({
      id: c.id, primary_alcohol: c.primary_alcohol,
      demand_index: c.demand_index, population_tier: c.population_tier
    }))
    await buildMarketPrices(this.env.PROHIBITIONDB, gameId, 1, cityPriceData)

    // Set deadline for first turn
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await this.env.PROHIBITIONDB.prepare(
      `UPDATE games SET status = 'active', current_season = 1, turn_deadline = ? WHERE id = ?`
    ).bind(deadline, gameId).run()

    return { success: true }
  }

  selectCities(pool: CityPoolRow[]): CityPoolRow[] {
    // Minimum map distance between any two selected cities (degrees, ~130 km)
    const MIN_DIST = 1.5
    function tooClose(a: CityPoolRow, b: CityPoolRow): boolean {
      if (!a.lat || !a.lon || !b.lat || !b.lon) return false
      const dlat = a.lat - b.lat
      const dlon = (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180)
      return Math.sqrt(dlat * dlat + dlon * dlon) < MIN_DIST
    }
    function conflictsWithSelected(c: CityPoolRow): boolean {
      return selected.some(s => tooClose(s, c))
    }

    // Guarantee at least one city per region, then fill to 15-20 total
    const byRegion = new Map<string, CityPoolRow[]>()
    for (const city of pool) {
      if (!byRegion.has(city.region)) byRegion.set(city.region, [])
      byRegion.get(city.region)!.push(city)
    }

    const selected: CityPoolRow[] = []
    const used = new Set<number>()

    // One guaranteed per region — pick the first candidate that isn't too close
    for (const region of REGIONS) {
      const candidates = (byRegion.get(region) ?? [])
        .filter(c => !used.has(c.id))
        .sort(() => Math.random() - 0.5)
      for (const pick of candidates) {
        if (!conflictsWithSelected(pick)) {
          selected.push(pick)
          used.add(pick.id)
          break
        }
      }
    }

    // Fill to a random count between MAX and MIN
    const target = MIN_CITIES + Math.floor(Math.random() * (MAX_CITIES - MIN_CITIES + 1))
    const remaining = pool.filter(c => !used.has(c.id)).sort(() => Math.random() - 0.5)

    for (const city of remaining) {
      if (selected.length >= target) break
      if (conflictsWithSelected(city)) continue
      selected.push(city)
      used.add(city.id)
    }

    return selected
  }
}
