import type { D1Database } from '@cloudflare/workers-types'
import { VEHICLE_PRICES } from '../game/movement'

const DIST_VALUE: Record<number, number> = { 1: 50, 2: 175, 3: 425, 4: 900, 5: 1900 }
const BASE_PRICES: Record<string, number> = {
  beer: 15, gin: 25, rum: 20, whiskey: 30, moonshine: 20,
  vodka: 22, bourbon: 28, rye: 26, scotch: 35, tequila: 24,
  brandy: 28, wine: 18, vermouth: 22, malort: 15,
}

/**
 * Compute final net worth for all human players in a game and write snapshot
 * rows to leaderboard_entries. Uses INSERT OR IGNORE so it is safe to call
 * from both end-game code paths — only the first call per (game_id, user_id)
 * pair will land.
 */
export async function recordLeaderboardEntries(
  db: D1Database,
  gameId: string,
  totalSeasons: number,
  currentSeason: number
): Promise<void> {
  const [
    { results: players },
    { results: allVehInv },
    { results: allVehs },
    { results: allDists },
    { results: ownedCities },
    { results: avgPrices },
    { results: failedMissions },
    { results: jailStats },
  ] = await Promise.all([
    db.prepare(
      `SELECT gp.id, gp.user_id, COALESCE(gp.display_name, u.email) AS name,
              gp.cash, gp.is_npc, gp.character_class
       FROM game_players gp LEFT JOIN users u ON gp.user_id = u.id
       WHERE gp.game_id = ? ORDER BY gp.turn_order`
    ).bind(gameId).all<{ id: number; user_id: number | null; name: string; cash: number; is_npc: number; character_class: string }>(),
    db.prepare(
      `SELECT vi.alcohol_type, vi.quantity, v.player_id
       FROM vehicle_inventory vi
       JOIN vehicles v ON vi.vehicle_id = v.id
       JOIN game_players gp ON v.player_id = gp.id
       WHERE gp.game_id = ?`
    ).bind(gameId).all<{ alcohol_type: string; quantity: number; player_id: number }>(),
    db.prepare(
      `SELECT v.player_id, v.vehicle_type, v.purchase_price
       FROM vehicles v JOIN game_players gp ON v.player_id = gp.id
       WHERE gp.game_id = ?`
    ).bind(gameId).all<{ player_id: number; vehicle_type: string; purchase_price: number }>(),
    db.prepare(
      `SELECT d.player_id, d.tier FROM distilleries d
       JOIN game_players gp ON d.player_id = gp.id WHERE gp.game_id = ?`
    ).bind(gameId).all<{ player_id: number; tier: number }>(),
    db.prepare(
      `SELECT owner_player_id, claim_cost FROM game_cities
       WHERE game_id = ? AND owner_player_id IS NOT NULL`
    ).bind(gameId).all<{ owner_player_id: number; claim_cost: number }>(),
    db.prepare(
      `SELECT alcohol_type, AVG(price) AS avg_price FROM market_prices
       WHERE game_id = ? AND season = ? GROUP BY alcohol_type`
    ).bind(gameId, currentSeason).all<{ alcohol_type: string; avg_price: number }>(),
    db.prepare(
      `SELECT pm.player_id, COUNT(*) AS cnt
       FROM player_missions pm
       JOIN game_players gp ON pm.player_id = gp.id
       WHERE gp.game_id = ? AND pm.status = 'failed' AND gp.is_npc = 0
       GROUP BY pm.player_id`
    ).bind(gameId).all<{ player_id: number; cnt: number }>(),
    db.prepare(
      `SELECT gp.id AS player_id,
              SUM(js.release_season - js.sentenced_season) AS total_jailed
       FROM jail_sentences js
       JOIN game_players gp ON js.player_id = gp.id
       WHERE gp.game_id = ? AND gp.is_npc = 0
       GROUP BY gp.id`
    ).bind(gameId).all<{ player_id: number; total_jailed: number }>(),
  ])

  const priceMap = new Map(avgPrices.map(p => [p.alcohol_type, Math.round(p.avg_price)]))

  const scored = players
    .filter(p => p.is_npc === 0 && p.user_id !== null)
    .map(p => {
      const invVal  = allVehInv.filter(i => i.player_id === p.id)
        .reduce((s, i) => s + i.quantity * (priceMap.get(i.alcohol_type) ?? BASE_PRICES[i.alcohol_type] ?? 0), 0)
      const distVal = allDists.filter(d => d.player_id === p.id)
        .reduce((s, d) => s + (DIST_VALUE[d.tier] ?? 200), 0)
      const vehVal  = allVehs.filter(v => v.player_id === p.id)
        .reduce((s, v) => s + (VEHICLE_PRICES[v.vehicle_type] ?? v.purchase_price ?? 200), 0)
      const cityVal = ownedCities.filter(c => c.owner_player_id === p.id)
        .reduce((s, c) => s + (c.claim_cost ?? 0), 0)
      const failedCount = failedMissions.find(f => f.player_id === p.id)?.cnt ?? 0
      const jailedSeasons = jailStats.find(j => j.player_id === p.id)?.total_jailed ?? 0
      return { ...p, netWorth: Math.round(p.cash + invVal + distVal + vehVal + cityVal), failedCount, jailedSeasons }
    })
    .sort((a, b) => b.netWorth - a.netWorth)

  if (scored.length === 0) return

  await db.batch(scored.map((p, i) =>
    db.prepare(
      `INSERT OR IGNORE INTO leaderboard_entries
         (game_id, user_id, player_name, character_class, rank, net_worth, total_seasons, failed_missions, seasons_jailed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(gameId, p.user_id, p.name, p.character_class, i + 1, p.netWorth, totalSeasons, p.failedCount, p.jailedSeasons)
  ))
}
