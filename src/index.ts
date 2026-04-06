import { Hono } from 'hono'
import { authRouter } from './routes/auth'
import { gamesRouter } from './routes/games'

export interface Env {
  PROHIBITIONDB: D1Database
  ENCRYPTION_KEY: string
  MAILS_API_KEY: string
  MAILS_ENDPOINT: string
}

const app = new Hono<{ Bindings: Env }>()

app.get('/health', (c) => c.json({ ok: true, service: 'prohibition', ts: Date.now() }))
app.route('/auth', authRouter)
app.route('/api/games', gamesRouter)

export default app
