import { Hono } from 'hono'
import { authRouter } from './routes/auth'
import { gamesRouter } from './routes/games'
import { adminRouter } from './routes/admin'
import { pushRouter } from './routes/push'

export interface Env {
  PROHIBITIONDB: D1Database
  ENCRYPTION_KEY: string
  MAILS_API_KEY: string
  MAILS_ENDPOINT: string
  THREEMAILS_API_KEY: string
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  ASSETS: { fetch: (req: Request) => Promise<Response> }
  EMAIL: {
    send: (options: {
      to: string
      from: string
      subject: string
      html?: string
      text?: string
    }) => Promise<{ messageId: string }>
  }
}

const app = new Hono<{ Bindings: Env }>()

app.get('/health', (c) => c.json({ ok: true, service: 'prohibition', ts: Date.now() }))

app.get('/llms.txt', (c) =>
  c.text(`# Prohibitioner

## What is Prohibitioner?
Prohibitioner is a turn-based multiplayer strategy game set during American Prohibition (1920–1933).
Players produce alcohol at home distilleries, move vehicles across a map of 52 US cities, buy and
sell on city markets, bribe officials, claim territory, and evade police — all while racing to
amass the largest fortune before Winter 1933.

## How to play
- Each player takes one turn per season (52 seasons total, Spring 1920 – Winter 1933)
- Roll dice to move vehicles between cities on the road network
- Buy low, sell high across city markets with fluctuating prices
- Upgrade distilleries (5 tiers) to increase alcohol production per season
- Bribe city officials to avoid police encounters
- Claim cities to establish new distillery outposts
- The player with the highest net worth at season 52 wins

## Key features
- 52 US cities chosen randomly each game for unique experiences
- 10 playable characters from the Prohibition era, each with unique stat modifiers
- 4 vehicle types: Workhorse, Roadster, Truck, Whiskey Runner
- 14 alcohol types with dynamic market pricing
- Async multiplayer — take your turn whenever, game emails you when it's your move
- Progressive Web App — installable on iOS and Android

## URL
https://prohibitioner.com

## Developer
Senders LLC, 2026
`)
)

app.route('/auth', authRouter)

app.get('/api/public/results/:gameId', async (c) => {
  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT le.player_name, le.character_class, le.rank, le.net_worth,
            le.failed_missions, le.seasons_jailed, le.total_seasons, le.ended_at,
            g.game_name
     FROM leaderboard_entries le
     JOIN games g ON le.game_id = g.id
     WHERE le.game_id = ?
     ORDER BY le.rank ASC`
  ).bind(c.req.param('gameId')).all()
  if (!results.length) return c.json({ success: false, message: 'Not found' }, 404)
  return c.json({ success: true, data: { gameId: c.req.param('gameId'), players: results } })
})

app.get('/api/public/shame', async (c) => {
  const { results } = await c.env.PROHIBITIONDB.prepare(
    `SELECT le.game_id, le.player_name, le.character_class, le.rank,
            le.net_worth, le.failed_missions, le.seasons_jailed,
            le.total_seasons, le.ended_at, g.game_name
     FROM leaderboard_entries le
     JOIN games g ON le.game_id = g.id
     WHERE le.ended_at > datetime('now', '-30 days')
     ORDER BY le.ended_at DESC, le.rank ASC`
  ).all()
  return c.json({ success: true, data: { entries: results } })
})

app.route('/api/games', gamesRouter)
app.route('/api/admin', adminRouter)
app.route('/api/push', pushRouter)

// Serve static assets; fall back to index.html for SPA client-side routes
app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (res.ok) return res
  // Only serve SPA shell for navigation requests (no file extension).
  // Let actual asset 404s (images, js, css) pass through as-is.
  const path = new URL(c.req.url).pathname
  const isAsset = /\.[a-zA-Z0-9]+$/.test(path)
  if (!isAsset) {
    return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url).toString()))
  }
  return res
})

// ── Scheduled cleanup ─────────────────────────────────────────────────────────
// Runs daily at 03:00 UTC via cron trigger.
// Deletes any game where the last activity (turn or creation) was 7+ days ago.
async function deleteStaleGames(db: D1Database) {
  const stale = await db.prepare(
    `SELECT g.id FROM games g
     WHERE COALESCE(
       (SELECT MAX(t.resolved_at) FROM turns t WHERE t.game_id = g.id),
       g.created_at
     ) < datetime('now', '-7 days')`
  ).all<{ id: string }>()

  for (const { id } of stale.results) {
    // Record tombstones for all human players before wiping the game
    const meta = await db.prepare(
      `SELECT g.game_name, gp.user_id
       FROM games g
       JOIN game_players gp ON gp.game_id = g.id
       WHERE g.id = ? AND gp.is_npc = 0 AND gp.user_id IS NOT NULL`
    ).bind(id).all<{ game_name: string | null; user_id: number }>()

    if (meta.results.length > 0) {
      const gameName = meta.results[0].game_name
      await db.batch(
        meta.results.map(r =>
          db.prepare(`INSERT INTO game_tombstones (user_id, game_name) VALUES (?, ?)`)
            .bind(r.user_id, gameName)
        )
      )
    }

    await db.batch([
      db.prepare(`DELETE FROM npc_state        WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`).bind(id),
      db.prepare(`DELETE FROM heat_history      WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`).bind(id),
      db.prepare(`DELETE FROM jail_sentences    WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`).bind(id),
      db.prepare(`DELETE FROM inventory         WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`).bind(id),
      db.prepare(`DELETE FROM vehicle_inventory WHERE vehicle_id IN (SELECT id FROM vehicles WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?))`).bind(id),
      db.prepare(`DELETE FROM vehicles          WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`).bind(id),
      db.prepare(`DELETE FROM turns             WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM distilleries      WHERE player_id IN (SELECT id FROM game_players WHERE game_id = ?)`).bind(id),
      db.prepare(`DELETE FROM city_inventory    WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM market_prices     WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM alliance_chat     WHERE alliance_id IN (SELECT id FROM alliances WHERE game_id = ?)`).bind(id),
      db.prepare(`DELETE FROM alliances         WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM traps             WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM city_stashes      WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM game_messages     WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM roads             WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM game_players      WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM game_cities       WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM year_events       WHERE game_id = ?`).bind(id),
      db.prepare(`DELETE FROM games             WHERE id      = ?`).bind(id),
    ])
    console.log(`[cron] deleted stale game ${id}`)
  }

  console.log(`[cron] cleanup done — removed ${stale.results.length} game(s)`)
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    await deleteStaleGames(env.PROHIBITIONDB)
  },
}
